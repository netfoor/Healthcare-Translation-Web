export default function Home() {
  return (
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <div className="bg-blue-50 p-6 rounded-lg border border-blue-200">
          <h3 className="text-lg font-semibold text-blue-900 mb-2">
            Voice-to-Text
          </h3>
          <p className="text-blue-700">
            Convert spoken patient input into accurate text transcripts with AI enhancement
          </p>
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
      </div>

      <div className="text-center">
        <div className="bg-gray-100 p-8 rounded-lg">
          <p className="text-gray-600 mb-4">
            Project setup is complete! Next steps:
          </p>
          <ul className="text-left max-w-md mx-auto space-y-2 text-gray-700">
            <li>✅ Next.js with TypeScript and App Router</li>
            <li>✅ AWS Amplify Gen 2 Backend Configuration</li>
            <li>✅ Development Environment Setup</li>
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
  );
}
