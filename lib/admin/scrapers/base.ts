import type { AdminScrapeProgressPayload } from '@/types/events';

export const ATS_TYPES = {
  ASHBY: 'ASHBY',
  GREENHOUSE: 'GREENHOUSE',
  LEVER: 'LEVER',
} as const;

export type ATSType = (typeof ATS_TYPES)[keyof typeof ATS_TYPES];

export interface AtsScraperFetchContext {
  insertAnyway?: boolean;
  maxPages: number;
  mode: 'sync' | 'weekly' | 'backfill';
  scrapeId: string;
  searchTerm?: string;
  startedAt: string;
  userId: string;
}

export interface AtsScraperResult {
  apiRequests: number;
  created: number;
  fetched: number;
  metadata?: Record<string, unknown>;
  recentCreatedListings?: AdminScrapeProgressPayload['recentCreatedListings'];
  recentUpdatedListings?: AdminScrapeProgressPayload['recentUpdatedListings'];
  skipped: number;
  updated: number;
}

const ATS_SLUG_PATTERN = /^[a-zA-Z0-9_-]+$/;

export class InvalidSlugError extends Error {
  readonly slug: string;

  constructor(slug: string) {
    super(`Invalid ATS slug: ${slug}`);
    this.name = 'InvalidSlugError';
    this.slug = slug;
  }
}

export const validateAtsSlug = (slug: string): string => {
  if (ATS_SLUG_PATTERN.test(slug)) {
    return slug;
  }

  throw new InvalidSlugError(slug);
};

export abstract class BaseScraper {
  abstract readonly ats: ATSType;

  abstract fetch(context: AtsScraperFetchContext): Promise<AtsScraperResult>;
}
