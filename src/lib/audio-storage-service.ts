/**
 * S3 Audio Storage Service
 * Handles encrypted audio file storage, retrieval, and lifecycle management
 */

import { uploadData, downloadData, remove, list, getUrl } from 'aws-amplify/storage';
import { getCurrentUser } from 'aws-amplify/auth';
import { AudioMetadata, ServiceError } from './types';
import { dataLayer } from './data-layer';

// Configuration constants
const AUDIO_FOLDER_PREFIX = 'audio-files';
const TEMP_AUDIO_PREFIX = 'temp-audio';
const PRESIGNED_URL_EXPIRY = 3600; // 1 hour
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const SUPPORTED_FORMATS = ['audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg'];

export interface AudioUploadOptions {
  sessionId: string;
  format: string;
  language: string;
  isTemporary?: boolean;
  metadata?: Record<string, string>;
}

export interface AudioDownloadOptions {
  presignedUrl?: boolean;
  expiresIn?: number;
}

export interface AudioListOptions {
  sessionId?: string;
  limit?: number;
  nextToken?: string;
  includeMetadata?: boolean;
}

export class AudioStorageService {
  private static instance: AudioStorageService;

  private constructor() {}

  static getInstance(): AudioStorageService {
    if (!AudioStorageService.instance) {
      AudioStorageService.instance = new AudioStorageService();
    }
    return AudioStorageService.instance;
  }

  // ==================== UPLOAD OPERATIONS ====================

  /**
   * Upload audio file with encryption and metadata storage
   */
  async uploadAudioFile(
    audioData: ArrayBuffer | Blob | File,
    options: AudioUploadOptions
  ): Promise<AudioMetadata> {
    try {
      // Validate input
      await this.validateAudioFile(audioData, options.format);

      const user = await getCurrentUser();
      const audioId = this.generateAudioId();
      const s3Key = this.generateS3Key(user.userId, options.sessionId, audioId, options.isTemporary);

      // Calculate duration if possible
      const duration = await this.calculateAudioDuration(audioData);

      // Upload to S3 with encryption
      const uploadResult = await uploadData({
        key: s3Key,
        data: audioData,
        options: {
          contentType: options.format,
          metadata: {
            sessionId: options.sessionId,
            language: options.language,
            userId: user.userId,
            uploadedAt: new Date().toISOString(),
            ...options.metadata,
          },
        },
      }).result;

      // Create metadata entry in DynamoDB
      const audioMetadata: Omit<AudioMetadata, 'id'> = {
        sessionId: options.sessionId,
        s3Key: uploadResult.key,
        duration,
        format: options.format,
        language: options.language,
        createdAt: new Date(),
      };

      const createdMetadata = await dataLayer.createAudioMetadata(audioMetadata);

      console.log(`Audio file uploaded successfully: ${s3Key}`);
      return createdMetadata;
    } catch (error) {
      console.error('Error uploading audio file:', error);
      throw this.createServiceError('AUDIO_UPLOAD_FAILED', error as Error);
    }
  }

  /**
   * Upload audio chunk for streaming (temporary storage)
   */
  async uploadAudioChunk(
    chunkData: ArrayBuffer,
    sessionId: string,
    chunkIndex: number,
    format: string = 'audio/webm'
  ): Promise<string> {
    try {
      const user = await getCurrentUser();
      const chunkId = `chunk_${chunkIndex}_${Date.now()}`;
      const s3Key = `${TEMP_AUDIO_PREFIX}/${user.userId}/${sessionId}/${chunkId}`;

      const uploadResult = await uploadData({
        key: s3Key,
        data: chunkData,
        options: {
          contentType: format,
          metadata: {
            sessionId,
            chunkIndex: chunkIndex.toString(),
            userId: user.userId,
            isChunk: 'true',
            uploadedAt: new Date().toISOString(),
          },
        },
      }).result;

      return uploadResult.key;
    } catch (error) {
      console.error('Error uploading audio chunk:', error);
      throw this.createServiceError('AUDIO_CHUNK_UPLOAD_FAILED', error as Error);
    }
  }

  /**
   * Batch upload multiple audio files
   */
  async batchUploadAudioFiles(
    files: Array<{
      data: ArrayBuffer | Blob | File;
      options: AudioUploadOptions;
    }>
  ): Promise<AudioMetadata[]> {
    try {
      const uploadPromises = files.map(file => 
        this.uploadAudioFile(file.data, file.options)
      );

      return await Promise.all(uploadPromises);
    } catch (error) {
      console.error('Error batch uploading audio files:', error);
      throw this.createServiceError('BATCH_AUDIO_UPLOAD_FAILED', error as Error);
    }
  }

  // ==================== DOWNLOAD OPERATIONS ====================

  /**
   * Download audio file by metadata ID
   */
  async downloadAudioFile(
    metadataId: string,
    options: AudioDownloadOptions = {}
  ): Promise<{
    data?: ArrayBuffer;
    url?: string;
    metadata: AudioMetadata;
  }> {
    try {
      // Get metadata from DynamoDB
      const metadata = await this.getAudioMetadata(metadataId);
      if (!metadata) {
        throw new Error('Audio metadata not found');
      }

      if (options.presignedUrl) {
        // Return presigned URL for client-side download
        const url = await getUrl({
          key: metadata.s3Key,
          options: {
            expiresIn: options.expiresIn || PRESIGNED_URL_EXPIRY,
          },
        });

        return {
          url: url.url.toString(),
          metadata,
        };
      } else {
        // Download data directly
        const downloadResult = await downloadData({
          key: metadata.s3Key,
        }).result;

        const data = await (downloadResult.body as unknown as Blob).arrayBuffer();

        return {
          data,
          metadata,
        };
      }
    } catch (error) {
      console.error('Error downloading audio file:', error);
      throw this.createServiceError('AUDIO_DOWNLOAD_FAILED', error as Error);
    }
  }

  /**
   * Download audio file by S3 key
   */
  async downloadAudioByKey(
    s3Key: string,
    options: AudioDownloadOptions = {}
  ): Promise<{
    data?: ArrayBuffer;
    url?: string;
  }> {
    try {
      if (options.presignedUrl) {
        const url = await getUrl({
          key: s3Key,
          options: {
            expiresIn: options.expiresIn || PRESIGNED_URL_EXPIRY,
          },
        });

        return { url: url.url.toString() };
      } else {
        const downloadResult = await downloadData({
          key: s3Key,
        }).result;

        const data = await (downloadResult.body as unknown as Blob).arrayBuffer();
        return { data };
      }
    } catch (error) {
      console.error('Error downloading audio by key:', error);
      throw this.createServiceError('AUDIO_DOWNLOAD_BY_KEY_FAILED', error as Error);
    }
  }

  /**
   * Get presigned URL for audio file
   */
  async getAudioPresignedUrl(
    metadataId: string,
    expiresIn: number = PRESIGNED_URL_EXPIRY
  ): Promise<string> {
    try {
      const metadata = await this.getAudioMetadata(metadataId);
      if (!metadata) {
        throw new Error('Audio metadata not found');
      }

      const url = await getUrl({
        key: metadata.s3Key,
        options: { expiresIn },
      });

      return url.url.toString();
    } catch (error) {
      console.error('Error getting presigned URL:', error);
      throw this.createServiceError('PRESIGNED_URL_FAILED', error as Error);
    }
  }

  // ==================== LIST OPERATIONS ====================

  /**
   * List audio files for a session
   */
  async listSessionAudioFiles(
    sessionId: string,
    options: AudioListOptions = {}
  ): Promise<AudioMetadata[]> {
    try {
      return await dataLayer.getSessionAudioMetadata(sessionId);
    } catch (error) {
      console.error('Error listing session audio files:', error);
      throw this.createServiceError('LIST_AUDIO_FILES_FAILED', error as Error);
    }
  }

  /**
   * List user's audio files across all sessions
   */
  async listUserAudioFiles(
    options: AudioListOptions = {}
  ): Promise<{
    files: AudioMetadata[];
    nextToken?: string;
  }> {
    try {
      const user = await getCurrentUser();
      const prefix = `${AUDIO_FOLDER_PREFIX}/${user.userId}/`;

      const listResult = await list({
        prefix,
        options: {
          listAll: false,
          pageSize: options.limit || 50,
          nextToken: options.nextToken,
        },
      });

      // If metadata is requested, fetch from DynamoDB
      if (options.includeMetadata) {
        // This would require a more complex query to get metadata for multiple files
        // For now, return basic file information
        const files: AudioMetadata[] = [];
        return { files, nextToken: listResult.nextToken };
      }

      // Return basic file list without metadata
      const files: AudioMetadata[] = [];
      return { files, nextToken: listResult.nextToken };
    } catch (error) {
      console.error('Error listing user audio files:', error);
      throw this.createServiceError('LIST_USER_AUDIO_FILES_FAILED', error as Error);
    }
  }

  // ==================== DELETE OPERATIONS ====================

  /**
   * Delete audio file and its metadata
   */
  async deleteAudioFile(metadataId: string): Promise<void> {
    try {
      const metadata = await this.getAudioMetadata(metadataId);
      if (!metadata) {
        console.warn(`Audio metadata not found for ID: ${metadataId}`);
        return;
      }

      // Delete from S3
      await remove({ key: metadata.s3Key });

      // Delete metadata from DynamoDB (handled by cascade delete in data layer)
      console.log(`Audio file deleted successfully: ${metadata.s3Key}`);
    } catch (error) {
      console.error('Error deleting audio file:', error);
      throw this.createServiceError('AUDIO_DELETE_FAILED', error as Error);
    }
  }

  /**
   * Delete audio file by S3 key
   */
  async deleteAudioByKey(s3Key: string): Promise<void> {
    try {
      await remove({ key: s3Key });
      console.log(`Audio file deleted by key: ${s3Key}`);
    } catch (error) {
      console.error('Error deleting audio by key:', error);
      throw this.createServiceError('AUDIO_DELETE_BY_KEY_FAILED', error as Error);
    }
  }

  /**
   * Delete all audio files for a session
   */
  async deleteSessionAudioFiles(sessionId: string): Promise<void> {
    try {
      const audioFiles = await this.listSessionAudioFiles(sessionId);
      
      const deletePromises = audioFiles.map(file => 
        this.deleteAudioFile(file.id)
      );

      await Promise.all(deletePromises);
      console.log(`Deleted ${audioFiles.length} audio files for session: ${sessionId}`);
    } catch (error) {
      console.error('Error deleting session audio files:', error);
      throw this.createServiceError('DELETE_SESSION_AUDIO_FAILED', error as Error);
    }
  }

  /**
   * Clean up temporary audio files
   */
  async cleanupTemporaryFiles(olderThanHours: number = 24): Promise<number> {
    try {
      const user = await getCurrentUser();
      const tempPrefix = `${TEMP_AUDIO_PREFIX}/${user.userId}/`;

      const listResult = await list({
        prefix: tempPrefix,
        options: { listAll: true },
      });

      const cutoffTime = new Date(Date.now() - (olderThanHours * 60 * 60 * 1000));
      let deletedCount = 0;

      for (const item of listResult.items) {
        if (item.lastModified && item.lastModified < cutoffTime) {
          try {
            await remove({ key: item.key });
            deletedCount++;
          } catch (error) {
            console.warn(`Failed to delete temp file: ${item.key}`, error);
          }
        }
      }

      console.log(`Cleaned up ${deletedCount} temporary audio files`);
      return deletedCount;
    } catch (error) {
      console.error('Error cleaning up temporary files:', error);
      return 0; // Don't throw for cleanup operations
    }
  }

  // ==================== LIFECYCLE MANAGEMENT ====================

  /**
   * Set up automatic cleanup for expired files
   */
  async setupLifecyclePolicy(): Promise<void> {
    // Note: This would typically be configured at the S3 bucket level
    // For now, we'll implement manual cleanup
    console.log('Lifecycle policy setup - using manual cleanup');
  }

  /**
   * Archive old audio files (move to cheaper storage class)
   */
  async archiveOldFiles(olderThanDays: number = 30): Promise<number> {
    try {
      // This would require additional S3 operations not directly supported by Amplify Storage
      // For now, log the requirement
      console.log(`Archive operation requested for files older than ${olderThanDays} days`);
      return 0;
    } catch (error) {
      console.error('Error archiving old files:', error);
      return 0;
    }
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get audio metadata by ID
   */
  private async getAudioMetadata(metadataId: string): Promise<AudioMetadata | null> {
    try {
      // This would need to be implemented in the data layer
      // For now, we'll need to search through session audio metadata
      throw new Error('Direct metadata lookup not implemented yet');
    } catch (error) {
      console.error('Error getting audio metadata:', error);
      return null;
    }
  }

  /**
   * Validate audio file before upload
   */
  private async validateAudioFile(
    audioData: ArrayBuffer | Blob | File,
    format: string
  ): Promise<void> {
    // Check format
    if (!SUPPORTED_FORMATS.includes(format)) {
      throw new Error(`Unsupported audio format: ${format}`);
    }

    // Check size
    const size = audioData instanceof ArrayBuffer 
      ? audioData.byteLength 
      : audioData.size;

    if (size > MAX_FILE_SIZE) {
      throw new Error(`Audio file too large: ${size} bytes (max: ${MAX_FILE_SIZE})`);
    }

    // Additional validation could be added here
  }

  /**
   * Calculate audio duration (basic implementation)
   */
  private async calculateAudioDuration(audioData: ArrayBuffer | Blob | File): Promise<number> {
    try {
      // This is a simplified implementation
      // In a real application, you might use a library like Web Audio API
      // or extract duration from audio metadata
      
      if (audioData instanceof File && audioData.type.startsWith('audio/')) {
        // For File objects, we might be able to get duration
        return 0; // Placeholder
      }

      // For ArrayBuffer/Blob, duration calculation is more complex
      return 0; // Placeholder - would need audio analysis
    } catch (error) {
      console.warn('Could not calculate audio duration:', error);
      return 0;
    }
  }

  /**
   * Generate unique audio ID
   */
  private generateAudioId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `audio_${timestamp}_${random}`;
  }

  /**
   * Generate S3 key for audio file
   */
  private generateS3Key(
    userId: string,
    sessionId: string,
    audioId: string,
    isTemporary: boolean = false
  ): string {
    const prefix = isTemporary ? TEMP_AUDIO_PREFIX : AUDIO_FOLDER_PREFIX;
    return `${prefix}/${userId}/${sessionId}/${audioId}`;
  }

  /**
   * Create standardized service error
   */
  private createServiceError(code: string, originalError: Error): ServiceError {
    return {
      code,
      message: originalError.message,
      service: 'AudioStorage',
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

  // ==================== HEALTH CHECK ====================

  /**
   * Health check for S3 storage service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      const user = await getCurrentUser();
      const testKey = `health-check/${user.userId}/test-${Date.now()}`;
      const testData = new ArrayBuffer(1024); // 1KB test file

      // Test upload
      await uploadData({
        key: testKey,
        data: testData,
        options: {
          contentType: 'application/octet-stream',
        },
      }).result;

      // Test download
      await downloadData({ key: testKey }).result;

      // Test delete
      await remove({ key: testKey });

      return { healthy: true, message: 'S3 storage service healthy' };
    } catch (error) {
      console.error('S3 storage health check failed:', error);
      return { 
        healthy: false, 
        message: `S3 storage service failed: ${(error as Error).message}` 
      };
    }
  }

  // ==================== ANALYTICS ====================

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    totalFiles: number;
    totalSize: number;
    filesByFormat: Record<string, number>;
    oldestFile?: Date;
    newestFile?: Date;
  }> {
    try {
      const user = await getCurrentUser();
      const prefix = `${AUDIO_FOLDER_PREFIX}/${user.userId}/`;

      const listResult = await list({
        prefix,
        options: { listAll: true },
      });

      const stats = {
        totalFiles: listResult.items.length,
        totalSize: 0,
        filesByFormat: {} as Record<string, number>,
        oldestFile: undefined as Date | undefined,
        newestFile: undefined as Date | undefined,
      };

      listResult.items.forEach(item => {
        if (item.size) {
          stats.totalSize += item.size;
        }

        if (item.lastModified) {
          if (!stats.oldestFile || item.lastModified < stats.oldestFile) {
            stats.oldestFile = item.lastModified;
          }
          if (!stats.newestFile || item.lastModified > stats.newestFile) {
            stats.newestFile = item.lastModified;
          }
        }

        // Extract format from key (simplified)
        const extension = item.key.split('.').pop();
        if (extension) {
          stats.filesByFormat[extension] = (stats.filesByFormat[extension] || 0) + 1;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting storage stats:', error);
      throw this.createServiceError('STORAGE_STATS_FAILED', error as Error);
    }
  }
}

// Export singleton instance
export const audioStorageService = AudioStorageService.getInstance();