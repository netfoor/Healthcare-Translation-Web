import { useEffect, useRef, useState, useCallback } from 'react';
import { 
  WebSocketManager, 
  WebSocketMessage, 
  WebSocketResponse, 
  ConnectionStatus,
  WebSocketManagerConfig 
} from '../lib/websocket-manager';

export interface UseWebSocketOptions {
  url: string;
  autoConnect?: boolean;
  config?: Partial<WebSocketManagerConfig>;
}

export interface UseWebSocketReturn {
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  status: ConnectionStatus;
  isConnected: boolean;
  isConnecting: boolean;
  
  // Message handling
  sendMessage: (message: WebSocketMessage) => Promise<WebSocketResponse>;
  sendMessageAsync: (message: WebSocketMessage) => void;
  
  // Event listeners
  addEventListener: (action: string, listener: (data: any) => void) => void;
  removeEventListener: (action: string, listener: (data: any) => void) => void;
  
  // Statistics
  stats: {
    status: ConnectionStatus;
    reconnectAttempts: number;
    queuedMessages: number;
    pendingMessages: number;
    activeListeners: number;
  };
  
  // Error handling
  lastError: Error | null;
}

export function useWebSocket(options: UseWebSocketOptions): UseWebSocketReturn {
  const { url, autoConnect = false, config = {} } = options;
  
  const managerRef = useRef<WebSocketManager | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);
  const [stats, setStats] = useState({
    status: ConnectionStatus.DISCONNECTED,
    reconnectAttempts: 0,
    queuedMessages: 0,
    pendingMessages: 0,
    activeListeners: 0
  });
  const [lastError, setLastError] = useState<Error | null>(null);

  // Initialize WebSocket manager
  useEffect(() => {
    const wsConfig: WebSocketManagerConfig = {
      url,
      ...config
    };
    
    managerRef.current = new WebSocketManager(wsConfig);
    
    // Add status listener
    const statusListener = (newStatus: ConnectionStatus) => {
      console.log(`React hook received status update: ${newStatus}`);
      setStatus(newStatus);
      if (newStatus === ConnectionStatus.ERROR) {
        setLastError(new Error('WebSocket connection error'));
      } else if (newStatus === ConnectionStatus.CONNECTED) {
        setLastError(null);
      }
    };
    
    managerRef.current.addStatusListener(statusListener);
    
    // Update stats periodically
    const statsInterval = setInterval(() => {
      if (managerRef.current) {
        setStats(managerRef.current.getStats());
      }
    }, 1000);
    
    // Auto-connect if enabled
    if (autoConnect) {
      managerRef.current.connect().catch(error => {
        console.error('Auto-connect failed:', error);
        setLastError(error);
      });
    }
    
    return () => {
      clearInterval(statsInterval);
      if (managerRef.current) {
        managerRef.current.removeStatusListener(statusListener);
        managerRef.current.disconnect();
      }
    };
  }, [url, autoConnect, config]);

  const connect = useCallback(async () => {
    if (!managerRef.current) {
      throw new Error('WebSocket manager not initialized');
    }
    
    try {
      await managerRef.current.connect();
      setLastError(null);
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Connection failed');
      setLastError(err);
      throw err;
    }
  }, []);

  const disconnect = useCallback(() => {
    if (managerRef.current) {
      managerRef.current.disconnect();
    }
  }, []);

  const sendMessage = useCallback(async (message: WebSocketMessage): Promise<WebSocketResponse> => {
    if (!managerRef.current) {
      throw new Error('WebSocket manager not initialized');
    }
    
    try {
      const response = await managerRef.current.sendMessage(message);
      return response;
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Send message failed');
      setLastError(err);
      throw err;
    }
  }, []);

  const sendMessageAsync = useCallback((message: WebSocketMessage) => {
    if (!managerRef.current) {
      console.error('WebSocket manager not initialized');
      return;
    }
    
    managerRef.current.sendMessageAsync(message);
  }, []);

  const addEventListener = useCallback((action: string, listener: (data: any) => void) => {
    if (managerRef.current) {
      managerRef.current.addEventListener(action, listener);
    }
  }, []);

  const removeEventListener = useCallback((action: string, listener: (data: any) => void) => {
    if (managerRef.current) {
      managerRef.current.removeEventListener(action, listener);
    }
  }, []);

  return {
    // Connection management
    connect,
    disconnect,
    status,
    isConnected: status === ConnectionStatus.CONNECTED,
    isConnecting: status === ConnectionStatus.CONNECTING || status === ConnectionStatus.RECONNECTING,
    
    // Message handling
    sendMessage,
    sendMessageAsync,
    
    // Event listeners
    addEventListener,
    removeEventListener,
    
    // Statistics
    stats,
    
    // Error handling
    lastError
  };
}