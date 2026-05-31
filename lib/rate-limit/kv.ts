/**
 * KV Storage adapter for rate limiting
 *
 * Uses REDIS_URL from environment variables
 * Supports both Vercel KV (Upstash) and standard Redis (via ioredis)
 */

import { createClient } from '@vercel/kv';
import Redis from 'ioredis';
import config from '@/applab.config';

const redisUrl = process.env.REDIS_URL;
const isStandardRedis =
  redisUrl?.startsWith('redis://') || redisUrl?.startsWith('rediss://');

// Initialize clients based on URL scheme
let kv: ReturnType<typeof createClient> | null = null;
let redis: Redis | null = null;

if (redisUrl) {
  if (isStandardRedis) {
    try {
      // console.log('[Rate Limit] Initializing standard Redis client');
      redis = new Redis(redisUrl);

      // Handle Redis connection errors to prevent crashing
      redis.on('error', err => {
        console.error('[Rate Limit] Redis client error:', err);
      });
    } catch (error) {
      console.warn(
        '[Rate Limit] Failed to initialize standard Redis client:',
        error,
      );
    }
  } else {
    try {
      // Only attempt to create Vercel KV client if we have a URL that isn't standard Redis
      // This prevents the "Upstash Redis client was passed an invalid URL" error
      // console.log('[Rate Limit] Initializing Vercel KV client');
      kv = createClient({
        url: redisUrl,
        // Try to find token in common env vars if not explicitly passed
        token: process.env.KV_REST_API_TOKEN || process.env.REDIS_TOKEN,
      });
    } catch (error) {
      console.warn(
        '[Rate Limit] Failed to initialize Vercel KV client:',
        error,
      );
    }
  }
}

export interface RateLimitStorage {
  increment: (key: string, window: number) => Promise<number>;
  get: (key: string) => Promise<number>;
  reset: (key: string) => Promise<void>;
}

/**
 * In-memory storage (for development/fallback)
 */
const memoryStore = new Map<string, { count: number; expiry: number }>();

export const memoryStorage: RateLimitStorage = {
  async increment(key: string, window: number): Promise<number> {
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.expiry < now) {
      memoryStore.set(key, { count: 1, expiry: now + window * 1000 });
      return 1;
    }

    entry.count += 1;
    return entry.count;
  },

  async get(key: string): Promise<number> {
    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.expiry < now) {
      return 0;
    }

    return entry.count;
  },

  async reset(key: string): Promise<void> {
    memoryStore.delete(key);
  },
};

/**
 * KV-based storage using Redis (supports both Vercel KV and standard Redis)
 */
export const kvStorage: RateLimitStorage = {
  async increment(key: string, window: number): Promise<number> {
    // Case 1: Standard Redis (ioredis)
    if (redis) {
      try {
        const pipeline = redis.pipeline();
        pipeline.incr(key);
        pipeline.expire(key, window);

        const results = await pipeline.exec();
        // ioredis returns [[err, result], [err, result]]
        if (!results || results.length === 0) return 1;

        const [incrErr, incrResult] = results[0];
        if (incrErr) throw incrErr;

        return (incrResult as number) || 1;
      } catch (error) {
        console.error('[Rate Limit] Redis increment error:', error);
        // Fallback to memory on error
        return memoryStorage.increment(key, window);
      }
    }

    // Case 2: Vercel KV
    if (kv) {
      try {
        const pipeline = kv.pipeline();

        // Increment the counter
        pipeline.incr(key);

        // Set expiry if key is new
        pipeline.expire(key, window);

        const results = await pipeline.exec();
        return (results[0] as number) || 1;
      } catch (error) {
        console.error('[Rate Limit] KV increment error:', error);
        // Fallback to memory on error
        return memoryStorage.increment(key, window);
      }
    }

    // Fallback if no client configured
    // console.warn('[Rate Limit] No Redis client configured, falling back to memory storage');
    return memoryStorage.increment(key, window);
  },

  async get(key: string): Promise<number> {
    // Case 1: Standard Redis (ioredis)
    if (redis) {
      try {
        const count = await redis.get(key);
        return count ? parseInt(count, 10) : 0;
      } catch (error) {
        console.error('[Rate Limit] Redis get error:', error);
        return 0;
      }
    }

    // Case 2: Vercel KV
    if (kv) {
      try {
        const count = await kv.get<number>(key);
        return count || 0;
      } catch (error) {
        console.error('[Rate Limit] KV get error:', error);
        return 0;
      }
    }

    return memoryStorage.get(key);
  },

  async reset(key: string): Promise<void> {
    // Case 1: Standard Redis (ioredis)
    if (redis) {
      try {
        await redis.del(key);
        return;
      } catch (error) {
        console.error('[Rate Limit] Redis reset error:', error);
      }
    }

    // Case 2: Vercel KV
    if (kv) {
      try {
        await kv.del(key);
        return;
      } catch (error) {
        console.error('[Rate Limit] KV reset error:', error);
      }
    }

    // Always clean memory storage too just in case
    return memoryStorage.reset(key);
  },
};

/**
 * Get storage adapter based on config
 */
export function getStorage(): RateLimitStorage {
  if (!config.rateLimit.enabled) {
    // Return a no-op storage that always allows requests
    return {
      increment: async () => 0,
      get: async () => 0,
      reset: async () => {},
    };
  }

  switch (config.rateLimit.storage) {
    case 'kv':
      return kvStorage;
    case 'memory':
      return memoryStorage;
    case 'database':
      // TODO: Implement database storage if needed
      console.warn(
        '[Rate Limit] Database storage not implemented yet, falling back to memory',
      );
      return memoryStorage;
    default:
      return kvStorage;
  }
}
