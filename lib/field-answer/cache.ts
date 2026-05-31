/**
 * Resolver in-memory cache primitives. Lives in its own module (with zero
 * dependencies on the rest of the codebase) so any data-mutation site can
 * invalidate without creating an import cycle through resolve.ts. The cache
 * itself stores Promises keyed by `${slice}:${userId}` or
 * `${slice}:${userId}:${extra}` — see `withCache` in resolve.ts for
 * read/write semantics.
 */
const RESOLVE_CACHE_TTL_MS = 60_000;

interface CachedPromise<T> {
  readonly promise: Promise<T>;
  readonly expiresAt: number;
}

export const resolveCache = new Map<string, CachedPromise<unknown>>();

export const RESOLVE_CACHE_TTL = RESOLVE_CACHE_TTL_MS;

/**
 * Invalidate any cached resolver data for a single user. Call this from any
 * endpoint that mutates user-scoped state the resolver depends on (profile
 * edits, knowledge edits, field-rule add/delete, resume swap) so the next
 * resolveFieldAnswer call sees fresh data without waiting up to 60s for
 * the TTL.
 */
export function invalidateResolverCacheForUser(userId: string): void {
  for (const key of resolveCache.keys()) {
    // Keys are `${slice}:${userId}` or `${slice}:${userId}:${extra}` —
    // userId is always the second segment.
    const segments = key.split(':');
    if (segments[1] === userId) resolveCache.delete(key);
  }
}

/**
 * Invalidate just one named slice of a user's cached data.
 */
export function invalidateResolverCacheSlice(
  userId: string,
  slice: 'user' | 'knowledge' | 'employment' | 'resume' | 'job' | 'fieldRules',
): void {
  const prefix = `${slice}:${userId}`;
  for (const key of resolveCache.keys()) {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      resolveCache.delete(key);
    }
  }
}
