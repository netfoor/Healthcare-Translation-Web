/**
 * WebSocket Diagnostics Helper
 * Used to diagnose WebSocket connection issues
 */

/**
 * Run WebSocket connection diagnostic
 */
export async function runWebSocketDiagnostic(websocketUrl: string): Promise<{
  success: boolean;
  details: Record<string, unknown>;
}> {
  console.log('Running WebSocket diagnostic on URL:', websocketUrl);
  
  const results: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    url: websocketUrl,
    tests: {} as Record<string, unknown>,
    environmentInfo: getEnvironmentInfo()
  };
  
  // Check if URL is valid
  try {
    new URL(websocketUrl);
    (results.tests as Record<string, unknown>).urlValidation = { success: true };
  } catch (error) {
    (results.tests as Record<string, unknown>).urlValidation = { 
      success: false, 
      error: error instanceof Error ? error.message : 'Invalid URL'
    };
    return {
      success: false,
      details: results
    };
  }
  
  // Check if protocol is wss://
  const url = new URL(websocketUrl);
  if (url.protocol !== 'wss:') {
    (results.tests as Record<string, unknown>).secureProtocol = { 
      success: false, 
      error: `Expected wss:// protocol, got ${url.protocol}`
    };
  } else {
    (results.tests as Record<string, unknown>).secureProtocol = { success: true };
  }
  
  // Check if hostname is valid and not localhost
  const hostname = url.hostname;
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    (results.tests as Record<string, unknown>).hostname = {
      success: false,
      warning: 'Using localhost for WebSocket URL. This will not work for production or remote clients.'
    };
  } else if (hostname.includes('.execute-api.') && hostname.includes('.amazonaws.com')) {
    (results.tests as Record<string, unknown>).hostname = {
      success: true,
      type: 'AWS API Gateway',
      region: hostname.split('.')[2] // Extract region from API Gateway URL
    };
  } else {
    (results.tests as Record<string, unknown>).hostname = {
      success: true,
      type: 'Custom domain'
    };
  }
  
  // Test DNS resolution (simple check)
  try {
    // We can't directly test DNS in browser, so we'll just log the information
    (results.tests as Record<string, unknown>).dns = {
      success: true,
      note: 'DNS resolution cannot be directly tested in browser. If connection fails, this could be a DNS issue.'
    };
  } catch (error) {
    // This won't execute in browser context, but kept for API consistency
    (results.tests as Record<string, unknown>).dns = {
      success: false,
      error: 'DNS resolution failed'
    };
  }
  
  // Try a simple WebSocket connection
  try {
    const connectionTestResult = await testConnection(websocketUrl);
    (results.tests as Record<string, unknown>).connection = connectionTestResult;
    
    // Extract diagnosis if available for the main results
    if (connectionTestResult.diagnosis) {
      results.diagnosis = connectionTestResult.diagnosis;
    }
    
    // Add specific recommendations for 1006 errors
    if (connectionTestResult.closeCode === 1006) {
      results.recommendations = [
        'Check API Gateway CORS configuration',
        'Verify WebSocket service is deployed and running',
        'Check for any proxy or firewall blocking WebSocket connections',
        'Try from a different network to rule out network issues',
        'Review the route integration in API Gateway',
        'Check CloudWatch logs for API Gateway errors'
      ];
    }
    
    if (!connectionTestResult.success) {
      return {
        success: false,
        details: results
      };
    }
  } catch (error) {
    (results.tests as Record<string, unknown>).connection = { 
      success: false, 
      error: error instanceof Error ? error.message : 'Connection test failed'
    };
    return {
      success: false,
      details: results
    };
  }
  
  // All tests passed
  return {
    success: true,
    details: results
  };
}

/**
 * Test a WebSocket connection
 */
async function testConnection(url: string): Promise<{ 
  success: boolean;
  connectTime?: number;
  error?: string;
  closeCode?: number;
  closeReason?: string;
  diagnosis?: string;
  networkInfo?: Record<string, unknown>;
}> {
  return new Promise(resolve => {
    try {
      const startTime = Date.now();
      let timeoutId: NodeJS.Timeout;
      const networkInfo: Record<string, unknown> = {};
      
      // Check for HTTPS/WSS mismatch
      if (typeof window !== 'undefined') {
        const pageProtocol = window.location.protocol;
        const isPageSecure = pageProtocol === 'https:';
        const isWebSocketSecure = url.startsWith('wss:');
        
        networkInfo.pageProtocol = pageProtocol;
        networkInfo.wsProtocol = isWebSocketSecure ? 'wss:' : 'ws:';
        networkInfo.protocolMismatch = isPageSecure !== isWebSocketSecure;
        
        // Add warning for protocol mismatch
        if (isPageSecure && !isWebSocketSecure) {
          networkInfo.protocolWarning = 'Secure page (HTTPS) trying to connect to insecure WebSocket (WS)';
        }
      }
      
      console.log(`Trying to connect to ${url}`);
      const ws = new WebSocket(url);
      
      // Add connection attempt timestamp
      networkInfo.connectionAttemptTime = new Date().toISOString();
      
      const cleanup = () => {
        if (timeoutId) clearTimeout(timeoutId);
        ws.removeEventListener('open', handleOpen);
        ws.removeEventListener('error', handleError);
        ws.removeEventListener('close', handleClose);
        ws.removeEventListener('message', handleMessage);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      };
      
      // Set timeout for connection
      timeoutId = setTimeout(() => {
        cleanup();
        resolve({ 
          success: false, 
          error: 'Connection timeout after 10 seconds',
          diagnosis: 'The connection attempt timed out. This could indicate network connectivity issues, firewall restrictions, or that the server is not responding.',
          networkInfo
        });
      }, 10000);
      
      const handleOpen = () => {
        const connectTime = Date.now() - startTime;
        console.log(`Connected to ${url} in ${connectTime}ms`);
        networkInfo.connectionEstablishedTime = new Date().toISOString();
        networkInfo.connectTime = connectTime;
        
        // Send a simple message if needed
        try {
          const pingMessage = JSON.stringify({ action: 'ping' });
          ws.send(pingMessage);
          networkInfo.pingMessageSent = pingMessage;
        } catch (err) {
          console.warn('Failed to send ping:', err);
          networkInfo.pingSendError = err instanceof Error ? err.message : String(err);
        }
        
        // Close after successful connection
        setTimeout(() => {
          cleanup();
          resolve({ success: true, connectTime, networkInfo });
        }, 1000);
      };
      
      const handleMessage = (event: MessageEvent) => {
        try {
          console.log('WebSocket message received:', event.data);
          networkInfo.messageReceived = event.data;
        } catch (error) {
          console.error('Error handling WebSocket message:', error);
        }
      };
      
      const handleError = (event: Event) => {
        console.error('WebSocket connection error:', event);
        networkInfo.errorTime = new Date().toISOString();
        networkInfo.errorEvent = String(event);
        cleanup();
        
        resolve({ 
          success: false, 
          error: 'Connection error',
          diagnosis: 'A WebSocket error occurred. This is often related to network connectivity or server-side issues.',
          networkInfo
        });
      };
      
      const handleClose = (event: CloseEvent) => {
        console.log(`WebSocket closed with code ${event.code}: ${event.reason}`);
        networkInfo.closeTime = new Date().toISOString();
        networkInfo.closeCode = event.code;
        networkInfo.closeReason = event.reason;
        
        // Provide specific diagnosis based on close code
        let diagnosis = '';
        
        switch (event.code) {
          case 1000:
            diagnosis = 'Normal closure - the connection successfully completed whatever purpose for which it was created.';
            break;
          case 1001:
            diagnosis = 'The endpoint is going away, either because of a server failure or because the browser is navigating away from the page that opened the connection.';
            break;
          case 1002:
            diagnosis = 'The endpoint is terminating the connection due to a protocol error.';
            break;
          case 1003:
            diagnosis = 'The connection is being terminated because the endpoint received data of a type it cannot accept (e.g., text-only endpoint received binary data).';
            break;
          case 1005:
            diagnosis = 'No status code was provided even though one was expected.';
            break;
          case 1006:
            diagnosis = 'Connection was closed abnormally (1006). This is a special code that indicates the connection was closed abnormally (without sending a close frame). Common causes include:\n' +
              '1. CORS issues: Your API Gateway doesn\'t have proper CORS configuration\n' +
              '2. Network interruption: The connection was dropped unexpectedly\n' +
              '3. Server not responding: The server isn\'t handling the connection properly\n' +
              '4. Firewall/proxy issues: Something is blocking the WebSocket connection\n\n' +
              'For CORS-related issues, check that your API Gateway has these headers:\n' +
              '- Access-Control-Allow-Origin: * (or your specific domain)\n' +
              '- Access-Control-Allow-Methods: GET, POST, OPTIONS\n' +
              '- Access-Control-Allow-Headers: Content-Type, Authorization';
            break;
          case 1007:
            diagnosis = 'The endpoint is terminating the connection because a message was received that contained inconsistent data (e.g., non-UTF-8 data within a text message).';
            break;
          case 1008:
            diagnosis = 'The endpoint is terminating the connection because it received a message that violates its policy.';
            break;
          case 1009:
            diagnosis = 'The endpoint is terminating the connection because a data frame was received that is too large.';
            break;
          case 1010:
            diagnosis = 'The client is terminating the connection because it expected the server to negotiate one or more extension, but the server didn\'t.';
            break;
          case 1011:
            diagnosis = 'The server is terminating the connection because it encountered an unexpected condition that prevented it from fulfilling the request.';
            break;
          case 1012:
            diagnosis = 'The server is restarting and will be available again soon.';
            break;
          case 1013:
            diagnosis = 'The server is terminating the connection due to a temporary condition, e.g. it is overloaded and is casting off some connections.';
            break;
          case 1014:
            diagnosis = 'The server was acting as a gateway or proxy and received an invalid response from the upstream server.';
            break;
          case 1015:
            diagnosis = 'The connection was closed due to a failure to perform a TLS handshake (e.g., the server certificate can\'t be verified).';
            break;
          default:
            diagnosis = `Unknown close code: ${event.code}. This is not a standard WebSocket close code.`;
        }
        
        cleanup();
        resolve({ 
          success: false, 
          closeCode: event.code, 
          closeReason: event.reason || 'No reason provided',
          diagnosis,
          networkInfo
        });
      };
      
      ws.addEventListener('open', handleOpen);
      ws.addEventListener('error', handleError);
      ws.addEventListener('close', handleClose);
      ws.addEventListener('message', handleMessage);
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      resolve({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error creating WebSocket',
        diagnosis: 'Failed to create WebSocket object. This might be due to an invalid URL or browser security restrictions.',
        networkInfo: {
          errorType: 'creation_error',
          errorDetails: error instanceof Error ? error.message : String(error)
        }
      });
    }
  });
}

/**
 * Check if browser supports WebSockets
 */
export function checkWebSocketSupport(): boolean {
  return typeof WebSocket !== 'undefined';
}

/**
 * Get diagnostic information about the environment
 */
export function getEnvironmentInfo(): Record<string, unknown> {
  return {
    browser: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    webSocketSupport: checkWebSocketSupport(),
    secure: typeof window !== 'undefined' ? window.location.protocol === 'https:' : 'unknown',
    timestamp: new Date().toISOString()
  };
}
