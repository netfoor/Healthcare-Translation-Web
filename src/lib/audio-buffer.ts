/**
 * AudioBuffer - Manages audio chunk buffering for smooth streaming
 * Handles audio data queuing, batching, and streaming to backend services
 */

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  sequence: number;
}

export interface BufferedAudioChunk extends AudioChunk {
  id: string;
  processed: boolean;
}

export interface AudioBufferConfig {
  maxBufferSize: number; // Maximum number of chunks to buffer
  batchSize: number; // Number of chunks to send in each batch
  flushInterval: number; // Interval in ms to flush buffer
  maxChunkAge: number; // Maximum age of chunk in ms before forced flush
}

export interface AudioBufferCallbacks {
  onBatch?: (chunks: BufferedAudioChunk[]) => Promise<void>;
  onError?: (error: Error) => void;
  onBufferFull?: () => void;
  onFlush?: (chunkCount: number) => void;
}

export class AudioBuffer {
  private buffer: BufferedAudioChunk[] = [];
  private isProcessing = false;
  private flushTimer: NodeJS.Timeout | null = null;
  private chunkIdCounter = 0;

  private readonly config: AudioBufferConfig;
  private readonly callbacks: AudioBufferCallbacks;

  constructor(
    config: Partial<AudioBufferConfig> = {},
    callbacks: AudioBufferCallbacks = {}
  ) {
    this.config = {
      maxBufferSize: 50, // Buffer up to 50 chunks (~5 seconds at 100ms chunks)
      batchSize: 10, // Send 10 chunks at a time (~1 second)
      flushInterval: 1000, // Flush every 1 second
      maxChunkAge: 2000, // Force flush chunks older than 2 seconds
      ...config
    };

    this.callbacks = callbacks;
    this.startFlushTimer();
  }

  /**
   * Add audio chunk to buffer
   */
  addChunk(chunk: AudioChunk): void {
    try {
      const bufferedChunk: BufferedAudioChunk = {
        ...chunk,
        id: this.generateChunkId(),
        processed: false
      };

      // Check if buffer is full
      if (this.buffer.length >= this.config.maxBufferSize) {
        this.handleBufferFull();
        return;
      }

      this.buffer.push(bufferedChunk);

      // Check if we should flush immediately
      if (this.shouldFlushImmediately()) {
        this.flush();
      }
    } catch (error) {
      this.handleError(new Error(`Failed to add chunk to buffer: ${error instanceof Error ? error.message : 'Unknown error'}`));
    }
  }

  /**
   * Manually flush buffer
   */
  async flush(): Promise<void> {
    if (this.isProcessing || this.buffer.length === 0) {
      return;
    }

    try {
      this.isProcessing = true;

      // Get chunks to process
      const chunksToProcess = this.getChunksToProcess();
      
      if (chunksToProcess.length === 0) {
        return;
      }

      // Mark chunks as processed
      chunksToProcess.forEach(chunk => {
        chunk.processed = true;
      });

      // Send batch
      if (this.callbacks.onBatch) {
        await this.callbacks.onBatch(chunksToProcess);
      }

      // Remove processed chunks from buffer
      this.buffer = this.buffer.filter(chunk => !chunk.processed);

      // Notify flush completion
      if (this.callbacks.onFlush) {
        this.callbacks.onFlush(chunksToProcess.length);
      }

    } catch (error) {
      this.handleError(new Error(`Failed to flush buffer: ${error instanceof Error ? error.message : 'Unknown error'}`));
      
      // Reset processed flag on error
      this.buffer.forEach(chunk => {
        chunk.processed = false;
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Clear all buffered chunks
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Get buffer statistics
   */
  getStats() {
    const now = Date.now();
    const processedCount = this.buffer.filter(chunk => chunk.processed).length;
    const pendingCount = this.buffer.length - processedCount;
    const oldestChunk = this.buffer.length > 0 ? this.buffer[0] : null;
    const oldestAge = oldestChunk ? now - oldestChunk.timestamp : 0;

    return {
      totalChunks: this.buffer.length,
      processedChunks: processedCount,
      pendingChunks: pendingCount,
      oldestChunkAge: oldestAge,
      isProcessing: this.isProcessing,
      bufferUtilization: (this.buffer.length / this.config.maxBufferSize) * 100
    };
  }

  /**
   * Dispose of the buffer and cleanup resources
   */
  dispose(): void {
    this.stopFlushTimer();
    this.clear();
  }

  /**
   * Generate unique chunk ID
   */
  private generateChunkId(): string {
    return `chunk_${Date.now()}_${++this.chunkIdCounter}`;
  }

  /**
   * Check if buffer should be flushed immediately
   */
  private shouldFlushImmediately(): boolean {
    // Flush if we have enough chunks for a batch
    if (this.buffer.length >= this.config.batchSize) {
      return true;
    }

    // Flush if oldest chunk is too old
    const now = Date.now();
    const oldestChunk = this.buffer[0];
    if (oldestChunk && (now - oldestChunk.timestamp) > this.config.maxChunkAge) {
      return true;
    }

    return false;
  }

  /**
   * Get chunks to process in next batch
   */
  private getChunksToProcess(): BufferedAudioChunk[] {
    // Get unprocessed chunks
    const unprocessedChunks = this.buffer.filter(chunk => !chunk.processed);
    
    // Return up to batchSize chunks
    return unprocessedChunks.slice(0, this.config.batchSize);
  }

  /**
   * Handle buffer full condition
   */
  private handleBufferFull(): void {
    console.warn('Audio buffer is full, dropping oldest chunks');
    
    // Remove oldest chunks to make room
    const chunksToRemove = Math.ceil(this.config.maxBufferSize * 0.2); // Remove 20% of buffer
    this.buffer.splice(0, chunksToRemove);

    // Notify callback
    if (this.callbacks.onBufferFull) {
      this.callbacks.onBufferFull();
    }
  }

  /**
   * Handle errors
   */
  private handleError(error: Error): void {
    console.error('AudioBuffer error:', error);
    
    if (this.callbacks.onError) {
      this.callbacks.onError(error);
    }
  }

  /**
   * Start automatic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  /**
   * Stop automatic flush timer
   */
  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }
}

/**
 * Utility function to calculate audio data size
 */
export function calculateAudioDataSize(chunks: AudioChunk[]): number {
  return chunks.reduce((total, chunk) => total + chunk.data.byteLength, 0);
}

/**
 * Utility function to merge audio chunks into a single buffer
 */
export function mergeAudioChunks(chunks: AudioChunk[]): ArrayBuffer {
  const totalSize = calculateAudioDataSize(chunks);
  const mergedBuffer = new ArrayBuffer(totalSize);
  const mergedView = new Uint8Array(mergedBuffer);
  
  let offset = 0;
  for (const chunk of chunks) {
    const chunkView = new Uint8Array(chunk.data);
    mergedView.set(chunkView, offset);
    offset += chunkView.length;
  }
  
  return mergedBuffer;
}

/**
 * Utility function to convert audio chunks to base64
 */
export function audioChunksToBase64(chunks: AudioChunk[]): string {
  const mergedBuffer = mergeAudioChunks(chunks);
  const uint8Array = new Uint8Array(mergedBuffer);
  
  // Convert to base64
  let binary = '';
  for (let i = 0; i < uint8Array.length; i++) {
    binary += String.fromCharCode(uint8Array[i]);
  }
  
  return btoa(binary);
}

/**
 * Utility function to validate audio chunk format
 */
export function validateAudioChunk(chunk: AudioChunk): boolean {
  try {
    // Check required properties
    if (!chunk.data || !chunk.timestamp || typeof chunk.sequence !== 'number') {
      return false;
    }

    // Check data is ArrayBuffer
    if (!(chunk.data instanceof ArrayBuffer)) {
      return false;
    }

    // Check data size is reasonable (not empty, not too large)
    if (chunk.data.byteLength === 0 || chunk.data.byteLength > 1024 * 1024) { // Max 1MB per chunk
      return false;
    }

    // Check timestamp is reasonable (within last hour to next hour)
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    if (chunk.timestamp < (now - oneHour) || chunk.timestamp > (now + oneHour)) {
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error validating audio chunk:', error);
    return false;
  }
}