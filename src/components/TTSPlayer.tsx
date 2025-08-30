'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { AudioPlayer } from './AudioPlayer';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';

export interface TTSPlayerProps {
    text: string;
    language: string;
    voiceId?: string;
    sessionId: string;
    className?: string;
    enableCaching?: boolean;
    useSSML?: boolean;
    autoPlay?: boolean;
    showSpeakButton?: boolean;
    onSynthesisStart?: () => void;
    onSynthesisComplete?: (audioData: string) => void;
    onSynthesisError?: (error: string) => void;
    onPlaybackStart?: () => void;
    onPlaybackEnd?: () => void;
}

interface TTSResponse {
    action: string;
    sessionId: string;
    success: boolean;
    audioUrl?: string;
    audioData?: string;
    voiceId?: string;
    language?: string;
    format?: string;
    cached?: boolean;
    error?: string;
    timestamp: string;
}

export function TTSPlayer({
    text,
    language,
    voiceId,
    sessionId,
    className = '',
    enableCaching = true,
    useSSML = false,
    autoPlay = false,
    showSpeakButton = true,
    onSynthesisStart,
    onSynthesisComplete,
    onSynthesisError,
    onPlaybackStart,
    onPlaybackEnd
}: TTSPlayerProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [audioData, setAudioData] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isCached, setIsCached] = useState(false);
    const [actualVoiceId, setActualVoiceId] = useState<string | undefined>(voiceId);

    const { sendMessage, isConnected } = useWebSocket({ 
        url: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:3001',
        autoConnect: false 
    });
    const { getCachedAudio, setCachedAudio, generateCacheKey } = useAudioPlayback({
        enableCaching
    });

    // Check for cached audio when text or language changes
    useEffect(() => {
        if (enableCaching && text.trim()) {
            const cacheKey = generateCacheKey(text, language, voiceId);
            const cached = getCachedAudio(cacheKey);
            
            if (cached) {
                if (typeof cached.audioData === 'string') {
                    setAudioData(cached.audioData);
                    setActualVoiceId(cached.voiceId);
                    setIsCached(true);
                    setError(null);
                    
                    if (autoPlay) {
                        // Audio will auto-play via AudioPlayer component
                    }
                }
            } else {
                setAudioData(null);
                setIsCached(false);
            }
        }
    }, [text, language, voiceId, enableCaching, getCachedAudio, generateCacheKey, autoPlay]);

    // Handle WebSocket messages
    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            try {
                const response: TTSResponse = JSON.parse(event.data);
                
                if (response.sessionId !== sessionId) {
                    return; // Not for this session
                }

                switch (response.action) {
                    case 'speechSynthesized':
                        setIsGenerating(false);
                        
                        if (response.success && response.audioData) {
                            setAudioData(response.audioData);
                            setActualVoiceId(response.voiceId);
                            setIsCached(response.cached || false);
                            setError(null);
                            
                            // Cache the result if not already cached
                            if (enableCaching && !response.cached) {
                                const cacheKey = generateCacheKey(text, language, voiceId);
                                setCachedAudio(
                                    cacheKey,
                                    response.audioData,
                                    response.format || 'mp3',
                                    response.voiceId || '',
                                    response.language || language
                                );
                            }
                            
                            onSynthesisComplete?.(response.audioData);
                        } else {
                            const errorMsg = response.error || 'Speech synthesis failed';
                            setError(errorMsg);
                            onSynthesisError?.(errorMsg);
                        }
                        break;
                        
                    case 'ssmlGenerated':
                        setIsGenerating(false);
                        
                        if (response.success && response.audioData) {
                            // For SSML generation, audioData contains the SSML text
                            console.log('Generated SSML:', response.audioData);
                        } else {
                            const errorMsg = response.error || 'SSML generation failed';
                            setError(errorMsg);
                            onSynthesisError?.(errorMsg);
                        }
                        break;
                        
                    case 'ttsError':
                        setIsGenerating(false);
                        const errorMsg = response.error || 'TTS service error';
                        setError(errorMsg);
                        onSynthesisError?.(errorMsg);
                        break;
                }
            } catch (error) {
                console.error('Error parsing TTS response:', error);
                setIsGenerating(false);
                setError('Failed to parse TTS response');
            }
        };

        if (isConnected) {
            // Add message listener (this would need to be implemented in useWebSocket)
            // For now, we'll assume the WebSocket hook handles message routing
        }

        return () => {
            // Cleanup listener
        };
    }, [sessionId, text, language, voiceId, enableCaching, getCachedAudio, setCachedAudio, generateCacheKey, onSynthesisComplete, onSynthesisError, isConnected]);

    const handleSpeakClick = useCallback(async () => {
        if (!text.trim()) {
            setError('No text to synthesize');
            return;
        }

        if (!isConnected) {
            setError('WebSocket not connected');
            return;
        }

        setIsGenerating(true);
        setError(null);
        onSynthesisStart?.();

        try {
            const message = {
                action: 'synthesizeSpeech',
                sessionId,
                data: {
                    text: text.trim(),
                    language,
                    voiceId,
                    useSSML,
                    enableCaching
                }
            };

            await sendMessage(message);
        } catch (error) {
            setIsGenerating(false);
            const errorMsg = error instanceof Error ? error.message : 'Failed to send TTS request';
            setError(errorMsg);
            onSynthesisError?.(errorMsg);
        }
    }, [text, language, voiceId, sessionId, useSSML, enableCaching, isConnected, sendMessage, onSynthesisStart, onSynthesisError]);

    const handleGenerateSSML = useCallback(async () => {
        if (!text.trim()) {
            setError('No text to generate SSML for');
            return;
        }

        if (!isConnected) {
            setError('WebSocket not connected');
            return;
        }

        setIsGenerating(true);
        setError(null);

        try {
            const message = {
                action: 'generateSSML',
                sessionId,
                data: {
                    text: text.trim(),
                    language
                }
            };

            await sendMessage(message);
        } catch (error) {
            setIsGenerating(false);
            const errorMsg = error instanceof Error ? error.message : 'Failed to send SSML request';
            setError(errorMsg);
            onSynthesisError?.(errorMsg);
        }
    }, [text, language, sessionId, isConnected, sendMessage, onSynthesisError]);

    const hasAudio = !!audioData;
    const canSpeak = !isGenerating && text.trim().length > 0 && isConnected;

    return (
        <div className={`tts-player ${className}`}>
            {/* Control buttons */}
            {showSpeakButton && (
                <div className="tts-controls mb-4 flex items-center space-x-3">
                    <button
                        onClick={handleSpeakClick}
                        disabled={!canSpeak}
                        className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        aria-label="Speak text"
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                Generating...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                                </svg>
                                Speak
                            </>
                        )}
                    </button>

                    {useSSML && (
                        <button
                            onClick={handleGenerateSSML}
                            disabled={!canSpeak}
                            className="flex items-center px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            aria-label="Generate SSML"
                        >
                            <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                            </svg>
                            SSML
                        </button>
                    )}

                    {/* Status indicators */}
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                        {!isConnected && (
                            <span className="flex items-center text-red-500">
                                <div className="w-2 h-2 bg-red-500 rounded-full mr-1" />
                                Disconnected
                            </span>
                        )}
                        {isCached && hasAudio && (
                            <span className="flex items-center text-green-600">
                                <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z" />
                                </svg>
                                Cached
                            </span>
                        )}
                    </div>
                </div>
            )}

            {/* Error display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <div className="flex items-center">
                        <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                        </svg>
                        {error}
                    </div>
                </div>
            )}

            {/* Audio player */}
            {hasAudio && (
                <AudioPlayer
                    audioData={audioData}
                    format="mp3"
                    text={text}
                    language={language}
                    voiceId={actualVoiceId}
                    autoPlay={autoPlay}
                    onPlaybackStart={onPlaybackStart}
                    onPlaybackEnd={onPlaybackEnd}
                    className="mt-4"
                />
            )}

            {/* Placeholder when no audio */}
            {!hasAudio && !isGenerating && text.trim() && (
                <div className="mt-4 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center text-gray-500">
                    <svg className="w-8 h-8 mx-auto mb-2 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 14c1.66 0 2.99-1.34 2.99-3L15 5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.3-3c0 3-2.54 5.1-5.3 5.1S6.7 14 6.7 11H5c0 3.41 2.72 6.23 6 6.72V21h2v-3.28c3.28-.48 6-3.3 6-6.72h-1.7z" />
                    </svg>
                    <p>Click &quot;Speak&quot; to generate audio</p>
                </div>
            )}
        </div>
    );
}