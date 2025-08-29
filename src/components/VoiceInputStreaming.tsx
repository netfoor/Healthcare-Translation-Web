/**
 * VoiceInputStreaming - Advanced voice input component with streaming capabilities
 * Provides real-time audio streaming with buffering and visual feedback
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAudioStreaming } from '../hooks/useAudioStreaming';
import { AudioLevelIndicator, AudioLevelText } from './AudioLevelIndicator';
import { MicrophonePermission } from './MicrophonePermission';
import { LoadingSpinner } from './LoadingSpinner';
import { BufferedAudioChunk } from '../lib/audio-buffer';
import { ServiceError } from '../lib/types';

export interface VoiceInputStreamingProps {
  onAudioBatch?: (chunks: BufferedAudioChunk[]) => Promise<void>;
  onError?: (error: ServiceError) => void;
  onStreamingStateChange?: (isStreaming: boolean) => void;
  disabled?: boolean;
  showAdvancedControls?: boolean;
  showBufferStats?: boolean;
  className?: string;
}

export function VoiceInputStreaming({
  onAudioBatch,
  onError,
  onStreamingStateChange,
  disabled = false,
  showAdvancedControls = false,
  showBufferStats = false,
  className = ''
}: VoiceInputStreamingProps) {
  const [showPermissionPanel, setShowPermissionPanel] = useState(false);
  const [showStats, setShowStats] = useState(showBufferStats);

  const {
    isRecording,
    audioLevel,
    isInitializing,
    isStreaming,
    bufferStats,
    permissionState,
    availableDevices,
    error,
    startStreaming,
    stopStreaming,
    clearError,
    refreshDevices,
    flushBuffer
  } = useAudioStreaming({
    sampleRate: 16000,
    channelCount: 1,
    bufferSize: 4096,
    chunkDurationMs: 100,
    bufferConfig: {
      maxBufferSize: 50,
      batchSize: 10,
      flushInterval: 1000,
      maxChunkAge: 2000
    },
    onAudioBatch,
    onStreamingError: (error) => {
      console.error('Streaming error:', error);
    },
    onBufferFull: () => {
      console.warn('Audio buffer is full - consider reducing buffer size or increasing flush frequency');
    },
    autoCheckPermissions: true
  });

  /**
   * Handle streaming toggle
   */
  const handleStreamingToggle = useCallback(async () => {
    if (disabled) return;

    try {
      if (isStreaming) {
        await stopStreaming();
      } else {
        // Check permissions first
        if (permissionState === 'denied') {
          setShowPermissionPanel(true);
          return;
        }
        
        if (permissionState === 'prompt' || permissionState === null) {
          setShowPermissionPanel(true);
          return;
        }

        await startStreaming();
      }
    } catch (err) {
      console.error('Failed to toggle streaming:', err);
    }
  }, [isStreaming, disabled, permissionState, startStreaming, stopStreaming]);

  /**
   * Handle permission request
   */
  const handleRequestPermission = useCallback(async () => {
    try {
      await startStreaming();
      setShowPermissionPanel(false);
    } catch (err) {
      console.error('Permission request failed:', err);
    }
  }, [startStreaming]);

  /**
   * Handle streaming state changes
   */
  useEffect(() => {
    if (onStreamingStateChange) {
      onStreamingStateChange(isStreaming);
    }
  }, [isStreaming, onStreamingStateChange]);

  /**
   * Handle errors
   */
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  /**
   * Get button state
   */
  const getButtonState = () => {
    if (disabled) return 'disabled';
    if (isInitializing) return 'initializing';
    if (isStreaming) return 'streaming';
    if (permissionState === 'denied') return 'denied';
    if (permissionState === 'granted') return 'ready';
    return 'prompt';
  };

  const buttonState = getButtonState();

  /**
   * Render streaming button
   */
  const renderStreamingButton = () => {
    const baseClasses = "relative flex items-center justify-center w-20 h-20 rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2";
    
    const stateClasses = {
      disabled: "bg-gray-300 cursor-not-allowed focus:ring-gray-200",
      initializing: "bg-blue-500 cursor-wait focus:ring-blue-200",
      streaming: "bg-red-500 hover:bg-red-600 focus:ring-red-200",
      denied: "bg-red-300 hover:bg-red-400 focus:ring-red-200",
      ready: "bg-blue-500 hover:bg-blue-600 focus:ring-blue-200",
      prompt: "bg-blue-500 hover:bg-blue-600 focus:ring-blue-200"
    };

    const buttonClasses = `${baseClasses} ${stateClasses[buttonState]}`;

    return (
      <button
        onClick={handleStreamingToggle}
        disabled={disabled || isInitializing}
        className={buttonClasses}
        aria-label={isStreaming ? 'Stop streaming' : 'Start streaming'}
      >
        {isInitializing ? (
          <LoadingSpinner size="md" className="text-white" />
        ) : isStreaming ? (
          <div className="flex flex-col items-center">
            <StopIcon className="w-8 h-8 text-white" />
            <div className="text-xs text-white mt-1">LIVE</div>
          </div>
        ) : (
          <MicrophoneIcon className="w-10 h-10 text-white" />
        )}
        
        {/* Streaming indicator rings */}
        {isStreaming && (
          <>
            <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
            <div className="absolute inset-2 rounded-full border-2 border-red-200 animate-pulse" />
          </>
        )}
      </button>
    );
  };

  /**
   * Render status text
   */
  const renderStatusText = () => {
    const statusMessages = {
      disabled: 'Voice streaming disabled',
      initializing: 'Initializing audio streaming...',
      streaming: 'Streaming live audio',
      denied: 'Microphone access denied',
      ready: 'Ready to stream',
      prompt: 'Click to enable streaming'
    };

    return (
      <div className="text-center space-y-1">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {statusMessages[buttonState]}
        </p>
        {isStreaming && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Click to stop streaming
          </p>
        )}
      </div>
    );
  };

  /**
   * Render buffer statistics
   */
  const renderBufferStats = () => {
    if (!showStats || !isStreaming) return null;

    return (
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-medium">Buffer Status</span>
          <button
            onClick={() => setShowStats(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-gray-500">Total Chunks</div>
            <div className="font-mono">{bufferStats.totalChunks}</div>
          </div>
          <div>
            <div className="text-gray-500">Pending</div>
            <div className="font-mono">{bufferStats.pendingChunks}</div>
          </div>
          <div>
            <div className="text-gray-500">Processed</div>
            <div className="font-mono">{bufferStats.processedChunks}</div>
          </div>
          <div>
            <div className="text-gray-500">Utilization</div>
            <div className="font-mono">{bufferStats.bufferUtilization.toFixed(1)}%</div>
          </div>
        </div>
        
        {bufferStats.oldestChunkAge > 0 && (
          <div>
            <div className="text-gray-500">Oldest Chunk</div>
            <div className="font-mono">{(bufferStats.oldestChunkAge / 1000).toFixed(1)}s ago</div>
          </div>
        )}
        
        {bufferStats.isProcessing && (
          <div className="text-blue-600 text-center">Processing...</div>
        )}
      </div>
    );
  };

  /**
   * Render advanced controls
   */
  const renderAdvancedControls = () => {
    if (!showAdvancedControls) return null;

    return (
      <div className="flex justify-center gap-2">
        <button
          onClick={flushBuffer}
          disabled={!isStreaming}
          className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 disabled:opacity-50 rounded"
        >
          Flush Buffer
        </button>
        
        <button
          onClick={() => setShowStats(!showStats)}
          className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
        >
          {showStats ? 'Hide' : 'Show'} Stats
        </button>
        
        <button
          onClick={refreshDevices}
          className="px-3 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded"
        >
          Refresh Devices
        </button>
      </div>
    );
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Permission Panel */}
      {showPermissionPanel && (
        <div className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
          <MicrophonePermission
            permissionState={permissionState}
            error={error}
            availableDevices={availableDevices}
            onRequestPermission={handleRequestPermission}
            onRefreshDevices={refreshDevices}
            onClearError={() => {
              clearError();
              setShowPermissionPanel(false);
            }}
          />
        </div>
      )}

      {/* Main Streaming Interface */}
      <div className="flex flex-col items-center space-y-4">
        {/* Streaming Button */}
        <div className="relative">
          {renderStreamingButton()}
        </div>

        {/* Status Text */}
        {renderStatusText()}

        {/* Audio Level Visualization */}
        {(isStreaming || audioLevel > 0) && (
          <div className="space-y-3">
            <AudioLevelIndicator
              level={audioLevel}
              isRecording={isRecording}
              size="large"
              variant="waveform"
            />
            <AudioLevelText
              level={audioLevel}
              isRecording={isRecording}
            />
          </div>
        )}

        {/* Buffer Statistics */}
        {renderBufferStats()}

        {/* Advanced Controls */}
        {renderAdvancedControls()}

        {/* Error Display */}
        {error && !showPermissionPanel && (
          <div className="w-full max-w-md p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {error.message}
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Service: {error.service} | Code: {error.code}
                </p>
                <button
                  onClick={clearError}
                  className="mt-2 text-xs text-red-600 hover:text-red-700 underline"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Icon components
 */
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
    </svg>
  );
}