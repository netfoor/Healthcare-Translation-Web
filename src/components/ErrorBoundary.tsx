'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ServiceError } from '@/lib/types';
import { 
  globalErrorHandler, 
  ServiceType, 
  EnhancedServiceError 
} from '@/lib/error-handling';
import { 
  globalRecoveryManager, 
  RecoveryStrategy 
} from '@/lib/error-recovery';
import { secureLogger } from '@/lib/secure-logger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  serviceType?: ServiceType;
  onError?: (error: EnhancedServiceError) => void;
  enableRecovery?: boolean;
}

interface State {
  hasError: boolean;
  error?: EnhancedServiceError;
  errorInfo?: ErrorInfo;
  isRecovering?: boolean;
  recoveryAttempts?: number;
}

/**
 * Enhanced Error Boundary component with comprehensive error handling
 * Integrates with the new error handling and recovery system
 */
export class ErrorBoundary extends Component<Props, State> {
  private maxRecoveryAttempts = 3;

  constructor(props: Props) {
    super(props);
    this.state = { 
      hasError: false,
      recoveryAttempts: 0
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error for monitoring
    this.setState({ errorInfo });
    
    const serviceType = this.props.serviceType || ServiceType.WEBSOCKET;
    
    try {
      // Use the enhanced error handler
      const enhancedError = await globalErrorHandler.handleError(
        error,
        serviceType,
        {
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          component: 'ErrorBoundary'
        }
      );

      this.setState({ error: enhancedError });

      // Log with secure logger
      secureLogger.logError(enhancedError, {
        componentStack: errorInfo.componentStack,
        errorBoundary: true
      });

      // Notify parent component
      if (this.props.onError) {
        this.props.onError(enhancedError);
      }

      // Attempt recovery if enabled
      if (this.props.enableRecovery) {
        this.attemptRecovery(enhancedError);
      }
    } catch (handlingError) {
      console.error('Error in error handling:', handlingError);
      secureLogger.logCritical(serviceType, 'Error boundary failed to handle error', {
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown'
      });
    }
  }

  private async attemptRecovery(error: EnhancedServiceError): Promise<void> {
    if (this.state.recoveryAttempts! >= this.maxRecoveryAttempts) {
      return;
    }

    this.setState({ 
      isRecovering: true,
      recoveryAttempts: (this.state.recoveryAttempts || 0) + 1
    });

    try {
      const recoveryResult = await globalRecoveryManager.attemptRecovery(error);
      
      if (recoveryResult.success) {
        // Recovery successful, reset error state
        setTimeout(() => {
          this.setState({ 
            hasError: false, 
            error: undefined, 
            errorInfo: undefined,
            isRecovering: false,
            recoveryAttempts: 0
          });
        }, recoveryResult.retryAfter || 1000);
      } else {
        this.setState({ isRecovering: false });
      }
    } catch (recoveryError) {
      console.error('Recovery attempt failed:', recoveryError);
      this.setState({ isRecovering: false });
    }
  }

  private handleRetry = (): void => {
    this.setState({ 
      hasError: false, 
      error: undefined, 
      errorInfo: undefined,
      isRecovering: false,
      recoveryAttempts: 0
    });
  };

  private handleRefresh = (): void => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Render custom fallback UI or use provided fallback
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const error = this.state.error;
      const isRecovering = this.state.isRecovering;

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center mb-4">
              <div className="flex-shrink-0">
                {isRecovering ? (
                  <svg
                    className="h-8 w-8 text-blue-500 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                ) : (
                  <svg
                    className="h-8 w-8 text-red-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                )}
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900">
                  {isRecovering ? 'Attempting Recovery...' : 'Something went wrong'}
                </h3>
              </div>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600">
                {isRecovering 
                  ? 'We\'re trying to recover from the error automatically...'
                  : error?.userMessage || 'We encountered an unexpected error. Please try refreshing the page or contact support if the problem persists.'
                }
              </p>
              
              {error?.recoveryActions && error.recoveryActions.length > 0 && !isRecovering && (
                <div className="mt-3">
                  <p className="text-sm font-medium text-gray-700 mb-2">Suggested actions:</p>
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {error.recoveryActions.map((action, index) => (
                      <li key={index}>{action}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {!isRecovering && (
              <div className="flex space-x-3">
                <button
                  onClick={this.handleRefresh}
                  className="flex-1 bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  Refresh Page
                </button>
                <button
                  onClick={this.handleRetry}
                  className="flex-1 bg-gray-200 text-gray-800 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                >
                  Try Again
                </button>
              </div>
            )}

            {error?.correlationId && (
              <div className="mt-4 p-3 bg-gray-100 rounded-md">
                <p className="text-xs text-gray-500">
                  Error ID: {error.correlationId}
                </p>
                <p className="text-xs text-gray-500">
                  Service: {error.serviceType}
                </p>
              </div>
            )}

            {process.env.NODE_ENV === 'development' && error && (
              <details className="mt-4">
                <summary className="text-sm text-gray-500 cursor-pointer">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto max-h-32">
                  {JSON.stringify({
                    category: error.category,
                    severity: error.severity,
                    technicalMessage: error.technicalMessage,
                    context: error.context
                  }, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook-based error handler for functional components
 */
export function useErrorHandler(serviceType: ServiceType = ServiceType.WEBSOCKET) {
  return async (error: Error, context?: Record<string, unknown>) => {
    try {
      const enhancedError = await globalErrorHandler.handleError(
        error,
        serviceType,
        { ...context, hook: true }
      );

      secureLogger.logError(enhancedError, context);
      
      return enhancedError;
    } catch (handlingError) {
      console.error('Error in useErrorHandler:', handlingError);
      secureLogger.logCritical(serviceType, 'Hook error handler failed', {
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown'
      });
      throw error;
    }
  };
}

/**
 * Service-specific error boundary for AWS services
 */
interface ServiceErrorBoundaryProps {
  children: ReactNode;
  serviceType: ServiceType;
  serviceName?: string;
  enableRecovery?: boolean;
  onError?: (error: EnhancedServiceError) => void;
}

export function ServiceErrorBoundary({ 
  children, 
  serviceType, 
  serviceName,
  enableRecovery = true,
  onError
}: ServiceErrorBoundaryProps) {
  const displayName = serviceName || serviceType.toLowerCase().replace('_', ' ');
  
  return (
    <ErrorBoundary
      serviceType={serviceType}
      enableRecovery={enableRecovery}
      onError={onError}
      fallback={
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                {displayName} Service Error
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>
                  There was an issue with the {displayName} service. The system is attempting to recover automatically.
                </p>
              </div>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}