import { z } from 'zod';

export enum ErrorCode {
  // Authentication & Authorization
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  
  // Data & Validation
  INVALID_INPUT = 'INVALID_INPUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',
  
  // External Services
  API_ERROR = 'API_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  
  // File Operations
  FILE_UPLOAD_ERROR = 'FILE_UPLOAD_ERROR',
  FILE_PROCESSING_ERROR = 'FILE_PROCESSING_ERROR',
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  UNSUPPORTED_FILE_TYPE = 'UNSUPPORTED_FILE_TYPE',
  
  // Job Operations
  JOB_SEARCH_ERROR = 'JOB_SEARCH_ERROR',
  JOB_ANALYSIS_ERROR = 'JOB_ANALYSIS_ERROR',
  JOB_APPLICATION_ERROR = 'JOB_APPLICATION_ERROR',
  
  // Database
  DATABASE_ERROR = 'DATABASE_ERROR',
  CONNECTION_ERROR = 'CONNECTION_ERROR',
  
  // AI/ML Operations
  AI_SERVICE_ERROR = 'AI_SERVICE_ERROR',
  ANALYSIS_TIMEOUT = 'ANALYSIS_TIMEOUT',
  
  // General
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

export interface AppErrorDetails {
  code: ErrorCode;
  message: string;
  userMessage?: string;
  cause?: Error | unknown;
  context?: Record<string, unknown>;
  retryable?: boolean;
  statusCode?: number;
}

export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly userMessage: string;
  public readonly cause?: Error | unknown;
  public readonly context?: Record<string, unknown>;
  public readonly retryable: boolean;
  public readonly statusCode: number;
  public readonly timestamp: Date;

  constructor(details: AppErrorDetails) {
    super(details.message);
    this.name = 'AppError';
    this.code = details.code;
    this.userMessage = details.userMessage || this.getDefaultUserMessage(details.code);
    this.cause = details.cause;
    this.context = details.context;
    this.retryable = details.retryable ?? false;
    this.statusCode = details.statusCode ?? this.getDefaultStatusCode(details.code);
    this.timestamp = new Date();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }

  private getDefaultUserMessage(code: ErrorCode): string {
    switch (code) {
      case ErrorCode.UNAUTHORIZED:
        return 'Please log in to continue.';
      case ErrorCode.FORBIDDEN:
        return 'You do not have permission to perform this action.';
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.VALIDATION_ERROR:
        return 'Please check your input and try again.';
      case ErrorCode.NOT_FOUND:
        return 'The requested resource was not found.';
      case ErrorCode.DUPLICATE_ENTRY:
        return 'This item already exists.';
      case ErrorCode.API_ERROR:
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 'Service is temporarily unavailable. Please try again later.';
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 'Too many requests. Please wait a moment and try again.';
      case ErrorCode.FILE_UPLOAD_ERROR:
        return 'Failed to upload file. Please try again.';
      case ErrorCode.FILE_PROCESSING_ERROR:
        return 'Failed to process file. Please ensure it\'s a valid format.';
      case ErrorCode.UNSUPPORTED_FILE_TYPE:
        return 'Unsupported file type. Please upload a PDF or Word document.';
      case ErrorCode.JOB_SEARCH_ERROR:
        return 'Job search failed. Please try again or adjust your search criteria.';
      case ErrorCode.JOB_ANALYSIS_ERROR:
        return 'Unable to analyze job fit. Please try again later.';
      case ErrorCode.AI_SERVICE_ERROR:
        return 'AI service is temporarily unavailable. Please try again later.';
      case ErrorCode.ANALYSIS_TIMEOUT:
        return 'Analysis is taking longer than expected. Please try again.';
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.CONNECTION_ERROR:
      case ErrorCode.INTERNAL_ERROR:
      default:
        return 'Something went wrong. Please try again later.';
    }
  }

  private getDefaultStatusCode(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.UNAUTHORIZED:
        return 401;
      case ErrorCode.FORBIDDEN:
        return 403;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.INVALID_INPUT:
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.DUPLICATE_ENTRY:
      case ErrorCode.UNSUPPORTED_FILE_TYPE:
        return 400;
      case ErrorCode.RATE_LIMIT_EXCEEDED:
        return 429;
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      case ErrorCode.API_ERROR:
      case ErrorCode.FILE_UPLOAD_ERROR:
      case ErrorCode.FILE_PROCESSING_ERROR:
      case ErrorCode.JOB_SEARCH_ERROR:
      case ErrorCode.JOB_ANALYSIS_ERROR:
      case ErrorCode.JOB_APPLICATION_ERROR:
      case ErrorCode.AI_SERVICE_ERROR:
      case ErrorCode.ANALYSIS_TIMEOUT:
      case ErrorCode.DATABASE_ERROR:
      case ErrorCode.CONNECTION_ERROR:
      case ErrorCode.INTERNAL_ERROR:
      default:
        return 500;
    }
  }

  public toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      userMessage: this.userMessage,
      context: this.context,
      retryable: this.retryable,
      statusCode: this.statusCode,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// Helper functions for common error scenarios
export function createValidationError(details: z.ZodError, context?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCode.VALIDATION_ERROR,
    message: `Validation failed: ${details.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`,
    userMessage: 'Please check your input and try again.',
    cause: details,
    context,
    statusCode: 400,
  });
}

export function createDatabaseError(cause: unknown, context?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCode.DATABASE_ERROR,
    message: 'Database operation failed',
    userMessage: 'Unable to save your changes. Please try again.',
    cause,
    context,
    retryable: true,
  });
}

export function createFileProcessingError(cause: unknown, context?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCode.FILE_PROCESSING_ERROR,
    message: 'File processing failed',
    userMessage: 'Failed to process your file. Please ensure it\'s a valid format and try again.',
    cause,
    context,
    retryable: true,
  });
}

export function createAIServiceError(cause: unknown, context?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCode.AI_SERVICE_ERROR,
    message: 'AI service request failed',
    userMessage: 'AI analysis is temporarily unavailable. Please try again later.',
    cause,
    context,
    retryable: true,
  });
}

export function createJobSearchError(cause: unknown, context?: Record<string, unknown>): AppError {
  return new AppError({
    code: ErrorCode.JOB_SEARCH_ERROR,
    message: 'Job search operation failed',
    userMessage: 'Job search failed. Please try again or adjust your search criteria.',
    cause,
    context,
    retryable: true,
  });
}

// Error logging utility
export function logError(error: AppError | Error, context?: Record<string, unknown>) {
  const errorData = {
    timestamp: new Date().toISOString(),
    error: error instanceof AppError ? error.toJSON() : {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    context,
  };

  // In development, log to console with full details
  if (process.env.NODE_ENV === 'development') {
    console.error('Error occurred:', errorData);
  } else {
    // In production, you might want to send to a logging service
    console.error('Application error:', {
      code: error instanceof AppError ? error.code : 'UNKNOWN_ERROR',
      message: error.message,
      timestamp: errorData.timestamp,
    });
  }
}

// Utility to safely handle async operations with consistent error handling
export async function withErrorHandling<T>(
  operation: () => Promise<T>,
  errorContext?: Record<string, unknown>
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof AppError) {
      logError(error, errorContext);
      throw error;
    }

    // Convert unknown errors to AppError
    const appError = new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      cause: error,
      context: errorContext,
    });

    logError(appError, errorContext);
    throw appError;
  }
}
