/**
 * Ingest jobs into JobListing from Fantastic.jobs, USAJobs, and SerpAPI.
 *
 * Goals:
 * 1) Backfill large datasets once (`--mode=backfill`)
 * 2) Incrementally sync recent jobs (`--mode=sync`) with provider-specific recency filters
 * 3) Keep search DB-first by preloading JobListing rows
 *
 * Usage examples:
 * - bun scripts/ingest-job-dataset.ts --mode=backfill --user-id=<USER_ID>
 * - bun scripts/ingest-job-dataset.ts --mode=sync --user-id=<USER_ID>
 * - bun scripts/ingest-job-dataset.ts --mode=sync --providers=fantastic,usajobs,serpapi --dry-run
 */
import 'dotenv/config';

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { JobProvider, JobType, type Prisma } from '@/generated/prisma/browser';

import {
  searchUSAJobs,
  type USAJobsMatchedObject,
} from '../lib/api/usajobs-client';
import { db } from '../lib/db/client';
import { parseRelativeTimeToDate } from '../lib/time/parse';
import type {
  SerpApiJobResult,
  SerpApiJobSearchResultsResponse,
} from '../types/api/serp-api';

const FANTASTIC_API_BASE = 'https://active-jobs-db.p.rapidapi.com';
const FANTASTIC_HOST = 'active-jobs-db.p.rapidapi.com';

const DEFAULT_STATE_FILE = '/tmp/gimme-job-ingest-state.json';
const DEFAULT_PROVIDERS = ['fantastic', 'usajobs', 'serpapi'] as const;
const DEFAULT_BACKFILL_PROVIDERS = ['fantastic', 'usajobs', 'serpapi'] as const;
const DEFAULT_SERP_QUERIES = ['jobs'] as const;
const UNITED_STATES_LOCATION_FILTER = 'United States';

const BACKFILL_FANTASTIC_ENDPOINT_CANDIDATES = [
  'active-ats-6m',
  'active-ats-backfill',
] as const;
const SYNC_FANTASTIC_ENDPOINT_CANDIDATES = [
  'active-ats-24h',
  'active-ats-7d',
  'active-ats',
] as const;

type ProviderName = (typeof DEFAULT_PROVIDERS)[number];
type IngestMode = 'backfill' | 'sync';

interface IngestOptions {
  mode: IngestMode;
  providers: ProviderName[];
  userId?: string;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
  dryRun: boolean;
  updateExisting: boolean;
  sleepMs: number;
  maxPagesPerProvider: number;
  batchSize: number;
  stateFile: string;
  postedWithinDays?: number;
  fantasticLimit: number;
  fantasticDateFilter?: string;
  fantasticEndpoints: string[];
  serpQueries: string[];
  serpPagesPerQuery: number;
  usajobsResultsPerPage: number;
}

interface IngestionState {
  fantastic?: {
    endpoint?: string;
    lastDateFilter?: string;
    lastOffset?: number;
  };
  lastRunAt?: string;
}

interface PersistSummary {
  createdCount: number;
  updatedCount: number;
  skippedCrossUserCount: number;
}

interface ProviderRunSummary extends PersistSummary {
  apiRequests: number;
  fetchedCount: number;
  provider: ProviderName;
}

interface ProviderFailure {
  message: string;
  provider: ProviderName;
}

interface FantasticJobsRateLimit {
  jobsLimit?: number;
  jobsRemaining?: number;
  jobsResetSeconds?: number;
  requestsLimit?: number;
  requestsRemaining?: number;
}

interface FantasticJobLocationRaw {
  address?: {
    addressCountry?: string;
    addressLocality?: string;
    addressRegion?: string;
  };
}

interface FantasticJob {
  id: string;
  date_created?: string;
  date_posted?: string;
  description_text?: string | null;
  employment_type?: string | string[] | null;
  locations_alt_raw?: string[] | null;
  locations_derived?: string[] | null;
  locations_raw?: FantasticJobLocationRaw[] | null;
  organization?: string | null;
  organization_logo?: string | null;
  remote_derived?: boolean | null;
  ai_work_arrangement?: string | null;
  salary_raw?: string | Record<string, unknown> | null;
  source?: string | null;
  title?: string | null;
  url?: string | null;
}

interface FantasticJobsResponse {
  endpoint: string;
  jobs: FantasticJob[];
  rateLimit: FantasticJobsRateLimit;
}

const parseMode = (value: string | undefined): IngestMode => {
  if (value === 'backfill') return 'backfill';
  return 'sync';
};

const parseIntegerArg = (
  value: string | undefined,
  fallback: number,
): number => {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseBooleanArg = (
  argv: string[],
  name: string,
  fallback = false,
): boolean => {
  if (argv.includes(`--${name}`)) return true;
  const value = argv
    .find(arg => arg.startsWith(`--${name}=`))
    ?.split('=')
    .slice(1)
    .join('=')
    .trim()
    .toLowerCase();
  if (!value) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value);
};

const parseCsvArg = (
  value: string | undefined,
  fallback: readonly string[],
): string[] => {
  if (!value?.trim()) return [...fallback];
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
};

const normalizeProviderList = (providers: string[]): ProviderName[] => {
  const allowed = new Set<ProviderName>(['fantastic', 'usajobs', 'serpapi']);
  const normalized = providers
    .map(provider => provider.toLowerCase() as ProviderName)
    .filter(provider => allowed.has(provider));
  return normalized.length > 0 ? normalized : [...DEFAULT_PROVIDERS];
};

const getArgValue = (argv: string[], name: string): string | undefined => {
  const prefix = `--${name}=`;
  const arg = argv.find(item => item.startsWith(prefix));
  return arg ? arg.slice(prefix.length) : undefined;
};

const formatIsoWithoutMs = (value: Date): string =>
  value.toISOString().replace(/\.\d{3}Z$/, 'Z');

const toPrismaDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toNullableString = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const toStringArray = (value: unknown): string[] => {
  if (value === null || value === undefined) return [];

  const queue: unknown[] = Array.isArray(value) ? [...value] : [value];
  const normalized: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift();
    if (Array.isArray(current)) {
      queue.unshift(...current);
      continue;
    }
    if (typeof current !== 'string') continue;

    const trimmed = current.trim();
    if (trimmed.length > 0) {
      normalized.push(trimmed);
    }
  }

  return normalized;
};

const sleep = async (ms: number): Promise<void> => {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
};

const isSerpApiNoResultsMessage = (message: string): boolean =>
  message.toLowerCase().includes("google hasn't returned any results");

const mapScheduleTypeToJobType = (scheduleType?: string): JobType => {
  const normalized = (scheduleType || '').toLowerCase();
  if (normalized.includes('full')) return JobType.FULL_TIME;
  if (normalized.includes('part')) return JobType.PART_TIME;
  if (normalized.includes('contract')) return JobType.CONTRACT;
  if (normalized.includes('intern')) return JobType.INTERNSHIP;
  return JobType.UNKNOWN;
};

const mapUsaJobsScheduleCodeToJobType = (scheduleCode?: string): JobType => {
  switch (scheduleCode) {
    case '1':
      return JobType.FULL_TIME;
    case '2':
      return JobType.PART_TIME;
    case '4':
      return JobType.CONTRACT;
    default:
      return JobType.UNKNOWN;
  }
};

const buildUsaJobsSalary = (
  remuneration: USAJobsMatchedObject['PositionRemuneration'],
): string | undefined => {
  if (!remuneration || remuneration.length === 0) return undefined;
  const primary = remuneration[0];
  const min = primary.MinimumRange;
  const max = primary.MaximumRange;
  const interval = primary.RateIntervalCode;

  if (!min && !max) return undefined;

  const intervalLabel =
    interval === 'PA'
      ? '/year'
      : interval === 'PH'
        ? '/hour'
        : interval === 'PD'
          ? '/day'
          : '';

  if (min && max && min !== max) {
    return `$${Number(min).toLocaleString()} - $${Number(max).toLocaleString()}${intervalLabel}`;
  }
  if (min) {
    return `$${Number(min).toLocaleString()}${intervalLabel}`;
  }
  return `$${Number(max).toLocaleString()}${intervalLabel}`;
};

const buildUsaJobsDescription = (job: USAJobsMatchedObject): string => {
  const parts: string[] = [];
  if (job.QualificationSummary) {
    parts.push(job.QualificationSummary);
  }
  if (job.UserArea?.Details?.JobSummary) {
    parts.push(job.UserArea.Details.JobSummary);
  }
  if (job.UserArea?.Details?.MajorDuties) {
    parts.push(job.UserArea.Details.MajorDuties);
  }
  return parts.join('\n\n') || 'No description available';
};

const formatFantasticSalary = (
  salaryRaw?: string | Record<string, unknown> | null,
): string | undefined => {
  if (!salaryRaw) return undefined;
  const raw =
    typeof salaryRaw === 'string'
      ? salaryRaw.trim()
      : JSON.stringify(salaryRaw);
  if (!raw) return undefined;
  if (!raw.startsWith('{')) return raw;

  try {
    const parsed = JSON.parse(raw) as {
      currency?: string;
      value?: {
        minValue?: number;
        maxValue?: number;
        unitText?: string;
      };
    };
    const currency = parsed.currency || 'USD';
    const minValue = parsed.value?.minValue;
    const maxValue = parsed.value?.maxValue;
    const unitText = parsed.value?.unitText?.toLowerCase();
    const suffix = unitText ? `/${unitText}` : '';

    if (typeof minValue === 'number' && typeof maxValue === 'number') {
      return `${currency} ${minValue.toLocaleString()} - ${maxValue.toLocaleString()}${suffix}`;
    }
    if (typeof minValue === 'number') {
      return `${currency} ${minValue.toLocaleString()}+${suffix}`;
    }
    if (typeof maxValue === 'number') {
      return `Up to ${currency} ${maxValue.toLocaleString()}${suffix}`;
    }
  } catch {
    return raw;
  }

  return raw;
};

const resolveFantasticLocation = (job: FantasticJob): string | undefined => {
  const rawAddress =
    job.locations_raw?.[0]?.address &&
    [
      job.locations_raw[0].address?.addressLocality,
      job.locations_raw[0].address?.addressRegion,
      job.locations_raw[0].address?.addressCountry,
    ]
      .filter(Boolean)
      .join(', ');

  const candidates = [
    ...(job.locations_derived ?? []),
    ...(job.locations_alt_raw ?? []),
    rawAddress,
  ].filter(Boolean) as string[];

  return candidates[0];
};

const buildFantasticListing = (
  userId: string,
  job: FantasticJob,
): Prisma.JobListingCreateManyInput | null => {
  const rawId = toNullableString(job.id);
  if (!rawId) return null;

  return {
    applyOptions: job.url
      ? ({ applyUrl: job.url } as Prisma.JsonObject)
      : undefined,
    benefits: [],
    company: toNullableString(job.organization),
    companyLogoUrl: toNullableString(job.organization_logo),
    description: toNullableString(job.description_text),
    jobId: rawId,
    jobProvider: JobProvider.FANTASTIC_JOBS,
    jobProviderUrl: toNullableString(job.url),
    jobType: mapScheduleTypeToJobType(
      Array.isArray(job.employment_type)
        ? job.employment_type[0]
        : job.employment_type || undefined,
    ),
    location: resolveFantasticLocation(job),
    postedAt: toPrismaDate(job.date_posted || job.date_created),
    remote:
      job.ai_work_arrangement === 'Remote Solely' ||
      job.ai_work_arrangement === 'Remote OK' ||
      job.remote_derived === true
        ? true
        : job.ai_work_arrangement === 'On-site' ||
            job.ai_work_arrangement === 'Hybrid'
          ? false
          : (job.remote_derived ?? undefined),
    salary: formatFantasticSalary(job.salary_raw),
    source: toNullableString(job.source) || 'Fantastic.jobs',
    title: toNullableString(job.title) || 'Untitled role',
    userId,
  };
};

const buildUsaJobsListing = (
  userId: string,
  matched: USAJobsMatchedObject,
  matchedObjectId: string,
): Prisma.JobListingCreateManyInput => {
  const jobId = `usajobs-${matchedObjectId}`;
  const locationDisplay = toNullableString(matched.PositionLocationDisplay);
  const scheduleCode = matched.PositionSchedule?.[0]?.Code;

  const isRemote = Boolean(
    locationDisplay?.toLowerCase().includes('anywhere') ||
    locationDisplay?.toLowerCase().includes('remote'),
  );

  return {
    applyOptions: matched.ApplyURI?.[0]
      ? ({ applyUrl: matched.ApplyURI[0] } as Prisma.JsonObject)
      : undefined,
    benefits: toStringArray(matched.UserArea?.Details?.Benefits),
    company: toNullableString(
      matched.OrganizationName || matched.DepartmentName,
    ),
    description: buildUsaJobsDescription(matched),
    jobId,
    jobProvider: JobProvider.USAJOBS,
    jobProviderUrl: toNullableString(matched.PositionURI),
    jobType: mapUsaJobsScheduleCodeToJobType(scheduleCode),
    location: locationDisplay,
    postedAt: toPrismaDate(matched.PublicationStartDate),
    qualifications: toStringArray(matched.QualificationSummary),
    remote: isRemote,
    requirements: toStringArray(matched.UserArea?.Details?.KeyRequirements),
    responsibilities: toStringArray(matched.UserArea?.Details?.MajorDuties),
    salary: buildUsaJobsSalary(matched.PositionRemuneration),
    source: 'USAJobs',
    title: toNullableString(matched.PositionTitle) || 'Untitled role',
    userId,
  };
};

const mapSerpScheduleTypeToJobType = (scheduleType?: string): JobType => {
  switch (scheduleType) {
    case 'Full-time':
      return JobType.FULL_TIME;
    case 'Part-time':
      return JobType.PART_TIME;
    case 'Full-time and Part-time':
      return JobType.FULL_TIME_AND_PART_TIME;
    default:
      return mapScheduleTypeToJobType(scheduleType);
  }
};

const buildSerpListing = (
  userId: string,
  searchTerm: string,
  remote: boolean,
  job: SerpApiJobResult,
): Prisma.JobListingCreateManyInput => {
  const detectedExtensions = job.detected_extensions ?? {};
  const postedAt = detectedExtensions.posted_at
    ? parseRelativeTimeToDate(String(detectedExtensions.posted_at))
    : null;

  const rawJobId = toNullableString(job.job_id);
  const rawShareLink = toNullableString(job.share_link);
  const stableFallbackJobId =
    rawShareLink ||
    `${(job.title || '').trim()}|${(job.company_name || '').trim()}|${(job.location || '').trim()}|${searchTerm}|${remote ? 'remote' : 'local'}`;
  const scheduleType = detectedExtensions.schedule_type
    ? String(detectedExtensions.schedule_type)
    : undefined;

  return {
    applyOptions: (job.apply_options ?? []) as unknown as Prisma.JsonArray,
    benefits: [],
    company: toNullableString(job.company_name),
    companyLogoUrl: toNullableString(job.thumbnail),
    dentalCoverage: detectedExtensions.dental_coverage ?? undefined,
    description: toNullableString(job.description),
    detectedExtensions: (detectedExtensions ??
      {}) as unknown as Prisma.JsonObject,
    extensions: Array.isArray(job.extensions) ? job.extensions : [],
    healthInsurance: detectedExtensions.health_insurance ?? undefined,
    jobId: rawJobId || stableFallbackJobId,
    jobProvider: JobProvider.SERPAPI,
    jobProviderUrl: rawShareLink,
    jobType: mapSerpScheduleTypeToJobType(scheduleType),
    location: toNullableString(job.location),
    paidTimeOff: detectedExtensions.paid_time_off ?? undefined,
    postedAt,
    remote: detectedExtensions.work_from_home ?? remote,
    requirements: [],
    responsibilities: [],
    salary: detectedExtensions.salary ?? undefined,
    scheduleType,
    source: toNullableString(job.via) || 'Google Jobs',
    title: toNullableString(job.title) || 'Untitled role',
    userId,
    workFromHome: detectedExtensions.work_from_home ?? undefined,
  };
};

const dedupeListingsByJobId = (
  listings: Prisma.JobListingCreateManyInput[],
): Prisma.JobListingCreateManyInput[] => {
  const unique = new Map<string, Prisma.JobListingCreateManyInput>();
  for (const listing of listings) {
    if (!listing.jobId?.trim()) continue;
    unique.set(listing.jobId, listing);
  }
  return Array.from(unique.values());
};

const normalizeListingArrayFields = (
  listing: Prisma.JobListingCreateManyInput,
): Prisma.JobListingCreateManyInput => ({
  ...listing,
  benefits: toStringArray(listing.benefits),
  extensions: toStringArray(listing.extensions),
  qualifications: toStringArray(listing.qualifications),
  requirements: toStringArray(listing.requirements),
  responsibilities: toStringArray(listing.responsibilities),
});

const buildJobListingUpdateData = (
  listing: Prisma.JobListingCreateManyInput,
): Prisma.JobListingUpdateInput => ({
  applyOptions: listing.applyOptions as Prisma.InputJsonValue | undefined,
  benefits: listing.benefits,
  company: listing.company,
  companyLogoUrl: listing.companyLogoUrl,
  dentalCoverage: listing.dentalCoverage,
  description: listing.description,
  detectedExtensions: listing.detectedExtensions as
    | Prisma.InputJsonValue
    | undefined,
  extensions: listing.extensions,
  healthInsurance: listing.healthInsurance,
  jobProvider: listing.jobProvider,
  jobProviderUrl: listing.jobProviderUrl,
  jobType: listing.jobType,
  location: listing.location,
  paidTimeOff: listing.paidTimeOff,
  postedAt: listing.postedAt,
  qualifications: listing.qualifications,
  remote: listing.remote,
  requirements: listing.requirements,
  responsibilities: listing.responsibilities,
  salary: listing.salary,
  scheduleType: listing.scheduleType,
  source: listing.source,
  title: listing.title,
  workFromHome: listing.workFromHome,
});

const persistListings = async ({
  userId,
  listings,
  dryRun,
  updateExisting,
  batchSize,
}: {
  userId: string;
  listings: Prisma.JobListingCreateManyInput[];
  dryRun: boolean;
  updateExisting: boolean;
  batchSize: number;
}): Promise<PersistSummary> => {
  const deduped = dedupeListingsByJobId(
    listings.map(normalizeListingArrayFields),
  );
  if (deduped.length === 0) {
    return {
      createdCount: 0,
      skippedCrossUserCount: 0,
      updatedCount: 0,
    };
  }

  if (dryRun) {
    return {
      createdCount: deduped.length,
      skippedCrossUserCount: 0,
      updatedCount: 0,
    };
  }

  const jobIds = deduped.map(item => item.jobId);
  const existing = await db.jobListing.findMany({
    where: {
      jobId: {
        in: jobIds,
      },
    },
    select: {
      jobId: true,
      userId: true,
    },
  });
  const existingMap = new Map(existing.map(item => [item.jobId, item]));

  const toCreate: Prisma.JobListingCreateManyInput[] = [];
  const toUpdate: Prisma.JobListingCreateManyInput[] = [];
  let skippedCrossUserCount = 0;

  for (const listing of deduped) {
    const existingRecord = existingMap.get(listing.jobId);
    if (!existingRecord) {
      toCreate.push(listing);
      continue;
    }

    if (existingRecord.userId !== userId) {
      skippedCrossUserCount += 1;
      continue;
    }

    if (updateExisting) {
      toUpdate.push(listing);
    }
  }

  let createdCount = 0;
  if (toCreate.length > 0) {
    const createResult = await db.jobListing.createMany({
      data: toCreate.map(item => ({
        ...item,
      })),
      skipDuplicates: true,
    });
    createdCount = createResult.count;
  }

  let updatedCount = 0;
  if (toUpdate.length > 0) {
    for (let index = 0; index < toUpdate.length; index += batchSize) {
      const chunk = toUpdate.slice(index, index + batchSize);
      await db.$transaction(
        chunk.map(item =>
          db.jobListing.update({
            where: { jobId: item.jobId },
            data: buildJobListingUpdateData(item),
          }),
        ),
      );
      updatedCount += chunk.length;
    }
  }

  return {
    createdCount,
    skippedCrossUserCount,
    updatedCount,
  };
};

const parseRateLimitHeaders = (headers: Headers): FantasticJobsRateLimit => ({
  jobsLimit:
    parseIntegerArg(headers.get('x-ratelimit-jobs-limit') || undefined, 0) ||
    undefined,
  jobsRemaining:
    parseIntegerArg(
      headers.get('x-ratelimit-jobs-remaining') || undefined,
      0,
    ) || undefined,
  jobsResetSeconds:
    parseIntegerArg(headers.get('x-ratelimit-jobs-reset') || undefined, 0) ||
    undefined,
  requestsLimit:
    parseIntegerArg(
      headers.get('x-ratelimit-requests-limit') || undefined,
      0,
    ) || undefined,
  requestsRemaining:
    parseIntegerArg(
      headers.get('x-ratelimit-requests-remaining') || undefined,
      0,
    ) || undefined,
});

const fetchFantasticJobsPage = async ({
  endpointCandidates,
  params,
}: {
  endpointCandidates: string[];
  params: URLSearchParams;
}): Promise<FantasticJobsResponse> => {
  const apiKey = process.env.RAPID_API_KEY;
  if (!apiKey) {
    throw new Error('RAPID_API_KEY is not set');
  }

  let lastErrorMessage = 'No endpoint candidates attempted.';
  for (const endpoint of endpointCandidates) {
    const url = `${FANTASTIC_API_BASE}/${endpoint}?${params.toString()}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-rapidapi-host': FANTASTIC_HOST,
        'x-rapidapi-key': apiKey,
      },
    });

    if (!response.ok) {
      const body = await response.text();
      const isMissingEndpoint =
        response.status === 404 ||
        body.includes(`Endpoint '/${endpoint}' does not exist`);
      if (isMissingEndpoint) {
        lastErrorMessage = `Endpoint ${endpoint} is not available.`;
        continue;
      }
      throw new Error(
        `Fantastic.jobs failed on ${endpoint}: ${response.status} ${body}`,
      );
    }

    const payload = (await response.json()) as unknown;
    const jobs = Array.isArray(payload) ? (payload as FantasticJob[]) : [];
    return {
      endpoint,
      jobs,
      rateLimit: parseRateLimitHeaders(response.headers),
    };
  }

  throw new Error(
    `Fantastic.jobs request failed for all endpoint candidates. Last error: ${lastErrorMessage}`,
  );
};

const resolveSerpDatePostedChip = (
  postedWithinDays?: number,
): string | undefined => {
  if (!postedWithinDays || postedWithinDays <= 0) return undefined;
  if (postedWithinDays <= 1) return 'today';
  if (postedWithinDays <= 3) return '3days';
  if (postedWithinDays <= 7) return 'week';
  return 'month';
};

const fetchSerpApiJobsPage = async (
  params: URLSearchParams,
): Promise<SerpApiJobSearchResultsResponse> => {
  const response = await fetch(
    `https://serpapi.com/search.json?${params.toString()}`,
    {
      cache: 'no-store',
    },
  );

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`SerpAPI failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as SerpApiJobSearchResultsResponse;
  if (payload.error) {
    throw new Error(payload.error);
  }

  return payload;
};

const loadState = async (stateFile: string): Promise<IngestionState> => {
  try {
    const raw = await readFile(stateFile, 'utf-8');
    const parsed = JSON.parse(raw) as IngestionState;
    return parsed || {};
  } catch {
    return {};
  }
};

const saveState = async (
  stateFile: string,
  state: IngestionState,
): Promise<void> => {
  const stateDir = dirname(stateFile);
  await mkdir(stateDir, { recursive: true });
  await writeFile(stateFile, JSON.stringify(state, null, 2), 'utf-8');
};

const recordIngestionAuditLog = async ({
  action,
  actionType,
  metadata,
  userId,
}: {
  action: string;
  actionType: string;
  metadata: Record<string, unknown>;
  userId: string;
}): Promise<void> => {
  try {
    await db.automationAuditLog.create({
      data: {
        userId,
        action,
        actionType,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error('[ingest] failed to persist audit log', error);
  }
};

const resolveUserId = async (explicitUserId?: string): Promise<string> => {
  if (explicitUserId) {
    const user = await db.user.findUnique({
      where: { id: explicitUserId },
      select: { id: true },
    });
    if (!user) {
      throw new Error(`User not found for id ${explicitUserId}`);
    }
    return user.id;
  }

  const firstUser = await db.user.findFirst({
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (!firstUser) {
    throw new Error(
      'No users found in the database. Pass --user-id explicitly.',
    );
  }
  return firstUser.id;
};

const runFantasticProvider = async ({
  options,
  userId,
  state,
}: {
  options: IngestOptions;
  userId: string;
  state: IngestionState;
}): Promise<ProviderRunSummary> => {
  const startOffset =
    options.mode === 'backfill' ? state.fantastic?.lastOffset || 0 : 0;
  const endpointCandidates =
    options.fantasticEndpoints.length > 0
      ? options.fantasticEndpoints
      : options.mode === 'backfill'
        ? [...BACKFILL_FANTASTIC_ENDPOINT_CANDIDATES]
        : [...SYNC_FANTASTIC_ENDPOINT_CANDIDATES];

  let offset = startOffset;
  let fetchedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCrossUserCount = 0;
  let apiRequests = 0;
  let selectedEndpoint: string | undefined =
    options.fantasticEndpoints.length > 0
      ? undefined
      : state.fantastic?.endpoint;
  let previousFirstJobId: string | undefined;

  const now = new Date();
  const defaultSyncDateFilter = formatIsoWithoutMs(
    new Date(now.getTime() - 2 * 60 * 60 * 1000),
  );
  const syncDateFilter =
    options.fantasticDateFilter ||
    state.fantastic?.lastDateFilter ||
    defaultSyncDateFilter;

  for (let page = 0; page < options.maxPagesPerProvider; page += 1) {
    const params = new URLSearchParams();
    params.set('description_type', 'text');
    params.set('include_ai', 'true');
    params.set('limit', String(options.fantasticLimit));
    params.set('location_filter', UNITED_STATES_LOCATION_FILTER);

    if (offset > 0) {
      params.set('offset', String(offset));
    }
    if (options.searchTerm?.trim()) {
      params.set('title_filter', options.searchTerm.trim());
    }
    if (options.remote === true) {
      params.set('ai_work_arrangement_filter', 'Remote Solely,Remote OK');
    }
    if (options.mode === 'sync' && syncDateFilter) {
      params.set('date_filter', syncDateFilter);
    }

    const prioritizedEndpoints = selectedEndpoint
      ? [
          selectedEndpoint,
          ...endpointCandidates.filter(item => item !== selectedEndpoint),
        ]
      : endpointCandidates;
    const response = await fetchFantasticJobsPage({
      endpointCandidates: prioritizedEndpoints,
      params,
    });
    apiRequests += 1;
    selectedEndpoint = response.endpoint;

    const jobs = response.jobs;
    fetchedCount += jobs.length;

    const firstJobId = jobs[0]?.id;
    if (firstJobId && firstJobId === previousFirstJobId) {
      console.log(
        `[fantastic] page=${page + 1} repeated first id (${firstJobId}), stopping pagination to avoid duplicate loop.`,
      );
      break;
    }
    previousFirstJobId = firstJobId;

    const listings = jobs
      .map(job => buildFantasticListing(userId, job))
      .filter(
        (item): item is Prisma.JobListingCreateManyInput => item !== null,
      );

    const persistResult = await persistListings({
      userId,
      listings,
      dryRun: options.dryRun,
      updateExisting: options.updateExisting,
      batchSize: options.batchSize,
    });
    createdCount += persistResult.createdCount;
    updatedCount += persistResult.updatedCount;
    skippedCrossUserCount += persistResult.skippedCrossUserCount;

    console.log(
      `[fantastic] page=${page + 1} endpoint=${response.endpoint} fetched=${jobs.length} created=${persistResult.createdCount} updated=${persistResult.updatedCount} jobsRemaining=${response.rateLimit.jobsRemaining ?? 'n/a'} requestsRemaining=${response.rateLimit.requestsRemaining ?? 'n/a'}`,
    );

    if (jobs.length < options.fantasticLimit) {
      break;
    }

    offset += options.fantasticLimit;
    state.fantastic = {
      ...state.fantastic,
      endpoint: selectedEndpoint,
      lastOffset: offset,
    };
    await saveState(options.stateFile, state);
    await sleep(options.sleepMs);
  }

  state.fantastic = {
    endpoint: selectedEndpoint,
    lastDateFilter: formatIsoWithoutMs(
      new Date(Date.now() - 2 * 60 * 60 * 1000),
    ),
    lastOffset: options.mode === 'backfill' ? offset : 0,
  };

  return {
    apiRequests,
    createdCount,
    fetchedCount,
    provider: 'fantastic',
    skippedCrossUserCount,
    updatedCount,
  };
};

const runUsaJobsProvider = async ({
  options,
  userId,
}: {
  options: IngestOptions;
  userId: string;
}): Promise<ProviderRunSummary> => {
  let fetchedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCrossUserCount = 0;
  let apiRequests = 0;

  for (let page = 1; page <= options.maxPagesPerProvider; page += 1) {
    const response = await searchUSAJobs({
      datePosted:
        typeof options.postedWithinDays === 'number' &&
        options.postedWithinDays > 0
          ? Math.min(options.postedWithinDays, 60)
          : undefined,
      keyword: options.searchTerm,
      locationName: UNITED_STATES_LOCATION_FILTER,
      page,
      remote: options.remote,
      resultsPerPage: options.usajobsResultsPerPage,
    });
    apiRequests += 1;

    const items = response.SearchResult.SearchResultItems ?? [];
    fetchedCount += items.length;
    if (items.length === 0) {
      break;
    }

    const listings = items.map(item =>
      buildUsaJobsListing(
        userId,
        item.MatchedObjectDescriptor,
        item.MatchedObjectId,
      ),
    );

    const persistResult = await persistListings({
      userId,
      listings,
      dryRun: options.dryRun,
      updateExisting: options.updateExisting,
      batchSize: options.batchSize,
    });
    createdCount += persistResult.createdCount;
    updatedCount += persistResult.updatedCount;
    skippedCrossUserCount += persistResult.skippedCrossUserCount;

    console.log(
      `[usajobs] page=${page} fetched=${items.length} created=${persistResult.createdCount} updated=${persistResult.updatedCount}`,
    );

    const numberOfPages = response.SearchResult.UserArea?.NumberOfPages || page;
    if (page >= numberOfPages || items.length < options.usajobsResultsPerPage) {
      break;
    }
    await sleep(options.sleepMs);
  }

  return {
    apiRequests,
    createdCount,
    fetchedCount,
    provider: 'usajobs',
    skippedCrossUserCount,
    updatedCount,
  };
};

const runSerpApiProvider = async ({
  options,
  userId,
}: {
  options: IngestOptions;
  userId: string;
}): Promise<ProviderRunSummary> => {
  const serpApiKey = process.env.SERP_API_SECRET;
  if (!serpApiKey) {
    throw new Error('SERP_API_SECRET is not set');
  }

  const datePostedChip = resolveSerpDatePostedChip(options.postedWithinDays);

  let fetchedCount = 0;
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCrossUserCount = 0;
  let apiRequests = 0;

  for (const query of options.serpQueries) {
    let nextPageToken: string | undefined;
    for (let page = 1; page <= options.serpPagesPerQuery; page += 1) {
      const params = new URLSearchParams({
        api_key: serpApiKey,
        engine: 'google_jobs',
        google_domain: 'google.com',
        location: UNITED_STATES_LOCATION_FILTER,
        no_cache: 'true',
        q: query.trim() || 'jobs',
      });

      if (options.remote) {
        params.set('ltype', '1');
      }
      if (datePostedChip) {
        params.set('chips_date_posted', datePostedChip);
      }
      if (nextPageToken) {
        params.set('next_page_token', nextPageToken);
      }

      let response: SerpApiJobSearchResultsResponse;
      try {
        response = await fetchSerpApiJobsPage(params);
        apiRequests += 1;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (isSerpApiNoResultsMessage(message)) {
          console.log(
            `[serpapi] query="${query}" page=${page} no results returned, stopping pagination for this query.`,
          );
          break;
        }
        throw error;
      }

      const jobs = Array.isArray(response.jobs_results)
        ? response.jobs_results
        : [];
      fetchedCount += jobs.length;

      if (jobs.length === 0) {
        break;
      }

      const listings = jobs.map(job =>
        buildSerpListing(userId, query, Boolean(options.remote), job),
      );
      const persistResult = await persistListings({
        userId,
        listings,
        dryRun: options.dryRun,
        updateExisting: options.updateExisting,
        batchSize: options.batchSize,
      });
      createdCount += persistResult.createdCount;
      updatedCount += persistResult.updatedCount;
      skippedCrossUserCount += persistResult.skippedCrossUserCount;

      console.log(
        `[serpapi] query="${query}" page=${page} fetched=${jobs.length} created=${persistResult.createdCount} updated=${persistResult.updatedCount}`,
      );

      nextPageToken = response.serpapi_pagination?.next_page_token;
      if (!nextPageToken) {
        break;
      }

      await sleep(options.sleepMs);
    }
  }

  return {
    apiRequests,
    createdCount,
    fetchedCount,
    provider: 'serpapi',
    skippedCrossUserCount,
    updatedCount,
  };
};

const printHelp = (): void => {
  const helpText = `
Usage:
  bun scripts/ingest-job-dataset.ts [options]

Options:
  --mode=backfill|sync               Ingestion mode (default: sync)
  --providers=fantastic,usajobs,serpapi
                                     Provider list (default: all three)
  --user-id=<id>                     User id to own ingested JobListing rows
  --search-term=<text>               Optional search term for providers
  --location=<text>                  Optional location filter
  --remote                           Remote-only when supported
  --posted-within-days=<n>           Recency window for sync (default: 1)
  --max-pages-per-provider=<n>       Max pages per provider run (default: 50)
  --batch-size=<n>                   Batch size for updates (default: 100)
  --sleep-ms=<n>                     Delay between provider requests (default: 300)
  --dry-run                          Parse/fetch/mapping only, no DB writes
  --update-existing                  Update existing rows in-place
  --state-file=<path>                Cursor file path (default: /tmp/gimme-job-ingest-state.json)

Location policy:
  All providers are currently locked to location="United States".
  --location is currently ignored.

Fantastic-specific:
  --fantastic-limit=<n>              Page limit (sync default: 100, backfill default: 500)
  --fantastic-date-filter=<ISO>      Force date_filter for sync mode
  --fantastic-endpoints=a,b,c        Override endpoint candidates

SerpAPI-specific:
  --serp-queries=a,b,c               Comma-separated queries (default: jobs)
  --serp-pages-per-query=<n>         Max pages per query (default: 2 sync, 10 backfill)

USAJobs-specific:
  --usajobs-results-per-page=<n>     Results per page (default: 500)
`;
  console.log(helpText.trim());
};

const parseOptions = (argv: string[]): IngestOptions => {
  const mode = parseMode(getArgValue(argv, 'mode'));
  const providers = normalizeProviderList(
    parseCsvArg(
      getArgValue(argv, 'providers'),
      mode === 'backfill' ? DEFAULT_BACKFILL_PROVIDERS : DEFAULT_PROVIDERS,
    ),
  );

  const postedWithinDays = parseIntegerArg(
    getArgValue(argv, 'posted-within-days'),
    mode === 'sync' ? 1 : 0,
  );
  const fantasticLimit = parseIntegerArg(
    getArgValue(argv, 'fantastic-limit'),
    mode === 'backfill' ? 500 : 100,
  );
  const fantasticEndpoints = parseCsvArg(
    getArgValue(argv, 'fantastic-endpoints'),
    [],
  );

  return {
    batchSize: parseIntegerArg(getArgValue(argv, 'batch-size'), 100),
    dryRun: parseBooleanArg(argv, 'dry-run', false),
    fantasticDateFilter: getArgValue(argv, 'fantastic-date-filter'),
    fantasticEndpoints,
    fantasticLimit:
      mode === 'backfill'
        ? Math.min(Math.max(fantasticLimit, 10), 500)
        : Math.min(Math.max(fantasticLimit, 10), 100),
    location: getArgValue(argv, 'location'),
    maxPagesPerProvider: parseIntegerArg(
      getArgValue(argv, 'max-pages-per-provider'),
      50,
    ),
    mode,
    postedWithinDays: postedWithinDays > 0 ? postedWithinDays : undefined,
    providers,
    remote: parseBooleanArg(argv, 'remote', false),
    searchTerm: getArgValue(argv, 'search-term'),
    serpPagesPerQuery: parseIntegerArg(
      getArgValue(argv, 'serp-pages-per-query'),
      mode === 'backfill' ? 10 : 2,
    ),
    serpQueries: parseCsvArg(
      getArgValue(argv, 'serp-queries'),
      DEFAULT_SERP_QUERIES,
    ),
    sleepMs: parseIntegerArg(getArgValue(argv, 'sleep-ms'), 300),
    stateFile: getArgValue(argv, 'state-file') || DEFAULT_STATE_FILE,
    updateExisting:
      parseBooleanArg(argv, 'update-existing', mode === 'sync') ||
      mode === 'sync',
    usajobsResultsPerPage: Math.min(
      Math.max(
        parseIntegerArg(getArgValue(argv, 'usajobs-results-per-page'), 500),
        25,
      ),
      500,
    ),
    userId: getArgValue(argv, 'user-id'),
  };
};

const run = async (): Promise<void> => {
  const argv = process.argv.slice(2);
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return;
  }

  const options = parseOptions(argv);
  const state = await loadState(options.stateFile);
  const userId = await resolveUserId(options.userId);
  const startedAt = new Date().toISOString();

  console.log('[ingest] starting');
  console.log(
    JSON.stringify(
      {
        mode: options.mode,
        providers: options.providers,
        dryRun: options.dryRun,
        location: options.location,
        remote: options.remote,
        searchTerm: options.searchTerm,
        postedWithinDays: options.postedWithinDays,
        maxPagesPerProvider: options.maxPagesPerProvider,
        stateFile: options.stateFile,
        fantasticLocation: UNITED_STATES_LOCATION_FILTER,
        serpApiLocation: UNITED_STATES_LOCATION_FILTER,
        userId,
      },
      null,
      2,
    ),
  );

  await recordIngestionAuditLog({
    userId,
    action: 'ingestion_script_run_started',
    actionType: 'info',
    metadata: {
      ingestionLocation: UNITED_STATES_LOCATION_FILTER,
      mode: options.mode,
      providers: options.providers,
      dryRun: options.dryRun,
      location: options.location ?? null,
      remote: Boolean(options.remote),
      searchTerm: options.searchTerm ?? null,
      postedWithinDays: options.postedWithinDays ?? null,
      maxPagesPerProvider: options.maxPagesPerProvider,
      stateFile: options.stateFile,
      startedAt,
    },
  });

  const providerSummaries: ProviderRunSummary[] = [];
  const providerFailures: ProviderFailure[] = [];
  const providerSet = new Set(options.providers);

  if (providerSet.has('fantastic')) {
    try {
      providerSummaries.push(
        await runFantasticProvider({
          options,
          state,
          userId,
        }),
      );
      const latestSummary = providerSummaries[providerSummaries.length - 1];
      await recordIngestionAuditLog({
        userId,
        action: 'ingestion_script_provider_run',
        actionType: 'success',
        metadata: {
          ...latestSummary,
          ingestionLocation: UNITED_STATES_LOCATION_FILTER,
          mode: options.mode,
          dryRun: options.dryRun,
          location: options.location ?? null,
          remote: Boolean(options.remote),
          searchTerm: options.searchTerm ?? null,
          startedAt,
        },
      });
      await saveState(options.stateFile, state);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerFailures.push({
        message,
        provider: 'fantastic',
      });
      console.error(`[ingest] fantastic failed: ${message}`);
      await recordIngestionAuditLog({
        userId,
        action: 'ingestion_script_provider_run',
        actionType: 'error',
        metadata: {
          ingestionLocation: UNITED_STATES_LOCATION_FILTER,
          provider: 'fantastic',
          error: message,
          mode: options.mode,
          dryRun: options.dryRun,
          location: options.location ?? null,
          remote: Boolean(options.remote),
          searchTerm: options.searchTerm ?? null,
          startedAt,
        },
      });
    }
  }

  if (providerSet.has('usajobs')) {
    try {
      providerSummaries.push(
        await runUsaJobsProvider({
          options,
          userId,
        }),
      );
      const latestSummary = providerSummaries[providerSummaries.length - 1];
      await recordIngestionAuditLog({
        userId,
        action: 'ingestion_script_provider_run',
        actionType: 'success',
        metadata: {
          ...latestSummary,
          ingestionLocation: UNITED_STATES_LOCATION_FILTER,
          mode: options.mode,
          dryRun: options.dryRun,
          location: options.location ?? null,
          remote: Boolean(options.remote),
          searchTerm: options.searchTerm ?? null,
          startedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerFailures.push({
        message,
        provider: 'usajobs',
      });
      console.error(`[ingest] usajobs failed: ${message}`);
      await recordIngestionAuditLog({
        userId,
        action: 'ingestion_script_provider_run',
        actionType: 'error',
        metadata: {
          ingestionLocation: UNITED_STATES_LOCATION_FILTER,
          provider: 'usajobs',
          error: message,
          mode: options.mode,
          dryRun: options.dryRun,
          location: options.location ?? null,
          remote: Boolean(options.remote),
          searchTerm: options.searchTerm ?? null,
          startedAt,
        },
      });
    }
  }

  if (providerSet.has('serpapi')) {
    try {
      providerSummaries.push(
        await runSerpApiProvider({
          options,
          userId,
        }),
      );
      const latestSummary = providerSummaries[providerSummaries.length - 1];
      await recordIngestionAuditLog({
        userId,
        action: 'ingestion_script_provider_run',
        actionType: 'success',
        metadata: {
          ...latestSummary,
          ingestionLocation: UNITED_STATES_LOCATION_FILTER,
          mode: options.mode,
          dryRun: options.dryRun,
          location: options.location ?? null,
          remote: Boolean(options.remote),
          searchTerm: options.searchTerm ?? null,
          startedAt,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      providerFailures.push({
        message,
        provider: 'serpapi',
      });
      console.error(`[ingest] serpapi failed: ${message}`);
      await recordIngestionAuditLog({
        userId,
        action: 'ingestion_script_provider_run',
        actionType: 'error',
        metadata: {
          ingestionLocation: UNITED_STATES_LOCATION_FILTER,
          provider: 'serpapi',
          error: message,
          mode: options.mode,
          dryRun: options.dryRun,
          location: options.location ?? null,
          remote: Boolean(options.remote),
          searchTerm: options.searchTerm ?? null,
          startedAt,
        },
      });
    }
  }

  state.lastRunAt = new Date().toISOString();
  await saveState(options.stateFile, state);

  const totals = providerSummaries.reduce(
    (acc, item) => ({
      apiRequests: acc.apiRequests + item.apiRequests,
      createdCount: acc.createdCount + item.createdCount,
      fetchedCount: acc.fetchedCount + item.fetchedCount,
      skippedCrossUserCount:
        acc.skippedCrossUserCount + item.skippedCrossUserCount,
      updatedCount: acc.updatedCount + item.updatedCount,
    }),
    {
      apiRequests: 0,
      createdCount: 0,
      fetchedCount: 0,
      skippedCrossUserCount: 0,
      updatedCount: 0,
    },
  );

  console.log('[ingest] provider summaries');
  for (const summary of providerSummaries) {
    console.log(
      `- ${summary.provider}: requests=${summary.apiRequests} fetched=${summary.fetchedCount} created=${summary.createdCount} updated=${summary.updatedCount} skippedCrossUser=${summary.skippedCrossUserCount}`,
    );
  }
  console.log(
    `[ingest] totals: requests=${totals.apiRequests} fetched=${totals.fetchedCount} created=${totals.createdCount} updated=${totals.updatedCount} skippedCrossUser=${totals.skippedCrossUserCount}`,
  );

  if (providerFailures.length > 0) {
    console.log('[ingest] provider failures');
    for (const failure of providerFailures) {
      console.log(`- ${failure.provider}: ${failure.message}`);
    }
  }

  if (providerSummaries.length === 0 && providerFailures.length > 0) {
    await recordIngestionAuditLog({
      userId,
      action: 'ingestion_script_run_completed',
      actionType: 'error',
      metadata: {
        ingestionLocation: UNITED_STATES_LOCATION_FILTER,
        mode: options.mode,
        providers: options.providers,
        startedAt,
        completedAt: new Date().toISOString(),
        totals,
        providerSummaries,
        providerFailures,
      },
    });
    throw new Error('All selected providers failed.');
  }

  await recordIngestionAuditLog({
    userId,
    action: 'ingestion_script_run_completed',
    actionType: providerFailures.length > 0 ? 'warn' : 'success',
    metadata: {
      ingestionLocation: UNITED_STATES_LOCATION_FILTER,
      mode: options.mode,
      providers: options.providers,
      startedAt,
      completedAt: new Date().toISOString(),
      totals,
      providerSummaries,
      providerFailures,
    },
  });
};

run()
  .catch(error => {
    console.error('[ingest] failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
