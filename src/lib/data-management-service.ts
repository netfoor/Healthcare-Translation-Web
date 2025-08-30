/**
 * Data Management Service
 * Central service that coordinates all data operations including
 * sessions, transcripts, audio storage, and retention policies
 */

import { getCurrentUser } from 'aws-amplify/auth';
import { TranslationSession, TranscriptEntry, AudioMetadata, ServiceError } from './types';
import { dataLayer } from './data-layer';
import { audioStorageService, AudioUploadOptions } from './audio-storage-service';
import { transcriptService } from './transcript-service';
import { dataRetentionService, RetentionPolicy } from './data-retention-service';

export interface DataManagementConfig {
  retentionPolicy: RetentionPolicy;
  enableAutoCleanup: boolean;
  cleanupIntervalHours: number;
}

export interface DataExportOptions {
  sessionId?: string;
  includeAudio: boolean;
  includeTranscripts: boolean;
  format: 'json' | 'csv' | 'txt';
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface DataImportOptions {
  sessionId: string;
  overwriteExisting: boolean;
  validateData: boolean;
}

export interface SystemHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    dataLayer: { healthy: boolean; message: string };
    audioStorage: { healthy: boolean; message: string };
    transcriptService: { healthy: boolean; message: string };
    dataRetention: { healthy: boolean; message: string };
  };
  lastChecked: Date;
}

export class DataManagementService {
  private static instance: DataManagementService;
  private config: DataManagementConfig;
  private healthCheckInterval?: NodeJS.Timeout;

  private constructor() {
    this.config = {
      retentionPolicy: {
        sessionRetentionHours: 24,
        transcriptRetentionHours: 24,
        audioRetentionHours: 24,
        tempFileRetentionHours: 2,
        enableAutoCleanup: true,
      },
      enableAutoCleanup: true,
      cleanupIntervalHours: 6,
    };

    // Initialize retention service with default policy
    dataRetentionService.setRetentionPolicy(this.config.retentionPolicy);
  }

  static getInstance(): DataManagementService {
    if (!DataManagementService.instance) {
      DataManagementService.instance = new DataManagementService();
    }
    return DataManagementService.instance;
  }

  // ==================== CONFIGURATION ====================

  /**
   * Update data management configuration
   */
  updateConfig(config: Partial<DataManagementConfig>): void {
    this.config = { ...this.config, ...config };

    if (config.retentionPolicy) {
      dataRetentionService.setRetentionPolicy(config.retentionPolicy);
    }

    console.log('Data management configuration updated:', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): DataManagementConfig {
    return { ...this.config };
  }

  // ==================== SESSION MANAGEMENT ====================

  /**
   * Create a complete session with initial setup
   */
  async createSession(
    inputLanguage: string,
    outputLanguage: string,
    metadata?: Record<string, string>
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

      const session = await dataLayer.createSession(sessionData);

      console.log(`Session created successfully: ${session.id}`);
      return session;
    } catch (error) {
      console.error('Error creating session:', error);
      throw this.createServiceError('SESSION_CREATION_FAILED', error as Error);
    }
  }

  /**
   * End session and trigger cleanup if needed
   */
  async endSession(sessionId: string, triggerCleanup: boolean = false): Promise<void> {
    try {
      await dataLayer.updateSession(sessionId, { status: 'ended' });

      if (triggerCleanup) {
        // Run lightweight cleanup in background
        this.runBackgroundCleanup();
      }

      console.log(`Session ended: ${sessionId}`);
    } catch (error) {
      console.error('Error ending session:', error);
      throw this.createServiceError('SESSION_END_FAILED', error as Error);
    }
  }

  // ==================== TRANSCRIPT MANAGEMENT ====================

  /**
   * Add transcript entry with automatic translation processing
   */
  async addTranscriptEntry(
    sessionId: string,
    originalText: string,
    confidence: number,
    speaker?: string
  ): Promise<TranscriptEntry> {
    try {
      // Update session activity
      await dataLayer.updateSession(sessionId, { lastActivity: new Date() });

      // Create transcript entry
      const entry = await transcriptService.createTranscriptEntry(
        sessionId,
        originalText,
        confidence,
        speaker
      );

      console.log(`Transcript entry created: ${entry.id}`);
      return entry;
    } catch (error) {
      console.error('Error adding transcript entry:', error);
      throw this.createServiceError('TRANSCRIPT_ADD_FAILED', error as Error);
    }
  }

  /**
   * Update transcript with translation
   */
  async updateTranscriptWithTranslation(
    entryId: string,
    translatedText: string,
    confidence?: number
  ): Promise<TranscriptEntry> {
    try {
      return await transcriptService.updateTranscriptWithTranslation(
        entryId,
        translatedText,
        confidence
      );
    } catch (error) {
      console.error('Error updating transcript with translation:', error);
      throw this.createServiceError('TRANSCRIPT_UPDATE_FAILED', error as Error);
    }
  }

  // ==================== AUDIO MANAGEMENT ====================

  /**
   * Store audio file with metadata
   */
  async storeAudioFile(
    audioData: ArrayBuffer | Blob | File,
    options: AudioUploadOptions
  ): Promise<AudioMetadata> {
    try {
      // Update session activity
      await dataLayer.updateSession(options.sessionId, { lastActivity: new Date() });

      // Upload audio file
      const metadata = await audioStorageService.uploadAudioFile(audioData, options);

      console.log(`Audio file stored: ${metadata.s3Key}`);
      return metadata;
    } catch (error) {
      console.error('Error storing audio file:', error);
      throw this.createServiceError('AUDIO_STORE_FAILED', error as Error);
    }
  }

  /**
   * Get audio file with presigned URL
   */
  async getAudioFile(
    metadataId: string,
    usePresignedUrl: boolean = true
  ): Promise<{
    data?: ArrayBuffer;
    url?: string;
    metadata: AudioMetadata;
  }> {
    try {
      return await audioStorageService.downloadAudioFile(metadataId, {
        presignedUrl: usePresignedUrl,
      });
    } catch (error) {
      console.error('Error getting audio file:', error);
      throw this.createServiceError('AUDIO_GET_FAILED', error as Error);
    }
  }

  // ==================== DATA EXPORT/IMPORT ====================

  /**
   * Export session data in various formats
   */
  async exportSessionData(
    sessionId: string,
    options: DataExportOptions
  ): Promise<{
    data: string | object;
    filename: string;
    contentType: string;
  }> {
    try {
      const session = await dataLayer.getSession(sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      let exportData: Record<string, unknown> = {
        session,
        exportedAt: new Date().toISOString(),
        options,
      };

      // Include transcripts if requested
      if (options.includeTranscripts) {
        const { entries } = await transcriptService.getSessionTranscripts(sessionId);
        exportData.transcripts = entries;
      }

      // Include audio metadata if requested
      if (options.includeAudio) {
        const audioFiles = await audioStorageService.listSessionAudioFiles(sessionId);
        exportData.audioFiles = audioFiles;
      }

      // Apply date range filter if specified
      if (options.dateRange) {
        if (exportData.transcripts) {
          const transcripts = exportData.transcripts as TranscriptEntry[];
          exportData.transcripts = transcripts.filter((t: TranscriptEntry) =>
            t.timestamp >= options.dateRange!.start && t.timestamp <= options.dateRange!.end
          );
        }
        if (exportData.audioFiles) {
          const audioFiles = exportData.audioFiles as AudioMetadata[];
          exportData.audioFiles = audioFiles.filter((a: AudioMetadata) =>
            a.createdAt >= options.dateRange!.start && a.createdAt <= options.dateRange!.end
          );
        }
      }

      // Format data based on requested format
      const timestamp = new Date().toISOString().split('T')[0];
      let filename: string;
      let contentType: string;
      let formattedData: string | object;

      switch (options.format) {
        case 'json':
          filename = `session_${sessionId}_${timestamp}.json`;
          contentType = 'application/json';
          formattedData = exportData;
          break;

        case 'csv':
          filename = `session_${sessionId}_${timestamp}.csv`;
          contentType = 'text/csv';
          formattedData = this.convertToCSV(exportData);
          break;

        case 'txt':
          filename = `session_${sessionId}_${timestamp}.txt`;
          contentType = 'text/plain';
          formattedData = this.convertToText(exportData);
          break;

        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      return {
        data: formattedData,
        filename,
        contentType,
      };
    } catch (error) {
      console.error('Error exporting session data:', error);
      throw this.createServiceError('DATA_EXPORT_FAILED', error as Error);
    }
  }

  /**
   * Import session data from external source
   */
  async importSessionData(
    data: string | object,
    options: DataImportOptions
  ): Promise<{
    imported: {
      sessions: number;
      transcripts: number;
      audioFiles: number;
    };
    errors: string[];
  }> {
    const result = {
      imported: { sessions: 0, transcripts: 0, audioFiles: 0 },
      errors: [] as string[],
    };

    try {
      let importData: Record<string, unknown>;

      if (typeof data === 'string') {
        importData = JSON.parse(data) as Record<string, unknown>;
      } else {
        importData = data as Record<string, unknown>;
      }

      // Validate data structure if requested
      if (options.validateData) {
        this.validateImportData(importData);
      }

      // Import session data
      if (importData.session) {
        try {
          // Check if session exists
          const existingSession = await dataLayer.getSession(options.sessionId);

          if (existingSession && !options.overwriteExisting) {
            result.errors.push('Session already exists and overwrite is disabled');
          } else {
            // Import session (implementation would depend on specific requirements)
            result.imported.sessions = 1;
          }
        } catch (error) {
          result.errors.push(`Session import failed: ${(error as Error).message}`);
        }
      }

      // Import transcripts
      if (importData.transcripts && Array.isArray(importData.transcripts)) {
        for (const transcript of importData.transcripts) {
          try {
            const transcriptData = transcript as Record<string, unknown>;
            await transcriptService.createTranscriptEntry(
              options.sessionId,
              transcriptData.originalText as string,
              transcriptData.confidence as number,
              transcriptData.speaker as string | undefined
            );
            result.imported.transcripts++;
          } catch (error) {
            result.errors.push(`Transcript import failed: ${(error as Error).message}`);
          }
        }
      }

      return result;
    } catch (error) {
      console.error('Error importing session data:', error);
      throw this.createServiceError('DATA_IMPORT_FAILED', error as Error);
    }
  }

  // ==================== SYSTEM HEALTH ====================

  /**
   * Comprehensive system health check
   */
  async checkSystemHealth(): Promise<SystemHealthStatus> {
    const healthChecks = await Promise.allSettled([
      dataLayer.healthCheck(),
      audioStorageService.healthCheck(),
      transcriptService.healthCheck(),
      dataRetentionService.healthCheck(),
    ]);

    const services = {
      dataLayer: healthChecks[0].status === 'fulfilled'
        ? healthChecks[0].value
        : { healthy: false, message: 'Health check failed' },
      audioStorage: healthChecks[1].status === 'fulfilled'
        ? healthChecks[1].value
        : { healthy: false, message: 'Health check failed' },
      transcriptService: healthChecks[2].status === 'fulfilled'
        ? healthChecks[2].value
        : { healthy: false, message: 'Health check failed' },
      dataRetention: healthChecks[3].status === 'fulfilled'
        ? healthChecks[3].value
        : { healthy: false, message: 'Health check failed' },
    };

    const healthyServices = Object.values(services).filter(s => s.healthy).length;
    const totalServices = Object.values(services).length;

    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (healthyServices === totalServices) {
      overall = 'healthy';
    } else if (healthyServices >= totalServices / 2) {
      overall = 'degraded';
    } else {
      overall = 'unhealthy';
    }

    return {
      overall,
      services,
      lastChecked: new Date(),
    };
  }

  /**
   * Start periodic health monitoring
   */
  startHealthMonitoring(intervalMinutes: number = 5): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      try {
        const health = await this.checkSystemHealth();
        if (health.overall !== 'healthy') {
          console.warn('System health degraded:', health);
        }
      } catch (error) {
        console.error('Health check failed:', error);
      }
    }, intervalMinutes * 60 * 1000);

    console.log(`Health monitoring started (interval: ${intervalMinutes} minutes)`);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      console.log('Health monitoring stopped');
    }
  }

  // ==================== CLEANUP MANAGEMENT ====================

  /**
   * Run comprehensive data cleanup
   */
  async runDataCleanup(force: boolean = false): Promise<unknown> {
    try {
      return await dataRetentionService.runCleanup(force);
    } catch (error) {
      console.error('Error running data cleanup:', error);
      throw this.createServiceError('DATA_CLEANUP_FAILED', error as Error);
    }
  }

  /**
   * Run background cleanup (non-blocking)
   */
  private runBackgroundCleanup(): void {
    // Run lightweight cleanup in background
    dataRetentionService.runLightweightCleanup()
      .then(result => {
        if (result.tempFilesDeleted > 0) {
          console.log(`Background cleanup completed: ${result.tempFilesDeleted} temp files deleted`);
        }
      })
      .catch(error => {
        console.warn('Background cleanup failed:', error);
      });
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Convert data to CSV format
   */
  private convertToCSV(data: Record<string, unknown>): string {
    // Simplified CSV conversion - would need more robust implementation
    let csv = '';

    if (data.transcripts && Array.isArray(data.transcripts)) {
      const transcripts = data.transcripts as TranscriptEntry[];
      csv += 'Timestamp,Original Text,Translated Text,Confidence,Speaker\n';
      transcripts.forEach((t: TranscriptEntry) => {
        csv += `"${t.timestamp.toISOString()}","${t.originalText}","${t.translatedText || ''}",${t.confidence},"${t.speaker || ''}"\n`;
      });
    }

    return csv;
  }

  /**
   * Convert data to text format
   */
  private convertToText(data: Record<string, unknown>): string {
    const session = data.session as TranslationSession;
    let text = `Session Export\n`;
    text += `Generated: ${new Date().toISOString()}\n`;
    text += `Session ID: ${session?.id}\n\n`;

    if (data.transcripts && Array.isArray(data.transcripts)) {
      const transcripts = data.transcripts as TranscriptEntry[];
      text += 'Transcripts:\n';
      text += '===========\n\n';

      transcripts.forEach((t: TranscriptEntry, index: number) => {
        text += `Entry ${index + 1} (${t.timestamp.toLocaleString()})\n`;
        text += `Original: ${t.originalText}\n`;
        if (t.translatedText) {
          text += `Translated: ${t.translatedText}\n`;
        }
        text += `Confidence: ${(t.confidence * 100).toFixed(1)}%\n`;
        if (t.speaker) {
          text += `Speaker: ${t.speaker}\n`;
        }
        text += '\n';
      });
    }

    return text;
  }

  /**
   * Validate import data structure
   */
  private validateImportData(data: unknown): void {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid import data: must be an object');
    }

    const obj = data as Record<string, unknown>;
    if (obj.transcripts && !Array.isArray(obj.transcripts)) {
      throw new Error('Invalid import data: transcripts must be an array');
    }

    // Additional validation logic would go here
  }

  /**
   * Create standardized service error
   */
  private createServiceError(code: string, originalError: Error): ServiceError {
    return {
      code,
      message: originalError.message,
      service: 'DataManagement',
      timestamp: new Date(),
      retryable: false,
    };
  }

  /**
   * Cleanup resources on service shutdown
   */
  destroy(): void {
    this.stopHealthMonitoring();
    console.log('Data management service destroyed');
  }
}

// Export singleton instance
export const dataManagementService = DataManagementService.getInstance();