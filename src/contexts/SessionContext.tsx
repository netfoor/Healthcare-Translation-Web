'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { TranslationSession } from '@/lib/types';
import { SessionService } from '@/lib/session-service';
import { useAuth } from './AuthContext';

interface SessionContextType {
  currentSession: TranslationSession | null;
  isLoading: boolean;
  recentSessions: TranslationSession[];
  createSession: (inputLanguage: string, outputLanguage: string) => Promise<TranslationSession>;
  updateSessionLanguages: (inputLanguage: string, outputLanguage: string) => Promise<void>;
  updateActivity: () => Promise<void>;
  pauseSession: () => Promise<void>;
  resumeSession: (sessionId: string) => Promise<TranslationSession>;
  endSession: () => Promise<void>;
  loadRecentSessions: () => Promise<void>;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}

interface SessionProviderProps {
  children: React.ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { isAuthenticated } = useAuth();
  const [currentSession, setCurrentSession] = useState<TranslationSession | null>(null);
  const [recentSessions, setRecentSessions] = useState<TranslationSession[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const sessionService = SessionService.getInstance();

  // Load recent sessions when user is authenticated
  const loadRecentSessions = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      setIsLoading(true);
      const sessions = await sessionService.getUserSessions(10);
      setRecentSessions(sessions);
    } catch (error) {
      console.error('Error loading recent sessions:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, sessionService]);

  // Create a new session
  const createSession = useCallback(async (
    inputLanguage: string,
    outputLanguage: string
  ): Promise<TranslationSession> => {
    try {
      setIsLoading(true);
      const session = await sessionService.createSession(inputLanguage, outputLanguage);
      setCurrentSession(session);
      
      // Refresh recent sessions
      await loadRecentSessions();
      
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionService, loadRecentSessions]);

  // Update session languages
  const updateSessionLanguages = useCallback(async (
    inputLanguage: string,
    outputLanguage: string
  ): Promise<void> => {
    try {
      await sessionService.updateSessionLanguages(inputLanguage, outputLanguage);
      
      // Update local state
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          inputLanguage,
          outputLanguage,
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      console.error('Error updating session languages:', error);
      throw error;
    }
  }, [sessionService, currentSession]);

  // Update session activity
  const updateActivity = useCallback(async (): Promise<void> => {
    try {
      await sessionService.updateSessionActivity();
      
      // Update local state
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      console.error('Error updating session activity:', error);
      // Don't throw - this is called frequently and shouldn't break the app
    }
  }, [sessionService, currentSession]);

  // Pause current session
  const pauseSession = useCallback(async (): Promise<void> => {
    try {
      await sessionService.pauseSession();
      
      // Update local state
      if (currentSession) {
        setCurrentSession({
          ...currentSession,
          status: 'paused',
          lastActivity: new Date(),
        });
      }
    } catch (error) {
      console.error('Error pausing session:', error);
      throw error;
    }
  }, [sessionService, currentSession]);

  // Resume a session
  const resumeSession = useCallback(async (sessionId: string): Promise<TranslationSession> => {
    try {
      setIsLoading(true);
      const session = await sessionService.resumeSession(sessionId);
      setCurrentSession(session);
      
      // Refresh recent sessions
      await loadRecentSessions();
      
      return session;
    } catch (error) {
      console.error('Error resuming session:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [sessionService, loadRecentSessions]);

  // End current session
  const endSession = useCallback(async (): Promise<void> => {
    try {
      await sessionService.endSession();
      setCurrentSession(null);
      
      // Refresh recent sessions
      await loadRecentSessions();
    } catch (error) {
      console.error('Error ending session:', error);
      throw error;
    }
  }, [sessionService, loadRecentSessions]);

  // Auto-update activity every 30 seconds when session is active
  useEffect(() => {
    if (!currentSession || currentSession.status !== 'active') {
      return;
    }

    const interval = setInterval(() => {
      updateActivity().catch(() => {
        // Silently handle errors for background activity updates
      });
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [currentSession, updateActivity]);

  // Load recent sessions when user authenticates
  useEffect(() => {
    if (isAuthenticated) {
      loadRecentSessions();
      
      // Clean up expired sessions
      sessionService.cleanupExpiredSessions().catch(error => {
        console.warn('Failed to cleanup expired sessions:', error);
      });
    } else {
      // Clear session data when user logs out
      setCurrentSession(null);
      setRecentSessions([]);
    }
  }, [isAuthenticated, loadRecentSessions, sessionService]);

  // Auto-end session on page unload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (currentSession && currentSession.status === 'active') {
        // Use navigator.sendBeacon for reliable cleanup on page unload
        sessionService.endSession().catch(() => {
          // Ignore errors during page unload
        });
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [currentSession, sessionService]);

  const value: SessionContextType = {
    currentSession,
    isLoading,
    recentSessions,
    createSession,
    updateSessionLanguages,
    updateActivity,
    pauseSession,
    resumeSession,
    endSession,
    loadRecentSessions,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}