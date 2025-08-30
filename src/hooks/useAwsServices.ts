/**
 * Hook to initialize and manage AWS services
 */

import { useState, useEffect } from 'react';
import { initializeWebSocket, getWebSocketStatus, ConnectionStatus } from '../lib/aws-websocket-service';
import { ServiceError } from '../lib/types';

export interface UseAwsServicesResult {
  initialized: boolean;
  error: ServiceError | null;
  isMockMode: boolean;
  status: ConnectionStatus;
  reinitialize: () => Promise<void>;
}

export function useAwsServices(): UseAwsServicesResult {
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [isMockMode, setIsMockMode] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);

  useEffect(() => {
    let isMounted = true;
    
    const initialize = async () => {
      try {
        // Check for forced mock mode from localStorage
        const forceMockMode = localStorage.getItem('force_mock_mode') === 'true';
        
        // Check environment variable
        const mockModeEnv = process.env.NEXT_PUBLIC_MOCK_SERVICES === 'true';
        
        // Determine if we should use mock mode
        const shouldUseMockMode = forceMockMode || mockModeEnv;
        
        if (shouldUseMockMode) {
          console.log('Using mock services (forced:', forceMockMode, ', env:', mockModeEnv, ')');
          if (isMounted) {
            setIsMockMode(true);
            setInitialized(true);
          }
          return;
        }
        
        // Initialize WebSocket connection for real services
        await initializeWebSocket();
        
        if (isMounted) {
          setInitialized(true);
          setIsMockMode(false);
          setStatus(getWebSocketStatus());
        }
      } catch (err) {
        console.error('Failed to initialize AWS services:', err);
        
        if (isMounted) {
          // If the error is just that we're in mock mode (intentionally), don't treat as error
          if (err && typeof err === 'object' && 'code' in err && err.code === 'WEBSOCKET_MOCK_MODE') {
            setIsMockMode(true);
            setInitialized(true);
          } else {
            setError(err as ServiceError);
            
            // Fall back to mock mode if WebSocket connection fails
            const failedAttempts = localStorage.getItem('websocket_failed_attempts');
            const failCount = failedAttempts ? parseInt(failedAttempts, 10) : 0;
            
            if (failCount > 3) {
              console.warn('Falling back to mock mode due to multiple connection failures');
              setIsMockMode(true);
              setInitialized(true);
            }
          }
        }
      }
    };
    
    // Run initialization
    initialize();
    
    // Update status periodically to detect disconnections
    const intervalId = setInterval(() => {
      const currentStatus = getWebSocketStatus();
      setStatus(currentStatus);
    }, 5000);
    
    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);
  
  /**
   * Reinitialize AWS services
   */
  const reinitialize = async () => {
    setInitialized(false);
    setError(null);
    
    try {
      await initializeWebSocket();
      setInitialized(true);
      setIsMockMode(process.env.NEXT_PUBLIC_MOCK_SERVICES === 'true');
      setStatus(getWebSocketStatus());
    } catch (err) {
      console.error('Failed to reinitialize AWS services:', err);
      setError(err as ServiceError);
      
      // Don't automatically fallback to mock mode on reinitialize
    }
  };
  
  return {
    initialized,
    error,
    isMockMode,
    status,
    reinitialize
  };
}
