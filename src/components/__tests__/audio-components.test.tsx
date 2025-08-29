/**
 * Tests for audio components
 * Basic functionality tests for audio capture and processing components
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AudioLevelIndicator, AudioLevelText } from '../AudioLevelIndicator';
import { MicrophonePermission } from '../MicrophonePermission';

// Mock Web Audio API
const mockAudioContext = {
    createMediaStreamSource: jest.fn(),
    createAnalyser: jest.fn(),
    createScriptProcessor: jest.fn(),
    close: jest.fn(),
    state: 'running'
};

const mockMediaStream = {
    getTracks: jest.fn(() => []),
    getAudioTracks: jest.fn(() => [{ stop: jest.fn() }])
};

// Mock navigator.mediaDevices
Object.defineProperty(global.navigator, 'mediaDevices', {
    value: {
        getUserMedia: jest.fn(() => Promise.resolve(mockMediaStream)),
        enumerateDevices: jest.fn(() => Promise.resolve([]))
    },
    writable: true
});

// Mock AudioContext
(global as unknown as { AudioContext: jest.Mock }).AudioContext = jest.fn(() => mockAudioContext);
(global as unknown as { webkitAudioContext: jest.Mock }).webkitAudioContext = jest.fn(() => mockAudioContext);

describe('AudioLevelIndicator', () => {
    it('renders with default props', () => {
        const { container } = render(<AudioLevelIndicator level={50} isRecording={true} />);
        expect(container.firstChild).toBeInTheDocument();
    });

    it('shows different variants', () => {
        const { container, rerender } = render(
            <AudioLevelIndicator level={50} isRecording={true} variant="bars" />
        );
        expect(container.firstChild).toBeInTheDocument();

        rerender(<AudioLevelIndicator level={50} isRecording={true} variant="circle" />);
        expect(container.firstChild).toBeInTheDocument();

        rerender(<AudioLevelIndicator level={50} isRecording={true} variant="waveform" />);
        expect(container.firstChild).toBeInTheDocument();
    });
});

describe('AudioLevelText', () => {
    it('shows recording status', () => {
        render(<AudioLevelText level={50} isRecording={true} />);
        expect(screen.getByText('Good')).toBeInTheDocument();
    });

    it('shows not recording status', () => {
        render(<AudioLevelText level={0} isRecording={false} />);
        expect(screen.getByText('Not recording')).toBeInTheDocument();
    });

    it('shows different level descriptions', () => {
        const { rerender } = render(<AudioLevelText level={5} isRecording={true} />);
        expect(screen.getByText('Very quiet')).toBeInTheDocument();

        rerender(<AudioLevelText level={25} isRecording={true} />);
        expect(screen.getByText('Quiet')).toBeInTheDocument();

        rerender(<AudioLevelText level={50} isRecording={true} />);
        expect(screen.getByText('Good')).toBeInTheDocument();

        rerender(<AudioLevelText level={70} isRecording={true} />);
        expect(screen.getByText('Loud')).toBeInTheDocument();

        rerender(<AudioLevelText level={90} isRecording={true} />);
        expect(screen.getByText('Very loud')).toBeInTheDocument();
    });
});

describe('MicrophonePermission', () => {
    const defaultProps = {
        permissionState: 'prompt' as PermissionState,
        error: null,
        availableDevices: [],
        onRequestPermission: jest.fn(),
        onRefreshDevices: jest.fn(),
        onClearError: jest.fn()
    };

    it('renders permission prompt', () => {
        render(<MicrophonePermission {...defaultProps} />);
        expect(screen.getByText('Microphone access required')).toBeInTheDocument();
        expect(screen.getByText('Grant Microphone Access')).toBeInTheDocument();
    });

    it('renders granted state', () => {
        render(
            <MicrophonePermission
                {...defaultProps}
                permissionState="granted"
            />
        );
        expect(screen.getByText('Microphone access granted')).toBeInTheDocument();
    });

    it('renders denied state', () => {
        render(
            <MicrophonePermission
                {...defaultProps}
                permissionState="denied"
            />
        );
        expect(screen.getByText('Microphone access denied')).toBeInTheDocument();
    });

    it('shows available devices when granted', () => {
        const devices: MediaDeviceInfo[] = [
            {
                deviceId: '1',
                label: 'Built-in Microphone',
                kind: 'audioinput' as MediaDeviceKind,
                groupId: '1',
                toJSON: () => ({ deviceId: '1', label: 'Built-in Microphone', kind: 'audioinput', groupId: '1' })
            } as MediaDeviceInfo,
            {
                deviceId: '2',
                label: 'USB Microphone',
                kind: 'audioinput' as MediaDeviceKind,
                groupId: '2',
                toJSON: () => ({ deviceId: '2', label: 'USB Microphone', kind: 'audioinput', groupId: '2' })
            } as MediaDeviceInfo
        ];

        render(
            <MicrophonePermission
                {...defaultProps}
                permissionState="granted"
                availableDevices={devices}
            />
        );

        expect(screen.getByText('Available Microphones (2)')).toBeInTheDocument();
        expect(screen.getByText('Built-in Microphone')).toBeInTheDocument();
        expect(screen.getByText('USB Microphone')).toBeInTheDocument();
    });
});