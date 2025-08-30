/**
 * TranscriptDisplay - Dual-pane transcript display with real-time updates
 * Shows original and translated text side by side with smooth scrolling
 */

'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { TranscriptEntry } from '../lib/types';
import { LoadingSpinner } from './LoadingSpinner';

export interface TranscriptDisplayProps {
  originalText: string;
  translatedText: string;
  isTranslating: boolean;
  onSpeakTranslation: (text: string) => void;
  entries: TranscriptEntry[];
  className?: string;
  showHistory?: boolean;
  highlightCurrentEntry?: boolean;
  currentPlayingId?: string;
}

export function TranscriptDisplay({
  originalText,
  translatedText,
  isTranslating,
  onSpeakTranslation,
  entries,
  className = '',
  showHistory = true,
  highlightCurrentEntry = true,
  currentPlayingId
}: TranscriptDisplayProps) {
  const originalScrollRef = useRef<HTMLDivElement>(null);
  const translatedScrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);

  /**
   * Auto-scroll to bottom when new content is added
   */
  const scrollToBottom = useCallback(() => {
    if (!autoScroll) return;

    const scrollElement = (ref: React.RefObject<HTMLDivElement | null>) => {
      if (ref.current) {
        ref.current.scrollTo({
          top: ref.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    };

    scrollElement(originalScrollRef);
    scrollElement(translatedScrollRef);
  }, [autoScroll]);

  /**
   * Handle scroll events to detect manual scrolling
   */
  const handleScroll = useCallback((ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return;

    const { scrollTop, scrollHeight, clientHeight } = ref.current;
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
    
    if (!isAtBottom && autoScroll) {
      setAutoScroll(false);
    } else if (isAtBottom && !autoScroll) {
      setAutoScroll(true);
    }
  }, [autoScroll]);

  /**
   * Scroll to bottom when new entries are added
   */
  useEffect(() => {
    scrollToBottom();
  }, [entries.length, originalText, translatedText, scrollToBottom]);

  /**
   * Render transcript entry
   */
  const renderTranscriptEntry = useCallback((
    entry: TranscriptEntry,
    type: 'original' | 'translated'
  ) => {
    const text = type === 'original' ? entry.originalText : entry.translatedText;
    const isCurrentlyPlaying = currentPlayingId === entry.id;
    const isProcessing = entry.isProcessing && type === 'translated';

    if (!text && !isProcessing) return null;

    return (
      <div
        key={`${entry.id}-${type}`}
        className={`p-3 rounded-lg transition-all duration-200 ${
          isCurrentlyPlaying && highlightCurrentEntry
            ? 'bg-blue-100 dark:bg-blue-900/30 border-l-4 border-blue-500'
            : 'bg-gray-50 dark:bg-gray-800/50'
        } ${
          entry.confidence < 0.7 ? 'border-l-4 border-yellow-400' : ''
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Translating...
                </span>
              </div>
            ) : (
              <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
                {text}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-blue-600 dark:text-blue-400 font-medium">
                <span>{entry.timestamp.toLocaleTimeString()}</span>
                {entry.confidence < 1 && (
                  <span className={`px-1.5 py-0.5 rounded text-xs ${
                    entry.confidence >= 0.8
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : entry.confidence >= 0.7
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    {Math.round(entry.confidence * 100)}%
                  </span>
                )}
              </div>
              
              {type === 'translated' && text && !isProcessing && (
                <button
                  onClick={() => onSpeakTranslation(text)}
                  className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  title="Play audio"
                  aria-label="Play translated text as audio"
                >
                  <SpeakerIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [currentPlayingId, highlightCurrentEntry, onSpeakTranslation]);

  /**
   * Render current live transcript
   */
  const renderLiveTranscript = useCallback((
    text: string,
    type: 'original' | 'translated',
    isProcessing: boolean = false
  ) => {
    if (!text && !isProcessing) return null;

    return (
      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            {isProcessing ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-blue-700 dark:text-blue-300 font-medium">
                  {type === 'translated' ? 'Translating...' : 'Listening...'}
                </span>
              </div>
            ) : (
              <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
                {text}
              </p>
            )}
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                Live
              </span>
              
              {type === 'translated' && text && !isProcessing && (
                <button
                  onClick={() => onSpeakTranslation(text)}
                  className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  title="Play audio"
                  aria-label="Play translated text as audio"
                >
                  <SpeakerIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }, [onSpeakTranslation]);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Transcript
        </h2>
        
        <div className="flex items-center gap-2">
          {!autoScroll && (
            <button
              onClick={() => {
                setAutoScroll(true);
                scrollToBottom();
              }}
              className="px-3 py-1 text-sm bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 rounded-full transition-colors"
            >
              Scroll to bottom
            </button>
          )}
          
          <span className="text-sm text-blue-600 dark:text-blue-400 font-medium">
            {entries.length} entries
          </span>
        </div>
      </div>

      {/* Dual-pane transcript display */}
      <div className="flex-1 flex min-h-0">
        {/* Original Text Pane */}
        <div className="flex-1 flex flex-col border-r border-gray-200 dark:border-gray-700">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Original
            </h3>
          </div>
          
          <div
            ref={originalScrollRef}
            onScroll={() => handleScroll(originalScrollRef)}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {/* Historical entries */}
            {showHistory && entries.map(entry => renderTranscriptEntry(entry, 'original'))}
            
            {/* Current live transcript */}
            {renderLiveTranscript(originalText, 'original')}
          </div>
        </div>

        {/* Translated Text Pane */}
        <div className="flex-1 flex flex-col">
          <div className="p-3 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Translation
            </h3>
          </div>
          
          <div
            ref={translatedScrollRef}
            onScroll={() => handleScroll(translatedScrollRef)}
            className="flex-1 overflow-y-auto p-4 space-y-3"
          >
            {/* Historical entries */}
            {showHistory && entries.map(entry => renderTranscriptEntry(entry, 'translated'))}
            
            {/* Current live translation */}
            {renderLiveTranscript(translatedText, 'translated', isTranslating)}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact transcript display for mobile or smaller spaces
 */
export function TranscriptDisplayCompact({
  originalText,
  translatedText,
  isTranslating,
  onSpeakTranslation,
  entries,
  className = '',
  showHistory = false
}: TranscriptDisplayProps) {
  const [activeTab, setActiveTab] = useState<'original' | 'translated'>('original');
  const scrollRef = useRef<HTMLDivElement>(null);

  /**
   * Auto-scroll to bottom when new content is added
   */
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [entries.length, originalText, translatedText]);

  const currentText = activeTab === 'original' ? originalText : translatedText;
  const currentEntries = entries.filter(entry => 
    activeTab === 'original' ? entry.originalText : entry.translatedText
  );

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Tab Navigation */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('original')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'original'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Original
        </button>
        <button
          onClick={() => setActiveTab('translated')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'translated'
              ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400'
              : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
          }`}
        >
          Translation
          {isTranslating && activeTab !== 'translated' && (
            <span className="ml-1 w-2 h-2 bg-blue-500 rounded-full inline-block animate-pulse" />
          )}
        </button>
      </div>

      {/* Content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3"
      >
        {/* Historical entries */}
        {showHistory && currentEntries.map(entry => (
          <div
            key={entry.id}
            className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50"
          >
            <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
              {activeTab === 'original' ? entry.originalText : entry.translatedText}
            </p>
            
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {entry.timestamp.toLocaleTimeString()}
              </span>
              
              {activeTab === 'translated' && entry.translatedText && (
                <button
                  onClick={() => onSpeakTranslation(entry.translatedText!)}
                  className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                  title="Play audio"
                >
                  <SpeakerIcon className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Current live transcript */}
        {(currentText || (activeTab === 'translated' && isTranslating)) && (
          <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800">
            {isTranslating && activeTab === 'translated' && !translatedText ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Translating...
                </span>
              </div>
            ) : (
              <>
                <p className="text-gray-900 dark:text-gray-100 leading-relaxed">
                  {currentText}
                </p>
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                    Live
                  </span>
                  
                  {activeTab === 'translated' && translatedText && (
                    <button
                      onClick={() => onSpeakTranslation(translatedText)}
                      className="p-1 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                      title="Play audio"
                    >
                      <SpeakerIcon className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Speaker icon component
 */
function SpeakerIcon({ className }: { className?: string }) {
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
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 14.142M9 5l-4 4H3a1 1 0 00-1 1v4a1 1 0 001 1h2l4 4V5z"
      />
    </svg>
  );
}