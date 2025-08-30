'use client';

import { AuthWrapper } from '@/components/AuthWrapper';
import { TranslationInterface } from '@/components/TranslationInterface';
import { useState } from 'react';

export default function Home() {
  const [showDemo, setShowDemo] = useState(false);

  if (showDemo) {
    return (
      <AuthWrapper>
        <div className="h-screen">
          <TranslationInterface
            onSessionStart={() => console.log('Session started')}
            onSessionEnd={() => console.log('Session ended')}
            onError={(error) => console.error('Translation error:', error)}
          />
          
          {/* Back to overview button */}
          <button
            onClick={() => setShowDemo(false)}
            className="fixed top-4 left-4 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors z-50"
          >
            ← Back to Overview
          </button>
        </div>
      </AuthWrapper>
    );
  }

  return (
    <AuthWrapper>
      <div className="p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Healthcare Translation App
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            Real-time multilingual translation platform designed to bridge communication 
            gaps between patients and healthcare providers.
          </p>
        </div>

        {/* Main Demo Button */}
        <div className="text-center mb-8">
          <button
            onClick={() => setShowDemo(true)}
            className="inline-flex items-center px-8 py-4 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-lg"
          >
            Launch Translation Interface
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Feature Cards */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-100 mb-2">
              Voice-to-Text
            </h3>
            <p className="text-blue-700 dark:text-blue-300 mb-3">
              Convert spoken patient input into accurate text transcripts with AI enhancement
            </p>
            <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
              ✅ Real-time transcription
            </div>
          </div>

          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
              Real-Time Translation
            </h3>
            <p className="text-green-700 dark:text-green-300 mb-3">
              Translate patient speech in real-time with medical context awareness
            </p>
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✅ Multi-language support
            </div>
          </div>

          <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="text-lg font-semibold text-purple-900 dark:text-purple-100 mb-2">
              Audio Playback
            </h3>
            <p className="text-purple-700 dark:text-purple-300 mb-3">
              Play translated text as natural-sounding audio for patients
            </p>
            <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
              ✅ Text-to-speech ready
            </div>
          </div>

          <div className="bg-orange-50 dark:bg-orange-900/20 p-6 rounded-lg border border-orange-200 dark:border-orange-800">
            <h3 className="text-lg font-semibold text-orange-900 dark:text-orange-100 mb-2">
              Mobile-First Design
            </h3>
            <p className="text-orange-700 dark:text-orange-300 mb-3">
              Responsive interface optimized for mobile devices and touch interaction
            </p>
            <div className="text-sm text-orange-600 dark:text-orange-400 font-medium">
              ✅ Touch-friendly UI
            </div>
          </div>
        </div>

        <div className="text-center">
          <div className="bg-gray-100 dark:bg-gray-800 p-8 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              User Interface Components Implementation Complete! 🎉
            </p>
            <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700 dark:text-gray-300">
              <li>✅ Dual Transcript Display with Real-time Updates</li>
              <li>✅ Language Selection Interface with Healthcare Priorities</li>
              <li>✅ Responsive Mobile-First Design</li>
              <li>✅ Touch-Friendly Controls (44px minimum)</li>
              <li>✅ Orientation Change Handling</li>
              <li>✅ Accessibility Features</li>
            </ul>
            
            <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium mb-2">
                Ready for Integration:
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                The UI components are now ready to be integrated with the backend services 
                (WebSocket, Transcribe, Translate, Polly) for full functionality.
              </p>
            </div>
          </div>
        </div>
      </div>
    </AuthWrapper>
  );
}
