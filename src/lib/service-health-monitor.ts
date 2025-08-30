/**
 * Service Health Monitoring System
 * Monitors availability and health of all AWS services
 */

import { ServiceType, globalErrorHandler } from './error-handling';
import { globalPerformanceMonitor, MetricType } from './performance-monitor';
import { secureLogger } from './secure-logger';
import { debugLog } from './aws-utils';

// Health check status
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN'
}

// Health check result
export interface HealthCheckResult {
  serviceType: ServiceType;
  status: HealthStatus;
  responseTime: number;
  timestamp: Date;
  message: string;
  details?: Record<string, unknown>;
  error?: string;
}

// Service health configuration
export interface ServiceHealthConfig {
  serviceType: ServiceType;
  checkInterval: number; // milliseconds
  timeout: number; // milliseconds
  retryCount: number;
  healthyThreshold: number; // consecutive successful checks
  unhealthyThreshold: number; // consecutive failed checks
  enabled: boolean;
}

// Overall system health status
export interface SystemHealthStatus {
  overallStatus: HealthStatus;
  timestamp: Date;
  services: Map<ServiceType, HealthCheckResult>;
  criticalServicesHealthy: boolean;
  degradedServices: ServiceType[];
  unhealthyServices: ServiceType[];
  healthScore: number; // 0-100
}

/**
 * Service Health Monitor Class
 */
export class ServiceHealthMonitor {
  private healthConfigs: Map<ServiceType, ServiceHealthConfig> = new Map();
  private healthResults: Map<ServiceType, HealthCheckResult> = new Map();
  private healthHistory: Map<ServiceType, HealthCheckResult[]> = new Map();
  private consecutiveFailures: Map<ServiceType, number> = new Map();
  private consecutiveSuccesses: Map<ServiceType, number> = new Map();
  private healthCheckIntervals: Map<ServiceType, NodeJS.Timeout> = new Map();
  private isMonitoring = false;

  constructor() {
    this.initializeHealthConfigs();
  }

  /**
   * Start health monitoring for all services
   */
  startMonitoring(): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    
    this.healthConfigs.forEach((config, serviceType) => {
      if (config.enabled) {
        this.startServiceHealthCheck(serviceType);
      }
    });

    secureLogger.logInfo(
      ServiceType.WEBSOCKET,
      'Service health monitoring started',
      { enabledServices: Array.from(this.healthConfigs.keys()) }
    );
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring(): void {
    this.isMonitoring = false;
    
    this.healthCheckIntervals.forEach((interval, serviceType) => {
      clearInterval(interval);
    });
    
    this.healthCheckIntervals.clear();
    
    secureLogger.logInfo(
      ServiceType.WEBSOCKET,
      'Service health monitoring stopped'
    );
  }

  /**
   * Perform immediate health check for a service
   */
  async checkServiceHealth(serviceType: ServiceType): Promise<HealthCheckResult> {
    const config = this.healthConfigs.get(serviceType);
    if (!config) {
      return {
        serviceType,
        status: HealthStatus.UNKNOWN,
        responseTime: 0,
        timestamp: new Date(),
        message: 'Health check not configured for this service'
      };
    }

    const startTime = performance.now();
    
    try {
      const result = await this.performHealthCheck(serviceType, config);
      const responseTime = performance.now() - startTime;
      
      const healthResult: HealthCheckResult = {
        serviceType,
        status: result.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        message: result.message,
        details: result.details,
        error: result.error
      };

      this.updateHealthResult(healthResult);
      return healthResult;
    } catch (error) {
      const responseTime = performance.now() - startTime;
      
      const healthResult: HealthCheckResult = {
        serviceType,
        status: HealthStatus.UNHEALTHY,
        responseTime,
        timestamp: new Date(),
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };

      this.updateHealthResult(healthResult);
      return healthResult;
    }
  }

  /**
   * Get current health status for a service
   */
  getServiceHealth(serviceType: ServiceType): HealthCheckResult | undefined {
    return this.healthResults.get(serviceType);
  }

  /**
   * Get overall system health status
   */
  getSystemHealth(): SystemHealthStatus {
    const services = new Map(this.healthResults);
    const criticalServices = [
      ServiceType.TRANSCRIBE_MEDICAL,
      ServiceType.WEBSOCKET,
      ServiceType.COGNITO
    ];

    const healthyServices = Array.from(services.values()).filter(
      result => result.status === HealthStatus.HEALTHY
    );
    
    const degradedServices = Array.from(services.values())
      .filter(result => result.status === HealthStatus.DEGRADED)
      .map(result => result.serviceType);
    
    const unhealthyServices = Array.from(services.values())
      .filter(result => result.status === HealthStatus.UNHEALTHY)
      .map(result => result.serviceType);

    const criticalServicesHealthy = criticalServices.every(serviceType => {
      const result = services.get(serviceType);
      return result && result.status === HealthStatus.HEALTHY;
    });

    // Calculate overall status
    let overallStatus = HealthStatus.HEALTHY;
    if (unhealthyServices.length > 0) {
      const criticalUnhealthy = unhealthyServices.some(service => 
        criticalServices.includes(service)
      );
      overallStatus = criticalUnhealthy ? HealthStatus.UNHEALTHY : HealthStatus.DEGRADED;
    } else if (degradedServices.length > 0) {
      overallStatus = HealthStatus.DEGRADED;
    }

    // Calculate health score
    const totalServices = services.size;
    const healthScore = totalServices > 0 
      ? Math.round((healthyServices.length / totalServices) * 100)
      : 100;

    return {
      overallStatus,
      timestamp: new Date(),
      services,
      criticalServicesHealthy,
      degradedServices,
      unhealthyServices,
      healthScore
    };
  }

  /**
   * Get health history for a service
   */
  getServiceHealthHistory(
    serviceType: ServiceType,
    limit: number = 50
  ): HealthCheckResult[] {
    const history = this.healthHistory.get(serviceType) || [];
    return history.slice(-limit);
  }

  /**
   * Enable/disable health monitoring for a service
   */
  setServiceMonitoring(serviceType: ServiceType, enabled: boolean): void {
    const config = this.healthConfigs.get(serviceType);
    if (config) {
      config.enabled = enabled;
      
      if (enabled && this.isMonitoring) {
        this.startServiceHealthCheck(serviceType);
      } else {
        this.stopServiceHealthCheck(serviceType);
      }
    }
  }

  /**
   * Update health check configuration for a service
   */
  updateServiceConfig(serviceType: ServiceType, updates: Partial<ServiceHealthConfig>): void {
    const config = this.healthConfigs.get(serviceType);
    if (config) {
      Object.assign(config, updates);
      
      // Restart health check with new config
      if (config.enabled && this.isMonitoring) {
        this.stopServiceHealthCheck(serviceType);
        this.startServiceHealthCheck(serviceType);
      }
    }
  }

  /**
   * Private Methods
   */

  private initializeHealthConfigs(): void {
    const defaultConfig = {
      checkInterval: 60000, // 1 minute
      timeout: 10000, // 10 seconds
      retryCount: 2,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
      enabled: true
    };

    // Service-specific configurations
    const serviceConfigs: Record<ServiceType, Partial<ServiceHealthConfig>> = {
      [ServiceType.TRANSCRIBE_MEDICAL]: {
        checkInterval: 30000, // 30 seconds (critical service)
        timeout: 5000,
        unhealthyThreshold: 2
      },
      [ServiceType.TRANSCRIBE_STANDARD]: {
        checkInterval: 60000,
        timeout: 5000
      },
      [ServiceType.WEBSOCKET]: {
        checkInterval: 15000, // 15 seconds (critical service)
        timeout: 3000,
        unhealthyThreshold: 2
      },
      [ServiceType.TRANSLATE]: {
        checkInterval: 45000,
        timeout: 8000
      },
      [ServiceType.POLLY]: {
        checkInterval: 60000,
        timeout: 8000
      },
      [ServiceType.BEDROCK]: {
        checkInterval: 120000, // 2 minutes (less critical)
        timeout: 15000
      },
      [ServiceType.COGNITO]: {
        checkInterval: 300000, // 5 minutes
        timeout: 10000
      },
      [ServiceType.DYNAMODB]: {
        checkInterval: 60000,
        timeout: 5000
      },
      [ServiceType.S3]: {
        checkInterval: 120000,
        timeout: 10000
      }
    };

    Object.values(ServiceType).forEach(serviceType => {
      const config: ServiceHealthConfig = {
        serviceType,
        ...defaultConfig,
        ...serviceConfigs[serviceType]
      };
      
      this.healthConfigs.set(serviceType, config);
      this.consecutiveFailures.set(serviceType, 0);
      this.consecutiveSuccesses.set(serviceType, 0);
      this.healthHistory.set(serviceType, []);
    });
  }

  private startServiceHealthCheck(serviceType: ServiceType): void {
    const config = this.healthConfigs.get(serviceType);
    if (!config || !config.enabled) return;

    // Stop existing interval if any
    this.stopServiceHealthCheck(serviceType);

    // Perform initial check
    this.checkServiceHealth(serviceType);

    // Set up periodic checks
    const interval = setInterval(() => {
      this.checkServiceHealth(serviceType);
    }, config.checkInterval);

    this.healthCheckIntervals.set(serviceType, interval);
    
    debugLog(`Started health monitoring for ${serviceType}`, {
      interval: config.checkInterval,
      timeout: config.timeout
    });
  }

  private stopServiceHealthCheck(serviceType: ServiceType): void {
    const interval = this.healthCheckIntervals.get(serviceType);
    if (interval) {
      clearInterval(interval);
      this.healthCheckIntervals.delete(serviceType);
    }
  }

  private async performHealthCheck(
    serviceType: ServiceType,
    config: ServiceHealthConfig
  ): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown>; error?: string }> {
    const timeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), config.timeout);
    });

    try {
      const healthCheckPromise = this.executeServiceHealthCheck(serviceType);
      const result = await Promise.race([healthCheckPromise, timeout]);
      return result as { healthy: boolean; message: string; details?: Record<string, unknown>; error?: string };
    } catch (error) {
      return {
        healthy: false,
        message: 'Health check failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async executeServiceHealthCheck(
    serviceType: ServiceType
  ): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    switch (serviceType) {
      case ServiceType.TRANSCRIBE_MEDICAL:
        return this.checkTranscribeMedicalHealth();
      
      case ServiceType.TRANSCRIBE_STANDARD:
        return this.checkTranscribeStandardHealth();
      
      case ServiceType.WEBSOCKET:
        return this.checkWebSocketHealth();
      
      case ServiceType.TRANSLATE:
        return this.checkTranslateHealth();
      
      case ServiceType.POLLY:
        return this.checkPollyHealth();
      
      case ServiceType.BEDROCK:
        return this.checkBedrockHealth();
      
      case ServiceType.COGNITO:
        return this.checkCognitoHealth();
      
      case ServiceType.DYNAMODB:
        return this.checkDynamoDBHealth();
      
      case ServiceType.S3:
        return this.checkS3Health();
      
      default:
        return {
          healthy: false,
          message: `Health check not implemented for ${serviceType}`
        };
    }
  }

  private async checkTranscribeMedicalHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      // In a real implementation, this would make a test call to Transcribe Medical
      // For now, we'll simulate based on error handler state
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.TRANSCRIBE_MEDICAL);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Transcribe Medical is healthy' : 'Transcribe Medical is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check Transcribe Medical health'
      };
    }
  }

  private async checkTranscribeStandardHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.TRANSCRIBE_STANDARD);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Transcribe Standard is healthy' : 'Transcribe Standard is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check Transcribe Standard health'
      };
    }
  }

  private async checkWebSocketHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      // Check if WebSocket endpoint is reachable
      const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_API_URL;
      if (!wsUrl) {
        return {
          healthy: false,
          message: 'WebSocket URL not configured'
        };
      }

      // In a real implementation, this would test WebSocket connectivity
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.WEBSOCKET);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'WebSocket service is healthy' : 'WebSocket service is experiencing issues',
        details: {
          endpoint: wsUrl,
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check WebSocket health'
      };
    }
  }

  private async checkTranslateHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.TRANSLATE);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Translate service is healthy' : 'Translate service is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check Translate health'
      };
    }
  }

  private async checkPollyHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.POLLY);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Polly service is healthy' : 'Polly service is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check Polly health'
      };
    }
  }

  private async checkBedrockHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.BEDROCK);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Bedrock service is healthy' : 'Bedrock service is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check Bedrock health'
      };
    }
  }

  private async checkCognitoHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.COGNITO);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'Cognito service is healthy' : 'Cognito service is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check Cognito health'
      };
    }
  }

  private async checkDynamoDBHealth(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.DYNAMODB);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'DynamoDB service is healthy' : 'DynamoDB service is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check DynamoDB health'
      };
    }
  }

  private async checkS3Health(): Promise<{ healthy: boolean; message: string; details?: Record<string, unknown> }> {
    try {
      const isHealthy = globalErrorHandler.isServiceHealthy(ServiceType.S3);
      
      return {
        healthy: isHealthy,
        message: isHealthy ? 'S3 service is healthy' : 'S3 service is experiencing issues',
        details: {
          serviceAvailable: isHealthy,
          lastCheck: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        healthy: false,
        message: 'Failed to check S3 health'
      };
    }
  }

  private updateHealthResult(result: HealthCheckResult): void {
    const config = this.healthConfigs.get(result.serviceType);
    if (!config) return;

    // Update current result
    this.healthResults.set(result.serviceType, result);

    // Update history
    const history = this.healthHistory.get(result.serviceType) || [];
    history.push(result);
    
    // Keep only last 100 results
    if (history.length > 100) {
      history.shift();
    }
    this.healthHistory.set(result.serviceType, history);

    // Update consecutive counters
    if (result.status === HealthStatus.HEALTHY) {
      this.consecutiveSuccesses.set(result.serviceType, 
        (this.consecutiveSuccesses.get(result.serviceType) || 0) + 1);
      this.consecutiveFailures.set(result.serviceType, 0);
    } else {
      this.consecutiveFailures.set(result.serviceType, 
        (this.consecutiveFailures.get(result.serviceType) || 0) + 1);
      this.consecutiveSuccesses.set(result.serviceType, 0);
    }

    // Record performance metric
    globalPerformanceMonitor.recordMetric({
      id: `health_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: result.timestamp,
      serviceType: result.serviceType,
      metricType: MetricType.AVAILABILITY,
      value: result.status === HealthStatus.HEALTHY ? 100 : 0,
      unit: 'percent',
      tags: {
        healthCheck: 'true',
        status: result.status
      }
    });

    // Log significant health changes
    const consecutiveFailures = this.consecutiveFailures.get(result.serviceType) || 0;
    const consecutiveSuccesses = this.consecutiveSuccesses.get(result.serviceType) || 0;

    if (consecutiveFailures >= config.unhealthyThreshold) {
      secureLogger.logCritical(
        result.serviceType,
        `Service marked as unhealthy after ${consecutiveFailures} consecutive failures`,
        {
          status: result.status,
          message: result.message,
          responseTime: result.responseTime
        }
      );
    } else if (consecutiveSuccesses >= config.healthyThreshold && consecutiveFailures > 0) {
      secureLogger.logInfo(
        result.serviceType,
        `Service recovered after ${consecutiveSuccesses} consecutive successful checks`,
        {
          status: result.status,
          message: result.message,
          responseTime: result.responseTime
        }
      );
    }
  }
}

// Global service health monitor instance
export const globalServiceHealthMonitor = new ServiceHealthMonitor();

/**
 * Convenience functions for health monitoring
 */

export function startHealthMonitoring(): void {
  globalServiceHealthMonitor.startMonitoring();
}

export function stopHealthMonitoring(): void {
  globalServiceHealthMonitor.stopMonitoring();
}

export function checkServiceHealth(serviceType: ServiceType): Promise<HealthCheckResult> {
  return globalServiceHealthMonitor.checkServiceHealth(serviceType);
}

export function getSystemHealth(): SystemHealthStatus {
  return globalServiceHealthMonitor.getSystemHealth();
}

export function getServiceHealth(serviceType: ServiceType): HealthCheckResult | undefined {
  return globalServiceHealthMonitor.getServiceHealth(serviceType);
}