/**
 * MicrophonePermission - Component for handling microphone permission requests
 * Provides user-friendly interface for permission management
 */

'use client';

import React from 'react';
import { ServiceError } from '../lib/types';

export interface MicrophonePermissionProps {
  permissionState: PermissionState | null;
  error: ServiceError | null;
  availableDevices: MediaDeviceInfo[];
  onRequestPermission: () => Promise<void>;
  onRefreshDevices: () => Promise<void>;
  onClearError: () => void;
  className?: string;
}

export function MicrophonePermission({
  permissionState,
  error,
  availableDevices,
  onRequestPermission,
  onRefreshDevices,
  onClearError,
  className = ''
}: MicrophonePermissionProps) {
  const renderPermissionStatus = () => {
    switch (permissionState) {
      case 'granted':
        return (
          <div className="flex items-center gap-2 text-green-600">
            <MicrophoneIcon className="w-5 h-5" />
            <span className="font-medium">Microphone access granted</span>
          </div>
        );
      
      case 'denied':
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-red-600">
              <MicrophoneSlashIcon className="w-5 h-5" />
              <span className="font-medium">Microphone access denied</span>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <p>To use voice translation, please:</p>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Click the microphone icon in your browser&apos;s address bar</li>
                <li>Select &quot;Allow&quot; for microphone access</li>
                <li>Refresh this page</li>
              </ol>
            </div>
          </div>
        );
      
      case 'prompt':
      default:
        return (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-blue-600">
              <MicrophoneIcon className="w-5 h-5" />
              <span className="font-medium">Microphone access required</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              This app needs access to your microphone to provide real-time voice translation.
              Your audio is processed securely and is not stored permanently.
            </p>
            <button
              onClick={onRequestPermission}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Grant Microphone Access
            </button>
          </div>
        );
    }
  };

  const renderDeviceInfo = () => {
    if (permissionState !== 'granted' || availableDevices.length === 0) {
      return null;
    }

    return (
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Available Microphones ({availableDevices.length})
        </h4>
        <div className="space-y-1">
          {availableDevices.map((device, index) => (
            <div key={device.deviceId} className="text-sm text-gray-600 dark:text-gray-400">
              {device.label || `Microphone ${index + 1}`}
            </div>
          ))}
        </div>
        <button
          onClick={onRefreshDevices}
          className="mt-2 text-xs text-blue-600 hover:text-blue-700 underline"
        >
          Refresh devices
        </button>
      </div>
    );
  };

  const renderError = () => {
    if (!error) return null;

    const getErrorMessage = (error: ServiceError) => {
      switch (error.code) {
        case 'AUDIO_START_FAILED':
          return {
            title: 'Failed to start audio recording',
            message: 'Please check your microphone connection and try again.',
            suggestions: [
              'Ensure your microphone is connected and working',
              'Check that no other applications are using the microphone',
              'Try refreshing the page'
            ]
          };
        
        case 'AUDIO_PROCESSING_FAILED':
          return {
            title: 'Audio processing error',
            message: 'There was an issue processing your audio input.',
            suggestions: [
              'Try stopping and starting the recording again',
              'Check your internet connection',
              'Ensure your browser supports Web Audio API'
            ]
          };
        
        default:
          return {
            title: 'Microphone Error',
            message: error.message,
            suggestions: [
              'Try refreshing the page',
              'Check your microphone permissions',
              'Ensure your microphone is working properly'
            ]
          };
      }
    };

    const errorInfo = getErrorMessage(error);

    return (
      <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-medium text-red-800 dark:text-red-200">
              {errorInfo.title}
            </h4>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">
              {errorInfo.message}
            </p>
            {errorInfo.suggestions.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-red-800 dark:text-red-200">
                  Try these solutions:
                </p>
                <ul className="mt-1 text-sm text-red-700 dark:text-red-300 list-disc list-inside">
                  {errorInfo.suggestions.map((suggestion, index) => (
                    <li key={index}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="mt-3 flex gap-2">
              <button
                onClick={onClearError}
                className="text-sm text-red-600 hover:text-red-700 underline"
              >
                Dismiss
              </button>
              {error.retryable && (
                <button
                  onClick={onRequestPermission}
                  className="text-sm text-red-600 hover:text-red-700 underline"
                >
                  Try Again
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {renderPermissionStatus()}
      {renderError()}
      {renderDeviceInfo()}
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
 * Microphone slash icon component
 */
function MicrophoneSlashIcon({ className }: { className?: string }) {
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
        d="M5.586 5.586l12.828 12.828M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 3l18 18"
      />
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