/**
 * WebSocket 1006 Error Helper
 * This file provides special diagnostic tools for dealing with the common 1006 error code
 * which frequently affects WebSocket connections due to CORS, network or API issues
 */

/**
 * AWS API Gateway WebSocket URL Structure Validator
 * Checks if the WebSocket URL has the correct structure for AWS API Gateway
 * 
 * @param url The WebSocket URL to validate
 * @returns Validation results
 */
export function validateAwsWebSocketUrl(url: string): {
  isValid: boolean;
  details: Record<string, unknown>;
} {
  const result = {
    isValid: false,
    details: {
      url,
      checks: [] as Record<string, unknown>[],
      corrections: [] as string[],
    },
  };

  try {
    const urlObj = new URL(url);
    
    // 1. Check protocol
    if (urlObj.protocol !== 'wss:') {
      result.details.checks.push({
        check: 'protocol',
        success: false,
        expected: 'wss:',
        actual: urlObj.protocol,
      });
      result.details.corrections.push(`Change protocol from ${urlObj.protocol} to wss://`);
    } else {
      result.details.checks.push({
        check: 'protocol',
        success: true,
      });
    }
    
    // 2. Check if this is an API Gateway URL
    const isApiGateway = urlObj.hostname.includes('.execute-api.') && 
                          urlObj.hostname.includes('.amazonaws.com');
    
    result.details.checks.push({
      check: 'isApiGateway',
      success: isApiGateway,
      hostname: urlObj.hostname,
    });
    
    if (!isApiGateway) {
      result.details.corrections.push('URL does not appear to be an AWS API Gateway endpoint.');
    }
    
    // 3. Check path structure for API Gateway
    if (isApiGateway) {
      // API Gateway WebSocket URLs should have a stage name in the path
      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length === 0) {
        result.details.checks.push({
          check: 'stagePath',
          success: false,
          error: 'Missing stage name in path',
          path: urlObj.pathname,
        });
        result.details.corrections.push('Add stage name to path, e.g., /production or /dev');
      } else {
        result.details.checks.push({
          check: 'stagePath',
          success: true,
          stage: pathParts[0],
        });
      }
    }
    
    // 4. Check query parameters (common issues)
    if (urlObj.searchParams.has('X-Amz-Date') || 
        urlObj.searchParams.has('X-Amz-Signature') || 
        urlObj.searchParams.has('X-Amz-Credential')) {
      result.details.checks.push({
        check: 'authentication',
        success: true,
        type: 'IAM signature',
      });
    } else {
      // Check if any auth query params are present
      const hasAuthParams = Array.from(urlObj.searchParams.keys()).some(
        key => key.toLowerCase().includes('auth') || key.toLowerCase().includes('token')
      );
      
      result.details.checks.push({
        check: 'authentication',
        success: hasAuthParams,
        type: hasAuthParams ? 'Custom auth' : 'None',
        warning: !hasAuthParams ? 'No authentication parameters detected' : undefined,
      });
      
      if (!hasAuthParams) {
        result.details.corrections.push(
          'If your API requires authentication, add appropriate auth tokens as query parameters'
        );
      }
    }
    
    // Calculate overall validity
    const failedChecks = (result.details.checks as Record<string, unknown>[])
      .filter(check => check.success === false);
    
    result.isValid = failedChecks.length === 0;
    
  } catch (error) {
    result.details.error = error instanceof Error ? error.message : String(error);
    result.details.corrections.push('URL format is invalid. Please verify the complete URL.');
  }
  
  return result;
}

/**
 * Generates specific advice for WebSocket 1006 errors based on the URL and environment
 */
export function getWebSocket1006Advice(url: string): {
  possibleCauses: string[];
  solutions: string[];
  additionalChecks: string[];
} {
  // Validate the URL first
  const urlValidation = validateAwsWebSocketUrl(url);
  
  const possibleCauses = [
    'CORS configuration missing or incorrect on API Gateway',
    'WebSocket service not deployed or running',
    'Network/firewall blocking WebSocket connections',
    'API Gateway route integration not responding correctly',
    'Authentication issue (missing or invalid credentials)'
  ];
  
  const solutions = [
    'Configure CORS in API Gateway:',
    '  - Set Access-Control-Allow-Origin to your app domain or * for testing',
    '  - Add Access-Control-Allow-Methods: GET, POST, OPTIONS',
    '  - Add Access-Control-Allow-Headers: Content-Type, Authorization',
    '',
    'Check API Gateway deployment:',
    '  - Verify the WebSocket API is deployed to the correct stage',
    '  - Check CloudWatch logs for errors in your Lambda integrations',
    '  - Test the API directly using wscat if possible',
    '',
    'Verify security and authentication:',
    '  - If using IAM auth, ensure credentials are passed correctly',
    '  - If using a custom authorizer, check it\'s configured properly',
    '  - Try temporarily disabling auth for testing',
  ];
  
  const additionalChecks = [
    'Try connecting from a different network',
    'Check if other clients can connect to the same WebSocket',
    'Verify WebSocket URL matches exactly what was deployed',
    'Look for any TLS/certificate issues if using a custom domain',
    'Test with a simple WebSocket client like wscat to isolate browser issues'
  ];
  
  // Add URL-specific advice if validation failed
  if (!urlValidation.isValid) {
    possibleCauses.unshift('WebSocket URL format or configuration is invalid');
    
    const urlCorrections = urlValidation.details.corrections as string[];
    if (urlCorrections.length > 0) {
      solutions.unshift(
        'Fix WebSocket URL issues:',
        ...urlCorrections.map(correction => `  - ${correction}`)
      );
    }
  }
  
  return {
    possibleCauses,
    solutions,
    additionalChecks
  };
}

/**
 * Creates a comprehensive report for diagnosing WebSocket 1006 errors
 */
export function createWebSocket1006Report(url: string): {
  timestamp: string;
  url: string;
  urlValidation: ReturnType<typeof validateAwsWebSocketUrl>;
  advice: ReturnType<typeof getWebSocket1006Advice>;
  environmentInfo: Record<string, unknown>;
} {
  return {
    timestamp: new Date().toISOString(),
    url,
    urlValidation: validateAwsWebSocketUrl(url),
    advice: getWebSocket1006Advice(url),
    environmentInfo: {
      protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown',
      isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : 'unknown',
      supportsWebSocket: typeof WebSocket !== 'undefined',
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
    }
  };
}

/**
 * Prints a formatted WebSocket 1006 error report to the console
 */
export function printWebSocket1006Report(url: string): void {
  const report = createWebSocket1006Report(url);
  
  console.group('🔍 WebSocket Error 1006 Diagnostic Report');
  console.log('URL:', report.url);
  console.log('Time:', report.timestamp);
  
  console.group('URL Validation');
  console.log('Valid:', report.urlValidation.isValid ? '✅ Yes' : '❌ No');
  if (!report.urlValidation.isValid) {
    console.log('Issues:', report.urlValidation.details.corrections);
  }
  console.groupEnd();
  
  console.group('Possible Causes');
  report.advice.possibleCauses.forEach((cause, i) => {
    console.log(`${i + 1}. ${cause}`);
  });
  console.groupEnd();
  
  console.group('Recommended Solutions');
  console.log(report.advice.solutions.join('\n'));
  console.groupEnd();
  
  console.group('Additional Checks');
  report.advice.additionalChecks.forEach((check, i) => {
    console.log(`${i + 1}. ${check}`);
  });
  console.groupEnd();
  
  console.group('Environment Information');
  Object.entries(report.environmentInfo).forEach(([key, value]) => {
    console.log(`${key}: ${value}`);
  });
  console.groupEnd();
  
  console.groupEnd();
}

// Expose diagnostic functions to the global scope for console debugging
if (typeof window !== 'undefined') {
  (window as any).diagnoseWebSocket1006 = (url?: string) => {
    const websocketUrl = url || 
                        process.env.NEXT_PUBLIC_WEBSOCKET_URL || 
                        process.env.NEXT_PUBLIC_WEBSOCKET_API_URL;
    
    if (!websocketUrl) {
      console.error('No WebSocket URL provided or configured');
      return;
    }
    
    printWebSocket1006Report(websocketUrl);
  };
}
