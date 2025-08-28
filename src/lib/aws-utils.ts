/**
 * AWS Service Integration Utilities
 * Helper functions for interacting with AWS services
 */

import { AppConfig, ServiceError } from './types';

/**
 * Get application configuration from environment variables
 */
export function getAppConfig(): AppConfig {
  return {
    aws: {
      region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
      websocketUrl: process.env.NEXT_PUBLIC_WEBSOCKET_API_URL,
      transcribeUrl: process.env.NEXT_PUBLIC_TRANSCRIBE_API_URL,
      translationUrl: process.env.NEXT_PUBLIC_TRANSLATION_API_URL,
      ttsUrl: process.env.NEXT_PUBLIC_TTS_API_URL,
    },
    audio: {
      maxDuration: parseInt(process.env.NEXT_PUBLIC_MAX_AUDIO_DURATION || '300'),
      sampleRate: parseInt(process.env.NEXT_PUBLIC_AUDIO_SAMPLE_RATE || '16000'),
      format: 'pcm',
    },
    session: {
      timeoutMinutes: parseInt(process.env.NEXT_PUBLIC_SESSION_TIMEOUT || '1440'),
    },
    features: {
      enableDebugLogging: process.env.NEXT_PUBLIC_ENABLE_DEBUG_LOGGING === 'true',
      mockServices: process.env.NEXT_PUBLIC_MOCK_SERVICES === 'true',
    },
  };
}

/**
 * Create a standardized service error
 */
export function createServiceError(
  code: string,
  message: string,
  service: string,
  retryable: boolean = false
): ServiceError {
  return {
    code,
    message,
    service,
    timestamp: new Date(),
    retryable,
  };
}

/**
 * Validate language code format
 */
export function isValidLanguageCode(code: string): boolean {
  // Basic validation for language codes (e.g., 'en-US', 'es-ES')
  const languageCodeRegex = /^[a-z]{2}(-[A-Z]{2})?$/;
  return languageCodeRegex.test(code);
}

/**
 * Format audio data for AWS Transcribe
 */
export function formatAudioForTranscribe(audioData: ArrayBuffer): ArrayBuffer {
  // Convert audio data to the format expected by AWS Transcribe
  // This is a placeholder - actual implementation will depend on audio format
  return audioData;
}

/**
 * Generate session ID
 */
export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Sanitize text for logging (remove PII)
 */
export function sanitizeForLogging(text: string): string {
  // Remove potential PII from logs for healthcare compliance
  // This is a basic implementation - should be enhanced based on requirements
  return text.replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
             .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]')
             .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]');
}

/**
 * Debug logger that respects configuration
 */
export function debugLog(message: string, data?: any): void {
  const config = getAppConfig();
  if (config.features.enableDebugLogging) {
    console.log(`[Healthcare Translation] ${message}`, data ? sanitizeForLogging(JSON.stringify(data)) : '');
  }
}

/**
 * Error logger for healthcare compliance
 */
export function logError(error: ServiceError | Error, context?: any): void {
  const sanitizedContext = context ? sanitizeForLogging(JSON.stringify(context)) : '';
  console.error(`[Healthcare Translation Error] ${error.message}`, sanitizedContext);
}

/**
 * Retry utility with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  initialDelay: number = 1000
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries) {
        throw lastError;
      }
      
      const delay = initialDelay * Math.pow(2, attempt);
      debugLog(`Retry attempt ${attempt + 1} after ${delay}ms`, { error: lastError.message });
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Get supported languages for healthcare translation
 */
export function getSupportedLanguages() {
  return [
    { code: 'en-US', name: 'English (US)', nativeName: 'English', isSupported: true, isCommon: true },
    { code: 'es-ES', name: 'Spanish (Spain)', nativeName: 'Español', isSupported: true, isCommon: true },
    { code: 'es-MX', name: 'Spanish (Mexico)', nativeName: 'Español (México)', isSupported: true, isCommon: true },
    { code: 'fr-FR', name: 'French', nativeName: 'Français', isSupported: true, isCommon: true },
    { code: 'de-DE', name: 'German', nativeName: 'Deutsch', isSupported: true, isCommon: false },
    { code: 'it-IT', name: 'Italian', nativeName: 'Italiano', isSupported: true, isCommon: false },
    { code: 'pt-BR', name: 'Portuguese (Brazil)', nativeName: 'Português (Brasil)', isSupported: true, isCommon: true },
    { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '中文 (简体)', isSupported: true, isCommon: true },
    { code: 'ja-JP', name: 'Japanese', nativeName: '日本語', isSupported: true, isCommon: false },
    { code: 'ko-KR', name: 'Korean', nativeName: '한국어', isSupported: true, isCommon: false },
  ];
}