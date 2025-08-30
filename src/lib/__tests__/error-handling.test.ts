/**
 * Test suite for the comprehensive error handling system
 */

import { 
  ErrorHandler, 
  ServiceType, 
  ErrorCategory, 
  ErrorSeverity,
  EnhancedServiceError,
  globalErrorHandler 
} from '../error-handling';
import { 
  globalRecoveryManager,
  RecoveryStrategy,
  CircuitBreakerState 
} from '../error-recovery';
import { secureLogger } from '../secure-logger';

// Mock console methods to avoid noise in tests
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

beforeAll(() => {
  console.error = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

describe('ErrorHandler', () => {
  let errorHandler: ErrorHandler;

  beforeEach(() => {
    errorHandler = new ErrorHandler();
  });

  describe('handleError', () => {
    it('should enhance a basic error with service context', async () => {
      const basicError = new Error('Network connection failed');
      const enhancedError = await errorHandler.handleError(
        basicError,
        ServiceType.TRANSCRIBE_MEDICAL,
        { sessionId: 'test-session' }
      );

      expect(enhancedError.serviceType).toBe(ServiceType.TRANSCRIBE_MEDICAL);
      expect(enhancedError.category).toBe(ErrorCategory.NETWORK);
      expect(enhancedError.severity).toBe(ErrorSeverity.HIGH);
      expect(enhancedError.userMessage).toContain('Connection issue detected');
      expect(enhancedError.recoveryActions).toContain('Check your internet connection');
      expect(enhancedError.correlationId).toBeDefined();
    });

    it('should categorize different error types correctly', async () => {
      const testCases = [
        { message: 'Network timeout occurred', expectedCategory: ErrorCategory.NETWORK },
        { message: 'Service is unavailable', expectedCategory: ErrorCategory.SERVICE_UNAVAILABLE },
        { message: 'Unauthorized access', expectedCategory: ErrorCategory.AUTHENTICATION },
        { message: 'Rate limit exceeded', expectedCategory: ErrorCategory.RATE_LIMIT },
        { message: 'Invalid input provided', expectedCategory: ErrorCategory.VALIDATION },
        { message: 'Permission denied', expectedCategory: ErrorCategory.PERMISSION },
        { message: 'Request timeout', expectedCategory: ErrorCategory.TIMEOUT }
      ];

      for (const testCase of testCases) {
        const error = new Error(testCase.message);
        const enhancedError = await errorHandler.handleError(error, ServiceType.WEBSOCKET);
        expect(enhancedError.category).toBe(testCase.expectedCategory);
      }
    });

    it('should determine severity based on service type and error category', async () => {
      // Critical service with authentication error should be CRITICAL
      const authError = new Error('Unauthorized access');
      const criticalAuthError = await errorHandler.handleError(
        authError,
        ServiceType.TRANSCRIBE_MEDICAL
      );
      expect(criticalAuthError.severity).toBe(ErrorSeverity.CRITICAL);

      // Non-critical service with network error should be MEDIUM
      const networkError = new Error('Network connection failed');
      const mediumNetworkError = await errorHandler.handleError(
        networkError,
        ServiceType.POLLY
      );
      expect(mediumNetworkError.severity).toBe(ErrorSeverity.MEDIUM);
    });

    it('should update service health when handling errors', async () => {
      const error = new Error('Service unavailable');
      
      // Initially service should be healthy
      expect(errorHandler.isServiceHealthy(ServiceType.TRANSLATE)).toBe(true);
      
      // Handle multiple errors to trigger unhealthy state
      await errorHandler.handleError(error, ServiceType.TRANSLATE);
      await errorHandler.handleError(error, ServiceType.TRANSLATE);
      await errorHandler.handleError(error, ServiceType.TRANSLATE);
      
      // Service should now be unhealthy
      expect(errorHandler.isServiceHealthy(ServiceType.TRANSLATE)).toBe(false);
    });
  });

  describe('executeWithRetry', () => {
    it('should retry retryable operations', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Network timeout');
        }
        return 'success';
      });

      const result = await errorHandler.executeWithRetry(
        operation,
        ServiceType.WEBSOCKET
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Unauthorized access'));

      try {
        await errorHandler.executeWithRetry(operation, ServiceType.WEBSOCKET);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeDefined();
        expect(operation).toHaveBeenCalledTimes(1);
      }
    });

    it('should respect maximum retry attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Network timeout'));

      try {
        await errorHandler.executeWithRetry(operation, ServiceType.WEBSOCKET);
        fail('Expected error to be thrown');
      } catch (error) {
        expect(error).toBeDefined();
        // Should try initial + 3 retries = 4 total attempts
        expect(operation).toHaveBeenCalledTimes(4);
      }
    }, 10000); // Increase timeout for retry delays
  });

  describe('service health tracking', () => {
    it('should track service health correctly', () => {
      expect(errorHandler.isServiceHealthy(ServiceType.BEDROCK)).toBe(true);
      
      const health = errorHandler.getServiceHealth(ServiceType.BEDROCK);
      expect(health).toBeDefined();
      expect(health?.isHealthy).toBe(true);
      expect(health?.errorCount).toBe(0);
    });

    it('should mark service as healthy after manual reset', async () => {
      const error = new Error('Service unavailable');
      
      // Make service unhealthy
      await errorHandler.handleError(error, ServiceType.BEDROCK);
      await errorHandler.handleError(error, ServiceType.BEDROCK);
      await errorHandler.handleError(error, ServiceType.BEDROCK);
      
      expect(errorHandler.isServiceHealthy(ServiceType.BEDROCK)).toBe(false);
      
      // Reset service health
      errorHandler.markServiceHealthy(ServiceType.BEDROCK);
      
      expect(errorHandler.isServiceHealthy(ServiceType.BEDROCK)).toBe(true);
    });
  });
});

describe('ErrorRecoveryManager', () => {
  describe('attemptRecovery', () => {
    it('should determine correct recovery strategy for different error types', async () => {
      const testCases = [
        {
          error: { category: ErrorCategory.NETWORK } as EnhancedServiceError,
          expectedStrategy: RecoveryStrategy.RETRY
        },
        {
          error: { 
            category: ErrorCategory.SERVICE_UNAVAILABLE,
            serviceType: ServiceType.TRANSCRIBE_MEDICAL 
          } as EnhancedServiceError,
          expectedStrategy: RecoveryStrategy.FALLBACK
        },
        {
          error: { category: ErrorCategory.AUTHENTICATION } as EnhancedServiceError,
          expectedStrategy: RecoveryStrategy.MANUAL_INTERVENTION
        },
        {
          error: { category: ErrorCategory.RATE_LIMIT } as EnhancedServiceError,
          expectedStrategy: RecoveryStrategy.CIRCUIT_BREAKER
        }
      ];

      for (const testCase of testCases) {
        const result = await globalRecoveryManager.attemptRecovery(testCase.error);
        expect(result.strategy).toBe(testCase.expectedStrategy);
      }
    });

    it('should handle retry recovery strategy', async () => {
      const error: EnhancedServiceError = {
        code: 'NETWORK_ERROR',
        message: 'Network timeout',
        service: ServiceType.WEBSOCKET,
        timestamp: new Date(),
        retryable: true,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        serviceType: ServiceType.WEBSOCKET,
        userMessage: 'Network issue',
        technicalMessage: 'Network timeout',
        recoveryActions: [],
        correlationId: 'test-correlation-id'
      };

      const result = await globalRecoveryManager.attemptRecovery(error);
      
      expect(result.success).toBe(true);
      expect(result.strategy).toBe(RecoveryStrategy.RETRY);
      expect(result.retryAfter).toBeGreaterThan(0);
    });

    it('should handle fallback recovery strategy', async () => {
      const error: EnhancedServiceError = {
        code: 'SERVICE_UNAVAILABLE',
        message: 'Transcribe Medical unavailable',
        service: ServiceType.TRANSCRIBE_MEDICAL,
        timestamp: new Date(),
        retryable: false,
        category: ErrorCategory.SERVICE_UNAVAILABLE,
        severity: ErrorSeverity.HIGH,
        serviceType: ServiceType.TRANSCRIBE_MEDICAL,
        userMessage: 'Service unavailable',
        technicalMessage: 'Transcribe Medical unavailable',
        recoveryActions: [],
        correlationId: 'test-correlation-id'
      };

      const result = await globalRecoveryManager.attemptRecovery(error);
      
      expect(result.strategy).toBe(RecoveryStrategy.FALLBACK);
      // Should succeed because fallback to standard transcribe is available
      expect(result.success).toBe(true);
    });
  });

  describe('circuit breaker functionality', () => {
    it('should track circuit breaker states', () => {
      const initialState = globalRecoveryManager.getCircuitBreakerState(ServiceType.WEBSOCKET);
      expect(initialState).toBe(CircuitBreakerState.CLOSED);
    });

    it('should reset circuit breaker', () => {
      globalRecoveryManager.resetCircuitBreaker(ServiceType.WEBSOCKET);
      const state = globalRecoveryManager.getCircuitBreakerState(ServiceType.WEBSOCKET);
      expect(state).toBe(CircuitBreakerState.CLOSED);
    });
  });

  describe('auto recovery detection', () => {
    it('should identify auto-recoverable errors', () => {
      const autoRecoverableError: EnhancedServiceError = {
        code: 'NETWORK_ERROR',
        message: 'Network timeout',
        service: ServiceType.WEBSOCKET,
        timestamp: new Date(),
        retryable: true,
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        serviceType: ServiceType.WEBSOCKET,
        userMessage: 'Network issue',
        technicalMessage: 'Network timeout',
        recoveryActions: [],
        correlationId: 'test-correlation-id'
      };

      expect(globalRecoveryManager.canAutoRecover(autoRecoverableError)).toBe(true);
    });

    it('should identify non-auto-recoverable errors', () => {
      const nonRecoverableError: EnhancedServiceError = {
        code: 'AUTH_ERROR',
        message: 'Unauthorized',
        service: ServiceType.COGNITO,
        timestamp: new Date(),
        retryable: false,
        category: ErrorCategory.AUTHENTICATION,
        severity: ErrorSeverity.CRITICAL,
        serviceType: ServiceType.COGNITO,
        userMessage: 'Authentication required',
        technicalMessage: 'Unauthorized',
        recoveryActions: [],
        correlationId: 'test-correlation-id'
      };

      expect(globalRecoveryManager.canAutoRecover(nonRecoverableError)).toBe(false);
    });
  });
});

describe('SecureLogger', () => {
  describe('PII redaction', () => {
    it('should redact SSN from text', () => {
      const textWithSSN = 'Patient SSN is 123-45-6789 and phone is 555-123-4567';
      const { redactedText, redactedFields } = secureLogger.redactPII(textWithSSN);
      
      expect(redactedText).not.toContain('123-45-6789');
      expect(redactedText).toContain('[SSN-REDACTED]');
      expect(redactedFields).toContain('SSN');
    });

    it('should redact phone numbers from text', () => {
      const textWithPhone = 'Call patient at (555) 123-4567 or 555.123.4567';
      const { redactedText, redactedFields } = secureLogger.redactPII(textWithPhone);
      
      expect(redactedText).not.toContain('555) 123-4567');
      expect(redactedText).toContain('[PHONE-REDACTED]');
      expect(redactedFields).toContain('PHONE');
    });

    it('should redact email addresses from text', () => {
      const textWithEmail = 'Patient email is john.doe@example.com';
      const { redactedText, redactedFields } = secureLogger.redactPII(textWithEmail);
      
      expect(redactedText).not.toContain('john.doe@example.com');
      expect(redactedText).toContain('[EMAIL-REDACTED]');
      expect(redactedFields).toContain('EMAIL');
    });

    it('should redact multiple PII types from text', () => {
      const textWithMultiplePII = 'Patient John Doe, SSN 123-45-6789, phone (555) 123-4567, email john@example.com';
      const { redactedText, redactedFields } = secureLogger.redactPII(textWithMultiplePII);
      
      expect(redactedText).toContain('[SSN-REDACTED]');
      expect(redactedText).toContain('[PHONE-REDACTED]');
      expect(redactedText).toContain('[EMAIL-REDACTED]');
      expect(redactedFields).toContain('SSN');
      expect(redactedFields).toContain('PHONE');
      expect(redactedFields).toContain('EMAIL');
    });

    it('should handle text without PII', () => {
      const cleanText = 'This is a normal message without sensitive information';
      const { redactedText, redactedFields } = secureLogger.redactPII(cleanText);
      
      expect(redactedText).toBe(cleanText);
      expect(redactedFields).toHaveLength(0);
    });
  });

  describe('error logging', () => {
    it('should log enhanced errors with PII redaction', () => {
      const error: EnhancedServiceError = {
        code: 'TEST_ERROR',
        message: 'Patient SSN 123-45-6789 caused an error',
        service: ServiceType.WEBSOCKET,
        timestamp: new Date(),
        retryable: false,
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        serviceType: ServiceType.WEBSOCKET,
        userMessage: 'Validation error',
        technicalMessage: 'Patient SSN 123-45-6789 caused an error',
        recoveryActions: [],
        correlationId: 'test-correlation-id'
      };

      // Should not throw
      expect(() => {
        secureLogger.logError(error, { sessionId: 'test-session' });
      }).not.toThrow();
    });
  });
});

describe('Integration Tests', () => {
  it('should handle complete error flow from detection to recovery', async () => {
    const originalError = new Error('Network connection timeout');
    
    // 1. Handle the error
    const enhancedError = await globalErrorHandler.handleError(
      originalError,
      ServiceType.WEBSOCKET,
      { sessionId: 'integration-test' }
    );
    
    expect(enhancedError.category).toBe(ErrorCategory.NETWORK);
    expect(enhancedError.serviceType).toBe(ServiceType.WEBSOCKET);
    
    // 2. Attempt recovery
    const recoveryResult = await globalRecoveryManager.attemptRecovery(enhancedError);
    
    expect(recoveryResult.strategy).toBe(RecoveryStrategy.RETRY);
    expect(recoveryResult.success).toBe(true);
    
    // 3. Verify logging occurred (check that it doesn't throw)
    expect(() => {
      secureLogger.logError(enhancedError);
    }).not.toThrow();
  });

  it('should handle service degradation scenario', async () => {
    const serviceType = ServiceType.BEDROCK;
    
    // Simulate multiple failures to trigger degradation
    for (let i = 0; i < 5; i++) {
      const error = new Error('Service temporarily unavailable');
      await globalErrorHandler.handleError(error, serviceType);
    }
    
    // Service should be marked as unhealthy
    expect(globalErrorHandler.isServiceHealthy(serviceType)).toBe(false);
    
    // Recovery should suggest graceful degradation for Bedrock
    const error: EnhancedServiceError = {
      code: 'SERVICE_UNAVAILABLE',
      message: 'Bedrock unavailable',
      service: serviceType,
      timestamp: new Date(),
      retryable: false,
      category: ErrorCategory.SERVICE_UNAVAILABLE,
      severity: ErrorSeverity.MEDIUM,
      serviceType,
      userMessage: 'AI enhancement unavailable',
      technicalMessage: 'Bedrock unavailable',
      recoveryActions: [],
      correlationId: 'degradation-test'
    };
    
    const recoveryResult = await globalRecoveryManager.attemptRecovery(error);
    expect(recoveryResult.strategy).toBe(RecoveryStrategy.GRACEFUL_DEGRADATION);
  });
});