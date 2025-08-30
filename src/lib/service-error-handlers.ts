/**
 * Service-Specific Error Handlers
 * Implements specialized error handling for each AWS service
 */

import { 
  ErrorHandler, 
  ServiceType, 
  ErrorCategory, 
  EnhancedServiceError,
  globalErrorHandler 
} from './error-handling';
import { ServiceError } from './types';
import { debugLog } from './aws-utils';

/**
 * WebSocket Error Handler
 */
export class WebSocketErrorHandler {
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isReconnecting = false;

  async handleConnectionError(
    error: Error,
    onReconnect?: () => Promise<void>
  ): Promise<EnhancedServiceError> {
    const enhancedError = await globalErrorHandler.handleError(
      error,
      ServiceType.WEBSOCKET,
      { reconnectAttempts: this.reconnectAttempts }
    );

    // Attempt automatic reconnection for network errors
    if (enhancedError.category === ErrorCategory.NETWORK && onReconnect && !this.isReconnecting) {
      this.attemptReconnection(onReconnect);
    }

    return enhancedError;
  }

  private async attemptReconnection(onReconnect: () => Promise<void>): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      debugLog('Max reconnection attempts reached for WebSocket');
      return;
    }

    this.isReconnecting = true;
    this.reconnectAttempts++;

    try {
      await new Promise(resolve => setTimeout(resolve, this.reconnectDelay));
      await onReconnect();
      
      // Reset on successful reconnection
      this.reconnectAttempts = 0;
      this.isReconnecting = false;
      
      debugLog('WebSocket reconnection successful');
    } catch (error) {
      this.isReconnecting = false;
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30000); // Max 30 seconds
      
      debugLog(`WebSocket reconnection failed, attempt ${this.reconnectAttempts}`, {
        error: error instanceof Error ? error.message : 'Unknown error',
        nextDelay: this.reconnectDelay
      });
    }
  }

  resetReconnectionState(): void {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    this.isReconnecting = false;
  }
}

/**
 * Transcribe Service Error Handler
 */
export class TranscribeErrorHandler {
  private fallbackActive = false;

  async handleTranscribeError(
    error: Error,
    isMedical: boolean = true
  ): Promise<EnhancedServiceError> {
    const serviceType = isMedical ? ServiceType.TRANSCRIBE_MEDICAL : ServiceType.TRANSCRIBE_STANDARD;
    
    const enhancedError = await globalErrorHandler.handleError(
      error,
      serviceType,
      { isMedical, fallbackActive: this.fallbackActive }
    );

    // Handle specific Transcribe errors
    if (this.isTranscribeSpecificError(error)) {
      return this.handleSpecificTranscribeError(error, serviceType);
    }

    // Trigger fallback if Medical Transcribe fails
    if (isMedical && !this.fallbackActive && this.shouldFallbackToStandard(enhancedError)) {
      this.fallbackActive = true;
      debugLog('Falling back from Transcribe Medical to Standard Transcribe');
    }

    return enhancedError;
  }

  private isTranscribeSpecificError(error: Error): boolean {
    const transcribeErrors = [
      'InvalidSampleRateException',
      'BadRequestException',
      'LimitExceededException',
      'ConflictException'
    ];
    
    return transcribeErrors.some(errorType => error.message.includes(errorType));
  }

  private async handleSpecificTranscribeError(
    error: Error,
    serviceType: ServiceType
  ): Promise<EnhancedServiceError> {
    let category = ErrorCategory.UNKNOWN;
    let userMessage = '';
    let recoveryActions: string[] = [];

    if (error.message.includes('InvalidSampleRateException')) {
      category = ErrorCategory.VALIDATION;
      userMessage = 'Audio format is not supported. Please check your microphone settings.';
      recoveryActions = [
        'Check microphone settings',
        'Try using a different audio input device',
        'Ensure audio sample rate is 16kHz or 8kHz'
      ];
    } else if (error.message.includes('LimitExceededException')) {
      category = ErrorCategory.RATE_LIMIT;
      userMessage = 'Too many transcription requests. Please wait before trying again.';
      recoveryActions = [
        'Wait 30 seconds before starting new transcription',
        'Reduce the frequency of audio chunks'
      ];
    } else if (error.message.includes('BadRequestException')) {
      category = ErrorCategory.VALIDATION;
      userMessage = 'Invalid transcription request. Please check your settings.';
      recoveryActions = [
        'Verify language selection',
        'Check audio input settings',
        'Try restarting the transcription session'
      ];
    }

    return {
      ...await globalErrorHandler.handleError(error, serviceType),
      category,
      userMessage,
      recoveryActions
    };
  }

  private shouldFallbackToStandard(error: EnhancedServiceError): boolean {
    const fallbackCategories = [
      ErrorCategory.SERVICE_UNAVAILABLE,
      ErrorCategory.RATE_LIMIT,
      ErrorCategory.TIMEOUT
    ];
    
    return fallbackCategories.includes(error.category);
  }

  isFallbackActive(): boolean {
    return this.fallbackActive;
  }

  resetFallback(): void {
    this.fallbackActive = false;
  }
}

/**
 * Translation Service Error Handler
 */
export class TranslationErrorHandler {
  async handleTranslationError(
    error: Error,
    sourceLang?: string,
    targetLang?: string
  ): Promise<EnhancedServiceError> {
    const enhancedError = await globalErrorHandler.handleError(
      error,
      ServiceType.TRANSLATE,
      { sourceLang, targetLang }
    );

    // Handle language-specific errors
    if (this.isLanguageError(error)) {
      return this.handleLanguageError(error, sourceLang, targetLang);
    }

    return enhancedError;
  }

  private isLanguageError(error: Error): boolean {
    const languageErrors = [
      'UnsupportedLanguagePairException',
      'InvalidLanguageCodeException',
      'TextSizeLimitExceededException'
    ];
    
    return languageErrors.some(errorType => error.message.includes(errorType));
  }

  private async handleLanguageError(
    error: Error,
    sourceLang?: string,
    targetLang?: string
  ): Promise<EnhancedServiceError> {
    let userMessage = '';
    let recoveryActions: string[] = [];

    if (error.message.includes('UnsupportedLanguagePairException')) {
      userMessage = `Translation from ${sourceLang} to ${targetLang} is not supported.`;
      recoveryActions = [
        'Try a different target language',
        'Check supported language combinations',
        'Contact support for language support requests'
      ];
    } else if (error.message.includes('TextSizeLimitExceededException')) {
      userMessage = 'Text is too long for translation. Please use shorter segments.';
      recoveryActions = [
        'Break text into smaller segments',
        'Reduce the length of audio input',
        'Try translating in smaller chunks'
      ];
    }

    return {
      ...await globalErrorHandler.handleError(error, ServiceType.TRANSLATE),
      category: ErrorCategory.VALIDATION,
      userMessage,
      recoveryActions
    };
  }
}

/**
 * Bedrock AI Error Handler
 */
export class BedrockErrorHandler {
  private aiEnhancementDisabled = false;

  async handleBedrockError(
    error: Error,
    operation: 'enhancement' | 'normalization' | 'context'
  ): Promise<EnhancedServiceError> {
    const enhancedError = await globalErrorHandler.handleError(
      error,
      ServiceType.BEDROCK,
      { operation, aiEnhancementDisabled: this.aiEnhancementDisabled }
    );

    // Disable AI enhancement if Bedrock is consistently failing
    if (this.shouldDisableAIEnhancement(enhancedError)) {
      this.aiEnhancementDisabled = true;
      debugLog('AI enhancement disabled due to Bedrock service issues');
    }

    return enhancedError;
  }

  private shouldDisableAIEnhancement(error: EnhancedServiceError): boolean {
    const health = globalErrorHandler.getServiceHealth(ServiceType.BEDROCK);
    return health ? health.consecutiveErrors >= 3 : false;
  }

  isAIEnhancementDisabled(): boolean {
    return this.aiEnhancementDisabled;
  }

  enableAIEnhancement(): void {
    this.aiEnhancementDisabled = false;
    globalErrorHandler.markServiceHealthy(ServiceType.BEDROCK);
  }
}

/**
 * Polly TTS Error Handler
 */
export class PollyErrorHandler {
  async handlePollyError(
    error: Error,
    text?: string,
    language?: string,
    voiceId?: string
  ): Promise<EnhancedServiceError> {
    const enhancedError = await globalErrorHandler.handleError(
      error,
      ServiceType.POLLY,
      { text: text?.substring(0, 100), language, voiceId } // Limit text in context
    );

    // Handle Polly-specific errors
    if (this.isPollySpecificError(error)) {
      return this.handleSpecificPollyError(error, language, voiceId);
    }

    return enhancedError;
  }

  private isPollySpecificError(error: Error): boolean {
    const pollyErrors = [
      'InvalidSsmlException',
      'TextLengthExceededException',
      'InvalidVoiceIdException',
      'LanguageNotSupportedException'
    ];
    
    return pollyErrors.some(errorType => error.message.includes(errorType));
  }

  private async handleSpecificPollyError(
    error: Error,
    language?: string,
    voiceId?: string
  ): Promise<EnhancedServiceError> {
    let userMessage = '';
    let recoveryActions: string[] = [];

    if (error.message.includes('InvalidVoiceIdException')) {
      userMessage = `Voice "${voiceId}" is not available for ${language}.`;
      recoveryActions = [
        'Try using the default voice',
        'Select a different voice for this language',
        'Check available voices for the selected language'
      ];
    } else if (error.message.includes('TextLengthExceededException')) {
      userMessage = 'Text is too long for speech synthesis.';
      recoveryActions = [
        'Break text into smaller segments',
        'Reduce the length of translated text',
        'Try synthesizing shorter phrases'
      ];
    } else if (error.message.includes('LanguageNotSupportedException')) {
      userMessage = `Speech synthesis is not available for ${language}.`;
      recoveryActions = [
        'Try a different target language',
        'Check supported languages for text-to-speech',
        'Use text display instead of audio'
      ];
    }

    return {
      ...await globalErrorHandler.handleError(error, ServiceType.POLLY),
      category: ErrorCategory.VALIDATION,
      userMessage,
      recoveryActions
    };
  }
}

/**
 * Storage Error Handler (S3 and DynamoDB)
 */
export class StorageErrorHandler {
  async handleS3Error(error: Error, operation: string): Promise<EnhancedServiceError> {
    return globalErrorHandler.handleError(
      error,
      ServiceType.S3,
      { operation }
    );
  }

  async handleDynamoDBError(error: Error, operation: string): Promise<EnhancedServiceError> {
    const enhancedError = await globalErrorHandler.handleError(
      error,
      ServiceType.DYNAMODB,
      { operation }
    );

    // Handle DynamoDB-specific errors
    if (this.isDynamoDBSpecificError(error)) {
      return this.handleSpecificDynamoDBError(error, operation);
    }

    return enhancedError;
  }

  private isDynamoDBSpecificError(error: Error): boolean {
    const dynamoErrors = [
      'ProvisionedThroughputExceededException',
      'ItemCollectionSizeLimitExceededException',
      'ConditionalCheckFailedException'
    ];
    
    return dynamoErrors.some(errorType => error.message.includes(errorType));
  }

  private async handleSpecificDynamoDBError(
    error: Error,
    operation: string
  ): Promise<EnhancedServiceError> {
    let category = ErrorCategory.UNKNOWN;
    let userMessage = '';

    if (error.message.includes('ProvisionedThroughputExceededException')) {
      category = ErrorCategory.RATE_LIMIT;
      userMessage = 'System is experiencing high load. Please try again in a moment.';
    } else if (error.message.includes('ConditionalCheckFailedException')) {
      category = ErrorCategory.VALIDATION;
      userMessage = 'Data conflict detected. Please refresh and try again.';
    }

    return {
      ...await globalErrorHandler.handleError(error, ServiceType.DYNAMODB),
      category,
      userMessage
    };
  }
}

/**
 * Authentication Error Handler
 */
export class AuthErrorHandler {
  async handleAuthError(error: Error): Promise<EnhancedServiceError> {
    const enhancedError = await globalErrorHandler.handleError(
      error,
      ServiceType.COGNITO,
      { authError: true }
    );

    // Handle Cognito-specific errors
    if (this.isCognitoSpecificError(error)) {
      return this.handleSpecificCognitoError(error);
    }

    return enhancedError;
  }

  private isCognitoSpecificError(error: Error): boolean {
    const cognitoErrors = [
      'NotAuthorizedException',
      'UserNotConfirmedException',
      'PasswordResetRequiredException',
      'UserNotFoundException',
      'TooManyRequestsException'
    ];
    
    return cognitoErrors.some(errorType => error.message.includes(errorType));
  }

  private async handleSpecificCognitoError(error: Error): Promise<EnhancedServiceError> {
    let userMessage = '';
    let recoveryActions: string[] = [];

    if (error.message.includes('NotAuthorizedException')) {
      userMessage = 'Invalid credentials. Please check your username and password.';
      recoveryActions = [
        'Verify your username and password',
        'Try signing in again',
        'Reset your password if needed'
      ];
    } else if (error.message.includes('UserNotConfirmedException')) {
      userMessage = 'Please confirm your email address before signing in.';
      recoveryActions = [
        'Check your email for confirmation link',
        'Resend confirmation email',
        'Contact support if you need help'
      ];
    } else if (error.message.includes('TooManyRequestsException')) {
      userMessage = 'Too many sign-in attempts. Please wait before trying again.';
      recoveryActions = [
        'Wait 15 minutes before trying again',
        'Reset your password if you\'re having trouble'
      ];
    }

    return {
      ...await globalErrorHandler.handleError(error, ServiceType.COGNITO),
      category: ErrorCategory.AUTHENTICATION,
      userMessage,
      recoveryActions
    };
  }
}

// Export service-specific error handler instances
export const webSocketErrorHandler = new WebSocketErrorHandler();
export const transcribeErrorHandler = new TranscribeErrorHandler();
export const translationErrorHandler = new TranslationErrorHandler();
export const bedrockErrorHandler = new BedrockErrorHandler();
export const pollyErrorHandler = new PollyErrorHandler();
export const storageErrorHandler = new StorageErrorHandler();
export const authErrorHandler = new AuthErrorHandler();