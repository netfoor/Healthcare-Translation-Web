import { getCurrentUser } from 'aws-amplify/auth';
import { TranslationSession } from './types';
import { dataLayer } from './data-layer';

export class SessionService {
  private static instance: SessionService;
  private currentSession: TranslationSession | null = null;

  private constructor() {}

  static getInstance(): SessionService {
    if (!SessionService.instance) {
      SessionService.instance = new SessionService();
    }
    return SessionService.instance;
  }

  /**
   * Create a new translation session
   */
  async createSession(
    inputLanguage: string,
    outputLanguage: string
  ): Promise<TranslationSession> {
    try {
      const user = await getCurrentUser();
      const now = new Date();

      const sessionData = {
        userId: user.userId,
        inputLanguage,
        outputLanguage,
        status: 'active' as const,
        createdAt: now,
        lastActivity: now,
      };

      // Use the new data layer for session creation
      const session = await dataLayer.createSession(sessionData);

      this.currentSession = session;
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw new Error('Failed to create translation session');
    }
  }

  /**
   * Get the current active session
   */
  getCurrentSession(): TranslationSession | null {
    return this.currentSession;
  }

  /**
   * Update session activity timestamp
   */
  async updateSessionActivity(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.currentSession?.id;
    if (!targetSessionId) {
      throw new Error('No active session to update');
    }

    try {
      const now = new Date();
      
      // Use data layer for session update
      const updatedSession = await dataLayer.updateSession(targetSessionId, {
        lastActivity: now,
      });

      // Update local session if it's the current one
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession = updatedSession;
      }
    } catch (error) {
      console.error('Error updating session activity:', error);
      throw new Error('Failed to update session activity');
    }
  }

  /**
   * Update session languages
   */
  async updateSessionLanguages(
    inputLanguage: string,
    outputLanguage: string,
    sessionId?: string
  ): Promise<void> {
    const targetSessionId = sessionId || this.currentSession?.id;
    if (!targetSessionId) {
      throw new Error('No active session to update');
    }

    try {
      const updatedSession = await dataLayer.updateSession(targetSessionId, {
        inputLanguage,
        outputLanguage,
      });

      // Update local session if it's the current one
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession = updatedSession;
      }
    } catch (error) {
      console.error('Error updating session languages:', error);
      throw new Error('Failed to update session languages');
    }
  }

  /**
   * End the current session
   */
  async endSession(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.currentSession?.id;
    if (!targetSessionId) {
      return; // No session to end
    }

    try {
      await dataLayer.updateSession(targetSessionId, {
        status: 'ended',
      });

      // Clear current session if it's the one being ended
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession = null;
      }
    } catch (error) {
      console.error('Error ending session:', error);
      throw new Error('Failed to end session');
    }
  }

  /**
   * Pause the current session
   */
  async pauseSession(sessionId?: string): Promise<void> {
    const targetSessionId = sessionId || this.currentSession?.id;
    if (!targetSessionId) {
      throw new Error('No active session to pause');
    }

    try {
      const updatedSession = await dataLayer.updateSession(targetSessionId, {
        status: 'paused',
      });

      // Update local session if it's the current one
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession = updatedSession;
      }
    } catch (error) {
      console.error('Error pausing session:', error);
      throw new Error('Failed to pause session');
    }
  }

  /**
   * Resume a paused session
   */
  async resumeSession(sessionId: string): Promise<TranslationSession> {
    try {
      const updatedSession = await dataLayer.updateSession(sessionId, {
        status: 'active',
      });

      // Set as current session
      this.currentSession = updatedSession;

      return updatedSession;
    } catch (error) {
      console.error('Error resuming session:', error);
      throw new Error('Failed to resume session');
    }
  }

  /**
   * Get user's recent sessions
   */
  async getUserSessions(limit: number = 10): Promise<TranslationSession[]> {
    try {
      const user = await getCurrentUser();
      const { sessions } = await dataLayer.listUserSessions(user.userId, { limit });
      return sessions;
    } catch (error) {
      console.error('Error loading user sessions:', error);
      throw new Error('Failed to load user sessions');
    }
  }

  /**
   * Clean up expired sessions (called automatically)
   * Note: TTL handles automatic cleanup, but this provides manual cleanup if needed
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const user = await getCurrentUser();
      const { sessions } = await dataLayer.listUserSessions(user.userId, { limit: 100 });
      
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const expiredSessions = sessions.filter(session => 
        session.lastActivity < twentyFourHoursAgo
      );
      
      for (const session of expiredSessions) {
        await dataLayer.deleteSession(session.id);
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  // Additional utility methods

  /**
   * Load a specific session by ID
   */
  async loadSession(sessionId: string): Promise<TranslationSession | null> {
    try {
      const session = await dataLayer.getSession(sessionId);
      if (session) {
        this.currentSession = session;
      }
      return session;
    } catch (error) {
      console.error('Error loading session:', error);
      throw new Error('Failed to load session');
    }
  }

  /**
   * Check data layer health
   */
  async checkHealth(): Promise<{ healthy: boolean; message: string }> {
    return await dataLayer.healthCheck();
  }
}