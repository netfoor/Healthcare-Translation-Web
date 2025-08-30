/**
 * Comprehensive Error Handling System for Healthcare Translation App
 * Implements service-specific error handlers with fallback strategies
 * Includes PII redaction for healthcare compliance
 */

import { ServiceError } from './types';
import { sanitizeForLogging, debugLog } from './aws-utils';

// Error categories for different types of failures
export enum ErrorCategory {
  NETWORK = 'NETWORK',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  AUTHENTICATION = 'AUTHENTICATION',
  VALIDATION = 'VALIDATION',
  PERMISSION = 'PERMISSION',
  RATE_LIMIT = 'RATE_LIMIT',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

// Service types for error handling
export enum ServiceType {
  TRANSCRIBE_MEDICAL = 'TRANSCRIBE_MEDICAL',
  TRANSCRIBE_STANDARD = 'TRANSCRIBE_STANDARD',
  BEDROCK = 'BEDROCK',
  TRANSLATE = 'TRANSLATE',
  POLLY = 'POLLY',
  WEBSOCKET = 'WEBSOCKET',
  DYNAMODB = 'DYNAMODB',
  S3 = 'S3',
  COGNITO = 'COGNITO'
}

// Error severity levels
export enum ErrorSeverity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

// Enhanced service error interface
export interface EnhancedServiceError extends ServiceError {
  category: ErrorCategory;
  severity: ErrorSeverity;
  serviceType: ServiceType;
  context?: Record<string, unknown>;
  userMessage: string;
  technicalMessage: string;
  recoveryActions: string[];
  correlationId?: string;
}

// Retry configuration
export interface RetryConfig {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryableErrors: ErrorCategory[];
}

// Fallback strategy configuration
export interface FallbackStrategy {
  primaryService: ServiceType;
  fallbackService?: ServiceType;
  fallbackAction?: () => Promise<unknown>;
  errorThreshold: number;
  cooldownPeriod: number;
}

// Service health status
export interface ServiceHealth {
  service: ServiceType;
  isHealthy: boolean;
  lastCheck: Date;
  errorCount: number;
  consecutiveErrors: number;
  lastError?: EnhancedServiceError;
}

/**
 * Main Error Handler Class
 */
export class ErrorHandler {
  private serviceHealth: Map<ServiceType, ServiceHealth> = new Map();
  private fallbackStrategies: Map<ServiceType, FallbackStrategy> = new Map();
  private retryConfigs: Map<ServiceType, RetryConfig> = new Map();

  constructor() {
    this.initializeServiceHealth();
    this.initializeFallbackStrategies();
    this.initializeRetryConfigs();
  }

  /**
   * Handle an error with appropriate strategy
   */
  async handleError(
    error: Error | ServiceError,
    serviceType: ServiceType,
    context?: Record<string, unknown>
  ): Promise<EnhancedServiceError> {
    const enhancedError = this.enhanceError(error, serviceType, context);
    
    // Log error with PII redaction
    this.logError(enhancedError);
    
    // Update service health
    this.updateServiceHealth(serviceType, enhancedError);
    
    // Determine if fallback is needed
    if (this.shouldUseFallback(serviceType)) {
      await this.triggerFallback(serviceType, enhancedError);
    }
    
    return enhancedError;
  }

  /**
   * Execute operation with retry logic
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    serviceType: ServiceType,
    context?: Record<string, unknown>
  ): Promise<T> {
    const retryConfig = this.retryConfigs.get(serviceType) || this.getDefaultRetryConfig();
    let lastError: Error;
    let delay = retryConfig.initialDelay;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await operation();
        
        // Reset service health on success
        this.markServiceHealthy(serviceType);
        
        return result;
      } catch (error) {
        lastError = error as Error;
        const enhancedError = await this.handleError(lastError, serviceType, {
          ...context,
          attempt: attempt + 1,
          maxRetries: retryConfig.maxRetries
        });

        // Check if error is retryable
        if (attempt === retryConfig.maxRetries || !this.isRetryableError(enhancedError)) {
          throw enhancedError;
        }

        // Wait before retry with exponential backoff
        await this.delay(Math.min(delay, retryConfig.maxDelay));
        delay *= retryConfig.backoffMultiplier;
        
        debugLog(`Retrying operation for ${serviceType}`, {
          attempt: attempt + 1,
          delay,
          error: enhancedError.message
        });
      }
    }

    throw lastError!;
  }

  /**
   * Get user-friendly error message
   */
  getUserMessage(error: EnhancedServiceError): string {
    return error.userMessage;
  }

  /**
   * Get recovery actions for an error
   */
  getRecoveryActions(error: EnhancedServiceError): string[] {
    return error.recoveryActions;
  }

  /**
   * Check if service is healthy
   */
  isServiceHealthy(serviceType: ServiceType): boolean {
    const health = this.serviceHealth.get(serviceType);
    return health?.isHealthy ?? true;
  }

  /**
   * Get service health status
   */
  getServiceHealth(serviceType: ServiceType): ServiceHealth | undefined {
    return this.serviceHealth.get(serviceType);
  }

  /**
   * Get all service health statuses
   */
  getAllServiceHealth(): Map<ServiceType, ServiceHealth> {
    return new Map(this.serviceHealth);
  }

  /**
   * Manually mark service as healthy (for testing or recovery)
   */
  markServiceHealthy(serviceType: ServiceType): void {
    const health = this.serviceHealth.get(serviceType);
    if (health) {
      health.isHealthy = true;
      health.errorCount = 0;
      health.consecutiveErrors = 0;
      health.lastCheck = new Date();
      health.lastError = undefined;
    }
  }

  /**
   * Private Methods
   */

  private enhanceError(
    error: Error | ServiceError,
    serviceType: ServiceType,
    context?: Record<string, unknown>
  ): EnhancedServiceError {
    const category = this.categorizeError(error);
    const severity = this.determineSeverity(category, serviceType);
    const correlationId = this.generateCorrelationId();

    let baseError: ServiceError;
    if ('code' in error) {
      baseError = error;
    } else {
      baseError = {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        service: serviceType,
        timestamp: new Date(),
        retryable: this.isRetryableCategory(category)
      };
    }

    return {
      ...baseError,
      category,
      severity,
      serviceType,
      context: this.sanitizeContext(context),
      userMessage: this.generateUserMessage(category, serviceType),
      technicalMessage: error.message,
      recoveryActions: this.generateRecoveryActions(category, serviceType),
      correlationId
    };
  }

  private categorizeError(error: Error | ServiceError): ErrorCategory {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection')) {
      return ErrorCategory.NETWORK;
    }
    if (message.includes('timeout')) {
      return ErrorCategory.TIMEOUT;
    }
    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorCategory.AUTHENTICATION;
    }
    if (message.includes('rate limit') || message.includes('throttle')) {
      return ErrorCategory.RATE_LIMIT;
    }
    if (message.includes('validation') || message.includes('invalid')) {
      return ErrorCategory.VALIDATION;
    }
    if (message.includes('unavailable') || message.includes('service')) {
      return ErrorCategory.SERVICE_UNAVAILABLE;
    }
    if (message.includes('permission') || message.includes('access denied')) {
      return ErrorCategory.PERMISSION;
    }
    
    return ErrorCategory.UNKNOWN;
  }

  private determineSeverity(category: ErrorCategory, serviceType: ServiceType): ErrorSeverity {
    // Critical services that affect core functionality
    const criticalServices = [ServiceType.TRANSCRIBE_MEDICAL, ServiceType.WEBSOCKET];
    
    if (criticalServices.includes(serviceType)) {
      switch (category) {
        case ErrorCategory.SERVICE_UNAVAILABLE:
        case ErrorCategory.NETWORK:
          return ErrorSeverity.HIGH;
        case ErrorCategory.AUTHENTICATION:
        case ErrorCategory.PERMISSION:
          return ErrorSeverity.CRITICAL;
        default:
          return ErrorSeverity.MEDIUM;
      }
    }
    
    // Non-critical services
    switch (category) {
      case ErrorCategory.AUTHENTICATION:
      case ErrorCategory.PERMISSION:
        return ErrorSeverity.HIGH;
      case ErrorCategory.SERVICE_UNAVAILABLE:
      case ErrorCategory.NETWORK:
        return ErrorSeverity.MEDIUM;
      default:
        return ErrorSeverity.LOW;
    }
  }

  private generateUserMessage(category: ErrorCategory, serviceType: ServiceType): string {
    const serviceNames = {
      [ServiceType.TRANSCRIBE_MEDICAL]: 'voice recognition',
      [ServiceType.TRANSCRIBE_STANDARD]: 'voice recognition',
      [ServiceType.TRANSLATE]: 'translation',
      [ServiceType.POLLY]: 'text-to-speech',
      [ServiceType.BEDROCK]: 'AI enhancement',
      [ServiceType.WEBSOCKET]: 'real-time communication',
      [ServiceType.DYNAMODB]: 'data storage',
      [ServiceType.S3]: 'file storage',
      [ServiceType.COGNITO]: 'authentication'
    };

    const serviceName = serviceNames[serviceType] || 'service';

    switch (category) {
      case ErrorCategory.NETWORK:
        return `Connection issue detected. Please check your internet connection and try again.`;
      case ErrorCategory.SERVICE_UNAVAILABLE:
        return `The ${serviceName} service is temporarily unavailable. We're working to restore it.`;
      case ErrorCategory.AUTHENTICATION:
        return `Authentication required. Please sign in to continue.`;
      case ErrorCategory.PERMISSION:
        return `You don't have permission to access this feature. Please contact your administrator.`;
      case ErrorCategory.RATE_LIMIT:
        return `Too many requests. Please wait a moment before trying again.`;
      case ErrorCategory.TIMEOUT:
        return `The request took too long to complete. Please try again.`;
      case ErrorCategory.VALIDATION:
        return `Invalid input detected. Please check your data and try again.`;
      default:
        return `An unexpected error occurred with the ${serviceName} service. Please try again.`;
    }
  }

  private generateRecoveryActions(category: ErrorCategory, serviceType: ServiceType): string[] {
    const baseActions = ['Try again in a few moments', 'Contact support if the problem persists'];
    
    switch (category) {
      case ErrorCategory.NETWORK:
        return [
          'Check your internet connection',
          'Try refreshing the page',
          ...baseActions
        ];
      case ErrorCategory.SERVICE_UNAVAILABLE:
        if (serviceType === ServiceType.TRANSCRIBE_MEDICAL) {
          return [
            'The system will automatically use standard transcription',
            'Wait for the service to recover',
            ...baseActions
          ];
        }
        return [
          'Wait for the service to recover',
          ...baseActions
        ];
      case ErrorCategory.AUTHENTICATION:
        return [
          'Sign in to your account',
          'Check your credentials',
          'Clear browser cache and cookies'
        ];
      case ErrorCategory.RATE_LIMIT:
        return [
          'Wait 30 seconds before trying again',
          'Reduce the frequency of requests'
        ];
      case ErrorCategory.TIMEOUT:
        return [
          'Check your internet connection speed',
          'Try with smaller audio segments',
          ...baseActions
        ];
      default:
        return baseActions;
    }
  }

  private isRetryableCategory(category: ErrorCategory): boolean {
    const retryableCategories = [
      ErrorCategory.NETWORK,
      ErrorCategory.SERVICE_UNAVAILABLE,
      ErrorCategory.TIMEOUT,
      ErrorCategory.RATE_LIMIT
    ];
    return retryableCategories.includes(category);
  }

  private isRetryableError(error: EnhancedServiceError): boolean {
    return error.retryable && this.isRetryableCategory(error.category);
  }

  private shouldUseFallback(serviceType: ServiceType): boolean {
    const strategy = this.fallbackStrategies.get(serviceType);
    if (!strategy) return false;

    const health = this.serviceHealth.get(serviceType);
    if (!health) return false;

    return health.consecutiveErrors >= strategy.errorThreshold;
  }

  private async triggerFallback(serviceType: ServiceType, error: EnhancedServiceError): Promise<void> {
    const strategy = this.fallbackStrategies.get(serviceType);
    if (!strategy) return;

    debugLog(`Triggering fallback for ${serviceType}`, {
      primaryService: strategy.primaryService,
      fallbackService: strategy.fallbackService,
      errorThreshold: strategy.errorThreshold
    });

    if (strategy.fallbackService) {
      // Mark fallback service as primary temporarily
      this.markServiceHealthy(strategy.fallbackService);
    }

    if (strategy.fallbackAction) {
      try {
        await strategy.fallbackAction();
      } catch (fallbackError) {
        debugLog(`Fallback action failed for ${serviceType}`, {
          error: fallbackError
        });
      }
    }
  }

  private updateServiceHealth(serviceType: ServiceType, error: EnhancedServiceError): void {
    let health = this.serviceHealth.get(serviceType);
    if (!health) {
      health = {
        service: serviceType,
        isHealthy: true,
        lastCheck: new Date(),
        errorCount: 0,
        consecutiveErrors: 0
      };
      this.serviceHealth.set(serviceType, health);
    }

    health.errorCount++;
    health.consecutiveErrors++;
    health.lastCheck = new Date();
    health.lastError = error;
    
    // Mark as unhealthy if too many consecutive errors
    const strategy = this.fallbackStrategies.get(serviceType);
    const threshold = strategy?.errorThreshold || 3;
    
    if (health.consecutiveErrors >= threshold) {
      health.isHealthy = false;
    }
  }

  private logError(error: EnhancedServiceError): void {
    const logData = {
      correlationId: error.correlationId,
      service: error.serviceType,
      category: error.category,
      severity: error.severity,
      code: error.code,
      message: sanitizeForLogging(error.technicalMessage),
      timestamp: error.timestamp,
      context: error.context ? sanitizeForLogging(JSON.stringify(error.context)) : undefined
    };

    console.error(`[Healthcare Translation Error] ${error.serviceType}:${error.category}`, logData);
  }

  private sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
    if (!context) return undefined;
    
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(context)) {
      if (typeof value === 'string') {
        sanitized[key] = sanitizeForLogging(value);
      } else {
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  private generateCorrelationId(): string {
    return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private initializeServiceHealth(): void {
    Object.values(ServiceType).forEach(serviceType => {
      this.serviceHealth.set(serviceType, {
        service: serviceType,
        isHealthy: true,
        lastCheck: new Date(),
        errorCount: 0,
        consecutiveErrors: 0
      });
    });
  }

  private initializeFallbackStrategies(): void {
    // Transcribe Medical -> Standard Transcribe fallback
    this.fallbackStrategies.set(ServiceType.TRANSCRIBE_MEDICAL, {
      primaryService: ServiceType.TRANSCRIBE_MEDICAL,
      fallbackService: ServiceType.TRANSCRIBE_STANDARD,
      errorThreshold: 2,
      cooldownPeriod: 300000 // 5 minutes
    });

    // Bedrock fallback (disable AI enhancement)
    this.fallbackStrategies.set(ServiceType.BEDROCK, {
      primaryService: ServiceType.BEDROCK,
      errorThreshold: 3,
      cooldownPeriod: 600000 // 10 minutes
    });
  }

  private initializeRetryConfigs(): void {
    const defaultConfig: RetryConfig = {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorCategory.NETWORK,
        ErrorCategory.SERVICE_UNAVAILABLE,
        ErrorCategory.TIMEOUT,
        ErrorCategory.RATE_LIMIT
      ]
    };

    // Service-specific configurations
    this.retryConfigs.set(ServiceType.TRANSCRIBE_MEDICAL, {
      ...defaultConfig,
      maxRetries: 2,
      initialDelay: 500
    });

    this.retryConfigs.set(ServiceType.WEBSOCKET, {
      ...defaultConfig,
      maxRetries: 5,
      initialDelay: 1000,
      maxDelay: 30000
    });

    this.retryConfigs.set(ServiceType.TRANSLATE, {
      ...defaultConfig,
      maxRetries: 2
    });

    this.retryConfigs.set(ServiceType.POLLY, {
      ...defaultConfig,
      maxRetries: 2
    });

    // Set default for all other services
    Object.values(ServiceType).forEach(serviceType => {
      if (!this.retryConfigs.has(serviceType)) {
        this.retryConfigs.set(serviceType, defaultConfig);
      }
    });
  }

  private getDefaultRetryConfig(): RetryConfig {
    return {
      maxRetries: 3,
      initialDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2,
      retryableErrors: [
        ErrorCategory.NETWORK,
        ErrorCategory.SERVICE_UNAVAILABLE,
        ErrorCategory.TIMEOUT,
        ErrorCategory.RATE_LIMIT
      ]
    };
  }
}

// Global error handler instance
export const globalErrorHandler = new ErrorHandler();

/**
 * Convenience functions for common error handling patterns
 */

export async function createNetworkError(message: string, serviceType: ServiceType): Promise<EnhancedServiceError> {
  return await globalErrorHandler.handleError(
    new Error(message),
    serviceType,
    { category: ErrorCategory.NETWORK }
  );
}

export async function createServiceUnavailableError(serviceType: ServiceType): Promise<EnhancedServiceError> {
  return await globalErrorHandler.handleError(
    new Error(`${serviceType} service is currently unavailable`),
    serviceType,
    { category: ErrorCategory.SERVICE_UNAVAILABLE }
  );
}

export async function createTimeoutError(serviceType: ServiceType, timeoutMs: number): Promise<EnhancedServiceError> {
  return await globalErrorHandler.handleError(
    new Error(`Operation timed out after ${timeoutMs}ms`),
    serviceType,
    { category: ErrorCategory.TIMEOUT, timeoutMs }
  );
}

export async function createValidationError(message: string, serviceType: ServiceType): Promise<EnhancedServiceError> {
  return await globalErrorHandler.handleError(
    new Error(message),
    serviceType,
    { category: ErrorCategory.VALIDATION }
  );
}