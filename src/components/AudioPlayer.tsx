'use client';

import React, { useState, useEffect } from 'react';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';

export interface AudioPlayerProps {
    audioData?: string | ArrayBuffer | Blob;
    audioUrl?: string;
    format?: string;
    text?: string;
    language?: string;
    voiceId?: string;
    className?: string;
    showProgress?: boolean;
    showVolume?: boolean;
    showTime?: boolean;
    autoPlay?: boolean;
    onPlaybackStart?: () => void;
    onPlaybackEnd?: () => void;
    onPlaybackError?: (error: Error) => void;
}

export function AudioPlayer({
    audioData,
    audioUrl,
    format = 'mp3',
    text = '',
    language = 'en-US',
    voiceId,
    className = '',
    showProgress = true,
    showVolume = true,
    showTime = true,
    autoPlay = false,
    onPlaybackStart,
    onPlaybackEnd,
    onPlaybackError
}: AudioPlayerProps) {
    const [isHighlighting, setIsHighlighting] = useState(false);
    const [highlightedText, setHighlightedText] = useState('');

    const { state, controls } = useAudioPlayback({
        enableCaching: true,
        onPlaybackStart: () => {
            setIsHighlighting(true);
            onPlaybackStart?.();
        },
        onPlaybackEnd: () => {
            setIsHighlighting(false);
            setHighlightedText('');
            onPlaybackEnd?.();
        },
        onPlaybackError,
        onTimeUpdate: (currentTime, duration) => {
            // Simple text highlighting based on playback progress
            if (text && duration > 0) {
                const progress = currentTime / duration;
                const textLength = text.length;
                const highlightEnd = Math.floor(progress * textLength);
                setHighlightedText(text.substring(0, highlightEnd));
            }
        }
    });

    // Load audio when props change
    useEffect(() => {
        const loadAudioData = async () => {
            try {
                if (audioData) {
                    await controls.loadAudio(audioData, format);
                } else if (audioUrl) {
                    await controls.loadAudioFromUrl(audioUrl);
                }
            } catch (error) {
                console.error('Failed to load audio:', error);
            }
        };

        if (audioData || audioUrl) {
            loadAudioData();
        }
    }, [audioData, audioUrl, format, controls]);

    // Auto-play if enabled
    useEffect(() => {
        if (autoPlay && !state.isLoading && !state.isPlaying && (audioData || audioUrl)) {
            controls.play().catch(error => {
                console.error('Auto-play failed:', error);
            });
        }
    }, [autoPlay, state.isLoading, state.isPlaying, audioData, audioUrl, controls]);

    const handlePlayPause = async () => {
        try {
            if (state.isPlaying) {
                controls.pause();
            } else {
                await controls.play();
            }
        } catch (error) {
            console.error('Play/pause failed:', error);
        }
    };

    const handleStop = () => {
        controls.stop();
        setIsHighlighting(false);
        setHighlightedText('');
    };

    const handleProgressChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const progress = parseFloat(event.target.value);
        const seekTime = (progress / 100) * state.duration;
        controls.seek(seekTime);
    };

    const handleVolumeChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const volume = parseFloat(event.target.value) / 100;
        controls.setVolume(volume);
    };

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const progressPercentage = state.duration > 0 ? (state.currentTime / state.duration) * 100 : 0;
    const volumePercentage = state.volume * 100;

    const hasAudio = !!(audioData || audioUrl);

    return (
        <div className={`audio-player ${className}`}>
            {/* Text display with highlighting */}
            {text && (
                <div className="audio-text mb-4 p-3 bg-gray-50 rounded-lg border">
                    <div className="text-sm text-gray-600 mb-1">
                        {language} {voiceId && `• ${voiceId}`}
                    </div>
                    <div className="text-base leading-relaxed">
                        {isHighlighting && highlightedText ? (
                            <>
                                <span className="bg-blue-200 text-blue-900 transition-all duration-100">
                                    {highlightedText}
                                </span>
                                <span className="text-gray-700">
                                    {text.substring(highlightedText.length)}
                                </span>
                            </>
                        ) : (
                            <span className="text-gray-700">{text}</span>
                        )}
                    </div>
                </div>
            )}

            {/* Audio controls */}
            <div className="audio-controls bg-white border rounded-lg p-4 shadow-sm">
                {/* Main control buttons */}
                <div className="flex items-center justify-center space-x-4 mb-4">
                    <button
                        onClick={handlePlayPause}
                        disabled={!hasAudio || state.isLoading}
                        className="flex items-center justify-center w-12 h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                        aria-label={state.isPlaying ? 'Pause' : 'Play'}
                    >
                        {state.isLoading ? (
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : state.isPlaying ? (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                            </svg>
                        ) : (
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                            </svg>
                        )}
                    </button>

                    <button
                        onClick={handleStop}
                        disabled={!hasAudio || (!state.isPlaying && !state.isPaused)}
                        className="flex items-center justify-center w-10 h-10 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-300 text-white rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
                        aria-label="Stop"
                    >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M6 6h12v12H6z" />
                        </svg>
                    </button>
                </div>

                {/* Progress bar */}
                {showProgress && (
                    <div className="mb-4">
                        <div className="flex items-center space-x-3">
                            {showTime && (
                                <span className="text-sm text-gray-500 w-12 text-right">
                                    {formatTime(state.currentTime)}
                                </span>
                            )}
                            <div className="flex-1">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={progressPercentage}
                                    onChange={handleProgressChange}
                                    disabled={!hasAudio || state.duration === 0}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                    aria-label="Audio progress"
                                />
                            </div>
                            {showTime && (
                                <span className="text-sm text-gray-500 w-12">
                                    {formatTime(state.duration)}
                                </span>
                            )}
                        </div>
                    </div>
                )}

                {/* Volume control */}
                {showVolume && (
                    <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                        </svg>
                        <div className="flex-1">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={volumePercentage}
                                onChange={handleVolumeChange}
                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                                aria-label="Volume"
                            />
                        </div>
                        <span className="text-sm text-gray-500 w-8">
                            {Math.round(volumePercentage)}%
                        </span>
                    </div>
                )}

                {/* Error display */}
                {state.error && (
                    <div className="mt-3 p-2 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                        <div className="flex items-center">
                            <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                            </svg>
                            {state.error}
                        </div>
                    </div>
                )}

                {/* Status indicators */}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                        {state.isLoading && (
                            <span className="flex items-center">
                                <div className="w-3 h-3 border border-blue-500 border-t-transparent rounded-full animate-spin mr-1" />
                                Loading...
                            </span>
                        )}
                        {state.isPlaying && (
                            <span className="flex items-center text-green-600">
                                <div className="w-2 h-2 bg-green-500 rounded-full mr-1 animate-pulse" />
                                Playing
                            </span>
                        )}
                        {state.isPaused && (
                            <span className="flex items-center text-yellow-600">
                                <div className="w-2 h-2 bg-yellow-500 rounded-full mr-1" />
                                Paused
                            </span>
                        )}
                    </div>
                    {format && (
                        <span className="uppercase">{format}</span>
                    )}
                </div>
            </div>

            <style jsx>{`
                .slider::-webkit-slider-thumb {
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .slider::-webkit-slider-thumb:hover {
                    background: #2563eb;
                    transform: scale(1.1);
                }

                .slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    border-radius: 50%;
                    background: #3b82f6;
                    cursor: pointer;
                    border: 2px solid #ffffff;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                }

                .slider::-moz-range-thumb:hover {
                    background: #2563eb;
                    transform: scale(1.1);
                }

                .slider:disabled::-webkit-slider-thumb {
                    background: #9ca3af;
                    cursor: not-allowed;
                }

                .slider:disabled::-moz-range-thumb {
                    background: #9ca3af;
                    cursor: not-allowed;
                }
            `}</style>
        </div>
    );
}