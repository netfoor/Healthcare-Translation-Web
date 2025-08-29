/**
 * TypeScript interfaces for Healthcare Translation App
 * Data models and service contracts
 */

import { AuthUser } from 'aws-amplify/auth';

// Core Data Models
export interface TranslationSession {
  id: string;
  userId: string;
  inputLanguage: string;
  outputLanguage: string;
  status: 'active' | 'paused' | 'ended';
  createdAt: Date;
  lastActivity: Date;
}

export interface TranscriptEntry {
  id: string;
  sessionId: string;
  originalText: string;
  translatedText?: string;
  confidence: number;
  timestamp: Date;
  speaker?: string;
  isProcessing: boolean;
}

export interface AudioMetadata {
  id: string;
  sessionId: string;
  s3Key: string;
  duration: number;
  format: string;
  language: string;
  createdAt: Date;
}

// Medical Context for AI Enhancement
export interface MedicalContext {
  specialty?: string;
  commonTerms: string[];
  previousContext: string[];
  urgencyLevel: 'low' | 'medium' | 'high';
}

// Language Configuration
export interface Language {
  code: string;
  name: string;
  nativeName: string;
  isSupported: boolean;
  isCommon: boolean;
}

// Service Interfaces
export interface WebSocketManager {
  connect(): Promise<void>;
  disconnect(): void;
  sendAudioChunk(audioData: ArrayBuffer): void;
  onTranscriptReceived: (callback: (transcript: string) => void) => void;
  onTranslationReceived: (callback: (translation: string) => void) => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export interface AudioProcessor {
  startRecording(): Promise<void>;
  stopRecording(): void;
  getAudioLevel(): number;
  onAudioChunk: (callback: (chunk: ArrayBuffer) => void) => void;
  isRecording: boolean;
}

// API Response Types
export interface TranscriptResult {
  text: string;
  confidence: number;
  isFinal: boolean;
  timestamp: Date;
}

export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  confidence: number;
  timestamp: Date;
}

export interface AudioResult {
  audioUrl: string;
  duration: number;
  format: string;
  s3Key?: string;
}

// Error Types
export interface ServiceError {
  code: string;
  message: string;
  service: string;
  timestamp: Date;
  retryable: boolean;
}

// Configuration Types
export interface AppConfig {
  aws: {
    region: string;
    websocketUrl?: string;
    transcribeUrl?: string;
    translationUrl?: string;
    ttsUrl?: string;
  };
  audio: {
    maxDuration: number;
    sampleRate: number;
    format: string;
  };
  session: {
    timeoutMinutes: number;
  };
  features: {
    enableDebugLogging: boolean;
    mockServices: boolean;
  };
}

// Component Props Types
export interface VoiceInputProps {
  onTranscriptUpdate: (transcript: string) => void;
  isListening: boolean;
  audioLevel: number;
  onError: (error: ServiceError) => void;
}

export interface TranscriptDisplayProps {
  originalText: string;
  translatedText: string;
  isTranslating: boolean;
  onSpeakTranslation: (text: string) => void;
  entries: TranscriptEntry[];
}

export interface LanguageSelectorProps {
  inputLanguage: string;
  outputLanguage: string;
  onLanguageChange: (type: 'input' | 'output', language: string) => void;
  supportedLanguages: Language[];
  disabled?: boolean;
}

export interface AppLayoutProps {
  children: React.ReactNode;
  user?: AuthUser;
}

// Authentication Types - Re-export from aws-amplify/auth for consistency
export type { AuthUser } from 'aws-amplify/auth';

// WebSocket Message Types
export interface WebSocketMessage<T = Record<string, unknown>> {
  type: 'audio' | 'transcript' | 'translation' | 'error' | 'status';
  payload: T;
  timestamp: Date;
  sessionId?: string;
}

export interface AudioChunkMessage extends WebSocketMessage<{
  audioData: ArrayBuffer;
  sequence: number;
  isLast: boolean;
}> {
  type: 'audio';
}

export interface TranscriptMessage extends WebSocketMessage<TranscriptResult> {
  type: 'transcript';
}

export interface TranslationMessage extends WebSocketMessage<TranslationResult> {
  type: 'translation';
}

export interface ErrorMessage extends WebSocketMessage<ServiceError> {
  type: 'error';
}

export interface StatusMessage extends WebSocketMessage<{
  status: string;
  message: string;
}> {
  type: 'status';
}