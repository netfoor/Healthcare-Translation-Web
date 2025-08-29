import { useCallback } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Custom hook for session management operations
 * Provides convenient methods for managing translation sessions
 */
export function useSessionManagement() {
  const { isAuthenticated } = useAuth();
  const {
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
  } = useSession();

  // Check if user can create a new session
  const canCreateSession = useCallback(() => {
    return isAuthenticated && !currentSession;
  }, [isAuthenticated, currentSession]);

  // Check if there's an active session
  const hasActiveSession = useCallback(() => {
    return currentSession && currentSession.status === 'active';
  }, [currentSession]);

  // Check if current session is paused
  const isSessionPaused = useCallback(() => {
    return currentSession && currentSession.status === 'paused';
  }, [currentSession]);

  // Get session duration in minutes
  const getSessionDuration = useCallback(() => {
    if (!currentSession) return 0;
    
    const now = new Date();
    const start = currentSession.createdAt;
    return Math.floor((now.getTime() - start.getTime()) / (1000 * 60));
  }, [currentSession]);

  // Get time since last activity in minutes
  const getTimeSinceLastActivity = useCallback(() => {
    if (!currentSession) return 0;
    
    const now = new Date();
    const lastActivity = currentSession.lastActivity;
    return Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60));
  }, [currentSession]);

  // Auto-update activity (throttled)
  const trackActivity = useCallback(() => {
    if (hasActiveSession()) {
      updateActivity().catch(error => {
        console.warn('Failed to track activity:', error);
      });
    }
  }, [hasActiveSession, updateActivity]);

  // Create session with validation
  const createSessionSafely = useCallback(async (
    inputLanguage: string,
    outputLanguage: string
  ) => {
    if (!canCreateSession()) {
      throw new Error('Cannot create session: user not authenticated or session already exists');
    }

    if (inputLanguage === outputLanguage) {
      throw new Error('Input and output languages must be different');
    }

    return await createSession(inputLanguage, outputLanguage);
  }, [canCreateSession, createSession]);

  // Update languages with validation
  const updateLanguagesSafely = useCallback(async (
    inputLanguage: string,
    outputLanguage: string
  ) => {
    if (!currentSession) {
      throw new Error('No active session to update');
    }

    if (inputLanguage === outputLanguage) {
      throw new Error('Input and output languages must be different');
    }

    return await updateSessionLanguages(inputLanguage, outputLanguage);
  }, [currentSession, updateSessionLanguages]);

  // Get available recent sessions for resuming
  const getResumableSessions = useCallback(() => {
    return recentSessions.filter(session => 
      session.status === 'paused' && 
      (!currentSession || session.id !== currentSession.id)
    );
  }, [recentSessions, currentSession]);

  // Check if session is about to expire (within 1 hour of 24-hour limit)
  const isSessionNearExpiry = useCallback(() => {
    if (!currentSession) return false;
    
    const hoursActive = getSessionDuration() / 60;
    return hoursActive > 23; // Within 1 hour of 24-hour limit
  }, [currentSession, getSessionDuration]);

  return {
    // Session state
    currentSession,
    isLoading,
    recentSessions,
    
    // Session status checks
    canCreateSession: canCreateSession(),
    hasActiveSession: hasActiveSession(),
    isSessionPaused: isSessionPaused(),
    isNearExpiry: isSessionNearExpiry(),
    
    // Session metrics
    sessionDuration: getSessionDuration(),
    timeSinceLastActivity: getTimeSinceLastActivity(),
    resumableSessions: getResumableSessions(),
    
    // Session operations
    createSession: createSessionSafely,
    updateLanguages: updateLanguagesSafely,
    pauseSession,
    resumeSession,
    endSession,
    trackActivity,
    loadRecentSessions,
  };
}