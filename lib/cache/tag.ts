import { cacheTag as nextCacheTag } from 'next/cache';

/**
 * Thin wrapper around next/cache cacheTag.
 * MUST be called from inside a 'use cache' function — the tag is applied
 * to the caller's cache boundary, not a wrapper-internal one.
 */
export function cacheTag(tag: string) {
  return nextCacheTag(tag);
}
