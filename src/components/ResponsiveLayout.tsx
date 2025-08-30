/**
 * ResponsiveLayout - Mobile-first responsive layout component
 * Handles different screen sizes and orientation changes
 */

'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { TranscriptDisplay, TranscriptDisplayCompact } from './TranscriptDisplay';
import { LanguageSelector, LanguageSelectorCompact } from './LanguageSelector';
import { VoiceInput, VoiceInputCompact } from './VoiceInput';
import { TranscriptEntry, ServiceError } from '../lib/types';

export interface ResponsiveLayoutProps {
  // Language settings
  inputLanguage: string;
  outputLanguage: string;
  onLanguageChange: (type: 'input' | 'output', language: string) => void;
  
  // Transcript data
  originalText: string;
  translatedText: string;
  isTranslating: boolean;
  transcriptEntries: TranscriptEntry[];
  currentPlayingId?: string;
  
  // Voice input
  onAudioChunk?: (chunk: ArrayBuffer) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  
  // Audio playback
  onSpeakTranslation: (text: string) => void;
  
  // Error handling
  onError?: (error: ServiceError) => void;
  
  // Layout options
  className?: string;
  disabled?: boolean;
}

type ScreenSize = 'mobile' | 'tablet' | 'desktop';
type Orientation = 'portrait' | 'landscape';

export function ResponsiveLayout({
  inputLanguage,
  outputLanguage,
  onLanguageChange,
  originalText,
  translatedText,
  isTranslating,
  transcriptEntries,
  currentPlayingId,
  onAudioChunk,
  onRecordingStateChange,
  onSpeakTranslation,
  onError,
  className = '',
  disabled = false
}: ResponsiveLayoutProps) {
  const [screenSize, setScreenSize] = useState<ScreenSize>('desktop');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [isCollapsed, setIsCollapsed] = useState(false);

  /**
   * Detect screen size and orientation
   */
  const updateScreenInfo = useCallback(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    
    // Determine screen size
    if (width < 768) {
      setScreenSize('mobile');
    } else if (width < 1024) {
      setScreenSize('tablet');
    } else {
      setScreenSize('desktop');
    }
    
    // Determine orientation
    setOrientation(width > height ? 'landscape' : 'portrait');
  }, []);

  /**
   * Handle window resize and orientation change
   */
  useEffect(() => {
    updateScreenInfo();
    
    const handleResize = () => updateScreenInfo();
    const handleOrientationChange = () => {
      // Delay to allow for orientation change to complete
      setTimeout(updateScreenInfo, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [updateScreenInfo]);

  /**
   * Get layout configuration based on screen size and orientation
   */
  const getLayoutConfig = useCallback(() => {
    const isMobile = screenSize === 'mobile';
    const isTablet = screenSize === 'tablet';
    const isLandscape = orientation === 'landscape';
    
    return {
      useCompactComponents: isMobile || (isTablet && !isLandscape),
      showLanguageSelectorCollapsed: isMobile,
      transcriptLayout: isMobile ? 'stacked' : (isTablet && !isLandscape) ? 'stacked' : 'side-by-side',
      voiceInputSize: isMobile ? 'compact' : 'full',
      minButtonSize: 44, // iOS/Android accessibility guidelines
      showHistory: !isMobile || isLandscape
    };
  }, [screenSize, orientation]);

  const layoutConfig = getLayoutConfig();

  /**
   * Render mobile layout
   */
  const renderMobileLayout = () => (
    <div className="flex flex-col h-full min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header with language selector */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Healthcare Translation
          </h1>
          
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors"
            style={{ minHeight: '44px', minWidth: '44px' }}
            aria-label="Toggle language settings"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Collapsible language selector */}
        {!isCollapsed && (
          <div className="space-y-4">
            <LanguageSelectorCompact
              inputLanguage={inputLanguage}
              outputLanguage={outputLanguage}
              onLanguageChange={onLanguageChange}
              disabled={disabled}
            />
          </div>
        )}
      </div>

      {/* Voice input section */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-4">
        <VoiceInputCompact
          onAudioChunk={onAudioChunk}
          onRecordingStateChange={onRecordingStateChange}
          onError={onError}
          disabled={disabled}
          className="flex justify-center"
        />
      </div>

      {/* Transcript display */}
      <div className="flex-1 min-h-0">
        <TranscriptDisplayCompact
          originalText={originalText}
          translatedText={translatedText}
          isTranslating={isTranslating}
          onSpeakTranslation={onSpeakTranslation}
          entries={transcriptEntries}
          currentPlayingId={currentPlayingId}
          showHistory={layoutConfig.showHistory}
          className="h-full"
        />
      </div>
    </div>
  );

  /**
   * Render tablet layout
   */
  const renderTabletLayout = () => (
    <div className="flex flex-col h-full min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Healthcare Translation
        </h1>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LanguageSelector
            inputLanguage={inputLanguage}
            outputLanguage={outputLanguage}
            onLanguageChange={onLanguageChange}
            disabled={disabled}
            showCommonFirst={true}
          />
          
          <div className="flex items-center justify-center">
            <VoiceInput
              onAudioChunk={onAudioChunk}
              onRecordingStateChange={onRecordingStateChange}
              onError={onError}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Transcript display */}
      <div className="flex-1 min-h-0 p-6">
        {orientation === 'landscape' ? (
          <TranscriptDisplay
            originalText={originalText}
            translatedText={translatedText}
            isTranslating={isTranslating}
            onSpeakTranslation={onSpeakTranslation}
            entries={transcriptEntries}
            currentPlayingId={currentPlayingId}
            className="h-full"
          />
        ) : (
          <TranscriptDisplayCompact
            originalText={originalText}
            translatedText={translatedText}
            isTranslating={isTranslating}
            onSpeakTranslation={onSpeakTranslation}
            entries={transcriptEntries}
            currentPlayingId={currentPlayingId}
            showHistory={true}
            className="h-full"
          />
        )}
      </div>
    </div>
  );

  /**
   * Render desktop layout
   */
  const renderDesktopLayout = () => (
    <div className="flex flex-col h-full min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
          Healthcare Translation
        </h1>
        
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
          <div className="xl:col-span-2">
            <LanguageSelector
              inputLanguage={inputLanguage}
              outputLanguage={outputLanguage}
              onLanguageChange={onLanguageChange}
              disabled={disabled}
              showCommonFirst={true}
            />
          </div>
          
          <div className="flex items-center justify-center">
            <VoiceInput
              onAudioChunk={onAudioChunk}
              onRecordingStateChange={onRecordingStateChange}
              onError={onError}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0 p-8">
        <TranscriptDisplay
          originalText={originalText}
          translatedText={translatedText}
          isTranslating={isTranslating}
          onSpeakTranslation={onSpeakTranslation}
          entries={transcriptEntries}
          currentPlayingId={currentPlayingId}
          className="h-full"
        />
      </div>
    </div>
  );

  /**
   * Render appropriate layout based on screen size
   */
  const renderLayout = () => {
    switch (screenSize) {
      case 'mobile':
        return renderMobileLayout();
      case 'tablet':
        return renderTabletLayout();
      case 'desktop':
      default:
        return renderDesktopLayout();
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {renderLayout()}
      
      {/* Screen size indicator (development only) */}
      {process.env.NODE_ENV === 'development' && (
        <div className="fixed bottom-4 right-4 px-3 py-1 bg-black text-white text-xs rounded-full opacity-50 pointer-events-none z-50">
          {screenSize} - {orientation}
        </div>
      )}
    </div>
  );
}

/**
 * Touch-friendly button component with minimum 44px size
 */
export function TouchButton({
  children,
  onClick,
  disabled = false,
  variant = 'primary',
  size = 'medium',
  className = '',
  ...props
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'small' | 'medium' | 'large';
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const baseClasses = "inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
  
  const variantClasses = {
    primary: "bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
  };
  
  const sizeClasses = {
    small: "px-3 py-2 text-sm min-h-[44px]", // Ensure minimum touch target
    medium: "px-4 py-3 text-base min-h-[44px]",
    large: "px-6 py-4 text-lg min-h-[48px]"
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

/**
 * Responsive grid component
 */
export function ResponsiveGrid({
  children,
  columns = { mobile: 1, tablet: 2, desktop: 3 },
  gap = 4,
  className = ''
}: {
  children: React.ReactNode;
  columns?: { mobile: number; tablet: number; desktop: number };
  gap?: number;
  className?: string;
}) {
  const gridClasses = `grid gap-${gap} grid-cols-${columns.mobile} md:grid-cols-${columns.tablet} lg:grid-cols-${columns.desktop}`;
  
  return (
    <div className={`${gridClasses} ${className}`}>
      {children}
    </div>
  );
}

/**
 * Settings icon component
 */
function SettingsIcon({ className }: { className?: string }) {
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
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}