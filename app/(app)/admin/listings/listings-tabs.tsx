'use client';

import NumberFlow from '@number-flow/react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  Clock,
  Copy,
  History,
  Loader2,
  MoreHorizontal,
  Play,
  PlayCircle,
  RefreshCw,
  Square,
  Star,
} from 'lucide-react';
import {
  Fragment,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalHeader,
  ModalTitle,
} from '@/components/ui/modal';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { US_STATES } from '@/constants/locales';
import { useChannel } from '@/hooks/use-channel';
import { useEvent } from '@/hooks/use-event';
import { getPrivateUserChannel } from '@/lib/events/channels';
import {
  type AdminScrapeProgressPayload,
  DataEventType,
  EventType,
} from '@/types/events';

interface ListingAnalytics {
  conversionRate: number;
  created24h: number;
  created7d: number;
  dismissedListings: number;
  leadsConverted: number;
  providerBreakdown: { count: number; percentage: number; provider: string }[];
  recentListings: {
    company: string | null;
    createdAt: string;
    id: string;
    provider: string | null;
    status: string;
    title: string;
  }[];
  totalListings: number;
  unreviewedListings: number;
}

interface ListingsTabsProps {
  activeTab: ListingsTabId;
  analytics: ListingAnalytics;
  usageBudget: UsageBudget;
  userId: string;
}

type ListingsTabId = 'analytics' | 'ingestion' | 'manual';

interface UsageBudget {
  jobsLimit: number;
  jobsRemaining: number;
  jobsUsed: number;
  requestsLimit: number;
  requestsRemaining: number;
  requestsUsed: number;
}

interface SerpApiUsageBudget {
  searchesLimit: number;
  searchesRemaining: number;
  searchesUsed: number;
}

interface ProviderBudget {
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

interface CronProviderStatus {
  lastError: string | null;
  lastRunAt: string | null;
  lastStatus: 'error' | 'success' | 'unknown';
  provider:
    | 'fantastic'
    | 'serpapi'
    | 'remoteok'
    | 'weworkremotely'
    | 'jobicy'
    | 'remotive';
  schedule: string | null;
}

interface ProviderRunLog {
  apiRequests: number;
  createdAt: string;
  error: string | null;
  jobsCreated: number;
  jobsFetched: number;
  jobsSkipped: number;
  jobsUpdated: number;
  location: string | null;
  logs: ProviderRunRequestLog[];
  maxPages: number | null;
  mode: string | null;
  scrapeId: string | null;
  searchTerm: string | null;
  status: 'error' | 'success' | 'unknown';
  trigger: string | null;
}

interface ProviderRunRequestLog {
  createdAt: string;
  page: number;
  requestUrl: string;
  responseBodyPreview: string;
  responseStatus: number;
}

interface ProviderOverrideState {
  insertAnyway: 'false' | 'inherit' | 'true';
  location: string;
  maxPages: string;
  mode: 'backfill' | 'inherit' | 'sync' | 'weekly';
  postedWithin: '' | '1' | '3' | '7' | '14' | '30' | '90';
  remote: 'false' | 'inherit' | 'true';
  searchTerm: string;
}

// Source of truth lives in lib/admin/manual-provider-options.ts so the
// desktop renderer can use the same provider capability table for its
// per-provider field gating. Re-exported here as a type alias to keep
// the existing local references in this file working unchanged.
import {
  MANUAL_PROVIDER_OPTIONS,
  type ManualProviderId,
  type ManualProviderOption,
} from '@/lib/admin/manual-provider-options';

const SCRAPE_PROVIDER_LABELS: Record<string, string> = {
  adzuna: 'Adzuna',
  arbeitnow: 'Arbeitnow',
  'ashby-boards': 'Ashby Boards',
  builtin: 'Built In',
  careerbuilder: 'CareerBuilder',
  clawjobs: 'ClawJobs',
  'comeet-boards': 'Comeet Boards',
  devitjobs: 'DevITjobs',
  fantastic: 'Fantastic Jobs',
  findwork: 'Findwork',
  'greenhouse-boards': 'Greenhouse Boards',
  hackernews: 'Hacker News',
  himalayas: 'Himalayas',
  'indeed-scraper': 'Indeed (Scraper)',
  'django-job-board': 'Django Job Board',
  'breezy-boards': 'BreezyHR Boards',
  jobspresso: 'Jobspresso',
  jobdataapi: 'JobDataAPI',
  jobicy: 'Jobicy',
  'jobvite-boards': 'Jobvite Boards',
  jooble: 'Jooble',
  'jazzhr-boards': 'JazzHR Boards',
  'lever-boards': 'Lever Boards',
  'linkedin-guest': 'LinkedIn (Guest)',
  'bamboohr-boards': 'BambooHR Boards',
  nodesk: 'NoDesk',
  openjobs: 'OpenJobs',
  'pallet-boards': 'Pallet Boards',
  'personio-boards': 'Personio Boards',
  'pinpoint-boards': 'Pinpoint Boards',
  crunchboard: 'CrunchBoard',
  'python-org': 'Python.org Jobs',
  'recruitee-boards': 'Recruitee Boards',
  'teamtailor-boards': 'Teamtailor Boards',
  'workable-boards': 'Workable Boards',
  'workday-boards': 'Workday Boards',
  remotefirstjobs: 'Remote First Jobs',
  'remotejobs-org': 'RemoteJobs.org',
  remoteok: 'Remote OK',
  remotive: 'Remotive',
  serpapi: 'SerpAPI',
  'smartrecruiters-boards': 'SmartRecruiters Boards',
  themuse: 'The Muse',
  theirstack: 'TheirStack',
  usajobs: 'USAJobs',
  welcometothejungle: 'Welcome to the Jungle',
  weworkremotely: 'We Work Remotely',
  workatastartup: 'Work at a Startup',
  workingnomads: 'Working Nomads',
};

const formatScrapeProviderLabel = (provider: string): string =>
  SCRAPE_PROVIDER_LABELS[provider] ?? provider;

// `ManualProviderOption` is imported from @/lib/admin/manual-provider-options.
// Local-only types continue to live here.

const DEFAULT_PROVIDER_OVERRIDE: ProviderOverrideState = {
  insertAnyway: 'inherit',
  location: '',
  maxPages: '',
  mode: 'inherit',
  postedWithin: '',
  remote: 'inherit',
  searchTerm: '',
};

interface LogEntry {
  id: string;
  level: 'error' | 'info' | 'success' | 'update' | 'warn';
  message: string;
  timestamp: Date;
}

interface RequestLogEntry {
  id: string;
  page: number;
  provider: string;
  requestUrl: string;
  responseBodyPreview: string;
  responseStatus: number;
  timestamp: Date;
}

const MASKED_SECRET_TOKEN = '••••••••••••';
const HTTP_METHOD_PATTERN =
  /^(DELETE|GET|HEAD|OPTIONS|PATCH|POST|PUT)\s+(\S+)(?:\n([\s\S]*))?$/i;

// `breakdownSuffix` in lib/admin/scrape-service.ts appends a stable
// ` (alreadyExists: N, inBatchDup: M, crossFeedDup: P, dbSkipDup: Q)`
// suffix to per-page progress messages. We parse it client-side because
// the structured `persistBreakdown` field on the payload isn't populated
// by most providers yet.
const SKIP_BREAKDOWN_SUFFIX_PATTERN =
  /\(((?:alreadyExists|inBatchDup|crossFeedDup|dbSkipDup):\s*\d+(?:,\s*(?:alreadyExists|inBatchDup|crossFeedDup|dbSkipDup):\s*\d+)*)\)/;
const SKIP_REASON_KV_PATTERN =
  /(alreadyExists|inBatchDup|crossFeedDup|dbSkipDup):\s*(\d+)/g;
const SKIP_REASON_LABELS: Record<string, string> = {
  alreadyExists: 'Already in your listings',
  crossFeedDup: 'Duplicate across feeds',
  dbSkipDup: 'DB-rejected duplicate',
  inBatchDup: 'Duplicate within batch',
};

type ProviderErrorCategory =
  | 'credits'
  | 'auth'
  | 'runtime'
  | 'rateLimit'
  | 'botBlock'
  | 'transport'
  | 'failed';

interface ProviderErrorInfo {
  category: ProviderErrorCategory;
  badgeLabel: string;
  badgeClassName: string;
  shortMessage: string;
}

const PROVIDER_ERROR_BADGES: Record<
  ProviderErrorCategory,
  { label: string; className: string }
> = {
  auth: {
    label: 'API key missing',
    className: 'bg-amber-500/10 text-amber-300',
  },
  botBlock: {
    label: 'Bot challenge blocked',
    className: 'bg-red-500/10 text-red-300',
  },
  credits: {
    label: 'Out of API credits',
    className: 'bg-amber-500/10 text-amber-300',
  },
  failed: { label: 'Last run failed', className: 'bg-red-500/10 text-red-300' },
  rateLimit: {
    label: 'Rate limited',
    className: 'bg-amber-500/10 text-amber-300',
  },
  runtime: {
    label: 'Browser runtime required',
    className: 'bg-amber-500/10 text-amber-300',
  },
  transport: {
    label: 'Transport error',
    className: 'bg-red-500/10 text-red-300',
  },
};

const categorizeProviderError = (
  rawError: string | null | undefined,
): ProviderErrorCategory => {
  if (!rawError) return 'failed';
  const lower = rawError.toLowerCase();
  if (
    /\b402\b/.test(rawError) ||
    /e-?007/i.test(rawError) ||
    /not enough (api )?credits/i.test(rawError) ||
    /upgrade your plan/i.test(rawError) ||
    /credits to perform/i.test(rawError)
  ) {
    return 'credits';
  }
  if (/datadome|captcha/i.test(rawError)) return 'botBlock';
  if (/\b429\b/.test(rawError) || /rate limit/i.test(rawError)) {
    return 'rateLimit';
  }
  if (/chromium|playwright|requires a chromium runtime/i.test(rawError)) {
    return 'runtime';
  }
  if (
    /\b401\b/.test(rawError) ||
    /\b403\b/.test(rawError) ||
    /api key/i.test(lower) ||
    /required env/i.test(lower) ||
    /set [a-z0-9_]+_(api)?_?key/i.test(lower)
  ) {
    return 'auth';
  }
  if (
    /\bECONN/i.test(rawError) ||
    /timeout/i.test(rawError) ||
    /unexpected status code 413/i.test(rawError)
  ) {
    return 'transport';
  }
  return 'failed';
};

// Pull the human-readable error title out of provider responses. TheirStack
// returns a nested JSON envelope; falls back to the raw message otherwise.
const summarizeProviderError = (
  rawError: string | null | undefined,
  category: ProviderErrorCategory,
): string => {
  if (!rawError) return PROVIDER_ERROR_BADGES[category].label;

  // TheirStack-style: "TheirStack ... failed: 402 - {...json...}"
  const jsonMatch = rawError.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as {
        error?: { title?: string; description?: string };
      };
      const title = parsed.error?.title;
      const description = parsed.error?.description;
      if (title || description) {
        return [title, description].filter(Boolean).join(' — ');
      }
    } catch {
      // ignore, fall through to the raw message
    }
  }

  if (category === 'runtime') {
    return 'This provider needs a Chromium browser runtime to run.';
  }
  return rawError;
};

const getProviderErrorInfo = (
  rawError: string | null | undefined,
): ProviderErrorInfo => {
  const category = categorizeProviderError(rawError);
  const badge = PROVIDER_ERROR_BADGES[category];
  return {
    badgeClassName: badge.className,
    badgeLabel: badge.label,
    category,
    shortMessage: summarizeProviderError(rawError, category),
  };
};

const parsePageSkipBreakdown = (message: string): Record<string, number> => {
  const match = message.match(SKIP_BREAKDOWN_SUFFIX_PATTERN);
  if (!match) return {};
  const breakdown: Record<string, number> = {};
  for (const kv of match[1].matchAll(SKIP_REASON_KV_PATTERN)) {
    const reason = kv[1];
    const value = Number.parseInt(kv[2], 10);
    if (Number.isFinite(value) && value > 0) {
      breakdown[reason] = value;
    }
  }
  return breakdown;
};

const maskSensitiveLogText = (value: string): string => {
  const patterns = [
    /([?&](?:apikey|api_key|access_token|token)=)([^&\s]+)/gi,
    /((?:apikey|api_key|access_token|token|authorization|x-rapidapi-key)\s*[:=]\s*["']?)([^"',\s}]+)/gi,
    /(Bearer\s+)([A-Za-z0-9._-]+)/gi,
  ];

  return patterns.reduce(
    (current, pattern) =>
      current.replace(
        pattern,
        (_, prefix: string) => `${prefix}${MASKED_SECRET_TOKEN}`,
      ),
    value,
  );
};

interface ProviderRunStatus {
  currentPage: number;
  error?: string;
  jobsCreated: number;
  jobsFetched: number;
  jobsSkipped: number;
  jobsUpdated: number;
  provider: string;
  status: 'idle' | 'fetching' | 'persisting' | 'complete' | 'error';
  totalPages: number;
}

interface ScrapeSessionListItem {
  city: string | null;
  country: string | null;
  finishedAt: string | null;
  globalDateRange: string | null;
  globalMaxPages: number | null;
  id: string;
  mode: string | null;
  providersRequested: string[];
  remote: boolean;
  scrapeId: string;
  searchTerm: string | null;
  startedAt: string;
  stateCode: string | null;
  status: 'RUNNING' | 'COMPLETE' | 'ERROR' | 'CANCELLED';
  trigger: string | null;
}

interface ScrapeSessionEventRecord {
  emittedAt: string;
  id: string;
  kind: 'PROGRESS' | 'REQUEST_LOG' | 'LOG';
  payload: unknown;
  sequence: number;
}

interface ScrapeSessionDetail extends ScrapeSessionListItem {
  events: ScrapeSessionEventRecord[];
  providerOverrides: Record<
    string,
    {
      location?: string;
      insertAnyway?: boolean;
      maxPages?: number;
      postedWithin?: string;
      remote?: boolean;
      searchTerm?: string;
    }
  > | null;
}

const ALL_CRON_JOBS = [
  {
    category: 'ingestion' as const,
    constraints: '~5 pages/run, uses request budget',
    description:
      'Daily sync of job listings from Fantastic Jobs API (24h endpoint)',
    id: 'fantastic',
    name: 'Fantastic Jobs Sync',
    path: '/api/admin/scrape/cron?provider=fantastic',
    schedule: '0 6 * * *',
  },
  {
    category: 'ingestion' as const,
    constraints: '~130 pages/run, 5,000 searches/mo limit',
    description: 'Daily sync of Google Jobs results via SerpAPI',
    id: 'serpapi',
    name: 'SerpAPI Jobs Sync',
    path: '/api/admin/scrape/cron?provider=serpapi',
    schedule: '0 7 * * *',
  },
  {
    category: 'ingestion' as const,
    constraints: 'Public/API-keyed providers, ~3 pages/source',
    description:
      'Daily expanded sync across ATS boards, remote boards, USAJobs, and configured API feeds',
    id: 'daily-expanded',
    name: 'Expanded Jobs Sync',
    path: '/api/admin/scrape/cron?provider=daily-expanded',
    schedule: '0 8 * * *',
  },
  {
    category: 'notifications' as const,
    constraints: 'No rate limits',
    description: 'Sends daily email digests of unread notifications',
    id: 'daily-digest',
    name: 'Daily Notification Digest',
    path: '/api/notifications/digests/daily',
    schedule: '0 9 * * *',
  },
  {
    category: 'notifications' as const,
    constraints: 'No rate limits',
    description: 'Sends weekly summary email every Monday',
    id: 'weekly-digest',
    name: 'Weekly Notification Digest',
    path: '/api/notifications/digests/weekly',
    schedule: '0 9 * * 1',
  },
  {
    category: 'training' as const,
    constraints: 'Max 5 sessions per run, dry-run only',
    description:
      'Processes pending retraining sessions for hostnames with degraded health',
    id: 'retrain',
    name: 'Assist Retraining Queue',
    path: '/api/admin/cron/retrain',
    schedule: '*/30 * * * *',
  },
];

const humanizeCron = (expression: string | null | undefined): string => {
  if (!expression) return 'Not configured';

  const parts = expression.trim().split(/\s+/);
  if (parts.length !== 5) return expression;

  const [minute, hour, dayOfMonth, month, dayOfWeek] = parts;

  const isDaily = dayOfMonth === '*' && month === '*' && dayOfWeek === '*';
  const isHourly =
    minute !== '*' &&
    hour === '*' &&
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek === '*';

  if (isDaily && hour !== '*' && minute !== '*') {
    const h = hour.padStart(2, '0');
    const m = minute.padStart(2, '0');
    return `Daily at ${h}:${m} UTC`;
  }

  if (isHourly) {
    return `Every hour at :${minute.padStart(2, '0')}`;
  }

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const isWeekly =
    dayOfMonth === '*' &&
    month === '*' &&
    dayOfWeek !== '*' &&
    hour !== '*' &&
    minute !== '*';

  if (isWeekly) {
    const dayIndex = Number.parseInt(dayOfWeek, 10);
    const dayName =
      dayIndex >= 0 && dayIndex <= 6 ? dayNames[dayIndex] : dayOfWeek;
    const h = hour.padStart(2, '0');
    const m = minute.padStart(2, '0');
    return `Weekly ${dayName} at ${h}:${m} UTC`;
  }

  return expression;
};

const renderMaskedLogText = (value: string): ReactNode => {
  const segments = value.split(MASKED_SECRET_TOKEN);
  if (segments.length === 1) {
    return value;
  }

  return segments.flatMap((segment, index) => {
    const items: ReactNode[] = [];

    if (segment) {
      items.push(<Fragment key={`segment-${index}`}>{segment}</Fragment>);
    }

    if (index < segments.length - 1) {
      items.push(
        <span
          key={`mask-${index}`}
          className="mx-0.5 inline-flex items-center rounded-sm border border-amber-500/12 bg-amber-500/8 px-1 align-middle text-amber-100/60"
        >
          <span className="select-none blur-[3px]">{MASKED_SECRET_TOKEN}</span>
        </span>,
      );
    }

    return items;
  });
};

const parseRequestLogPreview = (
  value: string,
): {
  method: string;
  requestBody?: string;
  url: string;
} => {
  const sanitizedValue = value.trim();
  const match = HTTP_METHOD_PATTERN.exec(sanitizedValue);

  if (!match) {
    return {
      method: 'GET',
      url: sanitizedValue,
    };
  }

  const [, method, url, requestBody] = match;

  return {
    method: method.toUpperCase(),
    requestBody: requestBody?.trim() || undefined,
    url,
  };
};

const ProviderRunError = ({ error }: { error: string }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleClose = () => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    return () => clearCloseTimer();
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(error);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* ignore */
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        asChild
        onMouseEnter={() => {
          clearCloseTimer();
          setOpen(true);
        }}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          className="flex max-w-[220px] shrink-0 items-center gap-1 rounded text-[11px] text-red-500 focus:outline-none focus-visible:ring-1 focus-visible:ring-red-500/50"
        >
          <AlertCircle className="h-3.5 w-3.5 shrink-0 animate-in fade-in duration-500" />
          <span className="truncate">{error}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 max-w-[calc(100vw-2rem)]"
        align="end"
        onMouseEnter={clearCloseTimer}
        onMouseLeave={scheduleClose}
      >
        <div className="flex items-start gap-2">
          <pre className="max-h-48 flex-1 overflow-auto whitespace-pre-wrap break-words text-xs text-foreground">
            {error}
          </pre>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleCopy}
            className="h-7 shrink-0 gap-1 text-xs"
          >
            <Copy className="h-3 w-3" />
            {copied ? 'Copied' : 'Copy'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ProviderRunHistoryEntry = ({ run }: { run: ProviderRunLog }) => {
  const [open, setOpen] = useState(false);
  const requestLogs = run.logs ?? [];

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={`rounded-lg border backdrop-blur-md ${
          run.status === 'error'
            ? 'border-red-500/20 bg-red-500/[0.04]'
            : run.status === 'success'
              ? 'border-white/[0.06] bg-white/[0.03]'
              : 'border-white/[0.06] bg-white/[0.02]'
        }`}
      >
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                {run.status === 'error' ? (
                  <AlertCircle className="h-3.5 w-3.5 text-red-500" />
                ) : run.status === 'success' ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                ) : (
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(run.createdAt).toLocaleString()}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${
                    open ? 'rotate-180' : ''
                  }`}
                />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 pl-5 font-mono text-[11px] text-muted-foreground">
                <span>{run.jobsFetched.toLocaleString()} fetched</span>
                <span className="text-green-500">
                  {run.jobsCreated.toLocaleString()} created
                </span>
                <span className="text-blue-500">
                  {run.jobsUpdated.toLocaleString()} updated
                </span>
                {run.jobsSkipped > 0 ? (
                  <span className="text-orange-500">
                    {run.jobsSkipped.toLocaleString()} skipped
                  </span>
                ) : null}
                {run.apiRequests > 0 ? (
                  <span>{run.apiRequests.toLocaleString()} req</span>
                ) : null}
                <span>{requestLogs.length} logs</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {run.trigger ? (
                <Badge variant="outline" className="text-[10px] font-normal">
                  {run.trigger}
                </Badge>
              ) : null}
              {run.mode ? (
                <Badge variant="secondary" className="text-[10px] font-normal">
                  {run.mode}
                </Badge>
              ) : null}
            </div>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3 border-t border-white/[0.06] px-3 py-3">
          {run.searchTerm || run.location ? (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70">
              {run.searchTerm ? <span>"{run.searchTerm}"</span> : null}
              {run.location ? <span>{run.location}</span> : null}
            </div>
          ) : null}

          {run.error ? (
            <pre className="max-h-24 overflow-auto whitespace-pre-wrap break-words rounded bg-red-500/[0.06] px-2 py-1 text-[11px] text-red-300">
              {run.error}
            </pre>
          ) : null}

          {requestLogs.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">
              No stored request logs for this run.
            </p>
          ) : (
            <div className="space-y-2">
              {requestLogs.map((log, logIndex) => {
                const parsedRequest = parseRequestLogPreview(log.requestUrl);

                return (
                  <div
                    key={`${log.createdAt}-${log.page}-${logIndex}`}
                    className="rounded-md border border-white/[0.06] bg-black/20 px-3 py-2"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px]">
                      <span className="font-mono text-muted-foreground">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        page {log.page}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className="text-[10px] font-normal"
                      >
                        {parsedRequest.method}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="text-[10px] font-normal"
                      >
                        {log.responseStatus}
                      </Badge>
                    </div>
                    <div className="mt-2 break-all text-[11px] text-foreground">
                      {renderMaskedLogText(parsedRequest.url)}
                    </div>
                    {parsedRequest.requestBody ? (
                      <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap break-words rounded bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground">
                        {renderMaskedLogText(parsedRequest.requestBody)}
                      </pre>
                    ) : null}
                    {log.responseBodyPreview ? (
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-white/[0.03] px-2 py-1 text-[11px] text-muted-foreground">
                        {renderMaskedLogText(log.responseBodyPreview)}
                      </pre>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
};

const MANUAL_FORM_STORAGE_KEY = 'gimme-job.admin.listings.manual.form.v1';
const MANUAL_SEARCH_HISTORY_STORAGE_KEY =
  'gimme-job.admin.listings.manual.search-history.v1';
const MANUAL_SEARCH_HISTORY_LIMIT = 10;

type PersistedManualForm = {
  city?: string;
  country?: string;
  globalDateRange?: 'all' | '1' | '3' | '7' | '14' | '30' | '90';
  globalMaxPages?: string;
  insertAnyway?: boolean;
  remote?: boolean;
  searchTerm?: string;
  stateCode?: string;
};

const ListingsTabs = ({
  activeTab,
  analytics,
  usageBudget,
  userId,
}: ListingsTabsProps) => {
  // ── Manual tab state ───────────────────────────────────
  const [providerOverrides, setProviderOverrides] = useState<
    Record<string, ProviderOverrideState>
  >({});
  const [providerEnabled, setProviderEnabled] = useState<
    Record<string, boolean>
  >({});
  const [searchTerm, setSearchTerm] = useState('');
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [country, setCountry] = useState('United States');
  const [globalMaxPages, setGlobalMaxPages] = useState('');
  const [globalDateRange, setGlobalDateRange] = useState<
    'all' | '1' | '3' | '7' | '14' | '30' | '90'
  >('all');
  const [insertAnyway, setInsertAnyway] = useState(false);
  const [remote, setRemote] = useState(false);

  const [savedSearches, setSavedSearches] = useState<
    { id: string; location?: string; searchTerm: string }[]
  >([]);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const formHydratedRef = useRef(false);

  const [isRunning, setIsRunning] = useState(false);
  // scrapeId is returned synchronously from POST /api/admin/scrape and is
  // the only id the server's cancellation set understands. Stash it so
  // stopScrape can DELETE even before the first Pusher progress event has
  // arrived (otherwise an early Stop click is a no-op on the server).
  const [activeScrapeId, setActiveScrapeId] = useState<string | null>(null);
  const [runningProvider, setRunningProvider] =
    useState<ManualProviderId | null>(null);
  const [providerStatuses, setProviderStatuses] = useState<
    Record<string, ProviderRunStatus>
  >({});
  const [progress, setProgress] = useState<AdminScrapeProgressPayload | null>(
    null,
  );
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [requestLogs, setRequestLogs] = useState<RequestLogEntry[]>([]);
  // Per-provider cumulative skip-reason totals across all pages of the
  // current run. Keyed by `${scrapeId}::${provider}::${currentPage}` to
  // dedupe re-delivered events; values accumulate into the cumulative
  // record under each provider name.
  const [skipBreakdownByProvider, setSkipBreakdownByProvider] = useState<
    Record<string, Record<string, number>>
  >({});
  const skipBreakdownSeenKeysRef = useRef<Set<string>>(new Set());
  const [liveViewTab, setLiveViewTab] = useState<'logs' | 'requests'>('logs');
  const [scrapeSessions, setScrapeSessions] = useState<ScrapeSessionListItem[]>(
    [],
  );
  const [replaySessionId, setReplaySessionId] = useState<string | null>(null);
  const [isLoadingReplay, setIsLoadingReplay] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const replaySessionIdRef = useRef<string | null>(null);
  replaySessionIdRef.current = replaySessionId;
  const logsContainerRef = useRef<HTMLDivElement>(null);
  const requestsContainerRef = useRef<HTMLDivElement>(null);
  const seenRecentInsertKeysRef = useRef<Set<string>>(new Set());
  const seenRecentUpdateKeysRef = useRef<Set<string>>(new Set());
  const seenDiagnosticLogKeysRef = useRef<Set<string>>(new Set());
  const seenRejectedPreviewKeysRef = useRef<Set<string>>(new Set());
  const autoDisabledFailureKeysRef = useRef<Set<string>>(new Set());
  const progressTotalsRef = useRef<
    Record<
      string,
      {
        jobsCreated: number;
        jobsFetched: number;
        jobsSkipped: number;
        jobsUpdated: number;
      }
    >
  >({});

  // ── Shared state ───────────────────────────────────────
  const [cronStatuses, setCronStatuses] = useState<CronProviderStatus[]>([]);
  const [isLoadingCronStatus, setIsLoadingCronStatus] = useState(true);
  const [scheduleSource, setScheduleSource] = useState<string | null>(null);
  const [liveUsageBudget, setLiveUsageBudget] =
    useState<UsageBudget>(usageBudget);
  const [liveSerpApiBudget, setLiveSerpApiBudget] =
    useState<SerpApiUsageBudget | null>(null);
  const [providerBudgets, setProviderBudgets] = useState<ProviderBudget[]>([]);
  const [isRefreshingUsage, setIsRefreshingUsage] = useState(false);
  const [lastUsageRefreshAt, setLastUsageRefreshAt] = useState<Date | null>(
    null,
  );
  const [cronTriggering, setCronTriggering] = useState<Set<string>>(new Set());
  const [cronResults, setCronResults] = useState<
    Map<string, { error?: string; success: boolean; triggeredAt: string }>
  >(new Map());
  const [expandedProvider, setExpandedProvider] =
    useState<ManualProviderId | null>(null);
  const [detailProvider, setDetailProvider] = useState<ManualProviderId | null>(
    null,
  );
  const [providerRunHistory, setProviderRunHistory] = useState<
    Record<string, ProviderRunLog[]>
  >({});
  const [loadingProviderRuns, setLoadingProviderRuns] = useState<
    Record<string, boolean>
  >({});

  const clearLogs = useCallback(() => {
    setLogs([]);
    setRequestLogs([]);
  }, []);

  // ── Helpers ────────────────────────────────────────────
  const addLog = useCallback(
    (message: string, level: LogEntry['level'] = 'info') => {
      setLogs(prev => {
        const next = [
          ...prev,
          {
            id: `${Date.now()}-${Math.random()}`,
            level,
            message,
            timestamp: new Date(),
          },
        ];
        // Keep enough history for large provider runs without dropping
        // the per-job lines the manual scrape UI now emits.
        return next.length > 5000 ? next.slice(-5000) : next;
      });
    },
    [],
  );

  const getRecentInsertKey = useCallback(
    (listing: {
      applyUrl?: string | null;
      company?: string | null;
      location?: string | null;
      title: string;
    }) =>
      [
        listing.applyUrl ?? '',
        listing.title,
        listing.company ?? '',
        listing.location ?? '',
      ].join('::'),
    [],
  );

  const fetchCronStatus = useCallback(async () => {
    setIsLoadingCronStatus(true);
    try {
      const response = await fetch('/api/admin/scrape/cron-status');
      if (!response.ok) return;

      const data = (await response.json()) as {
        scheduleSource?: string;
        statuses?: CronProviderStatus[];
      };
      setCronStatuses(data.statuses ?? []);
      setScheduleSource(data.scheduleSource ?? null);
    } catch {
      // ignore fetch errors in UI
    } finally {
      setIsLoadingCronStatus(false);
    }
  }, []);

  const fetchUsageBudget = useCallback(async () => {
    setIsRefreshingUsage(true);
    try {
      const response = await fetch('/api/admin/scrape');
      if (!response.ok) return;

      const data = (await response.json()) as {
        providerUsageBudgets?: ProviderBudget[];
        serpApiUsageBudget?: SerpApiUsageBudget | null;
        usageBudget?: UsageBudget;
      };

      if (data.usageBudget) {
        setLiveUsageBudget({
          jobsLimit: data.usageBudget.jobsLimit,
          jobsRemaining: data.usageBudget.jobsRemaining,
          jobsUsed: data.usageBudget.jobsUsed,
          requestsLimit: data.usageBudget.requestsLimit,
          requestsRemaining: data.usageBudget.requestsRemaining,
          requestsUsed: data.usageBudget.requestsUsed,
        });
        setLastUsageRefreshAt(new Date());
      }
      if (data.serpApiUsageBudget) {
        setLiveSerpApiBudget(data.serpApiUsageBudget);
      }
      if (Array.isArray(data.providerUsageBudgets)) {
        setProviderBudgets(data.providerUsageBudgets);
      }
    } catch {
      // ignore fetch errors in UI
    } finally {
      setIsRefreshingUsage(false);
    }
  }, []);

  const fetchProviderRuns = useCallback(async (provider: ManualProviderId) => {
    setLoadingProviderRuns(prev => ({ ...prev, [provider]: true }));
    try {
      const response = await fetch(
        `/api/admin/scrape/runs?provider=${encodeURIComponent(provider)}&limit=25`,
      );
      if (!response.ok) return;
      const data = (await response.json()) as { runs?: ProviderRunLog[] };
      setProviderRunHistory(prev => ({
        ...prev,
        [provider]: data.runs ?? [],
      }));
    } catch {
      // ignore
    } finally {
      setLoadingProviderRuns(prev => ({ ...prev, [provider]: false }));
    }
  }, []);

  const openProviderDetails = useCallback(
    (provider: ManualProviderId) => {
      setDetailProvider(provider);
      fetchProviderRuns(provider);
    },
    [fetchProviderRuns],
  );

  const loadSavedSearches = useCallback(async () => {
    try {
      const response = await fetch('/api/job-searches');
      if (!response.ok) return;
      const data = (await response.json()) as {
        id: string;
        location?: string;
        searchTerm: string;
      }[];
      setSavedSearches(data);
    } catch {
      // ignore
    }
  }, []);

  const triggerCronJob = useCallback(
    async (cronId: string, path: string) => {
      setCronTriggering(prev => new Set(prev).add(cronId));
      try {
        const response = await fetch('/api/admin/cron/trigger', {
          body: JSON.stringify({ path }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });
        const data = await response.json();
        setCronResults(prev => {
          const next = new Map(prev);
          next.set(cronId, {
            error: data.error,
            success: data.success ?? response.ok,
            triggeredAt: new Date().toISOString(),
          });
          return next;
        });
        fetchCronStatus();
      } catch (error) {
        setCronResults(prev => {
          const next = new Map(prev);
          next.set(cronId, {
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false,
            triggeredAt: new Date().toISOString(),
          });
          return next;
        });
      } finally {
        setCronTriggering(prev => {
          const next = new Set(prev);
          next.delete(cronId);
          return next;
        });
      }
    },
    [fetchCronStatus],
  );

  useEffect(() => {
    loadSavedSearches();
    fetchCronStatus();
    fetchUsageBudget();
  }, [fetchCronStatus, fetchUsageBudget, loadSavedSearches]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(MANUAL_FORM_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as PersistedManualForm;
        if (typeof parsed.searchTerm === 'string')
          setSearchTerm(parsed.searchTerm);
        if (typeof parsed.city === 'string') setCity(parsed.city);
        if (typeof parsed.stateCode === 'string')
          setStateCode(parsed.stateCode);
        if (typeof parsed.country === 'string') setCountry(parsed.country);
        if (typeof parsed.globalMaxPages === 'string')
          setGlobalMaxPages(parsed.globalMaxPages);
        if (
          parsed.globalDateRange === 'all' ||
          parsed.globalDateRange === '1' ||
          parsed.globalDateRange === '3' ||
          parsed.globalDateRange === '7' ||
          parsed.globalDateRange === '14' ||
          parsed.globalDateRange === '30' ||
          parsed.globalDateRange === '90'
        ) {
          setGlobalDateRange(parsed.globalDateRange);
        }
        if (typeof parsed.insertAnyway === 'boolean') {
          setInsertAnyway(parsed.insertAnyway);
        }
        if (typeof parsed.remote === 'boolean') setRemote(parsed.remote);
      }
    } catch {
      // ignore corrupted storage
    }

    try {
      const rawHistory = window.localStorage.getItem(
        MANUAL_SEARCH_HISTORY_STORAGE_KEY,
      );
      if (rawHistory) {
        const parsed = JSON.parse(rawHistory);
        if (Array.isArray(parsed)) {
          setSearchHistory(
            parsed
              .filter((item): item is string => typeof item === 'string')
              .slice(0, MANUAL_SEARCH_HISTORY_LIMIT),
          );
        }
      }
    } catch {
      // ignore corrupted history
    }

    formHydratedRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!formHydratedRef.current) return;
    try {
      const payload: PersistedManualForm = {
        city,
        country,
        globalDateRange,
        globalMaxPages,
        insertAnyway,
        remote,
        searchTerm,
        stateCode,
      };
      window.localStorage.setItem(
        MANUAL_FORM_STORAGE_KEY,
        JSON.stringify(payload),
      );
    } catch {
      // ignore quota errors
    }
  }, [
    city,
    country,
    globalDateRange,
    globalMaxPages,
    insertAnyway,
    remote,
    searchTerm,
    stateCode,
  ]);

  const recordSearchTermInHistory = useCallback((term: string) => {
    const trimmed = term.trim();
    if (!trimmed) return;
    setSearchHistory(prev => {
      const next = [trimmed, ...prev.filter(item => item !== trimmed)].slice(
        0,
        MANUAL_SEARCH_HISTORY_LIMIT,
      );
      if (typeof window !== 'undefined') {
        try {
          window.localStorage.setItem(
            MANUAL_SEARCH_HISTORY_STORAGE_KEY,
            JSON.stringify(next),
          );
        } catch {
          // ignore quota errors
        }
      }
      return next;
    });
  }, []);

  // Poll usage budget only while a scrape is running
  useEffect(() => {
    if (!isRunning) return;

    const intervalId = window.setInterval(() => {
      fetchUsageBudget();
    }, 30_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isRunning, fetchUsageBudget]);

  // ── Real-time channel ──────────────────────────────────
  const channelName = getPrivateUserChannel(userId);
  const channel = useChannel(channelName);

  const handleDataUpdate = useCallback(
    (data?: { data?: AdminScrapeProgressPayload; type?: string }) => {
      if (!data || data.type !== DataEventType.ADMIN_SCRAPE_PROGRESS) return;
      if (replaySessionIdRef.current) return;

      const payload = data.data;
      if (!payload) return;

      setProgress(payload);

      if (payload.provider !== 'all' && payload.status === 'error') {
        const failureKey = `${payload.provider}:${payload.scrapeId}`;
        if (!autoDisabledFailureKeysRef.current.has(failureKey)) {
          autoDisabledFailureKeysRef.current.add(failureKey);
          setProviderEnabled(prev => ({
            ...prev,
            [payload.provider]: false,
          }));
        }
      }

      // Track per-provider status
      if (payload.provider !== 'all') {
        setProviderStatuses(prev => ({
          ...prev,
          [payload.provider]: {
            currentPage: payload.currentPage,
            error: payload.error,
            jobsCreated: payload.jobsCreated,
            jobsFetched: payload.jobsFetched,
            jobsSkipped: payload.jobsSkipped,
            jobsUpdated: payload.jobsUpdated,
            provider: payload.provider,
            status: payload.status === 'starting' ? 'fetching' : payload.status,
            totalPages: payload.totalPages,
          },
        }));
      }

      const level: LogEntry['level'] =
        payload.status === 'error'
          ? 'error'
          : payload.status === 'complete'
            ? 'success'
            : 'info';

      addLog(payload.message, level);

      const pageBreakdown = parsePageSkipBreakdown(payload.message);
      if (Object.keys(pageBreakdown).length > 0) {
        const seenKey = `${payload.scrapeId}::${payload.provider}::${payload.currentPage}::${payload.message}`;
        if (!skipBreakdownSeenKeysRef.current.has(seenKey)) {
          skipBreakdownSeenKeysRef.current.add(seenKey);
          setSkipBreakdownByProvider(prev => {
            const existing = prev[payload.provider] ?? {};
            const merged: Record<string, number> = { ...existing };
            for (const [reason, value] of Object.entries(pageBreakdown)) {
              merged[reason] = (merged[reason] ?? 0) + value;
            }
            return { ...prev, [payload.provider]: merged };
          });
        }
      }

      const progressKey = `${payload.scrapeId}::${payload.provider}`;
      const previousTotals = progressTotalsRef.current[progressKey];
      const progressChanges = [
        payload.jobsFetched > (previousTotals?.jobsFetched ?? 0)
          ? `fetched +${payload.jobsFetched - (previousTotals?.jobsFetched ?? 0)} (${payload.jobsFetched})`
          : null,
        payload.jobsCreated > (previousTotals?.jobsCreated ?? 0)
          ? `created +${payload.jobsCreated - (previousTotals?.jobsCreated ?? 0)} (${payload.jobsCreated})`
          : null,
        payload.jobsUpdated > (previousTotals?.jobsUpdated ?? 0)
          ? `updated +${payload.jobsUpdated - (previousTotals?.jobsUpdated ?? 0)} (${payload.jobsUpdated})`
          : null,
        payload.jobsSkipped > (previousTotals?.jobsSkipped ?? 0)
          ? `skipped +${payload.jobsSkipped - (previousTotals?.jobsSkipped ?? 0)} (${payload.jobsSkipped})`
          : null,
      ].filter(Boolean);

      if (progressChanges.length > 0) {
        addLog(
          `${payload.provider} totals :: ${progressChanges.join(' · ')}`,
          'info',
        );
      }

      progressTotalsRef.current[progressKey] = {
        jobsCreated: payload.jobsCreated,
        jobsFetched: payload.jobsFetched,
        jobsSkipped: payload.jobsSkipped,
        jobsUpdated: payload.jobsUpdated,
      };

      if (payload.diagnostics?.reasons?.length) {
        for (const reason of payload.diagnostics.reasons) {
          const diagnosticKey = [
            payload.scrapeId,
            payload.provider,
            payload.currentPage,
            payload.status,
            reason,
          ].join('::');

          if (seenDiagnosticLogKeysRef.current.has(diagnosticKey)) {
            continue;
          }

          seenDiagnosticLogKeysRef.current.add(diagnosticKey);
          addLog(`Why not created :: ${reason}`, 'warn');
        }
      }

      if (payload.recentCreatedListings?.length) {
        for (const listing of payload.recentCreatedListings) {
          const key = getRecentInsertKey(listing);
          if (seenRecentInsertKeysRef.current.has(key)) {
            continue;
          }

          seenRecentInsertKeysRef.current.add(key);
          const details =
            [listing.company, listing.location].filter(Boolean).join(' · ') ||
            'Company / location unavailable';
          const source = listing.source || listing.jobProvider || 'Imported';
          addLog(
            `Inserted :: ${listing.title} — ${details} [${source}]`,
            'success',
          );
        }
      }

      if (payload.recentUpdatedListings?.length) {
        for (const listing of payload.recentUpdatedListings) {
          const changeSummary = (listing.changedFields ?? [])
            .map(
              change =>
                `${change.field}: ${change.from ?? 'empty'} -> ${change.to ?? 'empty'}`,
            )
            .join('; ');
          const key = [
            payload.scrapeId,
            payload.provider,
            listing.title,
            listing.company ?? '',
            changeSummary,
          ].join('::');

          if (seenRecentUpdateKeysRef.current.has(key)) {
            continue;
          }

          seenRecentUpdateKeysRef.current.add(key);
          addLog(
            `Updated :: ${listing.title}${listing.company ? ` — ${listing.company}` : ''} :: ${changeSummary}`,
            'update',
          );
        }
      }

      if (payload.recentRejectedListings?.length) {
        for (const listing of payload.recentRejectedListings) {
          const key = [
            payload.scrapeId,
            payload.provider,
            listing.title,
            listing.company,
            listing.reason,
          ].join('::');
          if (seenRejectedPreviewKeysRef.current.has(key)) {
            continue;
          }

          seenRejectedPreviewKeysRef.current.add(key);
          const details =
            [listing.company, listing.location].filter(Boolean).join(' · ') ||
            'Company / location unavailable';
          addLog(
            `Rejected :: ${listing.title} — ${details} :: ${listing.reason}`,
            'warn',
          );
        }
      }

      if (
        (payload.status === 'complete' || payload.status === 'error') &&
        payload.provider === 'all'
      ) {
        setIsRunning(false);
        setRunningProvider(null);
        fetchCronStatus();
        fetchUsageBudget();
      }
    },
    [addLog, fetchCronStatus, fetchUsageBudget, getRecentInsertKey],
  );

  useEvent(channel, EventType.DataUpdate, handleDataUpdate);

  const handleRequestLogEvent = useCallback(
    (data?: {
      data?: {
        requestLog: NonNullable<AdminScrapeProgressPayload['requestLog']>;
        scrapeId: string;
      };
      type?: string;
    }) => {
      if (!data || data.type !== DataEventType.ADMIN_SCRAPE_REQUEST_LOG) return;
      if (replaySessionIdRef.current) return;
      const inner = data.data;
      const log = inner?.requestLog;
      if (!inner || !log) return;

      const entry: RequestLogEntry = {
        id: `${inner.scrapeId}-${log.page}-${Date.now()}`,
        page: log.page,
        provider: progress?.provider ?? 'unknown',
        requestUrl: maskSensitiveLogText(log.requestUrl),
        responseBodyPreview: maskSensitiveLogText(log.responseBodyPreview),
        responseStatus: log.responseStatus,
        timestamp: new Date(log.timestamp),
      };
      setRequestLogs(prev => [...prev, entry]);
    },
    [progress?.provider],
  );

  useEvent(channel, EventType.DataUpdate, handleRequestLogEvent);

  useEffect(() => {
    const element =
      liveViewTab === 'logs'
        ? logsContainerRef.current
        : requestsContainerRef.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [logs, requestLogs, liveViewTab]);

  const fetchScrapeSessions = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/scrape/sessions?limit=25');
      if (!response.ok) return;
      const data = (await response.json()) as {
        sessions: ScrapeSessionListItem[];
      };
      setScrapeSessions(data.sessions ?? []);
    } catch (error) {
      console.error('Failed to load scrape sessions:', error);
    }
  }, []);

  useEffect(() => {
    void fetchScrapeSessions();
  }, [fetchScrapeSessions]);

  // Refresh history list when a live run completes
  useEffect(() => {
    if (
      progress?.provider === 'all' &&
      (progress.status === 'complete' || progress.status === 'error') &&
      !replaySessionIdRef.current
    ) {
      void fetchScrapeSessions();
    }
  }, [progress?.provider, progress?.status, fetchScrapeSessions]);

  const exitReplay = useCallback(() => {
    setReplaySessionId(null);
    replaySessionIdRef.current = null;
    setProgress(null);
    setProviderStatuses({});
    setLogs([]);
    setRequestLogs([]);
  }, []);

  const loadReplaySession = useCallback(async (sessionId: string) => {
    setIsLoadingReplay(true);
    try {
      const response = await fetch(`/api/admin/scrape/sessions/${sessionId}`);
      if (!response.ok) {
        console.error('Failed to load session', await response.text());
        return;
      }
      const data = (await response.json()) as {
        session: ScrapeSessionDetail;
      };
      const session = data.session;

      // Block live channel updates from clobbering replay state.
      replaySessionIdRef.current = sessionId;

      // Reset live state and dedupe refs so replay events render cleanly.
      setProgress(null);
      setProviderStatuses({});
      setLogs([]);
      setRequestLogs([]);
      seenRecentInsertKeysRef.current = new Set();
      seenRecentUpdateKeysRef.current = new Set();
      seenDiagnosticLogKeysRef.current = new Set();
      seenRejectedPreviewKeysRef.current = new Set();
      progressTotalsRef.current = {};
      setSkipBreakdownByProvider({});
      skipBreakdownSeenKeysRef.current = new Set();
      autoDisabledFailureKeysRef.current = new Set();

      // Restore form values to match the moment this scrape was started.
      setSearchTerm(session.searchTerm ?? '');
      setCity(session.city ?? '');
      setStateCode(session.stateCode ?? '');
      setCountry(session.country ?? 'United States');
      setRemote(Boolean(session.remote));
      setGlobalMaxPages(
        session.globalMaxPages != null ? String(session.globalMaxPages) : '',
      );
      const dateRange =
        (session.globalDateRange as
          | 'all'
          | '1'
          | '3'
          | '7'
          | '14'
          | '30'
          | '90'
          | null) ?? 'all';
      setGlobalDateRange(dateRange);

      if (session.providerOverrides) {
        const restored: Record<string, ProviderOverrideState> = {};
        for (const [provider, override] of Object.entries(
          session.providerOverrides,
        )) {
          restored[provider] = {
            ...DEFAULT_PROVIDER_OVERRIDE,
            insertAnyway:
              override.insertAnyway === true
                ? 'true'
                : override.insertAnyway === false
                  ? 'false'
                  : 'inherit',
            location: override.location ?? '',
            maxPages:
              override.maxPages != null ? String(override.maxPages) : '',
            postedWithin:
              (override.postedWithin as ProviderOverrideState['postedWithin']) ??
              '',
            remote:
              override.remote === true
                ? 'true'
                : override.remote === false
                  ? 'false'
                  : 'inherit',
            searchTerm: override.searchTerm ?? '',
          };
        }
        setProviderOverrides(restored);
      } else {
        setProviderOverrides({});
      }

      // Replay events in order. These bypass the live handler guards by
      // setting state directly so dedupe + ordering match the live UI.
      const replayLogs: LogEntry[] = [];
      const replayRequestLogs: RequestLogEntry[] = [];
      const replayProviderStatuses: Record<string, ProviderRunStatus> = {};
      let lastProgress: AdminScrapeProgressPayload | null = null;

      for (const evt of session.events) {
        if (evt.kind === 'PROGRESS') {
          const payload = evt.payload as AdminScrapeProgressPayload;
          lastProgress = payload;
          if (payload.provider !== 'all') {
            replayProviderStatuses[payload.provider] = {
              currentPage: payload.currentPage,
              error: payload.error,
              jobsCreated: payload.jobsCreated,
              jobsFetched: payload.jobsFetched,
              jobsSkipped: payload.jobsSkipped,
              jobsUpdated: payload.jobsUpdated,
              provider: payload.provider,
              status:
                payload.status === 'starting' ? 'fetching' : payload.status,
              totalPages: payload.totalPages,
            };
          }
          const level: LogEntry['level'] =
            payload.status === 'error'
              ? 'error'
              : payload.status === 'complete'
                ? 'success'
                : 'info';
          replayLogs.push({
            id: `replay-${evt.id}-msg`,
            level,
            message: payload.message,
            timestamp: new Date(evt.emittedAt),
          });
        } else if (evt.kind === 'REQUEST_LOG') {
          const inner = evt.payload as {
            provider?: string;
            requestLog: NonNullable<AdminScrapeProgressPayload['requestLog']>;
          };
          const log = inner.requestLog;
          replayRequestLogs.push({
            id: `replay-${evt.id}`,
            page: log.page,
            provider: inner.provider ?? 'unknown',
            requestUrl: maskSensitiveLogText(log.requestUrl),
            responseBodyPreview: maskSensitiveLogText(log.responseBodyPreview),
            responseStatus: log.responseStatus,
            timestamp: new Date(log.timestamp),
          });
        }
      }

      setProgress(lastProgress);
      setProviderStatuses(replayProviderStatuses);
      setLogs(replayLogs);
      setRequestLogs(replayRequestLogs);
      setReplaySessionId(sessionId);
      setIsHistoryOpen(false);
      setIsRunning(false);
    } finally {
      setIsLoadingReplay(false);
    }
  }, []);

  // ── Actions ────────────────────────────────────────────
  const getProviderOverride = useCallback(
    (provider: string): ProviderOverrideState =>
      providerOverrides[provider] ?? DEFAULT_PROVIDER_OVERRIDE,
    [providerOverrides],
  );

  const updateProviderOverride = useCallback(
    (provider: string, updates: Partial<ProviderOverrideState>) => {
      setProviderOverrides(prev => ({
        ...prev,
        [provider]: {
          ...DEFAULT_PROVIDER_OVERRIDE,
          ...prev[provider],
          ...updates,
        },
      }));
    },
    [],
  );

  const clearProviderOverride = useCallback((provider: string) => {
    setProviderOverrides(prev => ({
      ...prev,
      [provider]: DEFAULT_PROVIDER_OVERRIDE,
    }));
  }, []);

  const getProviderOption = useCallback(
    (provider: ManualProviderId): ManualProviderOption =>
      MANUAL_PROVIDER_OPTIONS.find(option => option.value === provider) ??
      MANUAL_PROVIDER_OPTIONS[0],
    [],
  );

  const combinedLocation = useMemo(() => {
    const cityValue = city.trim();
    const countryValue = country.trim();
    const stateValue = stateCode
      ? US_STATES[stateCode as keyof typeof US_STATES]
      : '';
    const locationParts = [cityValue, stateValue, countryValue].filter(Boolean);

    return locationParts.length > 0 ? locationParts.join(', ') : undefined;
  }, [city, country, stateCode]);

  const currentSearchLocation = remote ? undefined : combinedLocation;

  const isCurrentSearchSaved = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const normalizedLocation = (currentSearchLocation ?? '')
      .trim()
      .toLowerCase();
    if (!normalizedSearch) return false;

    return savedSearches.some(
      savedSearch =>
        savedSearch.searchTerm.trim().toLowerCase() === normalizedSearch &&
        (savedSearch.location ?? '').trim().toLowerCase() ===
          normalizedLocation,
    );
  }, [currentSearchLocation, savedSearches, searchTerm]);

  const saveCurrentSearch = useCallback(async () => {
    const trimmedSearchTerm = searchTerm.trim();
    if (!trimmedSearchTerm) return;

    const location = currentSearchLocation?.trim() || null;
    setIsSavingSearch(true);
    try {
      const response = await fetch('/api/job-searches', {
        body: JSON.stringify({
          filters: {
            location: location ?? '',
            maxPages: globalMaxPages || undefined,
            postedWithin:
              globalDateRange === 'all' ? undefined : globalDateRange,
            remote,
            search: trimmedSearchTerm,
          },
          location,
          searchTerm: trimmedSearchTerm,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        const error = (await response.json().catch(() => null)) as {
          error?: string;
          message?: string;
        } | null;
        throw new Error(
          error?.error ?? error?.message ?? 'Failed to save search',
        );
      }

      const savedSearch = (await response.json()) as {
        id: string;
        location?: string | null;
        searchTerm: string;
      };
      setSavedSearches(prev => {
        const next = [
          {
            id: savedSearch.id,
            location: savedSearch.location ?? undefined,
            searchTerm: savedSearch.searchTerm,
          },
          ...prev.filter(
            item =>
              item.id !== savedSearch.id &&
              !(
                item.searchTerm.trim().toLowerCase() ===
                  trimmedSearchTerm.toLowerCase() &&
                (item.location ?? '').trim().toLowerCase() ===
                  (location ?? '').toLowerCase()
              ),
          ),
        ];

        return next.slice(0, 20);
      });
    } catch (error) {
      addLog(
        `Failed to save search: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    } finally {
      setIsSavingSearch(false);
    }
  }, [
    addLog,
    currentSearchLocation,
    globalDateRange,
    globalMaxPages,
    remote,
    searchTerm,
  ]);

  const getEffectiveProviderConfig = useCallback(
    (provider: ManualProviderId) => {
      const override = getProviderOverride(provider);
      const providerOption = getProviderOption(provider);
      const inheritedLocation = providerOption.inheritGlobalLocation ?? true;
      const inheritedMaxPages = providerOption.inheritGlobalMaxPages ?? true;
      const inheritedSearch = providerOption.inheritGlobalSearch ?? true;

      return {
        insertAnyway:
          override.insertAnyway === 'inherit'
            ? insertAnyway
            : override.insertAnyway === 'true',
        location:
          override.location.trim() ||
          (inheritedLocation ? combinedLocation : undefined),
        maxPages: providerOption.supportsMaxPages
          ? override.maxPages
            ? Number.parseInt(override.maxPages, 10) ||
              providerOption.defaultMaxPages
            : inheritedMaxPages && globalMaxPages
              ? Number.parseInt(globalMaxPages, 10) ||
                providerOption.defaultMaxPages
              : providerOption.defaultMaxPages
          : providerOption.defaultMaxPages,
        mode: (() => {
          if (!providerOption.supportsMode) return undefined;
          if (override.mode !== 'inherit') return override.mode;
          // Normalize global date range to mode for Fantastic
          const dateRangeDays = override.postedWithin
            ? Number(override.postedWithin)
            : globalDateRange !== 'all'
              ? Number(globalDateRange)
              : 0;
          if (dateRangeDays > 0 && dateRangeDays <= 3) return 'sync' as const;
          if (dateRangeDays > 3 && dateRangeDays <= 7) return 'weekly' as const;
          if (dateRangeDays > 7) return 'backfill' as const;
          return providerOption.defaultMode;
        })(),
        postedWithin:
          override.postedWithin ||
          (globalDateRange !== 'all' ? globalDateRange : undefined),
        remote:
          override.remote === 'inherit' ? remote : override.remote === 'true',
        searchTerm:
          override.searchTerm.trim() ||
          (inheritedSearch ? searchTerm.trim() || undefined : undefined),
      };
    },
    [
      combinedLocation,
      getProviderOption,
      getProviderOverride,
      globalDateRange,
      globalMaxPages,
      insertAnyway,
      remote,
      searchTerm,
    ],
  );

  const PROVIDER_LIMITS: Record<
    string,
    { field: 'apiRequests' | 'jobsFetched'; label: string; limit: number }
  > = {
    adzuna: { field: 'apiRequests', label: '2,500 requests/mo', limit: 2500 },
    fantastic: { field: 'jobsFetched', label: '50,000 jobs/mo', limit: 50000 },
    serpapi: { field: 'apiRequests', label: '5,000 searches/mo', limit: 5000 },
  };

  const getProviderLimitStatus = useCallback(
    (
      provider: string,
    ): { blocked: boolean; message: string | null; percent: number } => {
      const limitConfig = PROVIDER_LIMITS[provider];
      if (!limitConfig) return { blocked: false, message: null, percent: 0 };

      const budget = providerBudgets.find(b => b.provider === provider);
      if (!budget) return { blocked: false, message: null, percent: 0 };

      const used = budget[limitConfig.field];
      const percent = Math.round((used / limitConfig.limit) * 100);

      if (used >= limitConfig.limit) {
        return {
          blocked: true,
          message: `Limit reached: ${used.toLocaleString()} / ${limitConfig.limit.toLocaleString()} (${limitConfig.label})`,
          percent: 100,
        };
      }

      const remaining = limitConfig.limit - used;
      if (remaining < limitConfig.limit * 0.05) {
        return {
          blocked: false,
          message: `Almost at limit: ${remaining.toLocaleString()} remaining of ${limitConfig.label}`,
          percent,
        };
      }

      return { blocked: false, message: null, percent };
    },
    [providerBudgets],
  );

  const startScrape = async (provider: ManualProviderId) => {
    const providerBudget = providerBudgetMap.get(provider);
    if (providerBudget?.runtimeAvailable === false) {
      setProviderEnabled(prev => ({
        ...prev,
        [provider]: false,
      }));
      addLog(
        `${provider}: unavailable — ${providerBudget.unavailableReason ?? 'Provider runtime unavailable'}`,
        'error',
      );
      return;
    }

    const limitStatus = getProviderLimitStatus(provider);
    if (limitStatus.blocked) {
      addLog(`${provider}: blocked — ${limitStatus.message}`, 'error');
      return;
    }

    const effectiveConfig = getEffectiveProviderConfig(provider);
    const providerOption = getProviderOption(provider);

    recordSearchTermInHistory(effectiveConfig.searchTerm ?? searchTerm);
    setReplaySessionId(null);
    replaySessionIdRef.current = null;
    setIsRunning(true);
    setRunningProvider(provider);
    setActiveScrapeId(null);
    setProgress(null);
    setLogs([]);
    setRequestLogs([]);
    setProviderStatuses({});
    seenRecentInsertKeysRef.current = new Set();
    seenRecentUpdateKeysRef.current = new Set();
    seenDiagnosticLogKeysRef.current = new Set();
    seenRejectedPreviewKeysRef.current = new Set();
    progressTotalsRef.current = {};
    setSkipBreakdownByProvider({});
    skipBreakdownSeenKeysRef.current = new Set();

    addLog(
      providerOption.supportsMode
        ? `Starting ${effectiveConfig.mode} scrape for: ${provider}`
        : `Starting scrape for: ${provider}`,
      'info',
    );

    try {
      const response = await fetch('/api/admin/scrape', {
        body: JSON.stringify({
          ...(effectiveConfig.mode ? { mode: effectiveConfig.mode } : {}),
          city: city || undefined,
          country: country || undefined,
          globalDateRange:
            globalDateRange === 'all' ? undefined : globalDateRange,
          insertAnyway: effectiveConfig.insertAnyway,
          location: effectiveConfig.location,
          maxPages: effectiveConfig.maxPages,
          postedWithin: effectiveConfig.postedWithin,
          providers: [provider],
          remote: effectiveConfig.remote,
          searchTerm: effectiveConfig.searchTerm,
          stateCode: stateCode || undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        addLog(
          `Failed to start scrape: ${error.error || 'Unknown error'}`,
          'error',
        );
        setIsRunning(false);
        setRunningProvider(null);
        return;
      }

      const result = await response.json();
      if (typeof result?.scrapeId === 'string') {
        setActiveScrapeId(result.scrapeId);
      }
      addLog(
        providerOption.supportsMode
          ? `Scrape initiated: ${provider} (${result.mode}, max ${result.maxPages} pages).`
          : `Scrape initiated: ${provider}.`,
        'info',
      );
    } catch (error) {
      addLog(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
      setIsRunning(false);
      setRunningProvider(null);
    }
  };

  const startAllScrapes = async () => {
    recordSearchTermInHistory(searchTerm);
    setReplaySessionId(null);
    replaySessionIdRef.current = null;
    setIsRunning(true);
    setRunningProvider(null);
    setActiveScrapeId(null);
    setProgress(null);
    setLogs([]);
    setRequestLogs([]);
    setProviderStatuses({});
    seenRecentInsertKeysRef.current = new Set();
    seenRecentUpdateKeysRef.current = new Set();
    seenDiagnosticLogKeysRef.current = new Set();
    seenRejectedPreviewKeysRef.current = new Set();
    progressTotalsRef.current = {};
    setSkipBreakdownByProvider({});
    skipBreakdownSeenKeysRef.current = new Set();

    const allProviders = MANUAL_PROVIDER_OPTIONS.map(o => o.value).filter(
      value =>
        (providerEnabled[value] ?? true) !== false &&
        providerBudgetMap.get(value)?.runtimeAvailable !== false,
    );
    if (allProviders.length === 0) {
      addLog('No providers enabled — nothing to run.', 'warn');
      setIsRunning(false);
      return;
    }
    addLog(
      `Starting scrape for enabled providers: ${allProviders.join(', ')}`,
      'info',
    );
    const providerOverridesForRun = Object.fromEntries(
      allProviders.map(provider => {
        const effectiveConfig = getEffectiveProviderConfig(provider);
        return [
          provider,
          {
            location: effectiveConfig.location,
            insertAnyway: effectiveConfig.insertAnyway,
            maxPages: effectiveConfig.maxPages,
            postedWithin: effectiveConfig.postedWithin,
            remote: effectiveConfig.remote,
            searchTerm: effectiveConfig.searchTerm,
          },
        ];
      }),
    );

    try {
      const response = await fetch('/api/admin/scrape', {
        body: JSON.stringify({
          city: city || undefined,
          country: country || undefined,
          globalDateRange:
            globalDateRange === 'all' ? undefined : globalDateRange,
          insertAnyway,
          location: combinedLocation,
          maxPages: 5,
          providerOverrides: providerOverridesForRun,
          providers: allProviders,
          remote,
          searchTerm,
          stateCode: stateCode || undefined,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        addLog(
          `Failed to start scrape: ${error.error || 'Unknown error'}`,
          'error',
        );
        setIsRunning(false);
        return;
      }

      const result = await response.json();
      if (typeof result?.scrapeId === 'string') {
        setActiveScrapeId(result.scrapeId);
      }
      addLog('All providers scrape initiated.', 'info');
    } catch (error) {
      addLog(
        `Network error: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
      setIsRunning(false);
    }
  };

  const stopScrape = async () => {
    // Prefer the scrapeId stashed at start time — it is set synchronously
    // from the POST response, so it is available immediately. Fall back to
    // progress.scrapeId from the most recent Pusher event (handles the
    // case where state got out of sync, e.g. across a hot reload).
    const scrapeId = activeScrapeId ?? progress?.scrapeId;
    addLog('Stopping scrape...', 'warn');
    setIsRunning(false);
    setRunningProvider(null);
    setActiveScrapeId(null);
    setProviderStatuses(prev =>
      Object.fromEntries(
        Object.entries(prev).map(([provider, status]) => [
          provider,
          {
            ...status,
            currentPage:
              status.totalPages > 0 ? status.totalPages : status.currentPage,
            status: 'complete',
          },
        ]),
      ),
    );

    if (!scrapeId) {
      addLog(
        'No scrapeId known yet — server-side cancel skipped (UI stopped only).',
        'warn',
      );
      return;
    }

    try {
      const response = await fetch('/api/admin/scrape', {
        body: JSON.stringify({ scrapeId }),
        headers: { 'Content-Type': 'application/json' },
        method: 'DELETE',
      });
      if (!response.ok) {
        const error = await response.json().catch(() => null);
        addLog(
          `Failed to cancel server-side scrape: ${error?.error ?? response.statusText}`,
          'error',
        );
        return;
      }
      addLog('Scrape cancelled on server.', 'warn');
    } catch (error) {
      addLog(
        `Failed to cancel server-side scrape: ${error instanceof Error ? error.message : String(error)}`,
        'error',
      );
    }
  };

  // ── Computed ───────────────────────────────────────────
  const progressPercent = useMemo(() => {
    const statuses = Object.values(providerStatuses);
    if (statuses.length === 0) {
      if (progress && progress.totalPages > 0)
        return Math.round((progress.currentPage / progress.totalPages) * 100);
      return 0;
    }
    const providerCount = runningProvider
      ? 1
      : isRunning
        ? MANUAL_PROVIDER_OPTIONS.length
        : Math.max(statuses.length, 1);

    const fractions = statuses.map(s => {
      if (s.status === 'complete' || s.status === 'error') return 1;
      if (s.totalPages > 0) {
        return Math.min(s.currentPage / s.totalPages, 1);
      }
      return 0;
    });
    const totalFraction = fractions.reduce((a, n) => a + n, 0);
    return Math.round((totalFraction / providerCount) * 100);
  }, [isRunning, providerStatuses, progress, runningProvider]);

  const runTotals = useMemo(() => {
    const statuses = Object.values(providerStatuses);
    if (statuses.length === 0) {
      return {
        jobsCreated: progress?.jobsCreated ?? 0,
        jobsFetched: progress?.jobsFetched ?? 0,
        jobsSkipped: progress?.jobsSkipped ?? 0,
        jobsUpdated: progress?.jobsUpdated ?? 0,
      };
    }
    return statuses.reduce(
      (acc, s) => ({
        jobsCreated: acc.jobsCreated + (s.jobsCreated ?? 0),
        jobsFetched: acc.jobsFetched + (s.jobsFetched ?? 0),
        jobsSkipped: acc.jobsSkipped + (s.jobsSkipped ?? 0),
        jobsUpdated: acc.jobsUpdated + (s.jobsUpdated ?? 0),
      }),
      { jobsCreated: 0, jobsFetched: 0, jobsSkipped: 0, jobsUpdated: 0 },
    );
  }, [providerStatuses, progress]);

  const skipBreakdownTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    for (const perProvider of Object.values(skipBreakdownByProvider)) {
      for (const [reason, value] of Object.entries(perProvider)) {
        totals[reason] = (totals[reason] ?? 0) + value;
      }
    }
    return totals;
  }, [skipBreakdownByProvider]);

  const allProviderStatusesTerminal = useMemo(() => {
    const statuses = Object.values(providerStatuses);
    return (
      statuses.length > 0 &&
      statuses.every(
        status => status.status === 'complete' || status.status === 'error',
      )
    );
  }, [providerStatuses]);

  const progressSummaryText = useMemo(() => {
    if (!progress) return null;
    if (progress.status === 'complete') {
      return 'Run complete';
    }
    if (progress.status === 'error') {
      return 'Run ended with errors';
    }
    const statuses = Object.values(providerStatuses);
    const isMultiProvider = progress.provider === 'all' || statuses.length > 1;
    if (isMultiProvider && statuses.length > 0) {
      const total = runningProvider
        ? 1
        : isRunning
          ? MANUAL_PROVIDER_OPTIONS.length
          : statuses.length;
      const done = statuses.filter(
        s => s.status === 'complete' || s.status === 'error',
      ).length;
      const active =
        progress.provider !== 'all'
          ? providerStatuses[progress.provider]
          : statuses.find(
              s => s.status === 'fetching' || s.status === 'persisting',
            );
      if (active) {
        return `Provider ${Math.min(done + 1, total)} of ${total} · ${formatScrapeProviderLabel(active.provider)}`;
      }
      return `${done} of ${total} providers complete`;
    }
    if (progress.currentPage > 0 && progress.totalPages > 0) {
      return `Page ${progress.currentPage} of ${progress.totalPages}`;
    }
    if (!isRunning && allProviderStatusesTerminal) {
      return 'Run complete';
    }
    return 'Waiting for provider updates';
  }, [
    allProviderStatusesTerminal,
    isRunning,
    progress,
    providerStatuses,
    runningProvider,
  ]);

  const paginationStopMessage = progress?.message.includes('ended pagination')
    ? progress.message
    : null;

  const requestsUsedPercent =
    liveUsageBudget.requestsLimit > 0
      ? Math.round(
          (liveUsageBudget.requestsUsed / liveUsageBudget.requestsLimit) * 100,
        )
      : 0;

  const providerAverages = useMemo(() => {
    const map = new Map<
      string,
      { avgCreated: number; avgFetched: number; runs: number }
    >();
    for (const budget of providerBudgets) {
      if (budget.providerRuns <= 0) continue;
      map.set(budget.provider, {
        avgCreated: budget.jobsCreated / budget.providerRuns,
        avgFetched: budget.jobsFetched / budget.providerRuns,
        runs: budget.providerRuns,
      });
    }
    return map;
  }, [providerBudgets]);

  const providerBudgetMap = useMemo(() => {
    const map = new Map<string, ProviderBudget>();
    for (const budget of providerBudgets) {
      map.set(budget.provider, budget);
    }
    return map;
  }, [providerBudgets]);

  const enabledProviderEstimate = useMemo(() => {
    let fetched = 0;
    let created = 0;
    let providersWithData = 0;
    for (const option of MANUAL_PROVIDER_OPTIONS) {
      if ((providerEnabled[option.value] ?? true) === false) continue;
      if (providerBudgetMap.get(option.value)?.runtimeAvailable === false) {
        continue;
      }
      const avg = providerAverages.get(option.value);
      if (!avg) continue;
      fetched += avg.avgFetched;
      created += avg.avgCreated;
      providersWithData += 1;
    }
    return {
      created: Math.round(created),
      fetched: Math.round(fetched),
      providersWithData,
    };
  }, [providerAverages, providerBudgetMap, providerEnabled]);

  useEffect(() => {
    const manualProviders = new Set(
      MANUAL_PROVIDER_OPTIONS.map(option => option.value),
    );
    const providersToDisable: string[] = [];

    for (const budget of providerBudgets) {
      if (
        budget.runtimeAvailable === false &&
        manualProviders.has(budget.provider as ManualProviderId)
      ) {
        providersToDisable.push(budget.provider);
        continue;
      }

      if (
        budget.lastStatus !== 'error' ||
        !budget.lastRunAt ||
        !manualProviders.has(budget.provider as ManualProviderId)
      ) {
        continue;
      }

      const failureKey = `${budget.provider}:${budget.lastScrapeId ?? budget.lastRunAt}`;
      if (autoDisabledFailureKeysRef.current.has(failureKey)) {
        continue;
      }

      autoDisabledFailureKeysRef.current.add(failureKey);
      providersToDisable.push(budget.provider);
    }

    if (providersToDisable.length === 0) return;

    setProviderEnabled(prev => {
      let changed = false;
      const next = { ...prev };

      for (const provider of providersToDisable) {
        if ((next[provider] ?? true) !== false) {
          next[provider] = false;
          changed = true;
        }
      }

      return changed ? next : prev;
    });
  }, [providerBudgets]);

  const enabledCount = useMemo(
    () =>
      MANUAL_PROVIDER_OPTIONS.filter(
        option =>
          (providerEnabled[option.value] ?? true) !== false &&
          providerBudgetMap.get(option.value)?.runtimeAvailable !== false,
      ).length,
    [providerBudgetMap, providerEnabled],
  );

  const availableProviderCount = useMemo(
    () =>
      MANUAL_PROVIDER_OPTIONS.filter(
        option =>
          providerBudgetMap.get(option.value)?.runtimeAvailable !== false,
      ).length,
    [providerBudgetMap],
  );

  const allProvidersEnabled =
    availableProviderCount > 0 && enabledCount === availableProviderCount;
  const noneEnabled = enabledCount === 0;

  const toggleAllProviders = useCallback(
    (checked: boolean) => {
      setProviderEnabled(() => {
        const next: Record<string, boolean> = {};
        for (const option of MANUAL_PROVIDER_OPTIONS) {
          next[option.value] =
            checked &&
            providerBudgetMap.get(option.value)?.runtimeAvailable !== false;
        }
        return next;
      });
    },
    [providerBudgetMap],
  );

  const cronStatusMap = useMemo(() => {
    const map = new Map<CronProviderStatus['provider'], CronProviderStatus>();
    for (const status of cronStatuses) {
      map.set(status.provider, status);
    }
    return map;
  }, [cronStatuses]);

  // ── Render ─────────────────────────────────────────────
  return (
    <>
      {/* ━━━━ ANALYTICS TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'analytics' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {[
              {
                title: 'Total Listings',
                value: analytics.totalListings.toLocaleString(),
              },
              {
                title: 'Created 24h',
                value: analytics.created24h.toLocaleString(),
              },
              {
                title: 'Created 7d',
                value: analytics.created7d.toLocaleString(),
              },
              {
                title: 'Unreviewed',
                value: analytics.unreviewedListings.toLocaleString(),
              },
              {
                title: 'Dismissed',
                value: analytics.dismissedListings.toLocaleString(),
              },
              {
                helper: `${analytics.leadsConverted.toLocaleString()} moved to leads`,
                title: 'Lead Conversion',
                value: `${analytics.conversionRate}%`,
              },
            ].map(card => (
              <div
                key={card.title}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-md"
              >
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {card.title}
                </p>
                <p className="font-mono text-xl font-semibold">{card.value}</p>
                {card.helper ? (
                  <p className="text-xs text-muted-foreground">{card.helper}</p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="text-lg font-semibold">Recent Listings</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Latest 15 ingested listings.
              </p>

              {analytics.recentListings.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No listings ingested yet. Switch to the Ingestion tab to check
                  cron schedules, or use the Manual tab to run a scrape.
                </p>
              ) : (
                <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] backdrop-blur-md">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-b border-white/[0.06] px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                    <span>Title / Company</span>
                    <span>Provider</span>
                    <span>Date</span>
                  </div>
                  <div className="divide-y divide-white/[0.04]">
                    {analytics.recentListings.map(listing => (
                      <div
                        key={listing.id}
                        className="grid grid-cols-[1fr_auto_auto] items-center gap-x-3 px-3 py-2.5 transition-colors hover:bg-white/[0.03]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium leading-tight">
                            {listing.title}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {listing.company ?? '—'}
                          </p>
                        </div>
                        <Badge variant="secondary" className="text-[10px]">
                          {listing.provider ?? '?'}
                        </Badge>
                        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
                          {new Date(listing.createdAt).toLocaleDateString(
                            undefined,
                            { day: 'numeric', month: 'short' },
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold">Provider Breakdown</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                Total listings by source provider.
              </p>

              {analytics.providerBreakdown.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No provider data yet. Run a scrape from the Ingestion or
                  Manual tab to start ingesting listings.
                </p>
              ) : (
                <div className="max-w-lg overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.03] backdrop-blur-md">
                  {analytics.providerBreakdown.map((row, index) => (
                    <div
                      key={row.provider}
                      className={`${index > 0 ? 'border-t border-white/[0.06]' : ''} px-3 py-3`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">
                          {row.provider}
                        </span>
                        <span className="font-mono text-sm text-muted-foreground">
                          {row.count.toLocaleString()}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1.5 flex-1 rounded-full bg-white/[0.06]">
                          <div
                            className="h-1.5 rounded-full bg-primary transition-all"
                            style={{ width: `${Math.max(2, row.percentage)}%` }}
                          />
                        </div>
                        <span className="w-10 text-right font-mono text-[11px] text-muted-foreground">
                          {row.percentage}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* ━━━━ INGESTION TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'ingestion' ? (
        <div className="space-y-6">
          {/* Provider Budget */}
          <div>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Provider Budget</h2>
                <p className="text-sm text-muted-foreground">
                  Monthly quotas and live consumption per source.
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                <Badge variant="secondary" className="text-[10px]">
                  {isRefreshingUsage ? 'Refreshing...' : 'Live'}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {lastUsageRefreshAt
                    ? lastUsageRefreshAt.toLocaleTimeString()
                    : ''}
                </span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              {/* Fantastic */}
              <Card className="border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-md">
                <p className="font-medium">Fantastic</p>
                <p className="font-mono text-lg font-semibold">
                  {liveUsageBudget.jobsLimit.toLocaleString()} jobs/mo
                </p>
                <div className="mt-2 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Jobs</span>
                    <span className="font-mono">
                      {liveUsageBudget.jobsUsed.toLocaleString()} /{' '}
                      {liveUsageBudget.jobsLimit.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(
                      100,
                      liveUsageBudget.jobsLimit > 0
                        ? Math.round(
                            (liveUsageBudget.jobsUsed /
                              liveUsageBudget.jobsLimit) *
                              100,
                          )
                        : 0,
                    )}
                    className="h-1.5"
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Requests</span>
                    <span className="font-mono">
                      {liveUsageBudget.requestsUsed.toLocaleString()} /{' '}
                      {liveUsageBudget.requestsLimit.toLocaleString()}
                    </span>
                  </div>
                  <Progress
                    value={Math.min(100, requestsUsedPercent)}
                    className="h-1.5"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Cron 06:00 UTC
                </p>
              </Card>

              {/* SerpAPI */}
              <Card className="border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-md">
                <p className="font-medium">SerpAPI</p>
                {liveSerpApiBudget ? (
                  <>
                    <p className="font-mono text-lg font-semibold">
                      {liveSerpApiBudget.searchesLimit.toLocaleString()}{' '}
                      searches/mo
                    </p>
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Searches</span>
                        <span className="font-mono">
                          {liveSerpApiBudget.searchesUsed.toLocaleString()} /{' '}
                          {liveSerpApiBudget.searchesLimit.toLocaleString()}
                        </span>
                      </div>
                      <Progress
                        value={Math.min(
                          100,
                          liveSerpApiBudget.searchesLimit > 0
                            ? Math.round(
                                (liveSerpApiBudget.searchesUsed /
                                  liveSerpApiBudget.searchesLimit) *
                                  100,
                              )
                            : 0,
                        )}
                        className="h-1.5"
                      />
                      <p className="text-xs text-muted-foreground">
                        {liveSerpApiBudget.searchesRemaining.toLocaleString()}{' '}
                        remaining
                      </p>
                    </div>
                  </>
                ) : (
                  <p className="font-mono text-lg font-semibold">~5,000/mo</p>
                )}
                <p className="mt-2 text-xs text-muted-foreground">
                  Cron 07:00 UTC
                </p>
              </Card>

              {/* USAJobs */}
              <Card className="border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-md">
                <p className="font-medium">USAJobs</p>
                <p className="font-mono text-lg font-semibold text-emerald-600">
                  Unlimited
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Free government API, no rate limits.
                </p>
                <p className="text-sm text-muted-foreground">
                  Safe for both scheduled and manual runs.
                </p>
              </Card>
            </div>

            {providerBudgets.length > 0 ? (
              <div className="mt-6">
                <h3 className="mb-3 text-sm font-semibold">
                  All providers — this month
                </h3>
                <Card className="overflow-x-auto border-white/[0.06] bg-white/[0.03] backdrop-blur-md">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-white/[0.06] hover:bg-transparent">
                        <TableHead className="h-10 min-w-32 px-4 text-xs">
                          Provider
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs">
                          Runs
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs">
                          API Reqs
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs">
                          Fetched
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs">
                          Created
                        </TableHead>
                        <TableHead className="h-10 px-4 text-right text-xs">
                          Updated
                        </TableHead>
                        <TableHead className="h-10 min-w-44 px-4 text-xs">
                          Limits
                        </TableHead>
                        <TableHead className="h-10 min-w-28 px-4 text-right text-xs">
                          Last run
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providerBudgets.map(pb => (
                        <TableRow
                          key={pb.provider}
                          className="border-white/[0.05] hover:bg-white/[0.02]"
                        >
                          <TableCell className="px-4 py-3 text-xs font-medium capitalize">
                            {formatScrapeProviderLabel(pb.provider)}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono text-xs">
                            {pb.providerRuns}
                            {pb.failedRuns > 0 ? (
                              <span className="ml-1 text-rose-400/90">
                                ({pb.failedRuns} err)
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono text-xs">
                            {pb.apiRequests.toLocaleString()}
                            {pb.rateLimit?.monthly ? (
                              <span className="ml-1 text-muted-foreground">
                                / {pb.rateLimit.monthly.toLocaleString()}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono text-xs">
                            {pb.jobsFetched.toLocaleString()}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono text-xs text-emerald-400/90">
                            {pb.jobsCreated.toLocaleString()}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right font-mono text-xs text-sky-400/90">
                            {pb.jobsUpdated.toLocaleString()}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-xs text-muted-foreground">
                            {pb.rateLimit?.note ?? '—'}
                          </TableCell>
                          <TableCell className="px-4 py-3 text-right text-xs text-muted-foreground">
                            {pb.lastRunAt
                              ? new Date(pb.lastRunAt).toLocaleDateString(
                                  'en-US',
                                  {
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                    month: 'short',
                                  },
                                )
                              : '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Card>
              </div>
            ) : null}
          </div>

          {/* Cron Jobs */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Cron Jobs</h2>
                {scheduleSource ? (
                  <Badge
                    variant={
                      scheduleSource === 'vercel-cloud'
                        ? 'default'
                        : 'secondary'
                    }
                    className="text-[10px] font-normal"
                  >
                    {scheduleSource === 'vercel-cloud'
                      ? 'Live from Vercel'
                      : 'Not deployed'}
                  </Badge>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => fetchCronStatus()}
                disabled={isLoadingCronStatus}
              >
                {isLoadingCronStatus ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCw className="h-3.5 w-3.5" />
                )}
                Refresh
              </Button>
            </div>
            <p className="mb-4 text-sm text-muted-foreground">
              All scheduled cron jobs with manual trigger controls.
            </p>

            <div className="space-y-4">
              {ALL_CRON_JOBS.map(cron => {
                const providerStatus =
                  cron.id === 'fantastic' || cron.id === 'serpapi'
                    ? cronStatusMap.get(cron.id)
                    : null;
                const isTriggering = cronTriggering.has(cron.id);
                const result = cronResults.get(cron.id);

                return (
                  <Card
                    key={cron.id}
                    className="group border-white/[0.06] bg-white/[0.03] p-4 transition-colors hover:border-white/[0.12]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{cron.name}</p>
                          <Badge
                            variant="outline"
                            className="text-[10px] font-normal"
                          >
                            {cron.category}
                          </Badge>
                          {providerStatus ? (
                            <Badge
                              variant={
                                providerStatus.lastStatus === 'success'
                                  ? 'default'
                                  : providerStatus.lastStatus === 'error'
                                    ? 'destructive'
                                    : 'secondary'
                              }
                              className="text-[10px]"
                            >
                              {providerStatus.lastStatus}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                          {cron.description}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {humanizeCron(cron.schedule)}
                          </span>
                          <code className="rounded bg-muted/60 px-1.5 py-0.5 font-mono">
                            {cron.schedule}
                          </code>
                          <span className="flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {cron.constraints}
                          </span>
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {providerStatus?.lastRunAt
                              ? `Last run: ${new Date(providerStatus.lastRunAt).toLocaleString()}`
                              : 'No run data'}
                          </span>
                          {result ? (
                            <span
                              className={`flex items-center gap-1 ${result.success ? 'text-emerald-500' : 'text-red-500'}`}
                            >
                              {result.success ? (
                                <CheckCircle2 className="h-3 w-3" />
                              ) : (
                                <AlertCircle className="h-3 w-3" />
                              )}
                              Manual trigger{' '}
                              {result.success ? 'succeeded' : 'failed'}{' '}
                              {new Date(
                                result.triggeredAt,
                              ).toLocaleTimeString()}
                              {result.error ? `: ${result.error}` : ''}
                            </span>
                          ) : null}
                        </div>
                        {providerStatus?.lastError ? (
                          <p className="mt-1 text-xs text-red-400">
                            Error: {providerStatus.lastError}
                          </p>
                        ) : null}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="shrink-0"
                        disabled={isTriggering}
                        onClick={() => triggerCronJob(cron.id, cron.path)}
                      >
                        {isTriggering ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5" />
                        )}
                        {isTriggering ? 'Running...' : 'Run Now'}
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}

      {/* ━━━━ MANUAL TAB ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
      {activeTab === 'manual' ? (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Scrape Controls */}
            <div>
              <h2 className="text-lg font-semibold">Scrape Controls</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Set global defaults, then run providers individually from their
                own cards below.
              </p>

              <div className="space-y-4 rounded-lg border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-md">
                <div className="space-y-4 rounded-2xl border border-white/[0.075] bg-white/[0.03] px-4 pb-4 pt-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="flex items-center gap-1 pt-6">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 border-white/[0.08] bg-black/25 text-foreground/70 hover:border-white/[0.12] hover:bg-black/35 hover:text-foreground"
                            aria-label="Saved searches"
                          >
                            <Star
                              className={`h-4 w-4 ${
                                isCurrentSearchSaved
                                  ? 'fill-current text-primary'
                                  : ''
                              }`}
                            />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                          <DropdownMenuItem
                            disabled={
                              !searchTerm.trim() ||
                              isSavingSearch ||
                              isCurrentSearchSaved
                            }
                            onSelect={() => {
                              void saveCurrentSearch();
                            }}
                          >
                            {isSavingSearch ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : isCurrentSearchSaved ? (
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                            ) : (
                              <Star className="h-4 w-4" />
                            )}
                            {isCurrentSearchSaved
                              ? 'Search saved'
                              : 'Save current search'}
                          </DropdownMenuItem>
                          {savedSearches.length === 0 ? (
                            <DropdownMenuItem disabled>
                              No saved searches
                            </DropdownMenuItem>
                          ) : (
                            savedSearches.map(item => (
                              <DropdownMenuItem
                                key={item.id}
                                onSelect={() => setSearchTerm(item.searchTerm)}
                                className="flex flex-col items-start gap-0.5"
                              >
                                <span className="text-sm">
                                  {item.searchTerm}
                                </span>
                                {item.location ? (
                                  <span className="text-xs text-muted-foreground">
                                    {item.location}
                                  </span>
                                ) : null}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="h-9 w-9 shrink-0 border-white/[0.08] bg-black/25 text-foreground/70 hover:border-white/[0.12] hover:bg-black/35 hover:text-foreground"
                            aria-label="Recent search terms"
                          >
                            <History className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-72">
                          {searchHistory.length === 0 ? (
                            <DropdownMenuItem disabled>
                              No recent searches
                            </DropdownMenuItem>
                          ) : (
                            searchHistory.map(term => (
                              <DropdownMenuItem
                                key={term}
                                onSelect={() => setSearchTerm(term)}
                                className="text-sm"
                              >
                                {term}
                              </DropdownMenuItem>
                            ))
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <Label htmlFor="searchTerm" className="text-xs">
                        Search Term
                      </Label>
                      <Input
                        id="searchTerm"
                        placeholder="e.g. software engineer"
                        value={searchTerm}
                        onChange={event => setSearchTerm(event.target.value)}
                      />
                    </div>
                    <div className="self-start space-y-1">
                      <Label
                        htmlFor="global-insert-anyway"
                        className="block text-xs"
                      >
                        Insert anyway
                      </Label>
                      <div className="flex h-9 items-center">
                        <Switch
                          id="global-insert-anyway"
                          checked={insertAnyway}
                          onCheckedChange={setInsertAnyway}
                          aria-label="Insert fetched jobs even when they do not match filters"
                        />
                      </div>
                    </div>
                    <div className="self-start space-y-1">
                      <Label
                        htmlFor="global-remote-only"
                        className="block text-xs"
                      >
                        Remote only
                      </Label>
                      <div className="flex h-9 items-center">
                        <Switch
                          id="global-remote-only"
                          checked={remote}
                          onCheckedChange={setRemote}
                          aria-label="Toggle remote only filter"
                        />
                      </div>
                    </div>
                  </div>

                  <div
                    className={`grid gap-2 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_180px] transition-opacity duration-300 ${remote ? 'pointer-events-none opacity-40' : ''}`}
                  >
                    <div className="space-y-1.5">
                      <Label htmlFor="city" className="text-xs">
                        City
                      </Label>
                      <Input
                        id="city"
                        placeholder="e.g. San Francisco"
                        value={city}
                        onChange={event => setCity(event.target.value)}
                        disabled={remote}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="state" className="text-xs">
                        State
                      </Label>
                      <Select
                        value={stateCode || '__none__'}
                        onValueChange={value =>
                          setStateCode(value === '__none__' ? '' : value)
                        }
                        disabled={remote}
                      >
                        <SelectTrigger id="state" className="w-full">
                          <SelectValue placeholder="State" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">No state</SelectItem>
                          {Object.entries(US_STATES).map(([code, name]) => (
                            <SelectItem key={code} value={code}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="country" className="text-xs">
                        Country
                      </Label>
                      <Select
                        value={country}
                        onValueChange={setCountry}
                        disabled={remote}
                      >
                        <SelectTrigger id="country" className="w-full">
                          <SelectValue placeholder="Country" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="United States">US</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-start gap-3">
                    <div className="w-24 space-y-1.5">
                      <Label htmlFor="global-max-pages" className="text-xs">
                        Max pages
                      </Label>
                      <Input
                        id="global-max-pages"
                        type="number"
                        min={1}
                        max={50}
                        value={globalMaxPages}
                        onChange={event =>
                          setGlobalMaxPages(event.target.value)
                        }
                        placeholder="Default"
                      />
                    </div>
                    <div className="w-44 space-y-1.5">
                      <Label htmlFor="global-date-range" className="text-xs">
                        Date range
                      </Label>
                      <Select
                        value={globalDateRange}
                        onValueChange={v =>
                          setGlobalDateRange(v as typeof globalDateRange)
                        }
                      >
                        <SelectTrigger id="global-date-range">
                          <SelectValue placeholder="Any time" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Any time</SelectItem>
                          <SelectItem value="1">Past 24h</SelectItem>
                          <SelectItem value="3">Past 3 days</SelectItem>
                          <SelectItem value="7">Past week</SelectItem>
                          <SelectItem value="14">Past 2 weeks</SelectItem>
                          <SelectItem value="30">Past month</SelectItem>
                          <SelectItem value="90">Past 3 months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end">
                    {isRunning && !runningProvider ? (
                      <Button
                        onClick={stopScrape}
                        variant="destructive"
                        size="sm"
                      >
                        <Square className="h-3.5 w-3.5" />
                        Stop All
                      </Button>
                    ) : (
                      <Button
                        onClick={startAllScrapes}
                        disabled={isRunning || !searchTerm.trim()}
                        size="sm"
                      >
                        {isRunning ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        Run All
                      </Button>
                    )}
                  </div>
                </div>

                <div className="rounded-lg bg-primary/5 px-3 py-2.5 ring-1 ring-inset ring-primary/15">
                  <div className="text-[11px] text-muted-foreground">
                    Next run estimate{' '}
                    <span className="text-muted-foreground/60">
                      (avg across {enabledProviderEstimate.providersWithData}{' '}
                      providers with history)
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                    <span className="text-foreground">
                      ~{enabledProviderEstimate.fetched.toLocaleString()}{' '}
                      <span className="text-muted-foreground">fetched</span>
                    </span>
                    <span className="text-green-500">
                      ~{enabledProviderEstimate.created.toLocaleString()}{' '}
                      <span className="text-muted-foreground">created</span>
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3 px-3">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground">
                        Provider runs
                      </p>
                      <span className="text-[10px] text-muted-foreground">
                        {enabledCount} of {MANUAL_PROVIDER_OPTIONS.length}{' '}
                        enabled
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor="toggle-all-providers"
                        className="text-[10px] uppercase tracking-wider text-muted-foreground"
                      >
                        Toggle all
                      </Label>
                      <Switch
                        id="toggle-all-providers"
                        checked={allProvidersEnabled}
                        onCheckedChange={toggleAllProviders}
                        aria-label="Toggle all providers"
                        size="sm"
                      />
                    </div>
                  </div>

                  {noneEnabled ? (
                    <p className="text-[11px] text-amber-400">
                      All providers disabled — enable at least one to run a
                      scrape.
                    </p>
                  ) : null}

                  <div className="overflow-hidden rounded-lg border border-white/[0.06]">
                    {MANUAL_PROVIDER_OPTIONS.map((option, optionIdx) => {
                      const pStatus = providerStatuses[option.value];
                      const isProviderActive =
                        isRunning &&
                        (pStatus?.status === 'fetching' ||
                          pStatus?.status === 'persisting');
                      const isProviderDone = pStatus?.status === 'complete';
                      const isProviderError = pStatus?.status === 'error';
                      const hasProviderProgress =
                        Boolean(pStatus) &&
                        pStatus.status !== 'idle' &&
                        pStatus.totalPages > 0;
                      const providerProgress =
                        pStatus && pStatus.totalPages > 0
                          ? Math.round(
                              (pStatus.currentPage / pStatus.totalPages) * 100,
                            )
                          : 0;
                      const avg = providerAverages.get(option.value);
                      const providerBudget = providerBudgetMap.get(
                        option.value,
                      );
                      const runtimeUnavailable =
                        providerBudget?.runtimeAvailable === false;
                      const lastRunFailed =
                        providerBudget?.lastStatus === 'error';
                      const failureMessage =
                        pStatus?.status === 'error'
                          ? pStatus.error
                          : runtimeUnavailable
                            ? providerBudget?.unavailableReason
                            : providerBudget?.lastError;
                      const providerErrorInfo =
                        lastRunFailed || runtimeUnavailable || isProviderError
                          ? getProviderErrorInfo(failureMessage)
                          : null;
                      const isEnabled = providerEnabled[option.value] ?? true;
                      const override = getProviderOverride(option.value);
                      const inheritsGlobalLocation =
                        option.inheritGlobalLocation ?? true;
                      const inheritsGlobalSearch =
                        option.inheritGlobalSearch ?? true;
                      const globalSearchLabel =
                        searchTerm.trim() || 'No keyword filter';
                      const providerRemoteChecked =
                        override.remote === 'inherit'
                          ? remote
                          : override.remote === 'true';
                      const providerInsertAnywayChecked =
                        override.insertAnyway === 'inherit'
                          ? insertAnyway
                          : override.insertAnyway === 'true';
                      const effectiveConfig = getEffectiveProviderConfig(
                        option.value,
                      );
                      const isExpanded = expandedProvider === option.value;
                      const limitStatus = getProviderLimitStatus(option.value);
                      const labelMatch = option.label.match(
                        /^(.*?)\s*\(([^)]+)\)\s*$/,
                      );
                      const baseLabel = labelMatch
                        ? labelMatch[1]
                        : option.label;
                      const qualifier = labelMatch ? labelMatch[2] : null;

                      return (
                        <div
                          key={option.value}
                          className={`group relative overflow-hidden backdrop-blur-md transition-colors duration-500 ${
                            optionIdx > 0 ? 'border-t border-white/[0.06]' : ''
                          } ${
                            isProviderError
                              ? 'bg-red-500/[0.03]'
                              : lastRunFailed || runtimeUnavailable
                                ? 'bg-red-500/[0.02]'
                                : isProviderDone
                                  ? 'bg-green-500/[0.03]'
                                  : 'bg-white/[0.03]'
                          } ${isEnabled ? '' : 'opacity-60'}`}
                        >
                          <div
                            className={`relative flex items-start gap-3 overflow-hidden px-3 ${
                              isExpanded
                                ? 'min-h-0 pb-0 pt-2.5'
                                : 'min-h-16 py-2'
                            }`}
                          >
                            {isProviderActive && (
                              <div className="pointer-events-none absolute inset-0 overflow-hidden">
                                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedProvider(current =>
                                  current === option.value
                                    ? null
                                    : option.value,
                                )
                              }
                              className="flex min-w-0 flex-1 items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                            >
                              <ChevronDown
                                className={`mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
                                  isExpanded ? 'rotate-180' : ''
                                }`}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="min-w-0 truncate font-medium text-foreground">
                                    {baseLabel}
                                  </p>
                                  {providerErrorInfo && (
                                    <span
                                      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] ${providerErrorInfo.badgeClassName}`}
                                    >
                                      {providerErrorInfo.badgeLabel}
                                    </span>
                                  )}
                                  {isProviderActive && (
                                    <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                                  )}
                                  {isProviderDone && (
                                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 animate-in fade-in text-green-500 duration-500" />
                                  )}
                                </div>
                                <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                                  <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                                    {option.sourceSummary}
                                  </span>
                                  {qualifier && (
                                    <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                                      {qualifier}
                                    </span>
                                  )}
                                  {avg ? (
                                    <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary/80">
                                      ~
                                      {Math.round(
                                        avg.avgFetched,
                                      ).toLocaleString()}{' '}
                                      / ~
                                      {Math.round(
                                        avg.avgCreated,
                                      ).toLocaleString()}
                                      <span className="ml-1 text-muted-foreground/60">
                                        fetched/created per run
                                      </span>
                                    </span>
                                  ) : (
                                    <span className="shrink-0 rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-muted-foreground/50">
                                      No run history yet
                                    </span>
                                  )}
                                </div>
                                {pStatus && pStatus.status !== 'idle' ? (
                                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-300">
                                    <span>{pStatus.jobsFetched} fetched</span>
                                    <span className="text-green-600">
                                      {pStatus.jobsCreated} created
                                    </span>
                                    <span className="text-blue-500">
                                      {pStatus.jobsUpdated} updated
                                    </span>
                                    {pStatus.jobsSkipped > 0 && (
                                      <span className="text-orange-500">
                                        {pStatus.jobsSkipped} skipped
                                      </span>
                                    )}
                                  </div>
                                ) : null}
                              </div>
                            </button>
                            {failureMessage &&
                              (isProviderError ||
                                lastRunFailed ||
                                runtimeUnavailable) && (
                                <ProviderRunError error={failureMessage} />
                              )}
                            <DropdownMenu modal={false}>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 shrink-0"
                                  aria-label={`More actions for ${option.label}`}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem
                                  onSelect={() =>
                                    openProviderDetails(option.value)
                                  }
                                >
                                  View run history
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                            <Switch
                              checked={isEnabled}
                              disabled={runtimeUnavailable}
                              onCheckedChange={checked =>
                                setProviderEnabled(prev => ({
                                  ...prev,
                                  [option.value]: checked,
                                }))
                              }
                              aria-label={`Enable ${option.label}`}
                              className="mt-1 shrink-0"
                              size="sm"
                            />
                          </div>
                          {hasProviderProgress && (
                            <div className="space-y-1.5 px-3 pb-2 animate-in fade-in slide-in-from-top-1 duration-300">
                              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span>Provider progress</span>
                                <span className="font-mono">
                                  {Math.min(
                                    pStatus?.currentPage ?? 0,
                                    pStatus?.totalPages ?? 0,
                                  )}{' '}
                                  / {pStatus?.totalPages ?? 0} pages
                                </span>
                              </div>
                              <Progress
                                value={providerProgress}
                                className="h-1"
                              />
                            </div>
                          )}
                          {isExpanded ? (
                            <div className="px-3 pb-3 pt-2">
                              <div className="space-y-3 rounded-2xl border border-white/[0.075] bg-[#141416]/60 px-4 pb-4 pt-3">
                                {isProviderError ||
                                lastRunFailed ||
                                runtimeUnavailable
                                  ? (() => {
                                      const isWarning =
                                        providerErrorInfo &&
                                        (providerErrorInfo.category ===
                                          'credits' ||
                                          providerErrorInfo.category ===
                                            'auth' ||
                                          providerErrorInfo.category ===
                                            'rateLimit' ||
                                          providerErrorInfo.category ===
                                            'runtime');
                                      const tone = isWarning
                                        ? {
                                            wrapper:
                                              'border-amber-500/20 bg-amber-500/[0.04] text-amber-100',
                                            header: 'text-amber-200',
                                            subdued: 'text-amber-200/60',
                                            body: 'text-amber-100/80',
                                          }
                                        : {
                                            wrapper:
                                              'border-red-500/15 bg-red-500/[0.04] text-red-100',
                                            header: 'text-red-200',
                                            subdued: 'text-red-200/60',
                                            body: 'text-red-100/80',
                                          };
                                      const headerLabel =
                                        providerErrorInfo?.badgeLabel ??
                                        (isProviderError
                                          ? 'Current run failed'
                                          : runtimeUnavailable
                                            ? 'Provider unavailable'
                                            : 'Last run failed');
                                      const summary =
                                        providerErrorInfo?.shortMessage;
                                      const raw =
                                        failureMessage ??
                                        'No error message was recorded for this failed run.';
                                      const showRaw =
                                        !summary || summary !== raw;
                                      return (
                                        <div
                                          className={`rounded-lg border p-3 text-xs ${tone.wrapper}`}
                                        >
                                          <div
                                            className={`flex flex-wrap items-center gap-2 font-medium ${tone.header}`}
                                          >
                                            <AlertCircle className="h-3.5 w-3.5" />
                                            <span>{headerLabel}</span>
                                            {providerBudget?.lastRunAt ? (
                                              <span
                                                className={`font-normal ${tone.subdued}`}
                                              >
                                                {new Date(
                                                  providerBudget.lastRunAt,
                                                ).toLocaleString()}
                                              </span>
                                            ) : null}
                                          </div>
                                          {summary ? (
                                            <p className={`mt-2 ${tone.body}`}>
                                              {summary}
                                            </p>
                                          ) : null}
                                          {showRaw ? (
                                            <pre
                                              className={`mt-2 max-h-36 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed ${tone.body}`}
                                            >
                                              {raw}
                                            </pre>
                                          ) : null}
                                        </div>
                                      );
                                    })()
                                  : null}

                                <fieldset
                                  disabled={!isEnabled || runtimeUnavailable}
                                  className={`space-y-3 ${isEnabled && !runtimeUnavailable ? '' : 'pointer-events-none opacity-50'}`}
                                >
                                  <div
                                    className={
                                      option.supportsRemote
                                        ? 'grid items-start gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)]'
                                        : 'grid items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(8rem,0.6fr)]'
                                    }
                                  >
                                    <div className="min-w-0 space-y-1.5">
                                      <Label
                                        htmlFor={`provider-search-${option.value}`}
                                        className="text-xs"
                                      >
                                        Search term
                                      </Label>
                                      <Input
                                        id={`provider-search-${option.value}`}
                                        value={override.searchTerm}
                                        onChange={event =>
                                          updateProviderOverride(option.value, {
                                            searchTerm: event.target.value,
                                          })
                                        }
                                        placeholder={
                                          inheritsGlobalSearch
                                            ? globalSearchLabel
                                            : 'No keyword filter'
                                        }
                                      />
                                    </div>

                                    {option.supportsRemote ? (
                                      <div className="min-w-0 space-y-1.5">
                                        <Label className="text-xs">
                                          Remote only
                                        </Label>
                                        <div className="flex items-start pt-1.5">
                                          <Switch
                                            checked={providerRemoteChecked}
                                            disabled={!isEnabled}
                                            onCheckedChange={checked =>
                                              updateProviderOverride(
                                                option.value,
                                                {
                                                  remote: checked
                                                    ? 'true'
                                                    : 'false',
                                                },
                                              )
                                            }
                                            aria-label={`Toggle remote only for ${option.label}`}
                                            size="sm"
                                          />
                                        </div>
                                      </div>
                                    ) : null}

                                    <div className="min-w-0 space-y-1.5">
                                      <Label className="text-xs">
                                        Insert anyway
                                      </Label>
                                      <div className="flex items-start pt-1.5">
                                        <Switch
                                          checked={providerInsertAnywayChecked}
                                          disabled={!isEnabled}
                                          onCheckedChange={checked =>
                                            updateProviderOverride(
                                              option.value,
                                              {
                                                insertAnyway: checked
                                                  ? 'true'
                                                  : 'false',
                                              },
                                            )
                                          }
                                          aria-label={`Insert fetched ${option.label} jobs even when they do not match filters`}
                                          size="sm"
                                        />
                                      </div>
                                    </div>
                                  </div>

                                  {option.supportsLocation ? (
                                    <div
                                      className={`grid gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)] transition-opacity duration-300 ${
                                        providerRemoteChecked
                                          ? 'pointer-events-none opacity-40'
                                          : ''
                                      }`}
                                    >
                                      <div className="min-w-0 space-y-1.5">
                                        <Label
                                          htmlFor={`provider-city-${option.value}`}
                                          className="text-xs"
                                        >
                                          City
                                        </Label>
                                        <Input
                                          id={`provider-city-${option.value}`}
                                          value={
                                            override.location
                                              .split(',')[0]
                                              ?.trim() || ''
                                          }
                                          onChange={event => {
                                            const parts = override.location
                                              .split(',')
                                              .map(part => part.trim());
                                            parts[0] = event.target.value;
                                            updateProviderOverride(
                                              option.value,
                                              {
                                                location: parts
                                                  .filter(Boolean)
                                                  .join(', '),
                                              },
                                            );
                                          }}
                                          placeholder={
                                            inheritsGlobalLocation
                                              ? city || 'City'
                                              : 'City'
                                          }
                                          disabled={providerRemoteChecked}
                                        />
                                      </div>
                                      <div className="min-w-0 space-y-1.5">
                                        <Label
                                          htmlFor={`provider-state-${option.value}`}
                                          className="text-xs"
                                        >
                                          State
                                        </Label>
                                        <Input
                                          id={`provider-state-${option.value}`}
                                          value={
                                            override.location
                                              .split(',')[1]
                                              ?.trim() || ''
                                          }
                                          onChange={event => {
                                            const parts = override.location
                                              .split(',')
                                              .map(part => part.trim());
                                            while (parts.length < 2)
                                              parts.push('');
                                            parts[1] = event.target.value;
                                            updateProviderOverride(
                                              option.value,
                                              {
                                                location: parts
                                                  .filter(Boolean)
                                                  .join(', '),
                                              },
                                            );
                                          }}
                                          placeholder={
                                            inheritsGlobalLocation
                                              ? stateCode
                                                ? US_STATES[
                                                    stateCode as keyof typeof US_STATES
                                                  ]
                                                : 'State'
                                              : 'State'
                                          }
                                          disabled={providerRemoteChecked}
                                        />
                                      </div>
                                      <div className="min-w-0 space-y-1.5">
                                        <Label
                                          htmlFor={`provider-country-${option.value}`}
                                          className="text-xs"
                                        >
                                          Country
                                        </Label>
                                        <Input
                                          id={`provider-country-${option.value}`}
                                          value={
                                            override.location
                                              .split(',')[2]
                                              ?.trim() || ''
                                          }
                                          onChange={event => {
                                            const parts = override.location
                                              .split(',')
                                              .map(part => part.trim());
                                            while (parts.length < 3)
                                              parts.push('');
                                            parts[2] = event.target.value;
                                            updateProviderOverride(
                                              option.value,
                                              {
                                                location: parts
                                                  .filter(Boolean)
                                                  .join(', '),
                                              },
                                            );
                                          }}
                                          placeholder={
                                            inheritsGlobalLocation
                                              ? country || 'Country'
                                              : 'Country'
                                          }
                                          disabled={providerRemoteChecked}
                                        />
                                      </div>
                                    </div>
                                  ) : null}

                                  <div className="flex flex-wrap items-start gap-3">
                                    {option.supportsMaxPages ? (
                                      <div className="min-w-24 flex-[0.75_1_0] space-y-1.5">
                                        <Label
                                          htmlFor={`provider-max-pages-${option.value}`}
                                          className="text-xs"
                                        >
                                          {option.maxPagesLabel ?? 'Max pages'}
                                        </Label>
                                        <Input
                                          id={`provider-max-pages-${option.value}`}
                                          type="number"
                                          min={1}
                                          max={option.maxPagesMax ?? 50}
                                          value={override.maxPages}
                                          onChange={event =>
                                            updateProviderOverride(
                                              option.value,
                                              {
                                                maxPages: event.target.value,
                                              },
                                            )
                                          }
                                          placeholder={String(
                                            option.defaultMaxPages,
                                          )}
                                        />
                                      </div>
                                    ) : null}

                                    {option.supportsMode ? (
                                      <div className="min-w-40 flex-1 space-y-1.5">
                                        <Label
                                          htmlFor={`provider-mode-${option.value}`}
                                          className="text-xs"
                                        >
                                          Mode
                                        </Label>
                                        <Select
                                          disabled={!isEnabled}
                                          value={
                                            effectiveConfig.mode ??
                                            option.defaultMode
                                          }
                                          onValueChange={value =>
                                            updateProviderOverride(
                                              option.value,
                                              {
                                                mode: value as ProviderOverrideState['mode'],
                                              },
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            id={`provider-mode-${option.value}`}
                                          >
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="sync">
                                              Sync
                                            </SelectItem>
                                            <SelectItem value="weekly">
                                              Weekly
                                            </SelectItem>
                                            <SelectItem value="backfill">
                                              Backfill
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ) : null}

                                    {option.supportsPostedWithin ? (
                                      <div className="min-w-56 flex-[1.8_1_0] space-y-1.5">
                                        <Label
                                          htmlFor={`provider-posted-within-${option.value}`}
                                          className="text-xs"
                                        >
                                          Date range
                                        </Label>
                                        <Select
                                          disabled={!isEnabled}
                                          value={override.postedWithin || 'any'}
                                          onValueChange={value =>
                                            updateProviderOverride(
                                              option.value,
                                              {
                                                postedWithin:
                                                  value === 'any'
                                                    ? ''
                                                    : (value as ProviderOverrideState['postedWithin']),
                                              },
                                            )
                                          }
                                        >
                                          <SelectTrigger
                                            id={`provider-posted-within-${option.value}`}
                                          >
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="any">
                                              Inherit global
                                            </SelectItem>
                                            <SelectItem value="1">
                                              Past 24h
                                            </SelectItem>
                                            <SelectItem value="3">
                                              Past 3 days
                                            </SelectItem>
                                            <SelectItem value="7">
                                              Past week
                                            </SelectItem>
                                            <SelectItem value="14">
                                              Past 2 weeks
                                            </SelectItem>
                                            <SelectItem value="30">
                                              Past month
                                            </SelectItem>
                                            <SelectItem value="90">
                                              Past 3 months
                                            </SelectItem>
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    ) : null}
                                  </div>
                                </fieldset>

                                <div className="flex justify-end pt-1">
                                  {runningProvider === option.value ? (
                                    <Button
                                      onClick={stopScrape}
                                      variant="destructive"
                                      size="sm"
                                      className="shrink-0"
                                    >
                                      <Square className="h-3.5 w-3.5" />
                                      Stop
                                    </Button>
                                  ) : (
                                    <Button
                                      onClick={() => startScrape(option.value)}
                                      disabled={
                                        isRunning ||
                                        limitStatus.blocked ||
                                        !isEnabled ||
                                        runtimeUnavailable ||
                                        !effectiveConfig.searchTerm?.trim()
                                      }
                                      size="sm"
                                      variant={
                                        limitStatus.blocked
                                          ? 'outline'
                                          : 'default'
                                      }
                                      className="shrink-0"
                                    >
                                      <Play className="h-4 w-4" />
                                      {limitStatus.blocked ? 'Limit' : 'Run'}
                                    </Button>
                                  )}
                                </div>
                              </div>

                              {limitStatus.message ? (
                                <p
                                  className={`mt-2 text-[11px] ${
                                    limitStatus.blocked
                                      ? 'text-red-400'
                                      : 'text-amber-400'
                                  }`}
                                >
                                  {limitStatus.message}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Progress */}
            <div className="flex min-h-0 flex-col overflow-hidden lg:sticky lg:top-[-4px]! lg:h-[calc(100vh-6rem)]! lg:max-h-[calc(100vh-6rem)]! lg:min-h-[calc(100vh-6rem)]! lg:self-start">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <RefreshCw
                    className={`h-4 w-4 ${isRunning ? 'animate-spin' : ''}`}
                  />
                  Live Progress
                </h2>
                <Popover open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-fit gap-1.5 border-input bg-input text-xs hover:border-input hover:bg-input"
                      onClick={() => {
                        if (!isHistoryOpen) void fetchScrapeSessions();
                      }}
                    >
                      <History className="h-3.5 w-3.5" />
                      History
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-[420px] max-w-[90vw] p-0"
                  >
                    <div className="border-b border-border/60 px-3 py-2 text-xs font-medium text-muted-foreground">
                      Recent scrape runs
                    </div>
                    <div className="max-h-[60vh] overflow-y-auto">
                      {scrapeSessions.length === 0 ? (
                        <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                          No prior runs yet.
                        </div>
                      ) : (
                        <ul className="divide-y divide-border/60">
                          {scrapeSessions.map(session => {
                            const isActive = session.id === replaySessionId;
                            const startedAt = new Date(session.startedAt);
                            const durationMs = session.finishedAt
                              ? new Date(session.finishedAt).getTime() -
                                startedAt.getTime()
                              : null;
                            const locationLabel =
                              [session.city, session.stateCode, session.country]
                                .filter(Boolean)
                                .join(', ') ||
                              (session.remote ? 'Remote' : '—');
                            return (
                              <li key={session.id}>
                                <button
                                  type="button"
                                  disabled={isLoadingReplay}
                                  className={`flex w-full flex-col gap-1 px-3 py-2.5 text-left text-xs transition-colors hover:bg-white/[0.04] ${isActive ? 'bg-white/[0.06]' : ''}`}
                                  onClick={() => loadReplaySession(session.id)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="truncate font-medium text-foreground">
                                      {session.searchTerm || '(no search term)'}
                                    </span>
                                    <Badge
                                      variant={
                                        session.status === 'COMPLETE'
                                          ? 'default'
                                          : session.status === 'ERROR'
                                            ? 'destructive'
                                            : 'secondary'
                                      }
                                      className="text-[10px]"
                                    >
                                      {session.status.toLowerCase()}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    <span>{startedAt.toLocaleString()}</span>
                                    {durationMs != null ? (
                                      <span>
                                        ·{' '}
                                        {Math.max(
                                          0,
                                          Math.round(durationMs / 1000),
                                        )}
                                        s
                                      </span>
                                    ) : null}
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
                                    <span>{locationLabel}</span>
                                    <span>·</span>
                                    <span>
                                      {session.providersRequested.length}{' '}
                                      provider
                                      {session.providersRequested.length === 1
                                        ? ''
                                        : 's'}
                                    </span>
                                    {session.trigger ? (
                                      <>
                                        <span>·</span>
                                        <span>{session.trigger}</span>
                                      </>
                                    ) : null}
                                  </div>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                Real-time scrape progress and provider logs.
              </p>
              {replaySessionId ? (
                <div className="mb-3 flex items-center justify-between gap-2 rounded-md border border-amber-500/30 bg-amber-500/[0.06] px-3 py-2 text-xs">
                  <span className="text-amber-300">
                    Viewing replay of a prior scrape run.
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-fit border-input bg-input text-xs hover:border-input hover:bg-input"
                    onClick={exitReplay}
                  >
                    Exit replay
                  </Button>
                </div>
              ) : null}

              <div className="flex min-h-0 flex-1 flex-col gap-3.5">
                {progress ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="space-y-0.5">
                        <span className="block font-medium">
                          {progress.provider === 'all'
                            ? 'Overall'
                            : progress.provider}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {progressSummaryText}
                          {progress.elapsed
                            ? ` · ${Math.max(0, Math.round(progress.elapsed / 1000))}s`
                            : ''}
                        </span>
                      </div>
                      <Badge
                        variant={
                          progress.status === 'complete'
                            ? 'default'
                            : progress.status === 'error'
                              ? 'destructive'
                              : 'secondary'
                        }
                      >
                        {progress.provider === 'all'
                          ? 'summary'
                          : progress.status}
                      </Badge>
                    </div>

                    <Progress value={progressPercent} />

                    {paginationStopMessage ? (
                      <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
                        {paginationStopMessage}
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-2 text-center text-sm xl:grid-cols-4">
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 backdrop-blur-md">
                        <NumberFlow
                          value={runTotals.jobsFetched}
                          className="font-mono font-semibold text-foreground"
                        />
                        <div className="text-[11px] text-muted-foreground">
                          Fetched
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 backdrop-blur-md">
                        <NumberFlow
                          value={runTotals.jobsCreated}
                          className="font-mono font-semibold text-green-600"
                        />
                        <div className="text-[11px] text-muted-foreground">
                          Created
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 backdrop-blur-md">
                        <NumberFlow
                          value={runTotals.jobsUpdated}
                          className="font-mono font-semibold text-blue-500"
                        />
                        <div className="text-[11px] text-muted-foreground">
                          Updated
                        </div>
                      </div>
                      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] py-2 backdrop-blur-md">
                        <NumberFlow
                          value={runTotals.jobsSkipped}
                          className="font-mono font-semibold text-orange-600"
                        />
                        <div className="text-[11px] text-muted-foreground">
                          Skipped
                        </div>
                      </div>
                    </div>

                    {Object.keys(skipBreakdownTotals).length > 0 ? (
                      <div className="space-y-1 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 backdrop-blur-md">
                        <div className="text-[11px] font-medium text-muted-foreground">
                          Why skipped
                        </div>
                        <ul className="space-y-0.5 text-xs">
                          {Object.entries(skipBreakdownTotals)
                            .sort(([, a], [, b]) => b - a)
                            .map(([reason, value]) => (
                              <li
                                key={reason}
                                className="flex items-center justify-between gap-2"
                              >
                                <span className="text-muted-foreground">
                                  {SKIP_REASON_LABELS[reason] ?? reason}
                                </span>
                                <span className="font-mono text-orange-600/90">
                                  {value.toLocaleString()}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </div>
                    ) : null}

                    {progress.rateLimit?.jobsRemaining !== undefined ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        Fantastic credits:{' '}
                        {progress.rateLimit.jobsRemaining?.toLocaleString()} /{' '}
                        {progress.rateLimit.jobsLimit?.toLocaleString()} jobs
                        remaining
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex min-h-0 flex-1 flex-col">
                  <div className="flex items-center gap-1 rounded-t-lg border border-b-0 border-white/[0.06] bg-white/[0.06] px-2 py-1 backdrop-blur-md">
                    {!progress && (
                      <span className="mr-auto text-xs text-muted-foreground">
                        No active scrape.
                      </span>
                    )}
                    {progress && <span className="mr-auto" />}
                    <button
                      type="button"
                      onClick={() => setLiveViewTab('logs')}
                      className={`rounded-md py-1 pr-1 pl-2.5 text-xs font-medium transition-colors ${liveViewTab === 'logs' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Logs
                    </button>
                    <button
                      type="button"
                      onClick={() => setLiveViewTab('requests')}
                      className={`rounded-md py-1 pr-1 pl-2.5 text-xs font-medium transition-colors ${liveViewTab === 'requests' ? 'bg-white/10 text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
                    >
                      Requests
                      {requestLogs.length > 0 && (
                        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                          {requestLogs.length}
                        </span>
                      )}
                    </button>
                    {(logs.length > 0 || requestLogs.length > 0) &&
                      !isRunning && (
                        <button
                          type="button"
                          onClick={clearLogs}
                          className="ml-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground"
                        >
                          Clear
                        </button>
                      )}
                  </div>

                  {liveViewTab === 'logs' ? (
                    <div
                      ref={logsContainerRef}
                      className="min-h-48 flex-1 overflow-y-auto rounded-b-lg border border-white/[0.06] bg-white/[0.03] font-mono text-xs leading-relaxed backdrop-blur-md"
                    >
                      {logs.length === 0 ? (
                        <div className="flex h-full items-center justify-center px-3 py-3 text-muted-foreground">
                          Logs will appear here...
                        </div>
                      ) : (
                        <div className="divide-y divide-white/[0.055]">
                          {logs.map(log => (
                            <div
                              key={log.id}
                              className={`px-3 py-1.5 ${
                                log.level === 'error'
                                  ? 'text-red-500'
                                  : log.level === 'success'
                                    ? 'text-emerald-500'
                                    : log.level === 'update'
                                      ? 'text-amber-400'
                                      : log.level === 'warn'
                                        ? 'text-orange-500'
                                        : 'text-foreground'
                              }`}
                            >
                              <span className="mr-2 text-[10px] text-muted-foreground/70">
                                {log.timestamp.toLocaleTimeString()}
                              </span>{' '}
                              {log.message}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div
                      ref={requestsContainerRef}
                      className="min-h-48 flex-1 overflow-y-auto rounded-b-lg border border-white/[0.06] bg-white/[0.03] p-2.5 pb-2.5 font-mono text-xs leading-relaxed backdrop-blur-md"
                    >
                      {requestLogs.length === 0 ? (
                        <div className="flex h-full items-center justify-center text-muted-foreground">
                          Request logs will appear here during a scrape...
                        </div>
                      ) : (
                        <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02]">
                          {requestLogs.map(entry => {
                            const parsedRequest = parseRequestLogPreview(
                              maskSensitiveLogText(entry.requestUrl),
                            );

                            return (
                              <Collapsible
                                key={entry.id}
                                className="overflow-hidden border-b border-white/[0.055] last:border-b-0"
                              >
                                <CollapsibleTrigger className="w-full text-left">
                                  <div className="flex items-start gap-2.5 px-2.5 py-2 transition-colors hover:bg-white/[0.02]">
                                    <ChevronDown className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground transition-transform data-[state=open]:rotate-180" />
                                    <div className="min-w-0 flex-1 space-y-0.5">
                                      <div className="flex min-w-0 items-center gap-1.5">
                                        <span className="font-semibold text-foreground">
                                          {entry.provider}
                                        </span>
                                        <span
                                          className={
                                            parsedRequest.method === 'POST' ||
                                            parsedRequest.method === 'PUT' ||
                                            parsedRequest.method === 'PATCH' ||
                                            parsedRequest.method === 'DELETE'
                                              ? 'text-amber-300'
                                              : 'text-green-600'
                                          }
                                        >
                                          {parsedRequest.method}
                                        </span>
                                        <span className="truncate text-foreground/75">
                                          {renderMaskedLogText(
                                            parsedRequest.url,
                                          )}
                                        </span>
                                      </div>
                                      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10px] text-muted-foreground">
                                        <span>Page {entry.page}</span>
                                        <span
                                          className={
                                            entry.responseStatus >= 200 &&
                                            entry.responseStatus < 300
                                              ? 'text-green-600'
                                              : 'text-red-500'
                                          }
                                        >
                                          {entry.responseStatus}
                                        </span>
                                        <span>
                                          {entry.timestamp.toLocaleTimeString()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </CollapsibleTrigger>
                                <CollapsibleContent className="border-t border-white/[0.05] px-2.5 py-2">
                                  <div className="space-y-2">
                                    <div className="space-y-0.5">
                                      <p className="text-[10px] font-medium text-muted-foreground">
                                        REQUEST
                                      </p>
                                      <div className="overflow-x-auto whitespace-pre-wrap break-words rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] leading-relaxed">
                                        <span
                                          className={
                                            parsedRequest.method === 'POST' ||
                                            parsedRequest.method === 'PUT' ||
                                            parsedRequest.method === 'PATCH' ||
                                            parsedRequest.method === 'DELETE'
                                              ? 'text-amber-300'
                                              : 'text-green-600'
                                          }
                                        >
                                          {parsedRequest.method}
                                        </span>{' '}
                                        <span className="break-all text-foreground/80">
                                          {renderMaskedLogText(
                                            parsedRequest.url,
                                          )}
                                        </span>
                                        {parsedRequest.requestBody ? (
                                          <pre className="mt-1.5 overflow-auto whitespace-pre-wrap rounded border border-white/[0.05] bg-black/20 px-2 py-1 text-[10px] leading-relaxed text-foreground/70">
                                            {renderMaskedLogText(
                                              maskSensitiveLogText(
                                                parsedRequest.requestBody,
                                              ),
                                            )}
                                          </pre>
                                        ) : null}
                                      </div>
                                    </div>
                                    <div className="space-y-0.5">
                                      <p className="text-[10px] font-medium text-muted-foreground">
                                        RESPONSE
                                      </p>
                                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap rounded border border-white/[0.06] bg-white/[0.03] px-2 py-1 text-[10px] leading-relaxed text-foreground/70">
                                        {renderMaskedLogText(
                                          maskSensitiveLogText(
                                            entry.responseBodyPreview,
                                          ),
                                        )}
                                      </pre>
                                    </div>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Provider run history modal */}
          <Modal
            open={detailProvider !== null}
            onOpenChange={open => {
              if (!open) setDetailProvider(null);
            }}
          >
            <ModalContent
              size="3xl"
              className="max-h-[90vh] overflow-hidden border-white/[0.08] bg-background/60 p-0 backdrop-blur-2xl"
            >
              {detailProvider
                ? (() => {
                    const option = getProviderOption(detailProvider);
                    const avg = providerAverages.get(detailProvider);
                    const runs = providerRunHistory[detailProvider] ?? [];
                    const isLoadingRuns =
                      loadingProviderRuns[detailProvider] ?? false;
                    const pStatus = providerStatuses[detailProvider];

                    return (
                      <>
                        <ModalHeader className="space-y-2 border-b border-white/[0.06] bg-white/[0.03] px-6 py-4 backdrop-blur-md">
                          <div className="flex items-center gap-2">
                            <ModalTitle className="text-base">
                              {option.label}
                            </ModalTitle>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-normal"
                            >
                              {option.sourceSummary}
                            </Badge>
                            {pStatus?.status === 'error' && (
                              <Badge
                                variant="destructive"
                                className="text-[10px]"
                              >
                                error
                              </Badge>
                            )}
                            {pStatus?.status === 'complete' && (
                              <Badge variant="default" className="text-[10px]">
                                complete
                              </Badge>
                            )}
                          </div>
                          <ModalDescription className="text-xs">
                            {option.description}
                          </ModalDescription>
                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                            {avg ? (
                              <span className="font-mono">
                                Avg/run:{' '}
                                <span className="text-foreground">
                                  ~{Math.round(avg.avgFetched).toLocaleString()}
                                </span>{' '}
                                fetched,{' '}
                                <span className="text-green-500">
                                  ~{Math.round(avg.avgCreated).toLocaleString()}
                                </span>{' '}
                                created
                                <span className="ml-1 text-muted-foreground/60">
                                  ({avg.runs} runs this month)
                                </span>
                              </span>
                            ) : (
                              <span>No run history this month</span>
                            )}
                          </div>
                        </ModalHeader>

                        <div className="flex max-h-[calc(90vh-8rem)] min-h-[24rem] flex-col overflow-hidden p-5">
                          <div className="mb-3 flex items-center justify-between">
                            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                              Run history ({runs.length})
                            </p>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs"
                              onClick={() => fetchProviderRuns(option.value)}
                              disabled={isLoadingRuns}
                            >
                              {isLoadingRuns ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <RefreshCw className="h-3.5 w-3.5" />
                              )}
                              Refresh
                            </Button>
                          </div>

                          <div className="flex-1 space-y-1.5 overflow-y-auto pr-1">
                            {isLoadingRuns && runs.length === 0 ? (
                              <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                Loading runs...
                              </div>
                            ) : runs.length === 0 ? (
                              <p className="py-8 text-center text-xs text-muted-foreground">
                                No runs recorded yet for this provider.
                              </p>
                            ) : (
                              runs.map((run, idx) => (
                                <ProviderRunHistoryEntry
                                  key={`${run.createdAt}-${idx}`}
                                  run={run}
                                />
                              ))
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()
                : null}
            </ModalContent>
          </Modal>
        </div>
      ) : null}
    </>
  );
};

export { ListingsTabs };
export type { ListingAnalytics };
