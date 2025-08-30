'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { WebSocketStatus, WebSocketStats } from './WebSocketStatus';
import { ConnectionStatus } from '../lib/websocket-manager';

// WebSocket URL from environment variables with fallback
const WEBSOCKET_URL = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://echo.websocket.org';

// Check if we're using the fallback URL
const isUsingFallback = !process.env.NEXT_PUBLIC_WEBSOCKET_URL;

export function WebSocketDemo() {
  const [messages, setMessages] = useState<Array<{ type: 'sent' | 'received'; content: string; timestamp: Date }>>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Stabilize the config object to prevent useEffect recreation
  const wsConfig = useMemo(() => ({
    maxReconnectAttempts: 10,
    reconnectInterval: 1000,
    maxReconnectInterval: 30000,
    reconnectBackoffMultiplier: 1.5,
    heartbeatInterval: 30000,
    messageTimeout: 10000
  }), []);

  const {
    connect,
    disconnect,
    status,
    isConnected,
    isConnecting,
    sendMessage,
    sendMessageAsync,
    addEventListener,
    removeEventListener,
    stats,
    lastError
  } = useWebSocket({
    url: WEBSOCKET_URL,
    autoConnect: false,
    config: wsConfig
  });

  // Add message listeners
  useEffect(() => {
    const handleTranscriptionStarted = (data: Record<string, unknown>) => {
      const sessionId = data.sessionId as string;
      setSessionId(sessionId);
      addMessage('received', `Transcription started: ${sessionId}`);
    };

    const handleAudioProcessed = (data: Record<string, unknown>) => {
      const transcript = data.transcript as string;
      addMessage('received', `Audio processed: ${transcript}`);
    };

    const handleTranslationComplete = (data: Record<string, unknown>) => {
      const translatedText = data.translatedText as string;
      addMessage('received', `Translation: ${translatedText}`);
    };

    const handleError = (data: Record<string, unknown>) => {
      const error = data.error as string | undefined;
      addMessage('received', `Error: ${error || 'Unknown error'}`);
    };

    const handlePong = (data: Record<string, unknown>) => {
      const timestamp = data.timestamp as string;
      addMessage('received', `Pong: ${timestamp}`);
    };

    addEventListener('transcriptionStarted', handleTranscriptionStarted);
    addEventListener('audioProcessed', handleAudioProcessed);
    addEventListener('translationComplete', handleTranslationComplete);
    addEventListener('error', handleError);
    addEventListener('pong', handlePong);

    return () => {
      removeEventListener('transcriptionStarted', handleTranscriptionStarted);
      removeEventListener('audioProcessed', handleAudioProcessed);
      removeEventListener('translationComplete', handleTranslationComplete);
      removeEventListener('error', handleError);
      removeEventListener('pong', handlePong);
    };
  }, [addEventListener, removeEventListener]);

  // Track previous status to detect changes
  const [previousStatus, setPreviousStatus] = useState<ConnectionStatus>(ConnectionStatus.DISCONNECTED);

  // Listen for connection status changes
  useEffect(() => {
    if (status !== previousStatus) {
      setPreviousStatus(status);
      
      if (status === ConnectionStatus.CONNECTED) {
        // Only add success message if we were previously connecting/reconnecting
        if (previousStatus === ConnectionStatus.CONNECTING || previousStatus === ConnectionStatus.RECONNECTING) {
          addMessage('received', '✅ Connected to WebSocket server successfully!');
        }
      } else if (status === ConnectionStatus.RECONNECTING && previousStatus === ConnectionStatus.CONNECTING) {
        addMessage('received', 'Establishing connection... (this may take a moment for AWS Lambda cold start)');
      }
    }
  }, [status, previousStatus]);

  const addMessage = (type: 'sent' | 'received', content: string) => {
    setMessages(prev => [...prev, { type, content, timestamp: new Date() }]);
  };

  const handleConnect = async () => {
    try {
      addMessage('sent', 'Attempting to connect...');
      await connect();
      
      // Check if we're already connected (immediate success)
      if (status === ConnectionStatus.CONNECTED) {
        addMessage('received', 'Connected to WebSocket server');
      } else if (status === ConnectionStatus.RECONNECTING) {
        addMessage('received', 'Initial connection in progress - establishing connection...');
      }
    } catch (error) {
      console.error('Connection failed:', error);
      addMessage('received', `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    addMessage('received', 'Disconnected from WebSocket server');
    setSessionId(null);
  };

  const handleStartTranscription = async () => {
    try {
      await sendMessage({
        action: 'startTranscription',
        data: {
          inputLanguage: 'en-US',
          outputLanguage: 'es-ES',
          medicalSpecialty: 'general'
        }
      });
      addMessage('sent', 'Start transcription request sent');
    } catch (error) {
      console.error('Failed to start transcription:', error);
    }
  };

  const handleSendAudioChunk = async () => {
    if (!sessionId) {
      alert('Please start a transcription session first');
      return;
    }

    try {
      await sendMessage({
        action: 'audioChunk',
        data: {
          audioData: 'mock-audio-data',
          chunkId: `chunk_${Date.now()}`,
          timestamp: new Date().toISOString()
        },
        sessionId
      });
      addMessage('sent', 'Audio chunk sent');
    } catch (error) {
      console.error('Failed to send audio chunk:', error);
    }
  };

  const handleTranslateText = async () => {
    if (!inputMessage.trim()) {
      alert('Please enter text to translate');
      return;
    }

    try {
      await sendMessage({
        action: 'translate',
        data: {
          text: inputMessage,
          sourceLang: 'en',
          targetLang: 'es',
          medicalContext: true
        }
      });
      addMessage('sent', `Translate: "${inputMessage}"`);
      setInputMessage('');
    } catch (error) {
      console.error('Failed to translate text:', error);
    }
  };

  const handlePing = () => {
    sendMessageAsync({
      action: 'ping',
      data: { timestamp: new Date().toISOString() }
    });
    addMessage('sent', 'Ping sent');
  };

  const handleStopTranscription = async () => {
    if (!sessionId) {
      alert('No active transcription session');
      return;
    }

    try {
      await sendMessage({
        action: 'stopTranscription',
        data: {},
        sessionId
      });
      addMessage('sent', 'Stop transcription request sent');
      setSessionId(null);
    } catch (error) {
      console.error('Failed to stop transcription:', error);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">WebSocket Demo</h2>
        
        {/* URL Info */}
        <div className={`mb-4 p-3 rounded-md text-sm ${isUsingFallback ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
          <p className={isUsingFallback ? 'text-blue-800' : 'text-green-800'}>
            <strong>WebSocket URL:</strong> {WEBSOCKET_URL}
          </p>
          {isUsingFallback && (
            <p className="text-blue-600 text-xs mt-1">
              Using fallback echo server. Deploy AWS infrastructure and set NEXT_PUBLIC_WEBSOCKET_URL for full functionality.
            </p>
          )}
        </div>
        
        {/* Connection Status */}
        <div className="flex items-center justify-between mb-6">
          <WebSocketStatus 
            status={status} 
            reconnectAttempts={stats.reconnectAttempts}
            showDetails={true}
          />
          
          <div className="space-x-2">
            <button
              onClick={handleConnect}
              disabled={isConnected || isConnecting}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConnecting ? 'Connecting...' : 'Connect'}
            </button>
            <button
              onClick={handleDisconnect}
              disabled={!isConnected}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disconnect
            </button>
          </div>
        </div>

        {/* Connection Info Display */}
        {lastError && status !== ConnectionStatus.CONNECTED && (
          <div className={`rounded-md p-4 mb-4 ${
            status === ConnectionStatus.RECONNECTING 
              ? 'bg-blue-50 border border-blue-200' 
              : 'bg-yellow-50 border border-yellow-200'
          }`}>
            <p className={`text-sm ${
              status === ConnectionStatus.RECONNECTING 
                ? 'text-blue-800' 
                : 'text-yellow-800'
            }`}>
              <strong>Connection Info:</strong> {
                status === ConnectionStatus.RECONNECTING && stats.reconnectAttempts === 0
                  ? 'Establishing connection... (this may take a moment for AWS Lambda cold start)'
                  : lastError.message
              }
            </p>
            {status === ConnectionStatus.RECONNECTING && stats.reconnectAttempts > 0 && (
              <p className="text-blue-600 text-xs mt-1">
                Reconnection attempt {stats.reconnectAttempts} in progress...
              </p>
            )}
          </div>
        )}

        {/* Session Info */}
        {sessionId && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
            <p className="text-blue-800 text-sm">
              <strong>Active Session:</strong> {sessionId}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <button
            onClick={handleStartTranscription}
            disabled={!isConnected || !!sessionId}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Start Transcription
          </button>
          
          <button
            onClick={handleSendAudioChunk}
            disabled={!isConnected || !sessionId}
            className="px-3 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Send Audio Chunk
          </button>
          
          <button
            onClick={handleStopTranscription}
            disabled={!isConnected || !sessionId}
            className="px-3 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Stop Transcription
          </button>
          
          <button
            onClick={handlePing}
            disabled={!isConnected}
            className="px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Ping
          </button>
        </div>

        {/* Text Translation */}
        <div className="flex space-x-2 mb-6">
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Enter text to translate..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            onKeyDown={(e) => e.key === 'Enter' && handleTranslateText()}
          />
          <button
            onClick={handleTranslateText}
            disabled={!isConnected || !inputMessage.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Translate
          </button>
        </div>

        {/* Message History */}
        <div className="bg-gray-50 rounded-lg p-4 h-64 overflow-y-auto">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Message History</h3>
          <div className="space-y-2">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`text-sm p-2 rounded ${
                  message.type === 'sent'
                    ? 'bg-blue-100 text-blue-800 ml-8'
                    : 'bg-green-100 text-green-800 mr-8'
                }`}
              >
                <div className="flex justify-between items-start">
                  <span>{message.content}</span>
                  <span className="text-xs opacity-75 ml-2">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-gray-500 text-sm italic">No messages yet...</p>
            )}
          </div>
        </div>
      </div>

      {/* Statistics */}
      <WebSocketStats stats={stats} />
    </div>
  );
}