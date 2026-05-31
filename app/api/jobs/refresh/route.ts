import { db } from '@/lib/db/client';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { parseRelativeTimeToDate } from '@/lib/time';
import { getCurrentUser } from '@/lib/user/query';
import type { SerpApiJobSearchResultsResponse } from '@/types/api/serp-api';
import { JobProvider, JobType, type Prisma } from '@/generated/prisma/browser';
import { NextRequest, NextResponse } from 'next/server';
import { getJson } from 'serpapi';

const SERPAPI_DEFAULT_LOCATION = 'United States';

function getJobType(scheduleType?: string) {
  switch (scheduleType) {
    case 'Full-time':
      return JobType.FULL_TIME;
    case 'Part-time':
      return JobType.PART_TIME;
    case 'Full-time and Part-time':
      return JobType.FULL_TIME_AND_PART_TIME;
    default:
      return JobType.UNKNOWN;
  }
}

async function fetchSerpApiPage(
  params: Record<string, string>,
): Promise<SerpApiJobSearchResultsResponse> {
  const data = (await getJson(params)) as SerpApiJobSearchResultsResponse;
  return data;
}

function resolveChipsDatePosted(raw: string | null): string | undefined {
  if (!raw) return 'week';

  const normalized = raw.trim().toLowerCase();
  if (!normalized || normalized === 'any') return 'week';

  if (
    normalized === 'today' ||
    normalized === '3days' ||
    normalized === 'week' ||
    normalized === 'month'
  ) {
    return normalized;
  }

  const days = Number.parseInt(normalized, 10);
  if (!Number.isFinite(days)) return 'week';

  if (days <= 1) return 'today';
  if (days <= 3) return '3days';
  if (days <= 7) return 'week';
  return 'month';
}

export async function POST(request: NextRequest) {
  const rateLimitError = await withRateLimit(request, {
    preset: 'serpApiSearch',
    message: 'Too many job refresh requests. Please wait before trying again.',
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const rawQ = searchParams.get('q') || '';
    const q = rawQ.trim() ? rawQ.trim() : 'jobs';
    const remote = searchParams.get('remote') === 'true';
    const pages = Math.min(
      Math.max(parseInt(searchParams.get('pages') || '3'), 1),
      10,
    );
    const chipsDatePosted = resolveChipsDatePosted(
      searchParams.get('postedWithin'),
    );

    const serpApiKey = process.env.SERP_API_SECRET;
    if (!serpApiKey) {
      return NextResponse.json(
        { error: 'API configuration error' },
        { status: 500 },
      );
    }

    const location = searchParams.get('location') || undefined;
    let nextPageToken: string | undefined;
    const collected: Array<Prisma.JobListingCreateManyInput> = [];

    for (let page = 1; page <= pages; page++) {
      const params: Record<string, string> = {
        engine: 'google_jobs',
        q,
        api_key: serpApiKey,
        google_domain: 'google.com',
        no_cache: 'true',
        location: location || SERPAPI_DEFAULT_LOCATION,
        hl: 'en',
      };

      if (chipsDatePosted) {
        params.chips_date_posted = chipsDatePosted;
      }

      if (remote) {
        params.ltype = '1';
      }

      if (nextPageToken) {
        params.next_page_token = nextPageToken;
      }

      const data = await fetchSerpApiPage(params);

      if (data?.error) {
        const rawError = String(data.error);
        // SerpAPI returns this for valid queries with 0 results. Treat it as a successful refresh.
        if (
          rawError.toLowerCase().includes("google hasn't returned any results")
        ) {
          return NextResponse.json({
            createdCount: 0,
            refreshedCount: 0,
            totalFetched: 0,
            q,
            chipsDatePosted,
            location: location || SERPAPI_DEFAULT_LOCATION,
            remote,
          });
        }

        throw new Error(rawError);
      }

      const jobsResults = Array.isArray(data?.jobs_results)
        ? data.jobs_results
        : [];
      for (const job of jobsResults) {
        const detectedExtensions = job.detected_extensions ?? {};
        const postedAt = detectedExtensions.posted_at
          ? parseRelativeTimeToDate(String(detectedExtensions.posted_at))
          : null;

        const rawJobId =
          typeof job.job_id === 'string' && job.job_id.trim()
            ? job.job_id.trim()
            : undefined;
        const rawShareLink =
          typeof job.share_link === 'string' && job.share_link.trim()
            ? job.share_link.trim()
            : undefined;

        const stableFallbackJobId = rawShareLink
          ? rawShareLink
          : `${String(job.title ?? '').trim()}|${String(job.company_name ?? '').trim()}|${String(job.location ?? '').trim()}|${q}|${remote ? 'remote' : 'local'}`;

        const scheduleType = detectedExtensions.schedule_type
          ? String(detectedExtensions.schedule_type)
          : undefined;

        collected.push({
          applyOptions: (job.apply_options ??
            []) as unknown as Prisma.JsonArray,
          benefits: [],
          company: job.company_name ?? undefined,
          companyLogoUrl: job.thumbnail ?? undefined,
          dentalCoverage: detectedExtensions.dental_coverage ?? undefined,
          description: job.description ?? undefined,
          detectedExtensions: (detectedExtensions ??
            {}) as unknown as Prisma.JsonObject,
          extensions: Array.isArray(job.extensions) ? job.extensions : [],
          healthInsurance: detectedExtensions.health_insurance ?? undefined,
          jobProvider: JobProvider.SERPAPI,
          jobProviderUrl: job.share_link ?? undefined,
          jobId: rawJobId ?? stableFallbackJobId,
          jobType: getJobType(scheduleType),
          location: job.location ?? undefined,
          paidTimeOff: detectedExtensions.paid_time_off ?? undefined,
          postedAt,
          remote: detectedExtensions.work_from_home ?? remote,
          requirements: [],
          responsibilities: [],
          salary: detectedExtensions.salary ?? undefined,
          scheduleType,
          source: job.via ?? undefined,
          title: job.title,
          userId: user.id,
          workFromHome: detectedExtensions.work_from_home ?? undefined,
        });
      }

      nextPageToken = data?.serpapi_pagination?.next_page_token;
      if (!nextPageToken) break;
    }

    const uniqueByJobId = new Map<string, Prisma.JobListingCreateManyInput>();
    for (const item of collected) {
      if (item.jobId) {
        uniqueByJobId.set(item.jobId, item);
      }
    }

    const deduped = Array.from(uniqueByJobId.values());
    const jobIds = deduped.map(j => j.jobId);

    const existing = await db.jobListing.findMany({
      where: {
        jobId: { in: jobIds },
      },
      select: {
        jobId: true,
        userId: true,
      },
    });

    const existingMap = new Map(
      existing.map(e => [e.jobId, e.userId] as const),
    );

    const toCreate: Array<Prisma.JobListingCreateManyInput> = [];
    const toUpdate: Array<Prisma.JobListingCreateManyInput> = [];

    for (const item of deduped) {
      const existingUserId = existingMap.get(item.jobId);
      if (!existingUserId) {
        toCreate.push(item);
        continue;
      }

      if (existingUserId === user.id) {
        toUpdate.push(item);
      }
    }

    if (toCreate.length > 0) {
      await db.jobListing.createMany({
        data: toCreate,
        skipDuplicates: true,
      });
    }

    const updateOps = toUpdate.map(item =>
      db.jobListing.update({
        where: { jobId: item.jobId },
        data: {
          applyOptions: item.applyOptions as unknown as Prisma.JsonArray,
          company: item.company,
          companyLogoUrl: item.companyLogoUrl,
          dentalCoverage: item.dentalCoverage,
          description: item.description,
          detectedExtensions:
            item.detectedExtensions as unknown as Prisma.JsonObject,
          extensions: item.extensions,
          healthInsurance: item.healthInsurance,
          jobProvider: item.jobProvider,
          jobProviderUrl: item.jobProviderUrl,
          jobType: item.jobType,
          location: item.location,
          paidTimeOff: item.paidTimeOff,
          postedAt: item.postedAt,
          remote: item.remote,
          salary: item.salary,
          scheduleType: item.scheduleType,
          source: item.source,
          title: item.title,
          workFromHome: item.workFromHome,
        },
      }),
    );

    if (updateOps.length > 0) {
      const BATCH_SIZE = 25;
      for (let i = 0; i < updateOps.length; i += BATCH_SIZE) {
        await db.$transaction(updateOps.slice(i, i + BATCH_SIZE));
      }
    }

    return NextResponse.json({
      createdCount: toCreate.length,
      refreshedCount: toUpdate.length,
      totalFetched: deduped.length,
      q,
      chipsDatePosted,
      location: location || SERPAPI_DEFAULT_LOCATION,
      remote,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to refresh jobs';
    console.error('Error refreshing jobs:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
