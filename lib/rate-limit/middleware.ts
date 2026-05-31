/**
 * Rate limit middleware for API routes
 */

import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';
import { getPresetWithIdentifier, rateLimit, RateLimitConfig } from './index';

export interface RateLimitMiddlewareConfig extends Partial<
  Omit<RateLimitConfig, 'identifier'>
> {
  /**
   * Whether to use user ID (true) or IP address (false)
   * @default true
   */
  useUserId?: boolean;

  /**
   * Custom error message
   */
  message?: string;

  /**
   * Use a preset from applab.config.ts
   */
  preset?: string;
}

/**
 * Rate limit middleware for API routes
 *
 * Usage:
 * ```ts
 * const rateLimitError = await withRateLimit(request, { preset: 'linkedinSearch' });
 * if (rateLimitError) return rateLimitError;
 * ```
 */
export async function withRateLimit(
  request: NextRequest,
  rateLimitConfig: RateLimitMiddlewareConfig,
): Promise<NextResponse | null> {
  // TEMPORARY: rate limiting disabled per request
  return null;

  const {
    useUserId = true,
    message,
    preset,
    ...customConfig
  } = rateLimitConfig;

  let identifier: string;

  if (useUserId) {
    const user = await getCurrentUser();
    if (!user) {
      // If no user and we need user ID, return 401
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    identifier = user.id;
  } else {
    // Use IP address
    const forwardedFor = request.headers.get('x-forwarded-for');
    const firstForwardedIp = forwardedFor
      ? forwardedFor.split(',')[0]?.trim()
      : undefined;

    identifier =
      firstForwardedIp ||
      request.headers.get('x-real-ip') ||
      request.headers.get('cf-connecting-ip') ||
      'anonymous';
  }

  // Get config from preset or custom
  const rateLimitConfigToUse: RateLimitConfig = preset
    ? getPresetWithIdentifier(preset, identifier)
    : ({ ...customConfig, identifier } as RateLimitConfig);

  const result = await rateLimit(rateLimitConfigToUse);

  // Add rate limit headers
  const headers = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': new Date(result.reset).toISOString(),
  };

  if (!result.success) {
    return NextResponse.json(
      {
        error: message || 'Too many requests. Please try again later.',
        retryAfter: result.retryAfter,
        limit: result.limit,
        reset: new Date(result.reset).toISOString(),
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': result.retryAfter?.toString() || '60',
        },
      },
    );
  }

  // Return null to indicate success
  // Headers should be added to the final response
  return null;
}

/**
 * Helper to add rate limit headers to a successful response
 */
export function addRateLimitHeaders(
  response: NextResponse,
  result: { limit: number; remaining: number; reset: number },
): NextResponse {
  response.headers.set('X-RateLimit-Limit', result.limit.toString());
  response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
  response.headers.set(
    'X-RateLimit-Reset',
    new Date(result.reset).toISOString(),
  );
  return response;
}

/**
 * IP-based rate limiting (useful for public endpoints)
 */
export async function withIpRateLimit(
  request: NextRequest,
  rateLimitConfig: Omit<RateLimitMiddlewareConfig, 'useUserId'>,
): Promise<NextResponse | null> {
  return withRateLimit(request, { ...rateLimitConfig, useUserId: false });
}
