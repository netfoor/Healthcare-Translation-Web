'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getCurrentUser, signOut, AuthUser } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';

interface AuthContextType {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: React.ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleSignOut = async () => {
    try {
      await signOut();
      setUser(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  useEffect(() => {
    // Initial user check
    refreshUser();

    // Listen for auth events
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      switch (payload.event) {
        case 'signedIn':
          console.log('User signed in');
          refreshUser();
          break;
        case 'signedOut':
          console.log('User signed out');
          setUser(null);
          break;
        case 'tokenRefresh':
          refreshUser();
          break;
        case 'tokenRefresh_failure':
          console.log('Token refresh failed');
          setUser(null);
          break;
        case 'signInWithRedirect':
          console.log('Sign in with redirect initiated');
          break;
        case 'signInWithRedirect_failure':
          console.log('Sign in with redirect failed');
          setUser(null);
          break;
      }
    });

    return unsubscribe;
  }, [refreshUser]);

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    signOut: handleSignOut,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}