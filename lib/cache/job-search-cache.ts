import type { JobListing } from '@/generated/prisma/browser';
import { kv } from './kv-config';

/**
 * Feature flag to enable/disable job search caching
 * Set ENABLE_JOB_SEARCH_CACHE=false in .env to disable caching
 */
const isJobSearchCacheEnabled = process.env.ENABLE_JOB_SEARCH_CACHE !== 'false';

/**
 * Vercel KV Configuration:
 *
 * Required environment variables (set in Vercel Dashboard or .env):
 * - KV_REST_API_URL: Your KV store REST API URL
 * - KV_REST_API_TOKEN: Your KV store REST API token
 *
 * Or if using Vercel Blob with KV capabilities:
 * - BLOB_READ_WRITE_TOKEN: Your Blob storage token
 */

/** Fields returned by the jobs list API (excludes heavy array/JSON fields) */
export type JobListingCardData = Pick<
  JobListing,
  | 'id'
  | 'title'
  | 'company'
  | 'companyLogoUrl'
  | 'location'
  | 'salary'
  | 'description'
  | 'jobType'
  | 'jobProvider'
  | 'jobProviderUrl'
  | 'remote'
  | 'saved'
  | 'status'
  | 'source'
  | 'postedAt'
  | 'createdAt'
  | 'updatedAt'
  | 'healthInsurance'
  | 'dentalCoverage'
  | 'paidTimeOff'
  | 'workFromHome'
  | 'scheduleType'
  | 'userId'
  | 'jobId'
>;

export interface CachedJobSearch {
  data: JobListingCardData[];
  pageInfo: {
    count: number;
    total: number;
    pageCount: number;
  };
  timestamp: number;
}

/**
 * Get cached job search results
 */
export async function getCachedJobSearch(
  searchKey: string,
): Promise<CachedJobSearch | null> {
  if (!isJobSearchCacheEnabled || !kv) return null;
  try {
    const cached = await kv.get<CachedJobSearch>(`job-search:${searchKey}`);
    return cached;
  } catch (error) {
    // Silently fail if KV is not configured - will just skip cache
    if (process.env.NODE_ENV === 'development') {
      console.warn('Cache read skipped (KV not configured)');
    }
    return null;
  }
}

/**
 * Cache job search results with TTL
 */
export async function setCachedJobSearch(
  searchKey: string,
  data: CachedJobSearch,
  ttlSeconds: number = 900, // 15 minutes default
): Promise<void> {
  if (!isJobSearchCacheEnabled || !kv) return;
  try {
    await kv.setex(`job-search:${searchKey}`, ttlSeconds, data);
  } catch (error) {
    // Silently fail if KV is not configured - will just skip cache
    if (process.env.NODE_ENV === 'development') {
      console.warn('Cache write skipped (KV not configured)');
    }
  }
}

/**
 * Generate a consistent cache key from search parameters
 */
export function generateSearchCacheKey(params: {
  search?: string;
  location?: string;
  jobType?: string;
  postedWithin?: string;
  sort?: string;
  remote?: boolean;
  savedOnly?: boolean;
  excludeApplied?: boolean;
  excludeDismissed?: boolean;
  excludeLeads?: boolean;
  minSalary?: string;
  maxSalary?: string;
  sources?: string;
  page: number;
  pageSize: number;
}): string {
  // Normalize parameters to ensure consistent cache keys
  const normalized = {
    search: params.search?.toLowerCase().trim() || '',
    location: params.location?.toLowerCase().trim() || '',
    jobType: params.jobType || 'any',
    postedWithin: params.postedWithin || 'any',
    sort: params.sort || 'recent',
    remote: params.remote || false,
    savedOnly: params.savedOnly || false,
    excludeApplied: params.excludeApplied || false,
    excludeDismissed: params.excludeDismissed ?? true,
    excludeLeads: params.excludeLeads || false,
    minSalary: params.minSalary || '',
    maxSalary: params.maxSalary || '',
    sources: params.sources || '',
    page: params.page,
    pageSize: params.pageSize,
  };

  // Create a stable JSON string as cache key
  return JSON.stringify(normalized);
}

/**
 * Invalidate cache for a specific search
 */
export async function invalidateJobSearchCache(
  searchKey: string,
): Promise<void> {
  if (!kv) return;
  try {
    await kv.del(`job-search:${searchKey}`);
  } catch (error) {
    console.error('Cache invalidation error:', error);
  }
}

/**
 * Clear all job search caches (use sparingly)
 */
export async function clearAllJobSearchCaches(): Promise<void> {
  if (!kv) return;
  try {
    // Get all keys matching the pattern
    const keys = await kv.keys('job-search:*');
    if (keys.length > 0) {
      await kv.del(...keys);
    }
  } catch (error) {
    console.error('Cache clear error:', error);
  }
}
