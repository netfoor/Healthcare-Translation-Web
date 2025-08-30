/**
 * VoiceInput - Main voice input component with recording controls
 * Integrates audio capture, level visualization, and streaming functionality
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useAudioProcessor } from '../hooks/useAudioProcessor';
import { AudioLevelIndicator, AudioLevelText } from './AudioLevelIndicator';
import { MicrophonePermission } from './MicrophonePermission';
import { LoadingSpinner } from './LoadingSpinner';
import { ServiceError } from '../lib/types';

export interface VoiceInputProps {
  onTranscriptUpdate?: (transcript: string) => void;
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  onError?: (error: ServiceError) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function VoiceInput({
  onAudioChunk,
  onError,
  onRecordingStateChange,
  disabled = false,
  className = ''
}: VoiceInputProps) {
  const [showPermissionPanel, setShowPermissionPanel] = useState(false);
  
  const {
    isRecording,
    audioLevel,
    isInitializing,
    error,
    permissionState,
    availableDevices,
    startRecording,
    stopRecording,
    clearError,
    refreshDevices,
    onAudioChunk: setAudioChunkCallback
  } = useAudioProcessor({
    sampleRate: 16000,
    channelCount: 1,
    bufferSize: 4096,
    chunkDurationMs: 100,
    autoCheckPermissions: true
  });

  /**
   * Handle recording toggle
   */
  const handleRecordingToggle = useCallback(async () => {
    if (disabled) return;

    try {
      if (isRecording) {
        stopRecording();
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

        await startRecording();
      }
    } catch (err) {
      console.error('Failed to toggle recording:', err);
    }
  }, [isRecording, disabled, permissionState, startRecording, stopRecording]);

  /**
   * Handle permission request
   */
  const handleRequestPermission = useCallback(async () => {
    try {
      await startRecording();
      setShowPermissionPanel(false);
    } catch (err) {
      // Error will be handled by the audio processor
      console.error('Permission request failed:', err);
    }
  }, [startRecording]);

  /**
   * Set up audio chunk callback
   */
  useEffect(() => {
    if (onAudioChunk) {
      setAudioChunkCallback(onAudioChunk);
    }
  }, [onAudioChunk, setAudioChunkCallback]);

  /**
   * Handle recording state changes
   */
  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording, onRecordingStateChange]);

  /**
   * Handle errors
   */
  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  /**
   * Get recording button state
   */
  const getButtonState = () => {
    if (disabled) return 'disabled';
    if (isInitializing) return 'initializing';
    if (isRecording) return 'recording';
    if (permissionState === 'denied') return 'denied';
    if (permissionState === 'granted') return 'ready';
    return 'prompt';
  };

  const buttonState = getButtonState();

  /**
   * Render recording button
   */
  const renderRecordingButton = () => {
    const baseClasses = "relative flex items-center justify-center w-16 h-16 rounded-full transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-offset-2";
    
    const stateClasses = {
      disabled: "bg-gray-300 cursor-not-allowed focus:ring-gray-200",
      initializing: "bg-blue-500 cursor-wait focus:ring-blue-200",
      recording: "bg-red-500 hover:bg-red-600 animate-pulse focus:ring-red-200",
      denied: "bg-red-300 hover:bg-red-400 focus:ring-red-200",
      ready: "bg-blue-500 hover:bg-blue-600 focus:ring-blue-200",
      prompt: "bg-blue-500 hover:bg-blue-600 focus:ring-blue-200"
    };

    const buttonClasses = `${baseClasses} ${stateClasses[buttonState]}`;

    return (
      <button
        onClick={handleRecordingToggle}
        disabled={disabled || isInitializing}
        className={buttonClasses}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isInitializing ? (
          <LoadingSpinner size="sm" className="text-white" />
        ) : isRecording ? (
          <StopIcon className="w-8 h-8 text-white" />
        ) : (
          <MicrophoneIcon className="w-8 h-8 text-white" />
        )}
        
        {/* Recording indicator ring */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
        )}
      </button>
    );
  };

  /**
   * Render status text
   */
  const renderStatusText = () => {
    const statusMessages = {
      disabled: 'Voice input disabled',
      initializing: 'Initializing microphone...',
      recording: 'Recording... Click to stop',
      denied: 'Microphone access denied',
      ready: 'Click to start recording',
      prompt: 'Click to enable microphone'
    };

    return (
      <p className="text-sm text-blue-600 dark:text-blue-400 text-center font-medium">
        {statusMessages[buttonState]}
      </p>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
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

      {/* Main Voice Input Interface */}
      <div className="flex flex-col items-center space-y-4">
        {/* Recording Button */}
        <div className="relative">
          {renderRecordingButton()}
        </div>

        {/* Status Text */}
        {renderStatusText()}

        {/* Audio Level Visualization */}
        {(isRecording || audioLevel > 0) && (
          <div className="space-y-2">
            <AudioLevelIndicator
              level={audioLevel}
              isRecording={isRecording}
              size="large"
              variant="bars"
            />
            <AudioLevelText
              level={audioLevel}
              isRecording={isRecording}
            />
          </div>
        )}

        {/* Error Display */}
        {error && !showPermissionPanel && (
          <div className="w-full max-w-md p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <div className="flex items-start gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  {error.message}
                </p>
                <button
                  onClick={clearError}
                  className="mt-1 text-xs text-red-600 hover:text-red-700 underline"
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
 * Compact version of VoiceInput for smaller spaces
 */
export function VoiceInputCompact({
  onAudioChunk,
  onError,
  onRecordingStateChange,
  disabled = false,
  className = ''
}: VoiceInputProps) {
  const {
    isRecording,
    audioLevel,
    isInitializing,
    error,
    permissionState,
    startRecording,
    stopRecording,
    clearError,
    onAudioChunk: setAudioChunkCallback
  } = useAudioProcessor();

  const handleToggle = useCallback(async () => {
    if (disabled) return;
    
    try {
      if (isRecording) {
        stopRecording();
      } else {
        await startRecording();
      }
    } catch (err) {
      console.error('Failed to toggle recording:', err);
    }
  }, [isRecording, disabled, startRecording, stopRecording]);

  useEffect(() => {
    if (onAudioChunk) {
      setAudioChunkCallback(onAudioChunk);
    }
  }, [onAudioChunk, setAudioChunkCallback]);

  useEffect(() => {
    if (onRecordingStateChange) {
      onRecordingStateChange(isRecording);
    }
  }, [isRecording, onRecordingStateChange]);

  useEffect(() => {
    if (error && onError) {
      onError(error);
    }
  }, [error, onError]);

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        onClick={handleToggle}
        disabled={disabled || isInitializing || permissionState === 'denied'}
        className={`flex items-center justify-center w-10 h-10 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 focus:ring-red-200 animate-pulse'
            : 'bg-blue-500 hover:bg-blue-600 focus:ring-blue-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        aria-label={isRecording ? 'Stop recording' : 'Start recording'}
      >
        {isInitializing ? (
          <LoadingSpinner size="sm" className="text-white" />
        ) : isRecording ? (
          <StopIcon className="w-5 h-5 text-white" />
        ) : (
          <MicrophoneIcon className="w-5 h-5 text-white" />
        )}
      </button>

      <AudioLevelIndicator
        level={audioLevel}
        isRecording={isRecording}
        size="small"
        variant="bars"
      />

      {error && (
        <button
          onClick={clearError}
          className="text-red-600 hover:text-red-700"
          title={error.message}
        >
          <ExclamationTriangleIcon className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}

/**
 * Microphone icon component
 */
function MicrophoneIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
    </svg>
  );
}

/**
 * Stop icon component
 */
function StopIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

/**
 * Exclamation triangle icon component
 */
function ExclamationTriangleIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );
}