'use client';

import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LoginForm } from './LoginForm';
import { LoadingSpinner } from './LoadingSpinner';

interface AuthWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function AuthWrapper({ children, fallback }: AuthWrapperProps) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || <LoginForm />;
  }

  return <>{children}</>;
}