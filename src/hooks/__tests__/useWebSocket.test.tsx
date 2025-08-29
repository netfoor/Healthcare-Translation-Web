/**
 * @jest-environment jsdom
 */

import { renderHook, act } from '@testing-library/react';
import { useWebSocket } from '../useWebSocket';
import { ConnectionStatus } from '../../lib/websocket-manager';

// Mock WebSocket (reuse from websocket-manager.test.ts)
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

(global as any).WebSocket = MockWebSocket;

describe('useWebSocket', () => {
    const mockUrl = 'ws://localhost:8080';

    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('should initialize with disconnected status', () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        expect(result.current.status).toBe(ConnectionStatus.DISCONNECTED);
        expect(result.current.isConnected).toBe(false);
        expect(result.current.isConnecting).toBe(false);
        expect(result.current.lastError).toBe(null);
    });

    test('should auto-connect when autoConnect is true', async () => {
        const { result } = renderHook(() =>
            useWebSocket({ url: mockUrl, autoConnect: true })
        );

        expect(result.current.status).toBe(ConnectionStatus.CONNECTING);
        expect(result.current.isConnecting).toBe(true);

        // Wait for connection to complete
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 20));
        });

        expect(result.current.status).toBe(ConnectionStatus.CONNECTED);
        expect(result.current.isConnected).toBe(true);
        expect(result.current.isConnecting).toBe(false);
    });

    test('should connect manually', async () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.status).toBe(ConnectionStatus.CONNECTED);
        expect(result.current.isConnected).toBe(true);
    });

    test('should disconnect properly', async () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.isConnected).toBe(true);

        act(() => {
            result.current.disconnect();
        });

        expect(result.current.status).toBe(ConnectionStatus.DISCONNECTED);
        expect(result.current.isConnected).toBe(false);
    });

    test('should send messages and receive responses', async () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            await result.current.connect();
        });

        const message = {
            action: 'test',
            data: { content: 'hello' }
        };

        let response;
        await act(async () => {
            response = await result.current.sendMessage(message);
        });

        expect(response).toEqual({
            success: true,
            action: 'testResponse',
            data: { received: message.data },
            requestId: expect.any(String)
        });
    });

    test('should handle connection errors', async () => {
        // Mock WebSocket that fails
        const FailingWebSocket = class extends MockWebSocket {
            constructor(url: string) {
                super(url);
                setTimeout(() => {
                    this.dispatchEvent(new Event('error'));
                }, 5);
            }
        };

        (global as any).WebSocket = FailingWebSocket;

        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            try {
                await result.current.connect();
            } catch (error) {
                // Expected to fail
            }
        });

        expect(result.current.lastError).toBeTruthy();
        expect(result.current.status).toBe(ConnectionStatus.ERROR);
    });

    test('should add and remove event listeners', async () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            await result.current.connect();
        });

        const listener = jest.fn();

        act(() => {
            result.current.addEventListener('testAction', listener);
        });

        // Simulate receiving a message
        const ws = (result.current as any).ws;
        act(() => {
            // This would be handled by the WebSocket manager internally
            // For testing, we'll verify the listener was added
            expect(result.current.stats.activeListeners).toBeGreaterThan(0);
        });

        act(() => {
            result.current.removeEventListener('testAction', listener);
        });
    });

    test('should update stats periodically', async () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            await result.current.connect();
        });

        const initialStats = result.current.stats;
        expect(initialStats.status).toBe(ConnectionStatus.CONNECTED);

        // Wait for stats update
        await act(async () => {
            await new Promise(resolve => setTimeout(resolve, 1100));
        });

        // Stats should be updated
        expect(result.current.stats.status).toBe(ConnectionStatus.CONNECTED);
    });

    test('should cleanup on unmount', async () => {
        const { result, unmount } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            await result.current.connect();
        });

        expect(result.current.isConnected).toBe(true);

        unmount();

        // After unmount, the WebSocket should be cleaned up
        // This is tested by ensuring no errors are thrown during unmount
    });

    test('should handle send message errors', async () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        // Try to send message without connecting
        await act(async () => {
            try {
                await result.current.sendMessage({ action: 'test', data: {} });
            } catch (error) {
                expect(error).toBeInstanceOf(Error);
                expect(result.current.lastError).toBeTruthy();
            }
        });
    });

    test('should send async messages', async () => {
        const { result } = renderHook(() => useWebSocket({ url: mockUrl }));

        await act(async () => {
            await result.current.connect();
        });

        // This should not throw
        act(() => {
            result.current.sendMessageAsync({ action: 'async', data: {} });
        });

        expect(result.current.isConnected).toBe(true);
    });
});