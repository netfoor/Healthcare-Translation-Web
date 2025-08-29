import {
  TranscribeStreamingClient,
  StartMedicalStreamTranscriptionCommand,
  StartStreamTranscriptionCommand,
  LanguageCode,
  MediaEncoding
} from '@aws-sdk/client-transcribe-streaming';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const transcribeClient = new TranscribeStreamingClient({});
const dynamodb = new DynamoDBClient({});

interface ServiceHealthStatus {
  service: string;
  healthy: boolean;
  lastChecked: string;
  errorCount: number;
  lastError?: string;
  responseTime?: number;
}

interface HealthCheckResult {
  transcribeMedical: ServiceHealthStatus;
  transcribeStandard: ServiceHealthStatus;
  overallHealth: 'healthy' | 'degraded' | 'unhealthy';
  recommendFallback: boolean;
}

export const handler = async (event: any): Promise<HealthCheckResult> => {
  console.log('Starting service health monitoring...');

  const startTime = Date.now();

  try {
    // Check Transcribe Medical health
    const medicalHealth = await checkTranscribeMedicalHealth();

    // Check standard Transcribe health
    const standardHealth = await checkTranscribeStandardHealth();

    // Determine overall health status
    const overallHealth = determineOverallHealth(medicalHealth, standardHealth);
    const recommendFallback = !medicalHealth.healthy && standardHealth.healthy;

    const result: HealthCheckResult = {
      transcribeMedical: medicalHealth,
      transcribeStandard: standardHealth,
      overallHealth,
      recommendFallback
    };

    // Store health status in DynamoDB for monitoring
    await storeHealthStatus(result);

    // Notify connected clients if there's a service degradation
    if (overallHealth !== 'healthy') {
      await notifyClientsOfServiceDegradation(result);
    }

    console.log('Health check completed:', result);
    return result;
  } catch (error) {
    console.error('Health check failed:', error);

    const errorResult: HealthCheckResult = {
      transcribeMedical: {
        service: 'transcribe-medical',
        healthy: false,
        lastChecked: new Date().toISOString(),
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      },
      transcribeStandard: {
        service: 'transcribe-standard',
        healthy: false,
        lastChecked: new Date().toISOString(),
        errorCount: 1,
        lastError: error instanceof Error ? error.message : 'Unknown error'
      },
      overallHealth: 'unhealthy',
      recommendFallback: false
    };

    await storeHealthStatus(errorResult);
    return errorResult;
  }
};

async function checkTranscribeMedicalHealth(): Promise<ServiceHealthStatus> {
  const startTime = Date.now();

  try {
    console.log('Checking Transcribe Medical health...');

    // For health check, we'll use a simpler approach that doesn't require actual streaming
    // We can check service availability by attempting to create a command and validate parameters
    // In a real implementation, you might want to use AWS Health API or CloudWatch metrics

    // Simulate a basic service availability check
    // This is a simplified health check that assumes the service is available
    // In production, you would implement more sophisticated health checking

    const responseTime = Date.now() - startTime;

    // Simulate successful health check
    return {
      service: 'transcribe-medical',
      healthy: true,
      lastChecked: new Date().toISOString(),
      errorCount: 0,
      responseTime
    };
  } catch (error) {
    console.warn('Transcribe Medical health check failed:', error);

    const responseTime = Date.now() - startTime;

    return {
      service: 'transcribe-medical',
      healthy: false,
      lastChecked: new Date().toISOString(),
      errorCount: 1,
      lastError: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    };
  }
}

async function checkTranscribeStandardHealth(): Promise<ServiceHealthStatus> {
  const startTime = Date.now();

  try {
    console.log('Checking standard Transcribe health...');

    // For health check, we'll use a simpler approach that doesn't require actual streaming
    // We can check service availability by attempting to create a command and validate parameters
    // In a real implementation, you might want to use AWS Health API or CloudWatch metrics

    // Simulate a basic service availability check
    // This is a simplified health check that assumes the service is available
    // In production, you would implement more sophisticated health checking

    const responseTime = Date.now() - startTime;

    // Simulate successful health check
    return {
      service: 'transcribe-standard',
      healthy: true,
      lastChecked: new Date().toISOString(),
      errorCount: 0,
      responseTime
    };
  } catch (error) {
    console.warn('Standard Transcribe health check failed:', error);

    const responseTime = Date.now() - startTime;

    return {
      service: 'transcribe-standard',
      healthy: false,
      lastChecked: new Date().toISOString(),
      errorCount: 1,
      lastError: error instanceof Error ? error.message : 'Unknown error',
      responseTime
    };
  }
}

function determineOverallHealth(
  medicalHealth: ServiceHealthStatus,
  standardHealth: ServiceHealthStatus
): 'healthy' | 'degraded' | 'unhealthy' {
  if (medicalHealth.healthy && standardHealth.healthy) {
    return 'healthy';
  } else if (medicalHealth.healthy || standardHealth.healthy) {
    return 'degraded';
  } else {
    return 'unhealthy';
  }
}

async function storeHealthStatus(healthResult: HealthCheckResult): Promise<void> {
  try {
    const timestamp = new Date().toISOString();

    await dynamodb.send(new PutItemCommand({
      TableName: process.env.SESSIONS_TABLE || 'healthcare-translation-sessions',
      Item: {
        sessionId: { S: `health-check-${Date.now()}` },
        connectionId: { S: 'system' },
        healthStatus: { S: JSON.stringify(healthResult) },
        timestamp: { S: timestamp },
        ttl: { N: String(Math.floor(Date.now() / 1000) + 3600) } // 1 hour TTL
      }
    }));

    console.log('Health status stored successfully');
  } catch (error) {
    console.error('Failed to store health status:', error);
  }
}

async function notifyClientsOfServiceDegradation(healthResult: HealthCheckResult): Promise<void> {
  try {
    console.log('Notifying clients of service degradation...');

    // Get active connections from DynamoDB
    // This is a simplified implementation - in production you'd want to query for active connections
    const notification = {
      success: true,
      action: 'serviceHealthUpdate',
      data: {
        overallHealth: healthResult.overallHealth,
        transcribeMedical: healthResult.transcribeMedical,
        transcribeStandard: healthResult.transcribeStandard,
        recommendFallback: healthResult.recommendFallback,
        message: getHealthMessage(healthResult),
        timestamp: new Date().toISOString()
      }
    };

    console.log('Service degradation notification prepared:', notification);

    // In a real implementation, you would:
    // 1. Query the connections table for active connections
    // 2. Send notifications to each active connection
    // 3. Handle failed notifications gracefully

  } catch (error) {
    console.error('Failed to notify clients of service degradation:', error);
  }
}

function getHealthMessage(healthResult: HealthCheckResult): string {
  switch (healthResult.overallHealth) {
    case 'healthy':
      return 'All transcription services are operating normally.';
    case 'degraded':
      if (!healthResult.transcribeMedical.healthy && healthResult.transcribeStandard.healthy) {
        return 'Transcribe Medical is currently unavailable. Using standard Transcribe with medical vocabulary.';
      } else if (healthResult.transcribeMedical.healthy && !healthResult.transcribeStandard.healthy) {
        return 'Standard Transcribe is currently unavailable. Transcribe Medical is functioning normally.';
      } else {
        return 'Some transcription services are experiencing issues.';
      }
    case 'unhealthy':
      return 'Transcription services are currently unavailable. Please try again later.';
    default:
      return 'Unknown service status.';
  }
}

// Function to get the latest health status
export const getLatestHealthStatus = async (): Promise<HealthCheckResult | null> => {
  try {
    // This is a simplified implementation
    // In production, you'd query for the most recent health check result
    return null;
  } catch (error) {
    console.error('Failed to get latest health status:', error);
    return null;
  }
};