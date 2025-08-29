/**
 * AudioLevelIndicator - Visual feedback component for audio input levels
 * Provides real-time visualization of microphone input levels
 */

'use client';

import React from 'react';

export interface AudioLevelIndicatorProps {
  level: number; // Audio level 0-100
  isRecording: boolean;
  size?: 'small' | 'medium' | 'large';
  variant?: 'bars' | 'circle' | 'waveform';
  className?: string;
}

export function AudioLevelIndicator({
  level,
  isRecording,
  size = 'medium',
  variant = 'bars',
  className = ''
}: AudioLevelIndicatorProps) {
  const sizeClasses = {
    small: 'w-16 h-8',
    medium: 'w-24 h-12',
    large: 'w-32 h-16'
  };

  const baseClasses = `${sizeClasses[size]} ${className}`;

  if (variant === 'bars') {
    return <AudioBarsIndicator level={level} isRecording={isRecording} className={baseClasses} />;
  }

  if (variant === 'circle') {
    return <AudioCircleIndicator level={level} isRecording={isRecording} className={baseClasses} />;
  }

  if (variant === 'waveform') {
    return <AudioWaveformIndicator level={level} isRecording={isRecording} className={baseClasses} />;
  }

  return <AudioBarsIndicator level={level} isRecording={isRecording} className={baseClasses} />;
}

/**
 * Bar-style audio level indicator
 */
function AudioBarsIndicator({ level, isRecording, className }: {
  level: number;
  isRecording: boolean;
  className: string;
}) {
  const bars = 8;
  const activeBars = Math.ceil((level / 100) * bars);

  return (
    <div className={`flex items-end justify-center gap-1 ${className}`}>
      {Array.from({ length: bars }, (_, index) => {
        const isActive = index < activeBars && isRecording;
        const height = `${((index + 1) / bars) * 100}%`;
        
        return (
          <div
            key={index}
            className={`flex-1 rounded-sm transition-all duration-75 ${
              isActive
                ? index < bars * 0.6
                  ? 'bg-green-500'
                  : index < bars * 0.8
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
                : 'bg-gray-300 dark:bg-gray-600'
            }`}
            style={{ height: isActive ? height : '20%' }}
          />
        );
      })}
    </div>
  );
}

/**
 * Circle-style audio level indicator
 */
function AudioCircleIndicator({ level, isRecording, className }: {
  level: number;
  isRecording: boolean;
  className: string;
}) {
  const radius = 20;
  const strokeWidth = 4;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDasharray = `${circumference} ${circumference}`;
  const strokeDashoffset = circumference - (level / 100) * circumference;

  const getColor = () => {
    if (!isRecording) return '#d1d5db'; // gray-300
    if (level < 60) return '#10b981'; // green-500
    if (level < 80) return '#f59e0b'; // yellow-500
    return '#ef4444'; // red-500
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="relative">
        <svg
          height={radius * 2}
          width={radius * 2}
          className="transform -rotate-90"
        >
          {/* Background circle */}
          <circle
            stroke="#e5e7eb"
            fill="transparent"
            strokeWidth={strokeWidth}
            r={normalizedRadius}
            cx={radius}
            cy={radius}
          />
          {/* Progress circle */}
          <circle
            stroke={getColor()}
            fill="transparent"
            strokeWidth={strokeWidth}
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            r={normalizedRadius}
            cx={radius}
            cy={radius}
            className="transition-all duration-75"
          />
        </svg>
        {/* Center indicator */}
        <div className={`absolute inset-0 flex items-center justify-center`}>
          <div
            className={`w-2 h-2 rounded-full transition-all duration-200 ${
              isRecording && level > 10
                ? 'bg-current animate-pulse'
                : 'bg-gray-400'
            }`}
            style={{ color: getColor() }}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Waveform-style audio level indicator
 */
function AudioWaveformIndicator({ level, isRecording, className }: {
  level: number;
  isRecording: boolean;
  className: string;
}) {
  const waves = 12;
  
  return (
    <div className={`flex items-center justify-center gap-0.5 ${className}`}>
      {Array.from({ length: waves }, (_, index) => {
        // Create a wave pattern with varying heights
        const baseHeight = 20 + Math.sin((index / waves) * Math.PI * 2) * 10;
        const levelMultiplier = isRecording ? (level / 100) : 0.2;
        const height = Math.max(4, baseHeight * levelMultiplier);
        
        const getColor = () => {
          if (!isRecording) return 'bg-gray-300 dark:bg-gray-600';
          if (level < 60) return 'bg-green-500';
          if (level < 80) return 'bg-yellow-500';
          return 'bg-red-500';
        };

        return (
          <div
            key={index}
            className={`w-1 rounded-full transition-all duration-100 ${getColor()}`}
            style={{ 
              height: `${height}%`,
              animationDelay: `${index * 50}ms`
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Simple audio level text display
 */
export function AudioLevelText({ level, isRecording }: {
  level: number;
  isRecording: boolean;
}) {
  const getStatusText = () => {
    if (!isRecording) return 'Not recording';
    if (level < 10) return 'Very quiet';
    if (level < 30) return 'Quiet';
    if (level < 60) return 'Good';
    if (level < 80) return 'Loud';
    return 'Very loud';
  };

  const getStatusColor = () => {
    if (!isRecording) return 'text-gray-500';
    if (level < 60) return 'text-green-600';
    if (level < 80) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="text-sm">
      <span className={`font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>
      {isRecording && (
        <span className="ml-2 text-gray-500">
          ({level}%)
        </span>
      )}
    </div>
  );
}