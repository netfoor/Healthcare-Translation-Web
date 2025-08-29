'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    // The Amplify Auth will automatically handle the callback
    // We just need to redirect to the home page
    const timer = setTimeout(() => {
      router.push('/');
    }, 2000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <LoadingSpinner size="lg" />
        <h2 className="mt-4 text-xl font-semibold text-gray-900">
          Completing Sign In...
        </h2>
        <p className="mt-2 text-sm text-gray-600">
          Please wait while we complete your authentication.
        </p>
      </div>
    </div>
  );
}