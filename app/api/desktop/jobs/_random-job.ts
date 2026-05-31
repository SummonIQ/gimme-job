import { NextResponse } from 'next/server';

import { JobProvider } from '@/generated/prisma/browser';
import { validateToken } from '@/lib/desktop-tokens';
import { db } from '@/lib/db/client';
import {
  MANUAL_PROVIDER_OPTIONS,
  type ManualProviderId,
} from '@/lib/admin/manual-provider-options';

// Mirror of `isGreenhouseApplicationUrl` in
// `desktop/electron/submit/greenhouse-url.ts`. The Greenhouse DB filter MUST
// stay in sync with the runtime URL recognizer; if it is looser, we'll hand the
// desktop client a URL it then routes to the generic runner.
const GREENHOUSE_URL_MATCH = 'greenhouse.io';

// Mirror of `desktop/electron/submit/provider-registry.ts` runtime host
// patterns. Each entry is one or more substrings that mark an apply URL as
// belonging to that runtime ATS. Kept in sync manually — if a provider's
// host pattern changes there, update it here too.
const RUNTIME_PROVIDER_URL_FRAGMENTS: Record<string, readonly string[]> = {
  greenhouse: ['greenhouse.io'],
  ashby: ['ashbyhq.com'],
  lever: ['lever.co'],
  workable: ['workable.com'],
  smartrecruiters: ['smartrecruiters.com'],
  recruitee: ['recruitee.com'],
  teamtailor: ['teamtailor.com'],
  jobvite: ['jobvite.com'],
  bamboohr: ['bamboohr.com'],
  personio: ['personio.com'],
  breezy: ['breezy.hr'],
  workday: ['myworkdayjobs.com'],
  icims: ['icims.com'],
  taleo: ['taleo.net', 'taleocloud.com'],
};

const RUNTIME_PROVIDER_IDS = new Set(Object.keys(RUNTIME_PROVIDER_URL_FRAGMENTS));

function parseRuntimeProviderIds(value: string | null): readonly string[] {
  return (value ?? '')
    .split(',')
    .map(provider => provider.trim().toLowerCase())
    .filter(provider => RUNTIME_PROVIDER_IDS.has(provider));
}

type DesktopRandomProviderScope = 'any' | 'greenhouse';

const manualProviderIds = new Set(
  MANUAL_PROVIDER_OPTIONS.map(provider => provider.value),
);

const MANUAL_PROVIDER_JOB_PROVIDER: Record<ManualProviderId, JobProvider> = {
  adzuna: JobProvider.ADZUNA,
  arbeitnow: JobProvider.ARBEITNOW,
  'ashby-boards': JobProvider.ASHBY,
  'bamboohr-boards': JobProvider.BAMBOOHR,
  'breezy-boards': JobProvider.BREEZY_HR,
  builtin: JobProvider.BUILT_IN,
  careerbuilder: JobProvider.CAREER_BUILDER,
  clawjobs: JobProvider.CLAW_JOBS,
  'comeet-boards': JobProvider.COMEET,
  crunchboard: JobProvider.CRUNCHBOARD,
  devitjobs: JobProvider.DEV_IT_JOBS,
  'django-job-board': JobProvider.DJANGO_JOB_BOARD,
  fantastic: JobProvider.FANTASTIC_JOBS,
  findwork: JobProvider.FINDWORK,
  'greenhouse-boards': JobProvider.GREENHOUSE,
  hackernews: JobProvider.HACKER_NEWS,
  himalayas: JobProvider.HIMALAYAS,
  'indeed-scraper': JobProvider.INDEED,
  'jazzhr-boards': JobProvider.JAZZHR,
  jobdataapi: JobProvider.JOB_DATA_API,
  jobicy: JobProvider.JOBICY,
  jobspresso: JobProvider.JOBSPRESSO,
  jooble: JobProvider.JOOBLE,
  'lever-boards': JobProvider.LEVER,
  'linkedin-guest': JobProvider.LINKEDIN,
  nodesk: JobProvider.NODESK,
  openjobs: JobProvider.OPENJOBS,
  'pallet-boards': JobProvider.PALLET,
  'jobvite-boards': JobProvider.JOBVITE,
  'personio-boards': JobProvider.PERSONIO,
  'pinpoint-boards': JobProvider.PINPOINT,
  'python-org': JobProvider.PYTHON_ORG,
  'recruitee-boards': JobProvider.RECRUITEE,
  'remotejobs-org': JobProvider.REMOTE_JOBS_ORG,
  remotefirstjobs: JobProvider.REMOTE_FIRST_JOBS,
  remoteok: JobProvider.REMOTE_OK,
  remotive: JobProvider.REMOTIVE,
  serpapi: JobProvider.SERPAPI,
  'smartrecruiters-boards': JobProvider.SMART_RECRUITERS,
  'teamtailor-boards': JobProvider.TEAMTAILOR,
  themuse: JobProvider.THE_MUSE,
  theirstack: JobProvider.THEIRSTACK,
  usajobs: JobProvider.USAJOBS,
  welcometothejungle: JobProvider.WELCOME_TO_THE_JUNGLE,
  weworkremotely: JobProvider.WE_WORK_REMOTELY,
  workingnomads: JobProvider.WORKING_NOMADS,
  'workable-boards': JobProvider.WORKABLE,
  workatastartup: JobProvider.WORK_AT_A_STARTUP,
  'workday-boards': JobProvider.WORKDAY,
};

function parseProviderIds(value: string | null) {
  return (value ?? '')
    .split(',')
    .map(provider => provider.trim())
    .filter((provider): provider is ManualProviderId =>
      manualProviderIds.has(provider as ManualProviderId),
    );
}

function getProviderScopeCondition(
  provider: DesktopRandomProviderScope,
  providerIds: readonly ManualProviderId[],
) {
  if (providerIds.length > 0) {
    return {
      OR: providerIds.map(providerId =>
        providerId === 'greenhouse-boards'
          ? {
              jobProviderUrl: {
                contains: GREENHOUSE_URL_MATCH,
                mode: 'insensitive' as const,
              },
            }
          : {
              jobProvider: MANUAL_PROVIDER_JOB_PROVIDER[providerId],
            },
      ),
    };
  }

  if (provider === 'any') {
    return {
      jobProviderUrl: {
        not: null as string | null,
      },
    };
  }

  return {
    // Greenhouse picks must land on a Greenhouse-hosted apply page
    // (job-boards.greenhouse.io / boards.greenhouse.io). Earlier we
    // also matched company-domain URLs carrying ?gh_jid=... since
    // those are technically Greenhouse-backed, but those wrappers
    // (e.g. bishopfox.com/jobs?gh_jid=...) typically only render the
    // description — the form lives on the canonical greenhouse.io
    // URL. Including them here meant selecting "Greenhouse" loaded
    // company landing pages with no form. Match the canonical host
    // only.
    jobProviderUrl: {
      contains: GREENHOUSE_URL_MATCH,
      mode: 'insensitive' as const,
    },
  };
}

export async function getDesktopRandomJobResponse(
  request: Request,
  options: {
    readonly allowProviderParam?: boolean;
    readonly defaultProvider: DesktopRandomProviderScope;
  },
) {
  try {
    return await getDesktopRandomJobResponseInner(request, options);
  } catch (error) {
    // Without this, Prisma / DB / network errors blow up as raw HTTP 500
    // from Next with no logged context. The desktop autopilot loop sees
    // "HTTP_500" and retries forever — log the cause so we can actually
    // see what's wrong.
    console.error(
      '[desktop-random-job] route handler threw:',
      error instanceof Error ? `${error.message}\n${error.stack}` : String(error),
    );
    return NextResponse.json(
      {
        error: `Random job picker failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
}

async function getDesktopRandomJobResponseInner(
  request: Request,
  options: {
    readonly allowProviderParam?: boolean;
    readonly defaultProvider: DesktopRandomProviderScope;
  },
) {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  const rawToken = match?.[1]?.trim();

  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() ?? '';
  const location = url.searchParams.get('location')?.trim() ?? '';
  const requestedProvider = url.searchParams
    .get('provider')
    ?.trim()
    .toLowerCase();
  const provider =
    options.allowProviderParam &&
    (requestedProvider === 'any' || requestedProvider === 'greenhouse')
      ? requestedProvider
      : options.defaultProvider;
  const providerIds = options.allowProviderParam
    ? parseProviderIds(url.searchParams.get('providers'))
    : [];
  const runtimeProviderIds = options.allowProviderParam
    ? parseRuntimeProviderIds(url.searchParams.get('runtimeProviders'))
    : [];
  const remote = url.searchParams.get('remote') === 'true';
  // Comma-separated list of recently-served listing/company ids the
  // client wants excluded so the user doesn't keep seeing the same
  // jobs over and over. We split on listing vs company so the client
  // can rotate companies independently of individual listings.
  const excludeListingIds = (url.searchParams.get('excludeListingIds') ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const excludeCompanies = (url.searchParams.get('excludeCompanies') ?? '')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
  const andConditions: object[] = [];

  if (search) {
    andConditions.push({
      OR: [
        { title: { contains: search, mode: 'insensitive' as const } },
        { company: { contains: search, mode: 'insensitive' as const } },
        { description: { contains: search, mode: 'insensitive' as const } },
      ],
    });
  }

  if (remote) {
    andConditions.push({ remote: true });
  } else if (location) {
    const cityName = location.split(',')[0]?.trim() || location;
    andConditions.push({
      location: { contains: cityName, mode: 'insensitive' as const },
    });
  }

  const providerScopeCondition = getProviderScopeCondition(
    provider,
    providerIds,
  );

  // Filter to listings whose apply URL belongs to one of the requested
  // runtime ATS providers. Distinct from `providers` above (which filters by
  // job-source scraper). Applied as an additional AND so e.g. picking
  // "lever" + a scraper-source restricts to Lever-hosted apply URLs sourced
  // from that scraper.
  if (runtimeProviderIds.length > 0) {
    const fragments = runtimeProviderIds.flatMap(
      id => RUNTIME_PROVIDER_URL_FRAGMENTS[id] ?? [],
    );
    if (fragments.length > 0) {
      andConditions.push({
        OR: fragments.map(fragment => ({
          jobProviderUrl: {
            contains: fragment,
            mode: 'insensitive' as const,
          },
        })),
      });
    }
  }

  // A user can have multiple JobListing rows pointing at the same apply URL
  // (e.g. cross-source dupes). The lead-scoped filter below only excludes the
  // listing they applied through, so without this we'd happily re-serve a
  // sibling listing for the same URL. Pre-fetch every URL associated with an
  // already-applied/unavailable lead and exclude them all.
  const blockedLeads = await db.jobLead.findMany({
    select: { jobListing: { select: { jobProviderUrl: true } } },
    where: {
      OR: [
        { status: { in: ['APPLIED' as const, 'UNAVAILABLE' as const] } },
        {
          applicationSubmissions: {
            some: { status: { not: 'FAILED' as const } },
          },
        },
      ],
      userId: validation.token.userId,
    },
  });
  const blockedUrls = Array.from(
    new Set(
      blockedLeads
        .map(record => record.jobListing?.jobProviderUrl)
        .filter((url): url is string => Boolean(url)),
    ),
  );

  const excludeFilters: object[] = [];
  if (blockedUrls.length > 0) {
    excludeFilters.push({ jobProviderUrl: { in: blockedUrls } });
  }
  if (excludeListingIds.length > 0) {
    excludeFilters.push({ id: { in: excludeListingIds } });
  }
  if (excludeCompanies.length > 0) {
    excludeFilters.push({
      company: { in: excludeCompanies, mode: 'insensitive' as const },
    });
  }

  const where = {
    AND: [...andConditions, providerScopeCondition],
    ...(excludeFilters.length > 0
      ? {
          NOT: excludeFilters.length === 1 ? excludeFilters[0] : excludeFilters,
        }
      : {}),
    OR: [
      { lead: { is: null } },
      {
        lead: {
          is: {
            applicationSubmissions: {
              none: {
                status: {
                  not: 'FAILED' as const,
                },
              },
            },
            status: {
              notIn: ['APPLIED' as const, 'UNAVAILABLE' as const],
            },
          },
        },
      },
    ],
    status: {
      not: 'DISMISSED' as const,
    },
    userId: validation.token.userId,
  };

  // Single count + random-offset findFirst. The previous version did a
  // groupBy('company') first to give each company equal probability, but
  // on a sizeable jobListing table with the relation-OR WHERE clause
  // below, the groupBy scans every matching row and was tens of seconds
  // slow. The desktop client now forwards rolling exclusion lists for
  // both recent listings (30) and recent companies (8), which already
  // prevents big-employer dominance in practice — so we can skip the
  // expensive groupBy and just pick a uniform-random listing.
  const totalCount = await db.jobListing.count({ where });

  if (totalCount === 0) {
    return NextResponse.json(
      {
        error:
          runtimeProviderIds.length > 0
            ? `No job listings found for the selected ATS (${runtimeProviderIds.join(', ')}).`
            : providerIds.length > 0
              ? 'No job listings found for the selected providers.'
              : provider === 'any'
                ? 'No job listings with apply URLs found for this user.'
                : 'No Greenhouse listings found for this user.',
      },
      { status: 404 },
    );
  }

  const randomOffset = Math.floor(Math.random() * totalCount);
  const listing = await db.jobListing.findFirst({
    orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    select: {
      company: true,
      id: true,
      jobProviderUrl: true,
      lead: {
        select: {
          id: true,
        },
      },
      location: true,
      source: true,
      title: true,
    },
    skip: randomOffset,
    where,
  });

  if (!listing?.jobProviderUrl) {
    return NextResponse.json(
      {
        error:
          providerIds.length > 0
            ? 'No job listing could be selected for the selected providers.'
            : provider === 'any'
              ? 'No job listing could be selected.'
              : 'No Greenhouse listing could be selected.',
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    applicationUrl: listing.jobProviderUrl,
    company: listing.company,
    jobLeadId: listing.lead?.id ?? null,
    jobListingId: listing.id,
    location: listing.location,
    source: listing.source,
    title: listing.title,
  });
}
