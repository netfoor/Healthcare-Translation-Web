'use client';

import { useEffect, useState } from 'react';
import { configureAmplify } from '@/lib/amplify-config';

interface AmplifyProviderProps {
  children: React.ReactNode;
}

export function AmplifyProvider({ children }: AmplifyProviderProps) {
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    // Configure Amplify on client side
    try {
      configureAmplify();
      setIsConfigured(true);
    } catch (error) {
      console.error('Failed to configure Amplify:', error);
      setIsConfigured(true); // Still render children even if config fails
    }
  }, []);

  // Don't render children until Amplify is configured
  if (!isConfigured) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Initializing application...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}