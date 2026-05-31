'use server';

import { load } from 'cheerio';

import {
  ATS_TYPES,
  type ATSType,
  type AtsScraperFetchContext,
  type AtsScraperResult,
  BaseScraper,
} from '@/lib/admin/scrapers/base';
import { ScraperRegistry } from '@/lib/admin/scrapers/registry';
import {
  loadChromium,
  requireChromium,
} from '@/lib/browser/playwright-runtime';
import {
  JobListingStatus,
  JobProvider,
  JobType,
  Prisma,
} from '@/generated/prisma/browser';

import {
  searchUSAJobs,
  type USAJobsMatchedObject,
} from '@/lib/api/usajobs-client';
import {
  searchTheirStackJobs,
  type TheirStackJob,
} from '@/lib/api/theirstack-client';
import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import {
  getPreferredApplyUrl,
  normalizeApplyOptions,
} from '@/lib/job-listings/normalize-apply-options';
import {
  type AdminScrapePersistBreakdown,
  type AdminScrapeProgressPayload,
  type AdminScrapeUpdatedListingPreview,
  DataEventType,
} from '@/types/events';

// ---------------------------------------------------------------------------
// Resilient fetch — retry wrapper with provider-aware policy
// ---------------------------------------------------------------------------

type RetryPolicy = 'api' | 'public-api' | 'none';

const RETRY_CONFIG: Record<
  RetryPolicy,
  { maxRetries: number; delayMs: number }
> = {
  api: { maxRetries: 2, delayMs: 3_000 },
  'public-api': { maxRetries: 1, delayMs: 5_000 },
  none: { maxRetries: 0, delayMs: 0 },
};

const isTransientError = (status: number): boolean =>
  status >= 500 || status === 0;

const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message.toLowerCase();
  return (
    msg.includes('econnreset') ||
    msg.includes('epipe') ||
    msg.includes('etimedout') ||
    msg.includes('enotfound') ||
    msg.includes('fetch failed') ||
    msg.includes('network') ||
    msg.includes('socket hang up') ||
    msg.includes('aborted')
  );
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function resilientFetch(
  input: string | URL | Request,
  init?: RequestInit & { retryPolicy?: RetryPolicy },
): Promise<Response> {
  const { retryPolicy = 'none', ...fetchInit } = init ?? {};
  const config = RETRY_CONFIG[retryPolicy];

  let lastError: unknown;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      const response = await fetch(input, fetchInit);

      if (response.ok || attempt >= config.maxRetries) {
        return response;
      }

      // Only retry on transient server errors — never on 4xx
      if (!isTransientError(response.status)) {
        return response;
      }

      console.warn(
        `[resilientFetch] ${response.status} on attempt ${attempt + 1}/${config.maxRetries + 1}, retrying in ${config.delayMs}ms...`,
      );
      await sleep(config.delayMs);
    } catch (error) {
      lastError = error;

      if (attempt >= config.maxRetries || !isNetworkError(error)) {
        throw error;
      }

      console.warn(
        `[resilientFetch] Network error on attempt ${attempt + 1}/${config.maxRetries + 1}: ${error instanceof Error ? error.message : String(error)}`,
      );
      await sleep(config.delayMs);
    }
  }

  throw lastError;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FANTASTIC_API_BASE = 'https://active-jobs-db.p.rapidapi.com';
const FANTASTIC_HOST = 'active-jobs-db.p.rapidapi.com';
const INGESTION_LOCATION_FILTER = 'United States';
const FANTASTIC_SYNC_MAX_PAGES = 5;
const FANTASTIC_WEEKLY_MAX_PAGES = 50;
const FANTASTIC_BACKFILL_MAX_PAGES = 50;
const FANTASTIC_SYNC_LIMIT = 50;
const FANTASTIC_WEEKLY_LIMIT = 50;
const FANTASTIC_BACKFILL_LIMIT = 50;
const FANTASTIC_MODIFIED_LIMIT = 50;
const FANTASTIC_MODIFIED_MAX_PAGES = 5;
const FANTASTIC_SAFETY_MIN_REMAINING_JOBS = 1_000;
const DB_UPDATE_BATCH_SIZE = 25;
const WWR_FEED_URL = 'https://weworkremotely.com/remote-jobs.rss';
const WWR_ITEMS_PER_PAGE = 25;
const OPENJOBS_URL = 'https://digidai.github.io/openjobs/';
const OPENJOBS_ITEMS_PER_PAGE = 50;
const REMOTE_OK_API_URL = 'https://remoteok.com/api';
const REMOTE_OK_ITEMS_PER_PAGE = 25;
const JOBICY_API_URL = 'https://jobicy.com/api/v2/remote-jobs';
const JOBICY_ITEMS_PER_PAGE = 50;
const REMOTIVE_API_URL = 'https://remotive.com/api/remote-jobs';
const REMOTIVE_ITEMS_PER_PAGE = 50;
const BUILTIN_JOBS_URL = 'https://builtin.com/jobs';
const BUILTIN_ITEMS_PER_PAGE = 10;
const THE_MUSE_API_URL = 'https://www.themuse.com/api/public/jobs';
const THE_MUSE_ITEMS_PER_PAGE = 20;
const CAREERBUILDER_API_URL =
  'https://appsapi.monster.io/jobs-svx-service/v2/monster/search-jobs/samsearch/en-US';
const CAREERBUILDER_API_KEY = 'hkp1igv13sjt7ltv5kfdhjpj';
const CAREERBUILDER_JOBS_URL =
  'https://www.careerbuilder.com/job-listings/search';
const CAREERBUILDER_ITEMS_PER_PAGE = 10;
const CAREERBUILDER_SITE_ID = 'careerbuilder.com';
const WELCOME_TO_THE_JUNGLE_ALGOLIA_URL =
  'https://CSEKHVMS53-dsn.algolia.net/1/indexes/wttj_jobs_production_en/query';
const WELCOME_TO_THE_JUNGLE_APP_ID = 'CSEKHVMS53';
const WELCOME_TO_THE_JUNGLE_API_KEY = '4bd8f6215d0cc52b26430765769e65a0';
const WELCOME_TO_THE_JUNGLE_JOBS_URL =
  'https://www.welcometothejungle.com/en/jobs';
const WELCOME_TO_THE_JUNGLE_ITEMS_PER_PAGE = 20;
const HIMALAYAS_API_URL = 'https://himalayas.app/jobs/api/search';
const HIMALAYAS_ITEMS_PER_PAGE = 20;
const ARBEITNOW_API_URL = 'https://www.arbeitnow.com/api/job-board-api';
const ARBEITNOW_ITEMS_PER_PAGE = 100;
const REMOTE_FIRST_JOBS_API_URL = 'https://remotefirstjobs.com/api/search-jobs';
const REMOTE_FIRST_JOBS_ITEMS_PER_PAGE = 100;
const REMOTEJOBS_ORG_API_URL = 'https://remotejobs.org/api/v1/jobs';
const REMOTEJOBS_ORG_ITEMS_PER_PAGE = 50;
const CLAWJOBS_API_URL = 'https://api.clawjobs.cc/v1/jobs';
const CLAWJOBS_ITEMS_PER_PAGE = 100;
const COMEET_API_URL = 'https://www.comeet.co/careers-api/2.0/company';
const JOBDATA_API_URL = 'https://jobdataapi.com/api/jobs/';
const JOBDATA_API_ITEMS_PER_PAGE = 100;
const FINDWORK_API_URL = 'https://findwork.dev/api/jobs/';
const THEIRSTACK_ITEMS_PER_PAGE = 25;
const THEIRSTACK_MONTHLY_API_REQUEST_LIMIT = 200;
const THEIRSTACK_REQUEST_DELAY_MS = 650;
const THEIRSTACK_SYNC_MAX_PAGES = 3;
const THEIRSTACK_BACKFILL_MAX_PAGES = 5;
const WORK_AT_A_STARTUP_JOBS_URL = 'https://www.workatastartup.com/jobs';
const ADZUNA_API_URL = 'https://api.adzuna.com/v1/api/jobs';
const ADZUNA_ITEMS_PER_PAGE = 20;
const ADZUNA_COUNTRY = 'us';
const JOOBLE_API_URL = 'https://jooble.org/api';
const JOOBLE_ITEMS_PER_PAGE = 20;
const DEVITJOBS_API_URL = 'https://devitjobs.com/api/jobsLight';
const WORKING_NOMADS_API_URL =
  'https://www.workingnomads.com/api/exposed_jobs/';
const HN_JOBS_API_URL = 'https://hacker-news.firebaseio.com/v0';
const NODESK_FEED_URL = 'https://nodesk.co/remote-jobs/index.xml';
const NODESK_ITEMS_PER_PAGE = 25;
const JOBSPRESSO_AJAX_URL = 'https://jobspresso.co/jm-ajax/get_listings/';
const JOBSPRESSO_ITEMS_PER_PAGE = 20;
const PYTHON_ORG_JOBS_FEED_URL = 'https://www.python.org/jobs/feed/rss/';
const PYTHON_ORG_JOBS_ITEMS_PER_PAGE = 25;
const DJANGO_JOB_BOARD_FEED_URL = 'https://djangojobboard.com/feed/';
const DJANGO_JOB_BOARD_ITEMS_PER_PAGE = 25;
const GREENHOUSE_BOARDS_API = 'https://boards-api.greenhouse.io/v1/boards';
const LEVER_BOARDS_API = 'https://api.lever.co/v0/postings';
const TOP_GREENHOUSE_BOARDS = [
  // Tier 1: 300+ jobs
  'databricks',
  'stripe',
  'okta',
  'anthropic',
  'airbnb',
  // Tier 2: 100–300 jobs
  'elastic',
  'figma',
  'asana',
  'twilio',
  'contentful',
  'vercel',
  'cloudflare',
  'airtable',
  'brex',
  'gusto',
  'plaid',
  'ramp',
  'scale',
  'retool',
  'snyk',
  'sourcegraph',
  'grafana-labs',
  // Tier 3: 30–100 jobs
  'dropbox',
  'cockroachlabs',
  'hashicorp',
  'netlify',
  'supabase',
  'linear',
  'raycast',
  'replit',
  'fly',
  'dbt-labs',
  'postman',
  'gitlab',
  'twitch',
  'pinterest',
  'lyft',
  'doordash',
  'instacart',
  'robinhood',
  'coinbase',
  'kraken-digital-asset-exchange',
  'discord',
  'duolingo',
  'nerdwallet',
  'affirm',
  'chime',
  'wealthsimple',
  'palantir',
  'verkada',
  'anduril',
  'reddit',
  'notion',
  'loom',
  'miro',
  'pagerduty',
  'mixpanel',
  'amplitude',
  'launchdarkly',
  'watershed',
  'materialize',
  'planetscale',
];
const TOP_LEVER_BOARDS = [
  'Netflix',
  'reddit',
  'spotify',
  'cloudflare',
  'figma',
  'twilio',
  'squarespace',
  'zapier',
  'webflow',
  'ironclad',
  'momentive',
  'grammarly',
  'samsara',
  'faire',
  'amplitude',
  'notion',
  'cockroachlabs',
  'lacework',
  'snorkel-ai',
];

const LINKEDIN_GUEST_API =
  'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
const LINKEDIN_JOBS_PER_PAGE = 10;
const ASHBY_BOARDS_API = 'https://api.ashbyhq.com/posting-api/job-board';
const TOP_ASHBY_BOARDS = [
  'openai',
  'notion',
  'ramp',
  'linear',
  'plaid',
  'cohere',
  'cursor',
  'perplexity-ai',
  'harvey',
  'persona',
  'anyscale',
  'coreweave',
  'eleven-labs',
  'glean',
  'assembled',
  'warp',
  'runway',
  'replicate',
  'sambanova',
  'together-ai',
  'luma-ai',
  'inflection',
  'ironclad',
  'mistral',
  'dbt-labs',
  'midjourney',
];
const SMARTRECRUITERS_API = 'https://api.smartrecruiters.com/v1/companies';
const TOP_SMARTRECRUITERS_BOARDS = [
  'Visa',
  'CiscoSystems',
  'CapitalOne',
  'Salesforce',
  'PepsiCo',
  'WaltDisneyCompany',
  'JohnsonAndJohnson',
  'BMO',
  'McDonald',
];
const TOP_RECRUITEE_BOARDS = ['bunq'];

// Workable public widget API: https://apply.workable.com/api/v3/accounts/{slug}/jobs
const TOP_WORKABLE_BOARDS = [
  'shopify',
  'segment',
  'curve',
  'rippling',
  'verbit',
  'arcteryx',
  'getyourguide',
  'soundcloud',
  'lemonade',
  'travelperk',
];

// Teamtailor public job board: https://career.{slug}.teamtailor.com/jobs.json
const TOP_TEAMTAILOR_BOARDS = [
  'pleo',
  'epidemicsound',
  'mews',
  'tibber',
  'kry',
  'planhat',
  'dixa',
  'kahoot',
  'tessian',
];

// BambooHR public careers list: https://{slug}.bamboohr.com/careers/list
const TOP_BAMBOOHR_BOARDS = [
  'webflow',
  'thredup',
  'oneilllabs',
  'logikcull',
  'fountain',
  'gather',
];

// Personio public job board XML: https://{slug}.jobs.personio.com/xml?language=en
const TOP_PERSONIO_BOARDS = [
  'personio',
  'celonis',
  'getsafe',
  'mister-spex',
  'flink',
  'choco',
  'taxfix',
  'kry',
];

// Pallet public job board JSON: https://{slug}.pallet.com/jobs and
// https://{slug}.pallet.com/api/v1/jobs (community-curated boards)
const TOP_PALLET_BOARDS = [
  'fractional',
  'designer-fund-bridge',
  'pioneer',
  'maven',
  'south-park-commons',
];

// Pinpoint public board JSON: https://{slug}.pinpointhq.com/jobs.json
const TOP_PINPOINT_BOARDS = [
  'monzo',
  'cleo',
  'multiverse',
  'beauhurst',
  'bulb',
];

const TOP_WORKDAY_BOARDS = [
  {
    company: 'NVIDIA',
    host: 'nvidia.wd5.myworkdayjobs.com',
    site: 'NVIDIAExternalCareerSite',
    tenant: 'nvidia',
  },
  {
    company: 'Salesforce',
    host: 'salesforce.wd12.myworkdayjobs.com',
    site: 'External_Career_Site',
    tenant: 'salesforce',
  },
  {
    company: 'Adobe',
    host: 'adobe.wd5.myworkdayjobs.com',
    site: 'external_experienced',
    tenant: 'adobe',
  },
  {
    company: 'Workday',
    host: 'workday.wd5.myworkdayjobs.com',
    site: 'Workday',
    tenant: 'workday',
  },
  {
    company: 'General Motors',
    host: 'generalmotors.wd5.myworkdayjobs.com',
    site: 'Careers_GM',
    tenant: 'generalmotors',
  },
  {
    company: 'Marsh McLennan',
    host: 'mmc.wd1.myworkdayjobs.com',
    site: 'mmc',
    tenant: 'mmc',
  },
  {
    company: 'Booz Allen',
    host: 'bah.wd1.myworkdayjobs.com',
    site: 'BAH_Jobs',
    tenant: 'bah',
  },
  {
    company: 'HP',
    host: 'hp.wd5.myworkdayjobs.com',
    site: 'ExternalCareerSite',
    tenant: 'hp',
  },
  {
    company: 'Mastercard',
    host: 'mastercard.wd1.myworkdayjobs.com',
    site: 'CorporateCareers',
    tenant: 'mastercard',
  },
  {
    company: 'Comcast',
    host: 'comcast.wd5.myworkdayjobs.com',
    site: 'Comcast_Careers',
    tenant: 'comcast',
  },
] as const;

const TOP_COMEET_BOARDS = [
  {
    company: 'Moon Active',
    token: '2ACD5C02AC10081008AB01560180C804',
    uid: 'A2.00C',
  },
  {
    company: 'MWDN',
    token: '1655946F92CA85E9C35946F99C3165',
    uid: '61.005',
  },
  {
    company: 'Blink Ops',
    token: '7C42E981F101F10365C174C2E98F88F880',
    uid: 'C7.004',
  },
] as const;

const TOP_BREEZY_BOARDS = ['25madison-llc', 'alt-legal', '75f', 'vosyn'];

const TOP_JOBVITE_BOARDS = ['voices', 'ashcompanies'];

const TOP_JAZZHR_BOARDS = [
  'cni',
  'dtexsystems',
  'coheretechnology',
  'labelmaster',
  'foundationai',
  'infinx',
  'tillsterinc',
  'ascent',
  'serigorinc',
];

// Single-source RSS feed (no per-company iteration; feed yields all jobs)
const CRUNCHBOARD_FEED_URL = 'https://www.crunchboard.com/feed/';

const ADMIN_EMAIL = 'bright-and-early@outlook.com';

/**
 * Fantastic Jobs API strategy (from the official docs):
 *
 * - **7d endpoint**: call once/week at the same day+time → no duplicates
 * - **24h endpoint**: call once/day at the same time → no duplicates
 * - **1h endpoint** (Ultra+): call once/hour at the same time → no duplicates
 * - **backfill (6m)**: one-time fill, up to 500/request
 * - **expired**: once/day, IDs only (doesn't cost job credits)
 * - **modified**: once/day, up to 500/request (doesn't cost job credits)
 *
 * Rate-limit headers:
 *   x-ratelimit-jobs-limit / x-ratelimit-jobs-remaining
 *   x-ratelimit-requests-limit / x-ratelimit-requests-remaining
 *   x-ratelimit-jobs-reset (seconds until reset)
 *
 * SerpAPI strategy:
 *   Developer plan = 5,000 searches/month (~3,800 remaining).
 *   Subscription cancelled — burn ~4,000 on cron, keep ~1,000 for manual.
 *   Each page = 1 search credit. ~10 results/page.
 *   Sync (cron): up to 130 pages/run (130 credits/day × 30 = ~3,900/month).
 *   Backfill (manual): up to 50 pages/run.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ScrapeProvider =
  | 'careerbuilder'
  | 'builtin'
  | 'fantastic'
  | 'serpapi'
  | 'themuse'
  | 'welcometothejungle'
  | 'usajobs'
  | 'workatastartup'
  | 'weworkremotely'
  | 'remoteok'
  | 'jobicy'
  | 'remotive'
  | 'himalayas'
  | 'arbeitnow'
  | 'remotefirstjobs'
  | 'remotejobs-org'
  | 'clawjobs'
  | 'comeet-boards'
  | 'theirstack'
  | 'jobdataapi'
  | 'findwork'
  | 'adzuna'
  | 'jooble'
  | 'devitjobs'
  | 'workingnomads'
  | 'hackernews'
  | 'openjobs'
  | 'nodesk'
  | 'jobspresso'
  | 'python-org'
  | 'django-job-board'
  | 'greenhouse-boards'
  | 'lever-boards'
  | 'ashby-boards'
  | 'smartrecruiters-boards'
  | 'recruitee-boards'
  | 'workable-boards'
  | 'teamtailor-boards'
  | 'bamboohr-boards'
  | 'personio-boards'
  | 'pallet-boards'
  | 'pinpoint-boards'
  | 'workday-boards'
  | 'breezy-boards'
  | 'jobvite-boards'
  | 'jazzhr-boards'
  | 'crunchboard'
  | 'linkedin-guest'
  | 'indeed-scraper';
export type ScrapeMode = 'sync' | 'weekly' | 'backfill';

export interface ScrapeOptions {
  mode: ScrapeMode;
  providers: ScrapeProvider[];
  searchTerm?: string;
  location?: string;
  postedWithin?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages?: number;
  providerOverrides?: Partial<
    Record<
      ScrapeProvider,
      {
        insertAnyway?: boolean;
        location?: string;
        maxPages?: number;
        postedWithin?: string;
        remote?: boolean;
        searchTerm?: string;
      }
    >
  >;
  scrapeId?: string;
  trigger?: 'cron' | 'manual';
  userId: string;
  // Optional cancellation hook. When provided, runAdminScrape calls
  // this on every progress broadcast and aborts the run if it returns
  // true. Lets the desktop electron-main caller manage its own
  // cancellation Set without going through /app/api/admin/scrape/route.
  // The web /api/admin/scrape route does not pass this — it falls back
  // to the dynamic-imported isScrapeIdCancelled() from its own module.
  isScrapeIdCancelled?: (scrapeId: string) => boolean;
}

interface ProviderRunResult extends AtsScraperResult {
  provider?: string;
  recentCreatedListings?: AdminScrapeProgressPayload['recentCreatedListings'];
  recentUpdatedListings?: AdminScrapeProgressPayload['recentUpdatedListings'];
  skipped: number;
  stopReason?: string;
  updated: number;
  metadata?: Record<string, unknown>;
}

const ATS_PROVIDER_MAP: Partial<Record<ScrapeProvider, ATSType>> = {
  'ashby-boards': ATS_TYPES.ASHBY,
  'greenhouse-boards': ATS_TYPES.GREENHOUSE,
  'lever-boards': ATS_TYPES.LEVER,
};

const runRegisteredAtsScraper = async ({
  ats,
  context,
}: {
  ats: ATSType;
  context: AtsScraperFetchContext;
}): Promise<AtsScraperResult> => {
  const scraper = ScraperRegistry.get(ats);
  return scraper.fetch(context);
};

interface BuiltInTrackedJob {
  featured?: boolean;
  id?: number;
  published_date?: string;
}

interface FantasticRateLimit {
  jobsLimit?: number;
  jobsRemaining?: number;
  jobsResetSeconds?: number;
  requestsLimit?: number;
  requestsRemaining?: number;
}

interface FantasticJob {
  id: string;
  date_created?: string;
  date_posted?: string;
  description_text?: string | null;
  employment_type?: string | string[] | null;
  locations_alt_raw?: string[] | null;
  locations_derived?: string[] | null;
  locations_raw?:
    | {
        address?: {
          addressCountry?: string;
          addressLocality?: string;
          addressRegion?: string;
        };
      }[]
    | null;
  organization?: string | null;
  organization_logo?: string | null;
  organization_url?: string | null;
  remote_derived?: boolean | null;
  ai_work_arrangement?: string | null;
  salary_raw?: string | Record<string, unknown> | null;
  source?: string | null;
  title?: string | null;
  url?: string | null;
}

interface SerpApiJob {
  job_id?: string;
  title?: string;
  company_name?: string;
  location?: string;
  description?: string;
  via?: string;
  share_link?: string;
  thumbnail?: string;
  extensions?: string[];
  detected_extensions?: {
    posted_at?: string;
    schedule_type?: string;
    work_from_home?: boolean;
    salary?: string;
    health_insurance?: boolean;
    dental_coverage?: boolean;
    paid_time_off?: boolean;
  };
  apply_options?: { title?: string; link?: string }[];
}

interface WeWorkRemotelyJob {
  category?: string;
  company?: string;
  country?: string;
  description?: string;
  jobType?: string;
  link?: string;
  location?: string;
  logoUrl?: string;
  postedAt?: Date | null;
  skills: string[];
  title?: string;
}

interface NoDeskJob {
  company?: string;
  description?: string;
  link?: string;
  location?: string;
  postedAt?: Date | null;
  title?: string;
}

interface OpenJobsJob {
  company?: string;
  companyLogoUrl?: string;
  link?: string;
  title?: string;
}

interface JobspressoJob {
  category?: string;
  company?: string;
  companyLogoUrl?: string;
  dateLabel?: string;
  description?: string;
  link?: string;
  location?: string;
  title?: string;
}

interface JobspressoResponse {
  found_jobs?: boolean;
  html?: string;
  max_num_pages?: number;
}

interface BasicRssJob {
  company?: string;
  description?: string;
  guid?: string;
  link?: string;
  location?: string;
  postedAt?: Date | null;
  title?: string;
}

interface RemoteOkJob {
  apply_url?: string;
  company?: string;
  company_logo?: string;
  date?: string;
  description?: string;
  id?: number | string;
  location?: string;
  position?: string;
  salary_max?: number;
  salary_min?: number;
  tags?: string[];
  url?: string;
}

interface BuiltInJob {
  applyUrl?: string;
  company?: string;
  companyLogoUrl?: string;
  description?: string;
  experienceLevel?: string;
  industries?: string[];
  jobId: string;
  location?: string;
  postedAt?: string | null;
  remoteMode?: string;
  salary?: string;
  title: string;
  topSkills?: string[];
  url: string;
}

interface TheMuseJob {
  company?: {
    name?: string;
  };
  contents?: string;
  id?: number;
  locations?: Array<{
    name?: string;
  }>;
  name?: string;
  publication_date?: string;
  refs?: {
    landing_page?: string;
  };
  short_name?: string;
}

interface CareerBuilderJobLocation {
  address?: {
    addressCountry?: string;
    addressLocality?: string;
    addressRegion?: string;
  };
}

interface CareerBuilderJob {
  apply?: {
    applyType?: string;
    applyUrl?: string;
  };
  canonicalUrl?: string;
  createdDate?: string;
  dateRecency?: string;
  enrichments?: {
    employmentTypes?: Array<{
      name?: string;
    }>;
    jobLocationType?: {
      name?: string;
    };
  };
  formattedDate?: string;
  jobId?: string;
  jobPosting?: {
    baseSalary?: {
      currency?: string;
      value?: {
        maxValue?: number;
        minValue?: number;
        unitText?: string;
      };
    };
    datePosted?: string;
    description?: string;
    employmentType?: string[];
    hiringOrganization?: {
      logo?: string;
      name?: string;
      sameAs?: string;
    };
    jobLocation?: CareerBuilderJobLocation[];
    title?: string;
    url?: string;
  };
  localizedMonsterUrls?: Array<{
    url?: string;
  }>;
  provider?: {
    name?: string;
  };
  seoJobId?: string;
}

interface CareerBuilderResponse {
  estimatedTotalSize?: number;
  jobResults?: CareerBuilderJob[];
}

interface WelcomeToTheJungleOffice {
  city?: string;
  country?: string;
  country_code?: string;
  state?: string;
}

interface WelcomeToTheJungleJob {
  contract_type?: string;
  has_remote?: boolean;
  name?: string;
  objectID?: string;
  offices?: WelcomeToTheJungleOffice[];
  organization?: {
    logo?: {
      thumb?: {
        url?: string;
      };
      url?: string;
    };
    name?: string;
    slug?: string;
  };
  published_at?: string;
  published_at_timestamp?: number;
  remote?: string;
  slug?: string;
  summary?: string;
  reference?: string;
  salary_currency?: string | null;
  salary_maximum?: number | null;
  salary_minimum?: number | null;
  salary_period?: string | null;
}

interface WelcomeToTheJungleResponse {
  hits?: WelcomeToTheJungleJob[];
  nbPages?: number;
}

interface WorkAtAStartupPageProps {
  jobs?: WorkAtAStartupJob[];
}

interface WorkAtAStartupPagePayload {
  props?: WorkAtAStartupPageProps;
}

interface WorkAtAStartupJob {
  applyUrl?: string;
  companyBatch?: string;
  companyLogoUrl?: string;
  companyName?: string;
  companyOneLiner?: string;
  id?: number;
  jobType?: string;
  location?: string;
  roleType?: string;
  title?: string;
}

interface JobicyJob {
  companyLogo?: string;
  companyName?: string;
  id?: number;
  jobDescription?: string;
  jobExcerpt?: string;
  jobGeo?: string;
  jobIndustry?: string[];
  jobLevel?: string;
  jobSlug?: string;
  jobTitle?: string;
  jobType?: string[];
  pubDate?: string;
  salaryCurrency?: string;
  salaryMin?: number;
  salaryPeriod?: string;
  url?: string;
}

interface JobicyResponse {
  jobs?: JobicyJob[];
}

interface RemotiveJob {
  candidate_required_location?: string;
  category?: string;
  company_logo?: string;
  company_name?: string;
  description?: string;
  id?: number;
  job_type?: string;
  publication_date?: string;
  salary?: string;
  tags?: string[];
  title?: string;
  url?: string;
}

interface RemotiveResponse {
  jobs?: RemotiveJob[];
}

interface HimalayasJob {
  applicationLink?: string;
  categories?: string[];
  companyLogo?: string;
  companyName?: string;
  companySlug?: string;
  currency?: string;
  description?: string;
  employmentType?: string;
  excerpt?: string;
  guid?: string;
  locationRestrictions?: string[];
  maxSalary?: number | null;
  minSalary?: number | null;
  pubDate?: number | string;
  seniority?: string[];
  title?: string;
}

interface HimalayasResponse {
  jobs?: HimalayasJob[];
  limit?: number;
  totalCount?: number;
}

interface ArbeitnowJob {
  company_name?: string;
  created_at?: number | string;
  description?: string;
  job_types?: string[];
  location?: string;
  remote?: boolean;
  slug?: string;
  tags?: string[];
  title?: string;
  url?: string;
}

interface ArbeitnowResponse {
  data?: ArbeitnowJob[];
  links?: {
    next?: string | null;
  };
  meta?: {
    current_page?: number;
    per_page?: number;
  };
}

interface RemoteFirstJobsJob {
  category?: string;
  company_logo?: string;
  company_name?: string;
  description?: string;
  id?: string;
  locations?: string[];
  published_at?: string;
  salary_max?: number;
  salary_min?: number;
  seniority?: string;
  title?: string;
  url?: string;
}

interface RemoteFirstJobsResponse {
  jobs?: RemoteFirstJobsJob[];
  jobs_count?: number;
}

interface RemoteJobsOrgJob {
  apply_url?: string | null;
  category?: {
    name?: string | null;
    slug?: string | null;
  } | null;
  company?: {
    logo_url?: string | null;
    name?: string | null;
    url?: string | null;
    website?: string | null;
  } | null;
  description?: string | null;
  id?: string | null;
  location?: string | null;
  posted_at?: string | null;
  salary_max?: number | null;
  salary_min?: number | null;
  salary_text?: string | null;
  title?: string | null;
  type?: string | null;
  url?: string | null;
}

interface RemoteJobsOrgResponse {
  data?: RemoteJobsOrgJob[];
  pagination?: {
    has_more?: boolean;
  };
}

interface ClawJobsJob {
  company_category?: string | null;
  company_name?: string | null;
  created_at?: string | null;
  department?: string | null;
  id?: number | string | null;
  location?: string[];
  remote?: boolean | null;
  title?: string | null;
}

interface ClawJobsResponse {
  data?: ClawJobsJob[];
  meta?: {
    has_more?: boolean;
    limit?: number;
    offset?: number;
    total?: number;
  };
}

interface ComeetBoardConfig {
  company: string;
  token: string;
  uid: string;
}

interface ComeetJobDetail {
  name?: string | null;
  order?: number | null;
  value?: string | null;
}

interface ComeetJobLocation {
  city?: string | null;
  country?: string | null;
  is_remote?: boolean | null;
  name?: string | null;
  state?: string | null;
}

interface ComeetJobCategory {
  name?: string | null;
  order?: number | null;
  value?: string | null;
}

interface ComeetJob {
  categories?: ComeetJobCategory[];
  company_name?: string | null;
  department?: string | null;
  details?: ComeetJobDetail[];
  employment_type?: string | null;
  experience_level?: string | null;
  location?: ComeetJobLocation | null;
  name?: string | null;
  picture_url?: string | null;
  position_url?: string | null;
  time_updated?: string | null;
  uid?: string | null;
  url_active_page?: string | null;
  url_comeet_hosted_page?: string | null;
  workplace_type?: string | null;
}

interface JobDataApiCompany {
  logo?: string | null;
  name?: string | null;
  website_url?: string | null;
}

interface JobDataApiLabel {
  name?: string | null;
}

interface JobDataApiJob {
  application_url?: string | null;
  cities?: JobDataApiLabel[];
  company?: JobDataApiCompany | null;
  countries?: JobDataApiLabel[];
  description?: string | null;
  description_str?: string | null;
  description_string?: string | null;
  ext_id?: string | null;
  has_remote?: boolean | null;
  id?: number | string | null;
  job_type?: string | null;
  job_types?: JobDataApiLabel[];
  location?: string | null;
  location_string?: string | null;
  published?: string | null;
  salary_currency?: string | null;
  salary_max?: number | string | null;
  salary_min?: number | string | null;
  states?: JobDataApiLabel[];
  title?: string | null;
  types?: JobDataApiLabel[];
}

interface JobDataApiResponse {
  next?: string | null;
  results?: JobDataApiJob[];
}

interface FindworkJob {
  company_name?: string | null;
  date_posted?: string | null;
  id?: number | string | null;
  keywords?: string[];
  location?: string | null;
  remote?: boolean | null;
  role?: string | null;
  text?: string | null;
  title?: string | null;
  url?: string | null;
}

interface FindworkResponse {
  next?: string | null;
  results?: FindworkJob[];
}

interface WorkdayBoardConfig {
  company: string;
  host: string;
  site: string;
  tenant: string;
}

interface WorkdayJob {
  bulletFields?: string[];
  externalPath?: string | null;
  locationsText?: string | null;
  postedOn?: string | null;
  remoteType?: string | null;
  title?: string | null;
}

interface WorkdayResponse {
  jobPostings?: WorkdayJob[];
  total?: number;
}

interface BreezyJobLocation {
  city?: string | null;
  country?: { id?: string | null; name?: string | null } | null;
  is_remote?: boolean | null;
  name?: string | null;
  state?: { id?: string | null; name?: string | null } | null;
}

interface BreezyJob {
  company?: {
    friendly_id?: string | null;
    logo_url?: string | null;
    name?: string | null;
  } | null;
  department?: string | null;
  description?: string | null;
  friendly_id?: string | null;
  id?: string | null;
  location?: BreezyJobLocation | null;
  locations?: BreezyJobLocation[];
  name?: string | null;
  published_date?: string | null;
  salary?: string | null;
  type?: { id?: string | null; name?: string | null } | null;
  url?: string | null;
}

interface HtmlBoardJob {
  company?: string | null;
  department?: string | null;
  description?: string | null;
  id?: string | null;
  location?: string | null;
  postedAt?: string | null;
  title?: string | null;
  type?: string | null;
  url?: string | null;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

export async function isAdminUser(email: string): Promise<boolean> {
  return email === ADMIN_EMAIL;
}

export async function getAdminUserId(): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { email: ADMIN_EMAIL },
    select: { id: true },
  });
  return user?.id ?? null;
}

// ---------------------------------------------------------------------------
// Mapping helpers (reused from ingest script)
// ---------------------------------------------------------------------------

const toNullableString = (value?: string | null): string | undefined => {
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const normalizeWhitespace = (value?: string | null): string | undefined =>
  toNullableString(value?.replace(/\s+/g, ' '));

const MAX_UPSTREAM_QUERY_LENGTH = 120;
const MAX_UPSTREAM_LOCATION_LENGTH = 80;

const compactUpstreamParam = (
  value?: string | null,
  maxLength = MAX_UPSTREAM_QUERY_LENGTH,
): string | undefined => {
  const normalized = normalizeWhitespace(value);
  return normalized ? normalized.slice(0, maxLength) : undefined;
};

const toAbsoluteUrl = (
  href?: string | null,
  base?: string,
): string | undefined => {
  const normalizedHref = toNullableString(href);
  if (!normalizedHref) return undefined;

  try {
    return new URL(normalizedHref, base).toString();
  } catch {
    return undefined;
  }
};

const toPrismaDate = (value?: string | null): Date | null => {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toPrismaDateFromUnix = (value?: number | string | null): Date | null => {
  if (value === null || value === undefined) return null;
  const numericValue =
    typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null;

  const milliseconds =
    numericValue > 10_000_000_000 ? numericValue : numericValue * 1000;
  const parsed = new Date(milliseconds);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const mapScheduleTypeToJobType = (scheduleType?: string): JobType => {
  const normalized = (scheduleType || '').toLowerCase();
  if (normalized.includes('full')) return JobType.FULL_TIME;
  if (normalized.includes('part')) return JobType.PART_TIME;
  if (normalized.includes('contract')) return JobType.CONTRACT;
  if (normalized.includes('intern')) return JobType.INTERNSHIP;
  return JobType.UNKNOWN;
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
      value?: { minValue?: number; maxValue?: number; unitText?: string };
    };
    const currency = parsed.currency || 'USD';
    const minValue = parsed.value?.minValue;
    const maxValue = parsed.value?.maxValue;
    const unitText = parsed.value?.unitText?.toLowerCase();
    const suffix = unitText ? `/${unitText}` : '';
    if (typeof minValue === 'number' && typeof maxValue === 'number') {
      return `${currency} ${minValue.toLocaleString()} - ${maxValue.toLocaleString()}${suffix}`;
    }
    if (typeof minValue === 'number')
      return `${currency} ${minValue.toLocaleString()}+${suffix}`;
    if (typeof maxValue === 'number')
      return `Up to ${currency} ${maxValue.toLocaleString()}${suffix}`;
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
  const applyUrl = toNullableString(job.url);
  if (!rawId || !applyUrl) return null;
  return {
    applyOptions: { applyUrl } as Prisma.JsonObject,
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
          : (job.remote_derived ??
            hasRemoteTextSignal(job.title, job.description_text)),
    salary: formatFantasticSalary(job.salary_raw),
    source: toNullableString(job.source) || 'Fantastic.jobs',
    title: toNullableString(job.title) || 'Untitled role',
    userId,
  };
};

const parseRelativeTime = (relative: string): Date | null => {
  const now = new Date();
  const match = relative.match(/(\d+)\s*(hour|day|week|month|minute)/i);
  if (!match) return null;
  const amount = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const ms = {
    minute: 60_000,
    hour: 3_600_000,
    day: 86_400_000,
    week: 604_800_000,
    month: 2_592_000_000,
  }[unit];
  if (!ms) return null;
  return new Date(now.getTime() - amount * ms);
};

const buildSerpListing = (
  userId: string,
  searchTerm: string,
  remote: boolean,
  job: SerpApiJob,
): Prisma.JobListingCreateManyInput | null => {
  const ext = job.detected_extensions ?? {};
  const postedAt = ext.posted_at
    ? parseRelativeTime(String(ext.posted_at))
    : null;
  const rawJobId = toNullableString(job.job_id);
  const rawShareLink = toNullableString(job.share_link);
  const normalizedApplyOptions = normalizeApplyOptions(job.apply_options);
  const preferredApplyUrl = getPreferredApplyUrl(
    normalizedApplyOptions,
    rawShareLink,
  );

  // Require at least one apply URL from any source
  const bestApplyUrl =
    preferredApplyUrl ?? rawShareLink ?? normalizedApplyOptions[0]?.link;
  if (!bestApplyUrl) return null;
  const fallbackId =
    rawShareLink ||
    `${(job.title || '').trim()}|${(job.company_name || '').trim()}|${(job.location || '').trim()}|${searchTerm}|${remote ? 'remote' : 'local'}`;
  const scheduleType = ext.schedule_type
    ? String(ext.schedule_type)
    : undefined;

  return {
    applyOptions: (normalizedApplyOptions as unknown as Prisma.JsonArray) ?? [],
    benefits: [],
    company: toNullableString(job.company_name),
    companyLogoUrl: toNullableString(job.thumbnail),
    dentalCoverage: ext.dental_coverage ?? undefined,
    description: toNullableString(job.description),
    detectedExtensions: (ext ?? {}) as unknown as Prisma.JsonObject,
    extensions: Array.isArray(job.extensions) ? job.extensions : [],
    healthInsurance: ext.health_insurance ?? undefined,
    jobId: rawJobId || fallbackId,
    jobProvider: JobProvider.SERPAPI,
    jobProviderUrl: bestApplyUrl,
    jobType: mapScheduleTypeToJobType(scheduleType),
    location: toNullableString(job.location),
    paidTimeOff: ext.paid_time_off ?? undefined,
    postedAt,
    remote: ext.work_from_home ?? remote,
    requirements: [],
    responsibilities: [],
    salary: ext.salary ?? undefined,
    scheduleType,
    source: toNullableString(job.via) || 'Google Jobs',
    title: toNullableString(job.title) || 'Untitled role',
    userId,
    workFromHome: ext.work_from_home ?? undefined,
  };
};

const normalizeWeWorkRemotelyText = (
  value?: string | null,
): string | undefined => toNullableString(value?.replace(/\s+/g, ' '));

const normalizeWeWorkRemotelyLocation = ({
  country,
  region,
  state,
}: {
  country?: string | null;
  region?: string | null;
  state?: string | null;
}): string | undefined => {
  const normalizedCountry = normalizeWeWorkRemotelyText(
    country?.replace(/^🇺🇸\s*/, ''),
  );
  const normalizedRegion = normalizeWeWorkRemotelyText(region);
  const normalizedState = normalizeWeWorkRemotelyText(state);

  const parts = [
    normalizedState,
    normalizedCountry,
    normalizedRegion &&
    normalizedRegion.toLowerCase() !== 'anywhere in the world' &&
    normalizedRegion.toLowerCase() !== 'remote'
      ? normalizedRegion
      : undefined,
  ].filter(Boolean);

  if (parts.length > 0) {
    return parts.join(', ');
  }

  return normalizedRegion || 'Anywhere in the World';
};

const parseWeWorkRemotelyTitleParts = (rawTitle?: string | null) => {
  const normalizedTitle = normalizeWeWorkRemotelyText(rawTitle);
  if (!normalizedTitle) {
    return {
      company: undefined,
      title: undefined,
    };
  }

  const separatorIndex = normalizedTitle.indexOf(':');
  if (separatorIndex === -1) {
    return {
      company: undefined,
      title: normalizedTitle,
    };
  }

  return {
    company: normalizeWeWorkRemotelyText(
      normalizedTitle.slice(0, separatorIndex),
    ),
    title: normalizeWeWorkRemotelyText(
      normalizedTitle.slice(separatorIndex + 1),
    ),
  };
};

const extractWeWorkRemotelyDescriptionText = (
  description?: string | null,
): string | undefined => {
  const normalizedDescription = normalizeWeWorkRemotelyText(description);
  if (!normalizedDescription) return undefined;

  const $ = load(normalizedDescription);
  $('img').remove();

  const toApplyText = $('p')
    .filter((_, element) =>
      $(element).text().toLowerCase().includes('to apply:'),
    )
    .last()
    .text();
  if (toApplyText) {
    $('p')
      .filter((_, element) => $(element).text() === toApplyText)
      .remove();
  }

  const text = $.text().replace(/\s+/g, ' ').trim();
  return text || undefined;
};

const extractHtmlText = (value?: string | null): string | undefined => {
  const normalizedValue = toNullableString(value);
  if (!normalizedValue) return undefined;

  // If the value doesn't contain HTML tags, return as-is
  if (!/<[a-z][\s\S]*>/i.test(normalizedValue)) {
    return normalizedValue.trim() || undefined;
  }

  const $ = load(normalizedValue);

  // Insert newlines before block-level elements to preserve structure
  $('br').replaceWith('\n');
  $(
    'p, div, h1, h2, h3, h4, h5, h6, tr, blockquote, section, article, header, footer, aside, details, summary',
  ).each((_, el) => {
    $(el).prepend('\n').append('\n');
  });

  // Convert list items to bullet/number markers
  $('ul > li, ol > li').each((idx, el) => {
    const parent = $(el).parent();
    const marker = parent.is('ol') ? `${idx + 1}. ` : '• ';
    $(el).prepend(`\n${marker}`).append('\n');
  });

  // Convert strong/b to uppercase-style markers the parser can detect
  $('strong, b').each((_, el) => {
    const text = $(el).text().trim();
    // If it looks like a heading (short, no period), wrap with ** for bold heading detection
    if (text.length < 60 && !text.includes('.')) {
      $(el).replaceWith(`\n**${text}**\n`);
    }
  });

  const text = $.text()
    // Collapse multiple spaces (but not newlines) into one
    .replace(/[^\S\n]+/g, ' ')
    // Collapse 3+ newlines into 2
    .replace(/\n{3,}/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    .trim();

  return text || undefined;
};

const decodeText = (value?: string | null): string | undefined => {
  const normalizedValue = toNullableString(value);
  if (!normalizedValue) return undefined;
  return normalizeWhitespace(load(`<span>${normalizedValue}</span>`).text());
};

const REMOTE_TEXT_PATTERN =
  /\b(remote(?:ly)?|wfh|work(?:ing)?[-\s]+from[-\s]+home)\b/i;

const hasRemoteTextSignal = (
  ...values: Array<string | null | undefined>
): boolean =>
  values.some(value => {
    const text = extractHtmlText(value);
    return Boolean(text && REMOTE_TEXT_PATTERN.test(text));
  });

const parseEmbeddedJsonObject = (
  scriptContents: string,
  marker: string,
): Record<string, unknown> | null => {
  const markerIndex = scriptContents.indexOf(marker);
  if (markerIndex === -1) {
    return null;
  }

  const startIndex = scriptContents.indexOf('{', markerIndex);
  if (startIndex === -1) {
    return null;
  }

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < scriptContents.length; index += 1) {
    const character = scriptContents[index];

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      continue;
    }

    if (character === '{') {
      depth += 1;
      continue;
    }

    if (character === '}') {
      depth -= 1;
      if (depth === 0) {
        const candidate = scriptContents.slice(startIndex, index + 1);
        try {
          return JSON.parse(candidate) as Record<string, unknown>;
        } catch {
          return null;
        }
      }
    }
  }

  return null;
};

const parseBuiltInPublishedDates = (html: string): Map<string, string> => {
  const $ = load(html);
  const publishedDates = new Map<string, string>();

  $('script').each((_, element) => {
    const scriptText = $(element).html();
    if (!scriptText?.includes('job_board_view')) {
      return;
    }

    const payload = parseEmbeddedJsonObject(scriptText, "job_board_view',");
    const jobs = Array.isArray(payload?.jobs)
      ? (payload.jobs as BuiltInTrackedJob[])
      : [];

    for (const job of jobs) {
      const id = typeof job.id === 'number' ? String(job.id) : null;
      const publishedAt = toNullableString(job.published_date);
      if (id && publishedAt) {
        publishedDates.set(id, publishedAt);
      }
    }
  });

  return publishedDates;
};

const parseBuiltInJobsPage = (html: string): BuiltInJob[] => {
  const $ = load(html);
  const publishedDates = parseBuiltInPublishedDates(html);

  return $('div[id^="job-card-"]')
    .map((_, element) => {
      const card = $(element);
      const cardId = toNullableString(card.attr('id'));
      const jobId = cardId?.replace(/^job-card-/, '');
      const title = normalizeWhitespace(
        card.find('[data-id="job-card-title"]').first().text(),
      );
      const rawHref = toNullableString(
        card.find('[data-id="job-card-title"]').first().attr('href'),
      );

      if (!jobId || !title || !rawHref) {
        return null;
      }

      const company = normalizeWhitespace(
        card.find('[data-id="company-title"]').first().text(),
      );
      const companyLogoUrl = toNullableString(
        card.find('[data-id="company-img"]').first().attr('src'),
      );
      const location = normalizeWhitespace(
        card
          .find('.fa-location-dot')
          .first()
          .closest('div.d-flex')
          .find('span.font-barlow.text-gray-04')
          .first()
          .text(),
      );
      const remoteMode = normalizeWhitespace(
        card
          .find('.fa-house-building')
          .first()
          .closest('div.d-flex')
          .find('span.font-barlow.text-gray-04')
          .first()
          .text(),
      );
      const salary = normalizeWhitespace(
        card
          .find('.fa-sack-dollar')
          .first()
          .closest('div.d-flex')
          .find('span.font-barlow.text-gray-04')
          .first()
          .text(),
      );
      const experienceLevel = normalizeWhitespace(
        card
          .find('.fa-trophy')
          .first()
          .closest('div.d-flex')
          .find('span.font-barlow.text-gray-04')
          .first()
          .text(),
      );
      const description = normalizeWhitespace(
        card.find('div.fs-sm.fw-regular.mb-md.text-gray-04').first().text(),
      );
      const industries = card
        .find('div.mb-md.fs-xs.fw-bold')
        .first()
        .text()
        .split('•')
        .map(value => value.trim())
        .filter(Boolean);
      const topSkills = card
        .find('span.fs-xs.text-gray-04.mx-sm')
        .map((_, skillElement) => $(skillElement).text().trim())
        .get()
        .filter(Boolean);

      return {
        company,
        companyLogoUrl,
        description,
        experienceLevel,
        industries,
        jobId,
        location,
        postedAt: publishedDates.get(jobId) ?? null,
        remoteMode,
        salary,
        title,
        topSkills,
        url: rawHref.startsWith('http')
          ? rawHref
          : `https://builtin.com${rawHref}`,
      } satisfies BuiltInJob;
    })
    .get()
    .filter(job => job !== null) as BuiltInJob[];
};

const extractBuiltInApplyUrl = (html: string): string | undefined => {
  const match = html.match(/Builtin\.jobPostInit\((\{[\s\S]*?\})\);/);
  if (!match) {
    return undefined;
  }

  try {
    const payload = JSON.parse(match[1]) as {
      job?: {
        howToApply?: string | null;
      };
    };

    return toNullableString(payload.job?.howToApply);
  } catch {
    return undefined;
  }
};

const enrichBuiltInJobWithApplyUrl = async (
  job: BuiltInJob,
): Promise<BuiltInJob | null> => {
  const response = await fetch(job.url, {
    cache: 'no-store',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const applyUrl = extractBuiltInApplyUrl(html);
  if (!applyUrl) {
    return null;
  }

  return {
    ...job,
    applyUrl,
  } satisfies BuiltInJob;
};

const matchesBuiltInQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: BuiltInJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.company,
      job.description,
      job.experienceLevel,
      job.location,
      job.remoteMode,
      job.salary,
      job.title,
      ...(job.industries ?? []),
      ...(job.topSkills ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [job.location, job.remoteMode]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      !locationHaystack.includes(normalizedLocation) &&
      !isUnitedStatesWideLocation(location)
    ) {
      return false;
    }
  }

  if (remote === true) {
    const normalizedRemoteMode = (job.remoteMode ?? '').toLowerCase();
    if (
      !normalizedRemoteMode.includes('remote') &&
      !normalizedRemoteMode.includes('hybrid') &&
      !hasRemoteTextSignal(job.title, job.description)
    ) {
      return false;
    }
  }

  return true;
};

const buildBuiltInListing = (
  userId: string,
  job: BuiltInJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.applyUrl) || job.url;
  if (!applyUrl) return null;
  const remoteMode = toNullableString(job.remoteMode);
  const isRemoteFriendly = Boolean(
    (remoteMode &&
      (remoteMode.toLowerCase().includes('remote') ||
        remoteMode.toLowerCase().includes('hybrid'))) ||
    hasRemoteTextSignal(job.title, job.description),
  );

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    companyLogoUrl: toNullableString(job.companyLogoUrl),
    description: toNullableString(job.description),
    jobId: `builtin-${job.jobId}`,
    jobProvider: JobProvider.BUILT_IN,
    jobProviderUrl: job.url,
    jobType: JobType.UNKNOWN,
    location: toNullableString(job.location) || remoteMode || 'Unknown',
    postedAt: toPrismaDate(job.postedAt),
    qualifications: [
      ...(job.industries ?? []),
      ...(job.topSkills ?? []),
      job.experienceLevel,
    ].filter((value): value is string => Boolean(value)),
    remote: isRemoteFriendly,
    requirements: [],
    responsibilities: [],
    salary: toNullableString(job.salary),
    source: 'Built In',
    title: job.title,
    userId,
    workFromHome: isRemoteFriendly,
  };
};

const extractTheMuseApplyUrl = (html: string): string | undefined => {
  const match =
    html.match(/\\"applyLink\\":\\"([^"]+)\\"/) ??
    html.match(/"applyLink":"([^"]+)"/);

  if (!match?.[1]) {
    return undefined;
  }

  const normalized = match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/');

  return toNullableString(normalized);
};

const buildWelcomeToTheJungleDetailUrl = (
  job: WelcomeToTheJungleJob,
): string | undefined => {
  const organizationSlug = toNullableString(job.organization?.slug);
  const jobSlug = toNullableString(job.slug);

  if (!organizationSlug || !jobSlug) {
    return undefined;
  }

  return `https://www.welcometothejungle.com/en/companies/${organizationSlug}/jobs/${jobSlug}`;
};

const extractWelcomeToTheJungleApplyUrl = (
  html: string,
): string | undefined => {
  const match =
    html.match(/\\"apply_url\\":\\"([^"]+)\\"/) ??
    html.match(/"apply_url":"([^"]+)"/);

  if (!match?.[1]) {
    return undefined;
  }

  return toNullableString(
    match[1]
      .replace(/\\u0026/g, '&')
      .replace(/\\u002F/g, '/')
      .replace(/\\\//g, '/'),
  );
};

const enrichWelcomeToTheJungleJobWithApplyUrl = async (
  job: WelcomeToTheJungleJob,
): Promise<
  (WelcomeToTheJungleJob & { applyUrl: string; detailUrl: string }) | null
> => {
  const detailUrl = buildWelcomeToTheJungleDetailUrl(job);
  if (!detailUrl) {
    return null;
  }

  const response = await fetch(detailUrl, {
    cache: 'no-store',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const applyUrl = extractWelcomeToTheJungleApplyUrl(html);
  if (!applyUrl) {
    return null;
  }

  return {
    ...job,
    applyUrl,
    detailUrl,
  };
};

const enrichTheMuseJobWithApplyUrl = async (
  job: TheMuseJob,
): Promise<(TheMuseJob & { applyUrl: string; landingPage: string }) | null> => {
  const landingPage = toNullableString(job.refs?.landing_page);
  if (!landingPage) {
    return null;
  }

  const response = await fetch(landingPage, {
    cache: 'no-store',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    return null;
  }

  const html = await response.text();
  const applyUrl = extractTheMuseApplyUrl(html);
  if (!applyUrl) {
    return null;
  }

  return {
    ...job,
    applyUrl,
    landingPage,
  };
};

const matchesTheMuseQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: TheMuseJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.company?.name,
      extractHtmlText(job.contents),
      job.name,
      ...(job.locations ?? []).map(item => item.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = (job.locations ?? [])
      .map(item => item.name)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  if (remote === true) {
    const locationHaystack = (job.locations ?? [])
      .map(item => item.name)
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (
      !locationHaystack.includes('remote') &&
      !locationHaystack.includes('flexible') &&
      !hasRemoteTextSignal(job.name, job.contents)
    ) {
      return false;
    }
  }

  return true;
};

const formatWelcomeToTheJungleSalary = (
  job: WelcomeToTheJungleJob,
): string | undefined => {
  const minimum = job.salary_minimum;
  const maximum = job.salary_maximum;
  const currency = toNullableString(job.salary_currency) ?? 'USD';
  const period =
    job.salary_period === 'yearly'
      ? '/year'
      : job.salary_period === 'monthly'
        ? '/month'
        : job.salary_period === 'daily'
          ? '/day'
          : '';

  if (typeof minimum === 'number' && typeof maximum === 'number') {
    return `${currency} ${minimum.toLocaleString()} - ${maximum.toLocaleString()}${period}`;
  }

  if (typeof minimum === 'number') {
    return `${currency} ${minimum.toLocaleString()}+${period}`;
  }

  if (typeof maximum === 'number') {
    return `Up to ${currency} ${maximum.toLocaleString()}${period}`;
  }

  return undefined;
};

const resolveWelcomeToTheJungleLocation = (
  job: WelcomeToTheJungleJob,
): string | undefined => {
  const locationParts = (job.offices ?? [])
    .map(office =>
      [office.city, office.state, office.country]
        .map(value => toNullableString(value))
        .filter((value): value is string => Boolean(value))
        .join(', '),
    )
    .filter(Boolean);

  return locationParts[0];
};

const isWelcomeToTheJungleRemoteFriendly = (job: WelcomeToTheJungleJob) => {
  const remoteLabel = toNullableString(job.remote)?.toLowerCase();
  return (
    job.has_remote === true ||
    remoteLabel === 'full' ||
    remoteLabel === 'partial' ||
    remoteLabel === 'remote' ||
    hasRemoteTextSignal(job.name, job.summary)
  );
};

const matchesWelcomeToTheJungleQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: WelcomeToTheJungleJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.name,
      job.summary,
      job.organization?.name,
      ...(job.offices ?? []).flatMap(office => [
        office.city,
        office.state,
        office.country,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [
      resolveWelcomeToTheJungleLocation(job),
      ...(job.offices ?? []).flatMap(office => [
        office.city,
        office.state,
        office.country,
      ]),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  if (remote === true && !isWelcomeToTheJungleRemoteFriendly(job)) {
    return false;
  }

  return true;
};

const buildWelcomeToTheJungleListing = (
  userId: string,
  job: WelcomeToTheJungleJob & { applyUrl: string; detailUrl: string },
): Prisma.JobListingCreateManyInput | null => {
  const title = toNullableString(job.name);
  const applyUrl = toNullableString(job.applyUrl);

  if (!title || !applyUrl) {
    return null;
  }

  const isRemoteFriendly = isWelcomeToTheJungleRemoteFriendly(job);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.organization?.name),
    companyLogoUrl:
      toNullableString(job.organization?.logo?.thumb?.url) ??
      toNullableString(job.organization?.logo?.url),
    description: toNullableString(job.summary),
    jobId: `welcometothejungle-${job.reference ?? job.objectID ?? applyUrl}`,
    jobProvider: JobProvider.WELCOME_TO_THE_JUNGLE,
    jobProviderUrl: job.detailUrl,
    jobType: mapScheduleTypeToJobType(job.contract_type),
    location:
      resolveWelcomeToTheJungleLocation(job) ||
      (isRemoteFriendly ? 'Remote' : 'United States'),
    postedAt:
      toPrismaDate(job.published_at) ??
      toPrismaDateFromUnix(job.published_at_timestamp),
    qualifications: [],
    remote: isRemoteFriendly,
    requirements: [],
    responsibilities: [],
    salary: formatWelcomeToTheJungleSalary(job),
    scheduleType: toNullableString(job.contract_type),
    source: 'Welcome to the Jungle',
    title,
    userId,
    workFromHome: isRemoteFriendly,
  };
};

const buildTheMuseListing = (
  userId: string,
  job: TheMuseJob & { applyUrl: string; landingPage: string },
): Prisma.JobListingCreateManyInput | null => {
  const title = toNullableString(job.name);
  const applyUrl = toNullableString(job.applyUrl);

  if (!title || !applyUrl) {
    return null;
  }

  const locations = (job.locations ?? [])
    .map(item => toNullableString(item.name))
    .filter((value): value is string => Boolean(value));
  const locationText = locations.join(', ');
  const isRemoteFriendly =
    locations.some(locationName => {
      const normalized = locationName.toLowerCase();
      return normalized.includes('remote') || normalized.includes('flexible');
    }) || hasRemoteTextSignal(job.name, job.contents);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company?.name),
    description: extractHtmlText(job.contents),
    jobId: `themuse-${job.id ?? job.short_name ?? applyUrl}`,
    jobProvider: JobProvider.THE_MUSE,
    jobProviderUrl: job.landingPage,
    jobType: JobType.UNKNOWN,
    location: locationText || (isRemoteFriendly ? 'Remote' : 'Unknown'),
    postedAt: toPrismaDate(job.publication_date),
    qualifications: [],
    remote: isRemoteFriendly,
    requirements: [],
    responsibilities: [],
    source: 'The Muse',
    title,
    userId,
    workFromHome: isRemoteFriendly,
  };
};

const resolveCareerBuilderLocation = (
  job: CareerBuilderJob,
): string | undefined => {
  const firstLocation = job.jobPosting?.jobLocation?.[0]?.address;
  const locationParts = [
    toNullableString(firstLocation?.addressLocality),
    toNullableString(firstLocation?.addressRegion),
    toNullableString(firstLocation?.addressCountry),
  ].filter((value): value is string => Boolean(value));

  return locationParts.length > 0 ? locationParts.join(', ') : undefined;
};

const isCareerBuilderRemoteFriendly = (job: CareerBuilderJob): boolean => {
  const locationType = toNullableString(
    job.enrichments?.jobLocationType?.name,
  )?.toLowerCase();

  if (locationType) {
    if (locationType.includes('remote')) {
      return true;
    }

    if (locationType.includes('onsite')) {
      return false;
    }
  }

  const locationText = resolveCareerBuilderLocation(job)?.toLowerCase() ?? '';
  return (
    locationText.includes('remote') ||
    hasRemoteTextSignal(job.jobPosting?.title, job.jobPosting?.description)
  );
};

const formatCareerBuilderSalary = (
  job: CareerBuilderJob,
): string | undefined => {
  const baseSalary = job.jobPosting?.baseSalary;
  const minValue = baseSalary?.value?.minValue;
  const maxValue = baseSalary?.value?.maxValue;

  if (typeof minValue !== 'number' && typeof maxValue !== 'number') {
    return undefined;
  }

  const currency = toNullableString(baseSalary?.currency) ?? 'USD';
  const formatter = new Intl.NumberFormat('en-US', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  });
  const unitText = toNullableString(baseSalary?.value?.unitText)?.toLowerCase();
  const suffix = unitText ? ` / ${unitText}` : '';

  if (typeof minValue === 'number' && typeof maxValue === 'number') {
    return `${formatter.format(minValue)} - ${formatter.format(maxValue)}${suffix}`;
  }

  const salaryValue =
    typeof maxValue === 'number'
      ? formatter.format(maxValue)
      : formatter.format(minValue!);

  return `${salaryValue}${suffix}`;
};

const isUnitedStatesWideLocation = (location?: string): boolean => {
  const normalizedLocation = location?.trim().toLowerCase();

  if (!normalizedLocation) {
    return false;
  }

  return (
    normalizedLocation === 'united states' ||
    normalizedLocation === 'united states of america' ||
    normalizedLocation === 'usa' ||
    normalizedLocation === 'us'
  );
};

const matchesCareerBuilderQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: CareerBuilderJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const searchHaystack = [
      toNullableString(job.jobPosting?.title),
      toNullableString(job.jobPosting?.description),
      toNullableString(job.jobPosting?.hiringOrganization?.name),
      resolveCareerBuilderLocation(job),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!searchHaystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation && !isUnitedStatesWideLocation(location)) {
    const locationHaystack = [
      resolveCareerBuilderLocation(job),
      toNullableString(job.jobPosting?.description),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  if (remote === true && !isCareerBuilderRemoteFriendly(job)) {
    return false;
  }

  return true;
};

const buildCareerBuilderListing = (
  userId: string,
  job: CareerBuilderJob,
): Prisma.JobListingCreateManyInput | null => {
  const title = toNullableString(job.jobPosting?.title);
  const applyUrl = toNullableString(job.apply?.applyUrl);
  const providerUrl =
    toNullableString(job.canonicalUrl) ??
    toNullableString(job.localizedMonsterUrls?.[0]?.url) ??
    toNullableString(job.jobPosting?.url);

  if (!title || !applyUrl || !providerUrl) {
    return null;
  }

  const scheduleType =
    job.jobPosting?.employmentType?.join(', ') ??
    job.enrichments?.employmentTypes
      ?.map(item => toNullableString(item.name))
      .filter((value): value is string => Boolean(value))
      .join(', ');
  const isRemoteFriendly = isCareerBuilderRemoteFriendly(job);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.jobPosting?.hiringOrganization?.name),
    companyLogoUrl: toNullableString(job.jobPosting?.hiringOrganization?.logo),
    description: extractHtmlText(job.jobPosting?.description),
    jobId: `careerbuilder-${job.jobId ?? job.seoJobId ?? applyUrl}`,
    jobProvider: JobProvider.CAREER_BUILDER,
    jobProviderUrl: providerUrl,
    jobType: mapScheduleTypeToJobType(scheduleType),
    location:
      resolveCareerBuilderLocation(job) ||
      (isRemoteFriendly ? 'Remote' : 'United States'),
    postedAt:
      toPrismaDate(job.jobPosting?.datePosted) ??
      toPrismaDate(job.formattedDate) ??
      toPrismaDate(job.createdDate),
    qualifications: [],
    remote: isRemoteFriendly,
    requirements: [],
    responsibilities: [],
    salary: formatCareerBuilderSalary(job),
    scheduleType: toNullableString(scheduleType),
    source: 'CareerBuilder',
    title,
    userId,
    workFromHome: isRemoteFriendly,
  };
};

const parseWorkAtAStartupJobsPage = (html: string): WorkAtAStartupJob[] => {
  const $ = load(html);
  const dataPage = $('div[data-page]').first().attr('data-page');
  if (!dataPage) {
    return [];
  }

  try {
    const payload = JSON.parse(dataPage) as WorkAtAStartupPagePayload;
    const jobs = Array.isArray(payload.props?.jobs) ? payload.props.jobs : [];

    return jobs.filter(
      (job): job is WorkAtAStartupJob =>
        typeof job === 'object' &&
        job !== null &&
        typeof job.title === 'string' &&
        typeof job.applyUrl === 'string',
    );
  } catch {
    return [];
  }
};

const matchesWorkAtAStartupQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: WorkAtAStartupJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.companyName,
      job.companyOneLiner,
      job.location,
      job.roleType,
      job.title,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [job.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  if (remote === true) {
    const normalizedLocationHaystack = (job.location ?? '').toLowerCase();
    if (
      !normalizedLocationHaystack.includes('remote') &&
      !hasRemoteTextSignal(job.title, job.companyOneLiner)
    ) {
      return false;
    }
  }

  return true;
};

const buildWorkAtAStartupListing = (
  userId: string,
  job: WorkAtAStartupJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.applyUrl);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  const location = toNullableString(job.location);
  const isRemoteFriendly = Boolean(
    location?.toLowerCase().includes('remote') ||
    hasRemoteTextSignal(job.title, job.companyOneLiner),
  );

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.companyName),
    companyLogoUrl: toNullableString(job.companyLogoUrl),
    description: toNullableString(job.companyOneLiner),
    jobId: `workatastartup-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.WORK_AT_A_STARTUP,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.jobType),
    location: location || 'Unknown',
    postedAt: null,
    qualifications: [job.roleType, job.companyBatch].filter(
      (value): value is string => Boolean(value),
    ),
    remote: isRemoteFriendly,
    requirements: [],
    responsibilities: [],
    scheduleType: toNullableString(job.jobType),
    source: 'Work at a Startup',
    title,
    userId,
    workFromHome: isRemoteFriendly,
  };
};

const parseWeWorkRemotelyFeed = (xml: string): WeWorkRemotelyJob[] => {
  const $ = load(xml, { xml: true });

  return $('item')
    .map((_, element) => {
      const item = $(element);
      const titleParts = parseWeWorkRemotelyTitleParts(
        item.find('title').text(),
      );
      const region = item.find('region').text();
      const country = item.find('country').text();
      const state = item.find('state').text();
      const pubDate = item.find('pubDate').text();
      const mediaUrl =
        item.find('media\\:content').attr('url') ||
        item.find('content').attr('url');

      return {
        category: normalizeWeWorkRemotelyText(item.find('category').text()),
        company: titleParts.company,
        country: normalizeWeWorkRemotelyText(country),
        description: extractWeWorkRemotelyDescriptionText(
          item.find('description').text(),
        ),
        jobType: normalizeWeWorkRemotelyText(item.find('type').text()),
        link: normalizeWeWorkRemotelyText(item.find('link').text()),
        location: normalizeWeWorkRemotelyLocation({
          country,
          region,
          state,
        }),
        logoUrl: normalizeWeWorkRemotelyText(mediaUrl),
        postedAt: toPrismaDate(pubDate),
        skills: item
          .find('skills')
          .text()
          .split(',')
          .map(skill => skill.trim())
          .filter(Boolean),
        title: titleParts.title,
      } satisfies WeWorkRemotelyJob;
    })
    .get();
};

const matchesWeWorkRemotelyQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: WeWorkRemotelyJob;
  location?: string;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.category,
      job.company,
      job.description,
      job.title,
      ...job.skills,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [job.country, job.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  return true;
};

const buildWeWorkRemotelyListing = (
  userId: string,
  job: WeWorkRemotelyJob,
): Prisma.JobListingCreateManyInput | null => {
  const jobLink = toNullableString(job.link);
  const title = toNullableString(job.title);

  if (!jobLink || !title) {
    return null;
  }

  return {
    applyOptions: {
      applyUrl: jobLink,
    } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    companyLogoUrl: toNullableString(job.logoUrl),
    description: toNullableString(job.description),
    jobId: jobLink,
    jobProvider: JobProvider.WE_WORK_REMOTELY,
    jobProviderUrl: jobLink,
    jobType: mapScheduleTypeToJobType(job.jobType),
    location: toNullableString(job.location) || 'Anywhere in the World',
    postedAt: job.postedAt ?? null,
    qualifications: job.skills,
    remote: true,
    requirements: [],
    responsibilities: [],
    scheduleType: toNullableString(job.jobType),
    source: 'We Work Remotely',
    title,
    userId,
    workFromHome: true,
  };
};

const parseNoDeskTitleParts = (
  rawTitle?: string | null,
  description?: string | null,
) => {
  const normalizedTitle = normalizeWeWorkRemotelyText(rawTitle);
  if (!normalizedTitle) {
    return { company: undefined, title: undefined };
  }

  const titleMatch = normalizedTitle.match(/^(.*?)\s+at\s+(.+)$/i);
  if (titleMatch) {
    return {
      company: normalizeWeWorkRemotelyText(titleMatch[2]),
      title: normalizeWeWorkRemotelyText(titleMatch[1]),
    };
  }

  const descriptionMatch = normalizeWeWorkRemotelyText(description)?.match(
    /^(.+?)\s+is hiring a remote\s+(.+?)\./i,
  );
  if (descriptionMatch) {
    return {
      company: normalizeWeWorkRemotelyText(descriptionMatch[1]),
      title: normalizeWeWorkRemotelyText(descriptionMatch[2]),
    };
  }

  return { company: undefined, title: normalizedTitle };
};

const parseNoDeskLocation = (description?: string | null): string => {
  const normalizedDescription = normalizeWeWorkRemotelyText(description) ?? '';
  const locationMatch = normalizedDescription.match(
    /can be done remotely anywhere in ([^.]+)\./i,
  );
  return normalizeWeWorkRemotelyText(locationMatch?.[1]) ?? 'Remote';
};

const parseNoDeskFeed = (xml: string): NoDeskJob[] => {
  const $ = load(xml, { xml: true });

  return $('item')
    .map((_, element) => {
      const item = $(element);
      const description = extractHtmlText(item.find('description').text());
      const titleParts = parseNoDeskTitleParts(
        item.find('title').text(),
        description,
      );

      return {
        company: titleParts.company,
        description,
        link: normalizeWeWorkRemotelyText(item.find('link').text()),
        location: parseNoDeskLocation(description),
        postedAt: toPrismaDate(item.find('pubDate').text()),
        title: titleParts.title,
      } satisfies NoDeskJob;
    })
    .get();
};

const matchesNoDeskQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: NoDeskJob;
  location?: string;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [job.company, job.description, job.title]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(normalizedSearch)) return false;
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = job.location?.toLowerCase() ?? '';
    if (!locationHaystack.includes(normalizedLocation)) return false;
  }

  return true;
};

const buildNoDeskListing = (
  userId: string,
  job: NoDeskJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.link);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    description: toNullableString(job.description),
    jobId: `nodesk-${applyUrl}`,
    jobProvider: JobProvider.NODESK,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location: toNullableString(job.location) || 'Remote',
    postedAt: job.postedAt ?? null,
    qualifications: [],
    remote: true,
    requirements: [],
    responsibilities: [],
    source: 'NoDesk',
    title,
    userId,
    workFromHome: true,
  };
};

const parseOpenJobsPage = (html: string): OpenJobsJob[] => {
  const $ = load(html);
  const latestTable = $('h2')
    .filter((_, element) =>
      $(element).text().toLowerCase().includes('latest job openings'),
    )
    .first()
    .nextAll('table')
    .first();

  return latestTable
    .find('tbody tr')
    .map((_, element) => {
      const cells = $(element).find('td');
      const title = normalizeWhitespace(cells.eq(0).text());
      const companyCell = cells.eq(1);
      const company = normalizeWhitespace(
        companyCell.clone().children().remove().end().text(),
      );
      const link = normalizeWhitespace(
        cells.eq(2).find('a').attr('href') ?? cells.eq(2).text(),
      );
      const companyLogoUrl = normalizeWhitespace(
        companyCell.find('img').attr('src'),
      );

      return {
        company,
        companyLogoUrl,
        link,
        title,
      } satisfies OpenJobsJob;
    })
    .get()
    .filter(job => Boolean(job.title && job.link));
};

const matchesOpenJobsQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: OpenJobsJob;
  location?: string;
  searchTerm?: string;
}) => {
  const haystack = [job.company, job.link, job.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch && !haystack.includes(normalizedSearch)) {
    return false;
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation && !haystack.includes(normalizedLocation)) {
    return false;
  }

  return true;
};

const buildOpenJobsListing = (
  userId: string,
  job: OpenJobsJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.link);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    companyLogoUrl: toNullableString(job.companyLogoUrl),
    description: undefined,
    jobId: `openjobs-${applyUrl}`,
    jobProvider: JobProvider.OPENJOBS,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location: undefined,
    postedAt: null,
    qualifications: [],
    remote: hasRemoteTextSignal(title, applyUrl),
    requirements: [],
    responsibilities: [],
    source: 'OpenJobs',
    title,
    userId,
    workFromHome: hasRemoteTextSignal(title, applyUrl),
  };
};

const parseJobspressoHtml = (html: string): JobspressoJob[] => {
  const $ = load(html);

  return $('li.job_listing')
    .map((_, element) => {
      const item = $(element);
      const categories = item
        .find('.job_listing-type')
        .map((__, category) => decodeText($(category).text()))
        .get()
        .filter(Boolean);

      return {
        category: categories.join(', ') || undefined,
        company: decodeText(item.find('.job_listing-company strong').text()),
        companyLogoUrl: normalizeWhitespace(
          item.find('img.company_logo').attr('src'),
        ),
        dateLabel: decodeText(item.find('.job_listing-date').text()),
        description: decodeText(
          item.find('.job_listing-company-tagline').text(),
        ),
        link: normalizeWhitespace(
          item.attr('data-href') ??
            item.find('a.job_listing-clickbox').attr('href'),
        ),
        location: decodeText(item.find('.job_listing-location').text()),
        title: decodeText(item.find('.job_listing-title').text()),
      } satisfies JobspressoJob;
    })
    .get()
    .filter(job => Boolean(job.title && job.link));
};

const matchesJobspressoQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: JobspressoJob;
  location?: string;
  searchTerm?: string;
}) => {
  const haystack = [
    job.category,
    job.company,
    job.description,
    job.location,
    job.title,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch && !haystack.includes(normalizedSearch)) {
    return false;
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation && !haystack.includes(normalizedLocation)) {
    return false;
  }

  return true;
};

const parseMonthDayDate = (value?: string | null): Date | null => {
  const normalizedValue = decodeText(value);
  if (!normalizedValue || /featured/i.test(normalizedValue)) return null;
  const match = normalizedValue.match(
    /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})$/i,
  );
  if (!match) return toPrismaDate(normalizedValue);

  const now = new Date();
  const parsed = new Date(`${match[1]} ${match[2]}, ${now.getFullYear()}`);
  if (Number.isNaN(parsed.getTime())) return null;
  if (parsed.getTime() > now.getTime() + 24 * 60 * 60 * 1000) {
    parsed.setFullYear(parsed.getFullYear() - 1);
  }
  return parsed;
};

const buildJobspressoListing = (
  userId: string,
  job: JobspressoJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.link);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    companyLogoUrl: toNullableString(job.companyLogoUrl),
    description: toNullableString(job.description),
    jobId: `jobspresso-${applyUrl}`,
    jobProvider: JobProvider.JOBSPRESSO,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.category),
    location: toNullableString(job.location) || 'Remote',
    postedAt: parseMonthDayDate(job.dateLabel),
    qualifications: job.category ? [job.category] : [],
    remote: true,
    requirements: [],
    responsibilities: [],
    scheduleType: toNullableString(job.category),
    source: 'Jobspresso',
    title,
    userId,
    workFromHome: true,
  };
};

const parseBasicRssFeed = (xml: string): BasicRssJob[] => {
  const $ = load(xml, { xml: true });

  return $('item')
    .map((_, element) => {
      const item = $(element);
      const description = extractHtmlText(item.find('description').text());
      return {
        description,
        guid: normalizeWhitespace(item.find('guid').text()),
        link: normalizeWhitespace(item.find('link').text()),
        postedAt: toPrismaDate(item.find('pubDate').text()),
        title: decodeText(item.find('title').text()),
      } satisfies BasicRssJob;
    })
    .get()
    .filter(job => Boolean(job.title && job.link));
};

const splitRssTitleCompany = (
  title?: string,
): { company?: string; title?: string } => {
  const normalizedTitle = decodeText(title);
  if (!normalizedTitle) return {};
  const separatorIndex = normalizedTitle.lastIndexOf(',');
  if (separatorIndex === -1) return { title: normalizedTitle };
  return {
    company: normalizeWhitespace(normalizedTitle.slice(separatorIndex + 1)),
    title: normalizeWhitespace(normalizedTitle.slice(0, separatorIndex)),
  };
};

const firstDescriptionLine = (description?: string): string | undefined =>
  description
    ?.split('\n')
    .map(line => normalizeWhitespace(line))
    .find((line): line is string => Boolean(line && line.length <= 140));

const parsePythonOrgJobsFeed = (xml: string): BasicRssJob[] =>
  parseBasicRssFeed(xml).map(job => {
    const titleParts = splitRssTitleCompany(job.title);
    const location = firstDescriptionLine(job.description);
    const description =
      location && job.description?.startsWith(location)
        ? normalizeWhitespace(job.description.slice(location.length))
        : job.description;

    return {
      ...job,
      company: titleParts.company,
      description,
      location,
      title: titleParts.title ?? job.title,
    };
  });

const matchesBasicRssQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: BasicRssJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}) => {
  const haystack = [job.company, job.description, job.location, job.title]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch && !haystack.includes(normalizedSearch)) {
    return false;
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation && !haystack.includes(normalizedLocation)) {
    return false;
  }

  if (
    remote &&
    !hasRemoteTextSignal(job.title, job.description, job.location)
  ) {
    return false;
  }

  return true;
};

const buildBasicRssListing = (
  userId: string,
  job: BasicRssJob,
  {
    defaultLocation,
    jobProvider,
    prefix,
    source,
  }: {
    defaultLocation?: string;
    jobProvider: JobProvider;
    prefix: string;
    source: string;
  },
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.link);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  const location = toNullableString(job.location) ?? defaultLocation;
  const isRemote = hasRemoteTextSignal(title, job.description, location);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    description: toNullableString(job.description),
    jobId: `${prefix}-${toNullableString(job.guid) ?? applyUrl}`,
    jobProvider,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: job.postedAt ?? null,
    qualifications: [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source,
    title,
    userId,
    workFromHome: isRemote,
  };
};

const isRemoteOkJob = (item: unknown): item is RemoteOkJob =>
  item !== null &&
  typeof item === 'object' &&
  !Array.isArray(item) &&
  ('position' in item || 'company' in item || 'url' in item);

const buildRemoteOkSalary = (job: RemoteOkJob): string | undefined => {
  const min = typeof job.salary_min === 'number' ? job.salary_min : 0;
  const max = typeof job.salary_max === 'number' ? job.salary_max : 0;

  if (min > 0 && max > 0) {
    return `$${min.toLocaleString()} - $${max.toLocaleString()}`;
  }
  if (min > 0) {
    return `$${min.toLocaleString()}+`;
  }
  if (max > 0) {
    return `Up to $${max.toLocaleString()}`;
  }

  return undefined;
};

const matchesRemoteOkQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: RemoteOkJob;
  location?: string;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.company,
      job.description,
      job.location,
      job.position,
      ...(job.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [job.location, ...(job.tags ?? [])]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  return true;
};

const buildRemoteOkListing = (
  userId: string,
  job: RemoteOkJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.apply_url) || toNullableString(job.url);
  const title = toNullableString(job.position);

  if (!applyUrl || !title) {
    return null;
  }

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    companyLogoUrl: toNullableString(job.company_logo),
    description: toNullableString(job.description),
    jobId: String(job.id ?? applyUrl),
    jobProvider: JobProvider.REMOTE_OK,
    jobProviderUrl: toNullableString(job.url) || applyUrl,
    jobType: JobType.UNKNOWN,
    location: toNullableString(job.location) || 'Remote',
    postedAt: toPrismaDate(job.date),
    qualifications: Array.isArray(job.tags) ? job.tags.filter(Boolean) : [],
    remote: true,
    requirements: [],
    responsibilities: [],
    salary: buildRemoteOkSalary(job),
    source: 'Remote OK',
    title,
    userId,
    workFromHome: true,
  };
};

const matchesJobicyQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: JobicyJob;
  location?: string;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.companyName,
      job.jobDescription,
      job.jobExcerpt,
      job.jobTitle,
      job.jobLevel,
      ...(job.jobIndustry ?? []),
      ...(job.jobType ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [job.jobGeo]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  return true;
};

const buildJobicySalary = (job: JobicyJob): string | undefined => {
  if (typeof job.salaryMin !== 'number') {
    return undefined;
  }

  const currency = job.salaryCurrency || 'USD';
  const period = job.salaryPeriod ? `/${job.salaryPeriod}` : '';
  return `${currency} ${job.salaryMin.toLocaleString()}+${period}`;
};

const buildJobicyListing = (
  userId: string,
  job: JobicyJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.url);
  const title = toNullableString(job.jobTitle);

  if (!applyUrl || !title) {
    return null;
  }

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.companyName),
    companyLogoUrl: toNullableString(job.companyLogo),
    description:
      extractHtmlText(job.jobDescription) || toNullableString(job.jobExcerpt),
    jobId: `jobicy-${job.id ?? job.jobSlug ?? applyUrl}`,
    jobProvider: JobProvider.JOBICY,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.jobType?.join(', ')),
    location: toNullableString(job.jobGeo) || 'Remote',
    postedAt: toPrismaDate(job.pubDate),
    qualifications: [
      ...(job.jobIndustry ?? []),
      ...(job.jobType ?? []),
      ...(job.jobLevel ? [job.jobLevel] : []),
    ].filter(Boolean),
    remote: true,
    requirements: [],
    responsibilities: [],
    salary: buildJobicySalary(job),
    scheduleType: toNullableString(job.jobType?.join(', ')),
    source: 'Jobicy',
    title,
    userId,
    workFromHome: true,
  };
};

const matchesRemotiveQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: RemotiveJob;
  location?: string;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.category,
      job.company_name,
      job.description,
      job.title,
      ...(job.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [job.candidate_required_location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  return true;
};

const buildRemotiveListing = (
  userId: string,
  job: RemotiveJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.url);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name),
    companyLogoUrl: toNullableString(job.company_logo),
    description: extractHtmlText(job.description),
    jobId: `remotive-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.REMOTIVE,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.job_type),
    location: toNullableString(job.candidate_required_location) || 'Remote',
    postedAt: toPrismaDate(job.publication_date),
    qualifications: [
      ...(job.tags ?? []),
      ...(job.category ? [job.category] : []),
    ].filter(Boolean),
    remote: true,
    requirements: [],
    responsibilities: [],
    salary: toNullableString(job.salary),
    scheduleType: toNullableString(job.job_type),
    source: 'Remotive',
    title,
    userId,
    workFromHome: true,
  };
};

const buildCompensationRange = ({
  currency = 'USD',
  max,
  min,
}: {
  currency?: string;
  max?: number | null;
  min?: number | null;
}): string | undefined => {
  const normalizedMin = typeof min === 'number' && min > 0 ? min : null;
  const normalizedMax = typeof max === 'number' && max > 0 ? max : null;

  if (normalizedMin && normalizedMax) {
    return `${currency} ${normalizedMin.toLocaleString()} - ${normalizedMax.toLocaleString()}`;
  }
  if (normalizedMin) {
    return `${currency} ${normalizedMin.toLocaleString()}+`;
  }
  if (normalizedMax) {
    return `Up to ${currency} ${normalizedMax.toLocaleString()}`;
  }

  return undefined;
};

const matchesHimalayasQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: HimalayasJob;
  location?: string;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.companyName,
      job.description,
      job.excerpt,
      job.title,
      ...(job.categories ?? []),
      ...(job.seniority ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = (job.locationRestrictions ?? [])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  return true;
};

const buildHimalayasListing = (
  userId: string,
  job: HimalayasJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl =
    toNullableString(job.applicationLink) || toNullableString(job.guid);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  const categories = Array.isArray(job.categories) ? job.categories : [];
  const seniority = Array.isArray(job.seniority) ? job.seniority : [];
  const location = (job.locationRestrictions ?? []).filter(Boolean).join(', ');

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.companyName),
    companyLogoUrl: toNullableString(job.companyLogo),
    description:
      extractHtmlText(job.description) || toNullableString(job.excerpt),
    jobId: `himalayas-${job.guid ?? applyUrl}`,
    jobProvider: JobProvider.HIMALAYAS,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.employmentType),
    location: toNullableString(location) || 'Remote',
    postedAt: toPrismaDateFromUnix(job.pubDate),
    qualifications: [...categories, ...seniority].filter(Boolean),
    remote: true,
    requirements: [],
    responsibilities: [],
    salary: buildCompensationRange({
      currency: job.currency || 'USD',
      min: job.minSalary,
      max: job.maxSalary,
    }),
    scheduleType: toNullableString(job.employmentType),
    source: 'Himalayas',
    title,
    userId,
    workFromHome: true,
  };
};

const matchesArbeitnowQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: ArbeitnowJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.company_name,
      job.description,
      job.location,
      job.title,
      ...(job.job_types ?? []),
      ...(job.tags ?? []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = [job.location]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  if (
    remote === true &&
    !job.remote &&
    !hasRemoteTextSignal(job.title, job.description)
  ) {
    return false;
  }

  return true;
};

const buildArbeitnowListing = (
  userId: string,
  job: ArbeitnowJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.url);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name),
    description: extractHtmlText(job.description),
    jobId: `arbeitnow-${job.slug ?? applyUrl}`,
    jobProvider: JobProvider.ARBEITNOW,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.job_types?.join(', ')),
    location: toNullableString(job.location),
    postedAt: toPrismaDateFromUnix(job.created_at),
    qualifications: [...(job.tags ?? []), ...(job.job_types ?? [])].filter(
      Boolean,
    ),
    remote:
      Boolean(job.remote) || hasRemoteTextSignal(job.title, job.description),
    requirements: [],
    responsibilities: [],
    scheduleType: toNullableString(job.job_types?.join(', ')),
    source: 'Arbeitnow',
    title,
    userId,
    workFromHome:
      Boolean(job.remote) || hasRemoteTextSignal(job.title, job.description),
  };
};

const matchesRemoteFirstJobsQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: RemoteFirstJobsJob;
  location?: string;
  searchTerm?: string;
}) => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (normalizedSearch) {
    const haystack = [
      job.category,
      job.company_name,
      job.description,
      job.seniority,
      job.title,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    if (!haystack.includes(normalizedSearch)) {
      return false;
    }
  }

  const normalizedLocation = location?.trim().toLowerCase();
  if (normalizedLocation) {
    const locationHaystack = (job.locations ?? [])
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    if (!locationHaystack.includes(normalizedLocation)) {
      return false;
    }
  }

  return true;
};

const buildRemoteFirstJobsListing = (
  userId: string,
  job: RemoteFirstJobsJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.url);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name),
    companyLogoUrl: toNullableString(job.company_logo),
    description: extractHtmlText(job.description),
    jobId: `remotefirstjobs-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.REMOTE_FIRST_JOBS,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location: (job.locations ?? []).filter(Boolean).join(', ') || 'Remote',
    postedAt: toPrismaDate(job.published_at),
    qualifications: [job.category, job.seniority].filter(
      (value): value is string => Boolean(value),
    ),
    remote: true,
    requirements: [],
    responsibilities: [],
    salary: buildCompensationRange({
      min: job.salary_min,
      max: job.salary_max,
    }),
    source: 'Remote First Jobs',
    title,
    userId,
    workFromHome: true,
  };
};

const toPositiveNumber = (value?: number | string | null): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.replace(/,/g, ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
};

const buildSalaryRange = ({
  currency = 'USD',
  max,
  min,
  raw,
}: {
  currency?: string | null;
  max?: number | string | null;
  min?: number | string | null;
  raw?: string | null;
}): string | undefined => {
  const rawSalary = toNullableString(raw);
  if (rawSalary) return rawSalary;

  return buildCompensationRange({
    currency: currency || 'USD',
    min: toPositiveNumber(min),
    max: toPositiveNumber(max),
  });
};

const parsePostedWithinDays = (
  postedWithin: string | undefined,
  mode: ScrapeMode,
): number => {
  const parsed = Number.parseInt(postedWithin ?? '', 10);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 999);
  }

  if (mode === 'backfill') return 90;
  if (mode === 'weekly') return 30;
  return 7;
};

const withinPostedWindow = ({
  date,
  days,
  insertAnyway,
}: {
  date: Date | null;
  days: number;
  insertAnyway?: boolean;
}): boolean => {
  if (insertAnyway) return true;
  if (!date) return false;
  return Date.now() - date.getTime() <= days * 86_400_000;
};

const matchesTextQuery = ({
  fields,
  searchTerm,
}: {
  fields: Array<string | null | undefined>;
  searchTerm?: string;
}): boolean => {
  const normalizedSearch = searchTerm?.trim().toLowerCase();
  if (!normalizedSearch) return true;

  const haystack = fields.filter(Boolean).join(' ').toLowerCase();
  return haystack.includes(normalizedSearch);
};

const labelNames = (labels?: JobDataApiLabel[]): string[] =>
  (labels ?? [])
    .map(label => toNullableString(label.name))
    .filter((value): value is string => Boolean(value));

const buildRemoteJobsOrgListing = (
  userId: string,
  job: RemoteJobsOrgJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.apply_url) || toNullableString(job.url);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company?.name),
    companyLogoUrl: toNullableString(job.company?.logo_url),
    description: extractHtmlText(job.description),
    jobId: `remotejobs-org-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.REMOTE_JOBS_ORG,
    jobProviderUrl: toNullableString(job.url) || applyUrl,
    jobType: mapScheduleTypeToJobType(job.type ?? undefined),
    location: toNullableString(job.location) || 'Remote',
    postedAt: toPrismaDate(job.posted_at),
    qualifications: [
      toNullableString(job.category?.name),
      toNullableString(job.type),
    ].filter((value): value is string => Boolean(value)),
    remote: true,
    requirements: [],
    responsibilities: [],
    salary: buildSalaryRange({
      min: job.salary_min,
      max: job.salary_max,
      raw: job.salary_text,
    }),
    scheduleType: toNullableString(job.type),
    source: 'RemoteJobs.org',
    title,
    userId,
    workFromHome: true,
  };
};

const matchesRemoteJobsOrgQuery = ({
  job,
  location,
  searchTerm,
}: {
  job: RemoteJobsOrgJob;
  location?: string;
  searchTerm?: string;
}): boolean =>
  matchesTextQuery({
    searchTerm,
    fields: [
      job.category?.name,
      job.company?.name,
      job.description,
      job.location,
      job.title,
      job.type,
    ],
  }) &&
  matchesTextQuery({
    searchTerm: location,
    fields: [job.location],
  });

const buildClawJobsListing = (
  userId: string,
  job: ClawJobsJob,
): Prisma.JobListingCreateManyInput | null => {
  const rawId = toNullableString(String(job.id ?? ''));
  const title = toNullableString(job.title);
  if (!rawId || !title) return null;

  const applyUrl = `https://clawjobs.cc/jobs/${rawId}`;
  const location = (job.location ?? []).filter(Boolean).join(', ');
  const isRemote =
    Boolean(job.remote) || hasRemoteTextSignal(location, job.title);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name),
    description: undefined,
    jobId: `clawjobs-${rawId}`,
    jobProvider: JobProvider.CLAW_JOBS,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location: toNullableString(location),
    postedAt: toPrismaDate(job.created_at),
    qualifications: [job.department, job.company_category].filter(
      (value): value is string => Boolean(toNullableString(value)),
    ),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'ClawJobs',
    title,
    userId,
    workFromHome: isRemote,
  };
};

const matchesClawJobsQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: ClawJobsJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}): boolean => {
  const locationText = (job.location ?? []).filter(Boolean).join(', ');
  if (
    !matchesTextQuery({
      searchTerm,
      fields: [job.company_name, job.department, job.title, locationText],
    })
  ) {
    return false;
  }

  if (
    !matchesTextQuery({
      searchTerm: location,
      fields: [locationText],
    })
  ) {
    return false;
  }

  if (remote && !job.remote && !hasRemoteTextSignal(locationText, job.title)) {
    return false;
  }

  return true;
};

const getComeetDetailValues = (job: ComeetJob, names: string[]): string[] => {
  const normalizedNames = names.map(name => name.toLowerCase());

  return (job.details ?? [])
    .filter(detail => {
      const detailName = detail.name?.toLowerCase() ?? '';
      return normalizedNames.some(name => detailName.includes(name));
    })
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(detail => extractHtmlText(detail.value))
    .filter((value): value is string => Boolean(value));
};

const formatComeetLocation = (location?: ComeetJobLocation | null): string =>
  [
    toNullableString(location?.name),
    toNullableString(location?.city),
    toNullableString(location?.state),
    toNullableString(location?.country),
  ]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(', ');

const buildComeetListing = (
  userId: string,
  job: ComeetJob,
  board: ComeetBoardConfig,
): Prisma.JobListingCreateManyInput | null => {
  const title = toNullableString(job.name);
  const applyUrl =
    toNullableString(job.url_active_page) ||
    toNullableString(job.url_comeet_hosted_page) ||
    toNullableString(job.position_url);
  if (!title || !applyUrl) return null;

  const description =
    getComeetDetailValues(job, ['description'])[0] ??
    getComeetDetailValues(job, ['about'])[0];
  const requirements = getComeetDetailValues(job, ['requirement', 'skill']);
  const responsibilities = getComeetDetailValues(job, [
    'responsibilit',
    'what you',
    'role',
  ]);
  const categoryValues = (job.categories ?? [])
    .map(category => toNullableString(category.value))
    .filter((value): value is string => Boolean(value));
  const location = formatComeetLocation(job.location);
  const isRemote =
    Boolean(job.location?.is_remote) ||
    hasRemoteTextSignal(job.workplace_type, location, title, ...categoryValues);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name) ?? board.company,
    companyLogoUrl: toNullableString(job.picture_url),
    description,
    jobId: `comeet-${board.uid}-${job.uid ?? applyUrl}`,
    jobProvider: JobProvider.COMEET,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.employment_type ?? undefined),
    location: toNullableString(location),
    postedAt: toPrismaDate(job.time_updated),
    qualifications: Array.from(
      new Set(
        [
          toNullableString(job.department),
          toNullableString(job.experience_level),
          ...categoryValues,
        ].filter((value): value is string => Boolean(value)),
      ),
    ),
    remote: isRemote,
    requirements,
    responsibilities,
    scheduleType: toNullableString(job.employment_type),
    source: 'Comeet',
    title,
    userId,
    workFromHome: isRemote,
  };
};

const matchesComeetQuery = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: ComeetJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}): boolean => {
  const locationText = formatComeetLocation(job.location);
  const detailText = getComeetDetailValues(job, ['description', 'requirement'])
    .slice(0, 3)
    .join(' ');
  const categoryValues = (job.categories ?? [])
    .map(category => toNullableString(category.value))
    .filter((value): value is string => Boolean(value));

  if (
    !matchesTextQuery({
      searchTerm,
      fields: [
        job.company_name,
        job.department,
        job.employment_type,
        job.experience_level,
        job.name,
        job.workplace_type,
        locationText,
        detailText,
        ...categoryValues,
      ],
    })
  ) {
    return false;
  }

  if (
    !matchesTextQuery({
      searchTerm: location,
      fields: [locationText, job.workplace_type],
    })
  ) {
    return false;
  }

  if (
    remote &&
    !job.location?.is_remote &&
    !hasRemoteTextSignal(job.workplace_type, locationText, job.name)
  ) {
    return false;
  }

  return true;
};

const buildTheirStackListing = (
  userId: string,
  job: TheirStackJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.apply_url) || toNullableString(job.url);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  const location = [
    toNullableString(job.city),
    toNullableString(job.region),
    toNullableString(job.country),
  ]
    .filter(Boolean)
    .join(', ');
  const isRemote =
    Boolean(job.is_remote) ||
    hasRemoteTextSignal(job.remote_type, job.location, job.description);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name),
    companyLogoUrl: toNullableString(job.company_logo_url),
    description: extractHtmlText(job.description),
    jobId: `theirstack-${job.job_id ?? job.id ?? applyUrl}`,
    jobProvider: JobProvider.THEIRSTACK,
    jobProviderUrl: toNullableString(job.url) || applyUrl,
    jobType: mapScheduleTypeToJobType(job.employment_type),
    location: toNullableString(job.location) || toNullableString(location),
    postedAt: toPrismaDate(job.date_posted || job.discovered_at),
    qualifications: [
      ...(job.tags ?? []),
      ...(job.seniority ? [job.seniority] : []),
    ].filter(Boolean),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    salary: buildSalaryRange({
      currency: job.salary_currency,
      min: job.salary_min,
      max: job.salary_max,
      raw: job.salary_string,
    }),
    scheduleType: toNullableString(job.employment_type),
    source: toNullableString(job.source) || 'TheirStack',
    title,
    userId,
    workFromHome: isRemote,
  };
};

const buildJobDataApiListing = (
  userId: string,
  job: JobDataApiJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.application_url);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  const types = labelNames(job.types ?? job.job_types);
  const geoParts = [
    toNullableString(job.location_string),
    toNullableString(job.location),
    ...labelNames(job.cities),
    ...labelNames(job.states),
    ...labelNames(job.countries),
  ];
  const location = Array.from(new Set(geoParts.filter(Boolean))).join(', ');
  const description =
    toNullableString(job.description_string) ||
    toNullableString(job.description_str) ||
    extractHtmlText(job.description);
  const isRemote =
    Boolean(job.has_remote) ||
    hasRemoteTextSignal(job.location, job.location_string, description);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company?.name),
    companyLogoUrl: toNullableString(job.company?.logo),
    description,
    jobId: `jobdataapi-${job.ext_id ?? job.id ?? applyUrl}`,
    jobProvider: JobProvider.JOB_DATA_API,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.job_type || types.join(', ')),
    location: toNullableString(location),
    postedAt: toPrismaDate(job.published),
    qualifications: types,
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    salary: buildSalaryRange({
      currency: job.salary_currency,
      min: job.salary_min,
      max: job.salary_max,
    }),
    scheduleType: toNullableString(job.job_type || types.join(', ')),
    source: 'JobDataAPI',
    title,
    userId,
    workFromHome: isRemote,
  };
};

const buildFindworkListing = (
  userId: string,
  job: FindworkJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.url);
  const title = toNullableString(job.role) || toNullableString(job.title);

  if (!applyUrl || !title) {
    return null;
  }

  const isRemote =
    Boolean(job.remote) ||
    hasRemoteTextSignal(job.location, job.role, job.title, job.text);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name),
    description: extractHtmlText(job.text),
    jobId: `findwork-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.FINDWORK,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location: toNullableString(job.location),
    postedAt: toPrismaDate(job.date_posted),
    qualifications: Array.isArray(job.keywords) ? job.keywords : [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'Findwork',
    title,
    userId,
    workFromHome: isRemote,
  };
};

const parseWorkdayPostedOn = (value?: string | null): Date | null => {
  const text = toNullableString(value)?.toLowerCase();
  if (!text) return null;

  const now = new Date();
  if (text.includes('today')) return now;
  if (text.includes('yesterday')) {
    return new Date(now.getTime() - 86_400_000);
  }

  const match = text.match(/(\d+)\s*\+?\s*days?/i);
  if (!match) return null;
  const days = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(days)) return null;
  return new Date(now.getTime() - days * 86_400_000);
};

const buildWorkdayBoardListing = (
  userId: string,
  job: WorkdayJob,
  board: WorkdayBoardConfig,
): Prisma.JobListingCreateManyInput | null => {
  const title = toNullableString(job.title);
  const externalPath = toNullableString(job.externalPath);
  if (!title || !externalPath) return null;

  const applyUrl = toAbsoluteUrl(
    `/${board.site}${externalPath}`,
    `https://${board.host}`,
  );
  if (!applyUrl) return null;

  const location = toNullableString(job.locationsText);
  const isRemote = hasRemoteTextSignal(location, job.remoteType, title);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: board.company,
    description: undefined,
    jobId: `workday-${board.tenant}-${board.site}-${job.bulletFields?.[0] ?? job.externalPath ?? applyUrl}`,
    jobProvider: JobProvider.WORKDAY,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: parseWorkdayPostedOn(job.postedOn),
    qualifications: job.bulletFields ?? [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    scheduleType: toNullableString(job.remoteType),
    source: 'Workday',
    title,
    userId,
    workFromHome: isRemote,
  };
};

const formatBreezyLocation = (location?: BreezyJobLocation | null): string =>
  [
    toNullableString(location?.name),
    toNullableString(location?.city),
    toNullableString(location?.state?.name),
    toNullableString(location?.country?.name),
  ]
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .join(', ');

const buildBreezyBoardListing = (
  userId: string,
  job: BreezyJob,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const title = toNullableString(job.name);
  const applyUrl = toNullableString(job.url);
  if (!title || !applyUrl) return null;

  const locations =
    job.locations && job.locations.length > 0
      ? job.locations.map(formatBreezyLocation).filter(Boolean).join(' | ')
      : formatBreezyLocation(job.location);
  const isRemote =
    Boolean(job.location?.is_remote) ||
    Boolean(job.locations?.some(location => location.is_remote)) ||
    hasRemoteTextSignal(locations, title);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company?.name) ?? board,
    companyLogoUrl: toNullableString(job.company?.logo_url),
    description: extractHtmlText(job.description),
    jobId: `breezy-${board}-${job.id ?? job.friendly_id ?? applyUrl}`,
    jobProvider: JobProvider.BREEZY_HR,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.type?.name ?? undefined),
    location: toNullableString(locations),
    postedAt: toPrismaDate(job.published_date),
    qualifications: [job.department].filter((value): value is string =>
      Boolean(toNullableString(value)),
    ),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    salary: toNullableString(job.salary),
    scheduleType: toNullableString(job.type?.name),
    source: 'BreezyHR',
    title,
    userId,
    workFromHome: isRemote,
  };
};

const buildHtmlBoardListing = ({
  board,
  job,
  provider,
  source,
  userId,
}: {
  board: string;
  job: HtmlBoardJob;
  provider: 'jazzhr-boards' | 'jobvite-boards';
  source: 'JazzHR' | 'Jobvite';
  userId: string;
}): Prisma.JobListingCreateManyInput | null => {
  const title = toNullableString(job.title);
  const applyUrl = toNullableString(job.url);
  if (!title || !applyUrl) return null;

  const isRemote = hasRemoteTextSignal(job.location, job.title);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company) ?? board,
    description: extractHtmlText(job.description),
    jobId: `${provider}-${board}-${job.id ?? applyUrl}`,
    jobProvider:
      provider === 'jazzhr-boards' ? JobProvider.JAZZHR : JobProvider.JOBVITE,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(job.type ?? undefined),
    location: toNullableString(job.location),
    postedAt: toPrismaDate(job.postedAt),
    qualifications: [job.department].filter((value): value is string =>
      Boolean(toNullableString(value)),
    ),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    scheduleType: toNullableString(job.type),
    source,
    title,
    userId,
    workFromHome: isRemote,
  };
};

const parseJobviteJobs = (
  html: string,
  board: string,
  baseUrl: string,
): HtmlBoardJob[] => {
  const $ = load(html);
  const company =
    normalizeWhitespace(
      $('title')
        .first()
        .text()
        .replace(/careers/i, ''),
    ) ?? board;
  const jobs: HtmlBoardJob[] = [];

  $('table.jv-job-list tbody tr').each((_, row) => {
    const item = $(row);
    const link = item.find('.jv-job-list-name a').first();
    const title = normalizeWhitespace(link.text());
    const url = toAbsoluteUrl(link.attr('href'), baseUrl);
    if (!title || !url) return;

    jobs.push({
      company,
      id: link.attr('href')?.split('/').filter(Boolean).pop(),
      location: normalizeWhitespace(item.find('.jv-job-list-location').text()),
      title,
      url,
    });
  });

  return jobs;
};

const parseJazzHrJobs = (
  html: string,
  board: string,
  baseUrl: string,
): HtmlBoardJob[] => {
  const $ = load(html);
  const company =
    normalizeWhitespace(
      $('link[rel="canonical"]')
        .attr('href')
        ?.replace(/^https?:\/\//, ''),
    ) ?? board;
  const jobs: HtmlBoardJob[] = [];

  $('#jobs_table tr').each((_, row) => {
    const item = $(row);
    const link = item.find('a.job_title_link').first();
    const title = normalizeWhitespace(link.text());
    const url = toAbsoluteUrl(link.attr('href'), baseUrl);
    if (!title || !url) return;

    const cells = item.find('td').toArray();
    jobs.push({
      company,
      department: normalizeWhitespace(
        item.find('.resumator_department').text(),
      ),
      id:
        item.attr('id') ??
        link
          .attr('href')
          ?.split('/')
          .filter(Boolean)
          .pop()
          ?.replace(/\?.*/, ''),
      location: normalizeWhitespace($(cells[1]).text()),
      title,
      url,
    });
  });

  return jobs;
};

const matchesHtmlBoardJob = ({
  job,
  location,
  remote,
  searchTerm,
}: {
  job: HtmlBoardJob;
  location?: string;
  remote?: boolean;
  searchTerm?: string;
}): boolean => {
  if (
    !matchesTextQuery({
      searchTerm,
      fields: [job.company, job.department, job.location, job.title],
    })
  ) {
    return false;
  }

  if (
    !matchesTextQuery({
      searchTerm: location,
      fields: [job.location],
    })
  ) {
    return false;
  }

  if (remote && !hasRemoteTextSignal(job.location, job.title)) {
    return false;
  }

  return true;
};

// ---------------------------------------------------------------------------
// Adzuna types + transform
// ---------------------------------------------------------------------------

interface AdzunaJob {
  id?: string;
  title?: string;
  description?: string;
  company?: { display_name?: string };
  location?: { display_name?: string; area?: string[] };
  created?: string;
  redirect_url?: string;
  salary_min?: number;
  salary_max?: number;
  salary_is_predicted?: string;
  contract_time?: string;
  contract_type?: string;
  category?: { label?: string; tag?: string };
}

interface AdzunaResponse {
  results?: AdzunaJob[];
  count?: number;
  mean?: number;
}

const buildAdzunaListing = (
  userId: string,
  job: AdzunaJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.redirect_url);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) return null;

  const locationParts = job.location?.area ?? [];
  const locationDisplay =
    toNullableString(job.location?.display_name) ??
    locationParts.join(', ') ??
    'United States';

  const isRemote =
    locationDisplay.toLowerCase().includes('remote') ||
    hasRemoteTextSignal(job.title, job.description);

  let jobType: JobType = JobType.UNKNOWN;
  if (job.contract_time === 'full_time') jobType = JobType.FULL_TIME;
  else if (job.contract_time === 'part_time') jobType = JobType.PART_TIME;
  else if (job.contract_type === 'contract') jobType = JobType.CONTRACT;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company?.display_name),
    description: extractHtmlText(job.description),
    jobId: `adzuna-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.ADZUNA,
    jobProviderUrl: applyUrl,
    jobType,
    location: locationDisplay,
    postedAt: toPrismaDate(job.created),
    qualifications: job.category?.label ? [job.category.label] : [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    salary: buildCompensationRange({
      min: job.salary_min,
      max: job.salary_max,
    }),
    source: 'Adzuna',
    title,
    userId,
    workFromHome: isRemote,
  };
};

// ---------------------------------------------------------------------------
// Jooble types + transform
// ---------------------------------------------------------------------------

interface JoobleJob {
  title?: string;
  location?: string;
  snippet?: string;
  salary?: string;
  source?: string;
  type?: string;
  link?: string;
  company?: string;
  updated?: string;
  id?: string;
}

interface JoobleResponse {
  jobs?: JoobleJob[];
  totalCount?: number;
}

const buildJoobleListing = (
  userId: string,
  job: JoobleJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.link);
  const title = toNullableString(job.title);

  if (!applyUrl || !title) return null;

  const location = toNullableString(job.location) ?? 'United States';
  const isRemote =
    location.toLowerCase().includes('remote') ||
    hasRemoteTextSignal(job.title, job.snippet);

  let jobType: JobType = JobType.UNKNOWN;
  const typeStr = (job.type ?? '').toLowerCase();
  if (typeStr.includes('full')) jobType = JobType.FULL_TIME;
  else if (typeStr.includes('part')) jobType = JobType.PART_TIME;
  else if (typeStr.includes('contract')) jobType = JobType.CONTRACT;
  else if (typeStr.includes('intern')) jobType = JobType.INTERNSHIP;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    description: extractHtmlText(job.snippet),
    jobId: `jooble-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.JOOBLE,
    jobProviderUrl: applyUrl,
    jobType,
    location,
    postedAt: toPrismaDate(job.updated),
    qualifications: [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    salary: toNullableString(job.salary),
    source: toNullableString(job.source) ?? 'Jooble',
    title,
    userId,
    workFromHome: isRemote,
  };
};

// ---------------------------------------------------------------------------
// DevITjobs types + transform
// ---------------------------------------------------------------------------

interface DevITJob {
  _id?: string;
  actualCity?: string;
  annualSalaryFrom?: number;
  annualSalaryTo?: number;
  company?: string;
  companySize?: string;
  expLevel?: string;
  hasVisaSponsorship?: string;
  jobType?: string;
  jobUrl?: string;
  logoImg?: string;
  name?: string;
  redirectJobUrl?: string;
  remoteType?: string;
  stateCategory?: string;
  techCategory?: string;
  technologies?: string[];
  workplace?: string;
  activeFrom?: string;
}

const US_STATE_CATEGORIES = new Set([
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'District-Of-Columbia',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New-Hampshire',
  'New-Jersey',
  'New-Mexico',
  'New-York',
  'North-Carolina',
  'North-Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode-Island',
  'South-Carolina',
  'South-Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West-Virginia',
  'Wisconsin',
  'Wyoming',
]);

const buildDevITJobsListing = (
  userId: string,
  job: DevITJob,
): Prisma.JobListingCreateManyInput | null => {
  const redirectUrl = toNullableString(job.redirectJobUrl);
  const jobSlug = toNullableString(job.jobUrl);
  const applyUrl =
    redirectUrl ?? (jobSlug ? `https://devitjobs.com/jobs/${jobSlug}` : null);
  const title = toNullableString(job.name);
  if (!applyUrl || !title) return null;

  const location =
    [job.actualCity, job.stateCategory?.replace(/-/g, ' ')]
      .filter(Boolean)
      .join(', ') || 'United States';
  const isRemote =
    job.workplace === 'remote' ||
    job.remoteType === 'fully' ||
    hasRemoteTextSignal(job.name);

  let jobType: JobType = JobType.UNKNOWN;
  if (job.jobType === 'Full-Time') jobType = JobType.FULL_TIME;
  else if (job.jobType === 'Part-Time') jobType = JobType.PART_TIME;
  else if (job.jobType === 'Contract') jobType = JobType.CONTRACT;
  else if (job.jobType === 'Internship') jobType = JobType.INTERNSHIP;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company),
    companyLogoUrl: toNullableString(job.logoImg),
    description: undefined,
    jobId: `devitjobs-${job._id ?? applyUrl}`,
    jobProvider: JobProvider.DEV_IT_JOBS,
    jobProviderUrl: applyUrl,
    jobType,
    location,
    postedAt: toPrismaDate(job.activeFrom),
    qualifications: (job.technologies ?? []).filter(Boolean),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    salary: buildCompensationRange({
      min: job.annualSalaryFrom,
      max: job.annualSalaryTo,
    }),
    source: 'DevITjobs',
    title,
    userId,
    workFromHome: isRemote,
  };
};

// ---------------------------------------------------------------------------
// Persistence (createMany + skipDuplicates, update existing)
// ---------------------------------------------------------------------------

const shouldPreserveNonEmptyExtensions = (
  incoming: unknown,
  existing: unknown,
): boolean =>
  Array.isArray(existing) &&
  existing.length > 0 &&
  (!Array.isArray(incoming) || incoming.length === 0);

const buildJobListingUpdateData = (
  listing: Prisma.JobListingCreateManyInput,
  existing?: Record<string, unknown>,
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
  extensions: shouldPreserveNonEmptyExtensions(
    listing.extensions,
    existing?.extensions,
  )
    ? undefined
    : listing.extensions,
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

const DIFF_FIELDS = [
  'applyOptions',
  'benefits',
  'company',
  'companyLogoUrl',
  'dentalCoverage',
  'description',
  'detectedExtensions',
  'extensions',
  'healthInsurance',
  'jobProvider',
  'jobProviderUrl',
  'jobType',
  'location',
  'paidTimeOff',
  'postedAt',
  'qualifications',
  'remote',
  'requirements',
  'responsibilities',
  'salary',
  'scheduleType',
  'source',
  'title',
  'workFromHome',
] as const;

const MAX_DIFF_VALUE_LENGTH = 60;
const MAX_CHANGED_FIELDS_PER_LISTING = 5;

const truncateDiffValue = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return str.length > MAX_DIFF_VALUE_LENGTH
    ? `${str.slice(0, MAX_DIFF_VALUE_LENGTH)}…`
    : str;
};

const normalizeForComparison = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const diffListingFields = (
  existing: Record<string, unknown>,
  incoming: Prisma.JobListingCreateManyInput,
): {
  changedFields: AdminScrapeUpdatedListingPreview['changedFields'];
  hasChanges: boolean;
} => {
  const updateData = buildJobListingUpdateData(incoming, existing);
  const changedFields: AdminScrapeUpdatedListingPreview['changedFields'] = [];

  for (const field of DIFF_FIELDS) {
    const incomingValue = updateData[field as keyof typeof updateData];
    if (incomingValue === undefined) {
      continue;
    }

    const oldVal = normalizeForComparison(
      existing[field as keyof typeof existing],
    );
    const newVal = normalizeForComparison(incomingValue);
    if (oldVal !== newVal) {
      if (changedFields.length < MAX_CHANGED_FIELDS_PER_LISTING) {
        changedFields.push({
          field,
          from: truncateDiffValue(existing[field as keyof typeof existing]),
          to: truncateDiffValue(incomingValue),
        });
      }
    }
  }

  return { changedFields, hasChanges: changedFields.length > 0 };
};

const REMOTE_FEED_SOURCES = new Set([
  'We Work Remotely',
  'Remote OK',
  'Jobicy',
  'Remotive',
  'Himalayas',
  'Remote First Jobs',
]);

const normalizeDedupeText = (value?: string | null): string =>
  (value || '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const normalizeUrlForDedupe = (value?: string | null): string | null => {
  if (!value) return null;

  try {
    const url = new URL(value);
    url.hash = '';
    url.search = '';
    return url.toString().replace(/\/+$/, '');
  } catch {
    return value.trim().replace(/\/+$/, '').toLowerCase() || null;
  }
};

const extractApplyUrlForDedupe = (
  listing: Pick<
    Prisma.JobListingCreateManyInput,
    'applyOptions' | 'jobProviderUrl'
  >,
): string | null => {
  if (
    listing.applyOptions &&
    typeof listing.applyOptions === 'object' &&
    !Array.isArray(listing.applyOptions)
  ) {
    const applyUrl = (listing.applyOptions as Record<string, unknown>).applyUrl;
    if (typeof applyUrl === 'string' && applyUrl.trim()) {
      return normalizeUrlForDedupe(applyUrl);
    }
  }

  return normalizeUrlForDedupe(listing.jobProviderUrl);
};

const buildRemoteFeedDedupeKey = (
  listing: Pick<
    Prisma.JobListingCreateManyInput,
    'applyOptions' | 'company' | 'jobProviderUrl' | 'source' | 'title'
  >,
): string | null => {
  if (!listing.source || !REMOTE_FEED_SOURCES.has(listing.source)) {
    return null;
  }

  const applyUrl = extractApplyUrlForDedupe(listing);
  if (applyUrl) {
    return `url:${applyUrl}`;
  }

  const normalizedTitle = normalizeDedupeText(listing.title);
  const normalizedCompany = normalizeDedupeText(listing.company);

  if (!normalizedTitle || !normalizedCompany) {
    return null;
  }

  return `title-company:${normalizedTitle}::${normalizedCompany}`;
};

const buildCreatedListingPreview = (
  listing: Prisma.JobListingCreateManyInput,
): NonNullable<
  AdminScrapeProgressPayload['recentCreatedListings']
>[number] => ({
  applyUrl:
    extractApplyUrlForDedupe({
      applyOptions: listing.applyOptions,
      jobProviderUrl: listing.jobProviderUrl,
    }) ??
    listing.jobProviderUrl ??
    null,
  company: listing.company ?? null,
  jobProvider:
    listing.jobProvider === JobProvider.OTHER
      ? (listing.source ?? null)
      : listing.jobProvider,
  location: listing.location ?? null,
  postedAt:
    listing.postedAt instanceof Date
      ? listing.postedAt.toISOString()
      : typeof listing.postedAt === 'string'
        ? listing.postedAt
        : null,
  source: listing.source ?? null,
  title: listing.title,
});

const buildRejectedListingPreview = ({
  company,
  location,
  reason,
  source,
  title,
}: {
  company?: string | null;
  location?: string | null;
  reason: string;
  source?: string | null;
  title?: string | null;
}): NonNullable<
  AdminScrapeProgressPayload['recentRejectedListings']
>[number] => ({
  company: toNullableString(company),
  location: toNullableString(location),
  reason,
  source: toNullableString(source),
  title: toNullableString(title) ?? 'Untitled job',
});

/**
 * Render a terse " (reason1: n, reason2: m)" suffix for a persist
 * breakdown. Empty string when no drops. Appended to live progress log
 * messages so the "fetched N -> created M" gap is self-explaining.
 */
const breakdownSuffix = (breakdown?: AdminScrapePersistBreakdown): string => {
  if (!breakdown) return '';
  const parts: string[] = [];
  if (breakdown.alreadyExistsSameUser > 0) {
    parts.push(`alreadyExists: ${breakdown.alreadyExistsSameUser}`);
  }
  if (breakdown.inBatchDuplicate > 0) {
    parts.push(`inBatchDup: ${breakdown.inBatchDuplicate}`);
  }
  if (breakdown.crossFeedDuplicate > 0) {
    parts.push(`crossFeedDup: ${breakdown.crossFeedDuplicate}`);
  }
  if (breakdown.dbSkipDuplicates > 0) {
    parts.push(`dbSkipDup: ${breakdown.dbSkipDuplicates}`);
  }
  return parts.length > 0 ? ` (${parts.join(', ')})` : '';
};

const diagnosticsFromPersistBreakdown = ({
  breakdown,
  skipped,
  updated,
}: {
  breakdown?: AdminScrapePersistBreakdown;
  skipped: number;
  updated: number;
}): AdminScrapeProgressPayload['diagnostics'] => {
  const reasons = [
    breakdown && breakdown.alreadyExistsSameUser > 0
      ? `${breakdown.alreadyExistsSameUser} jobs already exist for this user and this run is not updating existing listings`
      : null,
    breakdown && breakdown.inBatchDuplicate > 0
      ? `${breakdown.inBatchDuplicate} jobs were duplicate job ids inside this provider batch`
      : null,
    breakdown && breakdown.crossFeedDuplicate > 0
      ? `${breakdown.crossFeedDuplicate} jobs were duplicate remote-feed listings by apply URL or title/company`
      : null,
    breakdown && breakdown.dbSkipDuplicates > 0
      ? `${breakdown.dbSkipDuplicates} jobs were rejected by the database duplicate guard`
      : null,
    updated > 0
      ? `${updated} matching jobs already existed and were updated instead of created`
      : null,
    skipped > 0 && !breakdown
      ? `${skipped} jobs were skipped because they were duplicates or already existed`
      : null,
  ].filter((value): value is string => Boolean(value));

  if (reasons.length === 0) return undefined;

  return {
    duplicateOrExisting: skipped,
    updatedExisting: updated,
    reasons,
  };
};

let supportedJobProviderValuesPromise: Promise<ReadonlySet<string> | null> | null =
  null;

const getSupportedJobProviderValues = async (): Promise<
  ReadonlySet<string> | null
> => {
  supportedJobProviderValuesPromise ??= db
    .$queryRaw<Array<{ enumlabel: string }>>`
      SELECT e.enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'JobBoard'
    `
    .then(rows => new Set(rows.map(row => row.enumlabel)))
    .catch(() => null);

  return supportedJobProviderValuesPromise;
};

const normalizeListingForPersist = (
  listing: Prisma.JobListingCreateManyInput,
  supportedJobProviders: ReadonlySet<string> | null,
): Prisma.JobListingCreateManyInput => {
  if (
    listing.jobProvider &&
    supportedJobProviders &&
    !supportedJobProviders.has(String(listing.jobProvider))
  ) {
    return {
      ...listing,
      jobProvider: JobProvider.OTHER,
    };
  }
  return listing;
};

const persistListings = async ({
  userId,
  listings,
  updateExisting = false,
}: {
  userId: string;
  listings: Prisma.JobListingCreateManyInput[];
  updateExisting?: boolean;
}): Promise<{
  created: number;
  recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  >;
  recentUpdatedListings: AdminScrapeUpdatedListingPreview[];
  skipped: number;
  updated: number;
  /** Per-reason breakdown of rows fetched but not persisted. Exposes
   *  drop paths the flat `skipped` counter does not cover (in-batch
   *  jobId dupe, cross-feed dupe, same-user+updateExisting=false, and
   *  Postgres createMany skipDuplicates). */
  breakdown: AdminScrapePersistBreakdown;
}> => {
  const emptyBreakdown: AdminScrapePersistBreakdown = {
    alreadyExistsSameUser: 0,
    crossFeedDuplicate: 0,
    dbSkipDuplicates: 0,
    inBatchDuplicate: 0,
  };
  const supportedJobProviders = await getSupportedJobProviderValues();
  const normalizedListings = listings.map(listing =>
    normalizeListingForPersist(listing, supportedJobProviders),
  );

  if (normalizedListings.length === 0) {
    return {
      breakdown: emptyBreakdown,
      created: 0,
      recentCreatedListings: [],
      recentUpdatedListings: [],
      skipped: 0,
      updated: 0,
    };
  }

  // Dedupe by jobId - count the silent drops so the live progress UI
  // can explain "91 fetched -> 8 created" without leaving 83 unaccounted.
  const unique = new Map<string, Prisma.JobListingCreateManyInput>();
  for (const l of normalizedListings) {
    if (l.jobId?.trim()) unique.set(l.jobId, l);
  }
  const dedupedByJobId = Array.from(unique.values());
  const inBatchDuplicate = normalizedListings.length - dedupedByJobId.length;
  const remoteFeedSeenKeys = new Set<string>();
  let crossFeedDuplicate = 0;
  const deduped = dedupedByJobId.filter(listing => {
    const dedupeKey = buildRemoteFeedDedupeKey(listing);
    if (!dedupeKey) {
      return true;
    }
    if (remoteFeedSeenKeys.has(dedupeKey)) {
      crossFeedDuplicate += 1;
      return false;
    }
    remoteFeedSeenKeys.add(dedupeKey);
    return true;
  });

  const jobIds = deduped.map(l => l.jobId);
  const remoteFeedListings = deduped.filter(
    listing => listing.source && REMOTE_FEED_SOURCES.has(listing.source),
  );
  const remoteFeedApplyUrls = remoteFeedListings
    .map(listing => extractApplyUrlForDedupe(listing))
    .filter((value): value is string => Boolean(value));
  const remoteFeedTitleCompanyPairs = remoteFeedListings
    .map(listing => ({
      company: listing.company?.trim(),
      title: listing.title?.trim(),
    }))
    .filter(pair => pair.company && pair.title);
  const existingWhereClauses: Prisma.JobListingWhereInput[] = [
    { jobId: { in: jobIds } },
  ];
  if (remoteFeedApplyUrls.length > 0) {
    existingWhereClauses.push({
      jobProviderUrl: { in: remoteFeedApplyUrls },
      source: { in: Array.from(REMOTE_FEED_SOURCES) },
    });
  }
  if (remoteFeedTitleCompanyPairs.length > 0) {
    existingWhereClauses.push({
      OR: remoteFeedTitleCompanyPairs.map(pair => ({
        company: { equals: pair.company, mode: 'insensitive' },
        source: { in: Array.from(REMOTE_FEED_SOURCES) },
        title: { equals: pair.title, mode: 'insensitive' },
      })),
    });
  }

  const existing = await db.jobListing.findMany({
    where: {
      OR: existingWhereClauses,
    },
    select: {
      applyOptions: true,
      benefits: true,
      company: true,
      companyLogoUrl: true,
      dentalCoverage: true,
      description: true,
      detectedExtensions: true,
      extensions: true,
      healthInsurance: true,
      jobId: true,
      jobProvider: true,
      jobProviderUrl: true,
      jobType: true,
      location: true,
      paidTimeOff: true,
      postedAt: true,
      qualifications: true,
      remote: true,
      requirements: true,
      responsibilities: true,
      salary: true,
      scheduleType: true,
      source: true,
      title: true,
      userId: true,
      workFromHome: true,
    },
  });
  const existingMap = new Map(existing.map(e => [e.jobId, e]));
  const existingRemoteFeedKeys = new Set(
    existing
      .map(existingListing =>
        buildRemoteFeedDedupeKey({
          applyOptions:
            (existingListing.applyOptions as Prisma.JobListingCreateManyInput['applyOptions']) ??
            undefined,
          company: existingListing.company ?? undefined,
          jobProviderUrl: existingListing.jobProviderUrl ?? undefined,
          source: existingListing.source ?? undefined,
          title: existingListing.title,
        }),
      )
      .filter((key): key is string => Boolean(key)),
  );

  const toCreate: Prisma.JobListingCreateManyInput[] = [];
  const toUpdate: Prisma.JobListingCreateManyInput[] = [];
  // Start `skipped` with the rows already dropped at dedupe time so the
  // card balances (fetched = created + updated + skipped). Each reason
  // is still tracked separately in `breakdown` for the log message.
  let skipped = inBatchDuplicate + crossFeedDuplicate;
  let alreadyExistsSameUser = 0;

  for (const listing of deduped) {
    const record = existingMap.get(listing.jobId);
    const remoteFeedKey = buildRemoteFeedDedupeKey(listing);

    if (!record) {
      if (remoteFeedKey && existingRemoteFeedKeys.has(remoteFeedKey)) {
        skipped++;
        continue;
      }
      toCreate.push(listing);
    } else if (record.userId !== userId) {
      skipped++;
    } else if (updateExisting) {
      toUpdate.push(listing);
    } else {
      // Same-user collision with updateExisting=false. Previously fell
      // through without being counted anywhere, leaving fetched != created
      // + updated + skipped on re-ingest runs. Now counted in both the
      // flat `skipped` total (so the card balances) and the breakdown
      // (so the log still explains why).
      alreadyExistsSameUser++;
      skipped++;
    }
  }

  let created = 0;
  let dbSkipDuplicates = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  if (toCreate.length > 0) {
    const result = await db.jobListing.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
    created = result.count;
    dbSkipDuplicates = Math.max(0, toCreate.length - created);
    skipped += dbSkipDuplicates;
    recentCreatedListings = toCreate
      .slice(0, Math.min(created, toCreate.length))
      .map(buildCreatedListingPreview);
  }

  let updated = 0;
  if (toUpdate.length > 0) {
    const actuallyChanged: Prisma.JobListingCreateManyInput[] = [];
    for (const item of toUpdate) {
      const existingRecord = existingMap.get(item.jobId);
      if (!existingRecord) {
        skipped++;
        continue;
      }
      const diff = diffListingFields(
        existingRecord as unknown as Record<string, unknown>,
        item,
      );
      if (!diff.hasChanges) {
        skipped++;
        continue;
      }
      actuallyChanged.push(item);
      recentUpdatedListings.push({
        changedFields: diff.changedFields,
        company: toNullableString(item.company),
        title: toNullableString(item.title) ?? 'Untitled job',
      });
    }

    for (
      let index = 0;
      index < actuallyChanged.length;
      index += DB_UPDATE_BATCH_SIZE
    ) {
      const chunk = actuallyChanged.slice(index, index + DB_UPDATE_BATCH_SIZE);
      await db.$transaction(
        chunk.map(item =>
          db.jobListing.update({
            where: { jobId: item.jobId },
            data: buildJobListingUpdateData(
              item,
              existingMap.get(item.jobId) as unknown as
                | Record<string, unknown>
                | undefined,
            ),
          }),
        ),
      );
      updated += chunk.length;
    }
  }

  return {
    breakdown: {
      alreadyExistsSameUser,
      crossFeedDuplicate,
      dbSkipDuplicates,
      inBatchDuplicate,
    },
    created,
    recentCreatedListings,
    recentUpdatedListings,
    skipped,
    updated,
  };
};

// ---------------------------------------------------------------------------
// Rate-limit parsing
// ---------------------------------------------------------------------------

const parseRateLimit = (headers: Headers): FantasticRateLimit => ({
  jobsLimit:
    parseInt(headers.get('x-ratelimit-jobs-limit') || '0') || undefined,
  jobsRemaining:
    parseInt(headers.get('x-ratelimit-jobs-remaining') || '0') || undefined,
  jobsResetSeconds:
    parseInt(headers.get('x-ratelimit-jobs-reset') || '0') || undefined,
  requestsLimit:
    parseInt(headers.get('x-ratelimit-requests-limit') || '0') || undefined,
  requestsRemaining:
    parseInt(headers.get('x-ratelimit-requests-remaining') || '0') || undefined,
});

const fetchFantasticEndpoint = async ({
  apiKey,
  endpoint,
  params,
}: {
  apiKey: string;
  endpoint: string;
  params: URLSearchParams;
}): Promise<{
  payload: unknown;
  rateLimit: FantasticRateLimit;
  requestUrl: string;
  responseStatus: number;
  responseBodyPreview: string;
}> => {
  const url = `${FANTASTIC_API_BASE}/${endpoint}?${params.toString()}`;
  const response = await resilientFetch(url, {
    method: 'GET',
    retryPolicy: 'api',
    headers: {
      'x-rapidapi-host': FANTASTIC_HOST,
      'x-rapidapi-key': apiKey,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `Fantastic.jobs ${endpoint} failed: ${response.status} ${body}`,
    );
  }

  const rawBody = await response.text();
  const payload = JSON.parse(rawBody) as unknown;
  return {
    payload,
    rateLimit: parseRateLimit(response.headers),
    requestUrl: url,
    responseStatus: response.status,
    responseBodyPreview:
      rawBody.length > 6000 ? `${rawBody.slice(0, 6000)}…` : rawBody,
  };
};

const extractExpiredJobIds = (payload: unknown): string[] => {
  const directArray = Array.isArray(payload) ? payload : null;
  const objectPayload =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : null;
  const nestedArray =
    objectPayload && Array.isArray(objectPayload.ids)
      ? objectPayload.ids
      : objectPayload && Array.isArray(objectPayload.job_ids)
        ? objectPayload.job_ids
        : null;
  const candidates = directArray ?? nestedArray ?? [];

  return candidates
    .filter((item): item is string => typeof item === 'string')
    .map(item => item.trim())
    .filter(Boolean);
};

const toChunks = <T>(items: T[], size: number): T[][] => {
  if (size <= 0) return [items];
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const recordIngestionAuditLog = async ({
  userId,
  action,
  actionType,
  metadata,
}: {
  userId: string;
  action: string;
  actionType: string;
  metadata: Record<string, unknown>;
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
    console.error('Failed to persist ingestion audit log', error);
  }
};

const toAuditNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const getCurrentMonthBounds = (now = new Date()) => ({
  cycleStart: new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
  ),
  cycleEnd: new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0),
  ),
});

const getProviderApiRequestsThisMonth = async (
  provider: ScrapeProvider,
): Promise<number> => {
  const { cycleEnd, cycleStart } = getCurrentMonthBounds();
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
      metadata: true,
    },
  });

  return logs.reduce((total, log) => {
    const metadata =
      log.metadata && typeof log.metadata === 'object'
        ? (log.metadata as Record<string, unknown>)
        : {};

    if (metadata.provider !== provider) {
      return total;
    }

    return total + Math.max(0, Math.floor(toAuditNumber(metadata.apiRequests)));
  }, 0);
};

const maskIngestionAuditText = (value: string): string => {
  const patterns = [
    /([?&](?:apikey|api_key|access_token|token)=)([^&\s]+)/gi,
    /((?:apikey|api_key|access_token|token|authorization|x-rapidapi-key)\s*[:=]\s*["']?)([^"',\s}]+)/gi,
    /(Bearer\s+)([A-Za-z0-9._-]+)/gi,
  ];

  return patterns.reduce(
    (current, pattern) =>
      current.replace(pattern, (_, prefix: string) => `${prefix}••••••••••••`),
    value,
  );
};

// ---------------------------------------------------------------------------
// Progress broadcasting
// ---------------------------------------------------------------------------

class ScrapeCancelledError extends Error {
  constructor(scrapeId: string) {
    super(`Scrape ${scrapeId} was cancelled`);
    this.name = 'ScrapeCancelledError';
  }
}

// scrapeId -> { sessionId, sequence } so broadcastProgress can persist events
// to the matching ScrapeSession row without changing every callsite signature.
const sessionLookup = new Map<
  string,
  { sessionId: string; sequence: number }
>();

export async function registerScrapeSession(
  scrapeId: string,
  sessionId: string,
): Promise<void> {
  sessionLookup.set(scrapeId, { sessionId, sequence: 0 });
}

export async function unregisterScrapeSession(scrapeId: string): Promise<void> {
  sessionLookup.delete(scrapeId);
}

const persistSessionEvent = async (
  scrapeId: string,
  kind: 'PROGRESS' | 'REQUEST_LOG' | 'LOG',
  payload: unknown,
): Promise<void> => {
  const entry = sessionLookup.get(scrapeId);
  if (!entry) return;
  const sequence = entry.sequence;
  entry.sequence += 1;
  try {
    await db.scrapeSessionEvent.create({
      data: {
        kind,
        payload: payload as Prisma.InputJsonValue,
        sequence,
        sessionId: entry.sessionId,
      },
    });
  } catch (error) {
    console.error('Failed to persist scrape session event:', error);
  }
};

const BROADCAST_LISTING_PREVIEW_CAP = 20;

const trimProgressForBroadcast = (
  payload: Omit<AdminScrapeProgressPayload, 'requestLog'>,
): Omit<AdminScrapeProgressPayload, 'requestLog'> => {
  const trim = <T>(arr: T[] | undefined): T[] | undefined =>
    arr && arr.length > BROADCAST_LISTING_PREVIEW_CAP
      ? arr.slice(-BROADCAST_LISTING_PREVIEW_CAP)
      : arr;
  return {
    ...payload,
    recentCreatedListings: trim(payload.recentCreatedListings),
    recentRejectedListings: trim(payload.recentRejectedListings),
    recentUpdatedListings: trim(payload.recentUpdatedListings),
  };
};

// Optional override for the cancellation hook. The web /api/admin/scrape
// route never sets this — it relies on the dynamic-import fallback so
// behavior is unchanged. The desktop Electron main process installs an
// override at startup via setScrapeCancellationHook() so cancellation
// stays local to its own process (no cross-import to a Next.js route).
let cancellationHookOverride: ((scrapeId: string) => boolean) | null = null;
let pauseHookOverride: ((scrapeId: string) => boolean) | null = null;
// Async because the surrounding module has Next.js's 'use server'
// directive, which requires every exported binding to be a Server
// Action (= async function). The setter doesn't actually need to
// await anything; the Promise is just a Next.js-conformance shim.
export async function setScrapeCancellationHook(
  hook: ((scrapeId: string) => boolean) | null,
): Promise<void> {
  cancellationHookOverride = hook;
}

export async function setScrapePauseHook(
  hook: ((scrapeId: string) => boolean) | null,
): Promise<void> {
  pauseHookOverride = hook;
}

const isScrapeCancelledForBroadcast = async (
  scrapeId: string,
): Promise<boolean> => {
  if (cancellationHookOverride) {
    return cancellationHookOverride(scrapeId);
  }
  const { isScrapeIdCancelled } = await import('@/app/api/admin/scrape/route');
  return isScrapeIdCancelled(scrapeId);
};

const waitWhileScrapePaused = async (scrapeId: string): Promise<void> => {
  if (!pauseHookOverride) return;
  while (pauseHookOverride(scrapeId)) {
    if (await isScrapeCancelledForBroadcast(scrapeId)) {
      throw new ScrapeCancelledError(scrapeId);
    }
    await new Promise(resolve => setTimeout(resolve, 1_000));
  }
};

const broadcastProgress = async (
  userId: string,
  payload: AdminScrapeProgressPayload,
) => {
  // Check if this scrape has been cancelled. Local override wins;
  // otherwise fall back to the existing dynamic import from the route.
  if (await isScrapeCancelledForBroadcast(payload.scrapeId)) {
    throw new ScrapeCancelledError(payload.scrapeId);
  }
  await waitWhileScrapePaused(payload.scrapeId);

  const channel = getPrivateUserChannel(userId);
  // Pusher has a 10KB message limit — strip the large requestLog.responseBodyPreview
  // and send it in a separate event if present.
  const { requestLog, ...rest } = payload;

  // Pusher caps event payloads at 10KB. Recent-listing previews from a
  // high-volume page (Adzuna, Arbeitnow, etc.) blow past that and Pusher
  // returns 413, which previously failed the entire provider run. Cap the
  // arrays for the live event and try/catch the broadcast so a transport
  // error never aborts the scrape. Full payload still lands in the DB.
  const broadcastPayload = trimProgressForBroadcast(rest);
  try {
    await sendDataUpdate({
      channel,
      payload: {
        data: broadcastPayload,
        type: DataEventType.ADMIN_SCRAPE_PROGRESS,
      },
    });
  } catch (error) {
    console.error(
      `[broadcastProgress] failed to send progress for ${payload.provider}:`,
      error,
    );
  }

  await persistSessionEvent(payload.scrapeId, 'PROGRESS', rest);

  if (requestLog) {
    await recordIngestionAuditLog({
      userId,
      action: 'ingestion_provider_request_log',
      actionType: 'info',
      metadata: {
        page: requestLog.page,
        provider: payload.provider,
        requestUrl: maskIngestionAuditText(requestLog.requestUrl),
        responseBodyPreview: maskIngestionAuditText(
          requestLog.responseBodyPreview,
        ),
        responseStatus: requestLog.responseStatus,
        scrapeId: payload.scrapeId,
        timestamp: requestLog.timestamp,
      },
    });

    await persistSessionEvent(payload.scrapeId, 'REQUEST_LOG', {
      provider: payload.provider,
      requestLog,
    });

    try {
      await sendDataUpdate({
        channel,
        payload: {
          data: {
            scrapeId: payload.scrapeId,
            requestLog,
          },
          type: DataEventType.ADMIN_SCRAPE_REQUEST_LOG,
        },
      });
    } catch {
      // If the request log event is still too large, silently drop it
    }
  }
};

// ---------------------------------------------------------------------------
// Built In provider
// ---------------------------------------------------------------------------

async function runBuiltInScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 10 : 5);
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let latestDiagnostics: AdminScrapeProgressPayload['diagnostics'];
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page += 1) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'builtin',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Built In: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
    });

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(BUILTIN_ITEMS_PER_PAGE),
    });

    if (searchTerm?.trim()) {
      params.set('search', searchTerm.trim());
    }

    if (location?.trim()) {
      params.set('location', location.trim());
    }

    const response = await fetch(`${BUILTIN_JOBS_URL}?${params.toString()}`, {
      cache: 'no-store',
      headers: {
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Built In page failed: ${response.status} ${await response.text()}`,
      );
    }

    const html = await response.text();
    const parsedJobs = parseBuiltInJobsPage(html);
    totalFetched += parsedJobs.length;

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesBuiltInQuery({
              job,
              location,
              remote,
              searchTerm,
            }),
          )
          .filter(job => {
            if (mode === 'backfill') {
              return true;
            }

            const postedAt = toPrismaDate(job.postedAt);
            if (!postedAt) {
              return false;
            }

            return now - postedAt.getTime() <= recentThresholdMs;
          });

    const builtInJobsWithApplyUrls = (
      await Promise.all(
        filteredJobs.map(async job => {
          apiRequests += 1;
          return enrichBuiltInJobWithApplyUrl(job);
        }),
      )
    ).filter((job): job is BuiltInJob => job !== null);
    const jobsWithApplyUrlIds = new Set(
      builtInJobsWithApplyUrls.map(job => job.jobId),
    );
    const recentRejectedListings: NonNullable<
      AdminScrapeProgressPayload['recentRejectedListings']
    > = [
      ...parsedJobs
        .filter(job => !filteredJobs.includes(job))
        .slice(0, 3)
        .map(job =>
          buildRejectedListingPreview({
            company: job.company,
            location: job.location,
            reason:
              'Filtered out by the current search term, location, remote-only, or recency settings',
            source: 'Built In',
            title: job.title,
          }),
        ),
    ];
    if (recentRejectedListings.length < 5) {
      recentRejectedListings.push(
        ...filteredJobs
          .filter(job => !jobsWithApplyUrlIds.has(job.jobId))
          .slice(0, 5 - recentRejectedListings.length)
          .map(job =>
            buildRejectedListingPreview({
              company: job.company,
              location: job.location,
              reason:
                'Dropped because the public detail page did not expose a usable application URL',
              source: 'Built In',
              title: job.title,
            }),
          ),
      );
    }

    const listings = builtInJobsWithApplyUrls
      .map(job => buildBuiltInListing(userId, job))
      .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);
    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });

    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }
    const filteredOut = parsedJobs.length - filteredJobs.length;
    const missingApplyUrl =
      filteredJobs.length - builtInJobsWithApplyUrls.length;
    latestDiagnostics = {
      duplicateOrExisting: result.skipped,
      filteredOut,
      matchedForInsert: listings.length,
      missingApplyUrl,
      sourceReturned: parsedJobs.length,
      updatedExisting: result.updated,
      reasons: [
        filteredOut > 0
          ? `${filteredOut} jobs were filtered out by the current search, location, remote, or recency settings`
          : null,
        missingApplyUrl > 0
          ? `${missingApplyUrl} jobs were dropped because the detail page did not expose a usable application URL`
          : null,
        result.updated > 0
          ? `${result.updated} matching jobs already existed and were updated instead of created`
          : null,
        result.skipped > 0
          ? `${result.skipped} jobs were skipped because they were duplicates or belonged to another user`
          : null,
      ].filter((value): value is string => Boolean(value)),
    };

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'builtin',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Built In page ${page}: fetched ${parsedJobs.length}, kept ${builtInJobsWithApplyUrls.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
      recentRejectedListings,
    });

    if (parsedJobs.length < BUILTIN_ITEMS_PER_PAGE) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: {
      sourceUrl: BUILTIN_JOBS_URL,
    },
  };
}

async function runWorkAtAStartupScrape({
  userId,
  scrapeId,
  searchTerm,
  location,
  insertAnyway,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'workatastartup',
    mode: 'sync',
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'Work at a Startup: fetching public jobs page...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await fetch(WORK_AT_A_STARTUP_JOBS_URL, {
    cache: 'no-store',
    headers: {
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Work at a Startup page failed: ${response.status} ${await response.text()}`,
    );
  }

  const html = await response.text();
  const parsedJobs = parseWorkAtAStartupJobsPage(html);
  const filteredJobs = insertAnyway
    ? parsedJobs
    : parsedJobs.filter(job =>
        matchesWorkAtAStartupQuery({
          job,
          location,
          remote,
          searchTerm,
        }),
      );
  const recentRejectedListings: NonNullable<
    AdminScrapeProgressPayload['recentRejectedListings']
  > = [
    ...parsedJobs
      .filter(job => !filteredJobs.includes(job))
      .slice(0, 3)
      .map(job =>
        buildRejectedListingPreview({
          company: job.companyName,
          location: job.location,
          reason:
            'Filtered out by the current search term, location, or remote-only settings',
          source: 'Work at a Startup',
          title: job.title,
        }),
      ),
  ];
  const listings = filteredJobs
    .map(job => buildWorkAtAStartupListing(userId, job))
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );
  if (recentRejectedListings.length < 5) {
    recentRejectedListings.push(
      ...filteredJobs
        .filter(job => buildWorkAtAStartupListing(userId, job) === null)
        .slice(0, 5 - recentRejectedListings.length)
        .map(job =>
          buildRejectedListingPreview({
            company: job.companyName,
            location: job.location,
            reason: 'Missing a usable application URL or title',
            source: 'Work at a Startup',
            title: job.title,
          }),
        ),
    );
  }
  const result = await persistListings({
    userId,
    listings,
    updateExisting: true,
  });
  const filteredOut = parsedJobs.length - filteredJobs.length;
  const invalidListing = filteredJobs.length - listings.length;
  const diagnostics: AdminScrapeProgressPayload['diagnostics'] = {
    duplicateOrExisting: result.skipped,
    filteredOut,
    invalidListing,
    matchedForInsert: listings.length,
    sourceReturned: parsedJobs.length,
    updatedExisting: result.updated,
    reasons: [
      filteredOut > 0
        ? `${filteredOut} jobs were filtered out by the current search, location, or remote settings`
        : null,
      invalidListing > 0
        ? `${invalidListing} jobs were dropped because they were missing a usable application URL or title`
        : null,
      result.updated > 0
        ? `${result.updated} matching jobs already existed and were updated instead of created`
        : null,
      result.skipped > 0
        ? `${result.skipped} jobs were skipped because they were duplicates or belonged to another user`
        : null,
    ].filter((value): value is string => Boolean(value)),
  };

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'workatastartup',
    mode: 'sync',
    status: 'persisting',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: parsedJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `Work at a Startup: fetched ${parsedJobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
    startedAt,
    diagnostics,
    elapsed: Date.now() - new Date(startedAt).getTime(),
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    recentRejectedListings,
  });

  return {
    apiRequests: 1,
    created: result.created,
    fetched: parsedJobs.length,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    skipped: result.skipped,
    updated: result.updated,
    metadata: {
      sourceUrl: WORK_AT_A_STARTUP_JOBS_URL,
    },
  };
}

// ---------------------------------------------------------------------------
// Fantastic Jobs provider
// ---------------------------------------------------------------------------

async function runFantasticScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const apiKey = process.env.RAPID_API_KEY;
  if (!apiKey) throw new Error('RAPID_API_KEY is not set');

  // Choose endpoint based on mode:
  // sync    → 24h endpoint (one daily call avoids duplicates)
  // weekly  → 7d endpoint (jobs posted in last 7 days, 100/request)
  // backfill → 6m endpoint (large fill, 500/request)
  const endpoint =
    mode === 'backfill'
      ? 'active-ats-6m'
      : mode === 'weekly'
        ? 'active-ats-7d'
        : 'active-ats-24h';
  const limit =
    mode === 'backfill'
      ? searchTerm?.trim()
        ? FANTASTIC_SYNC_LIMIT
        : FANTASTIC_BACKFILL_LIMIT
      : mode === 'weekly'
        ? FANTASTIC_WEEKLY_LIMIT
        : FANTASTIC_SYNC_LIMIT;
  const effectiveMaxPages = Math.min(
    maxPages,
    mode === 'backfill'
      ? FANTASTIC_BACKFILL_MAX_PAGES
      : mode === 'weekly'
        ? FANTASTIC_WEEKLY_MAX_PAGES
        : FANTASTIC_SYNC_MAX_PAGES,
  );

  let offset = 0;
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let latestDiagnostics: AdminScrapeProgressPayload['diagnostics'];
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  let modifiedFetched = 0;
  let modifiedCreated = 0;
  let modifiedUpdated = 0;
  let modifiedSkipped = 0;
  let expiredJobIdsCount = 0;
  let expiredDismissedCount = 0;
  const warnings: string[] = [];
  let lastRateLimit: FantasticRateLimit = {};
  const locationFilter = location?.trim() || INGESTION_LOCATION_FILTER;

  for (let page = 1; page <= effectiveMaxPages; page++) {
    const params = new URLSearchParams();
    params.set('description_type', 'text');
    params.set('include_ai', 'true');
    params.set('limit', String(limit));
    params.set('location_filter', locationFilter);

    if (offset > 0) params.set('offset', String(offset));
    if (searchTerm?.trim()) params.set('title_filter', searchTerm.trim());
    if (remote)
      params.set('ai_work_arrangement_filter', 'Remote Solely,Remote OK');

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'fantastic',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      rateLimit: lastRateLimit.jobsRemaining
        ? {
            jobsRemaining: lastRateLimit.jobsRemaining,
            jobsLimit: lastRateLimit.jobsLimit,
            requestsRemaining: lastRateLimit.requestsRemaining,
            requestsLimit: lastRateLimit.requestsLimit,
          }
        : undefined,
      message: `Fetching page ${page}/${effectiveMaxPages} from ${endpoint}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const fetchResult = await fetchFantasticEndpoint({
      apiKey,
      endpoint,
      params,
    });
    apiRequests += 1;
    lastRateLimit = fetchResult.rateLimit;
    const jobsArray = Array.isArray(fetchResult.payload)
      ? (fetchResult.payload as FantasticJob[])
      : [];
    totalFetched += jobsArray.length;

    // Persist
    const listings = jobsArray
      .map(job => buildFantasticListing(userId, job))
      .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode === 'sync',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'fantastic',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      rateLimit: {
        jobsRemaining: lastRateLimit.jobsRemaining,
        jobsLimit: lastRateLimit.jobsLimit,
        requestsRemaining: lastRateLimit.requestsRemaining,
        requestsLimit: lastRateLimit.requestsLimit,
      },
      message: `Page ${page}: fetched ${jobsArray.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      requestLog: {
        page,
        requestUrl: fetchResult.requestUrl,
        responseStatus: fetchResult.responseStatus,
        responseBodyPreview: fetchResult.responseBodyPreview,
        timestamp: new Date().toISOString(),
      },
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    // Stop if we got fewer than limit (no more pages available)
    if (jobsArray.length < limit) {
      await broadcastProgress(userId, {
        scrapeId,
        provider: 'fantastic',
        mode,
        status: 'complete',
        currentPage: page,
        totalPages: effectiveMaxPages,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsSkipped: totalSkipped,
        rateLimit: lastRateLimit.jobsRemaining
          ? {
              jobsRemaining: lastRateLimit.jobsRemaining,
              jobsLimit: lastRateLimit.jobsLimit,
              requestsRemaining: lastRateLimit.requestsRemaining,
              requestsLimit: lastRateLimit.requestsLimit,
            }
          : undefined,
        message: `Ended after page ${page}: API returned ${jobsArray.length} results (limit was ${limit}) — no more data available`,
        recentCreatedListings,
        recentUpdatedListings,
        startedAt,
        elapsed: Date.now() - new Date(startedAt).getTime(),
      });
      break;
    }

    if (
      lastRateLimit.jobsRemaining &&
      lastRateLimit.jobsRemaining < FANTASTIC_SAFETY_MIN_REMAINING_JOBS
    ) {
      await broadcastProgress(userId, {
        scrapeId,
        provider: 'fantastic',
        mode,
        status: 'complete',
        currentPage: page,
        totalPages: effectiveMaxPages,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsSkipped: totalSkipped,
        rateLimit: {
          jobsRemaining: lastRateLimit.jobsRemaining,
          jobsLimit: lastRateLimit.jobsLimit,
          requestsRemaining: lastRateLimit.requestsRemaining,
          requestsLimit: lastRateLimit.requestsLimit,
        },
        message: `Stopped early: only ${lastRateLimit.jobsRemaining} job credits remaining`,
        startedAt,
        elapsed: Date.now() - new Date(startedAt).getTime(),
      });
      break;
    }

    offset += limit;
    // Rate-limit courtesy delay: 300ms between requests
    await new Promise(r => setTimeout(r, 300));
  }

  if (mode === 'sync') {
    try {
      const modifiedMaxPages = Math.min(maxPages, FANTASTIC_MODIFIED_MAX_PAGES);
      let modifiedOffset = 0;

      for (let page = 1; page <= modifiedMaxPages; page++) {
        const modifiedParams = new URLSearchParams();
        modifiedParams.set('description_type', 'text');
        modifiedParams.set('include_ai', 'true');
        modifiedParams.set('limit', String(FANTASTIC_MODIFIED_LIMIT));
        modifiedParams.set('location_filter', locationFilter);
        if (modifiedOffset > 0) {
          modifiedParams.set('offset', String(modifiedOffset));
        }
        if (searchTerm?.trim()) {
          modifiedParams.set('title_filter', searchTerm.trim());
        }
        if (remote) {
          modifiedParams.set(
            'ai_work_arrangement_filter',
            'Remote Solely,Remote OK',
          );
        }

        const { payload, rateLimit } = await fetchFantasticEndpoint({
          apiKey,
          endpoint: 'modified-ats-24h',
          params: modifiedParams,
        });
        apiRequests += 1;
        lastRateLimit = rateLimit;

        const modifiedJobs = Array.isArray(payload)
          ? (payload as FantasticJob[])
          : [];
        modifiedFetched += modifiedJobs.length;
        if (modifiedJobs.length === 0) {
          break;
        }

        const listings = modifiedJobs
          .map(job => buildFantasticListing(userId, job))
          .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);
        const result = await persistListings({
          userId,
          listings,
          updateExisting: true,
        });
        modifiedCreated += result.created;
        modifiedUpdated += result.updated;
        modifiedSkipped += result.skipped;

        totalCreated += result.created;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;

        if (modifiedJobs.length < FANTASTIC_MODIFIED_LIMIT) {
          break;
        }
        if (
          lastRateLimit.jobsRemaining &&
          lastRateLimit.jobsRemaining < FANTASTIC_SAFETY_MIN_REMAINING_JOBS
        ) {
          break;
        }

        modifiedOffset += FANTASTIC_MODIFIED_LIMIT;
        await new Promise(r => setTimeout(r, 300));
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown modified endpoint error';
      warnings.push(`modified-ats-24h failed: ${message}`);
    }

    try {
      const { payload, rateLimit } = await fetchFantasticEndpoint({
        apiKey,
        endpoint: 'active-ats-expired',
        params: new URLSearchParams(),
      });
      apiRequests += 1;
      lastRateLimit = rateLimit;

      const expiredJobIds = extractExpiredJobIds(payload);
      expiredJobIdsCount = expiredJobIds.length;

      for (const chunk of toChunks(expiredJobIds, 1_000)) {
        const result = await db.jobListing.updateMany({
          where: {
            jobId: { in: chunk },
            jobProvider: JobProvider.FANTASTIC_JOBS,
            status: JobListingStatus.UNREVIEWED,
          },
          data: {
            status: JobListingStatus.DISMISSED,
          },
        });
        expiredDismissedCount += result.count;
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unknown expired endpoint error';
      warnings.push(`active-ats-expired failed: ${message}`);
    }
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: {
      expiredDismissedCount,
      expiredJobIdsCount,
      lastRateLimit,
      modified: {
        created: modifiedCreated,
        fetched: modifiedFetched,
        skipped: modifiedSkipped,
        updated: modifiedUpdated,
      },
      warnings,
    },
  };
}

// ---------------------------------------------------------------------------
// SerpAPI provider
// ---------------------------------------------------------------------------

async function runSerpApiScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  postedWithin,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  postedWithin?: string;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const serpApiKey = process.env.SERP_API_SECRET;
  if (!serpApiKey) throw new Error('SERP_API_SECRET is not set');

  // Developer plan: 5,000 credits/month, subscription cancelled
  // Burn ~4,000 on cron (sync), keep ~1,000 for manual (backfill)
  // Sync: 130 pages/day × 30 days ≈ 3,900 credits/month
  // Backfill: up to 50 pages per manual run
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 50 : 130);
  const query = searchTerm?.trim() || 'software engineer';

  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let nextPageToken: string | undefined;
  let stopReason: string | undefined;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'serpapi',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `SerpAPI: Fetching page ${page}/${effectiveMaxPages} for "${query}" (1 credit/page)...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      api_key: serpApiKey,
      engine: 'google_jobs',
      google_domain: 'google.com',
      location: location?.trim() || INGESTION_LOCATION_FILTER,
      no_cache: 'true',
      q: query,
    });

    if (remote) params.set('ltype', '1');

    if (postedWithin === 'today') {
      params.set('chips', 'date_posted:today');
    }

    if (nextPageToken) {
      params.set('next_page_token', nextPageToken);
    }

    const serpRequestUrl = `https://serpapi.com/search.json?${params.toString()}`;
    const response = await resilientFetch(serpRequestUrl, {
      cache: 'no-store',
      retryPolicy: 'api',
    });
    apiRequests += 1;

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`SerpAPI failed: ${response.status} ${body}`);
    }

    const serpRawBody = await response.text();
    const data = JSON.parse(serpRawBody) as {
      jobs_results?: SerpApiJob[];
      error?: string;
      serpapi_pagination?: { next_page_token?: string };
    };

    if (data.error) {
      if (data.error.toLowerCase().includes("hasn't returned any results")) {
        stopReason = `SerpAPI ended pagination on page ${page}: no results returned for the current query.`;
        break;
      }
      throw new Error(data.error);
    }

    const jobs = data.jobs_results ?? [];
    totalFetched += jobs.length;

    if (jobs.length === 0) {
      stopReason = `SerpAPI ended pagination on page ${page}: jobs_results was empty.`;
      break;
    }

    const listings = jobs
      .map(job => buildSerpListing(userId, query, Boolean(remote), job))
      .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

    const result = await persistListings({ userId, listings });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'serpapi',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `SerpAPI page ${page}: fetched ${jobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}, skipped ${result.skipped}`,
      recentCreatedListings,
      recentUpdatedListings,
      requestLog: {
        page,
        requestUrl: serpRequestUrl,
        responseStatus: response.status,
        responseBodyPreview:
          serpRawBody.length > 6000
            ? `${serpRawBody.slice(0, 6000)}…`
            : serpRawBody,
        timestamp: new Date().toISOString(),
      },
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    nextPageToken = data.serpapi_pagination?.next_page_token;
    if (!nextPageToken) {
      stopReason = `SerpAPI ended pagination after page ${page}: no next_page_token was returned.`;

      await broadcastProgress(userId, {
        scrapeId,
        provider: 'serpapi',
        mode,
        status: 'complete',
        currentPage: page,
        totalPages: effectiveMaxPages,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsSkipped: totalSkipped,
        message: stopReason,
        recentCreatedListings,
        recentUpdatedListings,
        startedAt,
        elapsed: Date.now() - new Date(startedAt).getTime(),
      });
      break;
    }

    // 1s delay between SerpAPI requests to be polite
    await new Promise(r => setTimeout(r, 1000));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    provider: 'serpapi',
    recentCreatedListings,
    recentUpdatedListings,
    stopReason,
    updated: totalUpdated,
    skipped: totalSkipped,
  };
}

// ---------------------------------------------------------------------------
// USAJobs provider
// ---------------------------------------------------------------------------

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
    if (trimmed.length > 0) normalized.push(trimmed);
  }
  return normalized;
};

const mapUsaJobsScheduleCodeToJobType = (code?: string): JobType => {
  switch (code) {
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
  remuneration?: {
    MinimumRange: string;
    MaximumRange: string;
    RateIntervalCode: string;
  }[],
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
  if (min && max && min !== max)
    return `$${Number(min).toLocaleString()} - $${Number(max).toLocaleString()}${intervalLabel}`;
  if (min) return `$${Number(min).toLocaleString()}${intervalLabel}`;
  return `$${Number(max).toLocaleString()}${intervalLabel}`;
};

const buildUsaJobsDescription = (job: USAJobsMatchedObject): string => {
  const parts: string[] = [];
  if (job.QualificationSummary) parts.push(job.QualificationSummary);
  if (job.UserArea?.Details?.JobSummary)
    parts.push(job.UserArea.Details.JobSummary);
  if (job.UserArea?.Details?.MajorDuties)
    parts.push(job.UserArea.Details.MajorDuties);
  return parts.join('\n\n') || 'No description available';
};

const buildUsaJobsListing = (
  userId: string,
  matched: USAJobsMatchedObject,
  matchedObjectId: string,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl =
    matched.ApplyURI?.[0] ?? toNullableString(matched.PositionURI);
  if (!applyUrl) return null;

  const jobId = `usajobs-${matchedObjectId}`;
  const locationDisplay = toNullableString(matched.PositionLocationDisplay);
  const isRemote = Boolean(
    locationDisplay?.toLowerCase().includes('anywhere') ||
    locationDisplay?.toLowerCase().includes('remote'),
  );
  return {
    applyOptions: { applyUrl } as Prisma.JsonObject,
    benefits: toStringArray(matched.UserArea?.Details?.Benefits),
    company: toNullableString(
      matched.OrganizationName || matched.DepartmentName,
    ),
    description: buildUsaJobsDescription(matched),
    jobId,
    jobProvider: JobProvider.USAJOBS,
    jobProviderUrl: toNullableString(matched.PositionURI),
    jobType: mapUsaJobsScheduleCodeToJobType(
      matched.PositionSchedule?.[0]?.Code,
    ),
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

async function runUsaJobsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 20 : 5);
  const keyword = searchTerm?.trim() || undefined;
  const locationName = location?.trim() || INGESTION_LOCATION_FILTER;
  const datePosted = mode === 'sync' ? 1 : 30;

  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'usajobs',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `USAJobs: Fetching page ${page}/${effectiveMaxPages}${keyword ? ` for "${keyword}"` : ''}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const response = await searchUSAJobs({
      keyword,
      locationName,
      remote,
      datePosted,
      resultsPerPage: 25,
      page,
    });
    apiRequests += 1;

    const items = response.SearchResult.SearchResultItems ?? [];
    totalFetched += items.length;

    if (items.length === 0) break;

    const listings = items
      .map(item =>
        buildUsaJobsListing(
          userId,
          item.MatchedObjectDescriptor,
          item.MatchedObjectId,
        ),
      )
      .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

    const result = await persistListings({ userId, listings });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'usajobs',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      recentCreatedListings,
      recentUpdatedListings,
      message: `USAJobs page ${page}: fetched ${items.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const numberOfPages = response.SearchResult.UserArea?.NumberOfPages || page;
    if (page >= numberOfPages || items.length < 25) break;

    await new Promise(r => setTimeout(r, 500));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
  };
}

// ---------------------------------------------------------------------------
// The Muse provider
// ---------------------------------------------------------------------------

async function runTheMuseScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 10 : 5);
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  let latestDiagnostics: AdminScrapeProgressPayload['diagnostics'];

  for (let page = 1; page <= effectiveMaxPages; page += 1) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'themuse',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `The Muse: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
    });

    const params = new URLSearchParams({
      page: String(page),
    });

    if (location?.trim()) {
      params.set('location', location.trim());
    }

    const response = await resilientFetch(
      `${THE_MUSE_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: {
          Accept: 'application/json',
        },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `The Muse API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as {
      page_count?: number;
      results?: TheMuseJob[];
    };
    const parsedJobs = Array.isArray(payload.results) ? payload.results : [];
    totalFetched += parsedJobs.length;

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesTheMuseQuery({
              job,
              location,
              remote,
              searchTerm,
            }),
          )
          .filter(job => {
            if (mode === 'backfill') {
              return true;
            }

            const postedAt = toPrismaDate(job.publication_date);
            if (!postedAt) {
              return false;
            }

            return now - postedAt.getTime() <= recentThresholdMs;
          });

    const jobsWithApplyUrls = (
      await Promise.all(
        filteredJobs.map(async job => {
          apiRequests += 1;
          return enrichTheMuseJobWithApplyUrl(job);
        }),
      )
    ).filter(
      (job): job is TheMuseJob & { applyUrl: string; landingPage: string } =>
        job !== null,
    );
    const jobsWithApplyUrlIds = new Set(
      jobsWithApplyUrls.map(job =>
        String(job.id ?? job.refs?.landing_page ?? job.name ?? ''),
      ),
    );
    const recentRejectedListings: NonNullable<
      AdminScrapeProgressPayload['recentRejectedListings']
    > = [
      ...parsedJobs
        .filter(job => !filteredJobs.includes(job))
        .slice(0, 3)
        .map(job =>
          buildRejectedListingPreview({
            company: job.company?.name,
            location: job.locations
              ?.map(item => item.name)
              .filter(Boolean)
              .join(', '),
            reason:
              'Filtered out by the current search term, location, remote-only, or recency settings',
            source: 'The Muse',
            title: job.name,
          }),
        ),
    ];
    if (recentRejectedListings.length < 5) {
      recentRejectedListings.push(
        ...filteredJobs
          .filter(
            job =>
              !jobsWithApplyUrlIds.has(
                String(job.id ?? job.refs?.landing_page ?? job.name ?? ''),
              ),
          )
          .slice(0, 5 - recentRejectedListings.length)
          .map(job =>
            buildRejectedListingPreview({
              company: job.company?.name,
              location: job.locations
                ?.map(item => item.name)
                .filter(Boolean)
                .join(', '),
              reason:
                'Dropped because the public detail page did not expose a usable application URL',
              source: 'The Muse',
              title: job.name,
            }),
          ),
      );
    }

    const listings = jobsWithApplyUrls
      .map(job => buildTheMuseListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );
    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });

    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }
    const filteredOut = parsedJobs.length - filteredJobs.length;
    const missingApplyUrl = filteredJobs.length - jobsWithApplyUrls.length;
    const invalidListing = jobsWithApplyUrls.length - listings.length;
    latestDiagnostics = {
      duplicateOrExisting: result.skipped,
      filteredOut,
      invalidListing,
      matchedForInsert: listings.length,
      missingApplyUrl,
      sourceReturned: parsedJobs.length,
      updatedExisting: result.updated,
      reasons: [
        filteredOut > 0
          ? `${filteredOut} jobs were filtered out by the current search, location, remote, or recency settings`
          : null,
        missingApplyUrl > 0
          ? `${missingApplyUrl} jobs were dropped because the public detail page did not expose a usable application URL`
          : null,
        invalidListing > 0
          ? `${invalidListing} jobs were dropped because required fields were missing after normalization`
          : null,
        result.updated > 0
          ? `${result.updated} matching jobs already existed and were updated instead of created`
          : null,
        result.skipped > 0
          ? `${result.skipped} jobs were skipped because they were duplicates or belonged to another user`
          : null,
      ].filter((value): value is string => Boolean(value)),
    };

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'themuse',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `The Muse page ${page}: fetched ${parsedJobs.length}, kept ${jobsWithApplyUrls.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
      recentRejectedListings,
    });

    if (
      parsedJobs.length < THE_MUSE_ITEMS_PER_PAGE ||
      page >= (payload.page_count ?? page)
    ) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: {
      apiUrl: THE_MUSE_API_URL,
    },
  };
}

// ---------------------------------------------------------------------------
// CareerBuilder provider
// ---------------------------------------------------------------------------

/**
 * Returns either a plain-fetch fetcher or, when Playwright is available,
 * a browser-backed one that resolves the DataDome JS challenge by visiting
 * the CareerBuilder homepage first and reusing the resulting cookies. The
 * unified `fetch` shape lets the rest of runCareerBuilderScrape stay the
 * same whether or not Chromium is on the host.
 */
interface CareerBuilderFetcher {
  fetch: (
    url: string,
    init: {
      method: 'POST';
      headers: Record<string, string>;
      body: string;
    },
  ) => Promise<{ ok: boolean; status: number; text: () => Promise<string> }>;
  close: () => Promise<void>;
  mode: 'fetch' | 'playwright';
}

const createCareerBuilderFetcher = async (): Promise<CareerBuilderFetcher> => {
  const chromium = await loadChromium();
  if (!chromium) {
    return {
      mode: 'fetch',
      fetch: async (url, init) => {
        const response = await resilientFetch(url, {
          body: init.body,
          cache: 'no-store',
          headers: init.headers,
          method: init.method,
          retryPolicy: 'public-api',
        });
        return {
          ok: response.ok,
          status: response.status,
          text: () => response.text(),
        };
      },
      close: async () => {},
    };
  }

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  // Warm up by loading the public jobs page so DataDome issues the cookie
  // that the API endpoint expects on subsequent requests.
  const warmupPage = await context.newPage();
  try {
    await warmupPage.goto(CAREERBUILDER_JOBS_URL, {
      timeout: 30_000,
      waitUntil: 'domcontentloaded',
    });
    // Brief settle so any in-page DataDome script can run + set cookies.
    await warmupPage.waitForTimeout(2500);
  } catch {
    // Non-fatal: the API request may still go through if cookies were set.
  } finally {
    await warmupPage.close();
  }

  return {
    mode: 'playwright',
    fetch: async (url, init) => {
      const response = await context.request.fetch(url, {
        data: init.body,
        headers: init.headers,
        method: init.method,
      });
      return {
        ok: response.ok(),
        status: response.status(),
        text: () => response.text(),
      };
    },
    close: async () => {
      await context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  };
};

async function runCareerBuilderScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, 10);
  const fingerprintId = `gimmejob-${scrapeId.replace(/[^a-z0-9]/gi, '').slice(0, 24)}`;
  const normalizedSearchTerm = compactUpstreamParam(searchTerm) || '';
  const searchAddress =
    compactUpstreamParam(location, MAX_UPSTREAM_LOCATION_LENGTH) ||
    'United States';
  const upstreamQuery =
    compactUpstreamParam(
      [normalizedSearchTerm, remote ? 'remote' : null]
        .filter((value): value is string => Boolean(value))
        .join(' '),
    ) ?? '';

  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalPagesSeen = effectiveMaxPages;
  let latestDiagnostics: AdminScrapeProgressPayload['diagnostics'];
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  const cbFetcher = await createCareerBuilderFetcher();
  try {
  for (let page = 0; page < effectiveMaxPages; page += 1) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'careerbuilder',
      mode,
      status: 'fetching',
      currentPage: page + 1,
      totalPages: totalPagesSeen,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message:
        cbFetcher.mode === 'playwright'
          ? `CareerBuilder: fetching page ${page + 1}/${totalPagesSeen} via browser (DataDome bypass)...`
          : `CareerBuilder: fetching page ${page + 1}/${totalPagesSeen}...`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
    });

    const cbRequestUrl = `${CAREERBUILDER_API_URL}?apikey=${CAREERBUILDER_API_KEY}`;
    const cbRequestBody = {
      fingerprintId,
      includeJobs: [],
      jobAdsRequest: {
        placement: {
          channel: 'WEB',
          location: 'JobSearchPage',
          property: CAREERBUILDER_SITE_ID,
          type: 'JOB_SEARCH',
          view: 'SPLIT',
        },
        position: Array.from(
          { length: CAREERBUILDER_ITEMS_PER_PAGE },
          (_, index) => index + 1,
        ),
      },
      jobQuery: {
        disableSpellCheck: false,
        locations: [
          {
            address: searchAddress,
            country: 'us',
            radius: {
              unit: 'mi',
              value: 30,
            },
          },
        ],
        query: upstreamQuery,
        queryLanguageCode: 'en-us',
      },
      offset: page * CAREERBUILDER_ITEMS_PER_PAGE,
      pageSize: CAREERBUILDER_ITEMS_PER_PAGE,
      siteId: CAREERBUILDER_SITE_ID,
    };
    const response = await cbFetcher.fetch(cbRequestUrl, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json; charset=UTF-8',
        origin: 'https://www.careerbuilder.com',
        referer: `${CAREERBUILDER_JOBS_URL}?q=${encodeURIComponent(
          upstreamQuery,
        )}&where=${encodeURIComponent(searchAddress)}`,
        'request-starttime': String(Date.now()),
        'x-datadome-clientid': '.keep',
      },
      body: JSON.stringify(cbRequestBody),
    });
    apiRequests += 1;

    if (!response.ok) {
      const body = await response.text();
      if (
        response.status === 403 &&
        body.toLowerCase().includes('captcha-delivery.com')
      ) {
        throw new Error(
          `CareerBuilder search blocked by DataDome captcha: ${body}`,
        );
      }
      throw new Error(
        `CareerBuilder search failed: ${response.status} ${body}`,
      );
    }

    const cbRawBody = await response.text();
    const payload = JSON.parse(cbRawBody) as CareerBuilderResponse;
    const parsedJobs = Array.isArray(payload.jobResults)
      ? payload.jobResults
      : [];
    totalFetched += parsedJobs.length;
    if (typeof payload.estimatedTotalSize === 'number') {
      totalPagesSeen = Math.min(
        Math.max(
          1,
          Math.ceil(payload.estimatedTotalSize / CAREERBUILDER_ITEMS_PER_PAGE),
        ),
        effectiveMaxPages,
      );
    }

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs.filter(job =>
          matchesCareerBuilderQuery({
            job,
            location,
            remote,
            searchTerm,
          }),
        );
    const listings = filteredJobs
      .filter(job => {
        const applyUrl = toNullableString(job.apply?.applyUrl);
        return Boolean(applyUrl);
      })
      .map(job => buildCareerBuilderListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );
    const result = await persistListings({
      userId,
      listings,
      updateExisting: true,
    });

    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }
    const filteredOut = parsedJobs.length - filteredJobs.length;
    const missingApplyUrl = filteredJobs.length - listings.length;
    latestDiagnostics = {
      duplicateOrExisting: result.skipped,
      filteredOut,
      matchedForInsert: listings.length,
      missingApplyUrl,
      sourceReturned: parsedJobs.length,
      updatedExisting: result.updated,
      reasons: [
        filteredOut > 0
          ? `${filteredOut} jobs were filtered out by the current search, location, or remote settings`
          : null,
        missingApplyUrl > 0
          ? `${missingApplyUrl} jobs were dropped because the search API did not include a usable offsite application URL`
          : null,
        result.updated > 0
          ? `${result.updated} matching jobs already existed and were updated instead of created`
          : null,
        result.skipped > 0
          ? `${result.skipped} jobs were skipped because they were duplicates or belonged to another user`
          : null,
      ].filter((value): value is string => Boolean(value)),
    };

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'careerbuilder',
      mode,
      status: 'persisting',
      currentPage: page + 1,
      totalPages: totalPagesSeen,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `CareerBuilder page ${page + 1}: fetched ${parsedJobs.length}, kept ${listings.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
      requestLog: {
        page: page + 1,
        requestUrl: `POST ${cbRequestUrl}\n${JSON.stringify(cbRequestBody, null, 2)}`,
        responseStatus: response.status,
        responseBodyPreview:
          cbRawBody.length > 6000 ? `${cbRawBody.slice(0, 6000)}…` : cbRawBody,
        timestamp: new Date().toISOString(),
      },
    });

    if (
      parsedJobs.length < CAREERBUILDER_ITEMS_PER_PAGE ||
      page + 1 >= totalPagesSeen
    ) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }
  } finally {
    await cbFetcher.close();
  }

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: {
      fetcherMode: cbFetcher.mode,
      searchUrl: CAREERBUILDER_JOBS_URL,
    },
  };
}

// ---------------------------------------------------------------------------
// Welcome to the Jungle provider
// ---------------------------------------------------------------------------

async function runWelcomeToTheJungleScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 10 : 5);
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalPagesSeen = effectiveMaxPages;
  let latestDiagnostics: AdminScrapeProgressPayload['diagnostics'];
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 0; page < effectiveMaxPages; page += 1) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'welcometothejungle',
      mode,
      status: 'fetching',
      currentPage: page + 1,
      totalPages: totalPagesSeen,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Welcome to the Jungle: fetching page ${page + 1}/${totalPagesSeen}...`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
    });

    const response = await resilientFetch(WELCOME_TO_THE_JUNGLE_ALGOLIA_URL, {
      method: 'POST',
      cache: 'no-store',
      retryPolicy: 'public-api',
      headers: {
        Accept: 'application/json',
        'content-type': 'application/json',
        origin: 'https://www.welcometothejungle.com',
        referer: WELCOME_TO_THE_JUNGLE_JOBS_URL,
        'x-algolia-application-id': WELCOME_TO_THE_JUNGLE_APP_ID,
        'x-algolia-api-key': WELCOME_TO_THE_JUNGLE_API_KEY,
      },
      body: JSON.stringify({
        filters: 'offices.country_code:US',
        hitsPerPage: WELCOME_TO_THE_JUNGLE_ITEMS_PER_PAGE,
        page,
        query: searchTerm?.trim() ?? '',
      }),
    });
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Welcome to the Jungle search failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as WelcomeToTheJungleResponse;
    const parsedJobs = Array.isArray(payload.hits) ? payload.hits : [];
    totalPagesSeen = Math.min(
      payload.nbPages ?? effectiveMaxPages,
      effectiveMaxPages,
    );
    totalFetched += parsedJobs.length;

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesWelcomeToTheJungleQuery({
              job,
              location,
              remote,
              searchTerm,
            }),
          )
          .filter(job => {
            if (mode === 'backfill') {
              return true;
            }

            const postedAt =
              toPrismaDate(job.published_at) ??
              toPrismaDateFromUnix(job.published_at_timestamp);
            if (!postedAt) {
              return false;
            }

            return now - postedAt.getTime() <= recentThresholdMs;
          });

    const jobsWithApplyUrls = (
      await Promise.all(
        filteredJobs.map(async job => {
          apiRequests += 1;
          return enrichWelcomeToTheJungleJobWithApplyUrl(job);
        }),
      )
    ).filter(
      (
        job,
      ): job is WelcomeToTheJungleJob & {
        applyUrl: string;
        detailUrl: string;
      } => job !== null,
    );

    const listings = jobsWithApplyUrls
      .map(job => buildWelcomeToTheJungleListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );
    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });

    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }
    const filteredOut = parsedJobs.length - filteredJobs.length;
    const missingApplyUrl = filteredJobs.length - jobsWithApplyUrls.length;
    const invalidListing = jobsWithApplyUrls.length - listings.length;
    latestDiagnostics = {
      duplicateOrExisting: result.skipped,
      filteredOut,
      invalidListing,
      matchedForInsert: listings.length,
      missingApplyUrl,
      sourceReturned: parsedJobs.length,
      updatedExisting: result.updated,
      reasons: [
        filteredOut > 0
          ? `${filteredOut} jobs were filtered out by the current search, location, remote, or recency settings`
          : null,
        missingApplyUrl > 0
          ? `${missingApplyUrl} jobs were dropped because the public detail page did not expose a usable application URL`
          : null,
        invalidListing > 0
          ? `${invalidListing} jobs were dropped because required fields were missing after normalization`
          : null,
        result.updated > 0
          ? `${result.updated} matching jobs already existed and were updated instead of created`
          : null,
        result.skipped > 0
          ? `${result.skipped} jobs were skipped because they were duplicates or belonged to another user`
          : null,
      ].filter((value): value is string => Boolean(value)),
    };

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'welcometothejungle',
      mode,
      status: 'persisting',
      currentPage: page + 1,
      totalPages: totalPagesSeen,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Welcome to the Jungle page ${page + 1}: fetched ${parsedJobs.length}, kept ${jobsWithApplyUrls.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      startedAt,
      diagnostics: latestDiagnostics,
      elapsed: Date.now() - new Date(startedAt).getTime(),
      recentCreatedListings,
      recentUpdatedListings,
    });

    if (
      parsedJobs.length < WELCOME_TO_THE_JUNGLE_ITEMS_PER_PAGE ||
      page + 1 >= totalPagesSeen
    ) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: {
      searchUrl: WELCOME_TO_THE_JUNGLE_JOBS_URL,
    },
  };
}

// ---------------------------------------------------------------------------
// We Work Remotely provider
// ---------------------------------------------------------------------------

async function runWeWorkRemotelyScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'weworkremotely',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'We Work Remotely: fetching public RSS feed...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await fetch(WWR_FEED_URL, {
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error(
      `We Work Remotely feed failed: ${response.status} ${await response.text()}`,
    );
  }

  const xml = await response.text();
  const parsedJobs = parseWeWorkRemotelyFeed(xml);
  const effectiveLimit = Math.max(
    WWR_ITEMS_PER_PAGE,
    maxPages * WWR_ITEMS_PER_PAGE,
  );

  const filteredJobs = (
    insertAnyway
      ? parsedJobs
      : parsedJobs.filter(job =>
          matchesWeWorkRemotelyQuery({
            job,
            location,
            searchTerm,
          }),
        )
  ).slice(0, effectiveLimit);

  const listings = filteredJobs
    .map(job => buildWeWorkRemotelyListing(userId, job))
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );

  const result = await persistListings({
    userId,
    listings,
    updateExisting: true,
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'weworkremotely',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `We Work Remotely: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    fetched: filteredJobs.length,
    created: result.created,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    updated: result.updated,
    skipped: result.skipped,
    metadata: {
      feedUrl: WWR_FEED_URL,
      parsedJobs: parsedJobs.length,
    },
  };
}

async function runNoDeskScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'nodesk',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'NoDesk: fetching public RSS feed...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await resilientFetch(NODESK_FEED_URL, {
    cache: 'no-store',
    retryPolicy: 'public-api',
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
  });

  if (!response.ok) {
    throw new Error(
      `NoDesk feed failed: ${response.status} ${await response.text()}`,
    );
  }

  const xml = await response.text();
  const parsedJobs = parseNoDeskFeed(xml);
  const effectiveLimit = Math.max(
    NODESK_ITEMS_PER_PAGE,
    maxPages * NODESK_ITEMS_PER_PAGE,
  );

  const filteredJobs = (
    insertAnyway
      ? parsedJobs
      : parsedJobs.filter(job =>
          matchesNoDeskQuery({ job, location, searchTerm }),
        )
  ).slice(0, effectiveLimit);

  const listings = filteredJobs
    .map(job => buildNoDeskListing(userId, job))
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );

  const result = await persistListings({
    userId,
    listings,
    updateExisting: true,
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'nodesk',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `NoDesk: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    created: result.created,
    fetched: filteredJobs.length,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    skipped: result.skipped,
    updated: result.updated,
    metadata: {
      feedUrl: NODESK_FEED_URL,
      parsedJobs: parsedJobs.length,
    },
  };
}

async function runOpenJobsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'openjobs',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'OpenJobs: fetching public jobs table...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await resilientFetch(OPENJOBS_URL, {
    cache: 'no-store',
    retryPolicy: 'public-api',
    headers: { Accept: 'text/html,application/xhtml+xml' },
  });

  if (!response.ok) {
    throw new Error(
      `OpenJobs page failed: ${response.status} ${await response.text()}`,
    );
  }

  const html = await response.text();
  const parsedJobs = parseOpenJobsPage(html);
  const effectiveLimit = Math.max(
    OPENJOBS_ITEMS_PER_PAGE,
    maxPages * OPENJOBS_ITEMS_PER_PAGE,
  );
  const filteredJobs = (
    insertAnyway
      ? parsedJobs
      : parsedJobs.filter(job =>
          matchesOpenJobsQuery({ job, location, searchTerm }),
        )
  ).slice(0, effectiveLimit);

  const listings = filteredJobs
    .map(job => buildOpenJobsListing(userId, job))
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode !== 'backfill',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'openjobs',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `OpenJobs: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    created: result.created,
    fetched: filteredJobs.length,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    skipped: result.skipped,
    updated: result.updated,
    metadata: {
      parsedJobs: parsedJobs.length,
      sourceUrl: OPENJOBS_URL,
    },
  };
}

async function runJobspressoScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(Math.max(maxPages, 1), 10);
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'jobspresso',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Jobspresso: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const body = new URLSearchParams({
      page: String(page),
      per_page: String(JOBSPRESSO_ITEMS_PER_PAGE),
      search_keywords: insertAnyway ? '' : (searchTerm?.trim() ?? ''),
      search_location: insertAnyway ? '' : (location?.trim() ?? ''),
    });

    const response = await resilientFetch(JOBSPRESSO_AJAX_URL, {
      method: 'POST',
      cache: 'no-store',
      retryPolicy: 'public-api',
      headers: {
        Accept: 'application/json, text/javascript, */*; q=0.01',
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      },
      body,
    });
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Jobspresso search failed: ${response.status} ${await response.text()}`,
      );
    }

    const data = (await response.json()) as JobspressoResponse;
    const parsedJobs = parseJobspressoHtml(data.html ?? '');
    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs.filter(job =>
          matchesJobspressoQuery({ job, location, searchTerm }),
        );

    if (filteredJobs.length === 0) break;

    const listings = filteredJobs
      .map(job => buildJobspressoListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });

    totalFetched += filteredJobs.length;
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'jobspresso',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Jobspresso page ${page}: ${filteredJobs.length} jobs, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (data.max_num_pages && page >= data.max_num_pages) break;
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'jobspresso',
    mode,
    status: 'complete',
    currentPage: effectiveMaxPages,
    totalPages: effectiveMaxPages,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Jobspresso: fetched ${totalFetched}, created ${totalCreated}, updated ${totalUpdated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { sourceUrl: JOBSPRESSO_AJAX_URL },
  };
}

async function runBasicRssProviderScrape({
  userId,
  scrapeId,
  mode,
  provider,
  label,
  source,
  feedUrl,
  itemsPerPage,
  jobProvider,
  prefix,
  parseJobs = parseBasicRssFeed,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  provider: ScrapeProvider;
  label: string;
  source: string;
  feedUrl: string;
  itemsPerPage: number;
  jobProvider: JobProvider;
  prefix: string;
  parseJobs?: (xml: string) => BasicRssJob[];
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider,
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: `${label}: fetching public RSS feed...`,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await resilientFetch(feedUrl, {
    cache: 'no-store',
    retryPolicy: 'public-api',
    headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
  });

  if (!response.ok) {
    throw new Error(
      `${label} feed failed: ${response.status} ${await response.text()}`,
    );
  }

  const xml = await response.text();
  const parsedJobs = parseJobs(xml);
  const effectiveLimit = Math.max(itemsPerPage, maxPages * itemsPerPage);
  const filteredJobs = (
    insertAnyway
      ? parsedJobs
      : parsedJobs.filter(job =>
          matchesBasicRssQuery({ job, location, remote, searchTerm }),
        )
  ).slice(0, effectiveLimit);

  const listings = filteredJobs
    .map(job =>
      buildBasicRssListing(userId, job, {
        defaultLocation: source === 'Django Job Board' ? undefined : 'Remote',
        jobProvider,
        prefix,
        source,
      }),
    )
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode !== 'backfill',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider,
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `${label}: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    created: result.created,
    fetched: filteredJobs.length,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    skipped: result.skipped,
    updated: result.updated,
    metadata: {
      feedUrl,
      parsedJobs: parsedJobs.length,
    },
  };
}

const runPythonOrgJobsScrape = (
  options: Omit<
    Parameters<typeof runBasicRssProviderScrape>[0],
    | 'feedUrl'
    | 'itemsPerPage'
    | 'jobProvider'
    | 'label'
    | 'parseJobs'
    | 'prefix'
    | 'provider'
    | 'source'
  >,
): Promise<ProviderRunResult> =>
  runBasicRssProviderScrape({
    ...options,
    feedUrl: PYTHON_ORG_JOBS_FEED_URL,
    itemsPerPage: PYTHON_ORG_JOBS_ITEMS_PER_PAGE,
    jobProvider: JobProvider.PYTHON_ORG,
    label: 'Python.org Jobs',
    parseJobs: parsePythonOrgJobsFeed,
    prefix: 'python-org',
    provider: 'python-org',
    source: 'Python.org',
  });

const runDjangoJobBoardScrape = (
  options: Omit<
    Parameters<typeof runBasicRssProviderScrape>[0],
    | 'feedUrl'
    | 'itemsPerPage'
    | 'jobProvider'
    | 'label'
    | 'prefix'
    | 'provider'
    | 'source'
  >,
): Promise<ProviderRunResult> =>
  runBasicRssProviderScrape({
    ...options,
    feedUrl: DJANGO_JOB_BOARD_FEED_URL,
    itemsPerPage: DJANGO_JOB_BOARD_ITEMS_PER_PAGE,
    jobProvider: JobProvider.DJANGO_JOB_BOARD,
    label: 'Django Job Board',
    prefix: 'django-job-board',
    provider: 'django-job-board',
    source: 'Django Job Board',
  });

async function runRemoteOkScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'remoteok',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'Remote OK: fetching public JSON feed...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await resilientFetch(REMOTE_OK_API_URL, {
    cache: 'no-store',
    retryPolicy: 'public-api',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Remote OK API failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as unknown[];
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  const effectiveLimit = Math.max(
    REMOTE_OK_ITEMS_PER_PAGE,
    maxPages * REMOTE_OK_ITEMS_PER_PAGE,
  );

  const parsedJobs = payload.filter(isRemoteOkJob);
  const filteredJobs = (
    insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesRemoteOkQuery({
              job,
              location,
              searchTerm,
            }),
          )
          .filter(job => {
            if (mode === 'backfill') return true;
            const postedAt = toPrismaDate(job.date);
            if (!postedAt) return false;
            return now - postedAt.getTime() <= recentThresholdMs;
          })
  ).slice(0, effectiveLimit);

  const listings = filteredJobs
    .map(job => buildRemoteOkListing(userId, job))
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode !== 'backfill',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'remoteok',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `Remote OK: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    fetched: filteredJobs.length,
    created: result.created,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    updated: result.updated,
    skipped: result.skipped,
    metadata: {
      apiUrl: REMOTE_OK_API_URL,
      parsedJobs: parsedJobs.length,
    },
  };
}

async function runJobicyScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'jobicy',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'Jobicy: fetching public remote jobs feed...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const params = new URLSearchParams();
  params.set('count', String(Math.min(100, Math.max(1, maxPages))));

  const response = await resilientFetch(
    `${JOBICY_API_URL}?${params.toString()}`,
    {
      cache: 'no-store',
      retryPolicy: 'public-api',
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Jobicy API failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as JobicyResponse;
  const parsedJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  const filteredJobs = insertAnyway
    ? parsedJobs
    : parsedJobs
        .filter(job =>
          matchesJobicyQuery({
            job,
            location,
            searchTerm,
          }),
        )
        .filter(job => {
          if (mode === 'backfill') return true;
          const postedAt = toPrismaDate(job.pubDate);
          if (!postedAt) return false;
          return now - postedAt.getTime() <= recentThresholdMs;
        });

  const listings = filteredJobs
    .map(job => buildJobicyListing(userId, job))
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode !== 'backfill',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'jobicy',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `Jobicy: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    fetched: filteredJobs.length,
    created: result.created,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    updated: result.updated,
    skipped: result.skipped,
    metadata: {
      apiUrl: JOBICY_API_URL,
      parsedJobs: parsedJobs.length,
    },
  };
}

async function runRemotiveScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'remotive',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'Remotive: fetching public remote jobs feed...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const params = new URLSearchParams();
  params.set(
    'limit',
    String(
      Math.max(REMOTIVE_ITEMS_PER_PAGE, maxPages * REMOTIVE_ITEMS_PER_PAGE),
    ),
  );
  if (searchTerm?.trim()) {
    params.set('search', searchTerm.trim());
  }

  const response = await resilientFetch(
    `${REMOTIVE_API_URL}?${params.toString()}`,
    {
      cache: 'no-store',
      retryPolicy: 'public-api',
      headers: {
        Accept: 'application/json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Remotive API failed: ${response.status} ${await response.text()}`,
    );
  }

  const payload = (await response.json()) as RemotiveResponse;
  const parsedJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  const filteredJobs = insertAnyway
    ? parsedJobs
    : parsedJobs
        .filter(job =>
          matchesRemotiveQuery({
            job,
            location,
            searchTerm,
          }),
        )
        .filter(job => {
          if (mode === 'backfill') return true;
          const postedAt = toPrismaDate(job.publication_date);
          if (!postedAt) return false;
          return now - postedAt.getTime() <= recentThresholdMs;
        });

  const listings = filteredJobs
    .map(job => buildRemotiveListing(userId, job))
    .filter(
      (listing): listing is Prisma.JobListingCreateManyInput =>
        listing !== null,
    );

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode !== 'backfill',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'remotive',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `Remotive: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    fetched: filteredJobs.length,
    created: result.created,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    updated: result.updated,
    skipped: result.skipped,
    metadata: {
      apiUrl: REMOTIVE_API_URL,
      parsedJobs: parsedJobs.length,
    },
  };
}

async function runHimalayasScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 10 : 5);
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'himalayas',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Himalayas: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      page: String(page),
    });
    if (searchTerm?.trim()) {
      params.set('q', searchTerm.trim());
    }

    const response = await resilientFetch(
      `${HIMALAYAS_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: {
          Accept: 'application/json',
        },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Himalayas API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as HimalayasResponse;
    const parsedJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    totalFetched += parsedJobs.length;

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesHimalayasQuery({
              job,
              location,
              searchTerm,
            }),
          )
          .filter(job => {
            if (mode === 'backfill') return true;
            const postedAt = toPrismaDateFromUnix(job.pubDate);
            if (!postedAt) return false;
            return now - postedAt.getTime() <= recentThresholdMs;
          });

    const listings = filteredJobs
      .map(job => buildHimalayasListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'himalayas',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Himalayas page ${page}: fetched ${parsedJobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const totalCount = payload.totalCount ?? parsedJobs.length;
    const limit = payload.limit ?? HIMALAYAS_ITEMS_PER_PAGE;
    if (parsedJobs.length === 0 || page * limit >= totalCount) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
  };
}

async function runArbeitnowScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 10 : 5);
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'arbeitnow',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Arbeitnow: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      page: String(page),
    });
    if (searchTerm?.trim()) {
      params.set('query', searchTerm.trim());
    }

    const response = await resilientFetch(
      `${ARBEITNOW_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: {
          Accept: 'application/json',
        },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Arbeitnow API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as ArbeitnowResponse;
    const parsedJobs = Array.isArray(payload.data) ? payload.data : [];
    totalFetched += parsedJobs.length;

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesArbeitnowQuery({
              job,
              location,
              remote,
              searchTerm,
            }),
          )
          .filter(job => {
            if (mode === 'backfill') return true;
            const postedAt = toPrismaDateFromUnix(job.created_at);
            if (!postedAt) return false;
            return now - postedAt.getTime() <= recentThresholdMs;
          });

    const listings = filteredJobs
      .map(job => buildArbeitnowListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'arbeitnow',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Arbeitnow page ${page}: fetched ${parsedJobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (
      parsedJobs.length === 0 ||
      !payload.links?.next ||
      parsedJobs.length < (payload.meta?.per_page ?? ARBEITNOW_ITEMS_PER_PAGE)
    ) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
  };
}

async function runRemoteFirstJobsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 5 : 3);
  const now = Date.now();
  const recentThresholdMs =
    mode === 'weekly' ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;

  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 0; page < effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'remotefirstjobs',
      mode,
      status: 'fetching',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Remote First Jobs: fetching page ${page + 1}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      page: String(page),
    });
    if (searchTerm?.trim()) {
      params.set('query', searchTerm.trim());
    }

    const response = await resilientFetch(
      `${REMOTE_FIRST_JOBS_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: {
          Accept: 'application/json',
        },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Remote First Jobs API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as RemoteFirstJobsResponse;
    const parsedJobs = Array.isArray(payload.jobs) ? payload.jobs : [];
    totalFetched += parsedJobs.length;

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesRemoteFirstJobsQuery({
              job,
              location,
              searchTerm,
            }),
          )
          .filter(job => {
            if (mode === 'backfill') return true;
            const postedAt = toPrismaDate(job.published_at);
            if (!postedAt) return false;
            return now - postedAt.getTime() <= recentThresholdMs;
          });

    const listings = filteredJobs
      .map(job => buildRemoteFirstJobsListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'remotefirstjobs',
      mode,
      status: 'persisting',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Remote First Jobs page ${page + 1}: fetched ${parsedJobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (
      parsedJobs.length === 0 ||
      parsedJobs.length <
        (payload.jobs_count ?? REMOTE_FIRST_JOBS_ITEMS_PER_PAGE)
    ) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
  };
}

async function runRemoteJobsOrgScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  maxPages,
  postedWithin,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  postedWithin?: string;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 10 : 5);
  const postedWithinDays = parsePostedWithinDays(postedWithin, mode);
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'remotejobs-org',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `RemoteJobs.org: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      limit: String(REMOTEJOBS_ORG_ITEMS_PER_PAGE),
      offset: String((page - 1) * REMOTEJOBS_ORG_ITEMS_PER_PAGE),
    });
    const compactSearchTerm = compactUpstreamParam(searchTerm);
    if (compactSearchTerm) params.set('q', compactSearchTerm);

    const response = await resilientFetch(
      `${REMOTEJOBS_ORG_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: { Accept: 'application/json' },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `RemoteJobs.org API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as RemoteJobsOrgResponse;
    const parsedJobs = Array.isArray(payload.data) ? payload.data : [];
    totalFetched += parsedJobs.length;

    const filteredJobs = insertAnyway
      ? parsedJobs
      : parsedJobs
          .filter(job =>
            matchesRemoteJobsOrgQuery({ job, location, searchTerm }),
          )
          .filter(job =>
            withinPostedWindow({
              date: toPrismaDate(job.posted_at),
              days: postedWithinDays,
              insertAnyway,
            }),
          );

    const listings = filteredJobs
      .map(job => buildRemoteJobsOrgListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'remotejobs-org',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `RemoteJobs.org page ${page}: fetched ${parsedJobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (
      parsedJobs.length < REMOTEJOBS_ORG_ITEMS_PER_PAGE ||
      payload.pagination?.has_more === false
    ) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { apiUrl: REMOTEJOBS_ORG_API_URL },
  };
}

async function runTheirStackScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  maxPages,
  postedWithin,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  postedWithin?: string;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const requestedMaxPages = Math.min(
    maxPages,
    mode === 'backfill'
      ? THEIRSTACK_BACKFILL_MAX_PAGES
      : THEIRSTACK_SYNC_MAX_PAGES,
  );
  const apiRequestsUsedThisMonth =
    await getProviderApiRequestsThisMonth('theirstack');
  const apiRequestsRemainingThisMonth = Math.max(
    THEIRSTACK_MONTHLY_API_REQUEST_LIMIT - apiRequestsUsedThisMonth,
    0,
  );
  const effectiveMaxPages = Math.min(
    requestedMaxPages,
    apiRequestsRemainingThisMonth,
  );
  const postedWithinDays = parsePostedWithinDays(postedWithin, mode);
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  if (effectiveMaxPages <= 0) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'theirstack',
      mode,
      status: 'complete',
      currentPage: 0,
      totalPages: 0,
      jobsFetched: 0,
      jobsCreated: 0,
      jobsUpdated: 0,
      jobsSkipped: 0,
      message: `TheirStack monthly API limit reached (${apiRequestsUsedThisMonth}/${THEIRSTACK_MONTHLY_API_REQUEST_LIMIT}). Skipping until next month.`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    return {
      apiRequests: 0,
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      stopReason: 'theirstack_monthly_api_limit_reached',
      metadata: {
        apiUrl: 'https://api.theirstack.com/v1/jobs/search',
        monthlyApiRequestLimit: THEIRSTACK_MONTHLY_API_REQUEST_LIMIT,
        monthlyApiRequestsRemainingBeforeRun: apiRequestsRemainingThisMonth,
        monthlyApiRequestsUsedBeforeRun: apiRequestsUsedThisMonth,
      },
    };
  }

  for (let page = 0; page < effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'theirstack',
      mode,
      status: 'fetching',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `TheirStack: fetching page ${page + 1}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const payload = await searchTheirStackJobs({
      countryCode: 'US',
      jobTitle: compactUpstreamParam(searchTerm),
      location: compactUpstreamParam(location, MAX_UPSTREAM_LOCATION_LENGTH),
      limit: THEIRSTACK_ITEMS_PER_PAGE,
      page,
      postedWithinDays,
      remote,
    });
    apiRequests += 1;

    const jobs = Array.isArray(payload.data) ? payload.data : [];
    totalFetched += jobs.length;

    const listings = jobs
      .map(job => buildTheirStackListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'theirstack',
      mode,
      status: 'persisting',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `TheirStack page ${page + 1}: fetched ${jobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (jobs.length < THEIRSTACK_ITEMS_PER_PAGE || !payload.has_more) {
      break;
    }

    await new Promise(resolve =>
      setTimeout(resolve, THEIRSTACK_REQUEST_DELAY_MS),
    );
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: {
      apiUrl: 'https://api.theirstack.com/v1/jobs/search',
      monthlyApiRequestLimit: THEIRSTACK_MONTHLY_API_REQUEST_LIMIT,
      monthlyApiRequestsRemainingBeforeRun: apiRequestsRemainingThisMonth,
      monthlyApiRequestsUsedBeforeRun: apiRequestsUsedThisMonth,
    },
  };
}

async function runJobDataApiScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  postedWithin,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  postedWithin?: string;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const apiKey = process.env.JOBDATAAPI_KEY;
  if (!apiKey) {
    throw new Error('JOBDATAAPI_KEY is not set');
  }

  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 20 : 8);
  const postedWithinDays = parsePostedWithinDays(postedWithin, mode);
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'jobdataapi',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `JobDataAPI: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      country_code: 'US',
      description_str: 'true',
      max_age: String(postedWithinDays),
      page: String(page),
      page_size: String(JOBDATA_API_ITEMS_PER_PAGE),
    });
    const compactSearchTerm = compactUpstreamParam(searchTerm);
    const compactLocation = compactUpstreamParam(
      location,
      MAX_UPSTREAM_LOCATION_LENGTH,
    );
    if (compactSearchTerm) params.set('title', compactSearchTerm);
    if (compactLocation) params.set('location', compactLocation);
    if (remote) params.set('has_remote', 'true');

    const response = await resilientFetch(
      `${JOBDATA_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'api',
        headers: {
          Accept: 'application/json',
          Authorization: `Api-Key ${apiKey}`,
        },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `JobDataAPI failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as JobDataApiResponse;
    const jobs = Array.isArray(payload.results) ? payload.results : [];
    totalFetched += jobs.length;

    const filteredJobs = insertAnyway
      ? jobs
      : jobs.filter(job =>
          withinPostedWindow({
            date: toPrismaDate(job.published),
            days: postedWithinDays,
            insertAnyway,
          }),
        );

    const listings = filteredJobs
      .map(job => buildJobDataApiListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'jobdataapi',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `JobDataAPI page ${page}: fetched ${jobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (jobs.length < JOBDATA_API_ITEMS_PER_PAGE || !payload.next) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { apiUrl: JOBDATA_API_URL },
  };
}

async function runFindworkScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  postedWithin,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  postedWithin?: string;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const apiKey = process.env.FINDWORK_API_KEY;
  if (!apiKey) {
    throw new Error('FINDWORK_API_KEY is not set');
  }

  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 10 : 5);
  const postedWithinDays = parsePostedWithinDays(postedWithin, mode);
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'findwork',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Findwork: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      page: String(page),
    });
    const compactSearchTerm = compactUpstreamParam(searchTerm);
    const compactLocation = compactUpstreamParam(
      location,
      MAX_UPSTREAM_LOCATION_LENGTH,
    );
    if (compactSearchTerm) params.set('search', compactSearchTerm);
    if (compactLocation) params.set('location', compactLocation);
    if (remote) params.set('remote', 'true');

    const response = await resilientFetch(
      `${FINDWORK_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'api',
        headers: {
          Accept: 'application/json',
          Authorization: `Token ${apiKey}`,
        },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Findwork API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as FindworkResponse;
    const jobs = Array.isArray(payload.results) ? payload.results : [];
    totalFetched += jobs.length;

    const filteredJobs = insertAnyway
      ? jobs
      : jobs.filter(job =>
          withinPostedWindow({
            date: toPrismaDate(job.date_posted),
            days: postedWithinDays,
            insertAnyway,
          }),
        );

    const listings = filteredJobs
      .map(job => buildFindworkListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'findwork',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Findwork page ${page}: fetched ${jobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (jobs.length === 0 || !payload.next) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { apiUrl: FINDWORK_API_URL },
  };
}

async function runClawJobsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  postedWithin,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  postedWithin?: string;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, mode === 'backfill' ? 20 : 8);
  const postedWithinDays = parsePostedWithinDays(postedWithin, mode);
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 0; page < effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'clawjobs',
      mode,
      status: 'fetching',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `ClawJobs: fetching page ${page + 1}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      limit: String(CLAWJOBS_ITEMS_PER_PAGE),
      offset: String(page * CLAWJOBS_ITEMS_PER_PAGE),
    });
    const compactSearchTerm = compactUpstreamParam(searchTerm);
    if (compactSearchTerm) params.set('query', compactSearchTerm);
    if (remote) params.set('remote', 'true');

    const response = await resilientFetch(
      `${CLAWJOBS_API_URL}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: { Accept: 'application/json' },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `ClawJobs API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as ClawJobsResponse;
    const jobs = Array.isArray(payload.data) ? payload.data : [];
    totalFetched += jobs.length;

    const filteredJobs = jobs
      .filter(job =>
        matchesClawJobsQuery({ job, location, remote, searchTerm }),
      )
      .filter(job =>
        withinPostedWindow({
          date: toPrismaDate(job.created_at),
          days: postedWithinDays,
          insertAnyway,
        }),
      );

    const listings = filteredJobs
      .map(job => buildClawJobsListing(userId, job))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'clawjobs',
      mode,
      status: 'persisting',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `ClawJobs page ${page + 1}: fetched ${jobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (
      jobs.length < CLAWJOBS_ITEMS_PER_PAGE ||
      payload.meta?.has_more === false
    ) {
      break;
    }

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { apiUrl: CLAWJOBS_API_URL },
  };
}

async function runComeetBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  postedWithin,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  postedWithin?: string;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const postedWithinDays = parsePostedWithinDays(postedWithin, mode);
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let i = 0; i < TOP_COMEET_BOARDS.length; i++) {
    const board = TOP_COMEET_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'comeet-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_COMEET_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Comeet: fetching ${board.company} (${i + 1}/${TOP_COMEET_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      details: 'true',
      token: board.token,
    });
    const response = await resilientFetch(
      `${COMEET_API_URL}/${board.uid}/positions?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: { Accept: 'application/json' },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `Comeet ${board.company} failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as ComeetJob[];
    const jobs = Array.isArray(payload) ? payload : [];
    totalFetched += jobs.length;

    const filteredJobs = jobs
      .filter(job => matchesComeetQuery({ job, location, remote, searchTerm }))
      .filter(job =>
        withinPostedWindow({
          date: toPrismaDate(job.time_updated),
          days: postedWithinDays,
          insertAnyway,
        }),
      );

    const listings = filteredJobs
      .map(job => buildComeetListing(userId, job, board))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'comeet-boards',
      mode,
      status: 'persisting',
      currentPage: i + 1,
      totalPages: TOP_COMEET_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Comeet ${board.company}: fetched ${jobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: TOP_COMEET_BOARDS.length },
  };
}

async function runWorkdayBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const pagesPerBoard = Math.min(maxPages, mode === 'backfill' ? 5 : 2);
  const pageLimit = 20;
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (
    let boardIndex = 0;
    boardIndex < TOP_WORKDAY_BOARDS.length;
    boardIndex++
  ) {
    const board = TOP_WORKDAY_BOARDS[boardIndex];

    for (let page = 0; page < pagesPerBoard; page++) {
      const currentPage = boardIndex * pagesPerBoard + page + 1;
      const totalPages = TOP_WORKDAY_BOARDS.length * pagesPerBoard;

      await broadcastProgress(userId, {
        scrapeId,
        provider: 'workday-boards',
        mode,
        status: 'fetching',
        currentPage,
        totalPages,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsSkipped: totalSkipped,
        message: `Workday: fetching ${board.company} page ${page + 1}/${pagesPerBoard}...`,
        startedAt,
        elapsed: Date.now() - new Date(startedAt).getTime(),
      });

      const response = await resilientFetch(
        `https://${board.host}/wday/cxs/${board.tenant}/${board.site}/jobs`,
        {
          method: 'POST',
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            appliedFacets: {},
            limit: pageLimit,
            offset: page * pageLimit,
            searchText: compactUpstreamParam(searchTerm) ?? '',
          }),
        },
      );
      apiRequests += 1;

      if (!response.ok) {
        throw new Error(
          `Workday ${board.company} failed: ${response.status} ${await response.text()}`,
        );
      }

      const payload = (await response.json()) as WorkdayResponse;
      const jobs = Array.isArray(payload.jobPostings)
        ? payload.jobPostings
        : [];
      totalFetched += jobs.length;

      const filteredJobs = jobs.filter(job => {
        const listing = buildWorkdayBoardListing(userId, job, board);
        if (!listing) return false;
        if (
          !matchesTextQuery({
            searchTerm: location,
            fields: [listing.location, listing.title],
          })
        ) {
          return false;
        }
        if (remote && !listing.remote) return false;
        return true;
      });

      const listings = filteredJobs
        .map(job => buildWorkdayBoardListing(userId, job, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode !== 'backfill',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }

      await broadcastProgress(userId, {
        scrapeId,
        provider: 'workday-boards',
        mode,
        status: 'persisting',
        currentPage,
        totalPages,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsSkipped: totalSkipped,
        message: `Workday ${board.company} page ${page + 1}: fetched ${jobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
        recentCreatedListings,
        recentUpdatedListings,
        startedAt,
        elapsed: Date.now() - new Date(startedAt).getTime(),
      });

      if (jobs.length < pageLimit) break;
      await new Promise(resolve => setTimeout(resolve, 300));
    }
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: TOP_WORKDAY_BOARDS.length },
  };
}

async function runBreezyBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let i = 0; i < TOP_BREEZY_BOARDS.length; i++) {
    const board = TOP_BREEZY_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'breezy-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_BREEZY_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `BreezyHR: fetching ${board} (${i + 1}/${TOP_BREEZY_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const response = await resilientFetch(
      `https://${board}.breezy.hr/json?verbose=true`,
      {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: { Accept: 'application/json' },
      },
    );
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `BreezyHR ${board} failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as BreezyJob[];
    const jobs = Array.isArray(payload) ? payload : [];
    totalFetched += jobs.length;

    const filteredJobs = jobs.filter(job => {
      const listing = buildBreezyBoardListing(userId, job, board);
      if (!listing) return false;
      if (
        !matchesTextQuery({
          searchTerm,
          fields: [
            listing.company,
            listing.description,
            listing.location,
            listing.title,
          ],
        })
      ) {
        return false;
      }
      if (
        !matchesTextQuery({
          searchTerm: location,
          fields: [listing.location],
        })
      ) {
        return false;
      }
      if (remote && !listing.remote) return false;
      return true;
    });

    const listings = filteredJobs
      .map(job => buildBreezyBoardListing(userId, job, board))
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'breezy-boards',
      mode,
      status: 'persisting',
      currentPage: i + 1,
      totalPages: TOP_BREEZY_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `BreezyHR ${board}: fetched ${jobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: TOP_BREEZY_BOARDS.length },
  };
}

async function runHtmlBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  startedAt,
  boards,
  buildUrl,
  parseJobs,
  provider,
  source,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  remote?: boolean;
  startedAt: string;
  boards: readonly string[];
  buildUrl: (board: string) => string;
  parseJobs: (html: string, board: string, baseUrl: string) => HtmlBoardJob[];
  provider: 'jazzhr-boards' | 'jobvite-boards';
  source: 'JazzHR' | 'Jobvite';
}): Promise<ProviderRunResult> {
  let apiRequests = 0;
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let i = 0; i < boards.length; i++) {
    const board = boards[i];
    const boardUrl = buildUrl(board);

    await broadcastProgress(userId, {
      scrapeId,
      provider,
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: boards.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `${source}: fetching ${board} (${i + 1}/${boards.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const response = await resilientFetch(boardUrl, {
      cache: 'no-store',
      retryPolicy: 'public-api',
      headers: { Accept: 'text/html,application/xhtml+xml' },
    });
    apiRequests += 1;

    if (!response.ok) {
      throw new Error(
        `${source} ${board} failed: ${response.status} ${await response.text()}`,
      );
    }

    const html = await response.text();
    const jobs = parseJobs(html, board, boardUrl);
    totalFetched += jobs.length;
    const filteredJobs = jobs.filter(job =>
      matchesHtmlBoardJob({ job, location, remote, searchTerm }),
    );

    const listings = filteredJobs
      .map(job =>
        buildHtmlBoardListing({ board, job, provider, source, userId }),
      )
      .filter(
        (listing): listing is Prisma.JobListingCreateManyInput =>
          listing !== null,
      );

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode !== 'backfill',
    });
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider,
      mode,
      status: 'persisting',
      currentPage: i + 1,
      totalPages: boards.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `${source} ${board}: fetched ${jobs.length}, kept ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    await new Promise(resolve => setTimeout(resolve, 300));
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: boards.length },
  };
}

const runJobviteBoardsScrape = (
  input: Omit<
    Parameters<typeof runHtmlBoardsScrape>[0],
    'boards' | 'buildUrl' | 'parseJobs' | 'provider' | 'source'
  >,
) =>
  runHtmlBoardsScrape({
    ...input,
    boards: TOP_JOBVITE_BOARDS,
    buildUrl: board =>
      board === 'ashcompanies'
        ? `https://jobs.jobvite.com/${board}/jobs/alljobs`
        : `https://jobs.jobvite.com/${board}/jobs`,
    parseJobs: parseJobviteJobs,
    provider: 'jobvite-boards',
    source: 'Jobvite',
  });

const runJazzHrBoardsScrape = (
  input: Omit<
    Parameters<typeof runHtmlBoardsScrape>[0],
    'boards' | 'buildUrl' | 'parseJobs' | 'provider' | 'source'
  >,
) =>
  runHtmlBoardsScrape({
    ...input,
    boards: TOP_JAZZHR_BOARDS,
    buildUrl: board => `https://${board}.applytojob.com/apply/jobs/`,
    parseJobs: parseJazzHrJobs,
    provider: 'jazzhr-boards',
    source: 'JazzHR',
  });

// ---------------------------------------------------------------------------
// Adzuna scraper
// ---------------------------------------------------------------------------

async function runAdzunaScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  if (!appId || !appKey) {
    throw new Error('ADZUNA_APP_ID or ADZUNA_APP_KEY is not set');
  }

  const effectiveMaxPages = Math.min(maxPages, 10);
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'adzuna',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Adzuna: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams();
    params.set('app_id', appId);
    params.set('app_key', appKey);
    params.set('results_per_page', String(ADZUNA_ITEMS_PER_PAGE));
    const compactSearchTerm = compactUpstreamParam(searchTerm);
    const compactLocation = compactUpstreamParam(
      location,
      MAX_UPSTREAM_LOCATION_LENGTH,
    );
    if (compactSearchTerm) params.set('what', compactSearchTerm);
    if (compactLocation) params.set('where', compactLocation);
    if (remote)
      params.set(
        'what',
        compactUpstreamParam(
          [compactSearchTerm ?? '', 'remote'].filter(Boolean).join(' '),
        ) ?? 'remote',
      );

    const response = await resilientFetch(
      `${ADZUNA_API_URL}/${ADZUNA_COUNTRY}/search/${page}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'api',
        headers: { Accept: 'application/json' },
      },
    );
    apiRequests++;

    if (!response.ok) {
      throw new Error(
        `Adzuna API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as AdzunaResponse;
    const jobs = Array.isArray(payload.results) ? payload.results : [];

    if (jobs.length === 0) break;

    const listings = jobs
      .map(job => buildAdzunaListing(userId, job))
      .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode === 'sync',
    });

    totalFetched += jobs.length;
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'adzuna',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Adzuna page ${page}: fetched ${jobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (jobs.length < ADZUNA_ITEMS_PER_PAGE) break;
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { apiUrl: ADZUNA_API_URL },
  };
}

// ---------------------------------------------------------------------------
// Jooble scraper
// ---------------------------------------------------------------------------

async function runJoobleScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const apiKey = process.env.JOOBLE_API_KEY;
  if (!apiKey) {
    throw new Error('JOOBLE_API_KEY is not set');
  }

  const effectiveMaxPages = Math.min(maxPages, 10);
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];

  for (let page = 1; page <= effectiveMaxPages; page++) {
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'jooble',
      mode,
      status: 'fetching',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Jooble: fetching page ${page}/${effectiveMaxPages}...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const keywords = compactUpstreamParam(
      [searchTerm ?? '', remote ? 'remote' : ''].filter(Boolean).join(' '),
    );
    const searchLocation =
      compactUpstreamParam(location, MAX_UPSTREAM_LOCATION_LENGTH) ||
      'United States';

    const response = await resilientFetch(`${JOOBLE_API_URL}/${apiKey}`, {
      method: 'POST',
      cache: 'no-store',
      retryPolicy: 'api',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        keywords,
        location: searchLocation,
        page: String(page),
        ResultOnPage: JOOBLE_ITEMS_PER_PAGE,
      }),
    });
    apiRequests++;

    if (!response.ok) {
      throw new Error(
        `Jooble API failed: ${response.status} ${await response.text()}`,
      );
    }

    const payload = (await response.json()) as JoobleResponse;
    const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];

    if (jobs.length === 0) break;

    const listings = jobs
      .map(job => buildJoobleListing(userId, job))
      .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode === 'sync',
    });

    totalFetched += jobs.length;
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    if (result.recentCreatedListings.length > 0) {
      recentCreatedListings = result.recentCreatedListings;
    }
    if (result.recentUpdatedListings.length > 0) {
      recentUpdatedListings = result.recentUpdatedListings;
    }

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'jooble',
      mode,
      status: 'persisting',
      currentPage: page,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Jooble page ${page}: fetched ${jobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    if (jobs.length < JOOBLE_ITEMS_PER_PAGE) break;
  }

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { apiUrl: JOOBLE_API_URL },
  };
}

// ---------------------------------------------------------------------------
// DevITjobs scraper (single-page, fetches all US tech jobs)
// ---------------------------------------------------------------------------

async function runDevITJobsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  remote,
  insertAnyway,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'devitjobs',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'DevITjobs: fetching all tech jobs...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await resilientFetch(DEVITJOBS_API_URL, {
    cache: 'no-store',
    retryPolicy: 'public-api',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(
      `DevITjobs API failed: ${response.status} ${await response.text()}`,
    );
  }

  const allJobs = (await response.json()) as DevITJob[];

  // Filter to US jobs only
  let filteredJobs = insertAnyway
    ? allJobs
    : allJobs.filter(
        job =>
          US_STATE_CATEGORIES.has(job.stateCategory ?? '') ||
          job.workplace === 'remote',
      );

  // Apply search term filter
  if (!insertAnyway && searchTerm?.trim()) {
    const searchLower = searchTerm.trim().toLowerCase();
    filteredJobs = filteredJobs.filter(job => {
      const name = (job.name ?? '').toLowerCase();
      const techs = (job.technologies ?? []).join(' ').toLowerCase();
      return name.includes(searchLower) || techs.includes(searchLower);
    });
  }

  // Apply remote filter
  if (!insertAnyway && remote) {
    filteredJobs = filteredJobs.filter(
      job =>
        job.workplace === 'remote' ||
        job.remoteType === 'fully' ||
        hasRemoteTextSignal(job.name),
    );
  }

  const listings = filteredJobs
    .map(job => buildDevITJobsListing(userId, job))
    .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode === 'sync',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'devitjobs',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `DevITjobs: ${allJobs.length} total, ${filteredJobs.length} US/remote, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    fetched: filteredJobs.length,
    created: result.created,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    updated: result.updated,
    skipped: result.skipped,
    metadata: { apiUrl: DEVITJOBS_API_URL, totalFromApi: allJobs.length },
  };
}

// ---------------------------------------------------------------------------
// Working Nomads scraper (single-page, remote jobs)
// ---------------------------------------------------------------------------

interface WorkingNomadsJob {
  category_name?: string;
  company_name?: string;
  description?: string;
  location?: string;
  pub_date?: string;
  tags?: string;
  title?: string;
  url?: string;
}

const buildWorkingNomadsListing = (
  userId: string,
  job: WorkingNomadsJob,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.url);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company_name),
    description: extractHtmlText(job.description),
    jobId: `workingnomads-${applyUrl}`,
    jobProvider: JobProvider.WORKING_NOMADS,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location: toNullableString(job.location) || 'Remote',
    postedAt: toPrismaDate(job.pub_date),
    qualifications: job.tags
      ? job.tags
          .split(',')
          .map(t => t.trim())
          .filter(Boolean)
      : [],
    remote: true,
    requirements: [],
    responsibilities: [],
    source: 'Working Nomads',
    title,
    userId,
    workFromHome: true,
  };
};

async function runWorkingNomadsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  insertAnyway,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  remote?: boolean;
  insertAnyway?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'workingnomads',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'Working Nomads: fetching remote jobs...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const response = await resilientFetch(WORKING_NOMADS_API_URL, {
    cache: 'no-store',
    retryPolicy: 'public-api',
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Working Nomads API failed: ${response.status}`);
  }

  const allJobs = (await response.json()) as WorkingNomadsJob[];

  let filteredJobs = allJobs;
  if (!insertAnyway && searchTerm?.trim()) {
    const searchLower = searchTerm.trim().toLowerCase();
    filteredJobs = filteredJobs.filter(job => {
      const name = (job.title ?? '').toLowerCase();
      const tags = (job.tags ?? '').toLowerCase();
      const cat = (job.category_name ?? '').toLowerCase();
      return (
        name.includes(searchLower) ||
        tags.includes(searchLower) ||
        cat.includes(searchLower)
      );
    });
  }

  const listings = filteredJobs
    .map(job => buildWorkingNomadsListing(userId, job))
    .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode === 'sync',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'workingnomads',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredJobs.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `Working Nomads: fetched ${filteredJobs.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1,
    fetched: filteredJobs.length,
    created: result.created,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    updated: result.updated,
    skipped: result.skipped,
    metadata: { apiUrl: WORKING_NOMADS_API_URL },
  };
}

// ---------------------------------------------------------------------------
// Hacker News Jobs scraper (YC startups, free Firebase API)
// ---------------------------------------------------------------------------

interface HNJobStory {
  by?: string;
  id: number;
  score?: number;
  time?: number;
  title?: string;
  type?: string;
  url?: string;
}

const buildHNJobListing = (
  userId: string,
  story: HNJobStory,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(story.url);
  const rawTitle = toNullableString(story.title);
  if (!applyUrl || !rawTitle) return null;

  // Parse "Company (YC X) Is Hiring Role" format
  const companyMatch = rawTitle.match(/^(.+?)\s*\(YC\s+\w+\)\s+/i);
  const company = companyMatch?.[1]?.trim() ?? null;
  const title =
    rawTitle
      .replace(/^.+?\(YC\s+\w+\)\s*/i, '')
      .replace(/^is hiring\s*/i, '')
      .trim() || rawTitle;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company,
    description: undefined,
    jobId: `hn-${story.id}`,
    jobProvider: JobProvider.HACKER_NEWS,
    jobProviderUrl: applyUrl,
    jobType: JobType.FULL_TIME,
    location: 'United States',
    postedAt: story.time ? new Date(story.time * 1000) : null,
    qualifications: [],
    remote: false,
    requirements: [],
    responsibilities: [],
    source: 'Hacker News',
    title,
    userId,
  };
};

async function runHackerNewsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  insertAnyway,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  remote?: boolean;
  insertAnyway?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  await broadcastProgress(userId, {
    scrapeId,
    provider: 'hackernews',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'Hacker News: fetching YC job stories...',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  const idsResponse = await resilientFetch(
    `${HN_JOBS_API_URL}/jobstories.json`,
    {
      cache: 'no-store',
      retryPolicy: 'public-api',
    },
  );
  if (!idsResponse.ok) throw new Error(`HN API failed: ${idsResponse.status}`);
  const storyIds = (await idsResponse.json()) as number[];

  // Fetch each story in parallel (batches of 10)
  const stories: HNJobStory[] = [];
  for (let i = 0; i < storyIds.length; i += 10) {
    const batch = storyIds.slice(i, i + 10);
    const results = await Promise.all(
      batch.map(async id => {
        const res = await fetch(`${HN_JOBS_API_URL}/item/${id}.json`);
        return res.ok ? ((await res.json()) as HNJobStory) : null;
      }),
    );
    stories.push(...results.filter((s): s is HNJobStory => s !== null));
  }

  let filteredStories = stories;
  if (!insertAnyway && searchTerm?.trim()) {
    const searchLower = searchTerm.trim().toLowerCase();
    filteredStories = stories.filter(s =>
      (s.title ?? '').toLowerCase().includes(searchLower),
    );
  }

  const listings = filteredStories
    .map(s => buildHNJobListing(userId, s))
    .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

  const result = await persistListings({
    userId,
    listings,
    updateExisting: mode === 'sync',
  });

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'hackernews',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: filteredStories.length,
    jobsCreated: result.created,
    jobsUpdated: result.updated,
    jobsSkipped: result.skipped,
    message: `Hacker News: ${stories.length} stories, ${filteredStories.length} matched, created ${result.created}${breakdownSuffix(result.breakdown)}`,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: 1 + storyIds.length,
    fetched: filteredStories.length,
    created: result.created,
    recentCreatedListings: result.recentCreatedListings,
    recentUpdatedListings: result.recentUpdatedListings,
    updated: result.updated,
    skipped: result.skipped,
    metadata: { apiUrl: HN_JOBS_API_URL, totalStories: stories.length },
  };
}

// ---------------------------------------------------------------------------
// Greenhouse Boards bulk scraper (top tech companies)
// ---------------------------------------------------------------------------

interface GreenhouseJob {
  absolute_url?: string;
  id?: number;
  location?: { name?: string };
  title?: string;
  updated_at?: string;
  departments?: Array<{ name?: string }>;
}

const buildGreenhouseBoardListing = (
  userId: string,
  job: GreenhouseJob,
  companyBoard: string,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.absolute_url);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  const location = toNullableString(job.location?.name) || 'Unknown';

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: companyBoard
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()),
    description: undefined,
    jobId: `gh-${companyBoard}-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.GREENHOUSE,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.updated_at),
    qualifications: (job.departments ?? [])
      .map(d => d.name)
      .filter((n): n is string => Boolean(n)),
    remote: location.toLowerCase().includes('remote'),
    requirements: [],
    responsibilities: [],
    source: 'Greenhouse',
    title,
    userId,
    workFromHome: location.toLowerCase().includes('remote'),
  };
};

async function runGreenhouseBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  insertAnyway,
  startedAt,
}: AtsScraperFetchContext): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_GREENHOUSE_BOARDS.length; i++) {
    const board = TOP_GREENHOUSE_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'greenhouse-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_GREENHOUSE_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Greenhouse: fetching ${board} (${i + 1}/${TOP_GREENHOUSE_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `${GREENHOUSE_BOARDS_API}/${board}/jobs`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests++;

      if (!response.ok) continue;

      const data = (await response.json()) as { jobs?: GreenhouseJob[] };
      const jobs = data.jobs ?? [];

      let filtered = jobs;
      if (searchLower) {
        filtered = jobs.filter(j =>
          (j.title ?? '').toLowerCase().includes(searchLower),
        );
      }

      totalFetched += filtered.length;

      const listings = filtered
        .map(j => buildGreenhouseBoardListing(userId, j, board))
        .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

      if (listings.length > 0) {
        const result = await persistListings({
          userId,
          listings,
          updateExisting: mode === 'sync',
        });
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        if (result.recentCreatedListings.length > 0)
          recentCreatedListings = result.recentCreatedListings;
        if (result.recentUpdatedListings.length > 0)
          recentUpdatedListings = result.recentUpdatedListings;

        await broadcastProgress(userId, {
          scrapeId,
          provider: 'greenhouse-boards',
          mode,
          status: 'persisting',
          currentPage: i + 1,
          totalPages: TOP_GREENHOUSE_BOARDS.length,
          jobsFetched: totalFetched,
          jobsCreated: totalCreated,
          jobsUpdated: totalUpdated,
          jobsSkipped: totalSkipped,
          message: `Greenhouse ${board}: fetched ${filtered.length}, kept ${listings.length}, created ${result.created}${breakdownSuffix(result.breakdown)}, updated ${result.updated}`,
          recentCreatedListings,
          recentUpdatedListings,
          startedAt,
          elapsed: Date.now() - new Date(startedAt).getTime(),
        });
      } else {
        await broadcastProgress(userId, {
          scrapeId,
          provider: 'greenhouse-boards',
          mode,
          status: 'persisting',
          currentPage: i + 1,
          totalPages: TOP_GREENHOUSE_BOARDS.length,
          jobsFetched: totalFetched,
          jobsCreated: totalCreated,
          jobsUpdated: totalUpdated,
          jobsSkipped: totalSkipped,
          message: `Greenhouse ${board}: fetched ${filtered.length}, kept 0, created 0, updated 0`,
          recentCreatedListings,
          recentUpdatedListings,
          startedAt,
          elapsed: Date.now() - new Date(startedAt).getTime(),
        });
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'greenhouse-boards',
    mode,
    status: 'complete',
    currentPage: TOP_GREENHOUSE_BOARDS.length,
    totalPages: TOP_GREENHOUSE_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Greenhouse Boards: ${TOP_GREENHOUSE_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: TOP_GREENHOUSE_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Lever Boards bulk scraper (top tech companies)
// ---------------------------------------------------------------------------

interface LeverJob {
  additional?: string;
  applyUrl?: string;
  categories?: {
    commitment?: string;
    department?: string;
    location?: string;
    team?: string;
  };
  createdAt?: number;
  hostedUrl?: string;
  id?: string;
  text?: string;
}

const buildLeverBoardListing = (
  userId: string,
  job: LeverJob,
  companyBoard: string,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl =
    toNullableString(job.applyUrl) ?? toNullableString(job.hostedUrl);
  const title = toNullableString(job.text);
  if (!applyUrl || !title) return null;

  const location = toNullableString(job.categories?.location) || 'Unknown';

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: companyBoard
      .replace(/-/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase()),
    description: extractHtmlText(job.additional),
    jobId: `lever-${companyBoard}-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.LEVER,
    jobProviderUrl: applyUrl,
    jobType: job.categories?.commitment?.toLowerCase().includes('full')
      ? JobType.FULL_TIME
      : job.categories?.commitment?.toLowerCase().includes('part')
        ? JobType.PART_TIME
        : job.categories?.commitment?.toLowerCase().includes('contract')
          ? JobType.CONTRACT
          : job.categories?.commitment?.toLowerCase().includes('intern')
            ? JobType.INTERNSHIP
            : JobType.UNKNOWN,
    location,
    postedAt: job.createdAt ? new Date(job.createdAt) : null,
    qualifications: [job.categories?.department, job.categories?.team].filter(
      (v): v is string => Boolean(v),
    ),
    remote: location.toLowerCase().includes('remote'),
    requirements: [],
    responsibilities: [],
    source: 'Lever',
    title,
    userId,
    workFromHome: location.toLowerCase().includes('remote'),
  };
};

async function runLeverBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  insertAnyway,
  startedAt,
}: AtsScraperFetchContext): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_LEVER_BOARDS.length; i++) {
    const board = TOP_LEVER_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'lever-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_LEVER_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Lever: fetching ${board} (${i + 1}/${TOP_LEVER_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `${LEVER_BOARDS_API}/${board}?mode=json`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests++;

      if (!response.ok) continue;

      const jobs = (await response.json()) as LeverJob[];

      let filtered = jobs;
      if (searchLower) {
        filtered = jobs.filter(j =>
          (j.text ?? '').toLowerCase().includes(searchLower),
        );
      }

      const listings = filtered
        .map(j => buildLeverBoardListing(userId, j, board))
        .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

      if (listings.length > 0) {
        const result = await persistListings({
          userId,
          listings,
          updateExisting: mode === 'sync',
        });
        totalFetched += filtered.length;
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        if (result.recentCreatedListings.length > 0)
          recentCreatedListings = result.recentCreatedListings;
        if (result.recentUpdatedListings.length > 0)
          recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'lever-boards',
    mode,
    status: 'complete',
    currentPage: TOP_LEVER_BOARDS.length,
    totalPages: TOP_LEVER_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Lever Boards: ${TOP_LEVER_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: TOP_LEVER_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Ashby Boards bulk scraper
// ---------------------------------------------------------------------------

interface AshbyJob {
  id?: string;
  title?: string;
  location?: string;
  department?: string;
  team?: string;
  jobUrl?: string;
  publishedAt?: string;
  employmentType?: string;
}

const buildAshbyBoardListing = (
  userId: string,
  job: AshbyJob,
  companyBoard: string,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = toNullableString(job.jobUrl);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  const location = toNullableString(job.location) || 'Unknown';
  const company = companyBoard
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  let jobType: JobType = JobType.UNKNOWN;
  const emp = (job.employmentType ?? '').toLowerCase();
  if (emp.includes('full')) jobType = JobType.FULL_TIME;
  else if (emp.includes('part')) jobType = JobType.PART_TIME;
  else if (emp.includes('contract')) jobType = JobType.CONTRACT;
  else if (emp.includes('intern')) jobType = JobType.INTERNSHIP;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company,
    jobId: `ashby-${companyBoard}-${job.id ?? applyUrl}`,
    jobProvider: JobProvider.ASHBY,
    jobProviderUrl: applyUrl,
    jobType,
    location,
    postedAt: toPrismaDate(job.publishedAt),
    qualifications: [job.department, job.team].filter((v): v is string =>
      Boolean(v),
    ),
    remote: location.toLowerCase().includes('remote'),
    requirements: [],
    responsibilities: [],
    source: 'Ashby',
    title,
    userId,
    workFromHome: location.toLowerCase().includes('remote'),
  };
};

async function runAshbyBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  insertAnyway,
  startedAt,
}: AtsScraperFetchContext): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_ASHBY_BOARDS.length; i++) {
    const board = TOP_ASHBY_BOARDS[i];
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'ashby-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_ASHBY_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Ashby: fetching ${board} (${i + 1}/${TOP_ASHBY_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(`${ASHBY_BOARDS_API}/${board}`, {
        cache: 'no-store',
        retryPolicy: 'public-api',
        headers: { Accept: 'application/json' },
      });
      apiRequests++;
      if (!response.ok) continue;

      const data = (await response.json()) as { jobs?: AshbyJob[] };
      let jobs = data.jobs ?? [];
      if (searchLower)
        jobs = jobs.filter(j =>
          (j.title ?? '').toLowerCase().includes(searchLower),
        );

      const listings = jobs
        .map(j => buildAshbyBoardListing(userId, j, board))
        .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

      if (listings.length > 0) {
        const result = await persistListings({
          userId,
          listings,
          updateExisting: mode === 'sync',
        });
        totalFetched += jobs.length;
        totalCreated += result.created;
        totalUpdated += result.updated;
        totalSkipped += result.skipped;
        if (result.recentCreatedListings.length > 0)
          recentCreatedListings = result.recentCreatedListings;
        if (result.recentUpdatedListings.length > 0)
          recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'ashby-boards',
    mode,
    status: 'complete',
    currentPage: TOP_ASHBY_BOARDS.length,
    totalPages: TOP_ASHBY_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Ashby Boards: ${TOP_ASHBY_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: TOP_ASHBY_BOARDS.length },
  };
}

class GreenhouseBoardsScraper extends BaseScraper {
  readonly ats = ATS_TYPES.GREENHOUSE;

  fetch(context: AtsScraperFetchContext): Promise<ProviderRunResult> {
    return runGreenhouseBoardsScrape(context);
  }
}

class LeverBoardsScraper extends BaseScraper {
  readonly ats = ATS_TYPES.LEVER;

  fetch(context: AtsScraperFetchContext): Promise<ProviderRunResult> {
    return runLeverBoardsScrape(context);
  }
}

class AshbyBoardsScraper extends BaseScraper {
  readonly ats = ATS_TYPES.ASHBY;

  fetch(context: AtsScraperFetchContext): Promise<ProviderRunResult> {
    return runAshbyBoardsScrape(context);
  }
}

ScraperRegistry.register(ATS_TYPES.GREENHOUSE)(GreenhouseBoardsScraper);
ScraperRegistry.register(ATS_TYPES.LEVER)(LeverBoardsScraper);
ScraperRegistry.register(ATS_TYPES.ASHBY)(AshbyBoardsScraper);

// ---------------------------------------------------------------------------
// SmartRecruiters Boards bulk scraper
// ---------------------------------------------------------------------------

interface SmartRecruitersJob {
  id?: string;
  name?: string;
  uuid?: string;
  refNumber?: string;
  company?: { name?: string };
  location?: {
    city?: string;
    region?: string;
    country?: string;
    remote?: boolean;
  };
  department?: { label?: string };
  typeOfEmployment?: { label?: string };
  experienceLevel?: { label?: string };
  releasedDate?: string;
  ref?: string;
}

const buildSmartRecruitersListing = (
  userId: string,
  job: SmartRecruitersJob,
  companyBoard: string,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl =
    job.ref ??
    (job.id
      ? `https://jobs.smartrecruiters.com/${companyBoard}/${job.id}`
      : null);
  const title = toNullableString(job.name);
  if (!applyUrl || !title) return null;

  const locationParts = [
    job.location?.city,
    job.location?.region,
    job.location?.country,
  ].filter(Boolean);
  const location = locationParts.join(', ') || 'Unknown';

  let jobType: JobType = JobType.UNKNOWN;
  const emp = (job.typeOfEmployment?.label ?? '').toLowerCase();
  if (emp.includes('full')) jobType = JobType.FULL_TIME;
  else if (emp.includes('part')) jobType = JobType.PART_TIME;
  else if (emp.includes('contract')) jobType = JobType.CONTRACT;
  else if (emp.includes('intern')) jobType = JobType.INTERNSHIP;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(job.company?.name) ?? companyBoard,
    jobId: `sr-${companyBoard}-${job.uuid ?? job.id ?? applyUrl}`,
    jobProvider: JobProvider.SMART_RECRUITERS,
    jobProviderUrl: applyUrl,
    jobType,
    location,
    postedAt: toPrismaDate(job.releasedDate),
    qualifications: [job.department?.label, job.experienceLevel?.label].filter(
      (v): v is string => Boolean(v),
    ),
    remote: job.location?.remote ?? false,
    requirements: [],
    responsibilities: [],
    source: 'SmartRecruiters',
    title,
    userId,
    workFromHome: job.location?.remote ?? false,
  };
};

async function runSmartRecruitersBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  insertAnyway,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_SMARTRECRUITERS_BOARDS.length; i++) {
    const board = TOP_SMARTRECRUITERS_BOARDS[i];
    await broadcastProgress(userId, {
      scrapeId,
      provider: 'smartrecruiters-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_SMARTRECRUITERS_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `SmartRecruiters: fetching ${board} (${i + 1}/${TOP_SMARTRECRUITERS_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      // SmartRecruiters paginates — fetch up to 100 per page, up to 10 pages
      let offset = 0;
      const limit = 100;
      for (let page = 0; page < 10; page++) {
        const response = await resilientFetch(
          `${SMARTRECRUITERS_API}/${board}/postings?limit=${limit}&offset=${offset}`,
          {
            cache: 'no-store',
            retryPolicy: 'public-api',
            headers: { Accept: 'application/json' },
          },
        );
        apiRequests++;
        if (!response.ok) break;

        const data = (await response.json()) as {
          content?: SmartRecruitersJob[];
          totalFound?: number;
        };
        let jobs = data.content ?? [];
        if (jobs.length === 0) break;

        if (searchLower)
          jobs = jobs.filter(j =>
            (j.name ?? '').toLowerCase().includes(searchLower),
          );

        const listings = jobs
          .map(j => buildSmartRecruitersListing(userId, j, board))
          .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

        if (listings.length > 0) {
          const result = await persistListings({
            userId,
            listings,
            updateExisting: mode === 'sync',
          });
          totalFetched += jobs.length;
          totalCreated += result.created;
          totalUpdated += result.updated;
          totalSkipped += result.skipped;
          if (result.recentCreatedListings.length > 0)
            recentCreatedListings = result.recentCreatedListings;
          if (result.recentUpdatedListings.length > 0)
            recentUpdatedListings = result.recentUpdatedListings;
        }

        offset += limit;
        if ((data.content ?? []).length < limit) break;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'smartrecruiters-boards',
    mode,
    status: 'complete',
    currentPage: TOP_SMARTRECRUITERS_BOARDS.length,
    totalPages: TOP_SMARTRECRUITERS_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `SmartRecruiters: ${TOP_SMARTRECRUITERS_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    metadata: { boards: TOP_SMARTRECRUITERS_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Recruitee Boards bulk scraper
// ---------------------------------------------------------------------------

interface RecruiteeOffer {
  careers_apply_url?: string;
  careers_url?: string;
  city?: string | null;
  company_name?: string | null;
  country?: string | null;
  department?: string | null;
  description?: string | null;
  employment_type_code?: string | null;
  guid?: string | null;
  hybrid?: boolean;
  id?: number | string;
  location?: string | null;
  published_at?: string | null;
  remote?: boolean;
  salary?: {
    currency?: string | null;
    max?: number | null;
    min?: number | null;
    period?: string | null;
  } | null;
  state_name?: string | null;
  tags?: string[];
  title?: string | null;
  translations?: Record<string, { description?: string | null }>;
}

const formatRecruiteeSalary = (salary?: RecruiteeOffer['salary']) => {
  if (!salary) return undefined;
  const currency = salary.currency || 'USD';
  const suffix = salary.period ? `/${salary.period}` : '';
  if (typeof salary.min === 'number' && typeof salary.max === 'number') {
    return `${currency} ${salary.min.toLocaleString()} - ${salary.max.toLocaleString()}${suffix}`;
  }
  if (typeof salary.min === 'number') {
    return `${currency} ${salary.min.toLocaleString()}+${suffix}`;
  }
  if (typeof salary.max === 'number') {
    return `Up to ${currency} ${salary.max.toLocaleString()}${suffix}`;
  }
  return undefined;
};

const buildRecruiteeLocation = (offer: RecruiteeOffer): string => {
  const parts = [offer.city, offer.state_name, offer.country]
    .map(value => toNullableString(value))
    .filter((value): value is string => Boolean(value));
  return toNullableString(offer.location) ?? (parts.join(', ') || 'Unknown');
};

const buildRecruiteeBoardListing = (
  userId: string,
  offer: RecruiteeOffer,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl =
    toNullableString(offer.careers_apply_url) ??
    toNullableString(offer.careers_url);
  const title = toNullableString(offer.title);
  if (!applyUrl || !title) return null;

  const location = buildRecruiteeLocation(offer);
  const description =
    toNullableString(offer.translations?.en?.description) ??
    toNullableString(offer.description);
  const remote =
    Boolean(offer.remote) ||
    location.toLowerCase().includes('remote') ||
    hasRemoteTextSignal(offer.title, description);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: toNullableString(offer.company_name) ?? board,
    description: extractHtmlText(description),
    jobId: `recruitee-${board}-${offer.id ?? offer.guid ?? applyUrl}`,
    jobProvider: JobProvider.RECRUITEE,
    jobProviderUrl: applyUrl,
    jobType: mapScheduleTypeToJobType(offer.employment_type_code ?? undefined),
    location,
    postedAt: toPrismaDate(offer.published_at),
    qualifications: [offer.department, ...(offer.tags ?? [])].filter(
      (value): value is string => Boolean(value),
    ),
    remote,
    requirements: [],
    responsibilities: [],
    salary: formatRecruiteeSalary(offer.salary),
    source: 'Recruitee',
    title,
    userId,
    workFromHome: remote,
  };
};

async function runRecruiteeBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');
  const locationLower = insertAnyway
    ? ''
    : (location?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_RECRUITEE_BOARDS.length; i++) {
    const board = TOP_RECRUITEE_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'recruitee-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_RECRUITEE_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Recruitee: fetching ${board} (${i + 1}/${TOP_RECRUITEE_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `https://${board}.recruitee.com/api/offers`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests += 1;
      if (!response.ok) continue;

      const data = (await response.json()) as { offers?: RecruiteeOffer[] };
      let offers = data.offers ?? [];
      if (searchLower) {
        offers = offers.filter(offer =>
          [
            offer.title,
            offer.company_name,
            offer.department,
            offer.description,
            offer.translations?.en?.description,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower),
        );
      }
      if (locationLower) {
        offers = offers.filter(offer =>
          buildRecruiteeLocation(offer).toLowerCase().includes(locationLower),
        );
      }
      if (!insertAnyway && remote) {
        offers = offers.filter(offer => {
          const offerLocation = buildRecruiteeLocation(offer).toLowerCase();
          return (
            Boolean(offer.remote) ||
            offerLocation.includes('remote') ||
            hasRemoteTextSignal(
              offer.title,
              offer.translations?.en?.description,
              offer.description,
            )
          );
        });
      }

      totalFetched += offers.length;
      const listings = offers
        .map(offer => buildRecruiteeBoardListing(userId, offer, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length === 0) continue;

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'recruitee-boards',
    mode,
    status: 'complete',
    currentPage: TOP_RECRUITEE_BOARDS.length,
    totalPages: TOP_RECRUITEE_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Recruitee Boards: ${TOP_RECRUITEE_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { boards: TOP_RECRUITEE_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Workable Boards bulk scraper
// (public widget API: https://apply.workable.com/api/v3/accounts/{slug}/jobs)
// ---------------------------------------------------------------------------

interface WorkableJob {
  account?: { name?: string | null; subdomain?: string | null };
  application_url?: string | null;
  code?: string | null;
  created_at?: string | null;
  department?: string | null;
  description?: string | null;
  employment_type?: string | null;
  full_title?: string | null;
  language?: string | null;
  location?: {
    city?: string | null;
    country?: string | null;
    region?: string | null;
    workplace_type?: string | null;
  } | null;
  published?: string | null;
  shortcode?: string | null;
  state?: string | null;
  telecommuting?: boolean | null;
  title?: string | null;
  url?: string | null;
}

const buildWorkableLocation = (job: WorkableJob): string => {
  const parts = [
    job.location?.city,
    job.location?.region,
    job.location?.country,
  ]
    .map(value => toNullableString(value))
    .filter((value): value is string => Boolean(value));
  return parts.join(', ') || 'Unknown';
};

const buildWorkableBoardListing = (
  userId: string,
  job: WorkableJob,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const shortcode = toNullableString(job.shortcode);
  const applyUrl =
    toNullableString(job.application_url) ??
    toNullableString(job.url) ??
    (shortcode ? `https://apply.workable.com/${board}/j/${shortcode}/` : null);
  const title = toNullableString(job.title) ?? toNullableString(job.full_title);
  if (!applyUrl || !title) return null;

  const location = buildWorkableLocation(job);
  const isRemote =
    job.telecommuting === true ||
    (job.location?.workplace_type ?? '').toLowerCase() === 'remote' ||
    location.toLowerCase().includes('remote');

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company:
      toNullableString(job.account?.name) ??
      board.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: toNullableString(job.description) ?? undefined,
    jobId: `wkb-${board}-${shortcode ?? job.code ?? applyUrl}`,
    jobProvider: JobProvider.WORKABLE,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.published ?? job.created_at),
    qualifications: job.department ? [job.department] : [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'Workable',
    title,
    userId,
    workFromHome: isRemote,
  };
};

async function runWorkableBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = searchTerm?.trim().toLowerCase() ?? '';
  const locationLower = location?.trim().toLowerCase() ?? '';

  for (let i = 0; i < TOP_WORKABLE_BOARDS.length; i++) {
    const board = TOP_WORKABLE_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'workable-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_WORKABLE_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Workable: fetching ${board} (${i + 1}/${TOP_WORKABLE_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `https://apply.workable.com/api/v3/accounts/${board}/jobs?state=published&limit=200`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests += 1;
      if (!response.ok) continue;

      const data = (await response.json()) as { results?: WorkableJob[] };
      let jobs = data.results ?? [];
      if (searchLower && !insertAnyway) {
        jobs = jobs.filter(job =>
          [job.title, job.full_title, job.department, job.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower),
        );
      }
      if (locationLower) {
        jobs = jobs.filter(job =>
          buildWorkableLocation(job).toLowerCase().includes(locationLower),
        );
      }
      if (remote) {
        jobs = jobs.filter(job => {
          const jobLocation = buildWorkableLocation(job).toLowerCase();
          return (
            job.telecommuting === true ||
            (job.location?.workplace_type ?? '').toLowerCase() === 'remote' ||
            jobLocation.includes('remote') ||
            hasRemoteTextSignal(job.title, job.description)
          );
        });
      }

      totalFetched += jobs.length;
      const listings = jobs
        .map(job => buildWorkableBoardListing(userId, job, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length === 0) continue;

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'workable-boards',
    mode,
    status: 'complete',
    currentPage: TOP_WORKABLE_BOARDS.length,
    totalPages: TOP_WORKABLE_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Workable Boards: ${TOP_WORKABLE_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { boards: TOP_WORKABLE_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Teamtailor Boards bulk scraper
// (public site JSON: https://career.{slug}.teamtailor.com/jobs.json)
// ---------------------------------------------------------------------------

interface TeamtailorJob {
  apply_url?: string | null;
  body?: string | null;
  career_url?: string | null;
  created_at?: string | null;
  department?: { name?: string | null } | null;
  human_status?: string | null;
  id?: number | string | null;
  location?: { city?: string | null; name?: string | null } | null;
  pinned?: boolean;
  remote_status?: string | null;
  team?: { name?: string | null } | null;
  title?: string | null;
}

const buildTeamtailorLocation = (job: TeamtailorJob): string => {
  return (
    toNullableString(job.location?.name) ??
    toNullableString(job.location?.city) ??
    'Unknown'
  );
};

const buildTeamtailorBoardListing = (
  userId: string,
  job: TeamtailorJob,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const id = job.id != null ? String(job.id) : null;
  const applyUrl =
    toNullableString(job.apply_url) ??
    toNullableString(job.career_url) ??
    (id ? `https://career.${board}.teamtailor.com/jobs/${id}` : null);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  const location = buildTeamtailorLocation(job);
  const remoteStatus = (job.remote_status ?? '').toLowerCase();
  const isRemote =
    remoteStatus.includes('remote') ||
    remoteStatus === 'fully' ||
    location.toLowerCase().includes('remote');

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: board.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: toNullableString(job.body) ?? undefined,
    jobId: `tt-${board}-${id ?? applyUrl}`,
    jobProvider: JobProvider.TEAMTAILOR,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.created_at),
    qualifications: [
      toNullableString(job.department?.name),
      toNullableString(job.team?.name),
    ].filter((value): value is string => Boolean(value)),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'Teamtailor',
    title,
    userId,
    workFromHome: isRemote,
  };
};

async function runTeamtailorBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');
  const locationLower = insertAnyway
    ? ''
    : (location?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_TEAMTAILOR_BOARDS.length; i++) {
    const board = TOP_TEAMTAILOR_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'teamtailor-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_TEAMTAILOR_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Teamtailor: fetching ${board} (${i + 1}/${TOP_TEAMTAILOR_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `https://career.${board}.teamtailor.com/jobs.json`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests += 1;
      if (!response.ok) continue;

      const data = (await response.json()) as
        | { jobs?: TeamtailorJob[] }
        | TeamtailorJob[];
      let jobs = Array.isArray(data) ? data : (data.jobs ?? []);
      if (searchLower) {
        jobs = jobs.filter(job =>
          [job.title, job.department?.name, job.team?.name, job.body]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower),
        );
      }
      if (locationLower) {
        jobs = jobs.filter(job =>
          buildTeamtailorLocation(job).toLowerCase().includes(locationLower),
        );
      }
      if (!insertAnyway && remote) {
        jobs = jobs.filter(job => {
          const remoteStatus = (job.remote_status ?? '').toLowerCase();
          const jobLocation = buildTeamtailorLocation(job).toLowerCase();
          return (
            remoteStatus.includes('remote') ||
            remoteStatus === 'fully' ||
            jobLocation.includes('remote') ||
            hasRemoteTextSignal(job.title, job.body)
          );
        });
      }

      totalFetched += jobs.length;
      const listings = jobs
        .map(job => buildTeamtailorBoardListing(userId, job, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length === 0) continue;

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'teamtailor-boards',
    mode,
    status: 'complete',
    currentPage: TOP_TEAMTAILOR_BOARDS.length,
    totalPages: TOP_TEAMTAILOR_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Teamtailor Boards: ${TOP_TEAMTAILOR_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { boards: TOP_TEAMTAILOR_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// BambooHR Boards bulk scraper
// (public careers list: https://{slug}.bamboohr.com/careers/list)
// ---------------------------------------------------------------------------

interface BambooHRJob {
  atsCategory?: { label?: string | null } | null;
  dateUpdated?: string | null;
  departmentLabel?: string | null;
  departmentLevel?: string | null;
  description?: string | null;
  employmentStatusLabel?: string | null;
  id?: number | string | null;
  jobOpeningName?: string | null;
  jobOpeningStatus?: string | null;
  location?: {
    city?: string | null;
    country?: string | null;
    state?: string | null;
  } | null;
  locationCity?: string | null;
  locationCountry?: string | null;
  locationState?: string | null;
  remoteIsAllowed?: boolean | null;
}

const buildBambooHRLocation = (job: BambooHRJob): string => {
  const parts = [
    job.locationCity ?? job.location?.city,
    job.locationState ?? job.location?.state,
    job.locationCountry ?? job.location?.country,
  ]
    .map(value => toNullableString(value))
    .filter((value): value is string => Boolean(value));
  return parts.join(', ') || 'Unknown';
};

const buildBambooHRBoardListing = (
  userId: string,
  job: BambooHRJob,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const id = job.id != null ? String(job.id) : null;
  if (!id) return null;
  const applyUrl = `https://${board}.bamboohr.com/careers/${id}`;
  const title = toNullableString(job.jobOpeningName);
  if (!title) return null;

  const location = buildBambooHRLocation(job);
  const isRemote =
    job.remoteIsAllowed === true || location.toLowerCase().includes('remote');

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: board.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: toNullableString(job.description) ?? undefined,
    jobId: `bh-${board}-${id}`,
    jobProvider: JobProvider.BAMBOOHR,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.dateUpdated),
    qualifications: [
      toNullableString(job.departmentLabel),
      toNullableString(job.atsCategory?.label),
    ].filter((value): value is string => Boolean(value)),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'BambooHR',
    title,
    userId,
    workFromHome: isRemote,
  };
};

async function runBambooHRBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');
  const locationLower = insertAnyway
    ? ''
    : (location?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_BAMBOOHR_BOARDS.length; i++) {
    const board = TOP_BAMBOOHR_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'bamboohr-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_BAMBOOHR_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `BambooHR: fetching ${board} (${i + 1}/${TOP_BAMBOOHR_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `https://${board}.bamboohr.com/careers/list`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests += 1;
      if (!response.ok) continue;

      const data = (await response.json()) as { result?: BambooHRJob[] };
      let jobs = data.result ?? [];
      if (searchLower) {
        jobs = jobs.filter(job =>
          [
            job.jobOpeningName,
            job.departmentLabel,
            job.atsCategory?.label,
            job.description,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower),
        );
      }
      if (locationLower) {
        jobs = jobs.filter(job =>
          buildBambooHRLocation(job).toLowerCase().includes(locationLower),
        );
      }
      if (!insertAnyway && remote) {
        jobs = jobs.filter(job => {
          const jobLocation = buildBambooHRLocation(job).toLowerCase();
          return (
            job.remoteIsAllowed === true ||
            jobLocation.includes('remote') ||
            hasRemoteTextSignal(job.jobOpeningName, job.description)
          );
        });
      }

      totalFetched += jobs.length;
      const listings = jobs
        .map(job => buildBambooHRBoardListing(userId, job, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length === 0) continue;

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'bamboohr-boards',
    mode,
    status: 'complete',
    currentPage: TOP_BAMBOOHR_BOARDS.length,
    totalPages: TOP_BAMBOOHR_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `BambooHR Boards: ${TOP_BAMBOOHR_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { boards: TOP_BAMBOOHR_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Personio Boards bulk scraper
// (public XML feed: https://{slug}.jobs.personio.com/xml?language=en)
// ---------------------------------------------------------------------------

interface PersonioParsedJob {
  city: string | null;
  country: string | null;
  createdAt: string | null;
  department: string | null;
  description: string | null;
  id: string | null;
  name: string | null;
  office: string | null;
  recruitingCategory: string | null;
  schedule: string | null;
  subcompany: string | null;
}

const parsePersonioXml = (xml: string): PersonioParsedJob[] => {
  const $ = load(xml, { xmlMode: true });
  const jobs: PersonioParsedJob[] = [];
  $('position').each((_index, element) => {
    const node = $(element);
    const text = (selector: string): string | null => {
      const value = node.find(selector).first().text().trim();
      return value || null;
    };
    jobs.push({
      city: text('office'),
      country: null,
      createdAt: text('createdAt'),
      department: text('department'),
      description: node.find('jobDescriptions').text().trim() || null,
      id: text('id'),
      name: text('name'),
      office: text('office'),
      recruitingCategory: text('recruitingCategory'),
      schedule: text('schedule'),
      subcompany: text('subcompany'),
    });
  });
  return jobs;
};

const buildPersonioLocation = (job: PersonioParsedJob): string => {
  const parts = [job.office, job.city, job.country]
    .map(value => toNullableString(value))
    .filter((value): value is string => Boolean(value));
  return parts.join(', ') || 'Unknown';
};

const buildPersonioBoardListing = (
  userId: string,
  job: PersonioParsedJob,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const id = toNullableString(job.id);
  if (!id) return null;
  const applyUrl = `https://${board}.jobs.personio.com/job/${id}`;
  const title = toNullableString(job.name);
  if (!title) return null;

  const location = buildPersonioLocation(job);
  const isRemote = location.toLowerCase().includes('remote');

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company:
      toNullableString(job.subcompany) ??
      board.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: toNullableString(job.description) ?? undefined,
    jobId: `pn-${board}-${id}`,
    jobProvider: JobProvider.PERSONIO,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.createdAt),
    qualifications: [
      toNullableString(job.department),
      toNullableString(job.recruitingCategory),
    ].filter((value): value is string => Boolean(value)),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'Personio',
    title,
    userId,
    workFromHome: isRemote,
  };
};

async function runPersonioBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');
  const locationLower = insertAnyway
    ? ''
    : (location?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_PERSONIO_BOARDS.length; i++) {
    const board = TOP_PERSONIO_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'personio-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_PERSONIO_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Personio: fetching ${board} (${i + 1}/${TOP_PERSONIO_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `https://${board}.jobs.personio.com/xml?language=en`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/xml,text/xml,*/*' },
        },
      );
      apiRequests += 1;
      if (!response.ok) continue;

      const xml = await response.text();
      let jobs = parsePersonioXml(xml);

      if (searchLower) {
        jobs = jobs.filter(job =>
          [job.name, job.department, job.recruitingCategory, job.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower),
        );
      }
      if (locationLower) {
        jobs = jobs.filter(job =>
          buildPersonioLocation(job).toLowerCase().includes(locationLower),
        );
      }
      if (!insertAnyway && remote) {
        jobs = jobs.filter(job => {
          const jobLocation = buildPersonioLocation(job).toLowerCase();
          return (
            jobLocation.includes('remote') ||
            hasRemoteTextSignal(job.name, job.description)
          );
        });
      }

      totalFetched += jobs.length;
      const listings = jobs
        .map(job => buildPersonioBoardListing(userId, job, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length === 0) continue;

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'personio-boards',
    mode,
    status: 'complete',
    currentPage: TOP_PERSONIO_BOARDS.length,
    totalPages: TOP_PERSONIO_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Personio Boards: ${TOP_PERSONIO_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { boards: TOP_PERSONIO_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Pallet Boards bulk scraper
// (public job board JSON: https://{slug}.pallet.com/api/v1/jobs)
// ---------------------------------------------------------------------------

interface PalletJob {
  apply_url?: string | null;
  city?: string | null;
  company?: { name?: string | null } | null;
  company_name?: string | null;
  country?: string | null;
  created_at?: string | null;
  department?: string | null;
  description?: string | null;
  id?: number | string | null;
  is_remote?: boolean | null;
  location?: string | null;
  remote?: boolean | null;
  slug?: string | null;
  title?: string | null;
  url?: string | null;
}

const buildPalletLocation = (job: PalletJob): string => {
  const direct = toNullableString(job.location);
  if (direct) return direct;
  const parts = [job.city, job.country]
    .map(value => toNullableString(value))
    .filter((value): value is string => Boolean(value));
  return parts.join(', ') || 'Unknown';
};

const buildPalletBoardListing = (
  userId: string,
  job: PalletJob,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const id = job.id != null ? String(job.id) : null;
  const slug = toNullableString(job.slug);
  const applyUrl =
    toNullableString(job.apply_url) ??
    toNullableString(job.url) ??
    (slug ? `https://${board}.pallet.com/jobs/${slug}` : null);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  const location = buildPalletLocation(job);
  const isRemote =
    job.is_remote === true ||
    job.remote === true ||
    location.toLowerCase().includes('remote');

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company:
      toNullableString(job.company?.name) ??
      toNullableString(job.company_name) ??
      board.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: toNullableString(job.description) ?? undefined,
    jobId: `pl-${board}-${id ?? slug ?? applyUrl}`,
    jobProvider: JobProvider.PALLET,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.created_at),
    qualifications: job.department ? [job.department] : [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'Pallet',
    title,
    userId,
    workFromHome: isRemote,
  };
};

async function runPalletBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  insertAnyway,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = insertAnyway
    ? ''
    : (searchTerm?.trim().toLowerCase() ?? '');
  const locationLower = insertAnyway
    ? ''
    : (location?.trim().toLowerCase() ?? '');

  for (let i = 0; i < TOP_PALLET_BOARDS.length; i++) {
    const board = TOP_PALLET_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'pallet-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_PALLET_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Pallet: fetching ${board} (${i + 1}/${TOP_PALLET_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `https://${board}.pallet.com/api/v1/jobs`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests += 1;
      if (!response.ok) continue;

      const data = (await response.json()) as
        | { data?: PalletJob[]; jobs?: PalletJob[] }
        | PalletJob[];
      let jobs = Array.isArray(data) ? data : (data.jobs ?? data.data ?? []);

      if (searchLower) {
        jobs = jobs.filter(job =>
          [job.title, job.company?.name, job.department, job.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower),
        );
      }
      if (locationLower) {
        jobs = jobs.filter(job =>
          buildPalletLocation(job).toLowerCase().includes(locationLower),
        );
      }
      if (!insertAnyway && remote) {
        jobs = jobs.filter(job => {
          const jobLocation = buildPalletLocation(job).toLowerCase();
          return (
            job.is_remote === true ||
            job.remote === true ||
            jobLocation.includes('remote') ||
            hasRemoteTextSignal(job.title, job.description)
          );
        });
      }

      totalFetched += jobs.length;
      const listings = jobs
        .map(job => buildPalletBoardListing(userId, job, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length === 0) continue;

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'pallet-boards',
    mode,
    status: 'complete',
    currentPage: TOP_PALLET_BOARDS.length,
    totalPages: TOP_PALLET_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Pallet Boards: ${TOP_PALLET_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { boards: TOP_PALLET_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// Pinpoint Boards bulk scraper
// (public board JSON: https://{slug}.pinpointhq.com/jobs.json)
// ---------------------------------------------------------------------------

interface PinpointJob {
  apply_url?: string | null;
  created_at?: string | null;
  department?: string | { name?: string | null } | null;
  description?: string | null;
  employment_type?: string | null;
  id?: number | string | null;
  location?:
    | string
    | {
        city?: string | null;
        country?: string | null;
        name?: string | null;
        region?: string | null;
      }
    | null;
  remote?: boolean | null;
  team?: { name?: string | null } | null;
  title?: string | null;
  url?: string | null;
}

const buildPinpointLocation = (job: PinpointJob): string => {
  if (typeof job.location === 'string') {
    return toNullableString(job.location) ?? 'Unknown';
  }
  const loc = job.location;
  if (!loc) return 'Unknown';
  const direct = toNullableString(loc.name);
  if (direct) return direct;
  const parts = [loc.city, loc.region, loc.country]
    .map(value => toNullableString(value))
    .filter((value): value is string => Boolean(value));
  return parts.join(', ') || 'Unknown';
};

const buildPinpointBoardListing = (
  userId: string,
  job: PinpointJob,
  board: string,
): Prisma.JobListingCreateManyInput | null => {
  const id = job.id != null ? String(job.id) : null;
  const applyUrl =
    toNullableString(job.apply_url) ??
    toNullableString(job.url) ??
    (id ? `https://${board}.pinpointhq.com/jobs/${id}` : null);
  const title = toNullableString(job.title);
  if (!applyUrl || !title) return null;

  const location = buildPinpointLocation(job);
  const isRemote =
    job.remote === true || location.toLowerCase().includes('remote');
  const departmentName =
    typeof job.department === 'string'
      ? job.department
      : (job.department?.name ?? null);

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: board.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    description: toNullableString(job.description) ?? undefined,
    jobId: `pp-${board}-${id ?? applyUrl}`,
    jobProvider: JobProvider.PINPOINT,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.created_at),
    qualifications: [
      toNullableString(departmentName),
      toNullableString(job.team?.name),
    ].filter((value): value is string => Boolean(value)),
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'Pinpoint',
    title,
    userId,
    workFromHome: isRemote,
  };
};

async function runPinpointBoardsScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = searchTerm?.trim().toLowerCase() ?? '';
  const locationLower = location?.trim().toLowerCase() ?? '';

  for (let i = 0; i < TOP_PINPOINT_BOARDS.length; i++) {
    const board = TOP_PINPOINT_BOARDS[i];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'pinpoint-boards',
      mode,
      status: 'fetching',
      currentPage: i + 1,
      totalPages: TOP_PINPOINT_BOARDS.length,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `Pinpoint: fetching ${board} (${i + 1}/${TOP_PINPOINT_BOARDS.length})...`,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    try {
      const response = await resilientFetch(
        `https://${board}.pinpointhq.com/jobs.json`,
        {
          cache: 'no-store',
          retryPolicy: 'public-api',
          headers: { Accept: 'application/json' },
        },
      );
      apiRequests += 1;
      if (!response.ok) continue;

      const data = (await response.json()) as
        | { data?: PinpointJob[]; jobs?: PinpointJob[] }
        | PinpointJob[];
      let jobs = Array.isArray(data) ? data : (data.jobs ?? data.data ?? []);

      if (searchLower) {
        jobs = jobs.filter(job => {
          const departmentName =
            typeof job.department === 'string'
              ? job.department
              : (job.department?.name ?? '');
          return [job.title, departmentName, job.team?.name, job.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower);
        });
      }
      if (locationLower) {
        jobs = jobs.filter(job =>
          buildPinpointLocation(job).toLowerCase().includes(locationLower),
        );
      }
      if (remote) {
        jobs = jobs.filter(job => {
          const jobLocation = buildPinpointLocation(job).toLowerCase();
          return (
            job.remote === true ||
            jobLocation.includes('remote') ||
            hasRemoteTextSignal(job.title, job.description)
          );
        });
      }

      totalFetched += jobs.length;
      const listings = jobs
        .map(job => buildPinpointBoardListing(userId, job, board))
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length === 0) continue;

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      if (result.recentCreatedListings.length > 0) {
        recentCreatedListings = result.recentCreatedListings;
      }
      if (result.recentUpdatedListings.length > 0) {
        recentUpdatedListings = result.recentUpdatedListings;
      }
    } catch {
      continue;
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'pinpoint-boards',
    mode,
    status: 'complete',
    currentPage: TOP_PINPOINT_BOARDS.length,
    totalPages: TOP_PINPOINT_BOARDS.length,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Pinpoint Boards: ${TOP_PINPOINT_BOARDS.length} companies, ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
    metadata: { boards: TOP_PINPOINT_BOARDS.length },
  };
}

// ---------------------------------------------------------------------------
// CrunchBoard scraper (single RSS feed)
// ---------------------------------------------------------------------------

interface CrunchboardRssItem {
  description: string | null;
  link: string | null;
  pubDate: string | null;
  title: string | null;
}

const parseCrunchboardRss = (xml: string): CrunchboardRssItem[] => {
  const $ = load(xml, { xmlMode: true });
  const items: CrunchboardRssItem[] = [];
  $('item').each((_index, element) => {
    const node = $(element);
    items.push({
      description: node.find('description').first().text().trim() || null,
      link: node.find('link').first().text().trim() || null,
      pubDate: node.find('pubDate').first().text().trim() || null,
      title: node.find('title').first().text().trim() || null,
    });
  });
  return items;
};

const stripHtmlTags = (input: string | null): string | null => {
  if (!input) return null;
  const $ = load(`<root>${input}</root>`);
  return $.root().text().trim() || null;
};

async function runCrunchboardScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  remote?: boolean;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  const searchLower = searchTerm?.trim().toLowerCase() ?? '';
  const locationLower = location?.trim().toLowerCase() ?? '';

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'crunchboard',
    mode,
    status: 'fetching',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: 0,
    jobsCreated: 0,
    jobsUpdated: 0,
    jobsSkipped: 0,
    message: 'CrunchBoard: fetching feed…',
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  try {
    const response = await resilientFetch(CRUNCHBOARD_FEED_URL, {
      cache: 'no-store',
      retryPolicy: 'public-api',
      headers: { Accept: 'application/rss+xml, application/xml, text/xml' },
    });
    apiRequests += 1;
    if (response.ok) {
      const xml = await response.text();
      let items = parseCrunchboardRss(xml);

      if (searchLower) {
        items = items.filter(item =>
          [item.title, item.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(searchLower),
        );
      }
      if (locationLower) {
        items = items.filter(item =>
          [item.title, item.description]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(locationLower),
        );
      }
      if (remote) {
        items = items.filter(item =>
          hasRemoteTextSignal(item.title, item.description),
        );
      }

      totalFetched = items.length;
      const listings: Prisma.JobListingCreateManyInput[] = items
        .map((item, index): Prisma.JobListingCreateManyInput | null => {
          const title = toNullableString(item.title);
          const applyUrl = toNullableString(item.link);
          if (!title || !applyUrl) return null;
          const description = stripHtmlTags(item.description);
          const isRemote =
            hasRemoteTextSignal(title, description) ||
            (description ?? '').toLowerCase().includes('remote');
          return {
            applyOptions: {
              applyUrl,
            } satisfies Prisma.JsonObject as Prisma.JsonObject,
            benefits: [],
            company: 'CrunchBoard',
            description: description ?? undefined,
            jobId: `cb-${index}-${applyUrl}`,
            jobProvider: JobProvider.CRUNCHBOARD,
            jobProviderUrl: applyUrl,
            jobType: JobType.UNKNOWN,
            location: 'Unknown',
            postedAt: toPrismaDate(item.pubDate),
            qualifications: [],
            remote: isRemote,
            requirements: [],
            responsibilities: [],
            source: 'CrunchBoard',
            title,
            userId,
            workFromHome: isRemote,
          };
        })
        .filter(
          (listing): listing is Prisma.JobListingCreateManyInput =>
            listing !== null,
        );

      if (listings.length > 0) {
        const result = await persistListings({
          userId,
          listings,
          updateExisting: mode === 'sync',
        });
        totalCreated = result.created;
        totalUpdated = result.updated;
        totalSkipped = result.skipped;
        recentCreatedListings = result.recentCreatedListings;
        recentUpdatedListings = result.recentUpdatedListings;
      }
    }
  } catch {
    // swallow and report zero results below
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'crunchboard',
    mode,
    status: 'complete',
    currentPage: 1,
    totalPages: 1,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `CrunchBoard: ${totalFetched} jobs, created ${totalCreated}`,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    created: totalCreated,
    fetched: totalFetched,
    recentCreatedListings,
    recentUpdatedListings,
    skipped: totalSkipped,
    updated: totalUpdated,
  };
}

// ---------------------------------------------------------------------------
// LinkedIn Guest scraper (public, no auth, HTML parsing)
// ---------------------------------------------------------------------------

function parseLinkedInJobsHtml(html: string): Array<{
  company: string | null;
  date: string | null;
  link: string | null;
  location: string | null;
  title: string | null;
}> {
  const jobs: Array<{
    company: string | null;
    date: string | null;
    link: string | null;
    location: string | null;
    title: string | null;
  }> = [];

  const titleMatches =
    html.match(/base-search-card__title[^>]*>\s*([\s\S]*?)\s*</g) ?? [];
  const companyMatches =
    html.match(
      /base-search-card__subtitle[^>]*>\s*(?:<a[^>]*>)?\s*([\s\S]*?)\s*(?:<\/a>)?\s*</g,
    ) ?? [];
  const locationMatches =
    html.match(/job-search-card__location[^>]*>\s*([\s\S]*?)\s*</g) ?? [];
  const linkMatches =
    html.match(/href="(https:\/\/www\.linkedin\.com\/jobs\/view\/[^"?]+)/g) ??
    [];
  const dateMatches = html.match(/datetime="([^"]+)"/g) ?? [];

  const extractText = (match: string): string => {
    return match
      .replace(/<[^>]+>/g, '')
      .replace(/[^>]*>\s*/, '')
      .replace(/\s*$/, '')
      .trim();
  };

  const count = Math.max(titleMatches.length, linkMatches.length);
  for (let i = 0; i < count; i++) {
    jobs.push({
      company: companyMatches[i]
        ? extractText(companyMatches[i])
            .replace(/<[^>]*>/g, '')
            .trim()
        : null,
      date: dateMatches[i]
        ? dateMatches[i].replace(/datetime="/, '').replace(/"/, '')
        : null,
      link: linkMatches[i] ? linkMatches[i].replace(/href="/, '') : null,
      location: locationMatches[i] ? extractText(locationMatches[i]) : null,
      title: titleMatches[i] ? extractText(titleMatches[i]) : null,
    });
  }

  return jobs;
}

const buildLinkedInGuestListing = (
  userId: string,
  job: {
    company: string | null;
    date: string | null;
    link: string | null;
    location: string | null;
    title: string | null;
  },
): Prisma.JobListingCreateManyInput | null => {
  const applyUrl = job.link;
  const title = job.title?.trim();
  if (!applyUrl || !title) return null;

  const location = job.location?.trim() || 'United States';
  const isRemote = location.toLowerCase().includes('remote');

  // Extract a stable ID from the URL (linkedin job ID at the end)
  const idMatch = applyUrl.match(/(\d+)$/);
  const jobId = idMatch ? `li-${idMatch[1]}` : `li-${applyUrl}`;

  return {
    applyOptions: { applyUrl } satisfies Prisma.JsonObject as Prisma.JsonObject,
    benefits: [],
    company: job.company?.trim() || null,
    jobId,
    jobProvider: JobProvider.LINKEDIN,
    jobProviderUrl: applyUrl,
    jobType: JobType.UNKNOWN,
    location,
    postedAt: toPrismaDate(job.date),
    qualifications: [],
    remote: isRemote,
    requirements: [],
    responsibilities: [],
    source: 'LinkedIn',
    title,
    userId,
    workFromHome: isRemote,
  };
};

async function runLinkedInGuestScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  postedWithin,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  remote?: boolean;
  insertAnyway?: boolean;
  postedWithin?: string;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, 40); // Cap at 400 jobs (40 pages × 10)
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let apiRequests = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  let latestDiagnostics: AdminScrapeProgressPayload['diagnostics'];
  let latestPersistBreakdown: AdminScrapePersistBreakdown | undefined;
  let completedPages = 0;
  let stopReason: string | undefined;

  const keywords = searchTerm?.trim() || 'software engineer';
  const loc = location?.trim() || 'United States';

  for (let page = 0; page < effectiveMaxPages; page++) {
    const start = page * LINKEDIN_JOBS_PER_PAGE;

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'linkedin-guest',
      mode,
      status: 'fetching',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `LinkedIn: fetching page ${page + 1}/${effectiveMaxPages} (offset ${start})...`,
      diagnostics: latestDiagnostics,
      persistBreakdown: latestPersistBreakdown,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    const params = new URLSearchParams({
      keywords,
      location: loc,
      start: String(start),
      f_TPR: (() => {
        const days = postedWithin ? Number(postedWithin) : 7;
        return `r${days * 86400}`;
      })(),
      ...(remote ? { f_WT: '2' } : {}), // Remote filter
    });

    const response = await resilientFetch(
      `${LINKEDIN_GUEST_API}?${params.toString()}`,
      {
        cache: 'no-store',
        retryPolicy: 'none', // Don't retry LinkedIn — they'll block
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          Accept: 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      },
    );
    apiRequests++;

    if (!response.ok) {
      if (response.status === 429) {
        await broadcastProgress(userId, {
          scrapeId,
          provider: 'linkedin-guest',
          mode,
          status: 'complete',
          currentPage: page + 1,
          totalPages: effectiveMaxPages,
          jobsFetched: totalFetched,
          jobsCreated: totalCreated,
          jobsUpdated: totalUpdated,
          jobsSkipped: totalSkipped,
          message: `LinkedIn: rate limited after ${page + 1} pages. Got ${totalFetched} jobs.`,
          diagnostics: latestDiagnostics,
          persistBreakdown: latestPersistBreakdown,
          startedAt,
          elapsed: Date.now() - new Date(startedAt).getTime(),
        });
        completedPages = page + 1;
        stopReason = `rate limited after ${page + 1} pages`;
        break;
      }
      throw new Error(`LinkedIn guest API failed: ${response.status}`);
    }

    const html = await response.text();
    const jobs = parseLinkedInJobsHtml(html);

    if (jobs.length === 0) {
      completedPages = page + 1;
      stopReason = `no jobs returned on page ${page + 1}`;
      break;
    }

    const listings = jobs
      .map(j => buildLinkedInGuestListing(userId, j))
      .filter((l): l is Prisma.JobListingCreateManyInput => l !== null);

    const result = await persistListings({
      userId,
      listings,
      updateExisting: mode === 'sync',
    });
    totalFetched += jobs.length;
    totalCreated += result.created;
    totalUpdated += result.updated;
    totalSkipped += result.skipped;
    completedPages = page + 1;
    latestPersistBreakdown = result.breakdown;
    latestDiagnostics = diagnosticsFromPersistBreakdown({
      breakdown: result.breakdown,
      skipped: result.skipped,
      updated: result.updated,
    });
    if (result.recentCreatedListings.length > 0)
      recentCreatedListings = result.recentCreatedListings;
    if (result.recentUpdatedListings.length > 0)
      recentUpdatedListings = result.recentUpdatedListings;

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'linkedin-guest',
      mode,
      status: 'persisting',
      currentPage: page + 1,
      totalPages: effectiveMaxPages,
      jobsFetched: totalFetched,
      jobsCreated: totalCreated,
      jobsUpdated: totalUpdated,
      jobsSkipped: totalSkipped,
      message: `LinkedIn page ${page + 1}: ${jobs.length} jobs, created ${result.created}${breakdownSuffix(result.breakdown)}`,
      diagnostics: latestDiagnostics,
      persistBreakdown: result.breakdown,
      recentCreatedListings,
      recentUpdatedListings,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    // Polite delay between pages to avoid rate limiting
    if (page < effectiveMaxPages - 1) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'linkedin-guest',
    mode,
    status: 'complete',
    currentPage: completedPages || effectiveMaxPages,
    totalPages: completedPages || effectiveMaxPages,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `LinkedIn complete: ${totalFetched} fetched, ${totalCreated} created, ${totalUpdated} updated${stopReason ? ` (${stopReason})` : ''}`,
    diagnostics: latestDiagnostics,
    persistBreakdown: latestPersistBreakdown,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    stopReason,
    metadata: { source: 'linkedin-guest' },
  };
}

// ---------------------------------------------------------------------------
// Indeed scraper (Playwright-based, renders JS)
// ---------------------------------------------------------------------------

async function runIndeedScrape({
  userId,
  scrapeId,
  mode,
  searchTerm,
  location,
  remote,
  postedWithin,
  maxPages,
  startedAt,
}: {
  userId: string;
  scrapeId: string;
  mode: ScrapeMode;
  searchTerm?: string;
  location?: string;
  remote?: boolean;
  insertAnyway?: boolean;
  postedWithin?: string;
  maxPages: number;
  startedAt: string;
}): Promise<ProviderRunResult> {
  const effectiveMaxPages = Math.min(maxPages, 20);
  let totalFetched = 0;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let recentCreatedListings: NonNullable<
    AdminScrapeProgressPayload['recentCreatedListings']
  > = [];
  let recentUpdatedListings: NonNullable<
    AdminScrapeProgressPayload['recentUpdatedListings']
  > = [];
  let latestDiagnostics: AdminScrapeProgressPayload['diagnostics'];
  let latestPersistBreakdown: AdminScrapePersistBreakdown | undefined;
  let completedPages = 0;
  let stopReason: string | undefined;

  const keywords = searchTerm?.trim() || 'software engineer';
  const loc = location?.trim() || 'United States';

  const chromium = await requireChromium('Admin scrape service');
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      viewport: { width: 1280, height: 900 },
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    const page = await context.newPage();

    for (let pageNum = 0; pageNum < effectiveMaxPages; pageNum++) {
      const start = pageNum * 10;

      await broadcastProgress(userId, {
        scrapeId,
        provider: 'indeed-scraper',
        mode,
        status: 'fetching',
        currentPage: pageNum + 1,
        totalPages: effectiveMaxPages,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsSkipped: totalSkipped,
        message: `Indeed: loading page ${pageNum + 1}/${effectiveMaxPages}...`,
        diagnostics: latestDiagnostics,
        persistBreakdown: latestPersistBreakdown,
        startedAt,
        elapsed: Date.now() - new Date(startedAt).getTime(),
      });

      const params = new URLSearchParams({
        q: keywords,
        l: loc,
        fromage: postedWithin || '7',
        start: String(start),
        ...(remote
          ? { remotejob: '032b3046-06a3-4876-8dfd-474eb5e7ed11' }
          : {}),
      });

      try {
        await page.goto(`https://www.indeed.com/jobs?${params.toString()}`, {
          waitUntil: 'domcontentloaded',
          timeout: 20000,
        });
        await page.waitForTimeout(3000);
      } catch {
        completedPages = pageNum + 1;
        stopReason = `page ${pageNum + 1} did not finish loading before timeout`;
        break;
      }

      // Extract job data from the page
      const jobs = await page.evaluate(() => {
        const cards = document.querySelectorAll('[data-jk]');
        return Array.from(cards).map(card => {
          const titleEl = card.querySelector(
            '.jobTitle span, h2.jobTitle span',
          );
          const companyEl = card.querySelector(
            '[data-testid="company-name"], .companyName',
          );
          const locationEl = card.querySelector(
            '[data-testid="text-location"], .companyLocation',
          );
          const linkEl = card.querySelector(
            'a.jcs-JobTitle, a[data-jk]',
          ) as HTMLAnchorElement;
          const dateEl = card.querySelector(
            '[data-testid="myJobsStateDate"], .date',
          );

          return {
            title: titleEl?.textContent?.trim() ?? null,
            company: companyEl?.textContent?.trim() ?? null,
            location: locationEl?.textContent?.trim() ?? null,
            link: linkEl?.href ?? null,
            date: dateEl?.textContent?.trim() ?? null,
            jobKey: card.getAttribute('data-jk') ?? null,
          };
        });
      });

      if (jobs.length === 0) {
        completedPages = pageNum + 1;
        stopReason = `no jobs returned on page ${pageNum + 1}`;
        break;
      }

      const listings: Prisma.JobListingCreateManyInput[] = [];
      for (const job of jobs) {
        if (!job.title || !job.link) continue;

        listings.push({
          applyOptions: {
            applyUrl: job.link,
          } satisfies Prisma.JsonObject as Prisma.JsonObject,
          benefits: [],
          company: job.company,
          jobId: `indeed-${job.jobKey ?? job.link}`,
          jobProvider: JobProvider.INDEED,
          jobProviderUrl: job.link,
          jobType: JobType.UNKNOWN,
          location: job.location || loc,
          postedAt: null,
          qualifications: [],
          remote: (job.location ?? '').toLowerCase().includes('remote'),
          requirements: [],
          responsibilities: [],
          source: 'Indeed',
          title: job.title,
          userId,
          workFromHome: (job.location ?? '').toLowerCase().includes('remote'),
        });
      }

      const result = await persistListings({
        userId,
        listings,
        updateExisting: mode === 'sync',
      });
      totalFetched += jobs.length;
      totalCreated += result.created;
      totalUpdated += result.updated;
      totalSkipped += result.skipped;
      completedPages = pageNum + 1;
      latestPersistBreakdown = result.breakdown;
      latestDiagnostics = diagnosticsFromPersistBreakdown({
        breakdown: result.breakdown,
        skipped: result.skipped,
        updated: result.updated,
      });
      if (result.recentCreatedListings.length > 0)
        recentCreatedListings = result.recentCreatedListings;
      if (result.recentUpdatedListings.length > 0)
        recentUpdatedListings = result.recentUpdatedListings;

      await broadcastProgress(userId, {
        scrapeId,
        provider: 'indeed-scraper',
        mode,
        status: 'persisting',
        currentPage: pageNum + 1,
        totalPages: effectiveMaxPages,
        jobsFetched: totalFetched,
        jobsCreated: totalCreated,
        jobsUpdated: totalUpdated,
        jobsSkipped: totalSkipped,
        message: `Indeed page ${pageNum + 1}: ${jobs.length} jobs, created ${result.created}${breakdownSuffix(result.breakdown)}`,
        diagnostics: latestDiagnostics,
        persistBreakdown: result.breakdown,
        recentCreatedListings,
        recentUpdatedListings,
        startedAt,
        elapsed: Date.now() - new Date(startedAt).getTime(),
      });

      // Polite delay
      if (pageNum < effectiveMaxPages - 1) {
        await page.waitForTimeout(3000);
      }
    }
  } finally {
    await browser.close().catch(() => {});
  }

  await broadcastProgress(userId, {
    scrapeId,
    provider: 'indeed-scraper',
    mode,
    status: 'complete',
    currentPage: completedPages || effectiveMaxPages,
    totalPages: completedPages || effectiveMaxPages,
    jobsFetched: totalFetched,
    jobsCreated: totalCreated,
    jobsUpdated: totalUpdated,
    jobsSkipped: totalSkipped,
    message: `Indeed complete: ${totalFetched} fetched, ${totalCreated} created, ${totalUpdated} updated${stopReason ? ` (${stopReason})` : ''}`,
    diagnostics: latestDiagnostics,
    persistBreakdown: latestPersistBreakdown,
    recentCreatedListings,
    recentUpdatedListings,
    startedAt,
    elapsed: Date.now() - new Date(startedAt).getTime(),
  });

  return {
    apiRequests: totalFetched > 0 ? Math.ceil(totalFetched / 25) : 1,
    fetched: totalFetched,
    created: totalCreated,
    recentCreatedListings,
    recentUpdatedListings,
    updated: totalUpdated,
    skipped: totalSkipped,
    stopReason,
    metadata: { source: 'indeed-playwright' },
  };
}

// ---------------------------------------------------------------------------
// Main orchestrator
// ---------------------------------------------------------------------------

export async function runAdminScrape(options: ScrapeOptions): Promise<void> {
  const scrapeId = options.scrapeId ?? `scrape-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const {
    userId,
    mode,
    providers,
    searchTerm,
    location,
    postedWithin,
    insertAnyway,
    remote,
    maxPages = 10,
    providerOverrides,
    trigger = 'manual',
  } = options;

  let sessionStatus: 'COMPLETE' | 'ERROR' | 'CANCELLED' = 'COMPLETE';
  let sessionSummary: Prisma.InputJsonValue | null = null;

  // Caller may have pre-created the ScrapeSession (and registered it) so the
  // POST handler can return the sessionId before the run starts. Otherwise
  // create one here so cron runs also show up in the replay history.
  if (!sessionLookup.has(scrapeId)) {
    try {
      const session = await db.scrapeSession.create({
        data: {
          globalMaxPages: maxPages,
          mode,
          providerOverrides: (providerOverrides ??
            Prisma.DbNull) as Prisma.InputJsonValue,
          providersRequested: providers,
          remote: Boolean(remote),
          scrapeId,
          searchTerm: searchTerm ?? null,
          trigger,
          userId,
        },
      });
      await registerScrapeSession(scrapeId, session.id);
    } catch (error) {
      console.error('Failed to create ScrapeSession:', error);
    }
  }

  try {
    await recordIngestionAuditLog({
      userId,
      action: 'ingestion_run_started',
      actionType: 'info',
      metadata: {
        ingestionLocation: INGESTION_LOCATION_FILTER,
        location: location ?? null,
        maxPages,
        mode,
        providerOverrides: providerOverrides ?? null,
        providers,
        insertAnyway: Boolean(insertAnyway),
        remote: Boolean(remote),
        scrapeId,
        searchTerm: searchTerm ?? null,
        startedAt,
        trigger,
      },
    });

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'all',
      mode,
      status: 'starting',
      currentPage: 0,
      totalPages: 0,
      jobsFetched: 0,
      jobsCreated: 0,
      jobsUpdated: 0,
      jobsSkipped: 0,
      message: `Starting ${mode} scrape for providers: ${providers.join(', ')}`,
      startedAt,
    });

    const results: {
      apiRequests: number;
      metadata?: Record<string, unknown>;
      provider: string;
      fetched: number;
      created: number;
      recentCreatedListings?: AdminScrapeProgressPayload['recentCreatedListings'];
      recentUpdatedListings?: AdminScrapeProgressPayload['recentUpdatedListings'];
      stopReason?: string;
      updated: number;
      skipped: number;
      error?: string;
    }[] = [];

    for (const provider of providers) {
      const providerOverride = providerOverrides?.[provider];
      const effectiveSearchTerm = providerOverride?.searchTerm ?? searchTerm;
      const effectiveLocation = providerOverride?.location ?? location;
      const effectivePostedWithin =
        providerOverride?.postedWithin ?? postedWithin;
      const effectiveInsertAnyway =
        providerOverride?.insertAnyway ?? insertAnyway;
      const effectiveRemote = providerOverride?.remote ?? remote;
      const effectiveMaxPages = providerOverride?.maxPages ?? maxPages;

      try {
        let result: ProviderRunResult;
        const atsProvider = ATS_PROVIDER_MAP[provider];

        if (atsProvider) {
          result = await runRegisteredAtsScraper({
            ats: atsProvider,
            context: {
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              insertAnyway: effectiveInsertAnyway,
              maxPages: effectiveMaxPages,
              startedAt,
            },
          });
        } else {
          switch (provider) {
          case 'careerbuilder':
            result = await runCareerBuilderScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'builtin':
            result = await runBuiltInScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'fantastic':
            result = await runFantasticScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'serpapi':
            result = await runSerpApiScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'themuse':
            result = await runTheMuseScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'welcometothejungle':
            result = await runWelcomeToTheJungleScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'usajobs':
            result = await runUsaJobsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'workatastartup':
            result = await runWorkAtAStartupScrape({
              userId,
              scrapeId,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              startedAt,
            });
            break;
          case 'weworkremotely':
            result = await runWeWorkRemotelyScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'remoteok':
            result = await runRemoteOkScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'jobicy':
            result = await runJobicyScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'remotive':
            result = await runRemotiveScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'himalayas':
            result = await runHimalayasScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'arbeitnow':
            result = await runArbeitnowScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'remotefirstjobs':
            result = await runRemoteFirstJobsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'remotejobs-org':
            result = await runRemoteJobsOrgScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'clawjobs':
            result = await runClawJobsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'comeet-boards':
            result = await runComeetBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'theirstack':
            result = await runTheirStackScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'jobdataapi':
            result = await runJobDataApiScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'findwork':
            result = await runFindworkScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'adzuna':
            result = await runAdzunaScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              insertAnyway: effectiveInsertAnyway,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'jooble':
            result = await runJoobleScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              insertAnyway: effectiveInsertAnyway,
              startedAt,
            });
            break;
          case 'devitjobs':
            result = await runDevITJobsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              insertAnyway: effectiveInsertAnyway,
              startedAt,
            });
            break;
          case 'workingnomads':
            result = await runWorkingNomadsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              insertAnyway: effectiveInsertAnyway,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'hackernews':
            result = await runHackerNewsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              insertAnyway: effectiveInsertAnyway,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'openjobs':
            result = await runOpenJobsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'nodesk':
            result = await runNoDeskScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'jobspresso':
            result = await runJobspressoScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'python-org':
            result = await runPythonOrgJobsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'django-job-board':
            result = await runDjangoJobBoardScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'smartrecruiters-boards':
            result = await runSmartRecruitersBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              maxPages: effectiveMaxPages,
              insertAnyway: effectiveInsertAnyway,
              startedAt,
            });
            break;
          case 'recruitee-boards':
            result = await runRecruiteeBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'workable-boards':
            result = await runWorkableBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'teamtailor-boards':
            result = await runTeamtailorBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'bamboohr-boards':
            result = await runBambooHRBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'personio-boards':
            result = await runPersonioBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'pallet-boards':
            result = await runPalletBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'pinpoint-boards':
            result = await runPinpointBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'workday-boards':
            result = await runWorkdayBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'breezy-boards':
            result = await runBreezyBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              insertAnyway: effectiveInsertAnyway,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'jobvite-boards':
            result = await runJobviteBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              startedAt,
            });
            break;
          case 'jazzhr-boards':
            result = await runJazzHrBoardsScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              startedAt,
            });
            break;
          case 'crunchboard':
            result = await runCrunchboardScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'linkedin-guest':
            result = await runLinkedInGuestScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              insertAnyway: effectiveInsertAnyway,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
          case 'indeed-scraper':
            result = await runIndeedScrape({
              userId,
              scrapeId,
              mode,
              searchTerm: effectiveSearchTerm,
              location: effectiveLocation,
              remote: effectiveRemote,
              insertAnyway: effectiveInsertAnyway,
              postedWithin: effectivePostedWithin,
              maxPages: effectiveMaxPages,
              startedAt,
            });
            break;
            default:
              continue;
          }
        }

        results.push({ provider, ...result });
        await recordIngestionAuditLog({
          userId,
          action: 'ingestion_provider_run',
          actionType: 'success',
          metadata: {
            ...result,
            ingestionLocation: INGESTION_LOCATION_FILTER,
            location: effectiveLocation ?? null,
            maxPages: effectiveMaxPages,
            mode,
            provider,
            providerOverride: providerOverride ?? null,
            insertAnyway: Boolean(effectiveInsertAnyway),
            remote: Boolean(effectiveRemote),
            scrapeId,
            searchTerm: effectiveSearchTerm ?? null,
            startedAt,
            trigger,
          },
        });
      } catch (error) {
        if (error instanceof ScrapeCancelledError) {
          // Scrape was cancelled by user — broadcast and stop all providers
          const cancelPayload = {
            scrapeId,
            provider: 'all' as const,
            mode,
            status: 'complete' as const,
            currentPage: 0,
            totalPages: 0,
            jobsFetched: 0,
            jobsCreated: 0,
            jobsUpdated: 0,
            jobsSkipped: 0,
            message: 'Scrape cancelled by user.',
            startedAt,
            elapsed: Date.now() - new Date(startedAt).getTime(),
          };
          await sendDataUpdate({
            channel: getPrivateUserChannel(userId),
            payload: {
              data: cancelPayload,
              type: DataEventType.ADMIN_SCRAPE_PROGRESS,
            },
          });
          await persistSessionEvent(scrapeId, 'PROGRESS', cancelPayload);
          sessionStatus = 'CANCELLED';
          sessionSummary = {
            cancelledAt: new Date().toISOString(),
            message: 'Scrape cancelled by user.',
            results,
          } as unknown as Prisma.InputJsonValue;
          return;
        }

        const message = error instanceof Error ? error.message : String(error);
        results.push({
          apiRequests: 0,
          provider,
          fetched: 0,
          created: 0,
          updated: 0,
          skipped: 0,
          error: message,
        });
        await recordIngestionAuditLog({
          userId,
          action: 'ingestion_provider_run',
          actionType: 'error',
          metadata: {
            error: message,
            ingestionLocation: INGESTION_LOCATION_FILTER,
            location: effectiveLocation ?? null,
            maxPages: effectiveMaxPages,
            mode,
            provider,
            providerOverride: providerOverride ?? null,
            remote: Boolean(effectiveRemote),
            scrapeId,
            searchTerm: effectiveSearchTerm ?? null,
            startedAt,
            trigger,
          },
        });

        await broadcastProgress(userId, {
          scrapeId,
          provider: provider as AdminScrapeProgressPayload['provider'],
          mode,
          status: 'error',
          currentPage: 0,
          totalPages: 0,
          jobsFetched: 0,
          jobsCreated: 0,
          jobsUpdated: 0,
          jobsSkipped: 0,
          message: `${provider} failed: ${message}`,
          error: message,
          startedAt,
          elapsed: Date.now() - new Date(startedAt).getTime(),
        });
      }
    }

    const totals = results.reduce(
      (acc, r) => ({
        apiRequests: acc.apiRequests + r.apiRequests,
        fetched: acc.fetched + r.fetched,
        created: acc.created + r.created,
        updated: acc.updated + r.updated,
        skipped: acc.skipped + r.skipped,
      }),
      { apiRequests: 0, fetched: 0, created: 0, updated: 0, skipped: 0 },
    );

    const errors = results.filter(r => r.error);
    const providerIssues = [
      ...errors.map(e => `${e.provider}: ${e.error}`),
      ...results
        .filter(r => !r.error && r.stopReason)
        .map(r => `${r.provider}: ${r.stopReason}`),
    ];

    await broadcastProgress(userId, {
      scrapeId,
      provider: 'all',
      mode,
      status: errors.length === results.length ? 'error' : 'complete',
      currentPage: 0,
      totalPages: 0,
      jobsFetched: totals.fetched,
      jobsCreated: totals.created,
      jobsUpdated: totals.updated,
      jobsSkipped: totals.skipped,
      message:
        providerIssues.length > 0
          ? `Scrape complete with ${providerIssues.length} provider issue${providerIssues.length === 1 ? '' : 's'}. ${totals.fetched.toLocaleString()} fetched, ${totals.created.toLocaleString()} created, ${totals.updated.toLocaleString()} updated, ${totals.skipped.toLocaleString()} skipped.`
          : `Scrape complete. ${totals.fetched.toLocaleString()} fetched, ${totals.created.toLocaleString()} created, ${totals.updated.toLocaleString()} updated, ${totals.skipped.toLocaleString()} skipped.`,
      error:
        errors.length > 0 && errors.length === results.length
          ? errors.map(e => `${e.provider}: ${e.error}`).join('; ')
          : undefined,
      diagnostics:
        providerIssues.length > 0
          ? { reasons: providerIssues }
          : undefined,
      startedAt,
      elapsed: Date.now() - new Date(startedAt).getTime(),
    });

    await recordIngestionAuditLog({
      userId,
      action: 'ingestion_run_completed',
      actionType: errors.length === results.length ? 'error' : 'success',
      metadata: {
        errors,
        ingestionLocation: INGESTION_LOCATION_FILTER,
        location: location ?? null,
        maxPages,
        mode,
        providers,
        remote: Boolean(remote),
        results,
        scrapeId,
        searchTerm: searchTerm ?? null,
        startedAt,
        totals,
        trigger,
      },
    });

    sessionStatus =
      errors.length > 0 && errors.length === results.length
        ? 'ERROR'
        : 'COMPLETE';
    sessionSummary = {
      errors,
      results,
      totals,
    } as unknown as Prisma.InputJsonValue;
  } catch (error) {
    sessionStatus = 'ERROR';
    sessionSummary = {
      error: error instanceof Error ? error.message : String(error),
    } as Prisma.InputJsonValue;
    throw error;
  } finally {
    const lookup = sessionLookup.get(scrapeId);
    if (lookup) {
      try {
        await db.scrapeSession.update({
          data: {
            finishedAt: new Date(),
            status: sessionStatus,
            summary: sessionSummary ?? Prisma.DbNull,
          },
          where: { id: lookup.sessionId },
        });
      } catch (updateError) {
        console.error('Failed to finalize ScrapeSession:', updateError);
      }
      await unregisterScrapeSession(scrapeId);
    }
  }
}
