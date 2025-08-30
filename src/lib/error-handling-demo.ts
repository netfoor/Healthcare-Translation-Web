/**
 * Demonstration of the Error Handling System
 * Shows how the comprehensive error handling works in practice
 */

import { 
  globalErrorHandler, 
  ServiceType, 
  ErrorCategory 
} from './error-handling';
import { globalRecoveryManager } from './error-recovery';
import { secureLogger } from './secure-logger';

/**
 * Demo function to show error handling capabilities
 */
export async function demonstrateErrorHandling() {
  console.log('🚀 Healthcare Translation Error Handling System Demo\n');

  // 1. Basic Error Enhancement
  console.log('1. Basic Error Enhancement:');
  const networkError = new Error('Network connection timeout');
  const enhancedError = await globalErrorHandler.handleError(
    networkError,
    ServiceType.TRANSCRIBE_MEDICAL,
    { sessionId: 'demo-session-123' }
  );

  console.log(`   Original: ${networkError.message}`);
  console.log(`   Enhanced: ${enhancedError.userMessage}`);
  console.log(`   Category: ${enhancedError.category}`);
  console.log(`   Severity: ${enhancedError.severity}`);
  console.log(`   Recovery Actions: ${enhancedError.recoveryActions.join(', ')}`);
  console.log(`   Correlation ID: ${enhancedError.correlationId}\n`);

  // 2. PII Redaction
  console.log('2. PII Redaction:');
  const textWithPII = 'Patient John Doe, SSN 123-45-6789, phone (555) 123-4567 had an error';
  const { redactedText, redactedFields } = secureLogger.redactPII(textWithPII);
  
  console.log(`   Original: ${textWithPII}`);
  console.log(`   Redacted: ${redactedText}`);
  console.log(`   Redacted Fields: ${redactedFields.join(', ')}\n`);

  // 3. Service Health Tracking
  console.log('3. Service Health Tracking:');
  console.log(`   Transcribe Medical Health: ${globalErrorHandler.isServiceHealthy(ServiceType.TRANSCRIBE_MEDICAL)}`);
  
  // Simulate multiple errors
  for (let i = 0; i < 3; i++) {
    await globalErrorHandler.handleError(
      new Error('Service temporarily unavailable'),
      ServiceType.TRANSCRIBE_MEDICAL
    );
  }
  
  console.log(`   After 3 errors: ${globalErrorHandler.isServiceHealthy(ServiceType.TRANSCRIBE_MEDICAL)}`);
  
  const health = globalErrorHandler.getServiceHealth(ServiceType.TRANSCRIBE_MEDICAL);
  console.log(`   Error Count: ${health?.errorCount}`);
  console.log(`   Consecutive Errors: ${health?.consecutiveErrors}\n`);

  // 4. Recovery Strategies
  console.log('4. Recovery Strategies:');
  
  // Network error - should suggest retry
  const networkRecovery = await globalRecoveryManager.attemptRecovery(enhancedError);
  console.log(`   Network Error Recovery: ${networkRecovery.strategy} (${networkRecovery.success ? 'Success' : 'Failed'})`);
  
  // Service unavailable - should suggest fallback for Transcribe Medical
  const serviceError = await globalErrorHandler.handleError(
    new Error('Transcribe Medical service unavailable'),
    ServiceType.TRANSCRIBE_MEDICAL
  );
  const serviceRecovery = await globalRecoveryManager.attemptRecovery(serviceError);
  console.log(`   Service Error Recovery: ${serviceRecovery.strategy} (${serviceRecovery.success ? 'Success' : 'Failed'})`);
  
  // Authentication error - should require manual intervention
  const authError = await globalErrorHandler.handleError(
    new Error('Unauthorized access'),
    ServiceType.COGNITO
  );
  const authRecovery = await globalRecoveryManager.attemptRecovery(authError);
  console.log(`   Auth Error Recovery: ${authRecovery.strategy} (${authRecovery.success ? 'Success' : 'Failed'})\n`);

  // 5. Error Categorization
  console.log('5. Error Categorization:');
  const errorTypes = [
    { message: 'Network timeout occurred', expected: ErrorCategory.NETWORK },
    { message: 'Service is unavailable', expected: ErrorCategory.SERVICE_UNAVAILABLE },
    { message: 'Unauthorized access', expected: ErrorCategory.AUTHENTICATION },
    { message: 'Rate limit exceeded', expected: ErrorCategory.RATE_LIMIT },
    { message: 'Invalid input provided', expected: ErrorCategory.VALIDATION }
  ];

  for (const errorType of errorTypes) {
    const error = await globalErrorHandler.handleError(
      new Error(errorType.message),
      ServiceType.WEBSOCKET
    );
    const correct = error.category === errorType.expected ? '✅' : '❌';
    console.log(`   ${correct} "${errorType.message}" → ${error.category}`);
  }

  console.log('\n6. System Health Overview:');
  const allServices = Object.values(ServiceType);
  allServices.forEach(serviceType => {
    const isHealthy = globalErrorHandler.isServiceHealthy(serviceType);
    const status = isHealthy ? '🟢 Healthy' : '🔴 Unhealthy';
    console.log(`   ${serviceType}: ${status}`);
  });

  console.log('\n✅ Error Handling System Demo Complete!');
  console.log('\nKey Features Demonstrated:');
  console.log('• Automatic error categorization and severity assessment');
  console.log('• User-friendly error messages with recovery actions');
  console.log('• PII redaction for healthcare compliance');
  console.log('• Service health tracking and monitoring');
  console.log('• Intelligent recovery strategies (retry, fallback, graceful degradation)');
  console.log('• Correlation IDs for error tracking');
  console.log('• Comprehensive logging with security considerations');
}

/**
 * Demo function for retry mechanism
 */
export async function demonstrateRetryMechanism() {
  console.log('\n🔄 Retry Mechanism Demo:');
  
  let attemptCount = 0;
  const flakyOperation = async () => {
    attemptCount++;
    console.log(`   Attempt ${attemptCount}...`);
    
    if (attemptCount < 3) {
      throw new Error('Network timeout - temporary failure');
    }
    
    return 'Operation successful!';
  };

  try {
    const result = await globalErrorHandler.executeWithRetry(
      flakyOperation,
      ServiceType.WEBSOCKET
    );
    console.log(`   Result: ${result}`);
    console.log(`   Total attempts: ${attemptCount}`);
  } catch (error) {
    console.log(`   Failed after ${attemptCount} attempts`);
  }
}

/**
 * Demo function for circuit breaker
 */
export async function demonstrateCircuitBreaker() {
  console.log('\n⚡ Circuit Breaker Demo:');
  
  const serviceType = ServiceType.BEDROCK;
  console.log(`   Initial circuit breaker state: ${globalRecoveryManager.getCircuitBreakerState(serviceType)}`);
  
  // Simulate multiple failures
  console.log('   Simulating service failures...');
  for (let i = 0; i < 6; i++) {
    const error = await globalErrorHandler.handleError(
      new Error(`Service failure ${i + 1}`),
      serviceType
    );
    
    const recovery = await globalRecoveryManager.attemptRecovery(error);
    console.log(`   Failure ${i + 1}: ${recovery.strategy} - ${recovery.message}`);
  }
  
  console.log(`   Final circuit breaker state: ${globalRecoveryManager.getCircuitBreakerState(serviceType)}`);
  console.log(`   Service health: ${globalErrorHandler.isServiceHealthy(serviceType) ? 'Healthy' : 'Unhealthy'}`);
}

// Export for use in other parts of the application
export {
  globalErrorHandler,
  globalRecoveryManager,
  secureLogger
};