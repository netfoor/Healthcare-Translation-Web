import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import { TranslationSession } from './types';
import type { Schema } from '../../amplify/data/resource';

// Generate Amplify Data client with proper typing
const client = generateClient<Schema>();

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
      const sessionId = this.generateSessionId();
      const now = new Date();

      const session: TranslationSession = {
        id: sessionId,
        userId: user.userId,
        inputLanguage,
        outputLanguage,
        status: 'active',
        createdAt: now,
        lastActivity: now,
      };

      // Store session in DynamoDB via Amplify Data
      await this.storeSessionInDynamoDB(session);

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
      
      // Update session in DynamoDB
      await this.updateSessionInDynamoDB(targetSessionId, {
        lastActivity: now,
      });

      // Update local session if it's the current one
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession.lastActivity = now;
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
      await this.updateSessionInDynamoDB(targetSessionId, {
        inputLanguage,
        outputLanguage,
        lastActivity: new Date(),
      });

      // Update local session if it's the current one
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession.inputLanguage = inputLanguage;
        this.currentSession.outputLanguage = outputLanguage;
        this.currentSession.lastActivity = new Date();
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
      await this.updateSessionInDynamoDB(targetSessionId, {
        status: 'ended',
        lastActivity: new Date(),
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
      await this.updateSessionInDynamoDB(targetSessionId, {
        status: 'paused',
        lastActivity: new Date(),
      });

      // Update local session if it's the current one
      if (this.currentSession && this.currentSession.id === targetSessionId) {
        this.currentSession.status = 'paused';
        this.currentSession.lastActivity = new Date();
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
      await this.updateSessionInDynamoDB(sessionId, {
        status: 'active',
        lastActivity: new Date(),
      });

      // Load session data if not current
      if (!this.currentSession || this.currentSession.id !== sessionId) {
        this.currentSession = await this.loadSessionFromDynamoDB(sessionId);
      }

      if (this.currentSession) {
        this.currentSession.status = 'active';
        this.currentSession.lastActivity = new Date();
      }

      return this.currentSession!;
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
      return await this.loadUserSessionsFromDynamoDB(user.userId, limit);
    } catch (error) {
      console.error('Error loading user sessions:', error);
      throw new Error('Failed to load user sessions');
    }
  }

  /**
   * Clean up expired sessions (called automatically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const user = await getCurrentUser();
      const expiredSessions = await this.getExpiredSessions(user.userId);
      
      for (const session of expiredSessions) {
        await this.deleteSessionFromDynamoDB(session.id);
      }
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
    }
  }

  // Private helper methods

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private async storeSessionInDynamoDB(session: TranslationSession): Promise<void> {
    try {
      // Use Amplify Data API to create session
      await client.models.TranslationSession.create({
        id: session.id,
        userId: session.userId,
        inputLanguage: session.inputLanguage,
        outputLanguage: session.outputLanguage,
        status: session.status,
        createdAt: session.createdAt.toISOString(),
        lastActivity: session.lastActivity.toISOString(),
      });
    } catch (error) {
      console.error('Failed to store session in DynamoDB:', error);
      // Fallback to localStorage for development
      this.storeInLocalStorage(`session_${session.id}`, {
        sessionData: {
          ...session,
          createdAt: session.createdAt.toISOString(),
          lastActivity: session.lastActivity.toISOString(),
        },
      });
    }
  }

  private async updateSessionInDynamoDB(
    sessionId: string,
    updates: Partial<TranslationSession>
  ): Promise<void> {
    try {
      // Prepare update data
      const updateData: Record<string, unknown> = {};
      
      if (updates.inputLanguage) updateData.inputLanguage = updates.inputLanguage;
      if (updates.outputLanguage) updateData.outputLanguage = updates.outputLanguage;
      if (updates.status) updateData.status = updates.status;
      if (updates.lastActivity) updateData.lastActivity = updates.lastActivity.toISOString();

      // Use Amplify Data API to update session
      await client.models.TranslationSession.update({
        id: sessionId,
        ...updateData,
      });
    } catch (error) {
      console.error('Failed to update session in DynamoDB:', error);
      // Fallback to localStorage for development
      const existingData = this.getFromLocalStorage(`session_${sessionId}`);
      if (existingData && existingData.sessionData && typeof existingData.sessionData === 'object') {
        const updatedData = {
          ...existingData,
          sessionData: {
            ...(existingData.sessionData as Record<string, unknown>),
            ...updates,
            lastActivity: updates.lastActivity?.toISOString() || (existingData.sessionData as Record<string, unknown>).lastActivity,
          },
        };
        this.storeInLocalStorage(`session_${sessionId}`, updatedData);
      }
    }
  }

  private async loadSessionFromDynamoDB(sessionId: string): Promise<TranslationSession> {
    try {
      // Use Amplify Data API to get session
      const { data: session } = await client.models.TranslationSession.get({ id: sessionId });
      
      if (!session) {
        throw new Error('Session not found');
      }

      return {
        id: session.id,
        userId: session.userId,
        inputLanguage: session.inputLanguage,
        outputLanguage: session.outputLanguage,
        status: session.status || 'active',
        createdAt: new Date(session.createdAt || Date.now()),
        lastActivity: new Date(session.lastActivity || Date.now()),
      };
    } catch (error) {
      console.error('Failed to load session from DynamoDB:', error);
      // Fallback to localStorage for development
      const sessionData = this.getFromLocalStorage(`session_${sessionId}`);
      if (!sessionData || !sessionData.sessionData) {
        throw new Error('Session not found');
      }

      const session = sessionData.sessionData as Record<string, unknown>;
      return {
        id: session.id as string,
        userId: session.userId as string,
        inputLanguage: session.inputLanguage as string,
        outputLanguage: session.outputLanguage as string,
        status: session.status as 'active' | 'paused' | 'ended',
        createdAt: new Date(session.createdAt as string),
        lastActivity: new Date(session.lastActivity as string),
      };
    }
  }

  private async loadUserSessionsFromDynamoDB(
    userId: string,
    limit: number
  ): Promise<TranslationSession[]> {
    try {
      // Use Amplify Data API to list user sessions
      const { data: sessions } = await client.models.TranslationSession.list({
        filter: { userId: { eq: userId } },
        limit,
      });

      return sessions
        .map(session => ({
          id: session.id,
          userId: session.userId,
          inputLanguage: session.inputLanguage,
          outputLanguage: session.outputLanguage,
          status: session.status || 'active',
          createdAt: new Date(session.createdAt || Date.now()),
          lastActivity: new Date(session.lastActivity || Date.now()),
        }))
        .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (error) {
      console.error('Failed to load user sessions from DynamoDB:', error);
      // Fallback to localStorage for development
      const sessions: TranslationSession[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('session_')) {
          const sessionData = this.getFromLocalStorage(key);
          if (sessionData && sessionData.sessionData && typeof sessionData.sessionData === 'object') {
            const session = sessionData.sessionData as Record<string, unknown>;
            if (session.userId === userId) {
              sessions.push({
                id: session.id as string,
                userId: session.userId as string,
                inputLanguage: session.inputLanguage as string,
                outputLanguage: session.outputLanguage as string,
                status: session.status as 'active' | 'paused' | 'ended',
                createdAt: new Date(session.createdAt as string),
                lastActivity: new Date(session.lastActivity as string),
              });
            }
          }
        }
      }

      return sessions
        .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
        .slice(0, limit);
    }
  }

  private async getExpiredSessions(userId: string): Promise<TranslationSession[]> {
    const allSessions = await this.loadUserSessionsFromDynamoDB(userId, 100);
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    return allSessions.filter(session => 
      session.lastActivity < twentyFourHoursAgo
    );
  }

  private async deleteSessionFromDynamoDB(sessionId: string): Promise<void> {
    try {
      // Use Amplify Data API to delete session
      await client.models.TranslationSession.delete({ id: sessionId });
    } catch (error) {
      console.error('Failed to delete session from DynamoDB:', error);
      // Fallback to localStorage for development
      localStorage.removeItem(`session_${sessionId}`);
    }
  }

  // Temporary localStorage methods for development
  private storeInLocalStorage(key: string, data: Record<string, unknown>): void {
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.warn('Failed to store in localStorage:', error);
    }
  }

  private getFromLocalStorage(key: string): Record<string, unknown> | null {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) as Record<string, unknown> : null;
    } catch (error) {
      console.warn('Failed to retrieve from localStorage:', error);
      return null;
    }
  }
}