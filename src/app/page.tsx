'use client';

import { AuthWrapper } from '@/components/AuthWrapper';
import { SessionManager } from '@/components/SessionManager';

export default function Home() {
  return (
    <AuthWrapper>
      <div className="p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            Healthcare Translation App
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Real-time multilingual translation platform designed to bridge communication 
            gaps between patients and healthcare providers.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Session Management */}
          <div className="lg:col-span-1">
            <SessionManager />
          </div>

          {/* Feature Cards */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
              <h3 className="text-lg font-semibold text-blue-900 mb-2">
                Voice-to-Text
              </h3>
              <p className="text-blue-700 mb-3">
                Convert spoken patient input into accurate text transcripts with AI enhancement
              </p>
              <button
                onClick={() => window.location.href = '/audio-demo'}
                className="inline-flex items-center text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                Try Audio Demo →
              </button>
            </div>

            <div className="bg-green-50 p-6 rounded-lg border border-green-200">
              <h3 className="text-lg font-semibold text-green-900 mb-2">
                Real-Time Translation
              </h3>
              <p className="text-green-700">
                Translate patient speech in real-time with medical context awareness
              </p>
            </div>

            <div className="bg-purple-50 p-6 rounded-lg border border-purple-200">
              <h3 className="text-lg font-semibold text-purple-900 mb-2">
                Audio Playback
              </h3>
              <p className="text-purple-700">
                Play translated text as natural-sounding audio for patients
              </p>
            </div>

            <div className="bg-orange-50 p-6 rounded-lg border border-orange-200">
              <h3 className="text-lg font-semibold text-orange-900 mb-2">
                Session Management
              </h3>
              <p className="text-orange-700">
                Manage translation sessions with automatic persistence and cleanup
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="bg-gray-100 p-8 rounded-lg">
            <p className="text-gray-600 mb-4">
              Authentication and Session Management are now active! Next steps:
            </p>
            <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700">
              <li>✅ Next.js with TypeScript and App Router</li>
              <li>✅ AWS Amplify Gen 2 Backend Configuration</li>
              <li>✅ Development Environment Setup</li>
              <li>✅ Authentication Components Implemented</li>
              <li>✅ Session Management System Created</li>
              <li>✅ Audio Capture and Processing Infrastructure</li>
              <li>⏳ Deploy backend with <code className="bg-gray-200 px-1 rounded">npx ampx sandbox</code></li>
            </ul>
            
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">Ready to deploy:</p>
              <p className="text-xs text-blue-700">
                Run <code className="bg-blue-100 px-1 rounded">npx ampx sandbox</code> in the project directory to deploy your backend and generate the configuration.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
