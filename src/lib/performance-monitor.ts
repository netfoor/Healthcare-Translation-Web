/**
 * Performance Monitoring System
 * Tracks performance metrics, latency, and user experience metrics
 */

import { ServiceType } from './error-handling';
import { secureLogger, LogLevel } from './secure-logger';
import { debugLog } from './aws-utils';

// Performance metric types
export enum MetricType {
  LATENCY = 'LATENCY',
  THROUGHPUT = 'THROUGHPUT',
  ERROR_RATE = 'ERROR_RATE',
  SUCCESS_RATE = 'SUCCESS_RATE',
  AVAILABILITY = 'AVAILABILITY',
  RESPONSE_TIME = 'RESPONSE_TIME',
  QUEUE_SIZE = 'QUEUE_SIZE',
  MEMORY_USAGE = 'MEMORY_USAGE',
  CPU_USAGE = 'CPU_USAGE'
}

// Performance metric data structure
export interface PerformanceMetric {
  id: string;
  timestamp: Date;
  serviceType: ServiceType;
  metricType: MetricType;
  value: number;
  unit: string;
  tags?: Record<string, string>;
  sessionId?: string;
  correlationId?: string;
}

// Performance threshold configuration
export interface PerformanceThreshold {
  metricType: MetricType;
  serviceType: ServiceType;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
}

// Performance summary for a service
export interface ServicePerformanceSummary {
  serviceType: ServiceType;
  period: {
    start: Date;
    end: Date;
  };
  metrics: {
    averageLatency: number;
    p95Latency: number;
    p99Latency: number;
    errorRate: number;
    successRate: number;
    throughput: number;
    availability: number;
  };
  thresholdViolations: number;
  healthScore: number; // 0-100
}

// Real-time transcription performance metrics
export interface TranscriptionPerformanceMetrics {
  audioProcessingLatency: number;
  transcriptionAccuracy: number;
  wordErrorRate: number;
  realTimeRatio: number; // How much faster than real-time
  bufferUnderruns: number;
  networkJitter: number;
}

// User experience metrics
export interface UserExperienceMetrics {
  pageLoadTime: number;
  timeToFirstTranscript: number;
  timeToFirstTranslation: number;
  audioStartupTime: number;
  translationLatency: number;
  errorRecoveryTime: number;
  sessionDuration: number;
  userSatisfactionScore?: number;
}

/**
 * Performance Monitor Class
 */
export class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetricsBuffer = 10000;
  private thresholds: PerformanceThreshold[] = [];
  private activeTimers: Map<string, number> = new Map();
  private performanceSummaries: Map<ServiceType, ServicePerformanceSummary> = new Map();

  constructor() {
    this.initializeThresholds();
    this.startPeriodicReporting();
  }

  /**
   * Start timing an operation
   */
  startTimer(operationId: string, serviceType: ServiceType, operation: string): void {
    const timerId = `${serviceType}_${operationId}_${operation}`;
    this.activeTimers.set(timerId, performance.now());
    
    debugLog(`Started timer for ${operation}`, {
      operationId,
      serviceType,
      timerId
    });
  }

  /**
   * End timing an operation and record latency
   */
  endTimer(
    operationId: string, 
    serviceType: ServiceType, 
    operation: string,
    tags?: Record<string, string>
  ): number {
    const timerId = `${serviceType}_${operationId}_${operation}`;
    const startTime = this.activeTimers.get(timerId);
    
    if (!startTime) {
      console.warn(`Timer not found for ${timerId}`);
      return 0;
    }

    const duration = performance.now() - startTime;
    this.activeTimers.delete(timerId);

    // Record latency metric
    this.recordMetric({
      id: this.generateMetricId(),
      timestamp: new Date(),
      serviceType,
      metricType: MetricType.LATENCY,
      value: duration,
      unit: 'ms',
      tags: {
        operation,
        operationId,
        ...tags
      }
    });

    debugLog(`Completed ${operation} in ${duration.toFixed(2)}ms`, {
      operationId,
      serviceType,
      duration
    });

    return duration;
  }

  /**
   * Record a performance metric
   */
  recordMetric(metric: PerformanceMetric): void {
    this.metrics.push(metric);

    // Maintain buffer size
    if (this.metrics.length > this.maxMetricsBuffer) {
      this.metrics.shift();
    }

    // Check thresholds
    this.checkThresholds(metric);

    // Log significant metrics
    if (this.isSignificantMetric(metric)) {
      secureLogger.logInfo(
        metric.serviceType,
        `Performance metric recorded: ${metric.metricType}`,
        {
          value: metric.value,
          unit: metric.unit,
          tags: metric.tags
        }
      );
    }
  }

  /**
   * Record transcription-specific performance metrics
   */
  recordTranscriptionMetrics(
    sessionId: string,
    metrics: Partial<TranscriptionPerformanceMetrics>
  ): void {
    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== undefined) {
        this.recordMetric({
          id: this.generateMetricId(),
          timestamp: new Date(),
          serviceType: ServiceType.TRANSCRIBE_MEDICAL,
          metricType: MetricType.LATENCY,
          value: value as number,
          unit: this.getUnitForTranscriptionMetric(key),
          tags: {
            metric: key,
            category: 'transcription'
          },
          sessionId
        });
      }
    });
  }

  /**
   * Record user experience metrics
   */
  recordUserExperienceMetrics(
    sessionId: string,
    metrics: Partial<UserExperienceMetrics>
  ): void {
    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== undefined) {
        this.recordMetric({
          id: this.generateMetricId(),
          timestamp: new Date(),
          serviceType: ServiceType.WEBSOCKET, // General UX metrics
          metricType: MetricType.RESPONSE_TIME,
          value: value as number,
          unit: this.getUnitForUXMetric(key),
          tags: {
            metric: key,
            category: 'user_experience'
          },
          sessionId
        });
      }
    });
  }

  /**
   * Record error rate for a service
   */
  recordErrorRate(serviceType: ServiceType, errorCount: number, totalRequests: number): void {
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
    
    this.recordMetric({
      id: this.generateMetricId(),
      timestamp: new Date(),
      serviceType,
      metricType: MetricType.ERROR_RATE,
      value: errorRate,
      unit: 'percent',
      tags: {
        errorCount: errorCount.toString(),
        totalRequests: totalRequests.toString()
      }
    });
  }

  /**
   * Record success rate for a service
   */
  recordSuccessRate(serviceType: ServiceType, successCount: number, totalRequests: number): void {
    const successRate = totalRequests > 0 ? (successCount / totalRequests) * 100 : 0;
    
    this.recordMetric({
      id: this.generateMetricId(),
      timestamp: new Date(),
      serviceType,
      metricType: MetricType.SUCCESS_RATE,
      value: successRate,
      unit: 'percent',
      tags: {
        successCount: successCount.toString(),
        totalRequests: totalRequests.toString()
      }
    });
  }

  /**
   * Record throughput for a service
   */
  recordThroughput(serviceType: ServiceType, requestCount: number, timeWindowMs: number): void {
    const throughput = (requestCount / timeWindowMs) * 1000; // requests per second
    
    this.recordMetric({
      id: this.generateMetricId(),
      timestamp: new Date(),
      serviceType,
      metricType: MetricType.THROUGHPUT,
      value: throughput,
      unit: 'rps',
      tags: {
        requestCount: requestCount.toString(),
        timeWindow: timeWindowMs.toString()
      }
    });
  }

  /**
   * Get performance summary for a service
   */
  getServicePerformanceSummary(
    serviceType: ServiceType,
    periodMinutes: number = 60
  ): ServicePerformanceSummary {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (periodMinutes * 60 * 1000));
    
    const serviceMetrics = this.metrics.filter(
      m => m.serviceType === serviceType && 
           m.timestamp >= startTime && 
           m.timestamp <= endTime
    );

    const latencyMetrics = serviceMetrics.filter(m => m.metricType === MetricType.LATENCY);
    const errorRateMetrics = serviceMetrics.filter(m => m.metricType === MetricType.ERROR_RATE);
    const successRateMetrics = serviceMetrics.filter(m => m.metricType === MetricType.SUCCESS_RATE);
    const throughputMetrics = serviceMetrics.filter(m => m.metricType === MetricType.THROUGHPUT);

    const summary: ServicePerformanceSummary = {
      serviceType,
      period: { start: startTime, end: endTime },
      metrics: {
        averageLatency: this.calculateAverage(latencyMetrics.map(m => m.value)),
        p95Latency: this.calculatePercentile(latencyMetrics.map(m => m.value), 95),
        p99Latency: this.calculatePercentile(latencyMetrics.map(m => m.value), 99),
        errorRate: this.calculateAverage(errorRateMetrics.map(m => m.value)),
        successRate: this.calculateAverage(successRateMetrics.map(m => m.value)),
        throughput: this.calculateAverage(throughputMetrics.map(m => m.value)),
        availability: this.calculateAvailability(serviceMetrics)
      },
      thresholdViolations: this.countThresholdViolations(serviceMetrics),
      healthScore: this.calculateHealthScore(serviceMetrics)
    };

    this.performanceSummaries.set(serviceType, summary);
    return summary;
  }

  /**
   * Get all service performance summaries
   */
  getAllServicePerformanceSummaries(periodMinutes: number = 60): Map<ServiceType, ServicePerformanceSummary> {
    const summaries = new Map<ServiceType, ServicePerformanceSummary>();
    
    Object.values(ServiceType).forEach(serviceType => {
      summaries.set(serviceType, this.getServicePerformanceSummary(serviceType, periodMinutes));
    });
    
    return summaries;
  }

  /**
   * Get recent metrics for a service
   */
  getRecentMetrics(
    serviceType: ServiceType,
    metricType?: MetricType,
    count: number = 100
  ): PerformanceMetric[] {
    let filtered = this.metrics.filter(m => m.serviceType === serviceType);
    
    if (metricType) {
      filtered = filtered.filter(m => m.metricType === metricType);
    }
    
    return filtered
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);
  }

  /**
   * Clear metrics buffer
   */
  clearMetrics(): void {
    this.metrics = [];
    this.performanceSummaries.clear();
  }

  /**
   * Export metrics for external monitoring systems
   */
  exportMetrics(format: 'json' | 'prometheus' = 'json'): string {
    if (format === 'prometheus') {
      return this.exportPrometheusFormat();
    }
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      metrics: this.metrics.slice(-1000), // Last 1000 metrics
      summaries: Object.fromEntries(this.performanceSummaries)
    }, null, 2);
  }

  /**
   * Private Methods
   */

  private initializeThresholds(): void {
    this.thresholds = [
      // Transcription latency thresholds
      {
        metricType: MetricType.LATENCY,
        serviceType: ServiceType.TRANSCRIBE_MEDICAL,
        warningThreshold: 2000, // 2 seconds
        criticalThreshold: 5000, // 5 seconds
        unit: 'ms'
      },
      {
        metricType: MetricType.LATENCY,
        serviceType: ServiceType.TRANSLATE,
        warningThreshold: 1000, // 1 second
        criticalThreshold: 3000, // 3 seconds
        unit: 'ms'
      },
      {
        metricType: MetricType.LATENCY,
        serviceType: ServiceType.POLLY,
        warningThreshold: 1500, // 1.5 seconds
        criticalThreshold: 4000, // 4 seconds
        unit: 'ms'
      },
      // Error rate thresholds
      {
        metricType: MetricType.ERROR_RATE,
        serviceType: ServiceType.TRANSCRIBE_MEDICAL,
        warningThreshold: 5, // 5%
        criticalThreshold: 15, // 15%
        unit: 'percent'
      },
      // WebSocket latency thresholds
      {
        metricType: MetricType.LATENCY,
        serviceType: ServiceType.WEBSOCKET,
        warningThreshold: 500, // 500ms
        criticalThreshold: 2000, // 2 seconds
        unit: 'ms'
      }
    ];
  }

  private checkThresholds(metric: PerformanceMetric): void {
    const threshold = this.thresholds.find(
      t => t.metricType === metric.metricType && t.serviceType === metric.serviceType
    );

    if (!threshold) return;

    if (metric.value >= threshold.criticalThreshold) {
      secureLogger.logCritical(
        metric.serviceType,
        `Critical performance threshold exceeded: ${metric.metricType}`,
        {
          value: metric.value,
          threshold: threshold.criticalThreshold,
          unit: metric.unit,
          tags: metric.tags
        }
      );
    } else if (metric.value >= threshold.warningThreshold) {
      secureLogger.logWarning(
        metric.serviceType,
        `Warning performance threshold exceeded: ${metric.metricType}`,
        {
          value: metric.value,
          threshold: threshold.warningThreshold,
          unit: metric.unit,
          tags: metric.tags
        }
      );
    }
  }

  private isSignificantMetric(metric: PerformanceMetric): boolean {
    // Log latency metrics over 1 second
    if (metric.metricType === MetricType.LATENCY && metric.value > 1000) {
      return true;
    }
    
    // Log error rates over 1%
    if (metric.metricType === MetricType.ERROR_RATE && metric.value > 1) {
      return true;
    }
    
    // Log all critical service metrics
    const criticalServices = [ServiceType.TRANSCRIBE_MEDICAL, ServiceType.WEBSOCKET];
    if (criticalServices.includes(metric.serviceType)) {
      return true;
    }
    
    return false;
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = values.sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  }

  private calculateAvailability(metrics: PerformanceMetric[]): number {
    const errorMetrics = metrics.filter(m => m.metricType === MetricType.ERROR_RATE);
    if (errorMetrics.length === 0) return 100;
    
    const avgErrorRate = this.calculateAverage(errorMetrics.map(m => m.value));
    return Math.max(0, 100 - avgErrorRate);
  }

  private countThresholdViolations(metrics: PerformanceMetric[]): number {
    return metrics.filter(metric => {
      const threshold = this.thresholds.find(
        t => t.metricType === metric.metricType && t.serviceType === metric.serviceType
      );
      return threshold && metric.value >= threshold.warningThreshold;
    }).length;
  }

  private calculateHealthScore(metrics: PerformanceMetric[]): number {
    if (metrics.length === 0) return 100;
    
    const violations = this.countThresholdViolations(metrics);
    const violationRate = violations / metrics.length;
    
    // Health score decreases with violation rate
    return Math.max(0, Math.round(100 - (violationRate * 100)));
  }

  private getUnitForTranscriptionMetric(metric: string): string {
    const units: Record<string, string> = {
      audioProcessingLatency: 'ms',
      transcriptionAccuracy: 'percent',
      wordErrorRate: 'percent',
      realTimeRatio: 'ratio',
      bufferUnderruns: 'count',
      networkJitter: 'ms'
    };
    return units[metric] || 'unknown';
  }

  private getUnitForUXMetric(metric: string): string {
    const units: Record<string, string> = {
      pageLoadTime: 'ms',
      timeToFirstTranscript: 'ms',
      timeToFirstTranslation: 'ms',
      audioStartupTime: 'ms',
      translationLatency: 'ms',
      errorRecoveryTime: 'ms',
      sessionDuration: 'ms',
      userSatisfactionScore: 'score'
    };
    return units[metric] || 'ms';
  }

  private generateMetricId(): string {
    return `metric_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private exportPrometheusFormat(): string {
    const lines: string[] = [];
    
    // Group metrics by type and service
    const groupedMetrics = new Map<string, PerformanceMetric[]>();
    
    this.metrics.forEach(metric => {
      const key = `${metric.metricType}_${metric.serviceType}`;
      if (!groupedMetrics.has(key)) {
        groupedMetrics.set(key, []);
      }
      groupedMetrics.get(key)!.push(metric);
    });
    
    // Export in Prometheus format
    groupedMetrics.forEach((metrics, key) => {
      const metricName = `healthcare_translation_${key.toLowerCase()}`;
      lines.push(`# HELP ${metricName} Performance metric for healthcare translation`);
      lines.push(`# TYPE ${metricName} gauge`);
      
      metrics.slice(-10).forEach(metric => { // Last 10 metrics per type
        const labels = Object.entries(metric.tags || {})
          .map(([k, v]) => `${k}="${v}"`)
          .join(',');
        
        lines.push(`${metricName}{service="${metric.serviceType}",${labels}} ${metric.value}`);
      });
    });
    
    return lines.join('\n');
  }

  private startPeriodicReporting(): void {
    // Report performance summaries every 5 minutes
    setInterval(() => {
      const summaries = this.getAllServicePerformanceSummaries(5);
      
      summaries.forEach((summary, serviceType) => {
        secureLogger.logInfo(
          serviceType,
          'Performance summary',
          {
            averageLatency: summary.metrics.averageLatency,
            errorRate: summary.metrics.errorRate,
            healthScore: summary.healthScore,
            thresholdViolations: summary.thresholdViolations
          }
        );
      });
    }, 5 * 60 * 1000); // 5 minutes
  }
}

// Global performance monitor instance
export const globalPerformanceMonitor = new PerformanceMonitor();

/**
 * Convenience functions for performance monitoring
 */

export function startPerformanceTimer(
  operationId: string,
  serviceType: ServiceType,
  operation: string
): void {
  globalPerformanceMonitor.startTimer(operationId, serviceType, operation);
}

export function endPerformanceTimer(
  operationId: string,
  serviceType: ServiceType,
  operation: string,
  tags?: Record<string, string>
): number {
  return globalPerformanceMonitor.endTimer(operationId, serviceType, operation, tags);
}

export function recordPerformanceMetric(metric: PerformanceMetric): void {
  globalPerformanceMonitor.recordMetric(metric);
}

export function getServicePerformance(serviceType: ServiceType): ServicePerformanceSummary {
  return globalPerformanceMonitor.getServicePerformanceSummary(serviceType);
}