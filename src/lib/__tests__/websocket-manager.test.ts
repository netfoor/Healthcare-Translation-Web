/**
 * @jest-environment jsdom
 */

import { WebSocketManager, ConnectionStatus } from '../websocket-manager';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;

  private listeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(url: string) {
    this.url = url;
    // Simulate async connection
    setTimeout(() => {
      this.readyState = MockWebSocket.OPEN;
      this.dispatchEvent(new Event('open'));
    }, 10);
  }

  addEventListener(type: string, listener: (event: any) => void) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(listener);
  }

  removeEventListener(type: string, listener: (event: any) => void) {
    if (this.listeners[type]) {
      const index = this.listeners[type].indexOf(listener);
      if (index > -1) {
        this.listeners[type].splice(index, 1);
      }
    }
  }

  dispatchEvent(event: Event) {
    const listeners = this.listeners[event.type] || [];
    listeners.forEach(listener => listener(event));
    
    // Also call the on* handlers
    if (event.type === 'open' && this.onopen) {
      this.onopen(event);
    } else if (event.type === 'close' && this.onclose) {
      this.onclose(event as CloseEvent);
    } else if (event.type === 'error' && this.onerror) {
      this.onerror(event);
    } else if (event.type === 'message' && this.onmessage) {
      this.onmessage(event as MessageEvent);
    }
  }

  send(data: string) {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open');
    }
    // Echo back the message for testing
    setTimeout(() => {
      const message = JSON.parse(data);
      const response = {
        success: true,
        action: `${message.action}Response`,
        data: { received: message.data },
        requestId: message.requestId
      };
      this.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify(response)
      }));
    }, 5);
  }

  close(code?: number, reason?: string) {
    this.readyState = MockWebSocket.CLOSED;
    this.dispatchEvent(new CloseEvent('close', { code: code || 1000, reason: reason || '' }));
  }
}

// Replace global WebSocket with mock
(global as any).WebSocket = MockWebSocket;

describe('WebSocketManager', () => {
  let manager: WebSocketManager;
  const mockUrl = 'ws://localhost:8080';

  beforeEach(() => {
    manager = new WebSocketManager({
      url: mockUrl,
      maxReconnectAttempts: 3,
      reconnectInterval: 100,
      heartbeatInterval: 1000,
      messageTimeout: 1000
    });
  });

  afterEach(() => {
    manager.disconnect();
  });

  describe('Connection Management', () => {
    test('should connect successfully', async () => {
      const statusListener = jest.fn();
      manager.addStatusListener(statusListener);

      await manager.connect();

      expect(manager.getStatus()).toBe(ConnectionStatus.CONNECTED);
      expect(statusListener).toHaveBeenCalledWith(ConnectionStatus.CONNECTING);
      expect(statusListener).toHaveBeenCalledWith(ConnectionStatus.CONNECTED);
    });

    test('should disconnect properly', async () => {
      await manager.connect();
      expect(manager.getStatus()).toBe(ConnectionStatus.CONNECTED);

      manager.disconnect();
      expect(manager.getStatus()).toBe(ConnectionStatus.DISCONNECTED);
    });

    test('should not connect if already connecting', async () => {
      const connectPromise1 = manager.connect();
      const connectPromise2 = manager.connect();

      await Promise.all([connectPromise1, connectPromise2]);
      expect(manager.getStatus()).toBe(ConnectionStatus.CONNECTED);
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      await manager.connect();
    });

    test('should send message and receive response', async () => {
      const message = {
        action: 'test',
        data: { content: 'hello' }
      };

      const response = await manager.sendMessage(message);

      expect(response.success).toBe(true);
      expect(response.action).toBe('testResponse');
      expect(response.data?.received).toEqual(message.data);
    });

    test('should handle message timeout', async () => {
      // Create a manager with very short timeout
      const shortTimeoutManager = new WebSocketManager({
        url: mockUrl,
        messageTimeout: 1
      });
      await shortTimeoutManager.connect();

      const message = {
        action: 'slowResponse',
        data: {}
      };

      await expect(shortTimeoutManager.sendMessage(message)).rejects.toThrow('Message timeout');
      
      shortTimeoutManager.disconnect();
    });

    test('should queue messages when disconnected', () => {
      manager.disconnect();
      
      const message = {
        action: 'test',
        data: { content: 'queued' }
      };

      // This should not throw, message should be queued
      manager.sendMessageAsync(message);
      
      const stats = manager.getStats();
      expect(stats.queuedMessages).toBe(1);
    });
  });

  describe('Event Listeners', () => {
    beforeEach(async () => {
      await manager.connect();
    });

    test('should add and remove event listeners', () => {
      const listener = jest.fn();
      
      manager.addEventListener('testAction', listener);
      
      const stats = manager.getStats();
      expect(stats.activeListeners).toBe(1);
      
      manager.removeEventListener('testAction', listener);
      
      const updatedStats = manager.getStats();
      expect(updatedStats.activeListeners).toBe(0);
    });

    test('should call event listeners for broadcast messages', (done) => {
      const listener = jest.fn((data) => {
        expect(data.message).toBe('broadcast');
        done();
      });
      
      manager.addEventListener('broadcast', listener);
      
      // Simulate receiving a broadcast message
      const ws = (manager as any).ws as MockWebSocket;
      ws.dispatchEvent(new MessageEvent('message', {
        data: JSON.stringify({
          success: true,
          action: 'broadcast',
          data: { message: 'broadcast' }
        })
      }));
    });
  });

  describe('Status Management', () => {
    test('should notify status listeners', async () => {
      const statusListener = jest.fn();
      manager.addStatusListener(statusListener);

      await manager.connect();
      manager.disconnect();

      expect(statusListener).toHaveBeenCalledWith(ConnectionStatus.CONNECTING);
      expect(statusListener).toHaveBeenCalledWith(ConnectionStatus.CONNECTED);
      expect(statusListener).toHaveBeenCalledWith(ConnectionStatus.DISCONNECTED);
    });

    test('should remove status listeners', async () => {
      const statusListener = jest.fn();
      manager.addStatusListener(statusListener);
      manager.removeStatusListener(statusListener);

      await manager.connect();

      expect(statusListener).not.toHaveBeenCalled();
    });
  });

  describe('Statistics', () => {
    test('should provide accurate statistics', async () => {
      const listener = jest.fn();
      manager.addEventListener('test', listener);
      
      await manager.connect();
      
      const stats = manager.getStats();
      
      expect(stats.status).toBe(ConnectionStatus.CONNECTED);
      expect(stats.reconnectAttempts).toBe(0);
      expect(stats.queuedMessages).toBe(0);
      expect(stats.pendingMessages).toBe(0);
      expect(stats.activeListeners).toBe(1);
    });
  });

  describe('Error Handling', () => {
    test('should handle connection errors gracefully', async () => {
      // Mock WebSocket that fails to connect
      const FailingWebSocket = class extends MockWebSocket {
        constructor(url: string) {
          super(url);
          setTimeout(() => {
            this.dispatchEvent(new Event('error'));
          }, 5);
        }
      };
      
      (global as any).WebSocket = FailingWebSocket;
      
      const failingManager = new WebSocketManager({ url: mockUrl });
      
      await expect(failingManager.connect()).rejects.toThrow('Failed to connect to WebSocket');
    });

    test('should handle message parsing errors', async () => {
      // Reset WebSocket mock to normal behavior for this test
      (global as any).WebSocket = MockWebSocket;
      
      const testManager = new WebSocketManager({ url: mockUrl });
      await testManager.connect();
      
      const ws = (testManager as any).ws as MockWebSocket;
      
      // Send invalid JSON
      ws.dispatchEvent(new MessageEvent('message', {
        data: 'invalid json'
      }));
      
      // Should not crash, error should be logged
      expect(testManager.getStatus()).toBe(ConnectionStatus.CONNECTED);
      
      testManager.disconnect();
    });
  });
});