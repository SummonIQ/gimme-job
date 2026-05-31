/**
 * Rate limiting utilities for APIs and server actions
 *
 * Features:
 * - Config-driven presets from applab.config.ts
 * - Multiple storage backends (KV, memory, database)
 * - User-based or IP-based rate limiting
 * - Standard rate limit headers
 * - Graceful degradation
 */

import config from '@/applab.config';
import { getStorage } from './kv';

export interface RateLimitConfig {
  /**
   * Unique identifier for the rate limit bucket
   * Examples: 'api:linkedin:search', 'user:123:resumes'
   */
  key: string;

  /**
   * Maximum number of requests allowed
   */
  limit: number;

  /**
   * Time window in seconds
   */
  window: number;

  /**
   * Optional: custom identifier (defaults to user ID or IP)
   */
  identifier?: string;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

const getRateLimitSettings = () => {
  const rateLimitConfig = (config as any)?.rateLimit as
    | {
        enabled?: boolean;
        presets?: Record<
          string,
          {
            key: string;
            limit: number;
            window: number;
          }
        >;
      }
    | undefined;

  return {
    enabled: rateLimitConfig?.enabled === true,
    presets: rateLimitConfig?.presets ?? {},
  };
};

/**
 * Core rate limiter with sliding window
 */
export async function rateLimit(
  rateLimitConfig: RateLimitConfig,
): Promise<RateLimitResult> {
  const settings = getRateLimitSettings();
  if (!settings.enabled) {
    return {
      success: true,
      limit: rateLimitConfig.limit,
      remaining: rateLimitConfig.limit,
      reset: Date.now() + rateLimitConfig.window * 1000,
    };
  }

  const { key, limit, window, identifier } = rateLimitConfig;

  // Create unique key with identifier
  const rateLimitKey = identifier
    ? `ratelimit:${key}:${identifier}`
    : `ratelimit:${key}`;

  const now = Date.now();
  const reset = now + window * 1000;

  try {
    const storage = getStorage();

    // Increment counter
    const count = await storage.increment(rateLimitKey, window);

    const remaining = Math.max(0, limit - count);

    if (count > limit) {
      return {
        success: false,
        limit,
        remaining: 0,
        reset,
        retryAfter: Math.ceil(window),
      };
    }

    return {
      success: true,
      limit,
      remaining,
      reset,
    };
  } catch (error) {
    console.error('[Rate Limit] Error:', error);
    // Fail open - allow request if rate limiting fails
    return {
      success: true,
      limit,
      remaining: limit,
      reset,
    };
  }
}

/**
 * Apply multiple rate limits (e.g., both per-minute and per-hour)
 */
export async function rateLimitMultiple(
  configs: RateLimitConfig[],
): Promise<RateLimitResult> {
  const results = await Promise.all(configs.map(rateLimit));

  // Return the most restrictive result
  const failed = results.find(r => !r.success);
  if (failed) return failed;

  // Return the result with the least remaining requests
  return results.reduce((min, curr) =>
    curr.remaining < min.remaining ? curr : min,
  );
}

/**
 * Get preset configuration from applab.config.ts
 */
export function getPreset(presetName: string): RateLimitConfig {
  const settings = getRateLimitSettings();
  const preset = settings.presets[presetName];

  if (!preset) {
    console.warn(
      `[Rate Limit] Preset "${String(presetName)}" not found in applab.config.ts; allowing request without rate limiting.`,
    );
    return {
      key: `missing-preset:${String(presetName)}`,
      limit: 1_000_000,
      window: 60,
    };
  }

  return {
    key: preset.key,
    limit: preset.limit,
    window: preset.window,
  };
}

/**
 * Get preset with custom identifier
 */
export function getPresetWithIdentifier(
  presetName: string,
  identifier: string,
): RateLimitConfig {
  return {
    ...getPreset(presetName),
    identifier,
  };
}

/**
 * Manually reset a rate limit (useful for testing or admin actions)
 */
export async function resetRateLimit(
  key: string,
  identifier?: string,
): Promise<void> {
  const rateLimitKey = identifier
    ? `ratelimit:${key}:${identifier}`
    : `ratelimit:${key}`;
  const storage = getStorage();
  await storage.reset(rateLimitKey);
}

// Re-export types
export type { RateLimitStorage } from './kv';
