import { useState, useRef, useCallback, useEffect } from 'react';

export interface AudioPlaybackState {
    isPlaying: boolean;
    isPaused: boolean;
    isLoading: boolean;
    currentTime: number;
    duration: number;
    volume: number;
    error: string | null;
}

export interface AudioPlaybackControls {
    play: () => Promise<void>;
    pause: () => void;
    stop: () => void;
    seek: (time: number) => void;
    setVolume: (volume: number) => void;
    loadAudio: (audioData: string | ArrayBuffer | Blob, format?: string) => Promise<void>;
    loadAudioFromUrl: (url: string) => Promise<void>;
}

export interface AudioCacheEntry {
    audioData: string | ArrayBuffer | Blob;
    format: string;
    timestamp: number;
    voiceId: string;
    language: string;
}

export interface UseAudioPlaybackOptions {
    enableCaching?: boolean;
    cacheMaxSize?: number;
    cacheExpiryMs?: number;
    onPlaybackStart?: () => void;
    onPlaybackEnd?: () => void;
    onPlaybackError?: (error: Error) => void;
    onTimeUpdate?: (currentTime: number, duration: number) => void;
}

export function useAudioPlayback(options: UseAudioPlaybackOptions = {}) {
    const {
        enableCaching = true,
        cacheMaxSize = 50,
        cacheExpiryMs = 24 * 60 * 60 * 1000, // 24 hours
        onPlaybackStart,
        onPlaybackEnd,
        onPlaybackError,
        onTimeUpdate
    } = options;

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const cacheRef = useRef<Map<string, AudioCacheEntry>>(new Map());
    const currentAudioUrlRef = useRef<string | null>(null);

    const [state, setState] = useState<AudioPlaybackState>({
        isPlaying: false,
        isPaused: false,
        isLoading: false,
        currentTime: 0,
        duration: 0,
        volume: 1.0,
        error: null
    });

    // Initialize audio element
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.preload = 'metadata';
        }

        const audio = audioRef.current;

        const handleLoadStart = () => {
            setState(prev => ({ ...prev, isLoading: true, error: null }));
        };

        const handleLoadedMetadata = () => {
            setState(prev => ({
                ...prev,
                duration: audio.duration || 0,
                isLoading: false
            }));
        };

        const handleCanPlay = () => {
            setState(prev => ({ ...prev, isLoading: false }));
        };

        const handlePlay = () => {
            setState(prev => ({ ...prev, isPlaying: true, isPaused: false }));
            onPlaybackStart?.();
        };

        const handlePause = () => {
            setState(prev => ({ ...prev, isPlaying: false, isPaused: true }));
        };

        const handleEnded = () => {
            setState(prev => ({
                ...prev,
                isPlaying: false,
                isPaused: false,
                currentTime: 0
            }));
            onPlaybackEnd?.();
        };

        const handleTimeUpdate = () => {
            const currentTime = audio.currentTime || 0;
            const duration = audio.duration || 0;
            setState(prev => ({ ...prev, currentTime }));
            onTimeUpdate?.(currentTime, duration);
        };

        const handleError = (event: Event) => {
            const error = new Error(`Audio playback error: ${audio.error?.message || 'Unknown error'}`);
            setState(prev => ({
                ...prev,
                isPlaying: false,
                isPaused: false,
                isLoading: false,
                error: error.message
            }));
            onPlaybackError?.(error);
        };

        const handleVolumeChange = () => {
            setState(prev => ({ ...prev, volume: audio.volume }));
        };

        // Add event listeners
        audio.addEventListener('loadstart', handleLoadStart);
        audio.addEventListener('loadedmetadata', handleLoadedMetadata);
        audio.addEventListener('canplay', handleCanPlay);
        audio.addEventListener('play', handlePlay);
        audio.addEventListener('pause', handlePause);
        audio.addEventListener('ended', handleEnded);
        audio.addEventListener('timeupdate', handleTimeUpdate);
        audio.addEventListener('error', handleError);
        audio.addEventListener('volumechange', handleVolumeChange);

        return () => {
            audio.removeEventListener('loadstart', handleLoadStart);
            audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
            audio.removeEventListener('canplay', handleCanPlay);
            audio.removeEventListener('play', handlePlay);
            audio.removeEventListener('pause', handlePause);
            audio.removeEventListener('ended', handleEnded);
            audio.removeEventListener('timeupdate', handleTimeUpdate);
            audio.removeEventListener('error', handleError);
            audio.removeEventListener('volumechange', handleVolumeChange);
        };
    }, [onPlaybackStart, onPlaybackEnd, onPlaybackError, onTimeUpdate]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current.src = '';
                audioRef.current = null;
            }
            // Clean up object URLs
            if (currentAudioUrlRef.current && currentAudioUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(currentAudioUrlRef.current);
            }
        };
    }, []);

    const generateCacheKey = useCallback((text: string, language: string, voiceId?: string): string => {
        return `${text}-${language}-${voiceId || 'default'}`;
    }, []);

    const getCachedAudio = useCallback((cacheKey: string): AudioCacheEntry | null => {
        if (!enableCaching) return null;

        const cached = cacheRef.current.get(cacheKey);
        if (!cached) return null;

        // Check if cache entry is expired
        if (Date.now() - cached.timestamp > cacheExpiryMs) {
            cacheRef.current.delete(cacheKey);
            return null;
        }

        return cached;
    }, [enableCaching, cacheExpiryMs]);

    const setCachedAudio = useCallback((
        cacheKey: string,
        audioData: string | ArrayBuffer | Blob,
        format: string,
        voiceId: string,
        language: string
    ) => {
        if (!enableCaching) return;

        // Remove oldest entries if cache is full
        if (cacheRef.current.size >= cacheMaxSize) {
            const oldestKey = cacheRef.current.keys().next().value;
            if (oldestKey) {
                cacheRef.current.delete(oldestKey);
            }
        }

        cacheRef.current.set(cacheKey, {
            audioData,
            format,
            timestamp: Date.now(),
            voiceId,
            language
        });
    }, [enableCaching, cacheMaxSize]);

    const loadAudio = useCallback(async (
        audioData: string | ArrayBuffer | Blob,
        format: string = 'mp3'
    ): Promise<void> => {
        if (!audioRef.current) {
            throw new Error('Audio element not initialized');
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Clean up previous object URL
            if (currentAudioUrlRef.current && currentAudioUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(currentAudioUrlRef.current);
            }

            let audioUrl: string;

            if (typeof audioData === 'string') {
                // Handle base64 encoded data
                if (audioData.startsWith('data:')) {
                    audioUrl = audioData;
                } else {
                    // Assume it's base64 without data URL prefix
                    audioUrl = `data:audio/${format};base64,${audioData}`;
                }
            } else if (audioData instanceof ArrayBuffer) {
                // Convert ArrayBuffer to Blob
                const blob = new Blob([audioData], { type: `audio/${format}` });
                audioUrl = URL.createObjectURL(blob);
            } else if (audioData instanceof Blob) {
                // Create object URL from Blob
                audioUrl = URL.createObjectURL(audioData);
            } else {
                throw new Error('Unsupported audio data format');
            }

            currentAudioUrlRef.current = audioUrl;
            audioRef.current.src = audioUrl;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load audio';
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: errorMessage
            }));
            throw error;
        }
    }, []);

    const loadAudioFromUrl = useCallback(async (url: string): Promise<void> => {
        if (!audioRef.current) {
            throw new Error('Audio element not initialized');
        }

        setState(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            // Clean up previous object URL
            if (currentAudioUrlRef.current && currentAudioUrlRef.current.startsWith('blob:')) {
                URL.revokeObjectURL(currentAudioUrlRef.current);
            }

            currentAudioUrlRef.current = url;
            audioRef.current.src = url;

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to load audio from URL';
            setState(prev => ({
                ...prev,
                isLoading: false,
                error: errorMessage
            }));
            throw error;
        }
    }, []);

    const play = useCallback(async (): Promise<void> => {
        if (!audioRef.current) {
            throw new Error('Audio element not initialized');
        }

        try {
            await audioRef.current.play();
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Failed to play audio';
            setState(prev => ({ ...prev, error: errorMessage }));
            throw error;
        }
    }, []);

    const pause = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
        }
    }, []);

    const stop = useCallback(() => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    }, []);

    const seek = useCallback((time: number) => {
        if (audioRef.current) {
            audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
        }
    }, []);

    const setVolume = useCallback((volume: number) => {
        if (audioRef.current) {
            audioRef.current.volume = Math.max(0, Math.min(1, volume));
        }
    }, []);

    const controls: AudioPlaybackControls = {
        play,
        pause,
        stop,
        seek,
        setVolume,
        loadAudio,
        loadAudioFromUrl
    };

    return {
        state,
        controls,
        getCachedAudio,
        setCachedAudio,
        generateCacheKey
    };
}