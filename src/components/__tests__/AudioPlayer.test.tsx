import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AudioPlayer } from '../AudioPlayer';
import { useAudioPlayback } from '@/hooks/useAudioPlayback';

// Mock the useAudioPlayback hook
jest.mock('@/hooks/useAudioPlayback');

const mockUseAudioPlayback = useAudioPlayback as jest.MockedFunction<typeof useAudioPlayback>;

describe('AudioPlayer', () => {
    const mockControls = {
        play: jest.fn(),
        pause: jest.fn(),
        stop: jest.fn(),
        seek: jest.fn(),
        setVolume: jest.fn(),
        loadAudio: jest.fn(),
        loadAudioFromUrl: jest.fn()
    };

    const mockState = {
        isPlaying: false,
        isPaused: false,
        isLoading: false,
        currentTime: 0,
        duration: 0,
        volume: 1.0,
        error: null
    };

    beforeEach(() => {
        jest.clearAllMocks();
        mockUseAudioPlayback.mockReturnValue({
            state: mockState,
            controls: mockControls,
            getCachedAudio: jest.fn(),
            setCachedAudio: jest.fn(),
            generateCacheKey: jest.fn()
        });
    });

    describe('rendering', () => {
        it('should render with basic props', () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            expect(screen.getByText('Hello world')).toBeInTheDocument();
            expect(screen.getByText('en-US')).toBeInTheDocument();
            expect(screen.getByLabelText('Play')).toBeInTheDocument();
        });

        it('should render with voice ID', () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    voiceId="Joanna"
                />
            );

            expect(screen.getByText('en-US • Joanna')).toBeInTheDocument();
        });

        it('should render without text', () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    language="en-US"
                />
            );

            expect(screen.getByLabelText('Play')).toBeInTheDocument();
            expect(screen.queryByText('Hello world')).not.toBeInTheDocument();
        });

        it('should show loading state', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, isLoading: true },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            expect(screen.getByLabelText('Play')).toBeDisabled();
            // Check for loading spinner
            expect(screen.getByRole('button', { name: 'Play' })).toContainHTML('animate-spin');
        });

        it('should show playing state', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, isPlaying: true },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            expect(screen.getByLabelText('Pause')).toBeInTheDocument();
            expect(screen.getByText('Playing')).toBeInTheDocument();
        });

        it('should show paused state', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, isPaused: true },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            expect(screen.getByLabelText('Play')).toBeInTheDocument();
            expect(screen.getByText('Paused')).toBeInTheDocument();
        });

        it('should show error state', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, error: 'Audio loading failed' },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            expect(screen.getByText('Audio loading failed')).toBeInTheDocument();
        });
    });

    describe('controls', () => {
        it('should call play when play button is clicked', async () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            const playButton = screen.getByLabelText('Play');
            fireEvent.click(playButton);

            await waitFor(() => {
                expect(mockControls.play).toHaveBeenCalled();
            });
        });

        it('should call pause when pause button is clicked', async () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, isPlaying: true },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            const pauseButton = screen.getByLabelText('Pause');
            fireEvent.click(pauseButton);

            expect(mockControls.pause).toHaveBeenCalled();
        });

        it('should call stop when stop button is clicked', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, isPlaying: true },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            const stopButton = screen.getByLabelText('Stop');
            fireEvent.click(stopButton);

            expect(mockControls.stop).toHaveBeenCalled();
        });

        it('should disable controls when no audio data', () => {
            render(
                <AudioPlayer
                    text="Hello world"
                    language="en-US"
                />
            );

            expect(screen.getByLabelText('Play')).toBeDisabled();
            expect(screen.getByLabelText('Stop')).toBeDisabled();
        });
    });

    describe('progress control', () => {
        it('should show progress bar by default', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, currentTime: 30, duration: 100 },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            const progressSlider = screen.getByLabelText('Audio progress');
            expect(progressSlider).toBeInTheDocument();
            expect(progressSlider).toHaveValue('30'); // 30% progress
        });

        it('should hide progress bar when showProgress is false', () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    showProgress={false}
                />
            );

            expect(screen.queryByLabelText('Audio progress')).not.toBeInTheDocument();
        });

        it('should call seek when progress slider changes', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, duration: 100 },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            const progressSlider = screen.getByLabelText('Audio progress');
            fireEvent.change(progressSlider, { target: { value: '50' } });

            expect(mockControls.seek).toHaveBeenCalledWith(50); // 50% of 100 seconds
        });

        it('should show time display by default', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, currentTime: 65, duration: 125 },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            expect(screen.getByText('1:05')).toBeInTheDocument(); // 65 seconds = 1:05
            expect(screen.getByText('2:05')).toBeInTheDocument(); // 125 seconds = 2:05
        });

        it('should hide time display when showTime is false', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, currentTime: 65, duration: 125 },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    showTime={false}
                />
            );

            expect(screen.queryByText('1:05')).not.toBeInTheDocument();
            expect(screen.queryByText('2:05')).not.toBeInTheDocument();
        });
    });

    describe('volume control', () => {
        it('should show volume control by default', () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, volume: 0.7 },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            const volumeSlider = screen.getByLabelText('Volume');
            expect(volumeSlider).toBeInTheDocument();
            expect(volumeSlider).toHaveValue('70'); // 70% volume
            expect(screen.getByText('70%')).toBeInTheDocument();
        });

        it('should hide volume control when showVolume is false', () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    showVolume={false}
                />
            );

            expect(screen.queryByLabelText('Volume')).not.toBeInTheDocument();
        });

        it('should call setVolume when volume slider changes', () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                />
            );

            const volumeSlider = screen.getByLabelText('Volume');
            fireEvent.change(volumeSlider, { target: { value: '80' } });

            expect(mockControls.setVolume).toHaveBeenCalledWith(0.8); // 80% = 0.8
        });
    });

    describe('text highlighting', () => {
        it('should highlight text during playback', () => {
            const mockOnTimeUpdate = jest.fn();

            // Mock the hook to simulate time updates
            mockUseAudioPlayback.mockImplementation((options) => {
                // Simulate time update callback
                if (options?.onTimeUpdate) {
                    setTimeout(() => options.onTimeUpdate!(30, 100), 0);
                }

                return {
                    state: { ...mockState, isPlaying: true, currentTime: 30, duration: 100 },
                    controls: mockControls,
                    getCachedAudio: jest.fn(),
                    setCachedAudio: jest.fn(),
                    generateCacheKey: jest.fn()
                };
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world, this is a test message."
                    language="en-US"
                />
            );

            // The text highlighting is based on playback progress
            // At 30% progress (30/100), about 30% of the text should be highlighted
            expect(screen.getByText('Hello world, this is a test message.')).toBeInTheDocument();
        });

        it('should reset highlighting when playback ends', () => {
            const mockOnPlaybackEnd = jest.fn();

            mockUseAudioPlayback.mockImplementation((options) => {
                // Simulate playback end
                if (options?.onPlaybackEnd) {
                    setTimeout(() => options.onPlaybackEnd!(), 0);
                }

                return {
                    state: { ...mockState, isPlaying: false },
                    controls: mockControls,
                    getCachedAudio: jest.fn(),
                    setCachedAudio: jest.fn(),
                    generateCacheKey: jest.fn()
                };
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world, this is a test message."
                    language="en-US"
                    onPlaybackEnd={mockOnPlaybackEnd}
                />
            );

            // Text should not be highlighted when not playing
            expect(screen.getByText('Hello world, this is a test message.')).toBeInTheDocument();
        });
    });

    describe('audio loading', () => {
        it('should load audio data on mount', async () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    format="mp3"
                    text="Hello world"
                    language="en-US"
                />
            );

            await waitFor(() => {
                expect(mockControls.loadAudio).toHaveBeenCalledWith('base64-audio-data', 'mp3');
            });
        });

        it('should load audio from URL', async () => {
            render(
                <AudioPlayer
                    audioUrl="https://example.com/audio.mp3"
                    text="Hello world"
                    language="en-US"
                />
            );

            await waitFor(() => {
                expect(mockControls.loadAudioFromUrl).toHaveBeenCalledWith('https://example.com/audio.mp3');
            });
        });

        it('should reload audio when props change', async () => {
            const { rerender } = render(
                <AudioPlayer
                    audioData="base64-audio-data-1"
                    text="Hello world"
                    language="en-US"
                />
            );

            await waitFor(() => {
                expect(mockControls.loadAudio).toHaveBeenCalledWith('base64-audio-data-1', 'mp3');
            });

            rerender(
                <AudioPlayer
                    audioData="base64-audio-data-2"
                    text="Hello world"
                    language="en-US"
                />
            );

            await waitFor(() => {
                expect(mockControls.loadAudio).toHaveBeenCalledWith('base64-audio-data-2', 'mp3');
            });
        });
    });

    describe('auto-play', () => {
        it('should auto-play when enabled and audio is loaded', async () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    autoPlay={true}
                />
            );

            await waitFor(() => {
                expect(mockControls.play).toHaveBeenCalled();
            });
        });

        it('should not auto-play when disabled', async () => {
            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    autoPlay={false}
                />
            );

            // Wait a bit to ensure play is not called
            await new Promise(resolve => setTimeout(resolve, 100));
            expect(mockControls.play).not.toHaveBeenCalled();
        });

        it('should not auto-play when loading', async () => {
            mockUseAudioPlayback.mockReturnValue({
                state: { ...mockState, isLoading: true },
                controls: mockControls,
                getCachedAudio: jest.fn(),
                setCachedAudio: jest.fn(),
                generateCacheKey: jest.fn()
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    autoPlay={true}
                />
            );

            await new Promise(resolve => setTimeout(resolve, 100));
            expect(mockControls.play).not.toHaveBeenCalled();
        });
    });

    describe('callbacks', () => {
        it('should call onPlaybackStart when playback starts', () => {
            const onPlaybackStart = jest.fn();

            mockUseAudioPlayback.mockImplementation((options) => {
                if (options?.onPlaybackStart) {
                    setTimeout(() => options.onPlaybackStart!(), 0);
                }

                return {
                    state: mockState,
                    controls: mockControls,
                    getCachedAudio: jest.fn(),
                    setCachedAudio: jest.fn(),
                    generateCacheKey: jest.fn()
                };
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    onPlaybackStart={onPlaybackStart}
                />
            );

            expect(onPlaybackStart).toHaveBeenCalled();
        });

        it('should call onPlaybackEnd when playback ends', () => {
            const onPlaybackEnd = jest.fn();

            mockUseAudioPlayback.mockImplementation((options) => {
                if (options?.onPlaybackEnd) {
                    setTimeout(() => options.onPlaybackEnd!(), 0);
                }

                return {
                    state: mockState,
                    controls: mockControls,
                    getCachedAudio: jest.fn(),
                    setCachedAudio: jest.fn(),
                    generateCacheKey: jest.fn()
                };
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    onPlaybackEnd={onPlaybackEnd}
                />
            );

            expect(onPlaybackEnd).toHaveBeenCalled();
        });

        it('should call onPlaybackError when error occurs', () => {
            const onPlaybackError = jest.fn();
            const testError = new Error('Test error');

            mockUseAudioPlayback.mockImplementation((options) => {
                if (options?.onPlaybackError) {
                    setTimeout(() => options.onPlaybackError!(testError), 0);
                }

                return {
                    state: mockState,
                    controls: mockControls,
                    getCachedAudio: jest.fn(),
                    setCachedAudio: jest.fn(),
                    generateCacheKey: jest.fn()
                };
            });

            render(
                <AudioPlayer
                    audioData="base64-audio-data"
                    text="Hello world"
                    language="en-US"
                    onPlaybackError={onPlaybackError}
                />
            );

            expect(onPlaybackError).toHaveBeenCalledWith(testError);
        });
    });
});