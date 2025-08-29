'use client';

import React from 'react';
import { useSessionManagement } from '@/hooks/useSessionManagement';

interface SessionStatusProps {
  className?: string;
  showDetails?: boolean;
}

export function SessionStatus({ className = '', showDetails = false }: SessionStatusProps) {
  const {
    currentSession,
    hasActiveSession,
    isSessionPaused,
    isNearExpiry,
    sessionDuration,
    timeSinceLastActivity,
  } = useSessionManagement();

  if (!currentSession) {
    return null;
  }

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const getStatusColor = () => {
    if (isNearExpiry) return 'text-red-600 bg-red-50 border-red-200';
    if (hasActiveSession) return 'text-green-600 bg-green-50 border-green-200';
    if (isSessionPaused) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    return 'text-gray-600 bg-gray-50 border-gray-200';
  };

  const getStatusIcon = () => {
    if (isNearExpiry) {
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    
    if (hasActiveSession) {
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
        </svg>
      );
    }
    
    if (isSessionPaused) {
      return (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
      );
    }
    
    return null;
  };

  const getStatusText = () => {
    if (isNearExpiry) return 'Session Expiring Soon';
    if (hasActiveSession) return 'Session Active';
    if (isSessionPaused) return 'Session Paused';
    return 'Session Ended';
  };

  return (
    <div className={`inline-flex items-center px-3 py-1.5 rounded-full border text-sm font-medium ${getStatusColor()} ${className}`}>
      {getStatusIcon()}
      <span className="ml-1.5">{getStatusText()}</span>
      
      {showDetails && (
        <span className="ml-2 text-xs opacity-75">
          {formatDuration(sessionDuration)}
          {timeSinceLastActivity > 0 && ` • ${timeSinceLastActivity}m idle`}
        </span>
      )}
      
      {isNearExpiry && (
        <span className="ml-2 text-xs font-normal">
          (Auto-expires in {formatDuration(24 * 60 - sessionDuration)})
        </span>
      )}
    </div>
  );
}