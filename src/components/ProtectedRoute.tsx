'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { LoadingSpinner } from './LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requireAuth?: boolean;
}

export function ProtectedRoute({ 
  children, 
  fallback, 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth();

  // If authentication is not required, render children directly
  if (!requireAuth) {
    return <>{children}</>;
  }

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <LoadingSpinner size="lg" />
          <p className="mt-4 text-sm text-gray-600">
            Checking authentication...
          </p>
        </div>
      </div>
    );
  }

  // If not authenticated, show login form or custom fallback
  if (!isAuthenticated) {
    return fallback || <LoginForm />;
  }

  // User is authenticated, render protected content
  return <>{children}</>;
}