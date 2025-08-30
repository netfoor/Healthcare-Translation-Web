/**
 * Transcript Service
 * Manages transcript entries with DynamoDB integration
 */

import { TranscriptEntry, ServiceError } from './types';
import { dataLayer } from './data-layer';

export class TranscriptService {
  private static instance: TranscriptService;

  private constructor() {}

  static getInstance(): TranscriptService {
    if (!TranscriptService.instance) {
      TranscriptService.instance = new TranscriptService();
    }
    return TranscriptService.instance;
  }

  /**
   * Create a new transcript entry
   */
  async createTranscriptEntry(
    sessionId: string,
    originalText: string,
    confidence: number,
    speaker?: string
  ): Promise<TranscriptEntry> {
    try {
      const entryData = {
        sessionId,
        originalText,
        confidence,
        timestamp: new Date(),
        speaker,
        isProcessing: false,
      };

      return await dataLayer.createTranscriptEntry(entryData);
    } catch (error) {
      console.error('Error creating transcript entry:', error);
      throw new Error('Failed to create transcript entry');
    }
  }

  /**
   * Update transcript entry with translation
   */
  async updateTranscriptWithTranslation(
    entryId: string,
    translatedText: string,
    confidence?: number
  ): Promise<TranscriptEntry> {
    try {
      return await dataLayer.updateTranscriptEntry(entryId, {
        translatedText,
        confidence,
        isProcessing: false,
      });
    } catch (error) {
      console.error('Error updating transcript with translation:', error);
      throw new Error('Failed to update transcript with translation');
    }
  }

  /**
   * Mark transcript entry as processing
   */
  async markTranscriptAsProcessing(entryId: string): Promise<TranscriptEntry> {
    try {
      return await dataLayer.updateTranscriptEntry(entryId, {
        isProcessing: true,
      });
    } catch (error) {
      console.error('Error marking transcript as processing:', error);
      throw new Error('Failed to mark transcript as processing');
    }
  }

  /**
   * Get all transcript entries for a session
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
    try {
      return await dataLayer.getSessionTranscripts(sessionId, options);
    } catch (error) {
      console.error('Error getting session transcripts:', error);
      throw new Error('Failed to get session transcripts');
    }
  }

  /**
   * Get recent transcript entries for a session
   */
  async getRecentTranscripts(
    sessionId: string,
    limit: number = 10
  ): Promise<TranscriptEntry[]> {
    try {
      const { entries } = await this.getSessionTranscripts(sessionId, { limit });
      return entries.slice(-limit); // Get the most recent entries
    } catch (error) {
      console.error('Error getting recent transcripts:', error);
      throw new Error('Failed to get recent transcripts');
    }
  }

  /**
   * Search transcripts by text content
   */
  async searchTranscripts(
    sessionId: string,
    searchTerm: string,
    searchTranslated: boolean = false
  ): Promise<TranscriptEntry[]> {
    try {
      const { entries } = await this.getSessionTranscripts(sessionId, { limit: 1000 });
      
      const searchTermLower = searchTerm.toLowerCase();
      
      return entries.filter(entry => {
        const originalMatch = entry.originalText.toLowerCase().includes(searchTermLower);
        const translatedMatch = searchTranslated && 
          entry.translatedText && 
          entry.translatedText.toLowerCase().includes(searchTermLower);
        
        return originalMatch || translatedMatch;
      });
    } catch (error) {
      console.error('Error searching transcripts:', error);
      throw new Error('Failed to search transcripts');
    }
  }

  /**
   * Get transcript statistics for a session
   */
  async getTranscriptStats(sessionId: string): Promise<{
    totalEntries: number;
    averageConfidence: number;
    translatedEntries: number;
    processingEntries: number;
    totalWords: number;
  }> {
    try {
      const { entries } = await this.getSessionTranscripts(sessionId, { limit: 1000 });
      
      const stats = {
        totalEntries: entries.length,
        averageConfidence: 0,
        translatedEntries: 0,
        processingEntries: 0,
        totalWords: 0,
      };

      if (entries.length === 0) {
        return stats;
      }

      let totalConfidence = 0;
      
      entries.forEach(entry => {
        totalConfidence += entry.confidence;
        
        if (entry.translatedText) {
          stats.translatedEntries++;
        }
        
        if (entry.isProcessing) {
          stats.processingEntries++;
        }
        
        // Count words in original text
        stats.totalWords += entry.originalText.split(/\s+/).length;
      });

      stats.averageConfidence = totalConfidence / entries.length;

      return stats;
    } catch (error) {
      console.error('Error getting transcript stats:', error);
      throw new Error('Failed to get transcript statistics');
    }
  }

  /**
   * Export transcripts as text
   */
  async exportTranscripts(
    sessionId: string,
    format: 'original' | 'translated' | 'both' = 'both'
  ): Promise<string> {
    try {
      const { entries } = await this.getSessionTranscripts(sessionId, { limit: 1000 });
      
      let exportText = '';
      
      entries.forEach((entry, index) => {
        const timestamp = entry.timestamp.toLocaleString();
        const speaker = entry.speaker ? `[${entry.speaker}] ` : '';
        
        exportText += `\n--- Entry ${index + 1} (${timestamp}) ---\n`;
        
        if (format === 'original' || format === 'both') {
          exportText += `${speaker}Original: ${entry.originalText}\n`;
        }
        
        if ((format === 'translated' || format === 'both') && entry.translatedText) {
          exportText += `${speaker}Translated: ${entry.translatedText}\n`;
        }
        
        if (entry.confidence < 0.8) {
          exportText += `(Low confidence: ${(entry.confidence * 100).toFixed(1)}%)\n`;
        }
      });

      return exportText.trim();
    } catch (error) {
      console.error('Error exporting transcripts:', error);
      throw new Error('Failed to export transcripts');
    }
  }

  /**
   * Batch create transcript entries (for bulk operations)
   */
  async batchCreateTranscriptEntries(
    entries: Array<{
      sessionId: string;
      originalText: string;
      confidence: number;
      timestamp?: Date;
      speaker?: string;
    }>
  ): Promise<TranscriptEntry[]> {
    try {
      const createdEntries: TranscriptEntry[] = [];
      
      // Process in batches to avoid overwhelming the database
      const batchSize = 10;
      for (let i = 0; i < entries.length; i += batchSize) {
        const batch = entries.slice(i, i + batchSize);
        
        const batchPromises = batch.map(entry => 
          dataLayer.createTranscriptEntry({
            sessionId: entry.sessionId,
            originalText: entry.originalText,
            confidence: entry.confidence,
            timestamp: entry.timestamp || new Date(),
            speaker: entry.speaker,
            isProcessing: false,
          })
        );
        
        const batchResults = await Promise.all(batchPromises);
        createdEntries.push(...batchResults);
      }
      
      return createdEntries;
    } catch (error) {
      console.error('Error batch creating transcript entries:', error);
      throw new Error('Failed to batch create transcript entries');
    }
  }

  /**
   * Clean up processing entries that may be stuck
   */
  async cleanupStuckProcessingEntries(sessionId: string, timeoutMinutes: number = 5): Promise<number> {
    try {
      const { entries } = await this.getSessionTranscripts(sessionId, { limit: 1000 });
      const timeoutMs = timeoutMinutes * 60 * 1000;
      const cutoffTime = new Date(Date.now() - timeoutMs);
      
      const stuckEntries = entries.filter(entry => 
        entry.isProcessing && entry.timestamp < cutoffTime
      );
      
      // Update stuck entries to not processing
      const updatePromises = stuckEntries.map(entry =>
        dataLayer.updateTranscriptEntry(entry.id, { isProcessing: false })
      );
      
      await Promise.all(updatePromises);
      
      return stuckEntries.length;
    } catch (error) {
      console.error('Error cleaning up stuck processing entries:', error);
      return 0; // Don't throw error for cleanup operations
    }
  }

  /**
   * Health check for transcript service
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Test basic data layer connectivity
      const dataLayerHealth = await dataLayer.healthCheck();
      
      if (!dataLayerHealth.healthy) {
        return {
          healthy: false,
          message: `Transcript service unhealthy: ${dataLayerHealth.message}`,
        };
      }

      return { healthy: true, message: 'Transcript service healthy' };
    } catch (error) {
      return {
        healthy: false,
        message: `Transcript service error: ${(error as Error).message}`,
      };
    }
  }
}

// Export singleton instance
export const transcriptService = TranscriptService.getInstance();