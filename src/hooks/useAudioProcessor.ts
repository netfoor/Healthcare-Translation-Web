/**
 * useAudioProcessor - React hook for managing audio capture and processing
 * Provides a clean interface for components to interact with AudioProcessor
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AudioProcessor, checkMicrophonePermissions, getAudioInputDevices } from '../lib/audio-processor';
import { ServiceError } from '../lib/types';

export interface UseAudioProcessorReturn {
  // State
  isRecording: boolean;
  audioLevel: number;
  isInitializing: boolean;
  error: ServiceError | null;
  permissionState: PermissionState | null;
  availableDevices: MediaDeviceInfo[];
  
  // Actions
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  clearError: () => void;
  checkPermissions: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  
  // Callbacks
  onAudioChunk: (callback: (chunk: ArrayBuffer) => void) => void;
}

export interface UseAudioProcessorOptions {
  sampleRate?: number;
  channelCount?: number;
  bufferSize?: number;
  chunkDurationMs?: number;
  autoCheckPermissions?: boolean;
}

export function useAudioProcessor(options: UseAudioProcessorOptions = {}): UseAudioProcessorReturn {
  const [isRecording, setIsRecording] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [permissionState, setPermissionState] = useState<PermissionState | null>(null);
  const [availableDevices, setAvailableDevices] = useState<MediaDeviceInfo[]>([]);

  const audioProcessorRef = useRef<AudioProcessor | null>(null);
  const audioLevelIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioChunkCallbackRef = useRef<((chunk: ArrayBuffer) => void) | null>(null);

  const {
    sampleRate = 16000,
    channelCount = 1,
    bufferSize = 4096,
    chunkDurationMs = 100,
    autoCheckPermissions = true
  } = options;

  /**
   * Initialize audio processor
   */
  const initializeProcessor = useCallback(() => {
    if (audioProcessorRef.current) {
      audioProcessorRef.current.dispose();
    }

    audioProcessorRef.current = new AudioProcessor({
      sampleRate,
      channelCount,
      bufferSize,
      chunkDurationMs
    });

    // Set up error handling
    audioProcessorRef.current.onError((serviceError) => {
      setError(serviceError);
      setIsRecording(false);
      setIsInitializing(false);
    });

    // Set up audio chunk callback if one was registered
    if (audioChunkCallbackRef.current) {
      audioProcessorRef.current.onAudioChunk(audioChunkCallbackRef.current);
    }
  }, [sampleRate, channelCount, bufferSize, chunkDurationMs]);

  /**
   * Start audio level monitoring
   */
  const startAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
    }

    audioLevelIntervalRef.current = setInterval(() => {
      if (audioProcessorRef.current && audioProcessorRef.current.isRecordingActive) {
        setAudioLevel(audioProcessorRef.current.getAudioLevel());
      } else {
        setAudioLevel(0);
      }
    }, 50); // Update every 50ms for smooth visualization
  }, []);

  /**
   * Stop audio level monitoring
   */
  const stopAudioLevelMonitoring = useCallback(() => {
    if (audioLevelIntervalRef.current) {
      clearInterval(audioLevelIntervalRef.current);
      audioLevelIntervalRef.current = null;
    }
    setAudioLevel(0);
  }, []);

  /**
   * Start recording
   */
  const startRecording = useCallback(async () => {
    try {
      setIsInitializing(true);
      setError(null);

      if (!audioProcessorRef.current) {
        initializeProcessor();
      }

      if (!audioProcessorRef.current) {
        throw new Error('Failed to initialize audio processor');
      }

      await audioProcessorRef.current.startRecording();
      setIsRecording(true);
      startAudioLevelMonitoring();
    } catch (err) {
      const serviceError = err as ServiceError;
      setError(serviceError);
      setIsRecording(false);
    } finally {
      setIsInitializing(false);
    }
  }, [initializeProcessor, startAudioLevelMonitoring]);

  /**
   * Stop recording
   */
  const stopRecording = useCallback(() => {
    try {
      if (audioProcessorRef.current) {
        audioProcessorRef.current.stopRecording();
      }
      setIsRecording(false);
      stopAudioLevelMonitoring();
    } catch (err) {
      const serviceError: ServiceError = {
        code: 'STOP_RECORDING_FAILED',
        message: err instanceof Error ? err.message : 'Failed to stop recording',
        service: 'useAudioProcessor',
        timestamp: new Date(),
        retryable: false
      };
      setError(serviceError);
    }
  }, [stopAudioLevelMonitoring]);

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Check microphone permissions
   */
  const checkPermissions = useCallback(async () => {
    try {
      const state = await checkMicrophonePermissions();
      setPermissionState(state);
    } catch (err) {
      console.warn('Failed to check microphone permissions:', err);
      setPermissionState('prompt');
    }
  }, []);

  /**
   * Refresh available audio devices
   */
  const refreshDevices = useCallback(async () => {
    try {
      const devices = await getAudioInputDevices();
      setAvailableDevices(devices);
    } catch (err) {
      console.error('Failed to refresh audio devices:', err);
      setAvailableDevices([]);
    }
  }, []);

  /**
   * Set audio chunk callback
   */
  const onAudioChunk = useCallback((callback: (chunk: ArrayBuffer) => void) => {
    audioChunkCallbackRef.current = callback;
    
    if (audioProcessorRef.current) {
      audioProcessorRef.current.onAudioChunk(callback);
    }
  }, []);

  /**
   * Initialize on mount
   */
  useEffect(() => {
    initializeProcessor();

    if (autoCheckPermissions) {
      checkPermissions();
      refreshDevices();
    }

    return () => {
      // Cleanup on unmount
      if (audioProcessorRef.current) {
        audioProcessorRef.current.dispose();
        audioProcessorRef.current = null;
      }
      stopAudioLevelMonitoring();
    };
  }, [initializeProcessor, autoCheckPermissions, checkPermissions, refreshDevices, stopAudioLevelMonitoring]);

  /**
   * Handle permission changes
   */
  useEffect(() => {
    if (!navigator.permissions) return;

    let permissionStatus: PermissionStatus;

    const handlePermissionChange = () => {
      setPermissionState(permissionStatus.state);
    };

    navigator.permissions.query({ name: 'microphone' as PermissionName })
      .then((status) => {
        permissionStatus = status;
        setPermissionState(status.state);
        status.addEventListener('change', handlePermissionChange);
      })
      .catch((err) => {
        console.warn('Failed to monitor permission changes:', err);
      });

    return () => {
      if (permissionStatus) {
        permissionStatus.removeEventListener('change', handlePermissionChange);
      }
    };
  }, []);

  /**
   * Handle device changes
   */
  useEffect(() => {
    if (!navigator.mediaDevices) return;

    const handleDeviceChange = () => {
      refreshDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [refreshDevices]);

  return {
    // State
    isRecording,
    audioLevel,
    isInitializing,
    error,
    permissionState,
    availableDevices,
    
    // Actions
    startRecording,
    stopRecording,
    clearError,
    checkPermissions,
    refreshDevices,
    
    // Callbacks
    onAudioChunk
  };
}