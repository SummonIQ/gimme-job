import {
  ApplicationStatus,
  JobLeadStatus,
  JobListingStatus,
  JobType,
  Prisma,
} from '@/generated/prisma/browser';
import {
  generateSearchCacheKey,
  getCachedJobSearch,
  setCachedJobSearch,
} from '@/lib/cache/job-search-cache';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

const JOB_TYPE_MAP: Record<string, JobType> = {
  fulltime: JobType.FULL_TIME,
  parttime: JobType.PART_TIME,
  contract: JobType.CONTRACT,
  internship: JobType.INTERNSHIP,
};

type JobSearchSort = 'recent' | 'oldest' | 'added' | 'company' | 'title';

function isJobSearchSort(value: string | null): value is JobSearchSort {
  return (
    value === 'recent' ||
    value === 'oldest' ||
    value === 'added' ||
    value === 'company' ||
    value === 'title'
  );
}

/**
 * Interleave jobs from different providers within each day so no single
 * provider dominates a page. Jobs are grouped by day, then within each day
 * providers are round-robined so they alternate.
 */
function interleaveByProvider<T extends { createdAt: Date | string; jobProvider?: string | null }>(jobs: T[]): T[] {
  if (jobs.length <= 1) return jobs;

  // Group by date (YYYY-MM-DD)
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

  // Within each day, group by provider then round-robin
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

    // Round-robin across providers
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

export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;

    // Pagination
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '25');
    const skip = (page - 1) * pageSize;

    // Filters
    const search = searchParams.get('search') || '';
    const location = searchParams.get('location') || '';
    const jobType = searchParams.get('jobType') || 'any';
    const postedWithin = searchParams.get('postedWithin') || 'any';
    const remote = searchParams.get('remote') === 'true';
    const savedOnly = searchParams.get('savedOnly') === 'true';
    const dismissedOnly = searchParams.get('dismissedOnly') === 'true';
    const excludeApplied = searchParams.get('excludeApplied') === 'true';
    const excludeDismissed = searchParams.get('excludeDismissed') !== 'false';
    const excludeLeads = searchParams.get('excludeLeads') === 'true';
    const minSalary = searchParams.get('minSalary') || '';
    const maxSalary = searchParams.get('maxSalary') || '';
    const noCache = searchParams.get('noCache') === 'true';

    const rawSort = searchParams.get('sort');
    const sort: JobSearchSort = isJobSearchSort(rawSort) ? rawSort : 'recent';

    const includeCount = searchParams.get('includeCount') !== 'false';
    const knownTotalRaw = searchParams.get('knownTotal');
    const knownPageCountRaw = searchParams.get('knownPageCount');

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

    // Try cache first (only if KV is configured and noCache is not set)
    let cached = null;
    if (!noCache) {
      try {
        cached = await getCachedJobSearch(cacheKey);
        if (cached) {
          return NextResponse.json(cached);
        }
      } catch (cacheError) {
        // Cache failed, continue without cache
      }
    }

    // Build where clause
    const where: any = {
      userId: user.id,
    };

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

    // Job type filter - map UI values (e.g. "fulltime") to Prisma enum (e.g. FULL_TIME)
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
          return [
            { title: 'asc' },
            { postedAt: 'desc' },
            { createdAt: 'desc' },
          ];
        case 'recent':
        default:
          return [
            { createdAt: 'desc' },
            { postedAt: { sort: 'desc', nulls: 'last' } },
          ];
      }
    })();

    // For recent sort: fetch extra to enable provider interleaving, then slice
    // Skip overfetch when noCache is set (used by admin tools) to avoid slow queries
    const isRecentSort = sort === 'recent' || !sort;
    const shouldInterleave = isRecentSort && !noCache;
    const overfetchMultiplier = shouldInterleave ? 3 : 1;

    const rawJobs = await db.jobListing.findMany({
      where,
      orderBy,
      take: pageSize * overfetchMultiplier,
      skip: shouldInterleave ? 0 : skip,
      select: {
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
        // Exclude heavy fields not needed for card/table view:
        // benefits, qualifications, requirements, responsibilities,
        // extensions, detectedExtensions, applyOptions, extendedDetailsCollected
      },
    });

    const parsedKnownTotal = knownTotalRaw ? parseInt(knownTotalRaw) : NaN;
    const parsedKnownPageCount = knownPageCountRaw
      ? parseInt(knownPageCountRaw)
      : NaN;
    const knownTotal = Number.isFinite(parsedKnownTotal)
      ? parsedKnownTotal
      : null;
    const knownPageCount = Number.isFinite(parsedKnownPageCount)
      ? parsedKnownPageCount
      : null;

    const total =
      includeCount || knownTotal === null
        ? await db.jobListing.count({ where })
        : knownTotal;

    const pageCount =
      includeCount || knownPageCount === null
        ? Math.ceil(total / pageSize)
        : knownPageCount;

    // Interleave providers within each day for 'recent' sort, then slice to page
    const jobs = shouldInterleave
      ? interleaveByProvider(rawJobs).slice(skip, skip + pageSize)
      : rawJobs;

    const response = {
      data: jobs,
      pageInfo: {
        count: jobs.length,
        total,
        pageCount,
      },
      timestamp: Date.now(),
    };

    // Cache the results for 15 minutes (900 seconds) - only if KV is configured.
    // Do not cache responses that rely on client-provided totals.
    if (includeCount) {
      try {
        await setCachedJobSearch(cacheKey, response, 900);
      } catch {
        // ignore
      }
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching jobs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch jobs' },
      { status: 500 },
    );
  }
}
