import React from 'react';
import { initializeWebSocket, sendAudioChunk, translateText, synthesizeSpeech } from '../lib/aws-websocket-service';

/**
 * Initialize AWS services when the application starts
 */
export async function initializeAwsServices(): Promise<boolean> {
  try {
    // Only initialize if mocks are disabled
    if (process.env.NEXT_PUBLIC_MOCK_SERVICES !== 'true') {
      console.log('Initializing AWS services');
      await initializeWebSocket();
      return true;
    }
    return false;
  } catch (error) {
    console.error('Failed to initialize AWS services:', error);
    return false;
  }
}

/**
 * Helper to check if mocks are enabled
 */
export function isMockModeEnabled(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_SERVICES === 'true';
}

/**
 * Hook to help with initializing AWS services in components
 */
export function useAwsServices() {
  const [initialized, setInitialized] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);

  React.useEffect(() => {
    async function init() {
      try {
        if (!isMockModeEnabled()) {
          const success = await initializeAwsServices();
          setInitialized(success);
        } else {
          setInitialized(true); // Mock mode is considered "initialized"
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setInitialized(false);
      }
    }

    init();
  }, []);

  return { initialized, error, isMockMode: isMockModeEnabled() };
}
