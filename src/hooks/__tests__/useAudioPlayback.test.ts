import { renderHook, act } from '@testing-library/react';
import { useAudioPlayback } from '../useAudioPlayback';

// Mock HTMLAudioElement
const mockAudio = {
    play: jest.fn(),
    pause: jest.fn(),
    load: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    currentTime: 0,
    duration: 0,
    volume: 1,
    src: '',
    preload: 'metadata',
    error: null
};

// Mock URL.createObjectURL and revokeObjectURL
global.URL.createObjectURL = jest.fn(() => 'blob:mock-url');
global.URL.revokeObjectURL = jest.fn();

// Mock Audio constructor
(global as any).Audio = jest.fn(() => mockAudio);

describe('useAudioPlayback', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockAudio.currentTime = 0;
        mockAudio.duration = 0;
        mockAudio.volume = 1;
        mockAudio.src = '';
        mockAudio.error = null;
    });

    describe('initialization', () => {
        it('should initialize with default state', () => {
            const { result } = renderHook(() => useAudioPlayback());

            expect(result.current.state).toEqual({
                isPlaying: false,
                isPaused: false,
                isLoading: false,
                currentTime: 0,
                duration: 0,
                volume: 1.0,
                error: null
            });
        });

        it('should create audio element and add event listeners', () => {
            renderHook(() => useAudioPlayback());

            expect(global.Audio).toHaveBeenCalled();
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('loadstart', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('canplay', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('play', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockAudio.addEventListener).toHaveBeenCalledWith('volumechange', expect.any(Function));
        });
    });

    describe('audio loading', () => {
        it('should load audio from base64 string', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            const base64Data = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64

            await act(async () => {
                await result.current.controls.loadAudio(base64Data, 'mp3');
            });

            expect(mockAudio.src).toBe('data:audio/mp3;base64,SGVsbG8gV29ybGQ=');
        });

        it('should load audio from data URL', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            const dataUrl = 'data:audio/mp3;base64,SGVsbG8gV29ybGQ=';

            await act(async () => {
                await result.current.controls.loadAudio(dataUrl, 'mp3');
            });

            expect(mockAudio.src).toBe(dataUrl);
        });

        it('should load audio from ArrayBuffer', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            const arrayBuffer = new ArrayBuffer(8);

            await act(async () => {
                await result.current.controls.loadAudio(arrayBuffer, 'mp3');
            });

            expect(global.URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
            expect(mockAudio.src).toBe('blob:mock-url');
        });

        it('should load audio from Blob', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            const blob = new Blob(['test'], { type: 'audio/mp3' });

            await act(async () => {
                await result.current.controls.loadAudio(blob, 'mp3');
            });

            expect(global.URL.createObjectURL).toHaveBeenCalledWith(blob);
            expect(mockAudio.src).toBe('blob:mock-url');
        });

        it('should load audio from URL', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            const url = 'https://example.com/audio.mp3';

            await act(async () => {
                await result.current.controls.loadAudioFromUrl(url);
            });

            expect(mockAudio.src).toBe(url);
        });

        it('should handle loading errors', async () => {
            const { result } = renderHook(() => useAudioPlayback());

            await expect(
                act(async () => {
                    await result.current.controls.loadAudio(123 as any, 'mp3');
                })
            ).rejects.toThrow('Unsupported audio data format');
        });

        it('should clean up previous object URLs when loading new audio', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            const blob1 = new Blob(['test1'], { type: 'audio/mp3' });
            const blob2 = new Blob(['test2'], { type: 'audio/mp3' });

            // Load first audio
            await act(async () => {
                await result.current.controls.loadAudio(blob1, 'mp3');
            });

            // Load second audio
            await act(async () => {
                await result.current.controls.loadAudio(blob2, 'mp3');
            });

            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });
    });

    describe('playback controls', () => {
        it('should play audio', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            mockAudio.play.mockResolvedValue(undefined);

            await act(async () => {
                await result.current.controls.play();
            });

            expect(mockAudio.play).toHaveBeenCalled();
        });

        it('should handle play errors', async () => {
            const { result } = renderHook(() => useAudioPlayback());
            const playError = new Error('Play failed');
            mockAudio.play.mockRejectedValue(playError);

            await expect(
                act(async () => {
                    await result.current.controls.play();
                })
            ).rejects.toThrow('Play failed');
        });

        it('should pause audio', () => {
            const { result } = renderHook(() => useAudioPlayback());

            act(() => {
                result.current.controls.pause();
            });

            expect(mockAudio.pause).toHaveBeenCalled();
        });

        it('should stop audio', () => {
            const { result } = renderHook(() => useAudioPlayback());
            mockAudio.currentTime = 30;

            act(() => {
                result.current.controls.stop();
            });

            expect(mockAudio.pause).toHaveBeenCalled();
            expect(mockAudio.currentTime).toBe(0);
        });

        it('should seek to specific time', () => {
            const { result } = renderHook(() => useAudioPlayback());
            mockAudio.duration = 100;

            act(() => {
                result.current.controls.seek(50);
            });

            expect(mockAudio.currentTime).toBe(50);
        });

        it('should clamp seek time to valid range', () => {
            const { result } = renderHook(() => useAudioPlayback());
            mockAudio.duration = 100;

            act(() => {
                result.current.controls.seek(-10);
            });
            expect(mockAudio.currentTime).toBe(0);

            act(() => {
                result.current.controls.seek(150);
            });
            expect(mockAudio.currentTime).toBe(100);
        });

        it('should set volume', () => {
            const { result } = renderHook(() => useAudioPlayback());

            act(() => {
                result.current.controls.setVolume(0.5);
            });

            expect(mockAudio.volume).toBe(0.5);
        });

        it('should clamp volume to valid range', () => {
            const { result } = renderHook(() => useAudioPlayback());

            act(() => {
                result.current.controls.setVolume(-0.5);
            });
            expect(mockAudio.volume).toBe(0);

            act(() => {
                result.current.controls.setVolume(1.5);
            });
            expect(mockAudio.volume).toBe(1);
        });
    });

    describe('event handling', () => {
        it('should update state on play event', () => {
            const onPlaybackStart = jest.fn();
            const { result } = renderHook(() => useAudioPlayback({ onPlaybackStart }));

            // Simulate play event
            const playHandler = mockAudio.addEventListener.mock.calls.find(
                call => call[0] === 'play'
            )?.[1];

            act(() => {
                playHandler?.();
            });

            expect(result.current.state.isPlaying).toBe(true);
            expect(result.current.state.isPaused).toBe(false);
            expect(onPlaybackStart).toHaveBeenCalled();
        });

        it('should update state on pause event', () => {
            const { result } = renderHook(() => useAudioPlayback());

            // Simulate pause event
            const pauseHandler = mockAudio.addEventListener.mock.calls.find(
                call => call[0] === 'pause'
            )?.[1];

            act(() => {
                pauseHandler?.();
            });

            expect(result.current.state.isPlaying).toBe(false);
            expect(result.current.state.isPaused).toBe(true);
        });

        it('should update state on ended event', () => {
            const onPlaybackEnd = jest.fn();
            const { result } = renderHook(() => useAudioPlayback({ onPlaybackEnd }));

            // Simulate ended event
            const endedHandler = mockAudio.addEventListener.mock.calls.find(
                call => call[0] === 'ended'
            )?.[1];

            act(() => {
                endedHandler?.();
            });

            expect(result.current.state.isPlaying).toBe(false);
            expect(result.current.state.isPaused).toBe(false);
            expect(result.current.state.currentTime).toBe(0);
            expect(onPlaybackEnd).toHaveBeenCalled();
        });

        it('should update state on timeupdate event', () => {
            const onTimeUpdate = jest.fn();
            const { result } = renderHook(() => useAudioPlayback({ onTimeUpdate }));

            mockAudio.currentTime = 30;
            mockAudio.duration = 100;

            // Simulate timeupdate event
            const timeupdateHandler = mockAudio.addEventListener.mock.calls.find(
                call => call[0] === 'timeupdate'
            )?.[1];

            act(() => {
                timeupdateHandler?.();
            });

            expect(result.current.state.currentTime).toBe(30);
            expect(onTimeUpdate).toHaveBeenCalledWith(30, 100);
        });

        it('should update state on loadedmetadata event', () => {
            const { result } = renderHook(() => useAudioPlayback());

            mockAudio.duration = 120;

            // Simulate loadedmetadata event
            const loadedmetadataHandler = mockAudio.addEventListener.mock.calls.find(
                call => call[0] === 'loadedmetadata'
            )?.[1];

            act(() => {
                loadedmetadataHandler?.();
            });

            expect(result.current.state.duration).toBe(120);
            expect(result.current.state.isLoading).toBe(false);
        });

        it('should handle error events', () => {
            const onPlaybackError = jest.fn();
            const { result } = renderHook(() => useAudioPlayback({ onPlaybackError }));

            mockAudio.error = { message: 'Network error' } as any;

            // Simulate error event
            const errorHandler = mockAudio.addEventListener.mock.calls.find(
                call => call[0] === 'error'
            )?.[1];

            act(() => {
                errorHandler?.(new Event('error'));
            });

            expect(result.current.state.error).toBe('Audio playback error: Network error');
            expect(result.current.state.isPlaying).toBe(false);
            expect(result.current.state.isLoading).toBe(false);
            expect(onPlaybackError).toHaveBeenCalledWith(expect.any(Error));
        });
    });

    describe('caching', () => {
        it('should generate consistent cache keys', () => {
            const { result } = renderHook(() => useAudioPlayback());

            const key1 = result.current.generateCacheKey('Hello world', 'en-US', 'Joanna');
            const key2 = result.current.generateCacheKey('Hello world', 'en-US', 'Joanna');

            expect(key1).toBe(key2);
            expect(typeof key1).toBe('string');
            expect(key1.length).toBeGreaterThan(0);
        });

        it('should generate different cache keys for different inputs', () => {
            const { result } = renderHook(() => useAudioPlayback());

            const key1 = result.current.generateCacheKey('Hello world', 'en-US', 'Joanna');
            const key2 = result.current.generateCacheKey('Goodbye world', 'en-US', 'Joanna');
            const key3 = result.current.generateCacheKey('Hello world', 'es-US', 'Joanna');
            const key4 = result.current.generateCacheKey('Hello world', 'en-US', 'Matthew');

            expect(key1).not.toBe(key2);
            expect(key1).not.toBe(key3);
            expect(key1).not.toBe(key4);
        });

        it('should cache and retrieve audio data', () => {
            const { result } = renderHook(() => useAudioPlayback({ enableCaching: true }));

            const cacheKey = 'test-key';
            const audioData = 'base64-audio-data';

            act(() => {
                result.current.setCachedAudio(cacheKey, audioData, 'mp3', 'Joanna', 'en-US');
            });

            const cached = result.current.getCachedAudio(cacheKey);

            expect(cached).toEqual({
                audioData,
                format: 'mp3',
                timestamp: expect.any(Number),
                voiceId: 'Joanna',
                language: 'en-US'
            });
        });

        it('should return null for non-existent cache entries', () => {
            const { result } = renderHook(() => useAudioPlayback({ enableCaching: true }));

            const cached = result.current.getCachedAudio('non-existent-key');

            expect(cached).toBeNull();
        });

        it('should return null for expired cache entries', () => {
            const { result } = renderHook(() => useAudioPlayback({
                enableCaching: true,
                cacheExpiryMs: 1000 // 1 second
            }));

            const cacheKey = 'test-key';
            const audioData = 'base64-audio-data';

            act(() => {
                result.current.setCachedAudio(cacheKey, audioData, 'mp3', 'Joanna', 'en-US');
            });

            // Mock expired timestamp
            jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000); // 2 seconds later

            const cached = result.current.getCachedAudio(cacheKey);

            expect(cached).toBeNull();

            jest.restoreAllMocks();
        });

        it('should not cache when caching is disabled', () => {
            const { result } = renderHook(() => useAudioPlayback({ enableCaching: false }));

            const cacheKey = 'test-key';
            const audioData = 'base64-audio-data';

            act(() => {
                result.current.setCachedAudio(cacheKey, audioData, 'mp3', 'Joanna', 'en-US');
            });

            const cached = result.current.getCachedAudio(cacheKey);

            expect(cached).toBeNull();
        });

        it('should respect cache size limit', () => {
            const { result } = renderHook(() => useAudioPlayback({
                enableCaching: true,
                cacheMaxSize: 2
            }));

            // Add 3 items to cache (exceeding limit of 2)
            act(() => {
                result.current.setCachedAudio('key1', 'data1', 'mp3', 'Joanna', 'en-US');
                result.current.setCachedAudio('key2', 'data2', 'mp3', 'Joanna', 'en-US');
                result.current.setCachedAudio('key3', 'data3', 'mp3', 'Joanna', 'en-US');
            });

            // First item should be evicted
            expect(result.current.getCachedAudio('key1')).toBeNull();
            expect(result.current.getCachedAudio('key2')).not.toBeNull();
            expect(result.current.getCachedAudio('key3')).not.toBeNull();
        });
    });

    describe('cleanup', () => {
        it('should remove event listeners on unmount', () => {
            const { unmount } = renderHook(() => useAudioPlayback());

            unmount();

            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('loadstart', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('loadedmetadata', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('canplay', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('play', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('pause', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('ended', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('timeupdate', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('error', expect.any(Function));
            expect(mockAudio.removeEventListener).toHaveBeenCalledWith('volumechange', expect.any(Function));
        });

        it('should clean up object URLs on unmount', () => {
            const { result, unmount } = renderHook(() => useAudioPlayback());

            act(async () => {
                const blob = new Blob(['test'], { type: 'audio/mp3' });
                await result.current.controls.loadAudio(blob, 'mp3');
            });

            unmount();

            expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
        });
    });
});