import React from 'react';

interface AppLayoutProps {
  children: React.ReactNode;
  user?: any; // Will be properly typed when Amplify Auth is set up
}

export default function AppLayout({ children, user }: AppLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                Healthcare Translation
              </h1>
            </div>
            
            {/* User info section - will be populated when auth is implemented */}
            <div className="flex items-center space-x-4">
              {user ? (
                <div className="text-sm text-gray-700">
                  Welcome, {user.name || 'User'}
                </div>
              ) : (
                <div className="text-sm text-gray-500">
                  Not authenticated
                </div>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-[calc(100vh-8rem)]">
          {children}
        </div>
      </main>
    </div>
  );
}