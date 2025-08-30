import React, { useState, useEffect } from 'react';
import { isWebSocketConnected } from '../lib/aws-websocket-service';
import { getEnvironmentInfo } from '../lib/websocket-diagnostic';
import { runAwsDiagnostics } from '../lib/aws-connectivity-check';

interface WebSocketFallbackProps {
  children: React.ReactNode;
  onFallbackActivated?: () => void;
}

export function WebSocketFallback({ children, onFallbackActivated }: WebSocketFallbackProps) {
  const [connectionFailed, setConnectionFailed] = useState(false);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [environmentInfo, setEnvironmentInfo] = useState<Record<string, unknown>>({});
  const [mockModeEnabled, setMockModeEnabled] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [isRunningDiagnostics, setIsRunningDiagnostics] = useState(false);

  useEffect(() => {
    // Check if the WebSocket has failed multiple times
    const failedAttempts = localStorage.getItem('websocket_failed_attempts');
    const failCount = failedAttempts ? parseInt(failedAttempts, 10) : 0;
    
    if (failCount > 3) {
      setConnectionFailed(true);
      setEnvironmentInfo(getEnvironmentInfo());
      
      // Run diagnostics automatically
      runDiagnostics();
      
      // Notify parent component
      if (onFallbackActivated) {
        onFallbackActivated();
      }
    }
    
    // Check if mock mode is already forced
    const forceMockMode = localStorage.getItem('force_mock_mode') === 'true';
    if (forceMockMode) {
      setMockModeEnabled(true);
    }
  }, [onFallbackActivated]);
  
  const runDiagnostics = async () => {
    setIsRunningDiagnostics(true);
    try {
      const results = await runAwsDiagnostics();
      setDiagnosticResults(results);
    } catch (error) {
      console.error('Error running diagnostics:', error);
    } finally {
      setIsRunningDiagnostics(false);
    }
  };

  const enableMockMode = () => {
    // Set local storage flag for mock mode
    localStorage.setItem('force_mock_mode', 'true');
    setMockModeEnabled(true);
    
    // Reload the application to apply the change
    window.location.reload();
  };

  const runInRealMode = () => {
    // Clear the local storage flag
    localStorage.removeItem('force_mock_mode');
    localStorage.removeItem('websocket_failed_attempts');
    setConnectionFailed(false);
    
    // Reload the application to apply the change
    window.location.reload();
  };

  if (!connectionFailed) {
    return <>{children}</>;
  }

  return (
    <div className="p-4">
      <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg mb-4">
        <h3 className="text-lg font-medium text-yellow-800 mb-2">
          WebSocket Connection Issues Detected
        </h3>
        <p className="text-yellow-700 mb-3">
          The application is having trouble connecting to the real-time communication service.
          This could be due to network issues, CORS configuration, or the service might be unavailable.
        </p>
        
        <div className="flex space-x-3 mb-4">
          <button
            onClick={enableMockMode}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            disabled={mockModeEnabled}
          >
            {mockModeEnabled ? 'Mock Mode Enabled' : 'Enable Mock Mode'}
          </button>
          
          <button
            onClick={runInRealMode}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Try Again in Real Mode
          </button>
          
          <button
            onClick={() => {
              setShowDiagnostics(!showDiagnostics);
              if (!diagnosticResults && !showDiagnostics) {
                runDiagnostics();
              }
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            {showDiagnostics ? 'Hide Diagnostics' : 'Show Diagnostics'}
          </button>
          
          {showDiagnostics && (
            <button
              onClick={runDiagnostics}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              disabled={isRunningDiagnostics}
            >
              {isRunningDiagnostics ? 'Running...' : 'Run Diagnostics Again'}
            </button>
          )}
        </div>
        
        {mockModeEnabled && (
          <div className="bg-green-100 border border-green-200 p-3 rounded">
            <p className="text-green-800">
              Mock mode is now enabled. The application will use simulated responses instead of real services.
            </p>
          </div>
        )}
        
        {showDiagnostics && (
          <div className="bg-gray-100 p-3 rounded font-mono text-sm overflow-auto max-h-80">
            {isRunningDiagnostics ? (
              <div className="flex items-center justify-center p-4">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                <span className="ml-2">Running diagnostics...</span>
              </div>
            ) : diagnosticResults ? (
              <>
                <h4 className="font-bold mb-2">Diagnostic Results:</h4>
                <div className="bg-red-50 border border-red-200 p-2 rounded mb-3">
                  <h5 className="font-bold text-red-800">Issues Detected:</h5>
                  {diagnosticResults.issues.length > 0 ? (
                    <ul className="list-disc ml-5">
                      {diagnosticResults.issues.map((issue: string, i: number) => (
                        <li key={i} className="text-red-700">{issue}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-green-700">No issues detected.</p>
                  )}
                </div>
                
                <h4 className="font-bold mt-4 mb-2">Environment Variables:</h4>
                <pre className="bg-white p-2 rounded">
                  {JSON.stringify(diagnosticResults.variables, null, 2)}
                </pre>
                
                <h4 className="font-bold mt-4 mb-2">WebSocket Test Results:</h4>
                <pre className="bg-white p-2 rounded">
                  {JSON.stringify(diagnosticResults.websocket, null, 2)}
                </pre>
                
                <h4 className="font-bold mt-4 mb-2">Browser Environment:</h4>
                <pre className="bg-white p-2 rounded">
                  {JSON.stringify(diagnosticResults.environment, null, 2)}
                </pre>
              </>
            ) : (
              <>
                <h4 className="font-bold mb-2">Environment Information:</h4>
                <pre>{JSON.stringify(environmentInfo, null, 2)}</pre>
                
                <h4 className="font-bold mt-4 mb-2">WebSocket URL:</h4>
                <p>{process.env.NEXT_PUBLIC_WEBSOCKET_URL || process.env.NEXT_PUBLIC_WEBSOCKET_API_URL || 'Not configured'}</p>
              </>
            )}
            
            <h4 className="font-bold mt-4 mb-2">Troubleshooting Tips:</h4>
            <ul className="list-disc ml-5">
              <li>Check if the WebSocket endpoint is accessible from your network</li>
              <li>Verify CORS settings on your API Gateway</li>
              <li>Ensure the WebSocket service is deployed and running</li>
              <li>Check browser console for more detailed error messages</li>
              <li>Try running <code className="bg-gray-200 px-1">window.checkAwsConnectivity()</code> in your browser console for more diagnostics</li>
            </ul>
          </div>
        )}
      </div>
      
      {/* Continue rendering the application with mock mode */}
      {children}
    </div>
  );
}
