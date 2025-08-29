'use client';

import React, { useState } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { LoadingSpinner } from './LoadingSpinner';

interface SessionManagerProps {
  onSessionCreated?: (sessionId: string) => void;
  className?: string;
}

export function SessionManager({ onSessionCreated, className = '' }: SessionManagerProps) {
  const {
    currentSession,
    isLoading,
    recentSessions,
    createSession,
    pauseSession,
    resumeSession,
    endSession,
  } = useSession();

  const [isCreating, setIsCreating] = useState(false);
  const [inputLanguage, setInputLanguage] = useState('en');
  const [outputLanguage, setOutputLanguage] = useState('es');

  // Common healthcare languages
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Spanish' },
    { code: 'fr', name: 'French' },
    { code: 'de', name: 'German' },
    { code: 'it', name: 'Italian' },
    { code: 'pt', name: 'Portuguese' },
    { code: 'zh', name: 'Chinese' },
    { code: 'ja', name: 'Japanese' },
    { code: 'ko', name: 'Korean' },
    { code: 'ar', name: 'Arabic' },
  ];

  const handleCreateSession = async () => {
    try {
      setIsCreating(true);
      const session = await createSession(inputLanguage, outputLanguage);
      onSessionCreated?.(session.id);
    } catch (error) {
      console.error('Failed to create session:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handlePauseSession = async () => {
    try {
      await pauseSession();
    } catch (error) {
      console.error('Failed to pause session:', error);
    }
  };

  const handleResumeSession = async (sessionId: string) => {
    try {
      const session = await resumeSession(sessionId);
      onSessionCreated?.(session.id);
    } catch (error) {
      console.error('Failed to resume session:', error);
    }
  };

  const handleEndSession = async () => {
    try {
      await endSession();
    } catch (error) {
      console.error('Failed to end session:', error);
    }
  };

  const formatSessionTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${className}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        Translation Session
      </h3>

      {/* Current Session Status */}
      {currentSession ? (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h4 className="font-medium text-blue-900">Active Session</h4>
              <p className="text-sm text-blue-700">
                {languages.find(l => l.code === currentSession.inputLanguage)?.name} → {' '}
                {languages.find(l => l.code === currentSession.outputLanguage)?.name}
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                currentSession.status === 'active' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {currentSession.status}
              </span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {currentSession.status === 'active' ? (
              <button
                onClick={handlePauseSession}
                className="px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
              >
                Pause
              </button>
            ) : (
              <button
                onClick={() => handleResumeSession(currentSession.id)}
                className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
              >
                Resume
              </button>
            )}
            <button
              onClick={handleEndSession}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              End Session
            </button>
          </div>
        </div>
      ) : (
        /* New Session Form */
        <div className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Input Language
              </label>
              <select
                value={inputLanguage}
                onChange={(e) => setInputLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Output Language
              </label>
              <select
                value={outputLanguage}
                onChange={(e) => setOutputLanguage(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {languages.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={handleCreateSession}
            disabled={isCreating || inputLanguage === outputLanguage}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isCreating ? (
              <div className="flex items-center justify-center">
                <LoadingSpinner size="sm" className="mr-2" />
                Creating Session...
              </div>
            ) : (
              'Start New Session'
            )}
          </button>

          {inputLanguage === outputLanguage && (
            <p className="mt-2 text-sm text-red-600">
              Input and output languages must be different
            </p>
          )}
        </div>
      )}

      {/* Recent Sessions */}
      {recentSessions.length > 0 && (
        <div>
          <h4 className="font-medium text-gray-900 mb-3">Recent Sessions</h4>
          {isLoading ? (
            <div className="flex justify-center py-4">
              <LoadingSpinner size="sm" />
            </div>
          ) : (
            <div className="space-y-2">
              {recentSessions.slice(0, 5).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {languages.find(l => l.code === session.inputLanguage)?.name} → {' '}
                      {languages.find(l => l.code === session.outputLanguage)?.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatSessionTime(session.lastActivity)} • {session.status}
                    </p>
                  </div>
                  
                  {session.status === 'paused' && !currentSession && (
                    <button
                      onClick={() => handleResumeSession(session.id)}
                      className="px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Resume
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}