/**
 * Configuration management for Healthcare Translation App
 * Centralizes environment variables and app settings
 */

import { AppConfig } from './types';

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = ['NEXT_PUBLIC_AWS_REGION'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.warn(`Missing environment variables: ${missing.join(', ')}`);
  }
}

/**
 * Get complete application configuration
 */
export function getConfig(): AppConfig {
  validateEnvironment();
  
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
 * Check if all required services are configured
 */
export function areServicesConfigured(): boolean {
  const config = getConfig();
  return !!(
    config.aws.websocketUrl &&
    config.aws.transcribeUrl &&
    config.aws.translationUrl &&
    config.aws.ttsUrl
  );
}

/**
 * Get service status for debugging
 */
export function getServiceStatus() {
  const config = getConfig();
  return {
    websocket: !!config.aws.websocketUrl,
    transcribe: !!config.aws.transcribeUrl,
    translation: !!config.aws.translationUrl,
    tts: !!config.aws.ttsUrl,
    mockMode: config.features.mockServices,
  };
}