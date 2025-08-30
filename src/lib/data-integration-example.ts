/**
 * Data Integration Example
 * Demonstrates how to use the data storage and management services together
 */

import { dataManagementService } from './data-management-service';
import { dataRetentionService } from './data-retention-service';
import { transcriptService } from './transcript-service';
import { audioStorageService } from './audio-storage-service';

/**
 * Example: Complete workflow for handling a translation session
 */
export async function exampleTranslationWorkflow() {
  try {
    console.log('Starting translation workflow example...');

    // 1. Create a new session
    const session = await dataManagementService.createSession(
      'en', // input language
      'es', // output language
      { specialty: 'cardiology' } // metadata
    );
    console.log('Session created:', session.id);

    // 2. Add transcript entries as they come in
    const transcript1 = await dataManagementService.addTranscriptEntry(
      session.id,
      'The patient has chest pain',
      0.95,
      'doctor'
    );
    console.log('Transcript entry created:', transcript1.id);

    // 3. Update with translation
    const updatedTranscript = await dataManagementService.updateTranscriptWithTranslation(
      transcript1.id,
      'El paciente tiene dolor en el pecho',
      0.92
    );
    console.log('Translation added:', updatedTranscript.translatedText);

    // 4. Store audio file
    const audioData = new ArrayBuffer(1024); // Mock audio data
    const audioMetadata = await dataManagementService.storeAudioFile(audioData, {
      sessionId: session.id,
      format: 'audio/wav',
      language: 'en',
      metadata: { speaker: 'doctor' }
    });
    console.log('Audio file stored:', audioMetadata.s3Key);

    // 5. Export session data
    const exportData = await dataManagementService.exportSessionData(session.id, {
      includeAudio: true,
      includeTranscripts: true,
      format: 'json'
    });
    console.log('Session exported:', exportData.filename);

    // 6. End session
    await dataManagementService.endSession(session.id, true); // trigger cleanup
    console.log('Session ended');

    return {
      sessionId: session.id,
      transcriptId: transcript1.id,
      audioId: audioMetadata.id,
      exportFilename: exportData.filename
    };

  } catch (error) {
    console.error('Workflow error:', error);
    throw error;
  }
}

/**
 * Example: Data retention and cleanup
 */
export async function exampleDataRetention() {
  try {
    console.log('Starting data retention example...');

    // 1. Configure retention policy
    dataRetentionService.setRetentionPolicy({
      sessionRetentionHours: 24,
      transcriptRetentionHours: 24,
      audioRetentionHours: 24,
      tempFileRetentionHours: 2,
      enableAutoCleanup: true,
    });

    // 2. Get retention statistics
    const stats = await dataRetentionService.getRetentionStats();
    console.log('Retention stats:', {
      totalSessions: stats.totalSessions,
      expiredSessions: stats.expiredSessions,
      totalStorageSize: `${(stats.totalStorageSize / 1024 / 1024).toFixed(2)} MB`
    });

    // 3. Estimate cleanup impact
    const impact = await dataRetentionService.estimateCleanupImpact();
    console.log('Cleanup impact:', {
      sessionsToDelete: impact.sessionsToDelete,
      storageToFree: `${(impact.storageToFree / 1024 / 1024).toFixed(2)} MB`,
      estimatedDuration: `${impact.estimatedDuration / 1000}s`
    });

    // 4. Run cleanup if needed
    if (impact.sessionsToDelete > 0) {
      const cleanupResult = await dataRetentionService.runCleanup();
      console.log('Cleanup completed:', {
        sessionsDeleted: cleanupResult.sessionsDeleted,
        audioFilesDeleted: cleanupResult.audioFilesDeleted,
        duration: `${cleanupResult.duration / 1000}s`
      });
    }

    // 5. Generate compliance report
    const complianceReport = await dataRetentionService.generateComplianceReport();
    console.log('Compliance status:', complianceReport.complianceStatus);
    if (complianceReport.recommendations.length > 0) {
      console.log('Recommendations:', complianceReport.recommendations);
    }

    return complianceReport;

  } catch (error) {
    console.error('Data retention error:', error);
    throw error;
  }
}

/**
 * Example: System health monitoring
 */
export async function exampleHealthMonitoring() {
  try {
    console.log('Starting health monitoring example...');

    // 1. Check overall system health
    const health = await dataManagementService.checkSystemHealth();
    console.log('System health:', health.overall);

    // 2. Check individual services
    Object.entries(health.services).forEach(([service, status]) => {
      console.log(`${service}: ${status.healthy ? '✓' : '✗'} ${status.message}`);
    });

    // 3. Start periodic monitoring (in a real app)
    // dataManagementService.startHealthMonitoring(5); // every 5 minutes

    // 4. Individual service health checks
    const dataLayerHealth = await transcriptService.healthCheck();
    const storageHealth = await audioStorageService.healthCheck();
    
    console.log('Service health details:', {
      transcriptService: dataLayerHealth.healthy,
      audioStorage: storageHealth.healthy
    });

    return {
      overall: health.overall,
      services: Object.keys(health.services).length,
      healthyServices: Object.values(health.services).filter(s => s.healthy).length
    };

  } catch (error) {
    console.error('Health monitoring error:', error);
    throw error;
  }
}

/**
 * Example: Advanced data operations
 */
export async function exampleAdvancedOperations() {
  try {
    console.log('Starting advanced operations example...');

    // Create a session for testing
    const session = await dataManagementService.createSession('en', 'es');

    // 1. Batch create transcript entries
    const batchEntries = [
      {
        sessionId: session.id,
        originalText: 'How are you feeling today?',
        confidence: 0.95,
        speaker: 'doctor'
      },
      {
        sessionId: session.id,
        originalText: 'I have been having headaches',
        confidence: 0.88,
        speaker: 'patient'
      },
      {
        sessionId: session.id,
        originalText: 'When did they start?',
        confidence: 0.92,
        speaker: 'doctor'
      }
    ];

    const createdEntries = await transcriptService.batchCreateTranscriptEntries(batchEntries);
    console.log(`Created ${createdEntries.length} transcript entries`);

    // 2. Get transcript statistics
    const stats = await transcriptService.getTranscriptStats(session.id);
    console.log('Transcript stats:', {
      totalEntries: stats.totalEntries,
      averageConfidence: `${(stats.averageConfidence * 100).toFixed(1)}%`,
      totalWords: stats.totalWords
    });

    // 3. Search transcripts
    const searchResults = await transcriptService.searchTranscripts(session.id, 'headache');
    console.log(`Found ${searchResults.length} entries containing "headache"`);

    // 4. Export transcripts as text
    const exportText = await transcriptService.exportTranscripts(session.id, 'both');
    console.log('Export preview:', exportText.substring(0, 200) + '...');

    // 5. Get storage statistics
    const storageStats = await audioStorageService.getStorageStats();
    console.log('Storage stats:', {
      totalFiles: storageStats.totalFiles,
      totalSize: `${(storageStats.totalSize / 1024 / 1024).toFixed(2)} MB`
    });

    // Clean up
    await dataManagementService.endSession(session.id);

    return {
      transcriptEntries: createdEntries.length,
      searchResults: searchResults.length,
      exportLength: exportText.length
    };

  } catch (error) {
    console.error('Advanced operations error:', error);
    throw error;
  }
}

/**
 * Run all examples
 */
export async function runAllExamples() {
  console.log('=== Data Storage and Management Examples ===\n');

  try {
    // Example 1: Basic workflow
    console.log('1. Translation Workflow Example');
    console.log('--------------------------------');
    const workflowResult = await exampleTranslationWorkflow();
    console.log('Result:', workflowResult);
    console.log('');

    // Example 2: Data retention
    console.log('2. Data Retention Example');
    console.log('-------------------------');
    const retentionResult = await exampleDataRetention();
    console.log('Compliance:', retentionResult.complianceStatus);
    console.log('');

    // Example 3: Health monitoring
    console.log('3. Health Monitoring Example');
    console.log('----------------------------');
    const healthResult = await exampleHealthMonitoring();
    console.log('Result:', healthResult);
    console.log('');

    // Example 4: Advanced operations
    console.log('4. Advanced Operations Example');
    console.log('------------------------------');
    const advancedResult = await exampleAdvancedOperations();
    console.log('Result:', advancedResult);
    console.log('');

    console.log('✅ All examples completed successfully!');

    return {
      workflow: workflowResult,
      retention: retentionResult,
      health: healthResult,
      advanced: advancedResult
    };

  } catch (error) {
    console.error('❌ Example execution failed:', error);
    throw error;
  }
}

// Export for use in other parts of the application
export {
  dataManagementService,
  dataRetentionService,
  transcriptService,
  audioStorageService
};