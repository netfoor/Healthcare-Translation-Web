# Data Storage and Management Implementation

This document describes the comprehensive data storage and management system implemented for the Healthcare Translation App.

## Overview

The data storage system provides:
- **DynamoDB Integration**: Session and transcript data with TTL support
- **S3 Audio Storage**: Encrypted audio file storage with lifecycle management
- **Data Retention**: Automated cleanup and compliance management
- **Error Handling**: Comprehensive retry logic and error recovery
- **Health Monitoring**: System health checks and monitoring

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                Data Management Service                       │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │   Session   │ │ Transcript  │ │    Audio Storage        │ │
│  │   Service   │ │   Service   │ │      Service            │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data Layer                               │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  DynamoDB   │ │     S3      │ │   Data Retention        │ │
│  │ Operations  │ │ Operations  │ │     Service             │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                AWS Services                                 │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────┐ │
│  │  DynamoDB   │ │     S3      │ │    Amplify Gen 2        │ │
│  │   Tables    │ │   Buckets   │ │   Configuration         │ │
│  └─────────────┘ └─────────────┘ └─────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Data Layer (`data-layer.ts`)

The foundational layer that handles all DynamoDB operations with:

- **Session Management**: CRUD operations for translation sessions
- **Transcript Operations**: Storage and retrieval of transcript entries
- **Audio Metadata**: Metadata management for audio files
- **TTL Support**: Automatic data expiration (24 hours)
- **Retry Logic**: Exponential backoff for failed operations
- **Error Handling**: Comprehensive error categorization and recovery

**Key Features:**
```typescript
// Create session with TTL
const session = await dataLayer.createSession({
  userId: 'user123',
  inputLanguage: 'en',
  outputLanguage: 'es',
  status: 'active',
  createdAt: new Date(),
  lastActivity: new Date()
});

// Get session transcripts with pagination
const { entries, nextToken } = await dataLayer.getSessionTranscripts(
  sessionId, 
  { limit: 50 }
);
```

### 2. Audio Storage Service (`audio-storage-service.ts`)

Handles encrypted S3 storage for audio files:

- **Encrypted Upload**: SSE-KMS encryption for all audio files
- **Presigned URLs**: Secure access to audio files
- **Lifecycle Management**: Automatic cleanup of temporary files
- **Batch Operations**: Efficient handling of multiple files
- **Format Validation**: Support for multiple audio formats

**Key Features:**
```typescript
// Upload audio with encryption
const metadata = await audioStorageService.uploadAudioFile(audioData, {
  sessionId: 'session123',
  format: 'audio/wav',
  language: 'en',
  metadata: { speaker: 'doctor' }
});

// Get presigned URL for secure access
const url = await audioStorageService.getAudioPresignedUrl(
  metadataId, 
  3600 // 1 hour expiry
);
```

### 3. Transcript Service (`transcript-service.ts`)

Manages transcript entries with advanced features:

- **CRUD Operations**: Create, read, update transcript entries
- **Search Functionality**: Text-based search across transcripts
- **Statistics**: Confidence scores, word counts, processing status
- **Export Capabilities**: Multiple export formats (JSON, CSV, TXT)
- **Batch Operations**: Efficient bulk operations

**Key Features:**
```typescript
// Create transcript entry
const entry = await transcriptService.createTranscriptEntry(
  sessionId,
  'Hello, how are you?',
  0.95,
  'doctor'
);

// Search transcripts
const results = await transcriptService.searchTranscripts(
  sessionId,
  'headache',
  true // search translated text too
);
```

### 4. Data Retention Service (`data-retention-service.ts`)

Automated data lifecycle management:

- **Retention Policies**: Configurable retention periods
- **Automated Cleanup**: Scheduled cleanup of expired data
- **Compliance Reporting**: HIPAA compliance monitoring
- **Impact Analysis**: Estimate cleanup effects before execution
- **Orphaned Data**: Detection and cleanup of orphaned records

**Key Features:**
```typescript
// Configure retention policy
dataRetentionService.setRetentionPolicy({
  sessionRetentionHours: 24,
  audioRetentionHours: 24,
  tempFileRetentionHours: 2,
  enableAutoCleanup: true
});

// Run cleanup with impact analysis
const impact = await dataRetentionService.estimateCleanupImpact();
const result = await dataRetentionService.runCleanup();
```

### 5. Data Management Service (`data-management-service.ts`)

Central orchestration service that coordinates all data operations:

- **Unified API**: Single interface for all data operations
- **Health Monitoring**: System-wide health checks
- **Export/Import**: Data portability and backup
- **Configuration Management**: Centralized configuration
- **Error Coordination**: Cross-service error handling

**Key Features:**
```typescript
// Create complete session
const session = await dataManagementService.createSession(
  'en', 'es', 
  { specialty: 'cardiology' }
);

// Export session data
const exportData = await dataManagementService.exportSessionData(
  sessionId,
  { includeAudio: true, includeTranscripts: true, format: 'json' }
);
```

## Data Models

### TranslationSession
```typescript
interface TranslationSession {
  id: string;
  userId: string;
  inputLanguage: string;
  outputLanguage: string;
  status: 'active' | 'paused' | 'ended';
  createdAt: Date;
  lastActivity: Date;
}
```

### TranscriptEntry
```typescript
interface TranscriptEntry {
  id: string;
  sessionId: string;
  originalText: string;
  translatedText?: string;
  confidence: number;
  timestamp: Date;
  speaker?: string;
  isProcessing: boolean;
}
```

### AudioMetadata
```typescript
interface AudioMetadata {
  id: string;
  sessionId: string;
  s3Key: string;
  duration: number;
  format: string;
  language: string;
  createdAt: Date;
}
```

## Security Features

### Data Encryption
- **At Rest**: DynamoDB encryption, S3 SSE-KMS
- **In Transit**: HTTPS/WSS for all communications
- **Access Control**: IAM roles with least privilege

### HIPAA Compliance
- **Data Retention**: Configurable retention policies
- **Audit Trails**: Comprehensive logging without PII
- **Access Logging**: All data access is logged
- **Automatic Cleanup**: TTL-based data expiration

### Error Handling
- **No PII in Logs**: Sensitive data is redacted
- **Secure Error Messages**: User-friendly without exposing internals
- **Retry Logic**: Intelligent retry with exponential backoff

## Configuration

### Amplify Data Schema
```typescript
// amplify/data/resource.ts
const schema = a.schema({
  TranslationSession: a.model({
    userId: a.string().required(),
    inputLanguage: a.string().required(),
    outputLanguage: a.string().required(),
    status: a.enum(['active', 'paused', 'ended']),
    createdAt: a.datetime(),
    lastActivity: a.datetime(),
    ttl: a.integer(), // TTL for automatic cleanup
  }),
  // ... other models
});
```

### Storage Configuration
```typescript
// amplify/storage/resource.ts
export const storage = defineStorage({
  name: 'healthcareTranslationStorage',
  access: (allow) => ({
    'audio-files/{entity_id}/*': [
      allow.entity('identity').to(['read', 'write', 'delete']),
    ],
    'temp-audio/*': [
      allow.authenticated.to(['read', 'write', 'delete']),
    ],
  }),
});
```

## Usage Examples

### Basic Session Management
```typescript
import { dataManagementService } from './lib/data-management-service';

// Create session
const session = await dataManagementService.createSession('en', 'es');

// Add transcript
const transcript = await dataManagementService.addTranscriptEntry(
  session.id,
  'Patient has chest pain',
  0.95,
  'doctor'
);

// Store audio
const audioMetadata = await dataManagementService.storeAudioFile(
  audioBuffer,
  {
    sessionId: session.id,
    format: 'audio/wav',
    language: 'en'
  }
);

// End session
await dataManagementService.endSession(session.id, true);
```

### Data Retention Management
```typescript
import { dataRetentionService } from './lib/data-retention-service';

// Configure retention
dataRetentionService.setRetentionPolicy({
  sessionRetentionHours: 24,
  enableAutoCleanup: true
});

// Check compliance
const report = await dataRetentionService.generateComplianceReport();
console.log('Compliance status:', report.complianceStatus);

// Run cleanup
const result = await dataRetentionService.runCleanup();
console.log('Cleaned up:', result.sessionsDeleted, 'sessions');
```

### Health Monitoring
```typescript
import { dataManagementService } from './lib/data-management-service';

// Check system health
const health = await dataManagementService.checkSystemHealth();
console.log('System status:', health.overall);

// Start monitoring
dataManagementService.startHealthMonitoring(5); // every 5 minutes
```

## Testing

The implementation includes comprehensive unit tests:

- **Data Layer Tests**: DynamoDB operations, retry logic, TTL
- **Service Tests**: Business logic, error handling
- **Integration Tests**: End-to-end workflows
- **Mock Services**: Complete AWS service mocking

Run tests:
```bash
npm test -- --testPathPattern=data-layer.test.ts
```

## Performance Considerations

### Optimization Strategies
- **Connection Pooling**: Reuse DynamoDB connections
- **Batch Operations**: Reduce API calls with batch processing
- **Caching**: In-memory caching for frequently accessed data
- **Pagination**: Efficient handling of large datasets

### Monitoring Metrics
- **Response Times**: Track operation latency
- **Error Rates**: Monitor failure rates by operation
- **Storage Usage**: Track S3 storage consumption
- **Cleanup Efficiency**: Monitor retention policy effectiveness

## Deployment

### Prerequisites
- AWS Amplify Gen 2 configured
- DynamoDB tables with TTL enabled
- S3 bucket with encryption enabled
- IAM roles with appropriate permissions

### Environment Variables
```bash
# Set in .env.local
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_AMPLIFY_APP_ID=your-app-id
```

### Deployment Steps
1. Deploy Amplify backend: `npx amplify push`
2. Configure TTL on DynamoDB tables
3. Set up S3 lifecycle policies
4. Configure monitoring and alerts

## Troubleshooting

### Common Issues

**DynamoDB Connection Errors**
- Check IAM permissions
- Verify region configuration
- Monitor throttling limits

**S3 Upload Failures**
- Verify bucket permissions
- Check file size limits
- Monitor encryption settings

**TTL Not Working**
- Ensure TTL is enabled on tables
- Check TTL attribute format (Unix timestamp)
- Monitor DynamoDB metrics

### Debug Mode
Enable debug logging:
```typescript
// In development
const config = {
  features: {
    enableDebugLogging: true
  }
};
```

## Future Enhancements

### Planned Features
- **Data Archiving**: Move old data to cheaper storage
- **Advanced Analytics**: Usage patterns and insights
- **Multi-Region**: Cross-region data replication
- **Backup/Restore**: Point-in-time recovery
- **Data Validation**: Schema validation and data integrity checks

### Performance Improvements
- **Caching Layer**: Redis/ElastiCache integration
- **Connection Pooling**: Optimize database connections
- **Compression**: Compress large transcript data
- **CDN Integration**: CloudFront for audio file delivery

## Support

For issues or questions:
1. Check the troubleshooting section
2. Review the test files for usage examples
3. Check AWS service status
4. Review CloudWatch logs for detailed error information

---

*This implementation follows AWS best practices for healthcare applications and maintains HIPAA compliance through proper data handling, encryption, and retention policies.*