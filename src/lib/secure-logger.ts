/**
 * Secure Logger with PII Redaction for Healthcare Compliance
 * Implements comprehensive logging with automatic PII detection and redaction
 */

import { EnhancedServiceError, ServiceType, ErrorCategory, ErrorSeverity } from './error-handling';

// PII patterns for detection and redaction
const PII_PATTERNS = {
  // Social Security Numbers
  SSN: /\b\d{3}-?\d{2}-?\d{4}\b/g,
  
  // Phone numbers (various formats)
  PHONE: /\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g,
  
  // Email addresses
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  
  // Credit card numbers
  CREDIT_CARD: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  
  // Medical Record Numbers (MRN) - common patterns
  MRN: /\b(?:MRN|mrn|medical record|patient id)[\s:]*[A-Za-z0-9-]{6,20}\b/gi,
  
  // Date of Birth patterns
  DOB: /\b(?:dob|date of birth|born)[\s:]*\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/gi,
  
  // Names (common patterns in medical contexts)
  PATIENT_NAME: /\b(?:patient|pt|mr|mrs|ms|dr)[\s\.]+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g,
  
  // Addresses
  ADDRESS: /\b\d+\s+[A-Za-z0-9\s,.-]+(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|boulevard|blvd|way|court|ct|place|pl)\b/gi,
  
  // ZIP codes
  ZIP_CODE: /\b\d{5}(?:-\d{4})?\b/g,
  
  // Insurance numbers
  INSURANCE: /\b(?:insurance|policy|member)[\s#:]*[A-Za-z0-9-]{8,20}\b/gi,
  
  // IP addresses (for network privacy)
  IP_ADDRESS: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
  
  // Generic sensitive data patterns
  SENSITIVE_ID: /\b[A-Za-z0-9]{8,}-[A-Za-z0-9]{4,}-[A-Za-z0-9]{4,}-[A-Za-z0-9]{4,}-[A-Za-z0-9]{12,}\b/g
};

// Replacement tokens for different PII types
const PII_REPLACEMENTS = {
  SSN: '[SSN-REDACTED]',
  PHONE: '[PHONE-REDACTED]',
  EMAIL: '[EMAIL-REDACTED]',
  CREDIT_CARD: '[CARD-REDACTED]',
  MRN: '[MRN-REDACTED]',
  DOB: '[DOB-REDACTED]',
  PATIENT_NAME: '[NAME-REDACTED]',
  ADDRESS: '[ADDRESS-REDACTED]',
  ZIP_CODE: '[ZIP-REDACTED]',
  INSURANCE: '[INSURANCE-REDACTED]',
  IP_ADDRESS: '[IP-REDACTED]',
  SENSITIVE_ID: '[ID-REDACTED]'
};

// Log levels
export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
  CRITICAL = 'CRITICAL'
}

// Log entry structure
export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: ServiceType;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  message: string;
  correlationId?: string;
  sessionId?: string;
  userId?: string;
  context?: Record<string, unknown>;
  stackTrace?: string;
  redactedFields?: string[];
}

// Logger configuration
export interface LoggerConfig {
  enableConsoleLogging: boolean;
  enableRemoteLogging: boolean;
  logLevel: LogLevel;
  maxLogEntrySize: number;
  retentionDays: number;
  enablePIIDetection: boolean;
  customPIIPatterns?: Record<string, RegExp>;
}

/**
 * Secure Logger Class
 */
export class SecureLogger {
  private config: LoggerConfig;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 1000;

  constructor(config?: Partial<LoggerConfig>) {
    this.config = {
      enableConsoleLogging: process.env.NODE_ENV === 'development',
      enableRemoteLogging: process.env.NODE_ENV === 'production',
      logLevel: process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO,
      maxLogEntrySize: 10000, // 10KB
      retentionDays: 30,
      enablePIIDetection: true,
      ...config
    };
  }

  /**
   * Log an error with automatic PII redaction
   */
  logError(
    error: EnhancedServiceError,
    context?: Record<string, unknown>
  ): void {
    const logEntry = this.createLogEntry(
      LogLevel.ERROR,
      error.serviceType,
      error.technicalMessage,
      {
        category: error.category,
        severity: error.severity,
        correlationId: error.correlationId,
        code: error.code,
        retryable: error.retryable,
        userMessage: error.userMessage,
        recoveryActions: error.recoveryActions,
        ...context
      }
    );

    this.writeLog(logEntry);
  }

  /**
   * Log general information
   */
  logInfo(
    service: ServiceType,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const logEntry = this.createLogEntry(LogLevel.INFO, service, message, context);
    this.writeLog(logEntry);
  }

  /**
   * Log warnings
   */
  logWarning(
    service: ServiceType,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const logEntry = this.createLogEntry(LogLevel.WARN, service, message, context);
    this.writeLog(logEntry);
  }

  /**
   * Log debug information
   */
  logDebug(
    service: ServiceType,
    message: string,
    context?: Record<string, unknown>
  ): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const logEntry = this.createLogEntry(LogLevel.DEBUG, service, message, context);
    this.writeLog(logEntry);
  }

  /**
   * Log critical errors
   */
  logCritical(
    service: ServiceType,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const logEntry = this.createLogEntry(LogLevel.CRITICAL, service, message, context);
    this.writeLog(logEntry);
    
    // Immediately flush critical errors
    this.flushLogs();
  }

  /**
   * Redact PII from text
   */
  redactPII(text: string): { redactedText: string; redactedFields: string[] } {
    if (!this.config.enablePIIDetection) {
      return { redactedText: text, redactedFields: [] };
    }

    let redactedText = text;
    const redactedFields: string[] = [];

    // Apply all PII patterns
    Object.entries(PII_PATTERNS).forEach(([type, pattern]) => {
      if (pattern.test(redactedText)) {
        redactedText = redactedText.replace(pattern, PII_REPLACEMENTS[type as keyof typeof PII_REPLACEMENTS]);
        redactedFields.push(type);
      }
    });

    // Apply custom patterns if provided
    if (this.config.customPIIPatterns) {
      Object.entries(this.config.customPIIPatterns).forEach(([type, pattern]) => {
        if (pattern.test(redactedText)) {
          redactedText = redactedText.replace(pattern, `[${type.toUpperCase()}-REDACTED]`);
          redactedFields.push(type);
        }
      });
    }

    return { redactedText, redactedFields };
  }

  /**
   * Get recent log entries (for debugging)
   */
  getRecentLogs(count: number = 50): LogEntry[] {
    return this.logBuffer.slice(-count);
  }

  /**
   * Clear log buffer
   */
  clearLogs(): void {
    this.logBuffer = [];
  }

  /**
   * Flush logs to remote service
   */
  async flushLogs(): Promise<void> {
    if (!this.config.enableRemoteLogging || this.logBuffer.length === 0) {
      return;
    }

    try {
      // In a real implementation, this would send logs to CloudWatch, Datadog, etc.
      console.log(`Flushing ${this.logBuffer.length} log entries to remote service`);
      
      // Simulate remote logging
      await this.sendLogsToRemoteService(this.logBuffer);
      
      // Clear buffer after successful send
      this.logBuffer = [];
    } catch (error) {
      console.error('Failed to flush logs to remote service:', error);
    }
  }

  /**
   * Private Methods
   */

  private createLogEntry(
    level: LogLevel,
    service: ServiceType,
    message: string,
    context?: Record<string, unknown>
  ): LogEntry {
    const { redactedText, redactedFields } = this.redactPII(message);
    const redactedContext = context ? this.redactContextPII(context) : undefined;

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      service,
      message: redactedText,
      context: redactedContext,
      redactedFields: redactedFields.length > 0 ? redactedFields : undefined
    };

    // Add correlation ID if available in context
    if (context?.correlationId) {
      logEntry.correlationId = context.correlationId as string;
    }

    // Add session ID if available in context
    if (context?.sessionId) {
      logEntry.sessionId = context.sessionId as string;
    }

    // Add user ID if available in context (but redact it)
    if (context?.userId) {
      logEntry.userId = '[USER-ID-REDACTED]';
    }

    // Add error-specific fields
    if (context?.category) {
      logEntry.category = context.category as ErrorCategory;
    }

    if (context?.severity) {
      logEntry.severity = context.severity as ErrorSeverity;
    }

    // Truncate if too large
    const serialized = JSON.stringify(logEntry);
    if (serialized.length > this.config.maxLogEntrySize) {
      logEntry.message = logEntry.message.substring(0, this.config.maxLogEntrySize / 2) + '...[TRUNCATED]';
      logEntry.context = { truncated: true };
    }

    return logEntry;
  }

  private redactContextPII(context: Record<string, unknown>): Record<string, unknown> {
    const redactedContext: Record<string, unknown> = {};

    Object.entries(context).forEach(([key, value]) => {
      if (typeof value === 'string') {
        const { redactedText } = this.redactPII(value);
        redactedContext[key] = redactedText;
      } else if (typeof value === 'object' && value !== null) {
        // Recursively redact nested objects
        redactedContext[key] = this.redactContextPII(value as Record<string, unknown>);
      } else {
        redactedContext[key] = value;
      }
    });

    return redactedContext;
  }

  private shouldLog(level: LogLevel): boolean {
    const levelPriority = {
      [LogLevel.DEBUG]: 0,
      [LogLevel.INFO]: 1,
      [LogLevel.WARN]: 2,
      [LogLevel.ERROR]: 3,
      [LogLevel.CRITICAL]: 4
    };

    return levelPriority[level] >= levelPriority[this.config.logLevel];
  }

  private writeLog(logEntry: LogEntry): void {
    // Add to buffer
    this.logBuffer.push(logEntry);

    // Maintain buffer size
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }

    // Console logging
    if (this.config.enableConsoleLogging) {
      this.writeToConsole(logEntry);
    }

    // Auto-flush on error or critical
    if (logEntry.level === LogLevel.ERROR || logEntry.level === LogLevel.CRITICAL) {
      // Don't await to avoid blocking
      this.flushLogs().catch(error => {
        console.error('Failed to auto-flush logs:', error);
      });
    }
  }

  private writeToConsole(logEntry: LogEntry): void {
    const logMessage = `[${logEntry.timestamp}] ${logEntry.level} ${logEntry.service}: ${logEntry.message}`;
    
    switch (logEntry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, logEntry.context);
        break;
      case LogLevel.INFO:
        console.info(logMessage, logEntry.context);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, logEntry.context);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, logEntry.context);
        break;
      case LogLevel.CRITICAL:
        console.error(`🚨 CRITICAL: ${logMessage}`, logEntry.context);
        break;
    }
  }

  private async sendLogsToRemoteService(logs: LogEntry[]): Promise<void> {
    // In a real implementation, this would integrate with:
    // - AWS CloudWatch Logs
    // - Datadog
    // - Splunk
    // - Custom logging service
    
    // For now, simulate the API call
    await new Promise(resolve => setTimeout(resolve, 100));
    
    console.log(`Sent ${logs.length} log entries to remote logging service`);
  }
}

// Global secure logger instance
export const secureLogger = new SecureLogger();

/**
 * Convenience functions for logging
 */

export function logError(
  error: EnhancedServiceError,
  context?: Record<string, unknown>
): void {
  secureLogger.logError(error, context);
}

export function logInfo(
  service: ServiceType,
  message: string,
  context?: Record<string, unknown>
): void {
  secureLogger.logInfo(service, message, context);
}

export function logWarning(
  service: ServiceType,
  message: string,
  context?: Record<string, unknown>
): void {
  secureLogger.logWarning(service, message, context);
}

export function logDebug(
  service: ServiceType,
  message: string,
  context?: Record<string, unknown>
): void {
  secureLogger.logDebug(service, message, context);
}

export function logCritical(
  service: ServiceType,
  message: string,
  context?: Record<string, unknown>
): void {
  secureLogger.logCritical(service, message, context);
}

export function redactPII(text: string): string {
  return secureLogger.redactPII(text).redactedText;
}