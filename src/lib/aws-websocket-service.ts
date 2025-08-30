/**
 * AWS WebSocket Service for Healthcare Translation App
 * Handles real-time communication with AWS API Gateway WebSocket
 */

import { WebSocketManager, ConnectionStatus, WebSocketMessage, WebSocketResponse } from './websocket-manager';

// Re-export ConnectionStatus for external use
export { ConnectionStatus };
import { createServiceError } from './aws-utils';
import { runWebSocketDiagnostic, getEnvironmentInfo } from './websocket-diagnostic';

interface WebSocketTranscriptionResponse {
  text: string;
  confidence: number;
  isFinal: boolean;
}

interface WebSocketTranslationResponse {
  original: string;
  translated: string;
  language: string;
}

interface WebSocketTTSResponse {
  audioUrl: string;
  text: string;
}

interface WebSocketErrorResponse {
  code: string;
  message: string;
  service: string;
}

let websocketManager: WebSocketManager | null = null;
let isFirstConnection = true;
let diagnosticRun = false;

/**
 * Initialize WebSocket connection to AWS
 */
export async function initializeWebSocket(): Promise<void> {
  try {
    // Check if already initialized
    if (websocketManager?.getStatus() === ConnectionStatus.CONNECTED) {
      console.log('WebSocket already connected');
      return;
    }
    
    // Check if mock mode is forced via localStorage
    const forceMockMode = localStorage.getItem('force_mock_mode') === 'true';
    if (forceMockMode) {
      console.warn('Mock mode is forced via localStorage. Not connecting to WebSocket.');
      throw createServiceError(
        'WEBSOCKET_MOCK_MODE',
        'Using mock mode as requested. WebSocket connection skipped.',
        'WebSocketService',
        false
      );
    }
    
    const websocketUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_WEBSOCKET_API_URL;
    
    if (!websocketUrl) {
      throw createServiceError(
        'WEBSOCKET_URL_MISSING',
        'WebSocket URL is not configured in environment variables.',
        'WebSocketService',
        false
      );
    }

    console.log('Initializing WebSocket connection to:', websocketUrl);
    
    // Run diagnostic if this is the first connection attempt
    if (isFirstConnection && !diagnosticRun) {
      diagnosticRun = true;
      console.log('Running diagnostic before first connection attempt...');
      
      try {
        const diagnosticResult = await runWebSocketDiagnostic(websocketUrl);
        console.log('WebSocket diagnostic result:', diagnosticResult);
        
        if (!diagnosticResult.success) {
          console.error('WebSocket diagnostic failed. Check CORS settings on your API Gateway.');
          console.log('Environment info:', getEnvironmentInfo());
        }
      } catch (diagError) {
        console.error('Error running WebSocket diagnostic:', diagError);
      }
    }
    
    isFirstConnection = false;

    // Temporarily enable fallback to mock mode if connection fails repeatedly
    const failedAttempts = localStorage.getItem('websocket_failed_attempts');
    const failCount = failedAttempts ? parseInt(failedAttempts, 10) : 0;
    
    if (failCount > 3) {
      console.warn('Multiple WebSocket connection failures detected. Consider enabling mock mode.');
      // You could automatically switch to mock mode here if needed
    }

    // Add query parameters for authentication if needed
    const urlWithParams = new URL(websocketUrl);
    
    // Add a diagnostic parameter to help with debugging
    urlWithParams.searchParams.append('client', 'web');
    urlWithParams.searchParams.append('version', '1.0.0');
    
    // You might need to add authentication tokens or other parameters
    // Example: urlWithParams.searchParams.append('token', 'your-auth-token');
    
    websocketManager = new WebSocketManager({
      url: urlWithParams.toString(),
      maxReconnectAttempts: 3, // Reduce attempts to avoid excessive reconnection
      reconnectInterval: 2000,
      maxReconnectInterval: 10000,
      heartbeatInterval: 30000,
      messageTimeout: 15000 // Increase timeout for slower connections
    });

    // Add a status listener to log connection status changes
    websocketManager.addStatusListener((status) => {
      console.log(`WebSocket connection status changed: ${status}`);
      
      // Record failure for future reference
      if (status === ConnectionStatus.ERROR) {
        const currentCount = localStorage.getItem('websocket_failed_attempts');
        const count = currentCount ? parseInt(currentCount, 10) : 0;
        localStorage.setItem('websocket_failed_attempts', (count + 1).toString());
      }
    });

    await websocketManager.connect();
    console.log('WebSocket connected successfully');
    
    // Clear failure count on successful connection
    localStorage.removeItem('websocket_failed_attempts');
  } catch (error) {
    console.error('Failed to connect to WebSocket:', error);
    
    // For debugging - log more details about the error
    if (error instanceof Error) {
      console.error('Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
    }
    
    // Increment connection failure count
    const currentCount = localStorage.getItem('websocket_failed_attempts');
    const count = currentCount ? parseInt(currentCount, 10) : 0;
    localStorage.setItem('websocket_failed_attempts', (count + 1).toString());
    
    throw createServiceError(
      'WEBSOCKET_CONNECTION_FAILED',
      error instanceof Error ? error.message : 'WebSocket connection failed',
      'WebSocketService',
      true
    );
  }
}

/**
 * Send audio chunk for transcription
 */
export async function sendAudioChunk(
  audioData: ArrayBuffer,
  languageCode: string,
  sessionId: string
): Promise<WebSocketTranscriptionResponse | null> {
  if (!websocketManager) {
    console.warn('WebSocket not initialized. Initializing now...');
    await initializeWebSocket();
  }

  if (websocketManager?.getStatus() !== ConnectionStatus.CONNECTED) {
    console.warn('WebSocket not connected. Attempting reconnection...');
    await websocketManager?.connect();
  }

  try {
    // Convert ArrayBuffer to Base64
    const base64Audio = arrayBufferToBase64(audioData);

    const response = await websocketManager?.sendMessage({
      action: 'transcribe',
      data: {
        audio: base64Audio,
        languageCode,
        sessionId
      }
    });

    if (response && response.success) {
      // Validate the response has the expected structure
      const responseData = response.data as Record<string, unknown>;
      if (
        typeof responseData?.text === 'string' &&
        typeof responseData?.confidence === 'number' &&
        typeof responseData?.isFinal === 'boolean'
      ) {
        return {
          text: responseData.text,
          confidence: responseData.confidence,
          isFinal: responseData.isFinal
        };
      }
      console.error('Invalid transcription response format:', responseData);
      return null;
    } else {
      console.error('Transcription failed:', response?.error);
      return null;
    }
  } catch (error) {
    console.error('Error sending audio chunk:', error);
    return null;
  }
}

/**
 * Request translation of text
 */
export async function translateText(
  text: string,
  sourceLanguage: string,
  targetLanguage: string,
  sessionId: string
): Promise<WebSocketTranslationResponse | null> {
  if (!websocketManager) {
    console.warn('WebSocket not initialized. Initializing now...');
    await initializeWebSocket();
  }

  if (websocketManager?.getStatus() !== ConnectionStatus.CONNECTED) {
    console.warn('WebSocket not connected. Attempting reconnection...');
    await websocketManager?.connect();
  }

  try {
    const response = await websocketManager?.sendMessage({
      action: 'translate',
      data: {
        text,
        sourceLanguage,
        targetLanguage,
        sessionId
      }
    });

    if (response && response.success) {
      // Validate response structure
      const responseData = response.data as Record<string, unknown>;
      if (
        typeof responseData?.original === 'string' &&
        typeof responseData?.translated === 'string' &&
        typeof responseData?.language === 'string'
      ) {
        return {
          original: responseData.original,
          translated: responseData.translated,
          language: responseData.language
        };
      }
      console.error('Invalid translation response format:', responseData);
      return null;
    } else {
      console.error('Translation failed:', response?.error);
      return null;
    }
  } catch (error) {
    console.error('Error requesting translation:', error);
    return null;
  }
}

/**
 * Request text-to-speech synthesis
 */
export async function synthesizeSpeech(
  text: string,
  languageCode: string,
  sessionId: string
): Promise<WebSocketTTSResponse | null> {
  if (!websocketManager) {
    console.warn('WebSocket not initialized. Initializing now...');
    await initializeWebSocket();
  }

  if (websocketManager?.getStatus() !== ConnectionStatus.CONNECTED) {
    console.warn('WebSocket not connected. Attempting reconnection...');
    await websocketManager?.connect();
  }

  try {
    const response = await websocketManager?.sendMessage({
      action: 'synthesize',
      data: {
        text,
        languageCode,
        sessionId
      }
    });

    if (response && response.success) {
      // Validate response structure
      const responseData = response.data as Record<string, unknown>;
      if (
        typeof responseData?.audioUrl === 'string' &&
        typeof responseData?.text === 'string'
      ) {
        return {
          audioUrl: responseData.audioUrl,
          text: responseData.text
        };
      }
      console.error('Invalid TTS response format:', responseData);
      return null;
    } else {
      console.error('Speech synthesis failed:', response?.error);
      return null;
    }
  } catch (error) {
    console.error('Error requesting speech synthesis:', error);
    return null;
  }
}

/**
 * Register for transcription updates
 */
export function onTranscriptionUpdate(
  callback: (data: WebSocketTranscriptionResponse) => void
): void {
  websocketManager?.addEventListener('transcription-update', (data) => {
    const typedData = data as Record<string, unknown>;
    if (
      typeof typedData.text === 'string' &&
      typeof typedData.confidence === 'number' &&
      typeof typedData.isFinal === 'boolean'
    ) {
      callback({
        text: typedData.text,
        confidence: typedData.confidence,
        isFinal: typedData.isFinal
      });
    } else {
      console.error('Invalid transcription update format:', typedData);
    }
  });
}

/**
 * Register for translation updates
 */
export function onTranslationUpdate(
  callback: (data: WebSocketTranslationResponse) => void
): void {
  websocketManager?.addEventListener('translation-update', (data) => {
    const typedData = data as Record<string, unknown>;
    if (
      typeof typedData.original === 'string' &&
      typeof typedData.translated === 'string' &&
      typeof typedData.language === 'string'
    ) {
      callback({
        original: typedData.original,
        translated: typedData.translated,
        language: typedData.language
      });
    } else {
      console.error('Invalid translation update format:', typedData);
    }
  });
}

/**
 * Register for text-to-speech updates
 */
export function onTTSUpdate(
  callback: (data: WebSocketTTSResponse) => void
): void {
  websocketManager?.addEventListener('tts-update', (data) => {
    const typedData = data as Record<string, unknown>;
    if (
      typeof typedData.audioUrl === 'string' &&
      typeof typedData.text === 'string'
    ) {
      callback({
        audioUrl: typedData.audioUrl,
        text: typedData.text
      });
    } else {
      console.error('Invalid TTS update format:', typedData);
    }
  });
}

/**
 * Register for error updates
 */
export function onWebSocketError(
  callback: (data: WebSocketErrorResponse) => void
): void {
  websocketManager?.addEventListener('error', (data) => {
    const typedData = data as Record<string, unknown>;
    if (
      typeof typedData.code === 'string' &&
      typeof typedData.message === 'string' &&
      typeof typedData.service === 'string'
    ) {
      callback({
        code: typedData.code,
        message: typedData.message,
        service: typedData.service
      });
    } else {
      console.error('Invalid error update format:', typedData);
    }
  });
}

/**
 * Close WebSocket connection
 */
export function closeWebSocketConnection(): void {
  if (websocketManager) {
    websocketManager.disconnect();
    websocketManager = null;
    console.log('WebSocket connection closed');
  }
}

/**
 * Get WebSocket connection status
 */
export function getWebSocketStatus(): ConnectionStatus {
  return websocketManager?.getStatus() || ConnectionStatus.DISCONNECTED;
}

/**
 * Check if WebSocket is connected
 */
export function isWebSocketConnected(): boolean {
  return websocketManager?.getStatus() === ConnectionStatus.CONNECTED;
}

/**
 * Helper function to convert ArrayBuffer to Base64 string
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  try {
    const binary = [];
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    
    for (let i = 0; i < len; i++) {
      binary.push(String.fromCharCode(bytes[i]));
    }
    
    return btoa(binary.join(''));
  } catch (error) {
    console.error('Error converting ArrayBuffer to Base64:', error);
    throw new Error('Failed to convert audio data to Base64');
  }
}
