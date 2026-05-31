/**
 * Rate limiting for Server Actions
 */

import { getCurrentUser } from '@/lib/user/query';
import { rateLimit, RateLimitConfig, getPreset, getPresetWithIdentifier } from './index';
import config from '@/applab.config';

export class RateLimitError extends Error {
  constructor(
    message: string,
    public retryAfter: number,
    public limit: number,
    public remaining: number,
    public reset: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }

  toJSON() {
    return {
      error: this.message,
      retryAfter: this.retryAfter,
      limit: this.limit,
      remaining: this.remaining,
      reset: new Date(this.reset).toISOString(),
    };
  }
}

export interface ServerActionRateLimitConfig {
  /**
   * Whether to use user ID (true) or global (false)
   * @default true
   */
  useUserId?: boolean;

  /**
   * Explicit identifier (overrides user/global resolution)
   */
  identifier?: string;

  /**
   * Custom error message
   */
  message?: string;

  /**
   * Use a preset from applab.config.ts
   */
  preset?: keyof typeof config.rateLimit.presets;

  /**
   * Custom rate limit config (if not using preset)
   */
  custom?: Omit<RateLimitConfig, 'identifier'>;
}

/**
 * Rate limiter for server actions
 *
 * Usage:
 * ```ts
 * 'use server';
 *
 * export async function createResume(data: any) {
 *   await rateLimitServerAction({ preset: 'createResume' });
 *   // ... rest of function
 * }
 * ```
 */
export async function rateLimitServerAction(rateLimitConfig: ServerActionRateLimitConfig): Promise<void> {
  const { useUserId = true, message, preset, custom, identifier: explicitIdentifier } = rateLimitConfig;

  let identifier: string;

  if (explicitIdentifier) {
    identifier = explicitIdentifier;
  } else if (useUserId) {
    const user = await getCurrentUser();
    if (!user) {
      throw new Error('Unauthorized');
    }
    identifier = user.id;
  } else {
    identifier = 'global';
  }

  // Get config from preset or custom
  const rateLimitConfigToUse: RateLimitConfig = preset
    ? getPresetWithIdentifier(preset, identifier)
    : custom
      ? { ...custom, identifier }
      : (() => {
          throw new Error('Either preset or custom config must be provided');
        })();

  const result = await rateLimit(rateLimitConfigToUse);

  if (!result.success) {
    throw new RateLimitError(
      message || 'Too many requests. Please try again later.',
      result.retryAfter || 60,
      result.limit,
      result.remaining,
      result.reset
    );
  }
}

/**
 * Wrapper for server actions with automatic error handling
 *
 * Usage:
 * ```ts
 * export const createResume = withRateLimit(
 *   { preset: 'createResume' },
 *   async (data: any) => {
 *     // ... implementation
 *   }
 * );
 * ```
 */
export function withRateLimit<TArgs extends unknown[], TReturn>(
  rateLimitConfig: ServerActionRateLimitConfig,
  fn: (...args: TArgs) => Promise<TReturn>
): (...args: TArgs) => Promise<TReturn | { error: string; rateLimitError: ReturnType<RateLimitError['toJSON']> }> {
  return async (...args: TArgs) => {
    try {
      await rateLimitServerAction(rateLimitConfig);
      return await fn(...args);
    } catch (error) {
      if (error instanceof RateLimitError) {
        return {
          error: error.message,
          rateLimitError: error.toJSON(),
        };
      }
      throw error;
    }
  };
}
