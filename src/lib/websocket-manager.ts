/**
 * WebSocket Manager for Healthcare Translation App
 * Handles connection lifecycle, automatic reconnection, and message queuing
 */

export interface WebSocketMessage {
  action: string;
  data: any;
  sessionId?: string;
  requestId?: string;
}

export interface WebSocketResponse {
  success: boolean;
  action: string;
  data?: any;
  error?: string;
  requestId?: string;
}

export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error'
}

export interface WebSocketManagerConfig {
  url: string;
  maxReconnectAttempts?: number;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectBackoffMultiplier?: number;
  heartbeatInterval?: number;
  messageTimeout?: number;
}

export interface PendingMessage {
  id: string;
  message: WebSocketMessage;
  timestamp: number;
  resolve: (response: WebSocketResponse) => void;
  reject: (error: Error) => void;
  timeout?: NodeJS.Timeout;
}

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketManagerConfig>;
  private status: ConnectionStatus = ConnectionStatus.DISCONNECTED;
  private reconnectAttempts = 0;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private pendingMessages = new Map<string, PendingMessage>();
  private listeners = new Map<string, Set<(data: any) => void>>();
  private statusListeners = new Set<(status: ConnectionStatus) => void>();

  constructor(config: WebSocketManagerConfig) {
    this.config = {
      maxReconnectAttempts: 10,
      reconnectInterval: 1000,
      maxReconnectInterval: 30000,
      reconnectBackoffMultiplier: 1.5,
      heartbeatInterval: 30000,
      messageTimeout: 10000,
      ...config
    };
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this.status === ConnectionStatus.CONNECTING || this.status === ConnectionStatus.CONNECTED) {
      return;
    }

    this.setStatus(ConnectionStatus.CONNECTING);

    try {
      this.ws = new WebSocket(this.config.url);
      this.setupEventHandlers();

      return new Promise((resolve, reject) => {
        let connectionTimeout: NodeJS.Timeout;
        let isInitialConnection = this.reconnectAttempts === 0;
        
        const cleanup = () => {
          if (connectionTimeout) clearTimeout(connectionTimeout);
          this.ws?.removeEventListener('open', onOpen);
          this.ws?.removeEventListener('error', onError);
          this.ws?.removeEventListener('close', onClose);
        };

        const onOpen = () => {
          cleanup();
          resolve();
        };

        const onError = (error: Event) => {
          console.error('WebSocket connection error:', error);
          cleanup();
          // Don't reject immediately, let the close handler deal with it
        };

        const onClose = (event: CloseEvent) => {
          cleanup();
          if (event.code !== 1000) {
            // For initial connection, don't reject immediately if we plan to reconnect
            if (isInitialConnection && this.reconnectAttempts < this.config.maxReconnectAttempts) {
              console.log('Initial connection failed, starting automatic reconnection...');
              this.setStatus(ConnectionStatus.RECONNECTING);
              this.scheduleReconnect();
              // Resolve to indicate connection process started (UI will show reconnecting)
              resolve();
            } else {
              // Abnormal closure, start reconnection process
              this.setStatus(ConnectionStatus.RECONNECTING);
              this.scheduleReconnect();
              reject(new Error(`WebSocket connection failed (code: ${event.code}). Reconnection will be attempted automatically.`));
            }
          }
        };

        // Set a shorter timeout for initial connection to allow for quick retry
        connectionTimeout = setTimeout(() => {
          cleanup();
          if (this.ws && this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.close();
            if (isInitialConnection) {
              console.log('Initial connection timeout, starting automatic reconnection...');
              this.setStatus(ConnectionStatus.RECONNECTING);
              this.scheduleReconnect();
              resolve(); // Don't reject on initial timeout
            } else {
              reject(new Error('WebSocket connection timeout. Reconnection will be attempted automatically.'));
            }
          }
        }, 5000); // 5 second timeout for initial connection

        this.ws?.addEventListener('open', onOpen);
        this.ws?.addEventListener('error', onError);
        this.ws?.addEventListener('close', onClose);
      });
    } catch (error) {
      this.setStatus(ConnectionStatus.ERROR);
      throw error;
    }
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.clearReconnectTimeout();
    this.clearHeartbeat();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    
    this.setStatus(ConnectionStatus.DISCONNECTED);
    this.rejectPendingMessages(new Error('WebSocket disconnected'));
  }

  /**
   * Send a message and wait for response
   */
  async sendMessage(message: WebSocketMessage): Promise<WebSocketResponse> {
    if (this.status !== ConnectionStatus.CONNECTED) {
      // Queue message if not connected
      this.messageQueue.push(message);
      throw new Error('WebSocket not connected. Message queued for retry.');
    }

    const requestId = message.requestId || this.generateRequestId();
    const messageWithId = { ...message, requestId };

    return new Promise((resolve, reject) => {
      const pendingMessage: PendingMessage = {
        id: requestId,
        message: messageWithId,
        timestamp: Date.now(),
        resolve,
        reject,
        timeout: setTimeout(() => {
          this.pendingMessages.delete(requestId);
          reject(new Error('Message timeout'));
        }, this.config.messageTimeout)
      };

      this.pendingMessages.set(requestId, pendingMessage);

      try {
        this.ws?.send(JSON.stringify(messageWithId));
      } catch (error) {
        this.pendingMessages.delete(requestId);
        if (pendingMessage.timeout) {
          clearTimeout(pendingMessage.timeout);
        }
        reject(error);
      }
    });
  }

  /**
   * Send a message without waiting for response (fire and forget)
   */
  sendMessageAsync(message: WebSocketMessage): void {
    if (this.status !== ConnectionStatus.CONNECTED) {
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws?.send(JSON.stringify(message));
    } catch (error) {
      console.error('Failed to send async message:', error);
      this.messageQueue.push(message);
    }
  }

  /**
   * Add event listener for specific action types
   */
  addEventListener(action: string, listener: (data: any) => void): void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set());
    }
    this.listeners.get(action)!.add(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(action: string, listener: (data: any) => void): void {
    const actionListeners = this.listeners.get(action);
    if (actionListeners) {
      actionListeners.delete(listener);
      if (actionListeners.size === 0) {
        this.listeners.delete(action);
      }
    }
  }

  /**
   * Add status change listener
   */
  addStatusListener(listener: (status: ConnectionStatus) => void): void {
    this.statusListeners.add(listener);
  }

  /**
   * Remove status change listener
   */
  removeStatusListener(listener: (status: ConnectionStatus) => void): void {
    this.statusListeners.delete(listener);
  }

  /**
   * Get current connection status
   */
  getStatus(): ConnectionStatus {
    return this.status;
  }

  /**
   * Get connection statistics
   */
  getStats() {
    return {
      status: this.status,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      pendingMessages: this.pendingMessages.size,
      activeListeners: Array.from(this.listeners.keys()).length
    };
  }

  private setupEventHandlers(): void {
    if (!this.ws) return;

    this.ws.addEventListener('open', this.handleOpen.bind(this));
    this.ws.addEventListener('close', this.handleClose.bind(this));
    this.ws.addEventListener('error', this.handleError.bind(this));
    this.ws.addEventListener('message', this.handleMessage.bind(this));
  }

  private handleOpen(): void {
    console.log('WebSocket connected');
    this.clearReconnectTimeout(); // Clear any pending reconnection
    this.setStatus(ConnectionStatus.CONNECTED);
    this.reconnectAttempts = 0;
    this.startHeartbeat();
    this.processMessageQueue();
  }

  private handleClose(event: CloseEvent): void {
    console.log('WebSocket closed:', event.code, event.reason);
    this.clearHeartbeat();
    
    if (event.code !== 1000) { // Not a normal closure
      this.setStatus(ConnectionStatus.RECONNECTING);
      this.scheduleReconnect();
    } else {
      this.setStatus(ConnectionStatus.DISCONNECTED);
    }
  }

  private handleError(error: Event): void {
    console.error('WebSocket error:', error);
    this.setStatus(ConnectionStatus.ERROR);
  }

  private handleMessage(event: MessageEvent): void {
    try {
      const response: WebSocketResponse = JSON.parse(event.data);
      
      // Handle response to pending message
      if (response.requestId && this.pendingMessages.has(response.requestId)) {
        const pendingMessage = this.pendingMessages.get(response.requestId)!;
        this.pendingMessages.delete(response.requestId);
        
        if (pendingMessage.timeout) {
          clearTimeout(pendingMessage.timeout);
        }
        
        if (response.success) {
          pendingMessage.resolve(response);
        } else {
          pendingMessage.reject(new Error(response.error || 'Unknown error'));
        }
        return;
      }

      // Handle broadcast messages
      const actionListeners = this.listeners.get(response.action);
      if (actionListeners) {
        actionListeners.forEach(listener => {
          try {
            listener(response.data);
          } catch (error) {
            console.error('Error in message listener:', error);
          }
        });
      }
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
    }
  }

  private scheduleReconnect(): void {
    // Prevent multiple reconnection attempts
    if (this.reconnectTimeout) {
      return;
    }

    if (this.reconnectAttempts >= this.config.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached');
      this.setStatus(ConnectionStatus.ERROR);
      return;
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(this.config.reconnectBackoffMultiplier, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );

    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectAttempts++;
      this.reconnectTimeout = null; // Clear the timeout reference
      this.connect().catch(error => {
        console.error('Reconnection failed:', error);
        // Only schedule another reconnect if we're still in reconnecting state
        if (this.status === ConnectionStatus.RECONNECTING) {
          this.scheduleReconnect();
        }
      });
    }, delay);
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.sendMessageAsync({ action: 'ping', data: {} });
    }, this.config.heartbeatInterval);
  }

  private clearHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private processMessageQueue(): void {
    const queue = [...this.messageQueue];
    this.messageQueue = [];
    
    queue.forEach(message => {
      this.sendMessageAsync(message);
    });
  }

  private rejectPendingMessages(error: Error): void {
    this.pendingMessages.forEach(pendingMessage => {
      if (pendingMessage.timeout) {
        clearTimeout(pendingMessage.timeout);
      }
      pendingMessage.reject(error);
    });
    this.pendingMessages.clear();
  }

  private setStatus(status: ConnectionStatus): void {
    if (this.status !== status) {
      const oldStatus = this.status;
      this.status = status;
      console.log(`WebSocket status changed: ${oldStatus} -> ${status}`);
      console.log(`Notifying ${this.statusListeners.size} status listeners`);
      this.statusListeners.forEach(listener => {
        try {
          listener(status);
        } catch (error) {
          console.error('Error in status listener:', error);
        }
      });
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}