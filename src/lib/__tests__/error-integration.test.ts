/**
 * Integration test for error handling system
 * Tests the complete error handling flow
 */

import { 
  globalErrorHandler, 
  ServiceType, 
  ErrorCategory 
} from '../error-handling';
import { globalRecoveryManager } from '../error-recovery';
import { secureLogger } from '../secure-logger';

describe('Error Handling Integration', () => {
  beforeEach(() => {
    // Reset error handler state
    Object.values(ServiceType).forEach(serviceType => {
      globalErrorHandler.markServiceHealthy(serviceType);
    });
  });

  it('should handle and log errors with PII redaction', async () => {
    const errorWithPII = new Error('Patient SSN 123-45-6789 caused validation error');
    
    const enhancedError = await globalErrorHandler.handleError(
      errorWithPII,
      ServiceType.TRANSCRIBE_MEDICAL,
      { sessionId: 'test-session-123' }
    );

    // Verify error enhancement
    expect(enhancedError.serviceType).toBe(ServiceType.TRANSCRIBE_MEDICAL);
    expect(enhancedError.category).toBe(ErrorCategory.VALIDATION);
    expect(enhancedError.userMessage).toContain('Invalid input detected');
    expect(enhancedError.correlationId).toBeDefined();

    // Verify PII redaction in logging
    const { redactedText } = secureLogger.redactPII(enhancedError.technicalMessage);
    expect(redactedText).not.toContain('123-45-6789');
    expect(redactedText).toContain('[SSN-REDACTED]');
  });

  it('should track service health across multiple errors', async () => {
    const serviceType = ServiceType.TRANSLATE;
    
    // Initially healthy
    expect(globalErrorHandler.isServiceHealthy(serviceType)).toBe(true);
    
    // Cause multiple errors
    for (let i = 0; i < 3; i++) {
      const error = new Error('Service unavailable');
      await globalErrorHandler.handleError(error, serviceType);
    }
    
    // Should be unhealthy now
    expect(globalErrorHandler.isServiceHealthy(serviceType)).toBe(false);
    
    const health = globalErrorHandler.getServiceHealth(serviceType);
    expect(health?.errorCount).toBe(3);
    expect(health?.consecutiveErrors).toBe(3);
  });

  it('should provide appropriate recovery strategies', async () => {
    // Network error should suggest retry
    const networkError = new Error('Network timeout');
    const networkEnhanced = await globalErrorHandler.handleError(
      networkError,
      ServiceType.WEBSOCKET
    );
    
    const networkRecovery = await globalRecoveryManager.attemptRecovery(networkEnhanced);
    expect(networkRecovery.strategy).toBe('RETRY');
    expect(networkRecovery.success).toBe(true);
    
    // Authentication error should require manual intervention
    const authError = new Error('Unauthorized access');
    const authEnhanced = await globalErrorHandler.handleError(
      authError,
      ServiceType.COGNITO
    );
    
    const authRecovery = await globalRecoveryManager.attemptRecovery(authEnhanced);
    expect(authRecovery.strategy).toBe('MANUAL_INTERVENTION');
    expect(authRecovery.success).toBe(false);
  });

  it('should handle fallback scenarios', async () => {
    const transcribeError = new Error('Transcribe Medical service unavailable');
    const enhancedError = await globalErrorHandler.handleError(
      transcribeError,
      ServiceType.TRANSCRIBE_MEDICAL
    );
    
    const recoveryResult = await globalRecoveryManager.attemptRecovery(enhancedError);
    expect(recoveryResult.strategy).toBe('FALLBACK');
    expect(recoveryResult.success).toBe(true);
    expect(recoveryResult.message).toContain('TRANSCRIBE_STANDARD');
  });

  it('should generate user-friendly error messages', async () => {
    const testCases = [
      {
        error: new Error('Network connection failed'),
        serviceType: ServiceType.WEBSOCKET,
        expectedMessage: 'Connection issue detected'
      },
      {
        error: new Error('Service is unavailable'),
        serviceType: ServiceType.POLLY,
        expectedMessage: 'text-to-speech service is temporarily unavailable'
      },
      {
        error: new Error('Rate limit exceeded'),
        serviceType: ServiceType.TRANSLATE,
        expectedMessage: 'Too many requests'
      }
    ];

    for (const testCase of testCases) {
      const enhancedError = await globalErrorHandler.handleError(
        testCase.error,
        testCase.serviceType
      );
      
      expect(enhancedError.userMessage).toContain(testCase.expectedMessage);
      expect(enhancedError.recoveryActions.length).toBeGreaterThan(0);
    }
  });

  it('should maintain error correlation across the system', async () => {
    const originalError = new Error('System failure');
    const enhancedError = await globalErrorHandler.handleError(
      originalError,
      ServiceType.DYNAMODB,
      { userId: 'user-123', operation: 'save-session' }
    );

    // Correlation ID should be generated
    expect(enhancedError.correlationId).toBeDefined();
    expect(enhancedError.correlationId).toMatch(/^err_\d+_[a-z0-9]+$/);

    // Context should be sanitized but preserved
    expect(enhancedError.context).toBeDefined();
    expect(enhancedError.context?.operation).toBe('save-session');
    
    // Recovery should maintain correlation
    const recoveryResult = await globalRecoveryManager.attemptRecovery(enhancedError);
    expect(recoveryResult).toBeDefined();
  });
});