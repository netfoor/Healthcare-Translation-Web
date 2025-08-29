/**
 * Audio Demo Page - Demonstrates audio capture and processing components
 */

'use client';

import React, { useState } from 'react';
import { VoiceInput, VoiceInputCompact } from '@/components/VoiceInput';
import { VoiceInputStreaming } from '@/components/VoiceInputStreaming';
import { AudioLevelIndicator, AudioLevelText } from '@/components/AudioLevelIndicator';
import { BufferedAudioChunk } from '@/lib/audio-buffer';
import { ServiceError } from '@/lib/types';

export default function AudioDemoPage() {
  const [audioChunks, setAudioChunks] = useState<ArrayBuffer[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<ServiceError | null>(null);
  const [demoLevel, setDemoLevel] = useState(50);

  const handleAudioChunk = (chunk: ArrayBuffer) => {
    setAudioChunks(prev => [...prev.slice(-10), chunk]); // Keep last 10 chunks
    console.log('Received audio chunk:', chunk.byteLength, 'bytes');
  };

  const handleAudioBatch = async (chunks: BufferedAudioChunk[]) => {
    console.log('Received audio batch:', chunks.length, 'chunks');
    // Here you would send the chunks to your backend service
  };

  const handleError = (error: ServiceError) => {
    setError(error);
    console.error('Audio error:', error);
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Audio Components Demo
          </h1>
          <p className="text-lg text-gray-600">
            Test and demonstrate audio capture, processing, and streaming components
          </p>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-medium text-red-800">Audio Error</h3>
                <p className="text-sm text-red-700 mt-1">{error.message}</p>
                <p className="text-xs text-red-600 mt-1">
                  Service: {error.service} | Code: {error.code}
                </p>
              </div>
              <button
                onClick={clearError}
                className="text-red-600 hover:text-red-700"
              >
                ×
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Audio Level Indicators Demo */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Audio Level Indicators</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Bars Variant</h3>
                <AudioLevelIndicator
                  level={demoLevel}
                  isRecording={isRecording}
                  variant="bars"
                  size="large"
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Circle Variant</h3>
                <AudioLevelIndicator
                  level={demoLevel}
                  isRecording={isRecording}
                  variant="circle"
                  size="large"
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Waveform Variant</h3>
                <AudioLevelIndicator
                  level={demoLevel}
                  isRecording={isRecording}
                  variant="waveform"
                  size="large"
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Level Text</h3>
                <AudioLevelText
                  level={demoLevel}
                  isRecording={isRecording}
                />
              </div>

              {/* Demo Controls */}
              <div className="pt-4 border-t">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Demo Level: {demoLevel}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={demoLevel}
                  onChange={(e) => setDemoLevel(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setIsRecording(!isRecording)}
                    className={`px-3 py-1 text-sm rounded ${
                      isRecording
                        ? 'bg-red-500 text-white'
                        : 'bg-blue-500 text-white'
                    }`}
                  >
                    {isRecording ? 'Stop Demo' : 'Start Demo'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Voice Input Components Demo */}
          <div className="bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Voice Input Components</h2>
            
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Standard Voice Input</h3>
                <VoiceInput
                  onAudioChunk={handleAudioChunk}
                  onError={handleError}
                  onRecordingStateChange={setIsRecording}
                />
              </div>

              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-4">Compact Voice Input</h3>
                <VoiceInputCompact
                  onAudioChunk={handleAudioChunk}
                  onError={handleError}
                  onRecordingStateChange={setIsRecording}
                />
              </div>
            </div>
          </div>

          {/* Streaming Voice Input Demo */}
          <div className="lg:col-span-2 bg-white p-6 rounded-lg shadow-sm border">
            <h2 className="text-xl font-semibold mb-4">Streaming Voice Input</h2>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <VoiceInputStreaming
                  onAudioBatch={handleAudioBatch}
                  onError={handleError}
                  onStreamingStateChange={setIsRecording}
                  showAdvancedControls={true}
                  showBufferStats={true}
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Audio Chunks Received: {audioChunks.length}
                  </h3>
                  <div className="text-xs text-gray-500">
                    {audioChunks.length > 0 && (
                      <p>
                        Latest chunk: {audioChunks[audioChunks.length - 1]?.byteLength || 0} bytes
                      </p>
                    )}
                  </div>
                </div>

                <div className="p-3 bg-gray-50 rounded text-xs">
                  <h4 className="font-medium mb-2">Instructions:</h4>
                  <ul className="space-y-1 text-gray-600">
                    <li>• Click the microphone button to start recording</li>
                    <li>• Grant microphone permissions when prompted</li>
                    <li>• Speak into your microphone to see audio levels</li>
                    <li>• Audio chunks will be processed and displayed</li>
                    <li>• Use advanced controls to manage buffering</li>
                  </ul>
                </div>

                <div className="p-3 bg-blue-50 rounded text-xs">
                  <h4 className="font-medium mb-2 text-blue-800">Features Demonstrated:</h4>
                  <ul className="space-y-1 text-blue-700">
                    <li>✅ Web Audio API integration</li>
                    <li>✅ Real-time audio level detection</li>
                    <li>✅ Audio chunk processing and buffering</li>
                    <li>✅ Microphone permission handling</li>
                    <li>✅ Visual feedback components</li>
                    <li>✅ Error handling and recovery</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8 text-center">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}