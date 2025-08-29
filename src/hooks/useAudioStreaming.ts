/**
 * useAudioStreaming - React hook for managing audio streaming with buffering
 * Combines audio capture, buffering, and streaming to backend services
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAudioProcessor } from './useAudioProcessor';
import { AudioBuffer, AudioChunk, BufferedAudioChunk, AudioBufferConfig } from '../lib/audio-buffer';
import { ServiceError } from '../lib/types';

export interface UseAudioStreamingReturn {
  // Recording state
  isRecording: boolean;
  audioLevel: number;
  isInitializing: boolean;
  
  // Streaming state
  isStreaming: boolean;
  streamingError: ServiceError | null;
  
  // Buffer state
  bufferStats: {
    totalChunks: number;
    processedChunks: number;
    pendingChunks: number;
    oldestChunkAge: number;
    isProcessing: boolean;
    bufferUtilization: number;
  };
  
  // Permission state
  permissionState: PermissionState | null;
  availableDevices: MediaDeviceInfo[];
  error: ServiceError | null;
  
  // Actions
  startStreaming: () => Promise<void>;
  stopStreaming: () => void;
  clearError: () => void;
  checkPermissions: () => Promise<void>;
  refreshDevices: () => Promise<void>;
  flushBuffer: () => Promise<void>;
}

export interface UseAudioStreamingOptions {
  // Audio processor options
  sampleRate?: number;
  channelCount?: number;
  bufferSize?: number;
  chunkDurationMs?: number;
  
  // Buffer options
  bufferConfig?: Partial<AudioBufferConfig>;
  
  // Streaming options
  onAudioBatch?: (chunks: BufferedAudioChunk[]) => Promise<void>;
  onStreamingError?: (error: Error) => void;
  onBufferFull?: () => void;
  
  // Auto-start options
  autoCheckPermissions?: boolean;
}

export function useAudioStreaming(options: UseAudioStreamingOptions = {}): UseAudioStreamingReturn {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingError, setStreamingError] = useState<ServiceError | null>(null);
  const [bufferStats, setBufferStats] = useState({
    totalChunks: 0,
    processedChunks: 0,
    pendingChunks: 0,
    oldestChunkAge: 0,
    isProcessing: false,
    bufferUtilization: 0
  });

  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const statsUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const {
    isRecording,
    audioLevel,
    isInitializing,
    error,
    permissionState,
    availableDevices,
    startRecording,
    stopRecording,
    clearError: clearAudioError,
    checkPermissions,
    refreshDevices,
    onAudioChunk
  } = useAudioProcessor({
    sampleRate: options.sampleRate,
    channelCount: options.channelCount,
    bufferSize: options.bufferSize,
    chunkDurationMs: options.chunkDurationMs,
    autoCheckPermissions: options.autoCheckPermissions
  });

  /**
   * Initialize audio buffer
   */
  const initializeBuffer = useCallback(() => {
    if (audioBufferRef.current) {
      audioBufferRef.current.dispose();
    }

    audioBufferRef.current = new AudioBuffer(
      options.bufferConfig,
      {
        onBatch: options.onAudioBatch,
        onError: (error) => {
          const serviceError: ServiceError = {
            code: 'AUDIO_STREAMING_ERROR',
            message: error.message,
            service: 'AudioStreaming',
            timestamp: new Date(),
            retryable: true
          };
          setStreamingError(serviceError);
          
          if (options.onStreamingError) {
            options.onStreamingError(error);
          }
        },
        onBufferFull: () => {
          console.warn('Audio buffer is full');
          if (options.onBufferFull) {
            options.onBufferFull();
          }
        },
        onFlush: (chunkCount) => {
          console.debug(`Flushed ${chunkCount} audio chunks`);
        }
      }
    );
  }, [options]);

  /**
   * Start buffer stats monitoring
   */
  const startStatsMonitoring = useCallback(() => {
    if (statsUpdateIntervalRef.current) {
      clearInterval(statsUpdateIntervalRef.current);
    }

    statsUpdateIntervalRef.current = setInterval(() => {
      if (audioBufferRef.current) {
        setBufferStats(audioBufferRef.current.getStats());
      }
    }, 500); // Update every 500ms
  }, []);

  /**
   * Stop buffer stats monitoring
   */
  const stopStatsMonitoring = useCallback(() => {
    if (statsUpdateIntervalRef.current) {
      clearInterval(statsUpdateIntervalRef.current);
      statsUpdateIntervalRef.current = null;
    }
  }, []);

  /**
   * Handle audio chunks from processor
   */
  const handleAudioChunk = useCallback((chunkData: ArrayBuffer) => {
    if (!audioBufferRef.current || !isStreaming) {
      return;
    }

    try {
      const chunk: AudioChunk = {
        data: chunkData,
        timestamp: Date.now(),
        sequence: Date.now() // Use timestamp as sequence for now
      };

      audioBufferRef.current.addChunk(chunk);
    } catch (error) {
      console.error('Failed to handle audio chunk:', error);
      
      const serviceError: ServiceError = {
        code: 'AUDIO_CHUNK_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : 'Failed to process audio chunk',
        service: 'AudioStreaming',
        timestamp: new Date(),
        retryable: true
      };
      setStreamingError(serviceError);
    }
  }, [isStreaming]);

  /**
   * Start audio streaming
   */
  const startStreaming = useCallback(async () => {
    try {
      setStreamingError(null);
      
      // Initialize buffer if needed
      if (!audioBufferRef.current) {
        initializeBuffer();
      }

      // Start audio recording
      await startRecording();
      
      setIsStreaming(true);
      startStatsMonitoring();
      
      console.log('Audio streaming started');
    } catch (error) {
      const serviceError = error as ServiceError;
      setStreamingError(serviceError);
      setIsStreaming(false);
      throw serviceError;
    }
  }, [initializeBuffer, startRecording, startStatsMonitoring]);

  /**
   * Stop audio streaming
   */
  const stopStreaming = useCallback(async () => {
    try {
      // Stop recording
      stopRecording();
      
      // Flush remaining buffer
      if (audioBufferRef.current) {
        await audioBufferRef.current.flush();
      }
      
      setIsStreaming(false);
      stopStatsMonitoring();
      
      console.log('Audio streaming stopped');
    } catch (error) {
      console.error('Error stopping audio streaming:', error);
      
      const serviceError: ServiceError = {
        code: 'AUDIO_STREAMING_STOP_ERROR',
        message: error instanceof Error ? error.message : 'Failed to stop audio streaming',
        service: 'AudioStreaming',
        timestamp: new Date(),
        retryable: false
      };
      setStreamingError(serviceError);
    }
  }, [stopRecording, stopStatsMonitoring]);

  /**
   * Clear streaming error
   */
  const clearStreamingError = useCallback(() => {
    setStreamingError(null);
  }, []);

  /**
   * Clear all errors
   */
  const clearError = useCallback(() => {
    clearAudioError();
    clearStreamingError();
  }, [clearAudioError, clearStreamingError]);

  /**
   * Manually flush buffer
   */
  const flushBuffer = useCallback(async () => {
    if (audioBufferRef.current) {
      await audioBufferRef.current.flush();
    }
  }, []);

  /**
   * Set up audio chunk callback
   */
  useEffect(() => {
    onAudioChunk(handleAudioChunk);
  }, [onAudioChunk, handleAudioChunk]);

  /**
   * Initialize buffer on mount
   */
  useEffect(() => {
    initializeBuffer();
    
    return () => {
      // Cleanup on unmount
      if (audioBufferRef.current) {
        audioBufferRef.current.dispose();
        audioBufferRef.current = null;
      }
      stopStatsMonitoring();
    };
  }, [initializeBuffer, stopStatsMonitoring]);

  /**
   * Handle recording state changes
   */
  useEffect(() => {
    if (!isRecording && isStreaming) {
      // Recording stopped but streaming is still active
      // This might happen due to an error or user action
      setIsStreaming(false);
      stopStatsMonitoring();
    }
  }, [isRecording, isStreaming, stopStatsMonitoring]);

  return {
    // Recording state
    isRecording,
    audioLevel,
    isInitializing,
    
    // Streaming state
    isStreaming,
    streamingError,
    
    // Buffer state
    bufferStats,
    
    // Permission state
    permissionState,
    availableDevices,
    error: error || streamingError,
    
    // Actions
    startStreaming,
    stopStreaming,
    clearError,
    checkPermissions,
    refreshDevices,
    flushBuffer
  };
}