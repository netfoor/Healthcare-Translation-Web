'use client';

import { AuthWrapper } from '@/components/AuthWrapper';
import { TranslationInterface } from '@/components/TranslationInterface';
import { useState } from 'react';
import Image from 'next/image';

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
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 to-cyan-500 text-white">
        <div className="max-w-7xl mx-auto px-4 py-16 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between">
            <div className="mb-10 md:mb-0 md:pr-10 md:w-1/2">
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
                Healthcare Translation App
              </h1>
              <p className="text-xl md:text-2xl font-light mb-8 text-blue-100">
                Breaking language barriers in healthcare with real-time, medically accurate translations
              </p>
              <button
                onClick={() => setShowDemo(true)}
                className="px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg inline-flex items-center"
              >
                <span>Launch Translation Interface</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="md:w-1/2 flex justify-center">
              <div className="relative w-full max-w-md h-80 rounded-xl overflow-hidden shadow-2xl">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-cyan-300/20 backdrop-blur-sm z-10 rounded-xl"></div>
                <div className="absolute inset-0 flex justify-center items-center z-20">
                  <div className="text-center">
                    <div className="inline-flex items-center justify-center bg-white rounded-full p-3 shadow-lg mb-4">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M7 2a1 1 0 011 1v1h3a1 1 0 110 2H9.5v1H12a1 1 0 110 2H9.5v1H13a1 1 0 110 2h-3v1a1 1 0 01-2 0v-1H5a1 1 0 110-2h3.5v-1H5a1 1 0 110-2h3.5V7H6a1 1 0 010-2h3V3a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <h3 className="text-white text-xl font-bold mb-2">Medically Accurate</h3>
                    <p className="text-blue-100">Our translations are optimized for healthcare terminology</p>
                  </div>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t from-blue-900/50 to-transparent z-10"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-white dark:bg-gray-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Bridging Communication Gaps in Healthcare
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Our platform combines advanced AI with medical expertise to facilitate accurate 
              communication between healthcare providers and patients of diverse linguistic backgrounds.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Feature Cards */}
            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-blue-600 dark:text-blue-300 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-blue-900 dark:text-blue-100 mb-3">
                Medical Voice Recognition
              </h3>
              <p className="text-blue-700 dark:text-blue-300 mb-4">
                Industry-leading speech recognition optimized for medical terminology and accents
              </p>
              <div className="text-sm text-blue-600 dark:text-blue-400 font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                99.5% accuracy rate
              </div>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-xl border border-green-200 dark:border-green-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-green-600 dark:text-green-300 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-green-900 dark:text-green-100 mb-3">
                Neural Machine Translation
              </h3>
              <p className="text-green-700 dark:text-green-300 mb-4">
                Context-aware translations that understand medical nuances and cultural contexts
              </p>
              <div className="text-sm text-green-600 dark:text-green-400 font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                40+ languages supported
              </div>
            </div>

            <div className="bg-purple-50 dark:bg-purple-900/20 p-6 rounded-xl border border-purple-200 dark:border-purple-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-purple-600 dark:text-purple-300 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15.465a5 5 0 001.06-7.19m-2.11-9.85a9 9 0 000 12.728" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-purple-900 dark:text-purple-100 mb-3">
                Natural Speech Synthesis
              </h3>
              <p className="text-purple-700 dark:text-purple-300 mb-4">
                Human-like voice output for translated content with appropriate intonation and pacing
              </p>
              <div className="text-sm text-purple-600 dark:text-purple-400 font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Multiple voice options
              </div>
            </div>

            <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-xl border border-red-200 dark:border-red-800 shadow-sm hover:shadow-md transition-shadow">
              <div className="text-red-600 dark:text-red-300 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-red-900 dark:text-red-100 mb-3">
                HIPAA Compliant
              </h3>
              <p className="text-red-700 dark:text-red-300 mb-4">
                End-to-end encryption and secure processing ensure patient data remains protected
              </p>
              <div className="text-sm text-red-600 dark:text-red-400 font-medium flex items-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Privacy by design
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="bg-gray-50 dark:bg-gray-800 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
              Healthcare Translation in Action
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
              Our solution empowers healthcare providers to deliver better care to patients regardless of language barriers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white dark:bg-gray-700 rounded-xl shadow-md overflow-hidden">
              <div className="h-48 bg-blue-600 flex justify-center items-center p-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Emergency Room</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Enable rapid communication in critical situations where time is of the essence and accurate symptom description is vital.
                </p>
                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                  Supports 24/7 operations
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-700 rounded-xl shadow-md overflow-hidden">
              <div className="h-48 bg-green-600 flex justify-center items-center p-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Clinical Consultations</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Improve diagnostic accuracy and treatment compliance through clear patient-provider communication.
                </p>
                <div className="text-sm text-green-600 dark:text-green-400 font-medium">
                  Reduces misdiagnosis risk
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-700 rounded-xl shadow-md overflow-hidden">
              <div className="h-48 bg-purple-600 flex justify-center items-center p-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Patient Education</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Ensure patients fully understand their condition, treatment options, and care instructions regardless of language.
                </p>
                <div className="text-sm text-purple-600 dark:text-purple-400 font-medium">
                  Improves health outcomes
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Call to Action */}
      <div className="bg-blue-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Break Language Barriers?</h2>
          <p className="text-xl text-blue-100 mb-8 max-w-3xl mx-auto">
            Experience the power of real-time medical translation with our interactive demo.
          </p>
          <button
            onClick={() => setShowDemo(true)}
            className="px-8 py-4 bg-white text-blue-600 text-lg font-semibold rounded-lg hover:bg-blue-50 transition-colors shadow-lg inline-flex items-center mx-auto"
          >
            <span>Launch Translation Interface</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </AuthWrapper>
  );
}
