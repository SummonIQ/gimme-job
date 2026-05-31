import {
  ApplicationStatus,
  JobLeadStatus,
  JobListingStatus,
  JobType,
  Prisma,
} from '@/generated/prisma/browser';
import type { CachedJobSearch } from '@/lib/cache/job-search-cache';
import {
  generateSearchCacheKey,
  getCachedJobSearch,
  setCachedJobSearch,
} from '@/lib/cache/job-search-cache';
import { db } from '@/lib/db/client';
import type { JobSearchSort } from './search-types';

export { isJobSearchSort } from './search-types';
export type { JobSearchSort } from './search-types';

const JOB_TYPE_MAP: Record<string, JobType> = {
  fulltime: JobType.FULL_TIME,
  parttime: JobType.PART_TIME,
  contract: JobType.CONTRACT,
  internship: JobType.INTERNSHIP,
};

/**
 * Interleave jobs from different providers within each day so no single
 * provider dominates a page. Jobs are grouped by day, then within each day
 * providers are round-robined so they alternate.
 */
function interleaveByProvider<
  T extends { createdAt: Date | string; jobProvider?: string | null },
>(jobs: T[]): T[] {
  if (jobs.length <= 1) return jobs;

  const dayBuckets = new Map<string, T[]>();
  const dayOrder: string[] = [];
  const seen = new Set<string>();

  for (const job of jobs) {
    const date = new Date(job.createdAt);
    const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const bucket = dayBuckets.get(dayKey);
    if (bucket) {
      bucket.push(job);
    } else {
      dayBuckets.set(dayKey, [job]);
    }
    if (!seen.has(dayKey)) {
      seen.add(dayKey);
      dayOrder.push(dayKey);
    }
  }

  const interleaved: T[] = [];
  for (const dayKey of dayOrder) {
    const dayJobs = dayBuckets.get(dayKey) ?? [];
    const providerQueues = new Map<string, T[]>();

    for (const job of dayJobs) {
      const provider = job.jobProvider ?? 'unknown';
      const queue = providerQueues.get(provider);
      if (queue) {
        queue.push(job);
      } else {
        providerQueues.set(provider, [job]);
      }
    }

    const queues = Array.from(providerQueues.values());
    let added = true;
    while (added) {
      added = false;
      for (const queue of queues) {
        if (queue.length > 0) {
          interleaved.push(queue.shift()!);
          added = true;
        }
      }
    }
  }

  return interleaved;
}

function hasMeaningfulDescription(description: string | null | undefined): boolean {
  return Boolean(
    description && description.trim() && description !== 'No description provided',
  );
}

function hasApplyOptions(applyOptions: Prisma.JsonValue | null | undefined): boolean {
  return Array.isArray(applyOptions) && applyOptions.length > 0;
}

function prioritizeRecentJobs<
  T extends {
    applyOptions?: Prisma.JsonValue | null;
    createdAt: Date | string;
    description?: string | null;
    postedAt?: Date | string | null;
  },
>(jobs: T[]): T[] {
  return [...jobs].sort((left, right) => {
    const leftQuality =
      Number(hasApplyOptions(left.applyOptions)) +
      Number(hasMeaningfulDescription(left.description));
    const rightQuality =
      Number(hasApplyOptions(right.applyOptions)) +
      Number(hasMeaningfulDescription(right.description));

    if (leftQuality !== rightQuality) {
      return rightQuality - leftQuality;
    }

    const createdDiff =
      new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    if (createdDiff !== 0) {
      return createdDiff;
    }

    return (
      new Date(right.postedAt ?? 0).getTime() -
      new Date(left.postedAt ?? 0).getTime()
    );
  });
}

export interface SearchJobListingsParams {
  userId: string;
  search?: string;
  location?: string;
  jobType?: string;
  postedWithin?: string;
  remote?: boolean;
  savedOnly?: boolean;
  dismissedOnly?: boolean;
  excludeApplied?: boolean;
  excludeDismissed?: boolean;
  excludeLeads?: boolean;
  minSalary?: string;
  maxSalary?: string;
  sort?: JobSearchSort;
  page?: number;
  pageSize?: number;
  noCache?: boolean;
  includeCount?: boolean;
  knownTotal?: number | null;
  knownPageCount?: number | null;
}

const JOB_LISTING_SEARCH_SELECT = {
  id: true,
  title: true,
  company: true,
  companyLogoUrl: true,
  location: true,
  salary: true,
  description: true,
  jobType: true,
  jobProvider: true,
  jobProviderUrl: true,
  applyOptions: true,
  remote: true,
  saved: true,
  status: true,
  source: true,
  postedAt: true,
  createdAt: true,
  updatedAt: true,
  healthInsurance: true,
  dentalCoverage: true,
  paidTimeOff: true,
  workFromHome: true,
  scheduleType: true,
  userId: true,
  jobId: true,
} satisfies Prisma.JobListingSelect;

export async function searchJobListings(
  params: SearchJobListingsParams,
): Promise<CachedJobSearch> {
  const {
    userId,
    search = '',
    location = '',
    jobType = 'any',
    postedWithin = 'any',
    remote = false,
    savedOnly = false,
    dismissedOnly = false,
    excludeApplied = false,
    excludeDismissed = true,
    excludeLeads = false,
    minSalary = '',
    maxSalary = '',
    sort = 'recent',
    page = 1,
    pageSize = 25,
    noCache = false,
    includeCount = true,
    knownTotal = null,
    knownPageCount = null,
  } = params;

  const skip = (page - 1) * pageSize;

  // Generate cache key
  const cacheKey = `v3:${generateSearchCacheKey({
    search,
    location,
    jobType,
    postedWithin,
    sort,
    remote,
    savedOnly,
    excludeApplied,
    excludeDismissed,
    excludeLeads,
    minSalary,
    maxSalary,
    page,
    pageSize,
  })}`;

  // Try cache first (only if noCache is not set)
  if (!noCache) {
    try {
      const cached = await getCachedJobSearch(cacheKey);
      if (cached) return cached;
    } catch {
      // Cache failed, continue without cache
    }
  }

  // Build where clause
  const where: any = { userId };

  // Search in title, company, and description
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { company: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }

  // Location filter - extract city name for more flexible matching
  if (location) {
    const cityName = location.split(',')[0].trim();
    where.location = { contains: cityName, mode: 'insensitive' };
  }

  // Remote filter
  if (remote) {
    where.remote = true;
  }

  // Job type filter - map UI values to Prisma enum
  if (jobType !== 'any') {
    const mapped = JOB_TYPE_MAP[jobType];
    if (mapped) {
      where.jobType = mapped;
    }
  }

  // Status filters
  if (dismissedOnly) {
    where.status = JobListingStatus.DISMISSED;
  } else if (excludeDismissed) {
    where.status = { not: JobListingStatus.DISMISSED };
  }

  if (savedOnly) {
    where.saved = true;
  }

  if (excludeLeads) {
    where.lead = { is: null };
  } else if (excludeApplied) {
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { lead: { is: null } },
          {
            lead: {
              is: {
                applicationSubmissions: {
                  none: { status: { not: ApplicationStatus.FAILED } },
                },
                status: { not: JobLeadStatus.APPLIED },
              },
            },
          },
        ],
      },
    ];
  }

  // Posted within filter
  if (postedWithin !== 'any') {
    const days = parseInt(postedWithin);
    const date = new Date();
    date.setDate(date.getDate() - days);
    where.AND = [
      ...(where.AND ?? []),
      {
        OR: [
          { postedAt: { gte: date } },
          { postedAt: null, createdAt: { gte: date } },
        ],
      },
    ];
  }

  const orderBy: Prisma.JobListingOrderByWithRelationInput[] = (() => {
    switch (sort) {
      case 'oldest':
        return [
          { createdAt: 'asc' },
          { postedAt: { sort: 'asc', nulls: 'last' } },
        ];
      case 'added':
        return [{ createdAt: 'desc' }];
      case 'company':
        return [
          { company: 'asc' },
          { postedAt: 'desc' },
          { createdAt: 'desc' },
        ];
      case 'title':
        return [{ title: 'asc' }, { postedAt: 'desc' }, { createdAt: 'desc' }];
      case 'recent':
      default:
        return [
          { createdAt: 'desc' },
          { postedAt: { sort: 'desc', nulls: 'last' } },
        ];
    }
  })();

  // For recent sort: fetch extra so we can keep the newest listings first while
  // pushing low-quality rows down when they lack apply options or descriptions.
  const isRecentSort = sort === 'recent' || !sort;
  const shouldPrioritizeRecent = isRecentSort;
  const overfetchMultiplier = shouldPrioritizeRecent ? 4 : 1;

  const rawJobs = await db.jobListing.findMany({
    where,
    orderBy,
    take: pageSize * overfetchMultiplier,
    skip: shouldPrioritizeRecent ? 0 : skip,
    select: JOB_LISTING_SEARCH_SELECT,
  });

  const total =
    includeCount || knownTotal === null
      ? await db.jobListing.count({ where })
      : knownTotal;

  const pageCount =
    includeCount || knownPageCount === null
      ? Math.ceil(total / pageSize)
      : knownPageCount;

  const jobs = shouldPrioritizeRecent
    ? prioritizeRecentJobs(rawJobs).slice(skip, skip + pageSize)
    : rawJobs;

  const response: CachedJobSearch = {
    data: jobs,
    pageInfo: {
      count: jobs.length,
      total,
      pageCount,
    },
    timestamp: Date.now(),
  };

  // Cache the results for 15 minutes (900 seconds).
  // Do not cache responses that rely on client-provided totals.
  if (includeCount) {
    try {
      await setCachedJobSearch(cacheKey, response, 900);
    } catch {
      // ignore
    }
  }

  return response;
}
