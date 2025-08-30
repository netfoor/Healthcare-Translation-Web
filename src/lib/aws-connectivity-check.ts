/**
 * AWS Connectivity Check
 * 
 * This file provides a quick check for AWS connectivity to help diagnose issues
 * when the WebSocket connection fails. Run this in the browser console to test
 * connectivity to AWS services.
 */

import { runWebSocketDiagnostic, getEnvironmentInfo } from './websocket-diagnostic';
import { printWebSocket1006Report, validateAwsWebSocketUrl } from './websocket-1006-helper';

/**
 * Check if environment variables are set correctly
 */
export function checkEnvironmentVariables(): {
  success: boolean;
  issues: string[];
  variables: Record<string, string | undefined>;
} {
  const variables = {
    WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL,
    WEBSOCKET_API_URL: process.env.NEXT_PUBLIC_WEBSOCKET_API_URL,
    MOCK_SERVICES: process.env.NEXT_PUBLIC_MOCK_SERVICES,
    NODE_ENV: process.env.NODE_ENV
  };
  
  const issues: string[] = [];
  
  if (!variables.WEBSOCKET_URL && !variables.WEBSOCKET_API_URL) {
    issues.push('WebSocket URL is not configured. Set NEXT_PUBLIC_WEBSOCKET_URL in .env.local');
  }
  
  if (variables.MOCK_SERVICES === 'true') {
    issues.push('Mock services are enabled (NEXT_PUBLIC_MOCK_SERVICES=true). Disable to use real AWS services.');
  }
  
  return {
    success: issues.length === 0,
    issues,
    variables
  };
}

/**
 * Run a complete diagnostic check
 */
export async function runAwsDiagnostics(): Promise<{
  environment: Record<string, unknown>;
  variables: Record<string, string | undefined>;
  websocket: Record<string, unknown>;
  issues: string[];
  success: boolean;
}> {
  console.log('Running AWS diagnostics...');
  
  const environmentInfo = getEnvironmentInfo();
  const environmentCheck = checkEnvironmentVariables();
  const issues = [...environmentCheck.issues];
  
  let websocketResult: Record<string, unknown> = { tested: false };
  
  // Only test WebSocket if environment variables are set
  if (environmentCheck.variables.WEBSOCKET_URL || environmentCheck.variables.WEBSOCKET_API_URL) {
    try {
      const websocketUrl = environmentCheck.variables.WEBSOCKET_URL || environmentCheck.variables.WEBSOCKET_API_URL;
      console.log(`Testing WebSocket connectivity to ${websocketUrl}...`);
      
      const result = await runWebSocketDiagnostic(websocketUrl!);
      websocketResult = result.details;
      
      if (!result.success) {
        const tests = result.details.tests as Record<string, any> | undefined;
        const details = tests?.connection;
        let errorMessage = 'WebSocket connection failed';
        
        if (details && typeof details === 'object') {
          // Add more specific error message based on close code
          if ('closeCode' in details) {
            switch (details.closeCode) {
              case 1000:
                errorMessage = 'WebSocket closed normally';
                break;
              case 1001:
                errorMessage = 'WebSocket endpoint is going away';
                break;
              case 1002:
                errorMessage = 'WebSocket protocol error';
                break;
              case 1003:
                errorMessage = 'WebSocket received invalid data';
                break;
              case 1006:
                errorMessage = 'WebSocket closed abnormally (code 1006) - usually indicates CORS issues or connection problems';
                break;
              case 1007:
                errorMessage = 'WebSocket received data inconsistent with message type';
                break;
              case 1008:
                errorMessage = 'WebSocket policy violation';
                break;
              case 1009:
                errorMessage = 'WebSocket message too large';
                break;
              case 1010:
                errorMessage = 'WebSocket endpoint expected extensions that server did not negotiate';
                break;
              case 1011:
                errorMessage = 'WebSocket server encountered unexpected condition';
                break;
              case 1015:
                errorMessage = 'WebSocket TLS handshake failure';
                break;
              default:
                errorMessage = `WebSocket closed with code ${details.closeCode}`;
            }
          }
          
          // Add specific error message if available
          if ('error' in details && typeof details.error === 'string') {
            errorMessage += `: ${details.error}`;
          } else if ('closeReason' in details && typeof details.closeReason === 'string') {
            errorMessage += `: ${details.closeReason}`;
          }
        }
        
        issues.push(errorMessage);
      }
    } catch (error) {
      websocketResult = { error: error instanceof Error ? error.message : String(error) };
      issues.push(`WebSocket testing error: ${error instanceof Error ? error.message : String(error)}`);
    }
  } else {
    issues.push('WebSocket URL not configured, skipping connection test');
  }
  
  // Check if secure context (needed for many browser features)
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    issues.push('Browser is not in a secure context. Some features may not work properly.');
  }
  
  return {
    environment: environmentInfo,
    variables: environmentCheck.variables,
    websocket: websocketResult,
    issues,
    success: issues.length === 0
  };
}

/**
 * Print diagnostic results to console
 */
export function printDiagnosticResults(results: Awaited<ReturnType<typeof runAwsDiagnostics>>): void {
  console.group('AWS Connectivity Diagnostics');
  
  console.log('Success:', results.success ? '✅ All checks passed' : '❌ Issues detected');
  
  if (results.issues.length > 0) {
    console.group('Issues Detected:');
    results.issues.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue}`);
    });
    console.groupEnd();
  }
  
  console.group('Environment Variables:');
  Object.entries(results.variables).forEach(([key, value]) => {
    console.log(`${key}: ${value || '(not set)'}`);
  });
  console.groupEnd();
  
  console.group('Browser Environment:');
  console.log(results.environment);
  console.groupEnd();
  
  console.group('WebSocket Test Results:');
  console.log(results.websocket);
  console.groupEnd();
  
  console.groupEnd();
}

/**
 * Run diagnostics and print results to console
 * This is the main function to call for quick diagnosis
 */
export async function diagnoseAwsConnectivity(): Promise<void> {
  console.log('Starting AWS connectivity diagnosis...');
  const results = await runAwsDiagnostics();
  printDiagnosticResults(results);
  
  // Get WebSocket URL for additional diagnostics
  const websocketUrl = results.variables.WEBSOCKET_URL || results.variables.WEBSOCKET_API_URL;
  
  if (!results.success) {
    console.warn('RECOMMENDATION: Check the issues listed above and fix them to enable real AWS services.');
    
    if (results.issues.some(issue => issue.includes('CORS'))) {
      console.log('CORS HELP: Make sure your AWS API Gateway has the following CORS configuration:');
      console.log('- Access-Control-Allow-Origin: Should include your app\'s domain or * for testing');
      console.log('- Access-Control-Allow-Methods: OPTIONS, GET, POST');
      console.log('- Access-Control-Allow-Headers: Content-Type, Authorization, x-api-key');
    }
    
    // If we detect code 1006 errors, run the specialized 1006 diagnostics
    if (results.issues.some(issue => issue.includes('1006'))) {
      console.log('\n--- DETAILED CODE 1006 ANALYSIS ---');
      
      if (websocketUrl) {
        // Run special 1006 diagnostics
        try {
          printWebSocket1006Report(websocketUrl);
        } catch (error) {
          console.error('Error running 1006 specific diagnostics:', error);
        }
      }
    }
  }
  
  // Add URL validation regardless of success/failure
  if (websocketUrl) {
    try {
      const urlValidation = validateAwsWebSocketUrl(websocketUrl);
      console.group('WebSocket URL Validation');
      console.log('URL Valid for AWS API Gateway:', urlValidation.isValid ? '✅ Yes' : '❌ No');
      
      if (!urlValidation.isValid && Array.isArray(urlValidation.details.corrections)) {
        console.log('Suggested corrections:');
        urlValidation.details.corrections.forEach((correction, i) => {
          console.log(`${i + 1}. ${correction}`);
        });
      }
      console.groupEnd();
    } catch (error) {
      console.error('Error validating WebSocket URL:', error);
    }
  }
}

// Export a global function for easy console access
if (typeof window !== 'undefined') {
  (window as any).checkAwsConnectivity = diagnoseAwsConnectivity;
  (window as any).diagnose1006Error = (url?: string) => {
    const websocketUrl = url || 
                          process.env.NEXT_PUBLIC_WEBSOCKET_URL || 
                          process.env.NEXT_PUBLIC_WEBSOCKET_API_URL;
    
    if (!websocketUrl) {
      console.error('No WebSocket URL provided or configured in environment variables');
      return;
    }
    
    printWebSocket1006Report(websocketUrl);
  };
  
  console.log('AWS connectivity diagnostic tools loaded:');
  console.log('- Run window.checkAwsConnectivity() for general AWS connectivity diagnosis');
  console.log('- Run window.diagnose1006Error() for specific WebSocket 1006 error diagnosis');
}
