import { APIGatewayProxyEvent, APIGatewayProxyResult, ScheduledEvent } from 'aws-lambda';
import { CloudWatchClient, PutMetricDataCommand, MetricDatum } from '@aws-sdk/client-cloudwatch';
import { DynamoDBClient, ScanCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';

const cloudwatch = new CloudWatchClient({});
const dynamodb = new DynamoDBClient({});

interface MonitoringRequest {
  action: string;
  serviceType?: string;
  metricType?: string;
  timeRange?: number; // minutes
  requestId?: string;
}

interface MonitoringResponse {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  requestId?: string;
}

interface ServiceMetrics {
  serviceType: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageLatency: number;
  p95Latency: number;
  errorRate: number;
  availability: number;
  timestamp: string;
}

interface HealthCheckMetrics {
  serviceType: string;
  isHealthy: boolean;
  responseTime: number;
  consecutiveFailures: number;
  lastError?: string;
  timestamp: string;
}

// CloudWatch namespace for healthcare translation metrics
const CLOUDWATCH_NAMESPACE = 'HealthcareTranslation';

export const handler = async (
  event: APIGatewayProxyEvent | ScheduledEvent
): Promise<APIGatewayProxyResult | void> => {
  console.log('Service Monitor event:', JSON.stringify(event, null, 2));

  // Handle scheduled events (CloudWatch Events)
  if ('source' in event && event.source === 'aws.events') {
    return handleScheduledMonitoring(event as ScheduledEvent);
  }

  // Handle API Gateway events (WebSocket)
  return handleWebSocketMonitoring(event as APIGatewayProxyEvent);
};

async function handleScheduledMonitoring(event: ScheduledEvent): Promise<void> {
  try {
    console.log('Processing scheduled monitoring event');
    
    // Collect metrics from DynamoDB
    const serviceMetrics = await collectServiceMetrics();
    const healthMetrics = await collectHealthMetrics();
    
    // Send metrics to CloudWatch
    await sendMetricsToCloudWatch(serviceMetrics, healthMetrics);
    
    // Generate alerts if needed
    await checkAndGenerateAlerts(serviceMetrics, healthMetrics);
    
    console.log('Scheduled monitoring completed successfully');
  } catch (error) {
    console.error('Scheduled monitoring failed:', error);
    
    // Send error metric to CloudWatch
    await sendErrorMetricToCloudWatch('ScheduledMonitoring', error);
  }
}

async function handleWebSocketMonitoring(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const connectionId = event.requestContext.connectionId;
  const domainName = event.requestContext.domainName;
  const stage = event.requestContext.stage;
  
  if (!connectionId || !domainName || !stage) {
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Missing required request context' })
    };
  }
  
  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: `https://${domainName}/${stage}`
  });
  
  try {
    const body: MonitoringRequest = JSON.parse(event.body || '{}');
    const { action, requestId } = body;
    
    console.log(`Processing monitoring action: ${action} for connection: ${connectionId}`);
    
    let response: MonitoringResponse = { 
      success: true, 
      action: `${action}Response`,
      requestId 
    };
    
    switch (action) {
      case 'getServiceMetrics':
        response = await handleGetServiceMetrics(body);
        break;
      case 'getHealthStatus':
        response = await handleGetHealthStatus(body);
        break;
      case 'getPerformanceSummary':
        response = await handleGetPerformanceSummary(body);
        break;
      case 'getSystemOverview':
        response = await handleGetSystemOverview();
        break;
      default:
        response = { 
          success: false, 
          action: 'error', 
          error: `Unknown monitoring action: ${action}`,
          requestId 
        };
    }
    
    // Send response back to client
    await apiGateway.send(new PostToConnectionCommand({
      ConnectionId: connectionId,
      Data: JSON.stringify(response)
    }));
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Monitoring request processed successfully' })
    };
  } catch (error) {
    console.error('Monitoring processing error:', error);
    
    try {
      const errorResponse: MonitoringResponse = { 
        success: false, 
        action: 'monitoringError', 
        error: error instanceof Error ? error.message : 'Unknown monitoring error' 
      };
      
      await apiGateway.send(new PostToConnectionCommand({
        ConnectionId: connectionId,
        Data: JSON.stringify(errorResponse)
      }));
    } catch (sendError) {
      console.error('Failed to send monitoring error response:', sendError);
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ message: 'Failed to process monitoring request' })
    };
  }
}

async function collectServiceMetrics(): Promise<ServiceMetrics[]> {
  try {
    const sessionsTable = process.env.SESSIONS_TABLE || 'healthcare-translation-sessions';
    const metricsTable = process.env.METRICS_TABLE || 'healthcare-translation-metrics';
    
    // Get session data from the last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const sessionResult = await dynamodb.send(new ScanCommand({
      TableName: sessionsTable,
      FilterExpression: 'lastActivity >= :timestamp',
      ExpressionAttributeValues: {
        ':timestamp': { S: oneHourAgo }
      }
    }));
    
    // Process sessions by service type
    const serviceStats = new Map<string, {
      total: number;
      successful: number;
      failed: number;
      latencies: number[];
    }>();
    
    sessionResult.Items?.forEach(item => {
      const status = item.status?.S || 'unknown';
      const serviceType = item.serviceType?.S || 'unknown';
      const latency = parseFloat(item.processingLatency?.N || '0');
      
      if (!serviceStats.has(serviceType)) {
        serviceStats.set(serviceType, {
          total: 0,
          successful: 0,
          failed: 0,
          latencies: []
        });
      }
      
      const stats = serviceStats.get(serviceType)!;
      stats.total++;
      
      if (status === 'completed' || status === 'active') {
        stats.successful++;
      } else if (status === 'error' || status === 'failed') {
        stats.failed++;
      }
      
      if (latency > 0) {
        stats.latencies.push(latency);
      }
    });
    
    // Convert to ServiceMetrics array
    const metrics: ServiceMetrics[] = [];
    
    serviceStats.forEach((stats, serviceType) => {
      const errorRate = stats.total > 0 ? (stats.failed / stats.total) * 100 : 0;
      const availability = stats.total > 0 ? (stats.successful / stats.total) * 100 : 100;
      const averageLatency = stats.latencies.length > 0 
        ? stats.latencies.reduce((sum, lat) => sum + lat, 0) / stats.latencies.length 
        : 0;
      
      // Calculate P95 latency
      const sortedLatencies = stats.latencies.sort((a, b) => a - b);
      const p95Index = Math.ceil(sortedLatencies.length * 0.95) - 1;
      const p95Latency = sortedLatencies.length > 0 ? sortedLatencies[Math.max(0, p95Index)] : 0;
      
      metrics.push({
        serviceType,
        totalRequests: stats.total,
        successfulRequests: stats.successful,
        failedRequests: stats.failed,
        averageLatency,
        p95Latency,
        errorRate,
        availability,
        timestamp: new Date().toISOString()
      });
    });
    
    return metrics;
  } catch (error) {
    console.error('Failed to collect service metrics:', error);
    return [];
  }
}

async function collectHealthMetrics(): Promise<HealthCheckMetrics[]> {
  try {
    const healthTable = process.env.HEALTH_TABLE || 'healthcare-translation-health';
    
    // Get latest health check results for each service
    const healthResult = await dynamodb.send(new ScanCommand({
      TableName: healthTable
    }));
    
    const healthMetrics: HealthCheckMetrics[] = [];
    
    healthResult.Items?.forEach(item => {
      const serviceType = item.serviceType?.S || 'unknown';
      const isHealthy = item.isHealthy?.BOOL || false;
      const responseTime = parseFloat(item.responseTime?.N || '0');
      const consecutiveFailures = parseInt(item.consecutiveFailures?.N || '0');
      const lastError = item.lastError?.S;
      const timestamp = item.timestamp?.S || new Date().toISOString();
      
      healthMetrics.push({
        serviceType,
        isHealthy,
        responseTime,
        consecutiveFailures,
        lastError,
        timestamp
      });
    });
    
    return healthMetrics;
  } catch (error) {
    console.error('Failed to collect health metrics:', error);
    return [];
  }
}

async function sendMetricsToCloudWatch(
  serviceMetrics: ServiceMetrics[],
  healthMetrics: HealthCheckMetrics[]
): Promise<void> {
  try {
    const metricData: MetricDatum[] = [];
    
    // Service performance metrics
    serviceMetrics.forEach(metric => {
      metricData.push(
        {
          MetricName: 'TotalRequests',
          Value: metric.totalRequests,
          Unit: 'Count',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'SuccessfulRequests',
          Value: metric.successfulRequests,
          Unit: 'Count',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'FailedRequests',
          Value: metric.failedRequests,
          Unit: 'Count',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'AverageLatency',
          Value: metric.averageLatency,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'P95Latency',
          Value: metric.p95Latency,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'ErrorRate',
          Value: metric.errorRate,
          Unit: 'Percent',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'Availability',
          Value: metric.availability,
          Unit: 'Percent',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        }
      );
    });
    
    // Health check metrics
    healthMetrics.forEach(metric => {
      metricData.push(
        {
          MetricName: 'ServiceHealth',
          Value: metric.isHealthy ? 1 : 0,
          Unit: 'Count',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'HealthCheckResponseTime',
          Value: metric.responseTime,
          Unit: 'Milliseconds',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        },
        {
          MetricName: 'ConsecutiveFailures',
          Value: metric.consecutiveFailures,
          Unit: 'Count',
          Dimensions: [
            { Name: 'ServiceType', Value: metric.serviceType }
          ],
          Timestamp: new Date(metric.timestamp)
        }
      );
    });
    
    // Send metrics in batches (CloudWatch limit is 20 metrics per request)
    const batchSize = 20;
    for (let i = 0; i < metricData.length; i += batchSize) {
      const batch = metricData.slice(i, i + batchSize);
      
      await cloudwatch.send(new PutMetricDataCommand({
        Namespace: CLOUDWATCH_NAMESPACE,
        MetricData: batch
      }));
    }
    
    console.log(`Sent ${metricData.length} metrics to CloudWatch`);
  } catch (error) {
    console.error('Failed to send metrics to CloudWatch:', error);
    throw error;
  }
}

async function checkAndGenerateAlerts(
  serviceMetrics: ServiceMetrics[],
  healthMetrics: HealthCheckMetrics[]
): Promise<void> {
  try {
    const alerts: string[] = [];
    
    // Check service performance thresholds
    serviceMetrics.forEach(metric => {
      if (metric.errorRate > 10) {
        alerts.push(`High error rate for ${metric.serviceType}: ${metric.errorRate.toFixed(2)}%`);
      }
      
      if (metric.availability < 95) {
        alerts.push(`Low availability for ${metric.serviceType}: ${metric.availability.toFixed(2)}%`);
      }
      
      if (metric.averageLatency > 5000) {
        alerts.push(`High latency for ${metric.serviceType}: ${metric.averageLatency.toFixed(2)}ms`);
      }
    });
    
    // Check health status
    healthMetrics.forEach(metric => {
      if (!metric.isHealthy) {
        alerts.push(`Service unhealthy: ${metric.serviceType} (${metric.consecutiveFailures} consecutive failures)`);
      }
      
      if (metric.responseTime > 10000) {
        alerts.push(`Slow health check for ${metric.serviceType}: ${metric.responseTime.toFixed(2)}ms`);
      }
    });
    
    // Send alerts if any
    if (alerts.length > 0) {
      console.log('Generated alerts:', alerts);
      
      // In a real implementation, this would send alerts via SNS, email, etc.
      await sendAlertsToCloudWatch(alerts);
    }
  } catch (error) {
    console.error('Failed to check and generate alerts:', error);
  }
}

async function sendAlertsToCloudWatch(alerts: string[]): Promise<void> {
  try {
    const metricData: MetricDatum[] = alerts.map(alert => ({
      MetricName: 'SystemAlert',
      Value: 1,
      Unit: 'Count',
      Dimensions: [
        { Name: 'AlertType', Value: 'Performance' }
      ],
      Timestamp: new Date()
    }));
    
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: CLOUDWATCH_NAMESPACE,
      MetricData: metricData
    }));
    
    console.log(`Sent ${alerts.length} alerts to CloudWatch`);
  } catch (error) {
    console.error('Failed to send alerts to CloudWatch:', error);
  }
}

async function sendErrorMetricToCloudWatch(operation: string, error: any): Promise<void> {
  try {
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: CLOUDWATCH_NAMESPACE,
      MetricData: [{
        MetricName: 'MonitoringError',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'Operation', Value: operation }
        ],
        Timestamp: new Date()
      }]
    }));
  } catch (cwError) {
    console.error('Failed to send error metric to CloudWatch:', cwError);
  }
}

async function handleGetServiceMetrics(request: MonitoringRequest): Promise<MonitoringResponse> {
  try {
    const metrics = await collectServiceMetrics();
    
    let filteredMetrics = metrics;
    if (request.serviceType) {
      filteredMetrics = metrics.filter(m => m.serviceType === request.serviceType);
    }
    
    return {
      success: true,
      action: 'serviceMetricsResponse',
      data: {
        metrics: filteredMetrics,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      action: 'serviceMetricsError',
      error: error instanceof Error ? error.message : 'Failed to get service metrics'
    };
  }
}

async function handleGetHealthStatus(request: MonitoringRequest): Promise<MonitoringResponse> {
  try {
    const healthMetrics = await collectHealthMetrics();
    
    let filteredHealth = healthMetrics;
    if (request.serviceType) {
      filteredHealth = healthMetrics.filter(h => h.serviceType === request.serviceType);
    }
    
    return {
      success: true,
      action: 'healthStatusResponse',
      data: {
        healthMetrics: filteredHealth,
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      action: 'healthStatusError',
      error: error instanceof Error ? error.message : 'Failed to get health status'
    };
  }
}

async function handleGetPerformanceSummary(request: MonitoringRequest): Promise<MonitoringResponse> {
  try {
    const serviceMetrics = await collectServiceMetrics();
    const healthMetrics = await collectHealthMetrics();
    
    // Calculate overall system performance
    const totalRequests = serviceMetrics.reduce((sum, m) => sum + m.totalRequests, 0);
    const totalErrors = serviceMetrics.reduce((sum, m) => sum + m.failedRequests, 0);
    const overallErrorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;
    
    const healthyServices = healthMetrics.filter(h => h.isHealthy).length;
    const totalServices = healthMetrics.length;
    const systemHealth = totalServices > 0 ? (healthyServices / totalServices) * 100 : 100;
    
    return {
      success: true,
      action: 'performanceSummaryResponse',
      data: {
        summary: {
          totalRequests,
          overallErrorRate,
          systemHealth,
          healthyServices,
          totalServices,
          serviceMetrics,
          healthMetrics
        },
        timestamp: new Date().toISOString()
      }
    };
  } catch (error) {
    return {
      success: false,
      action: 'performanceSummaryError',
      error: error instanceof Error ? error.message : 'Failed to get performance summary'
    };
  }
}

async function handleGetSystemOverview(): Promise<MonitoringResponse> {
  try {
    const serviceMetrics = await collectServiceMetrics();
    const healthMetrics = await collectHealthMetrics();
    
    // Create system overview
    const overview = {
      services: serviceMetrics.map(metric => {
        const health = healthMetrics.find(h => h.serviceType === metric.serviceType);
        return {
          serviceType: metric.serviceType,
          isHealthy: health?.isHealthy || false,
          availability: metric.availability,
          errorRate: metric.errorRate,
          averageLatency: metric.averageLatency,
          totalRequests: metric.totalRequests,
          lastCheck: health?.timestamp || metric.timestamp
        };
      }),
      systemStatus: {
        overallHealth: healthMetrics.filter(h => h.isHealthy).length / Math.max(healthMetrics.length, 1) * 100,
        totalServices: healthMetrics.length,
        healthyServices: healthMetrics.filter(h => h.isHealthy).length,
        criticalIssues: healthMetrics.filter(h => !h.isHealthy && h.consecutiveFailures >= 3).length
      },
      timestamp: new Date().toISOString()
    };
    
    return {
      success: true,
      action: 'systemOverviewResponse',
      data: overview
    };
  } catch (error) {
    return {
      success: false,
      action: 'systemOverviewError',
      error: error instanceof Error ? error.message : 'Failed to get system overview'
    };
  }
}