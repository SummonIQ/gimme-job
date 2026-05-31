import { createClient } from '@vercel/kv';
import Redis from 'ioredis';

// Check if we have the KV token (could be BLOB_READ_WRITE_TOKEN or KV_REST_API_TOKEN)
const kvToken =
  process.env.BLOB_READ_WRITE_TOKEN ||
  process.env.KV_REST_API_TOKEN ||
  process.env.REDIS_TOKEN ||
  '';

const kvUrl =
  process.env.KV_REST_API_URL ||
  process.env.KV_URL ||
  process.env.REDIS_URL ||
  '';

const isStandardRedis =
  kvUrl.startsWith('redis://') || kvUrl.startsWith('rediss://');

// Define a common interface for both clients
export interface KVClient {
  get<T>(key: string): Promise<T | null>;
  setex(key: string, seconds: number, value: any): Promise<string | null>;
  del(...keys: string[]): Promise<number>;
  keys(pattern: string): Promise<string[]>;
}

let client: KVClient | null = null;

if (kvUrl) {
  if (isStandardRedis) {
    // Standard Redis implementation via ioredis
    try {
      const redis = new Redis(kvUrl);

      // Handle Redis connection errors to prevent crashing
      redis.on('error', err => {
        console.error('[Cache] Redis client error:', err);
      });

      client = {
        async get<T>(key: string): Promise<T | null> {
          const val = await redis.get(key);
          if (!val) return null;
          try {
            return JSON.parse(val) as T;
          } catch (e) {
            return val as unknown as T;
          }
        },
        async setex(
          key: string,
          seconds: number,
          value: any,
        ): Promise<string | null> {
          const val = typeof value === 'string' ? value : JSON.stringify(value);
          return redis.setex(key, seconds, val);
        },
        async del(...keys: string[]): Promise<number> {
          if (keys.length === 0) return 0;
          return redis.del(...keys);
        },
        async keys(pattern: string): Promise<string[]> {
          return redis.keys(pattern);
        },
      };
      console.log('✅ Standard Redis configured for Cache');
    } catch (error) {
      console.warn(
        '[Cache] Failed to initialize standard Redis client:',
        error,
      );
    }
  } else if (kvToken) {
    // Vercel KV (Upstash) implementation
    try {
      const vKv = createClient({
        url: kvUrl,
        token: kvToken,
      });

      client = {
        async get<T>(key: string): Promise<T | null> {
          return vKv.get<T>(key);
        },
        async setex(
          key: string,
          seconds: number,
          value: any,
        ): Promise<string | null> {
          return vKv.setex(key, seconds, value);
        },
        async del(...keys: string[]): Promise<number> {
          return vKv.del(...keys);
        },
        async keys(pattern: string): Promise<string[]> {
          return vKv.keys(pattern);
        },
      };
      console.log('✅ Vercel KV configured for Cache');
    } catch (error) {
      console.warn('[Cache] Failed to initialize Vercel KV client:', error);
    }
  }
}

export const kv = client;

// Check if KV is available
export const isKVAvailable = !!kv;

// Log configuration status
if (!isKVAvailable) {
  console.warn(
    '⚠️  Cache storage not configured. Set KV_REST_API_URL/TOKEN or REDIS_URL environment variables.',
  );
}
