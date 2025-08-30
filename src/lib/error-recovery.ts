/**
 * Error Recovery Mechanisms
 * Implements automatic recovery strategies for network and service failures
 */

import { 
  ServiceType, 
  ErrorCategory, 
  EnhancedServiceError,
  globalErrorHandler 
} from './error-handling';
import { debugLog } from './aws-utils';

// Recovery strategy types
export enum RecoveryStrategy {
  RETRY = 'RETRY',
  FALLBACK = 'FALLBACK',
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
  GRACEFUL_DEGRADATION = 'GRACEFUL_DEGRADATION',
  MANUAL_INTERVENTION = 'MANUAL_INTERVENTION'
}

// Recovery action result
export interface RecoveryResult {
  success: boolean;
  strategy: RecoveryStrategy;
  message: string;
  nextAction?: RecoveryStrategy;
  retryAfter?: number; // milliseconds
}

// Circuit breaker states
export enum CircuitBreakerState {
  CLOSED = 'CLOSED',     // Normal operation
  OPEN = 'OPEN',         // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

// Circuit breaker configuration
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number;
  monitoringPeriod: number;
}

/**
 * Circuit Breaker Implementation
 */
export class CircuitBreaker {
  private state: CircuitBreakerState = CircuitBreakerState.CLOSED;
  private failureCount = 0;
  private lastFailureTime = 0;
  private nextAttemptTime = 0;

  constructor(
    private serviceType: ServiceType,
    private config: CircuitBreakerConfig
  ) {}

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.state === CircuitBreakerState.OPEN) {
      if (Date.now() < this.nextAttemptTime) {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceType}. Next attempt in ${this.nextAttemptTime - Date.now()}ms`);
      }
      this.state = CircuitBreakerState.HALF_OPEN;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitBreakerState.CLOSED;
    debugLog(`Circuit breaker closed for ${this.serviceType}`);
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitBreakerState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.recoveryTimeout;
      debugLog(`Circuit breaker opened for ${this.serviceType}`, {
        failureCount: this.failureCount,
        nextAttemptTime: this.nextAttemptTime
      });
    }
  }

  getState(): CircuitBreakerState {
    return this.state;
  }

  reset(): void {
    this.state = CircuitBreakerState.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    this.nextAttemptTime = 0;
  }
}

/**
 * Error Recovery Manager
 */
export class ErrorRecoveryManager {
  private circuitBreakers: Map<ServiceType, CircuitBreaker> = new Map();
  private recoveryAttempts: Map<string, number> = new Map();

  constructor() {
    this.initializeCircuitBreakers();
  }

  /**
   * Attempt to recover from an error
   */
  async attemptRecovery(
    error: EnhancedServiceError,
    context?: Record<string, unknown>
  ): Promise<RecoveryResult> {
    const strategy = this.determineRecoveryStrategy(error);
    const recoveryKey = `${error.serviceType}_${error.correlationId}`;
    
    debugLog(`Attempting recovery for ${error.serviceType}`, {
      strategy,
      category: error.category,
      severity: error.severity
    });

    switch (strategy) {
      case RecoveryStrategy.RETRY:
        return this.attemptRetry(error, recoveryKey);
      
      case RecoveryStrategy.FALLBACK:
        return this.attemptFallback(error);
      
      case RecoveryStrategy.CIRCUIT_BREAKER:
        return this.handleCircuitBreaker(error);
      
      case RecoveryStrategy.GRACEFUL_DEGRADATION:
        return this.attemptGracefulDegradation(error);
      
      case RecoveryStrategy.MANUAL_INTERVENTION:
        return this.requireManualIntervention(error);
      
      default:
        return {
          success: false,
          strategy,
          message: 'No recovery strategy available'
        };
    }
  }

  /**
   * Check if service can be recovered automatically
   */
  canAutoRecover(error: EnhancedServiceError): boolean {
    const autoRecoverableStrategies = [
      RecoveryStrategy.RETRY,
      RecoveryStrategy.FALLBACK,
      RecoveryStrategy.GRACEFUL_DEGRADATION
    ];
    
    const strategy = this.determineRecoveryStrategy(error);
    return autoRecoverableStrategies.includes(strategy);
  }

  /**
   * Get circuit breaker state for a service
   */
  getCircuitBreakerState(serviceType: ServiceType): CircuitBreakerState {
    const circuitBreaker = this.circuitBreakers.get(serviceType);
    return circuitBreaker?.getState() || CircuitBreakerState.CLOSED;
  }

  /**
   * Reset circuit breaker for a service
   */
  resetCircuitBreaker(serviceType: ServiceType): void {
    const circuitBreaker = this.circuitBreakers.get(serviceType);
    circuitBreaker?.reset();
  }

  /**
   * Private Methods
   */

  private determineRecoveryStrategy(error: EnhancedServiceError): RecoveryStrategy {
    // Critical errors require manual intervention
    if (error.category === ErrorCategory.AUTHENTICATION || 
        error.category === ErrorCategory.PERMISSION) {
      return RecoveryStrategy.MANUAL_INTERVENTION;
    }

    // Network and timeout errors can be retried
    if (error.category === ErrorCategory.NETWORK || 
        error.category === ErrorCategory.TIMEOUT) {
      return RecoveryStrategy.RETRY;
    }

    // Service unavailable errors should use fallback if available
    if (error.category === ErrorCategory.SERVICE_UNAVAILABLE) {
      if (this.hasFallbackService(error.serviceType)) {
        return RecoveryStrategy.FALLBACK;
      }
      return RecoveryStrategy.CIRCUIT_BREAKER;
    }

    // Rate limit errors should use circuit breaker
    if (error.category === ErrorCategory.RATE_LIMIT) {
      return RecoveryStrategy.CIRCUIT_BREAKER;
    }

    // Validation errors need manual intervention
    if (error.category === ErrorCategory.VALIDATION) {
      return RecoveryStrategy.MANUAL_INTERVENTION;
    }

    // Default to graceful degradation
    return RecoveryStrategy.GRACEFUL_DEGRADATION;
  }

  private async attemptRetry(
    error: EnhancedServiceError,
    recoveryKey: string
  ): Promise<RecoveryResult> {
    const attempts = this.recoveryAttempts.get(recoveryKey) || 0;
    const maxRetries = 3;

    if (attempts >= maxRetries) {
      return {
        success: false,
        strategy: RecoveryStrategy.RETRY,
        message: 'Maximum retry attempts exceeded',
        nextAction: RecoveryStrategy.FALLBACK
      };
    }

    this.recoveryAttempts.set(recoveryKey, attempts + 1);
    
    // Calculate exponential backoff delay
    const baseDelay = 1000;
    const retryAfter = baseDelay * Math.pow(2, attempts);

    return {
      success: true,
      strategy: RecoveryStrategy.RETRY,
      message: `Retry attempt ${attempts + 1} of ${maxRetries}`,
      retryAfter
    };
  }

  private async attemptFallback(error: EnhancedServiceError): Promise<RecoveryResult> {
    const fallbackService = this.getFallbackService(error.serviceType);
    
    if (!fallbackService) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        message: 'No fallback service available',
        nextAction: RecoveryStrategy.GRACEFUL_DEGRADATION
      };
    }

    // Check if fallback service is healthy
    const fallbackHealthy = globalErrorHandler.isServiceHealthy(fallbackService);
    
    if (!fallbackHealthy) {
      return {
        success: false,
        strategy: RecoveryStrategy.FALLBACK,
        message: 'Fallback service is also unhealthy',
        nextAction: RecoveryStrategy.GRACEFUL_DEGRADATION
      };
    }

    debugLog(`Falling back from ${error.serviceType} to ${fallbackService}`);

    return {
      success: true,
      strategy: RecoveryStrategy.FALLBACK,
      message: `Using ${fallbackService} as fallback for ${error.serviceType}`
    };
  }

  private async handleCircuitBreaker(error: EnhancedServiceError): Promise<RecoveryResult> {
    const circuitBreaker = this.circuitBreakers.get(error.serviceType);
    
    if (!circuitBreaker) {
      return {
        success: false,
        strategy: RecoveryStrategy.CIRCUIT_BREAKER,
        message: 'No circuit breaker configured for service'
      };
    }

    const state = circuitBreaker.getState();
    
    switch (state) {
      case CircuitBreakerState.OPEN:
        return {
          success: false,
          strategy: RecoveryStrategy.CIRCUIT_BREAKER,
          message: 'Circuit breaker is open, service temporarily disabled',
          nextAction: RecoveryStrategy.GRACEFUL_DEGRADATION,
          retryAfter: 30000 // 30 seconds
        };
      
      case CircuitBreakerState.HALF_OPEN:
        return {
          success: true,
          strategy: RecoveryStrategy.CIRCUIT_BREAKER,
          message: 'Circuit breaker is half-open, testing service recovery'
        };
      
      default:
        return {
          success: true,
          strategy: RecoveryStrategy.CIRCUIT_BREAKER,
          message: 'Circuit breaker is closed, service is healthy'
        };
    }
  }

  private async attemptGracefulDegradation(error: EnhancedServiceError): Promise<RecoveryResult> {
    const degradationStrategy = this.getDegradationStrategy(error.serviceType);
    
    return {
      success: true,
      strategy: RecoveryStrategy.GRACEFUL_DEGRADATION,
      message: degradationStrategy.message
    };
  }

  private async requireManualIntervention(error: EnhancedServiceError): Promise<RecoveryResult> {
    return {
      success: false,
      strategy: RecoveryStrategy.MANUAL_INTERVENTION,
      message: 'Manual intervention required to resolve this error'
    };
  }

  private hasFallbackService(serviceType: ServiceType): boolean {
    const fallbackMap = {
      [ServiceType.TRANSCRIBE_MEDICAL]: ServiceType.TRANSCRIBE_STANDARD,
      [ServiceType.BEDROCK]: null, // Graceful degradation instead
    };
    
    return fallbackMap[serviceType] !== undefined;
  }

  private getFallbackService(serviceType: ServiceType): ServiceType | null {
    const fallbackMap = {
      [ServiceType.TRANSCRIBE_MEDICAL]: ServiceType.TRANSCRIBE_STANDARD,
    };
    
    return fallbackMap[serviceType] || null;
  }

  private getDegradationStrategy(serviceType: ServiceType): { message: string } {
    const degradationStrategies = {
      [ServiceType.BEDROCK]: {
        message: 'AI enhancement disabled, using basic translation'
      },
      [ServiceType.POLLY]: {
        message: 'Text-to-speech unavailable, showing text only'
      },
      [ServiceType.TRANSLATE]: {
        message: 'Translation service degraded, showing original text'
      },
      [ServiceType.TRANSCRIBE_MEDICAL]: {
        message: 'Medical transcription unavailable, using standard transcription'
      },
      [ServiceType.TRANSCRIBE_STANDARD]: {
        message: 'Transcription service unavailable, manual input required'
      }
    };
    
    return degradationStrategies[serviceType] || {
      message: 'Service temporarily degraded, limited functionality available'
    };
  }

  private initializeCircuitBreakers(): void {
    const defaultConfig: CircuitBreakerConfig = {
      failureThreshold: 5,
      recoveryTimeout: 60000, // 1 minute
      monitoringPeriod: 10000  // 10 seconds
    };

    // Service-specific configurations
    const serviceConfigs: Partial<Record<ServiceType, CircuitBreakerConfig>> = {
      [ServiceType.TRANSCRIBE_MEDICAL]: {
        failureThreshold: 3,
        recoveryTimeout: 30000, // 30 seconds
        monitoringPeriod: 5000   // 5 seconds
      },
      [ServiceType.WEBSOCKET]: {
        failureThreshold: 2,
        recoveryTimeout: 15000, // 15 seconds
        monitoringPeriod: 3000   // 3 seconds
      },
      [ServiceType.BEDROCK]: {
        failureThreshold: 5,
        recoveryTimeout: 120000, // 2 minutes
        monitoringPeriod: 15000   // 15 seconds
      }
    };

    // Initialize circuit breakers for all services
    Object.values(ServiceType).forEach(serviceType => {
      const config = serviceConfigs[serviceType] || defaultConfig;
      this.circuitBreakers.set(serviceType, new CircuitBreaker(serviceType, config));
    });
  }
}

// Global recovery manager instance
export const globalRecoveryManager = new ErrorRecoveryManager();

/**
 * Convenience functions for error recovery
 */

export async function recoverFromError(
  error: EnhancedServiceError,
  context?: Record<string, unknown>
): Promise<RecoveryResult> {
  return globalRecoveryManager.attemptRecovery(error, context);
}

export function canAutoRecover(error: EnhancedServiceError): boolean {
  return globalRecoveryManager.canAutoRecover(error);
}

export function getServiceCircuitBreakerState(serviceType: ServiceType): CircuitBreakerState {
  return globalRecoveryManager.getCircuitBreakerState(serviceType);
}

export function resetServiceCircuitBreaker(serviceType: ServiceType): void {
  globalRecoveryManager.resetCircuitBreaker(serviceType);
}