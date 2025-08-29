/**
 * AudioProcessor - Handles microphone access, audio capture, and processing
 * Implements Web Audio API for real-time audio streaming to AWS Transcribe
 */

import { AudioProcessor as IAudioProcessor, ServiceError } from './types';

export interface AudioProcessorConfig {
  sampleRate: number;
  channelCount: number;
  bufferSize: number;
  chunkDurationMs: number;
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  sequence: number;
}

export class AudioProcessor implements IAudioProcessor {
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private processorNode: ScriptProcessorNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  public isRecording = false;
  private audioLevel = 0;
  private chunkSequence = 0;
  private audioChunkCallback: ((chunk: ArrayBuffer) => void) | null = null;
  private errorCallback: ((error: ServiceError) => void) | null = null;

  private readonly config: AudioProcessorConfig = {
    sampleRate: 16000, // Required by AWS Transcribe
    channelCount: 1, // Mono audio
    bufferSize: 4096, // Buffer size for processing
    chunkDurationMs: 100 // Send chunks every 100ms
  };

  constructor(config?: Partial<AudioProcessorConfig>) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Start recording audio from microphone
   */
  async startRecording(): Promise<void> {
    try {
      if (this.isRecording) {
        throw new Error('Recording is already in progress');
      }

      // Request microphone access
      await this.requestMicrophoneAccess();
      
      // Initialize audio processing
      await this.initializeAudioProcessing();
      
      this.isRecording = true;
      this.chunkSequence = 0;
      
      console.log('Audio recording started successfully');
    } catch (error) {
      const serviceError: ServiceError = {
        code: 'AUDIO_START_FAILED',
        message: error instanceof Error ? error.message : 'Failed to start audio recording',
        service: 'AudioProcessor',
        timestamp: new Date(),
        retryable: true
      };
      
      this.handleError(serviceError);
      throw serviceError;
    }
  }

  /**
   * Stop recording audio
   */
  stopRecording(): void {
    try {
      if (!this.isRecording) {
        return;
      }

      // Set recording to false first to prevent further processing
      this.isRecording = false;
      this.audioLevel = 0;

      // Stop all audio processing
      this.cleanup();
      
      console.log('Audio recording stopped');
    } catch (error) {
      // Ensure recording is stopped even if cleanup fails
      this.isRecording = false;
      this.audioLevel = 0;
      
      const serviceError: ServiceError = {
        code: 'AUDIO_STOP_FAILED',
        message: error instanceof Error ? error.message : 'Failed to stop audio recording',
        service: 'AudioProcessor',
        timestamp: new Date(),
        retryable: false
      };
      
      this.handleError(serviceError);
    }
  }

  /**
   * Get current audio level (0-100)
   */
  getAudioLevel(): number {
    return this.audioLevel;
  }

  /**
   * Set callback for audio chunks
   */
  onAudioChunk(callback: (chunk: ArrayBuffer) => void): void {
    this.audioChunkCallback = callback;
  }

  /**
   * Set callback for errors
   */
  onError(callback: (error: ServiceError) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Get recording status
   */
  get isRecordingActive(): boolean {
    return this.isRecording;
  }

  /**
   * Request microphone access with proper error handling
   */
  private async requestMicrophoneAccess(): Promise<void> {
    try {
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access is not supported in this browser');
      }

      // Request microphone access with flexible constraints
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          // Don't specify sampleRate to avoid conflicts - we'll resample later
          channelCount: this.config.channelCount,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      // Check if we got audio tracks
      const audioTracks = this.mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error('No audio tracks available');
      }

      console.log('Microphone access granted');
    } catch (error) {
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotAllowedError':
            throw new Error('Microphone access denied. Please allow microphone access and try again.');
          case 'NotFoundError':
            throw new Error('No microphone found. Please connect a microphone and try again.');
          case 'NotReadableError':
            throw new Error('Microphone is already in use by another application.');
          case 'OverconstrainedError':
            throw new Error('Microphone does not support the required audio settings.');
          default:
            throw new Error(`Microphone access failed: ${error.message}`);
        }
      }
      throw error;
    }
  }

  /**
   * Initialize Web Audio API processing
   */
  private async initializeAudioProcessing(): Promise<void> {
    try {
      if (!this.mediaStream) {
        throw new Error('Media stream not available');
      }

      // Create audio context without specifying sample rate to avoid conflicts
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      
      // Resume context if it's suspended
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Create source node from media stream
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Create analyser for audio level detection
      this.analyserNode = this.audioContext.createAnalyser();
      this.analyserNode.fftSize = 256;
      this.analyserNode.smoothingTimeConstant = 0.8;

      // Create processor node for audio chunk processing
      this.processorNode = this.audioContext.createScriptProcessor(
        this.config.bufferSize,
        this.config.channelCount,
        this.config.channelCount
      );

      // Connect nodes
      this.sourceNode.connect(this.analyserNode);
      this.sourceNode.connect(this.processorNode);
      this.processorNode.connect(this.audioContext.destination);

      // Set up audio processing
      this.processorNode.onaudioprocess = (event) => {
        this.processAudioBuffer(event);
      };

      // Start audio level monitoring
      this.startAudioLevelMonitoring();

      console.log('Audio processing initialized');
    } catch (error) {
      throw new Error(`Failed to initialize audio processing: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Process audio buffer and create chunks for streaming
   */
  private processAudioBuffer(event: AudioProcessingEvent): void {
    try {
      if (!this.audioContext) {
        throw new Error('AudioContext is not available');
      }

      const inputBuffer = event.inputBuffer;
      const channelData = inputBuffer.getChannelData(0); // Get mono channel
      
      // Resample if necessary (from context sample rate to target sample rate)
      const resampledData = this.resampleAudio(channelData, this.audioContext.sampleRate, this.config.sampleRate);

      // Convert Float32Array to Int16Array (PCM 16-bit)
      const pcmData = this.convertToPCM16(resampledData);
      
      // Create audio chunk
      const arrayBuffer = new ArrayBuffer(pcmData.byteLength);
      new Uint8Array(arrayBuffer).set(new Uint8Array(pcmData.buffer));
      
      const chunk: AudioChunk = {
        data: arrayBuffer,
        timestamp: Date.now(),
        sequence: this.chunkSequence++
      };

      // Send chunk via callback
      if (this.audioChunkCallback) {
        this.audioChunkCallback(chunk.data);
      }
    } catch (error) {
      const serviceError: ServiceError = {
        code: 'AUDIO_PROCESSING_FAILED',
        message: error instanceof Error ? error.message : 'Failed to process audio buffer',
        service: 'AudioProcessor',
        timestamp: new Date(),
        retryable: true
      };
      
      this.handleError(serviceError);
    }
  }

  /**
   * Resample audio data from source sample rate to target sample rate
   */
  private resampleAudio(inputData: Float32Array, sourceSampleRate: number, targetSampleRate: number): Float32Array {
    if (sourceSampleRate === targetSampleRate) {
      return inputData;
    }

    const ratio = sourceSampleRate / targetSampleRate;
    const outputLength = Math.round(inputData.length / ratio);
    const outputData = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const sourceIndex = i * ratio;
      const index = Math.floor(sourceIndex);
      const fraction = sourceIndex - index;

      if (index + 1 < inputData.length) {
        // Linear interpolation
        outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
      } else {
        outputData[i] = inputData[index] || 0;
      }
    }

    return outputData;
  }

  /**
   * Convert Float32Array to PCM 16-bit format required by AWS Transcribe
   */
  private convertToPCM16(float32Array: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32Array.length);
    
    for (let i = 0; i < float32Array.length; i++) {
      // Clamp values to [-1, 1] and convert to 16-bit PCM
      const sample = Math.max(-1, Math.min(1, float32Array[i]));
      pcm16[i] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    }
    
    return pcm16;
  }

  /**
   * Start monitoring audio levels for visual feedback
   */
  private startAudioLevelMonitoring(): void {
    if (!this.analyserNode) return;

    const dataArray = new Uint8Array(this.analyserNode.frequencyBinCount);
    
    const updateAudioLevel = () => {
      if (!this.isRecording || !this.analyserNode) return;

      this.analyserNode.getByteFrequencyData(dataArray);
      
      // Calculate RMS (Root Mean Square) for audio level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      
      const rms = Math.sqrt(sum / dataArray.length);
      this.audioLevel = Math.round((rms / 255) * 100);
      
      // Continue monitoring
      requestAnimationFrame(updateAudioLevel);
    };
    
    updateAudioLevel();
  }

  /**
   * Handle errors with proper logging and user notification
   */
  private handleError(error: ServiceError): void {
    console.error(`AudioProcessor Error [${error.code}]:`, error.message);
    
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  /**
   * Clean up all audio resources
   */
  private cleanup(): void {
    try {
      // Disconnect and close processor node
      if (this.processorNode) {
        try {
          this.processorNode.onaudioprocess = null;
          this.processorNode.disconnect();
        } catch (e) {
          console.warn('Error disconnecting processor node:', e);
        }
        this.processorNode = null;
      }

      // Disconnect analyser node
      if (this.analyserNode) {
        try {
          this.analyserNode.disconnect();
        } catch (e) {
          console.warn('Error disconnecting analyser node:', e);
        }
        this.analyserNode = null;
      }

      // Disconnect source node
      if (this.sourceNode) {
        try {
          this.sourceNode.disconnect();
        } catch (e) {
          console.warn('Error disconnecting source node:', e);
        }
        this.sourceNode = null;
      }

      // Close audio context
      if (this.audioContext && this.audioContext.state !== 'closed') {
        try {
          this.audioContext.close();
        } catch (e) {
          console.warn('Error closing audio context:', e);
        }
        this.audioContext = null;
      }

      // Stop media stream tracks
      if (this.mediaStream) {
        try {
          this.mediaStream.getTracks().forEach(track => {
            track.stop();
          });
        } catch (e) {
          console.warn('Error stopping media stream tracks:', e);
        }
        this.mediaStream = null;
      }

      console.log('Audio resources cleaned up');
    } catch (error) {
      console.error('Error during audio cleanup:', error);
    }
  }

  /**
   * Dispose of the audio processor
   */
  dispose(): void {
    this.stopRecording();
    this.cleanup();
    this.audioChunkCallback = null;
    this.errorCallback = null;
  }
}

/**
 * Utility function to check microphone permissions
 */
export async function checkMicrophonePermissions(): Promise<PermissionState> {
  try {
    if (!navigator.permissions) {
      return 'prompt'; // Assume prompt if permissions API not available
    }

    const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
    return permission.state;
  } catch (error) {
    console.warn('Could not check microphone permissions:', error);
    return 'prompt';
  }
}

/**
 * Utility function to get available audio input devices
 */
export async function getAudioInputDevices(): Promise<MediaDeviceInfo[]> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      return [];
    }

    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter(device => device.kind === 'audioinput');
  } catch (error) {
    console.error('Failed to enumerate audio devices:', error);
    return [];
  }
}