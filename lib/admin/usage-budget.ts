import { db } from '@/lib/db/client';
import { playwrightEnabled } from '@/lib/browser/playwright-runtime';

const FANTASTIC_MONTHLY_JOBS_LIMIT = 50_000;
const FANTASTIC_MONTHLY_REQUESTS_LIMIT = 50_000;

interface UsageMetadata {
  apiRequests?: unknown;
  error?: unknown;
  fetched?: unknown;
  provider?: unknown;
  scrapeId?: unknown;
}

export interface FantasticUsageBudget {
  cycleEnd: string;
  cycleStart: string;
  daysElapsed: number;
  daysInCycle: number;
  failedRuns: number;
  jobsLimit: number;
  jobsRemaining: number;
  jobsUsed: number;
  projectedJobsUsed: number;
  projectedRequestsUsed: number;
  providerRuns: number;
  requestsLimit: number;
  requestsRemaining: number;
  requestsUsed: number;
}

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
};

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

const getCycleBounds = (now: Date): { cycleEnd: Date; cycleStart: Date } => {
  const cycleStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  );
  const cycleEnd = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  );

  return { cycleEnd, cycleStart };
};

export const getFantasticUsageBudget =
  async (): Promise<FantasticUsageBudget> => {
    const now = new Date();
    const { cycleEnd, cycleStart } = getCycleBounds(now);

    const logs = await db.automationAuditLog.findMany({
      where: {
        action: {
          in: ['ingestion_provider_run', 'ingestion_script_provider_run'],
        },
        createdAt: {
          gte: cycleStart,
          lt: cycleEnd,
        },
      },
      select: {
        actionType: true,
        metadata: true,
      },
    });

    let jobsUsed = 0;
    let requestsUsed = 0;
    let providerRuns = 0;
    let failedRuns = 0;

    for (const log of logs) {
      const metadata =
        log.metadata && typeof log.metadata === 'object'
          ? (log.metadata as UsageMetadata)
          : {};

      const provider =
        typeof metadata.provider === 'string'
          ? metadata.provider.toLowerCase()
          : '';

      if (provider !== 'fantastic') {
        continue;
      }

      providerRuns += 1;
      if (log.actionType === 'error') {
        failedRuns += 1;
        continue;
      }

      jobsUsed += Math.max(0, Math.floor(toFiniteNumber(metadata.fetched)));
      requestsUsed += Math.max(
        0,
        Math.floor(toFiniteNumber(metadata.apiRequests)),
      );
    }

    const msElapsed = Math.max(now.getTime() - cycleStart.getTime(), 1);
    const daysElapsed = Math.max(msElapsed / 86_400_000, 1 / 24);
    const daysInCycle = Math.max(
      (cycleEnd.getTime() - cycleStart.getTime()) / 86_400_000,
      1,
    );
    const jobsPerDay = jobsUsed / daysElapsed;
    const requestsPerDay = requestsUsed / daysElapsed;

    return {
      cycleEnd: cycleEnd.toISOString(),
      cycleStart: cycleStart.toISOString(),
      daysElapsed,
      daysInCycle,
      failedRuns,
      jobsLimit: FANTASTIC_MONTHLY_JOBS_LIMIT,
      jobsRemaining: Math.max(FANTASTIC_MONTHLY_JOBS_LIMIT - jobsUsed, 0),
      jobsUsed,
      projectedJobsUsed: Math.round(jobsPerDay * daysInCycle),
      projectedRequestsUsed: Math.round(requestsPerDay * daysInCycle),
      providerRuns,
      requestsLimit: FANTASTIC_MONTHLY_REQUESTS_LIMIT,
      requestsRemaining: Math.max(
        FANTASTIC_MONTHLY_REQUESTS_LIMIT - requestsUsed,
        0,
      ),
      requestsUsed,
    };
  };

export interface SerpApiUsageBudget {
  searchesUsed: number;
  searchesLimit: number;
  searchesRemaining: number;
}

// ---------------------------------------------------------------------------
// Generic provider usage budget (audit-log based)
// ---------------------------------------------------------------------------

export interface ProviderUsageBudget {
  apiRequests: number;
  cycleEnd: string;
  cycleStart: string;
  failedRuns: number;
  jobsCreated: number;
  jobsFetched: number;
  jobsUpdated: number;
  lastError: string | null;
  lastRunAt: string | null;
  lastScrapeId: string | null;
  lastStatus: 'error' | 'success' | 'unknown';
  provider: string;
  providerRuns: number;
  rateLimit?: {
    daily?: number;
    monthly?: number;
    note?: string;
  };
  runtimeAvailable: boolean;
  unavailableReason: string | null;
}

const PLAYWRIGHT_UNAVAILABLE_REASON =
  'Requires a Chromium runtime. Run a worker with ENABLE_PLAYWRIGHT_RENDER=1 (Railway/Fly/DO/VPS) or point the app at a remote browser service.';

const PROVIDER_RATE_LIMITS: Record<
  string,
  { daily?: number; monthly?: number; note?: string }
> = {
  adzuna: { daily: 250, monthly: 2_500, note: 'Free tier: 250/day, 2,500/mo' },
  arbeitnow: { note: 'Public API, no known limits' },
  builtin: { note: 'HTML scraping, no API limits' },
  careerbuilder: { note: 'Public search API' },
  clawjobs: { note: 'Free public API, high-volume global feed' },
  'comeet-boards': { note: 'Free public ATS API, selected boards' },
  devitjobs: { note: 'Free public API, no auth, no limits' },
  'ashby-boards': { note: 'Free public ATS API, 26 AI/tech companies' },
  'breezy-boards': { note: 'Free public ATS API, selected boards' },
  'greenhouse-boards': { note: 'Free public ATS API, 50+ companies' },
  hackernews: { note: 'Free Firebase API, no limits' },
  'jazzhr-boards': { note: 'Free public ATS HTML, selected boards' },
  'jobvite-boards': { note: 'Free public ATS HTML, selected boards' },
  'lever-boards': { note: 'Free public ATS API, 20+ companies' },
  'indeed-scraper': { note: 'Playwright scraper, no auth, ~250/run' },
  'linkedin-guest': {
    note: 'Public guest scraper, no auth, rate limit ~400/run',
  },
  'smartrecruiters-boards': {
    note: 'Free public ATS API, enterprise companies',
  },
  'workday-boards': {
    note: 'Free public Workday CXS APIs, selected enterprise boards',
  },
  workingnomads: { note: 'Free public API, no limits' },
  fantastic: { monthly: 50_000, note: 'See Fantastic budget above' },
  findwork: {
    note: 'Developer jobs API, requires FINDWORK_API_KEY; no monthly cap configured',
  },
  himalayas: { note: 'Public API, no known limits' },
  jobicy: { note: 'Public API, no known limits' },
  jobdataapi: {
    note: 'Paid ATS-sourced jobs API, requires JOBDATAAPI_KEY',
  },
  jooble: { note: 'Free tier, limits undocumented' },
  remoteok: { note: 'Public API, no known limits' },
  'remotejobs-org': { note: 'Free public API, max 50 results/request' },
  remotefirstjobs: { note: 'Public API, no known limits' },
  remotive: { note: 'Public API, no known limits' },
  serpapi: { monthly: 5_000, note: 'See SerpAPI budget above' },
  themuse: { note: 'Public API, no known limits' },
  theirstack: {
    monthly: 200,
    note: 'Free plan: 200 API credits/month; guarded by audit-log usage',
  },
  usajobs: { note: 'Free government API, unlimited' },
  welcometothejungle: { note: 'Algolia-based, no known limits' },
  weworkremotely: { note: 'RSS feed, no limits' },
  workatastartup: { note: 'HTML scraping, no API limits' },
};

const PROVIDER_REQUIRED_ENV: Record<string, string> = {
  findwork: 'FINDWORK_API_KEY',
  jobdataapi: 'JOBDATAAPI_KEY',
  theirstack: 'THEIRSTACK_API_KEY',
};

export const getProviderUsageBudgets = async (): Promise<
  ProviderUsageBudget[]
> => {
  const now = new Date();
  const { cycleEnd, cycleStart } = getCycleBounds(now);

  const logs = await db.automationAuditLog.findMany({
    where: {
      action: {
        in: ['ingestion_provider_run', 'ingestion_script_provider_run'],
      },
      createdAt: {
        gte: cycleStart,
        lt: cycleEnd,
      },
    },
    select: {
      actionType: true,
      createdAt: true,
      metadata: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const byProvider = new Map<
    string,
    {
      apiRequests: number;
      failedRuns: number;
      jobsCreated: number;
      jobsFetched: number;
      jobsUpdated: number;
      lastError: string | null;
      lastRunAt: Date | null;
      lastScrapeId: string | null;
      lastStatus: 'error' | 'success' | 'unknown';
      providerRuns: number;
    }
  >();

  for (const log of logs) {
    const metadata =
      log.metadata && typeof log.metadata === 'object'
        ? (log.metadata as Record<string, unknown>)
        : {};

    const provider =
      typeof metadata.provider === 'string'
        ? metadata.provider.toLowerCase()
        : '';

    if (!provider) continue;

    let entry = byProvider.get(provider);
    if (!entry) {
      entry = {
        apiRequests: 0,
        failedRuns: 0,
        jobsCreated: 0,
        jobsFetched: 0,
        jobsUpdated: 0,
        lastError: null,
        lastRunAt: null,
        lastScrapeId: null,
        lastStatus: 'unknown',
        providerRuns: 0,
      };
      byProvider.set(provider, entry);
    }

    entry.providerRuns += 1;
    if (!entry.lastRunAt || log.createdAt > entry.lastRunAt) {
      entry.lastRunAt = log.createdAt;
      entry.lastError = toNullableString(metadata.error);
      entry.lastScrapeId = toNullableString(metadata.scrapeId);
      entry.lastStatus =
        log.actionType === 'success' || log.actionType === 'error'
          ? log.actionType
          : 'unknown';
    }

    if (log.actionType === 'error') {
      entry.failedRuns += 1;
      continue;
    }

    entry.apiRequests += Math.max(
      0,
      Math.floor(toFiniteNumber(metadata.apiRequests)),
    );
    entry.jobsFetched += Math.max(
      0,
      Math.floor(toFiniteNumber(metadata.fetched)),
    );
    entry.jobsCreated += Math.max(
      0,
      Math.floor(toFiniteNumber(metadata.created)),
    );
    entry.jobsUpdated += Math.max(
      0,
      Math.floor(toFiniteNumber(metadata.updated)),
    );
  }

  // Ensure all known providers are represented even if they have 0 runs
  for (const provider of Object.keys(PROVIDER_RATE_LIMITS)) {
    if (!byProvider.has(provider)) {
      byProvider.set(provider, {
        apiRequests: 0,
        failedRuns: 0,
        jobsCreated: 0,
        jobsFetched: 0,
        jobsUpdated: 0,
        lastError: null,
        lastRunAt: null,
        lastScrapeId: null,
        lastStatus: 'unknown',
        providerRuns: 0,
      });
    }
  }

  return Array.from(byProvider.entries())
    .map(([provider, data]) => {
      const requiredEnv = PROVIDER_REQUIRED_ENV[provider];
      const missingRequiredEnv = requiredEnv && !process.env[requiredEnv];
      const missingPlaywright =
        provider === 'indeed-scraper' && !playwrightEnabled;

      return {
        apiRequests: data.apiRequests,
        cycleEnd: cycleEnd.toISOString(),
        cycleStart: cycleStart.toISOString(),
        failedRuns: data.failedRuns,
        jobsCreated: data.jobsCreated,
        jobsFetched: data.jobsFetched,
        jobsUpdated: data.jobsUpdated,
        lastError: data.lastError,
        lastRunAt: data.lastRunAt?.toISOString() ?? null,
        lastScrapeId: data.lastScrapeId,
        lastStatus: data.lastStatus,
        provider,
        providerRuns: data.providerRuns,
        rateLimit: PROVIDER_RATE_LIMITS[provider],
        runtimeAvailable: !missingPlaywright && !missingRequiredEnv,
        unavailableReason: missingPlaywright
          ? PLAYWRIGHT_UNAVAILABLE_REASON
          : missingRequiredEnv
            ? `Set ${requiredEnv} to run this provider.`
            : null,
      };
    })
    .sort((a, b) => a.provider.localeCompare(b.provider));
};

export const getSerpApiUsageBudget =
  async (): Promise<SerpApiUsageBudget | null> => {
    const apiKey = process.env.SERP_API_SECRET;
    if (!apiKey) return null;

    try {
      const response = await fetch(
        `https://serpapi.com/account?api_key=${apiKey}`,
        { cache: 'no-store' },
      );
      if (!response.ok) return null;

      const data = (await response.json()) as {
        this_month_usage: number;
        plan_searches_left: number;
        total_searches_left: number;
      };

      const searchesUsed = data.this_month_usage ?? 0;
      const searchesRemaining = data.total_searches_left ?? 0;
      const searchesLimit = searchesUsed + searchesRemaining;

      return { searchesUsed, searchesLimit, searchesRemaining };
    } catch {
      return null;
    }
  };
