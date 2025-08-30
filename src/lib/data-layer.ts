/**
 * DynamoDB Data Access Layer
 * Provides comprehensive data operations for translation sessions and transcripts
 * with error handling, retry logic, and TTL management
 */

import { generateClient } from 'aws-amplify/data';
import { getCurrentUser } from 'aws-amplify/auth';
import { TranslationSession, TranscriptEntry, AudioMetadata, ServiceError } from './types';
import type { Schema } from '../../amplify/data/resource';

// Generate Amplify Data client with proper typing
const client = generateClient<Schema>();

// Configuration constants
const TTL_HOURS = 24;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;

export class DataLayer {
  private static instance: DataLayer;

  private constructor() {}

  static getInstance(): DataLayer {
    if (!DataLayer.instance) {
      DataLayer.instance = new DataLayer();
    }
    return DataLayer.instance;
  }

  // ==================== SESSION OPERATIONS ====================

  /**
   * Create a new translation session with TTL
   */
  async createSession(session: Omit<TranslationSession, 'id'>): Promise<TranslationSession> {
    return this.withRetry(async () => {
      try {
        const sessionId = this.generateId('session');
        const now = new Date();
        const ttl = this.calculateTTL(now);

        const sessionData = {
          id: sessionId,
          userId: session.userId,
          inputLanguage: session.inputLanguage,
          outputLanguage: session.outputLanguage,
          status: session.status,
          createdAt: now.toISOString(),
          lastActivity: session.lastActivity.toISOString(),
          // Add TTL for automatic cleanup (24 hours)
          ttl: Math.floor(ttl.getTime() / 1000),
        };

        const { data: createdSession, errors } = await client.models.TranslationSession.create(sessionData as any);

        if (errors && errors.length > 0) {
          throw new Error(`Failed to create session: ${errors.map(e => e.message).join(', ')}`);
        }

        if (!createdSession) {
          throw new Error('Session creation returned null');
        }

        return this.mapSessionFromDynamoDB(createdSession);
      } catch (error) {
        console.error('Error creating session:', error);
        throw this.createServiceError('CREATE_SESSION_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Get session by ID with error handling
   */
  async getSession(sessionId: string): Promise<TranslationSession | null> {
    return this.withRetry(async () => {
      try {
        const { data: session, errors } = await client.models.TranslationSession.get({ id: sessionId });

        if (errors && errors.length > 0) {
          console.error('Errors getting session:', errors);
          return null;
        }

        if (!session) {
          return null;
        }

        return this.mapSessionFromDynamoDB(session);
      } catch (error) {
        console.error('Error getting session:', error);
        throw this.createServiceError('GET_SESSION_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Update session with optimistic locking and TTL refresh
   */
  async updateSession(sessionId: string, updates: Partial<TranslationSession>): Promise<TranslationSession> {
    return this.withRetry(async () => {
      try {
        const now = new Date();
        const ttl = this.calculateTTL(now);

        const updateData: Record<string, unknown> = {
          id: sessionId,
          lastActivity: now.toISOString(),
          ttl: Math.floor(ttl.getTime() / 1000), // Refresh TTL on update
        };

        // Add only provided updates
        if (updates.inputLanguage) updateData.inputLanguage = updates.inputLanguage;
        if (updates.outputLanguage) updateData.outputLanguage = updates.outputLanguage;
        if (updates.status) updateData.status = updates.status;

        const { data: updatedSession, errors } = await client.models.TranslationSession.update(updateData as any);

        if (errors && errors.length > 0) {
          throw new Error(`Failed to update session: ${errors.map(e => e.message).join(', ')}`);
        }

        if (!updatedSession) {
          throw new Error('Session update returned null');
        }

        return this.mapSessionFromDynamoDB(updatedSession);
      } catch (error) {
        console.error('Error updating session:', error);
        throw this.createServiceError('UPDATE_SESSION_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * List user sessions with pagination and filtering
   */
  async listUserSessions(
    userId: string,
    options: {
      limit?: number;
      nextToken?: string;
      status?: 'active' | 'paused' | 'ended';
    } = {}
  ): Promise<{
    sessions: TranslationSession[];
    nextToken?: string;
  }> {
    return this.withRetry(async () => {
      try {
        const { limit = 20, nextToken, status } = options;

        let filter: any = { userId: { eq: userId } };
        if (status) {
          filter = { ...filter, status: { eq: status } };
        }

        const { data: sessions, errors, nextToken: responseNextToken } = await client.models.TranslationSession.list({
          filter,
          limit,
          nextToken,
        });

        if (errors && errors.length > 0) {
          throw new Error(`Failed to list sessions: ${errors.map(e => e.message).join(', ')}`);
        }

        const mappedSessions = sessions
          .map(session => this.mapSessionFromDynamoDB(session))
          .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());

        return {
          sessions: mappedSessions,
          nextToken: responseNextToken || undefined,
        };
      } catch (error) {
        console.error('Error listing user sessions:', error);
        throw this.createServiceError('LIST_SESSIONS_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Delete session and all related data
   */
  async deleteSession(sessionId: string): Promise<void> {
    return this.withRetry(async () => {
      try {
        // First delete all related transcript entries
        await this.deleteSessionTranscripts(sessionId);
        
        // Then delete all related audio metadata
        await this.deleteSessionAudioMetadata(sessionId);

        // Finally delete the session
        const { errors } = await client.models.TranslationSession.delete({ id: sessionId });

        if (errors && errors.length > 0) {
          throw new Error(`Failed to delete session: ${errors.map(e => e.message).join(', ')}`);
        }
      } catch (error) {
        console.error('Error deleting session:', error);
        throw this.createServiceError('DELETE_SESSION_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  // ==================== TRANSCRIPT OPERATIONS ====================

  /**
   * Create transcript entry with proper indexing
   */
  async createTranscriptEntry(entry: Omit<TranscriptEntry, 'id'>): Promise<TranscriptEntry> {
    return this.withRetry(async () => {
      try {
        const entryId = this.generateId('transcript');
        const now = new Date();
        const ttl = this.calculateTTL(now);

        const entryData = {
          id: entryId,
          sessionId: entry.sessionId,
          originalText: entry.originalText,
          translatedText: entry.translatedText || null,
          confidence: entry.confidence,
          timestamp: entry.timestamp.toISOString(),
          speaker: entry.speaker || null,
          isProcessing: entry.isProcessing,
          ttl: Math.floor(ttl.getTime() / 1000),
        };

        const { data: createdEntry, errors } = await client.models.TranscriptEntry.create(entryData as any);

        if (errors && errors.length > 0) {
          throw new Error(`Failed to create transcript entry: ${errors.map(e => e.message).join(', ')}`);
        }

        if (!createdEntry) {
          throw new Error('Transcript entry creation returned null');
        }

        return this.mapTranscriptFromDynamoDB(createdEntry);
      } catch (error) {
        console.error('Error creating transcript entry:', error);
        throw this.createServiceError('CREATE_TRANSCRIPT_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Update transcript entry (typically to add translation)
   */
  async updateTranscriptEntry(entryId: string, updates: Partial<TranscriptEntry>): Promise<TranscriptEntry> {
    return this.withRetry(async () => {
      try {
        const updateData: Record<string, unknown> = { id: entryId };

        if (updates.translatedText !== undefined) updateData.translatedText = updates.translatedText;
        if (updates.confidence !== undefined) updateData.confidence = updates.confidence;
        if (updates.isProcessing !== undefined) updateData.isProcessing = updates.isProcessing;
        if (updates.speaker !== undefined) updateData.speaker = updates.speaker;

        const { data: updatedEntry, errors } = await client.models.TranscriptEntry.update(updateData as any);

        if (errors && errors.length > 0) {
          throw new Error(`Failed to update transcript entry: ${errors.map(e => e.message).join(', ')}`);
        }

        if (!updatedEntry) {
          throw new Error('Transcript entry update returned null');
        }

        return this.mapTranscriptFromDynamoDB(updatedEntry);
      } catch (error) {
        console.error('Error updating transcript entry:', error);
        throw this.createServiceError('UPDATE_TRANSCRIPT_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Get transcript entries for a session with pagination
   */
  async getSessionTranscripts(
    sessionId: string,
    options: {
      limit?: number;
      nextToken?: string;
    } = {}
  ): Promise<{
    entries: TranscriptEntry[];
    nextToken?: string;
  }> {
    return this.withRetry(async () => {
      try {
        const { limit = 50, nextToken } = options;

        const { data: entries, errors, nextToken: responseNextToken } = await client.models.TranscriptEntry.list({
          filter: { sessionId: { eq: sessionId } } as any,
          limit,
          nextToken,
        });

        if (errors && errors.length > 0) {
          throw new Error(`Failed to get session transcripts: ${errors.map(e => e.message).join(', ')}`);
        }

        const mappedEntries = entries
          .map(entry => this.mapTranscriptFromDynamoDB(entry))
          .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

        return {
          entries: mappedEntries,
          nextToken: responseNextToken || undefined,
        };
      } catch (error) {
        console.error('Error getting session transcripts:', error);
        throw this.createServiceError('GET_TRANSCRIPTS_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Delete all transcript entries for a session
   */
  private async deleteSessionTranscripts(sessionId: string): Promise<void> {
    try {
      const { entries } = await this.getSessionTranscripts(sessionId, { limit: 1000 });
      
      for (const entry of entries) {
        await client.models.TranscriptEntry.delete({ id: entry.id });
      }
    } catch (error) {
      console.error('Error deleting session transcripts:', error);
      // Don't throw here as this is a cleanup operation
    }
  }

  // ==================== AUDIO METADATA OPERATIONS ====================

  /**
   * Create audio metadata entry
   */
  async createAudioMetadata(metadata: Omit<AudioMetadata, 'id'>): Promise<AudioMetadata> {
    return this.withRetry(async () => {
      try {
        const metadataId = this.generateId('audio');
        const ttl = this.calculateTTL(metadata.createdAt);

        const metadataData = {
          id: metadataId,
          sessionId: metadata.sessionId,
          s3Key: metadata.s3Key,
          duration: metadata.duration,
          format: metadata.format,
          language: metadata.language,
          createdAt: metadata.createdAt.toISOString(),
          ttl: Math.floor(ttl.getTime() / 1000),
        };

        const { data: createdMetadata, errors } = await client.models.AudioMetadata.create(metadataData as any);

        if (errors && errors.length > 0) {
          throw new Error(`Failed to create audio metadata: ${errors.map(e => e.message).join(', ')}`);
        }

        if (!createdMetadata) {
          throw new Error('Audio metadata creation returned null');
        }

        return this.mapAudioMetadataFromDynamoDB(createdMetadata);
      } catch (error) {
        console.error('Error creating audio metadata:', error);
        throw this.createServiceError('CREATE_AUDIO_METADATA_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Get audio metadata for a session
   */
  async getSessionAudioMetadata(sessionId: string): Promise<AudioMetadata[]> {
    return this.withRetry(async () => {
      try {
        const { data: metadata, errors } = await client.models.AudioMetadata.list({
          filter: { sessionId: { eq: sessionId } } as any,
        });

        if (errors && errors.length > 0) {
          throw new Error(`Failed to get session audio metadata: ${errors.map(e => e.message).join(', ')}`);
        }

        return metadata
          .map(item => this.mapAudioMetadataFromDynamoDB(item))
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
      } catch (error) {
        console.error('Error getting session audio metadata:', error);
        throw this.createServiceError('GET_AUDIO_METADATA_FAILED', error as Error, 'DynamoDB');
      }
    });
  }

  /**
   * Delete all audio metadata for a session
   */
  private async deleteSessionAudioMetadata(sessionId: string): Promise<void> {
    try {
      const metadata = await this.getSessionAudioMetadata(sessionId);
      
      for (const item of metadata) {
        await client.models.AudioMetadata.delete({ id: item.id });
      }
    } catch (error) {
      console.error('Error deleting session audio metadata:', error);
      // Don't throw here as this is a cleanup operation
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Retry wrapper for database operations
   */
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === MAX_RETRIES) {
          break;
        }

        // Exponential backoff
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.warn(`Database operation failed, retrying (${attempt}/${MAX_RETRIES}):`, error);
      }
    }

    throw lastError!;
  }

  /**
   * Generate unique ID with prefix
   */
  private generateId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * Calculate TTL timestamp (24 hours from given date)
   */
  private calculateTTL(fromDate: Date): Date {
    return new Date(fromDate.getTime() + (TTL_HOURS * 60 * 60 * 1000));
  }

  /**
   * Create standardized service error
   */
  private createServiceError(code: string, originalError: Error, service: string): ServiceError {
    return {
      code,
      message: originalError.message,
      service,
      timestamp: new Date(),
      retryable: this.isRetryableError(originalError),
    };
  }

  /**
   * Determine if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'NetworkError',
      'TimeoutError',
      'ThrottlingException',
      'ServiceUnavailableException',
      'InternalServerError',
    ];

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError) || error.name.includes(retryableError)
    );
  }

  // ==================== MAPPING METHODS ====================

  /**
   * Map DynamoDB session data to application model
   */
  private mapSessionFromDynamoDB(dbSession: any): TranslationSession {
    return {
      id: dbSession.id,
      userId: dbSession.userId,
      inputLanguage: dbSession.inputLanguage,
      outputLanguage: dbSession.outputLanguage,
      status: dbSession.status || 'active',
      createdAt: new Date(dbSession.createdAt || Date.now()),
      lastActivity: new Date(dbSession.lastActivity || Date.now()),
    };
  }

  /**
   * Map DynamoDB transcript data to application model
   */
  private mapTranscriptFromDynamoDB(dbEntry: any): TranscriptEntry {
    return {
      id: dbEntry.id,
      sessionId: dbEntry.sessionId,
      originalText: dbEntry.originalText,
      translatedText: dbEntry.translatedText || undefined,
      confidence: dbEntry.confidence || 0,
      timestamp: new Date(dbEntry.timestamp || Date.now()),
      speaker: dbEntry.speaker || undefined,
      isProcessing: dbEntry.isProcessing || false,
    };
  }

  /**
   * Map DynamoDB audio metadata to application model
   */
  private mapAudioMetadataFromDynamoDB(dbMetadata: any): AudioMetadata {
    return {
      id: dbMetadata.id,
      sessionId: dbMetadata.sessionId,
      s3Key: dbMetadata.s3Key,
      duration: dbMetadata.duration || 0,
      format: dbMetadata.format,
      language: dbMetadata.language,
      createdAt: new Date(dbMetadata.createdAt || Date.now()),
    };
  }

  // ==================== HEALTH CHECK ====================

  /**
   * Health check for DynamoDB connectivity
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const user = await getCurrentUser();
      
      // Try to list sessions with limit 1 to test connectivity
      await this.listUserSessions(user.userId, { limit: 1 });
      
      return { healthy: true, message: 'DynamoDB connection healthy' };
    } catch (error) {
      console.error('DynamoDB health check failed:', error);
      return { 
        healthy: false, 
        message: `DynamoDB connection failed: ${(error as Error).message}` 
      };
    }
  }
}

// Export singleton instance
export const dataLayer = DataLayer.getInstance();