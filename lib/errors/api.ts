import { NextResponse } from 'next/server';
import { AppError, ErrorCode, logError } from './index';

export interface ApiErrorResponse {
  error: {
    code: string;
    message: string;
    userMessage: string;
    retryable?: boolean;
    context?: Record<string, unknown>;
  };
  timestamp: string;
}

/**
 * Standardized API error handler that converts errors to consistent API responses
 */
export function handleApiError(error: unknown, context?: Record<string, unknown>): NextResponse<ApiErrorResponse> {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else {
    // Convert unknown errors to AppError
    appError = new AppError({
      code: ErrorCode.INTERNAL_ERROR,
      message: error instanceof Error ? error.message : 'Unknown error occurred',
      cause: error,
      context,
    });
  }

  // Log the error
  logError(appError, context);

  // Return standardized error response
  const response: ApiErrorResponse = {
    error: {
      code: appError.code,
      message: appError.message,
      userMessage: appError.userMessage,
      retryable: appError.retryable,
      context: process.env.NODE_ENV === 'development' ? appError.context : undefined,
    },
    timestamp: appError.timestamp.toISOString(),
  };

  return NextResponse.json(response, { 
    status: appError.statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Wrapper for API route handlers to automatically handle errors
 */
export function withApiErrorHandling<T extends any[], R>(
  handler: (...args: T) => Promise<NextResponse<R>>
) {
  return async (...args: T): Promise<NextResponse<R | ApiErrorResponse>> => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error, {
        handler: handler.name,
      });
    }
  };
}

/**
 * Validates request body using Zod schema and throws AppError on validation failure
 */
export function validateRequestBody<T>(data: unknown, schema: any): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      throw new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Request validation failed: ${error.message}`,
        userMessage: 'Invalid request data. Please check your input.',
        cause: error,
        statusCode: 400,
      });
    }
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Invalid request body',
      userMessage: 'Invalid request data. Please check your input.',
      cause: error,
      statusCode: 400,
    });
  }
}

/**
 * Validates query parameters using Zod schema
 */
export function validateQueryParams<T>(url: URL, schema: any): T {
  try {
    const params = Object.fromEntries(url.searchParams.entries());
    return schema.parse(params);
  } catch (error) {
    if (error instanceof Error && 'issues' in error) {
      throw new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: `Query parameter validation failed: ${error.message}`,
        userMessage: 'Invalid query parameters. Please check your request.',
        cause: error,
        statusCode: 400,
      });
    }
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Invalid query parameters',
      userMessage: 'Invalid query parameters. Please check your request.',
      cause: error,
      statusCode: 400,
    });
  }
}

/**
 * Helper to ensure user authentication in API routes
 */
export function requireAuth(user: any): void {
  if (!user) {
    throw new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Authentication required',
      userMessage: 'Please log in to continue',
      statusCode: 401,
    });
  }
}

/**
 * Helper to check user permissions
 */
export function requirePermission(condition: boolean, message = 'Insufficient permissions'): void {
  if (!condition) {
    throw new AppError({
      code: ErrorCode.FORBIDDEN,
      message,
      userMessage: 'You do not have permission to perform this action',
      statusCode: 403,
    });
  }
}
