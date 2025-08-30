/**
 * Data Retention and Cleanup Service
 * Manages data lifecycle, retention policies, and automated cleanup
 * Ensures HIPAA compliance with proper data retention and deletion
 */

import { getCurrentUser } from 'aws-amplify/auth';
import { dataLayer } from './data-layer';
import { audioStorageService } from './audio-storage-service';
import { ServiceError } from './types';

// Retention policy constants (configurable)
const DEFAULT_RETENTION_HOURS = 24;
const TEMP_FILE_RETENTION_HOURS = 2;
const CLEANUP_BATCH_SIZE = 50;
const MAX_CLEANUP_RETRIES = 3;

export interface RetentionPolicy {
  sessionRetentionHours: number;
  transcriptRetentionHours: number;
  audioRetentionHours: number;
  tempFileRetentionHours: number;
  enableAutoCleanup: boolean;
}

export interface CleanupResult {
  sessionsDeleted: number;
  transcriptsDeleted: number;
  audioFilesDeleted: number;
  tempFilesDeleted: number;
  errors: string[];
  totalProcessed: number;
  duration: number;
}

export interface RetentionStats {
  totalSessions: number;
  expiredSessions: number;
  totalTranscripts: number;
  totalAudioFiles: number;
  totalStorageSize: number;
  oldestSession?: Date;
  newestSession?: Date;
}

export class DataRetentionService {
  private static instance: DataRetentionService;
  private retentionPolicy: RetentionPolicy;
  private isCleanupRunning: boolean = false;

  private constructor() {
    this.retentionPolicy = {
      sessionRetentionHours: DEFAULT_RETENTION_HOURS,
      transcriptRetentionHours: DEFAULT_RETENTION_HOURS,
      audioRetentionHours: DEFAULT_RETENTION_HOURS,
      tempFileRetentionHours: TEMP_FILE_RETENTION_HOURS,
      enableAutoCleanup: true,
    };
  }

  static getInstance(): DataRetentionService {
    if (!DataRetentionService.instance) {
      DataRetentionService.instance = new DataRetentionService();
    }
    return DataRetentionService.instance;
  }

  // ==================== POLICY MANAGEMENT ====================

  /**
   * Update retention policy
   */
  setRetentionPolicy(policy: Partial<RetentionPolicy>): void {
    this.retentionPolicy = { ...this.retentionPolicy, ...policy };
    console.log('Retention policy updated:', this.retentionPolicy);
  }

  /**
   * Get current retention policy
   */
  getRetentionPolicy(): RetentionPolicy {
    return { ...this.retentionPolicy };
  }

  // ==================== CLEANUP OPERATIONS ====================

  /**
   * Run comprehensive data cleanup based on retention policy
   */
  async runCleanup(force: boolean = false): Promise<CleanupResult> {
    if (this.isCleanupRunning && !force) {
      throw new Error('Cleanup is already running');
    }

    this.isCleanupRunning = true;
    const startTime = Date.now();

    const result: CleanupResult = {
      sessionsDeleted: 0,
      transcriptsDeleted: 0,
      audioFilesDeleted: 0,
      tempFilesDeleted: 0,
      errors: [],
      totalProcessed: 0,
      duration: 0,
    };

    try {
      console.log('Starting data cleanup with policy:', this.retentionPolicy);

      // 1. Clean up temporary files first
      if (this.retentionPolicy.tempFileRetentionHours > 0) {
        try {
          result.tempFilesDeleted = await audioStorageService.cleanupTemporaryFiles(
            this.retentionPolicy.tempFileRetentionHours
          );
        } catch (error) {
          result.errors.push(`Temp file cleanup failed: ${(error as Error).message}`);
        }
      }

      // 2. Clean up expired sessions and related data
      if (this.retentionPolicy.sessionRetentionHours > 0) {
        try {
          const sessionCleanupResult = await this.cleanupExpiredSessions();
          result.sessionsDeleted = sessionCleanupResult.sessionsDeleted;
          result.transcriptsDeleted = sessionCleanupResult.transcriptsDeleted;
          result.audioFilesDeleted = sessionCleanupResult.audioFilesDeleted;
          result.errors.push(...sessionCleanupResult.errors);
        } catch (error) {
          result.errors.push(`Session cleanup failed: ${(error as Error).message}`);
        }
      }

      result.totalProcessed = result.sessionsDeleted + result.tempFilesDeleted;
      result.duration = Date.now() - startTime;

      console.log('Data cleanup completed:', result);
      return result;
    } catch (error) {
      result.errors.push(`Cleanup failed: ${(error as Error).message}`);
      result.duration = Date.now() - startTime;
      throw error;
    } finally {
      this.isCleanupRunning = false;
    }
  }

  /**
   * Clean up expired sessions and all related data
   */
  private async cleanupExpiredSessions(): Promise<{
    sessionsDeleted: number;
    transcriptsDeleted: number;
    audioFilesDeleted: number;
    errors: string[];
  }> {
    const result = {
      sessionsDeleted: 0,
      transcriptsDeleted: 0,
      audioFilesDeleted: 0,
      errors: [],
    };

    try {
      const user = await getCurrentUser();
      const cutoffTime = new Date(
        Date.now() - (this.retentionPolicy.sessionRetentionHours * 60 * 60 * 1000)
      );

      // Get all user sessions
      const { sessions } = await dataLayer.listUserSessions(user.userId, { limit: 1000 });
      
      // Filter expired sessions
      const expiredSessions = sessions.filter(session => 
        session.lastActivity < cutoffTime
      );

      console.log(`Found ${expiredSessions.length} expired sessions to clean up`);

      // Process sessions in batches
      for (let i = 0; i < expiredSessions.length; i += CLEANUP_BATCH_SIZE) {
        const batch = expiredSessions.slice(i, i + CLEANUP_BATCH_SIZE);
        
        for (const session of batch) {
          try {
            // Get session statistics before deletion
            const transcripts = await dataLayer.getSessionTranscripts(session.id, { limit: 1000 });
            const audioFiles = await dataLayer.getSessionAudioMetadata(session.id);

            // Delete session (cascades to transcripts and audio metadata)
            await dataLayer.deleteSession(session.id);

            // Delete associated audio files from S3
            for (const audioFile of audioFiles) {
              try {
                await audioStorageService.deleteAudioByKey(audioFile.s3Key);
              } catch (error) {
                result.errors.push(`Failed to delete audio file ${audioFile.s3Key}: ${(error as Error).message}`);
              }
            }

            result.sessionsDeleted++;
            result.transcriptsDeleted += transcripts.entries.length;
            result.audioFilesDeleted += audioFiles.length;

          } catch (error) {
            result.errors.push(`Failed to delete session ${session.id}: ${(error as Error).message}`);
          }
        }

        // Small delay between batches to avoid overwhelming the services
        if (i + CLEANUP_BATCH_SIZE < expiredSessions.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      return result;
    } catch (error) {
      result.errors.push(`Session cleanup failed: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Clean up orphaned data (data without valid sessions)
   */
  async cleanupOrphanedData(): Promise<{
    orphanedTranscripts: number;
    orphanedAudioFiles: number;
    errors: string[];
  }> {
    const result = {
      orphanedTranscripts: 0,
      orphanedAudioFiles: 0,
      errors: [],
    };

    try {
      const user = await getCurrentUser();
      
      // Get all user sessions to build a valid session ID set
      const { sessions } = await dataLayer.listUserSessions(user.userId, { limit: 1000 });
      const validSessionIds = new Set(sessions.map(s => s.id));

      // This would require additional queries to find orphaned data
      // For now, we'll log the requirement
      console.log('Orphaned data cleanup - would check against valid session IDs:', validSessionIds.size);

      return result;
    } catch (error) {
      result.errors.push(`Orphaned data cleanup failed: ${(error as Error).message}`);
      return result;
    }
  }

  // ==================== RETENTION ANALYSIS ====================

  /**
   * Get retention statistics for the current user
   */
  async getRetentionStats(): Promise<RetentionStats> {
    try {
      const user = await getCurrentUser();
      const { sessions } = await dataLayer.listUserSessions(user.userId, { limit: 1000 });

      const cutoffTime = new Date(
        Date.now() - (this.retentionPolicy.sessionRetentionHours * 60 * 60 * 1000)
      );

      const expiredSessions = sessions.filter(session => 
        session.lastActivity < cutoffTime
      );

      // Get storage statistics
      const storageStats = await audioStorageService.getStorageStats();

      // Calculate transcript count (would need to aggregate across sessions)
      let totalTranscripts = 0;
      for (const session of sessions.slice(0, 10)) { // Sample first 10 sessions
        try {
          const { entries } = await dataLayer.getSessionTranscripts(session.id, { limit: 1000 });
          totalTranscripts += entries.length;
        } catch (error) {
          console.warn(`Failed to get transcripts for session ${session.id}:`, error);
        }
      }

      const stats: RetentionStats = {
        totalSessions: sessions.length,
        expiredSessions: expiredSessions.length,
        totalTranscripts,
        totalAudioFiles: storageStats.totalFiles,
        totalStorageSize: storageStats.totalSize,
        oldestSession: sessions.length > 0 ? 
          sessions.reduce((oldest, session) => 
            session.createdAt < oldest.createdAt ? session : oldest
          ).createdAt : undefined,
        newestSession: sessions.length > 0 ? 
          sessions.reduce((newest, session) => 
            session.createdAt > newest.createdAt ? session : newest
          ).createdAt : undefined,
      };

      return stats;
    } catch (error) {
      console.error('Error getting retention stats:', error);
      throw this.createServiceError('RETENTION_STATS_FAILED', error as Error);
    }
  }

  /**
   * Estimate cleanup impact before running
   */
  async estimateCleanupImpact(): Promise<{
    sessionsToDelete: number;
    transcriptsToDelete: number;
    audioFilesToDelete: number;
    storageToFree: number;
    estimatedDuration: number;
  }> {
    try {
      const user = await getCurrentUser();
      const cutoffTime = new Date(
        Date.now() - (this.retentionPolicy.sessionRetentionHours * 60 * 60 * 1000)
      );

      const { sessions } = await dataLayer.listUserSessions(user.userId, { limit: 1000 });
      const expiredSessions = sessions.filter(session => 
        session.lastActivity < cutoffTime
      );

      let transcriptsToDelete = 0;
      let audioFilesToDelete = 0;
      let storageToFree = 0;

      // Sample a few sessions to estimate
      const sampleSize = Math.min(5, expiredSessions.length);
      for (let i = 0; i < sampleSize; i++) {
        const session = expiredSessions[i];
        try {
          const { entries } = await dataLayer.getSessionTranscripts(session.id, { limit: 1000 });
          const audioFiles = await dataLayer.getSessionAudioMetadata(session.id);
          
          transcriptsToDelete += entries.length;
          audioFilesToDelete += audioFiles.length;
          
          // Estimate storage (would need actual file sizes)
          storageToFree += audioFiles.length * 1024 * 1024; // Rough estimate: 1MB per file
        } catch (error) {
          console.warn(`Failed to estimate cleanup for session ${session.id}:`, error);
        }
      }

      // Scale up estimates based on sample
      if (sampleSize > 0) {
        const scaleFactor = expiredSessions.length / sampleSize;
        transcriptsToDelete = Math.round(transcriptsToDelete * scaleFactor);
        audioFilesToDelete = Math.round(audioFilesToDelete * scaleFactor);
        storageToFree = Math.round(storageToFree * scaleFactor);
      }

      // Estimate duration (rough calculation)
      const estimatedDuration = Math.max(
        expiredSessions.length * 100, // 100ms per session
        5000 // Minimum 5 seconds
      );

      return {
        sessionsToDelete: expiredSessions.length,
        transcriptsToDelete,
        audioFilesToDelete,
        storageToFree,
        estimatedDuration,
      };
    } catch (error) {
      console.error('Error estimating cleanup impact:', error);
      throw this.createServiceError('CLEANUP_ESTIMATION_FAILED', error as Error);
    }
  }

  // ==================== SCHEDULED CLEANUP ====================

  /**
   * Set up automatic cleanup schedule (would integrate with a scheduler)
   */
  setupAutomaticCleanup(intervalHours: number = 6): void {
    if (!this.retentionPolicy.enableAutoCleanup) {
      console.log('Automatic cleanup is disabled');
      return;
    }

    console.log(`Automatic cleanup scheduled every ${intervalHours} hours`);
    
    // In a real implementation, this would integrate with:
    // - AWS EventBridge for scheduled Lambda execution
    // - Browser-based intervals for client-side cleanup
    // - Background service workers
    
    // For now, we'll just log the setup
    console.log('Note: Automatic cleanup requires integration with a scheduling service');
  }

  /**
   * Run lightweight cleanup (for frequent execution)
   */
  async runLightweightCleanup(): Promise<CleanupResult> {
    const startTime = Date.now();

    const result: CleanupResult = {
      sessionsDeleted: 0,
      transcriptsDeleted: 0,
      audioFilesDeleted: 0,
      tempFilesDeleted: 0,
      errors: [],
      totalProcessed: 0,
      duration: 0,
    };

    try {
      // Only clean up temporary files in lightweight mode
      result.tempFilesDeleted = await audioStorageService.cleanupTemporaryFiles(
        this.retentionPolicy.tempFileRetentionHours
      );

      result.totalProcessed = result.tempFilesDeleted;
      result.duration = Date.now() - startTime;

      return result;
    } catch (error) {
      result.errors.push(`Lightweight cleanup failed: ${(error as Error).message}`);
      result.duration = Date.now() - startTime;
      return result;
    }
  }

  // ==================== COMPLIANCE REPORTING ====================

  /**
   * Generate compliance report for data retention
   */
  async generateComplianceReport(): Promise<{
    reportDate: Date;
    retentionPolicy: RetentionPolicy;
    stats: RetentionStats;
    lastCleanup?: Date;
    complianceStatus: 'compliant' | 'warning' | 'non-compliant';
    recommendations: string[];
  }> {
    try {
      const stats = await this.getRetentionStats();
      
      const recommendations: string[] = [];
      let complianceStatus: 'compliant' | 'warning' | 'non-compliant' = 'compliant';

      // Check for compliance issues
      if (stats.expiredSessions > 0) {
        complianceStatus = 'warning';
        recommendations.push(`${stats.expiredSessions} sessions exceed retention policy and should be cleaned up`);
      }

      if (stats.totalStorageSize > 100 * 1024 * 1024 * 1024) { // 100GB
        complianceStatus = 'warning';
        recommendations.push('Storage usage is high, consider running cleanup or adjusting retention policy');
      }

      if (!this.retentionPolicy.enableAutoCleanup) {
        recommendations.push('Consider enabling automatic cleanup for better compliance');
      }

      return {
        reportDate: new Date(),
        retentionPolicy: this.getRetentionPolicy(),
        stats,
        complianceStatus,
        recommendations,
      };
    } catch (error) {
      console.error('Error generating compliance report:', error);
      throw this.createServiceError('COMPLIANCE_REPORT_FAILED', error as Error);
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Create standardized service error
   */
  private createServiceError(code: string, originalError: Error): ServiceError {
    return {
      code,
      message: originalError.message,
      service: 'DataRetention',
      timestamp: new Date(),
      retryable: false, // Retention operations are typically not retryable
    };
  }

  /**
   * Health check for data retention service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Check if cleanup is stuck
      if (this.isCleanupRunning) {
        return {
          healthy: false,
          message: 'Data retention service is currently running cleanup',
        };
      }

      // Check dependencies
      const dataLayerHealth = await dataLayer.healthCheck();
      const storageHealth = await audioStorageService.healthCheck();

      if (!dataLayerHealth.healthy || !storageHealth.healthy) {
        return {
          healthy: false,
          message: 'Data retention service dependencies are unhealthy',
        };
      }

      return { healthy: true, message: 'Data retention service healthy' };
    } catch (error) {
      return {
        healthy: false,
        message: `Data retention service error: ${(error as Error).message}`,
      };
    }
  }
}

// Export singleton instance
export const dataRetentionService = DataRetentionService.getInstance();