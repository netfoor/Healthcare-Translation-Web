'use client';

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { SessionStatus } from './SessionStatus';

export function UserProfile() {
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleSignOut = async () => {
    try {
      setIsLoggingOut(true);
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return null;
  }

  // Extract user display information
  const displayName = user.username || user.userId || 'Healthcare User';
  const userInitials = displayName
    .split(' ')
    .map(name => name.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center space-x-4">
      {/* Session Status */}
      <SessionStatus className="hidden md:inline-flex" />

      {/* User Avatar */}
      <div className="flex items-center space-x-3">
        <div className="h-8 w-8 rounded-full bg-blue-600 flex items-center justify-center">
          <span className="text-sm font-medium text-white">
            {userInitials}
          </span>
        </div>
        <div className="hidden sm:block">
          <p className="text-sm font-medium text-gray-900">
            {displayName}
          </p>
          <p className="text-xs text-gray-500">
            Healthcare Provider
          </p>
        </div>
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleSignOut}
        disabled={isLoggingOut}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
      >
        {isLoggingOut ? (
          <>
            <svg
              className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Signing out...
          </>
        ) : (
          <>
            <svg
              className="-ml-1 mr-2 h-4 w-4 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Sign Out
          </>
        )}
      </button>
    </div>
  );
}