'use client';

import React, { useState, useEffect } from 'react';
import { 
  ServiceType, 
  globalErrorHandler 
} from '@/lib/error-handling';
import { 
  globalPerformanceMonitor, 
  ServicePerformanceSummary 
} from '@/lib/performance-monitor';
import { 
  globalServiceHealthMonitor, 
  HealthStatus, 
  SystemHealthStatus 
} from '@/lib/service-health-monitor';

interface SystemMonitorProps {
  className?: string;
  showDetails?: boolean;
  refreshInterval?: number;
}

interface ServiceStatus {
  serviceType: ServiceType;
  displayName: string;
  status: HealthStatus;
  performance?: ServicePerformanceSummary;
  lastCheck: Date;
  errorCount: number;
  responseTime: number;
}

export function SystemMonitor({ 
  className = '', 
  showDetails = false,
  refreshInterval = 30000 
}: SystemMonitorProps) {
  const [systemHealth, setSystemHealth] = useState<SystemHealthStatus | null>(null);
  const [serviceStatuses, setServiceStatuses] = useState<ServiceStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  useEffect(() => {
    const updateMonitoringData = () => {
      try {
        // Get system health
        const health = globalServiceHealthMonitor.getSystemHealth();
        setSystemHealth(health);

        // Get service statuses
        const statuses: ServiceStatus[] = Object.values(ServiceType).map(serviceType => {
          const healthResult = globalServiceHealthMonitor.getServiceHealth(serviceType);
          const performance = globalPerformanceMonitor.getServicePerformanceSummary(serviceType, 60);
          const errorHandler = globalErrorHandler.getServiceHealth(serviceType);

          return {
            serviceType,
            displayName: getServiceDisplayName(serviceType),
            status: healthResult?.status || HealthStatus.UNKNOWN,
            performance,
            lastCheck: healthResult?.timestamp || new Date(),
            errorCount: errorHandler?.errorCount || 0,
            responseTime: healthResult?.responseTime || 0
          };
        });

        setServiceStatuses(statuses);
        setLastUpdate(new Date());
        setIsLoading(false);
      } catch (error) {
        console.error('Failed to update monitoring data:', error);
        setIsLoading(false);
      }
    };

    // Initial load
    updateMonitoringData();

    // Set up refresh interval
    const interval = setInterval(updateMonitoringData, refreshInterval);

    return () => clearInterval(interval);
  }, [refreshInterval]);

  const getServiceDisplayName = (serviceType: ServiceType): string => {
    const displayNames: Record<ServiceType, string> = {
      [ServiceType.TRANSCRIBE_MEDICAL]: 'Medical Transcription',
      [ServiceType.TRANSCRIBE_STANDARD]: 'Standard Transcription',
      [ServiceType.TRANSLATE]: 'Translation',
      [ServiceType.POLLY]: 'Text-to-Speech',
      [ServiceType.BEDROCK]: 'AI Enhancement',
      [ServiceType.WEBSOCKET]: 'Real-time Communication',
      [ServiceType.DYNAMODB]: 'Database',
      [ServiceType.S3]: 'File Storage',
      [ServiceType.COGNITO]: 'Authentication'
    };
    return displayNames[serviceType] || serviceType;
  };

  const getStatusColor = (status: HealthStatus): string => {
    switch (status) {
      case HealthStatus.HEALTHY:
        return 'text-green-600 bg-green-100';
      case HealthStatus.DEGRADED:
        return 'text-yellow-600 bg-yellow-100';
      case HealthStatus.UNHEALTHY:
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: HealthStatus): React.ReactElement => {
    switch (status) {
      case HealthStatus.HEALTHY:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        );
      case HealthStatus.DEGRADED:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        );
      case HealthStatus.UNHEALTHY:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg shadow p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow ${className}`}>
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-gray-900">System Status</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">
              Last updated: {lastUpdate.toLocaleTimeString()}
            </span>
            {systemHealth && (
              <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(systemHealth.overallStatus)}`}>
                {getStatusIcon(systemHealth.overallStatus)}
                <span className="ml-1">{systemHealth.overallStatus}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Overview */}
      {systemHealth && (
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">
                {systemHealth.healthScore}%
              </div>
              <div className="text-sm text-gray-500">Health Score</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {systemHealth.services.size - systemHealth.unhealthyServices.length}
              </div>
              <div className="text-sm text-gray-500">Healthy Services</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {systemHealth.degradedServices.length}
              </div>
              <div className="text-sm text-gray-500">Degraded Services</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {systemHealth.unhealthyServices.length}
              </div>
              <div className="text-sm text-gray-500">Unhealthy Services</div>
            </div>
          </div>
        </div>
      )}

      {/* Service List */}
      <div className="px-6 py-4">
        <div className="space-y-3">
          {serviceStatuses.map((service) => (
            <div
              key={service.serviceType}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(service.status)}`}>
                  {getStatusIcon(service.status)}
                  <span className="ml-1">{service.status}</span>
                </div>
                <div>
                  <div className="font-medium text-gray-900">
                    {service.displayName}
                  </div>
                  <div className="text-sm text-gray-500">
                    Last check: {service.lastCheck.toLocaleTimeString()}
                  </div>
                </div>
              </div>

              {showDetails && service.performance && (
                <div className="flex items-center space-x-6 text-sm">
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {service.performance.metrics.averageLatency.toFixed(0)}ms
                    </div>
                    <div className="text-gray-500">Avg Latency</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {service.performance.metrics.errorRate.toFixed(1)}%
                    </div>
                    <div className="text-gray-500">Error Rate</div>
                  </div>
                  <div className="text-center">
                    <div className="font-medium text-gray-900">
                      {service.performance.metrics.availability.toFixed(1)}%
                    </div>
                    <div className="text-gray-500">Availability</div>
                  </div>
                </div>
              )}

              {!showDetails && (
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  {service.responseTime > 0 && (
                    <span>{service.responseTime.toFixed(0)}ms</span>
                  )}
                  {service.errorCount > 0 && (
                    <span className="text-red-600">{service.errorCount} errors</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Critical Issues Alert */}
      {systemHealth && systemHealth.unhealthyServices.length > 0 && (
        <div className="px-6 py-4 border-t border-gray-200 bg-red-50">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-400 mr-2" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <div>
              <div className="font-medium text-red-800">
                Critical Issues Detected
              </div>
              <div className="text-sm text-red-700">
                {systemHealth.unhealthyServices.length} service(s) are currently unhealthy: {' '}
                {systemHealth.unhealthyServices.map(service => 
                  getServiceDisplayName(service)
                ).join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemMonitor;