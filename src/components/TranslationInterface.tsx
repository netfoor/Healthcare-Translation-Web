/**
 * TranslationInterface - Main translation interface component
 * Integrates all UI components with responsive design and state management
 */

'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { ResponsiveLayout } from './ResponsiveLayout';
import { TranscriptEntry, ServiceError } from '../lib/types';
import { DEFAULT_LANGUAGES } from '../lib/languages';

export interface TranslationInterfaceProps {
  className?: string;
  onSessionStart?: () => void;
  onSessionEnd?: () => void;
  onError?: (error: ServiceError) => void;
}

export function TranslationInterface({
  className = '',
  onSessionStart,
  onSessionEnd,
  onError
}: TranslationInterfaceProps) {
  // Language state
  const [inputLanguage, setInputLanguage] = useState(DEFAULT_LANGUAGES.input);
  const [outputLanguage, setOutputLanguage] = useState(DEFAULT_LANGUAGES.output);

  // Transcript state
  const [originalText, setOriginalText] = useState('');
  const [translatedText, setTranslatedText] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);
  const [currentPlayingId, setCurrentPlayingId] = useState<string>();

  // Recording state
  const [isRecording, setIsRecording] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);

  // Error state
  const [lastError, setLastError] = useState<ServiceError | null>(null);

  /**
   * Handle language change with persistence
   */
  const handleLanguageChange = useCallback((type: 'input' | 'output', language: string) => {
    if (type === 'input') {
      setInputLanguage(language);
      // Persist to localStorage
      localStorage.setItem('healthcare-translation-input-lang', language);
    } else {
      setOutputLanguage(language);
      // Persist to localStorage
      localStorage.setItem('healthcare-translation-output-lang', language);
    }

    // Clear current transcript when language changes
    setOriginalText('');
    setTranslatedText('');
    setIsTranslating(false);
  }, []);

  /**
   * Load saved language preferences
   */
  useEffect(() => {
    const savedInputLang = localStorage.getItem('healthcare-translation-input-lang');
    const savedOutputLang = localStorage.getItem('healthcare-translation-output-lang');

    if (savedInputLang) {
      setInputLanguage(savedInputLang);
    }
    if (savedOutputLang) {
      setOutputLanguage(savedOutputLang);
    }
  }, []);

  /**
   * Handle audio chunk from voice input
   */
  const handleAudioChunk = useCallback((chunk: ArrayBuffer) => {
    // TODO: Send audio chunk to transcription service
    console.log('Audio chunk received:', chunk.byteLength, 'bytes');
    
    // Mock transcription for development
    if (process.env.NODE_ENV === 'development') {
      // Simulate real-time transcription
      setTimeout(() => {
        const mockTranscripts = [
          'Hello, I need help with my medication.',
          'I have been experiencing chest pain.',
          'Can you help me understand my diagnosis?',
          'I need to schedule a follow-up appointment.',
          'My symptoms have been getting worse.'
        ];
        
        const randomTranscript = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
        setOriginalText(randomTranscript);
        
        // Mock translation
        setIsTranslating(true);
        setTimeout(() => {
          const mockTranslations: Record<string, string> = {
            'Hello, I need help with my medication.': 'Hola, necesito ayuda con mi medicamento.',
            'I have been experiencing chest pain.': 'He estado experimentando dolor en el pecho.',
            'Can you help me understand my diagnosis?': '¿Puedes ayudarme a entender mi diagnóstico?',
            'I need to schedule a follow-up appointment.': 'Necesito programar una cita de seguimiento.',
            'My symptoms have been getting worse.': 'Mis síntomas han estado empeorando.'
          };
          
          setTranslatedText(mockTranslations[randomTranscript] || 'Traducción no disponible');
          setIsTranslating(false);
        }, 1500);
      }, 500);
    }
  }, []);

  /**
   * Handle recording state change
   */
  const handleRecordingStateChange = useCallback((recording: boolean) => {
    setIsRecording(recording);
    
    if (recording && !sessionActive) {
      setSessionActive(true);
      onSessionStart?.();
    }
  }, [sessionActive, onSessionStart]);

  /**
   * Handle text-to-speech playback
   */
  const handleSpeakTranslation = useCallback((text: string) => {
    // TODO: Implement TTS playback
    console.log('Speaking text:', text);
    
    // Mock audio playback for development
    if (process.env.NODE_ENV === 'development') {
      // Find the entry ID for highlighting
      const entry = transcriptEntries.find(e => e.translatedText === text);
      if (entry) {
        setCurrentPlayingId(entry.id);
        
        // Simulate audio duration
        setTimeout(() => {
          setCurrentPlayingId(undefined);
        }, 3000);
      }
    }
  }, [transcriptEntries]);

  /**
   * Handle errors
   */
  const handleError = useCallback((error: ServiceError) => {
    setLastError(error);
    onError?.(error);
    
    // Auto-clear error after 5 seconds
    setTimeout(() => {
      setLastError(null);
    }, 5000);
  }, [onError]);

  /**
   * Finalize current transcript entry
   */
  const finalizeTranscriptEntry = useCallback(() => {
    if (originalText || translatedText) {
      const newEntry: TranscriptEntry = {
        id: `entry-${Date.now()}`,
        sessionId: 'current-session', // TODO: Use actual session ID
        originalText,
        translatedText,
        confidence: 0.95, // TODO: Use actual confidence score
        timestamp: new Date(),
        isProcessing: false
      };

      setTranscriptEntries(prev => [...prev, newEntry]);
      setOriginalText('');
      setTranslatedText('');
      setIsTranslating(false);
    }
  }, [originalText, translatedText]);

  /**
   * Handle session end
   */
  const handleSessionEnd = useCallback(() => {
    finalizeTranscriptEntry();
    setSessionActive(false);
    setIsRecording(false);
    onSessionEnd?.();
  }, [finalizeTranscriptEntry, onSessionEnd]);

  /**
   * Auto-finalize entry when recording stops
   */
  useEffect(() => {
    if (!isRecording && (originalText || translatedText)) {
      const timer = setTimeout(finalizeTranscriptEntry, 2000);
      return () => clearTimeout(timer);
    }
  }, [isRecording, originalText, translatedText, finalizeTranscriptEntry]);

  /**
   * Clear all transcripts
   */
  const handleClearTranscripts = useCallback(() => {
    setTranscriptEntries([]);
    setOriginalText('');
    setTranslatedText('');
    setIsTranslating(false);
    setCurrentPlayingId(undefined);
  }, []);

  return (
    <div className={`w-full h-full ${className}`}>
      <ResponsiveLayout
        // Language settings
        inputLanguage={inputLanguage}
        outputLanguage={outputLanguage}
        onLanguageChange={handleLanguageChange}
        
        // Transcript data
        originalText={originalText}
        translatedText={translatedText}
        isTranslating={isTranslating}
        transcriptEntries={transcriptEntries}
        currentPlayingId={currentPlayingId}
        
        // Voice input
        onAudioChunk={handleAudioChunk}
        onRecordingStateChange={handleRecordingStateChange}
        
        // Audio playback
        onSpeakTranslation={handleSpeakTranslation}
        
        // Error handling
        onError={handleError}
        
        // State
        disabled={false}
      />

      {/* Session Controls (floating action buttons for mobile) */}
      {sessionActive && (
        <div className="fixed bottom-6 right-6 flex flex-col gap-3 z-40">
          <button
            onClick={handleClearTranscripts}
            className="w-12 h-12 bg-gray-600 hover:bg-gray-700 text-white rounded-full shadow-lg transition-colors flex items-center justify-center"
            title="Clear transcripts"
            aria-label="Clear all transcripts"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
          
          <button
            onClick={handleSessionEnd}
            className="w-12 h-12 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg transition-colors flex items-center justify-center"
            title="End session"
            aria-label="End translation session"
          >
            <StopIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Error Toast */}
      {lastError && (
        <div className="fixed top-4 right-4 max-w-sm bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg shadow-lg p-4 z-50">
          <div className="flex items-start gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                {lastError.service} Error
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                {lastError.message}
              </p>
            </div>
            <button
              onClick={() => setLastError(null)}
              className="text-red-400 hover:text-red-600 transition-colors"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Development Info */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 left-4 bg-black text-white text-xs p-2 rounded opacity-50 pointer-events-none z-50">
          <div>Recording: {isRecording ? 'ON' : 'OFF'}</div>
          <div>Session: {sessionActive ? 'ACTIVE' : 'INACTIVE'}</div>
          <div>Entries: {transcriptEntries.length}</div>
        </div>
      )}
    </div>
  );
}

/**
 * Icon components
 */
function TrashIcon({ className }: { className?: string }) {
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
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

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

function XMarkIcon({ className }: { className?: string }) {
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
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}