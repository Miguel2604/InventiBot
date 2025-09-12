/**
 * Structured logger for better visibility in Render and other log aggregation services
 */

type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

interface LogContext {
  [key: string]: any;
}

class Logger {
  private serviceName: string;
  private isDevelopment: boolean;

  constructor(serviceName: string) {
    this.serviceName = serviceName;
    this.isDevelopment = process.env.NODE_ENV === 'development' || process.env.DEBUG === 'true';
  }

  private formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      service: this.serviceName,
      message,
      ...context
    };

    if (this.isDevelopment) {
      // In development, use a more readable format
      const contextStr = context ? ` | ${JSON.stringify(context)}` : '';
      return `[${timestamp}] [${level}] [${this.serviceName}] ${message}${contextStr}`;
    } else {
      // In production (Render), use JSON format for better parsing
      return JSON.stringify(logData);
    }
  }

  debug(message: string, context?: LogContext): void {
    if (this.isDevelopment) {
      console.log(this.formatLog('DEBUG', message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    console.log(this.formatLog('INFO', message, context));
  }

  warn(message: string, context?: LogContext): void {
    console.warn(this.formatLog('WARN', message, context));
  }

  error(message: string, error?: Error | any, context?: LogContext): void {
    const errorContext = {
      ...context,
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error
    };
    console.error(this.formatLog('ERROR', message, errorContext));
  }

  // Special method for auth logging with masking
  authLog(action: string, senderId: string, code?: string, success?: boolean, details?: any): void {
    const maskedCode = code ? `${code.substring(0, 3)}***` : undefined;
    this.info(`Auth: ${action}`, {
      action,
      senderId,
      code: maskedCode,
      success,
      ...details
    });
  }

  // Special method for webhook events
  webhookLog(eventType: string, senderId: string, payload?: string, text?: string): void {
    this.info('Webhook event', {
      eventType,
      senderId,
      payload,
      text: text ? text.substring(0, 100) : undefined
    });
  }

  // Database operation logging
  dbLog(operation: string, table: string, success: boolean, error?: any, details?: any): void {
    const message = `DB ${operation} on ${table}`;
    
    if (success) {
      this.info(message, { operation, table, ...details });
    } else {
      this.error(message, error, { operation, table, ...details });
    }
  }
}

// Create singleton instances for different services
export const authLogger = new Logger('AUTH');
export const webhookLogger = new Logger('WEBHOOK');
export const dbLogger = new Logger('DATABASE');
export const facebookLogger = new Logger('FACEBOOK');
export const mainLogger = new Logger('MAIN');

// Default export for general use
export default Logger;
