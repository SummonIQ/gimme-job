import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Circle,
  Loader2,
  MoreHorizontal,
  Pause,
  Play,
  RefreshCw,
  Square,
  Star,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
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
import { Progress } from '@/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { US_STATES } from '@/constants/locales';
import {
  MANUAL_PROVIDER_OPTIONS_BY_ID,
  type ManualProviderOption,
} from '@/lib/admin/manual-provider-options';
import { cn } from '@/lib/utils';
import type { AdminScrapeProgressPayload } from '@/types/events/data-update';

import type {
  DesktopAdminProviderOverride,
  DesktopAdminProviderRunRow,
  DesktopAdminSavedSearchRow,
} from '../../desktop-api';

const PROVIDER_TOGGLE_STORAGE_KEY =
  'gimmejob.desktop.admin.listings.providerEnabled';
const SCRAPE_PROGRESS_STORAGE_KEY =
  'gimmejob.desktop.admin.listings.activeScrapeProgress';
const MAX_PROGRESS_EVENTS = 500;

const loadProviderEnabled = (): Record<string, boolean> => {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PROVIDER_TOGGLE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, boolean>;
    }
    return {};
  } catch {
    return {};
  }
};

import type {
  DesktopAdminListingsProvidersApiResult,
  DesktopAdminScrapeProgressEvent,
  DesktopListingsProviderRow,
} from '../../desktop-api';
import { getProviderErrorInfo } from '../lib/provider-error';

const formatRelative = (iso: string | null): string => {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
};

const formatProvider = (provider: string | null): string =>
  (provider ?? '?').replaceAll('_', ' ').toUpperCase();

type ScrapeLogPayload = Partial<AdminScrapeProgressPayload> & {
  provider?: string;
  status?: string;
  message?: string;
  error?: string;
  currentPage?: number;
  totalPages?: number;
  jobsFetched?: number;
  jobsCreated?: number;
  jobsUpdated?: number;
  jobsSkipped?: number;
  [key: string]: unknown;
};

const scrapeLogPayload = (payload: unknown): ScrapeLogPayload =>
  payload && typeof payload === 'object' ? (payload as ScrapeLogPayload) : {};

const compactCount = (label: string, value: unknown): string | null =>
  typeof value === 'number' && Number.isFinite(value)
    ? `${value.toLocaleString()} ${label}`
    : null;

const formatScrapeLogMessage = (
  event: DesktopAdminScrapeProgressEvent,
  payload: ScrapeLogPayload,
): string => {
  if (
    payload.provider === 'all' &&
    (payload.status === 'complete' || payload.status === 'error') &&
    typeof payload.jobsFetched === 'number'
  ) {
    const prefix =
      payload.status === 'error'
        ? 'Scrape failed'
        : payload.error
          ? 'Scrape complete with provider issues'
          : 'Scrape complete';
    return `${prefix}. ${payload.jobsFetched.toLocaleString()} fetched, ${(
      payload.jobsCreated ?? 0
    ).toLocaleString()} created, ${(payload.jobsUpdated ?? 0).toLocaleString()} updated, ${(
      payload.jobsSkipped ?? 0
    ).toLocaleString()} skipped.`;
  }
  const message = payload.message ?? payload.error;
  if (typeof message === 'string' && message.trim()) return message.trim();
  if (typeof payload.status === 'string' && payload.status.trim()) {
    return payload.status.trim();
  }
  return event.kind.split(/[_-]/g).filter(Boolean).join(' ');
};

const scrapeLogMeta = (payload: ScrapeLogPayload): string[] =>
  [
    payload.currentPage || payload.totalPages
      ? `page ${payload.currentPage ?? '?'} / ${payload.totalPages ?? '?'}`
      : null,
    compactCount('fetched', payload.jobsFetched),
    compactCount('created', payload.jobsCreated),
    compactCount('updated', payload.jobsUpdated),
    compactCount('skipped', payload.jobsSkipped),
  ].filter((item): item is string => Boolean(item));

type ScrapeListingPreview = NonNullable<
  AdminScrapeProgressPayload['recentCreatedListings']
>[number];

interface ProviderLiveStatus {
  readonly status: 'idle' | 'fetching' | 'persisting' | 'complete' | 'error';
  readonly currentPage: number;
  readonly totalPages: number;
  readonly jobsFetched: number;
  readonly jobsCreated: number;
  readonly jobsUpdated: number;
  readonly jobsSkipped: number;
  readonly error?: string;
}

interface ScrapeStatusState {
  readonly tone: 'idle' | 'running' | 'error';
  readonly message: string | null;
}

interface PersistedScrapeProgress {
  readonly activeScrapeId: string | null;
  readonly isScrapePaused: boolean;
  readonly progressEvents: readonly DesktopAdminScrapeProgressEvent[];
  readonly providerLiveStatuses: Record<string, ProviderLiveStatus>;
  readonly runningProvider: string | null;
  readonly scrapeStatus: ScrapeStatusState;
  readonly scrapeTerminalStatus: string | null;
}

const emptyScrapeStatus: ScrapeStatusState = {
  message: null,
  tone: 'idle',
};

const emptyProviderLiveStatus = (): ProviderLiveStatus => ({
  status: 'idle',
  currentPage: 0,
  totalPages: 0,
  jobsFetched: 0,
  jobsCreated: 0,
  jobsUpdated: 0,
  jobsSkipped: 0,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const isProgressEvent = (
  value: unknown,
): value is DesktopAdminScrapeProgressEvent => {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.sequence === 'number' &&
    typeof value.kind === 'string' &&
    typeof value.emittedAt === 'string'
  );
};

const isProviderLiveStatus = (value: unknown): value is ProviderLiveStatus => {
  if (!isRecord(value)) return false;
  return (
    ['idle', 'fetching', 'persisting', 'complete', 'error'].includes(
      String(value.status),
    ) &&
    typeof value.currentPage === 'number' &&
    typeof value.totalPages === 'number' &&
    typeof value.jobsFetched === 'number' &&
    typeof value.jobsCreated === 'number' &&
    typeof value.jobsUpdated === 'number' &&
    typeof value.jobsSkipped === 'number'
  );
};

const loadPersistedScrapeProgress = (): PersistedScrapeProgress | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(SCRAPE_PROGRESS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRecord(parsed)) return null;

    const providerLiveStatuses: Record<string, ProviderLiveStatus> = {};
    if (isRecord(parsed.providerLiveStatuses)) {
      for (const [provider, status] of Object.entries(
        parsed.providerLiveStatuses,
      )) {
        if (isProviderLiveStatus(status)) {
          providerLiveStatuses[provider] = status;
        }
      }
    }

    const scrapeStatus: ScrapeStatusState = isRecord(parsed.scrapeStatus)
      ? {
          message:
            typeof parsed.scrapeStatus.message === 'string'
              ? parsed.scrapeStatus.message
              : null,
          tone:
            parsed.scrapeStatus.tone === 'running'
              ? 'running'
              : parsed.scrapeStatus.tone === 'error'
                ? 'error'
                : 'idle',
        }
      : emptyScrapeStatus;

    const terminalStatus =
      typeof parsed.scrapeTerminalStatus === 'string'
        ? parsed.scrapeTerminalStatus
        : null;
    const hasTerminalStatus =
      terminalStatus === 'COMPLETED' ||
      terminalStatus === 'FAILED' ||
      terminalStatus === 'CANCELLED';

    return {
      activeScrapeId:
        !hasTerminalStatus && typeof parsed.activeScrapeId === 'string'
          ? parsed.activeScrapeId
          : null,
      isScrapePaused: !hasTerminalStatus && parsed.isScrapePaused === true,
      progressEvents: Array.isArray(parsed.progressEvents)
        ? parsed.progressEvents
            .filter(isProgressEvent)
            .slice(-MAX_PROGRESS_EVENTS)
        : [],
      providerLiveStatuses,
      runningProvider:
        typeof parsed.runningProvider === 'string'
          ? parsed.runningProvider
          : null,
      scrapeStatus,
      scrapeTerminalStatus: terminalStatus,
    };
  } catch {
    return null;
  }
};

const writePersistedScrapeProgress = (state: PersistedScrapeProgress): void => {
  if (typeof window === 'undefined') return;
  try {
    const hasVisibleProgress =
      Boolean(state.activeScrapeId) ||
      state.progressEvents.length > 0 ||
      Object.keys(state.providerLiveStatuses).length > 0 ||
      Boolean(state.scrapeTerminalStatus);
    if (!hasVisibleProgress) {
      window.localStorage.removeItem(SCRAPE_PROGRESS_STORAGE_KEY);
      return;
    }
    window.localStorage.setItem(
      SCRAPE_PROGRESS_STORAGE_KEY,
      JSON.stringify({
        ...state,
        progressEvents: state.progressEvents.slice(-MAX_PROGRESS_EVENTS),
      }),
    );
  } catch {
    /* ignore */
  }
};

const mergeProgressEvents = (
  previous: readonly DesktopAdminScrapeProgressEvent[],
  incoming: readonly DesktopAdminScrapeProgressEvent[],
): DesktopAdminScrapeProgressEvent[] => {
  const byId = new Map<string, DesktopAdminScrapeProgressEvent>();
  for (const event of previous) byId.set(event.id, event);
  for (const event of incoming) byId.set(event.id, event);
  return Array.from(byId.values())
    .sort((a, b) => a.sequence - b.sequence)
    .slice(-MAX_PROGRESS_EVENTS);
};

const mergeProviderLiveStatuses = (
  previous: Record<string, ProviderLiveStatus>,
  events: readonly DesktopAdminScrapeProgressEvent[],
): Record<string, ProviderLiveStatus> => {
  const next: Record<string, ProviderLiveStatus> = { ...previous };
  for (const event of events) {
    const payload = scrapeLogPayload(event.payload);
    const provider = payload.provider;
    if (!provider) continue;
    const existing = next[provider] ?? emptyProviderLiveStatus();
    next[provider] = {
      status:
        payload.status === 'fetching' ||
        payload.status === 'persisting' ||
        payload.status === 'complete' ||
        payload.status === 'error'
          ? payload.status
          : existing.status,
      currentPage: payload.currentPage ?? existing.currentPage,
      totalPages: payload.totalPages ?? existing.totalPages,
      jobsFetched: payload.jobsFetched ?? existing.jobsFetched,
      jobsCreated: payload.jobsCreated ?? existing.jobsCreated,
      jobsUpdated: payload.jobsUpdated ?? existing.jobsUpdated,
      jobsSkipped: payload.jobsSkipped ?? existing.jobsSkipped,
      error: payload.error ?? existing.error,
    };
  }
  return next;
};

const scrapeProgressLevel = (
  event: DesktopAdminScrapeProgressEvent,
  payload: ScrapeLogPayload,
): 'error' | 'success' | 'warn' | 'update' | 'info' => {
  const kind = event.kind.toLowerCase();
  const status = payload.status?.toLowerCase() ?? '';
  if (payload.error || kind.includes('error') || status === 'error') {
    return 'error';
  }
  if (payload.recentUpdatedListings?.length || kind.includes('update')) {
    return 'update';
  }
  if (kind.includes('skip') || kind.includes('warn')) return 'warn';
  if (status === 'complete' || kind.includes('complete')) return 'success';
  return 'info';
};

const scrapeLevelClasses = (
  level: 'error' | 'success' | 'warn' | 'update' | 'info',
) => {
  if (level === 'error') {
    return {
      badge: 'bg-red-500/10 text-red-300',
      row: 'border-red-500/35 bg-red-500/[0.045]',
      text: 'text-red-100',
    };
  }
  if (level === 'success') {
    return {
      badge: 'bg-emerald-500/10 text-emerald-300',
      row: 'border-emerald-400/35 bg-emerald-500/[0.035]',
      text: 'text-emerald-100',
    };
  }
  if (level === 'warn') {
    return {
      badge: 'bg-orange-500/10 text-orange-300',
      row: 'border-orange-400/35 bg-orange-500/[0.04]',
      text: 'text-orange-100',
    };
  }
  if (level === 'update') {
    return {
      badge: 'bg-sky-500/10 text-sky-300',
      row: 'border-sky-400/35 bg-sky-500/[0.035]',
      text: 'text-sky-100',
    };
  }
  return {
    badge: 'bg-white/[0.055] text-muted-foreground',
    row: 'border-white/[0.08] bg-transparent',
    text: 'text-foreground',
  };
};

const formatBreakdownKey = (key: string): string =>
  key.replace(/([A-Z])/g, ' $1').replace(/^\w/, char => char.toUpperCase());

const formatListingDetails = (listing: ScrapeListingPreview): string =>
  [listing.company, listing.location, listing.source ?? listing.jobProvider]
    .filter(Boolean)
    .join(' · ') || 'Company / location unavailable';

const formatChangedFields = (listing: ScrapeListingPreview): string[] =>
  (listing.changedFields ?? []).map(
    change =>
      `${change.field}: ${change.from ?? 'empty'} -> ${change.to ?? 'empty'}`,
  );

const ScrapeListingGroup = ({
  listings,
  title,
  tone,
}: {
  readonly listings: readonly ScrapeListingPreview[] | undefined;
  readonly title: string;
  readonly tone: 'success' | 'warn' | 'update';
}) => {
  if (!listings?.length) return null;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border p-2',
        tone === 'success' &&
          'border-emerald-400/30 bg-emerald-500/[0.025] shadow-[inset_16px_16px_40px_rgba(52,211,153,0.08)]',
        tone === 'warn' &&
          'border-orange-400/30 bg-orange-500/[0.025] shadow-[inset_16px_16px_40px_rgba(251,146,60,0.08)]',
        tone === 'update' &&
          'border-sky-400/30 bg-sky-500/[0.025] shadow-[inset_16px_16px_40px_rgba(56,189,248,0.08)]',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute left-0 top-0 h-14 w-14 rounded-full blur-2xl',
          tone === 'success' && 'bg-emerald-400/20',
          tone === 'warn' && 'bg-orange-400/20',
          tone === 'update' && 'bg-sky-400/20',
        )}
      />
      <div
        className={cn(
          'relative font-mono text-[10px] font-semibold uppercase tracking-wide',
          tone === 'success' && 'text-emerald-300',
          tone === 'warn' && 'text-orange-300',
          tone === 'update' && 'text-sky-300',
        )}
      >
        {title}
      </div>
      <div className="relative mt-1.5 space-y-1">
        {listings.map((listing, index) => {
          const changedFields = formatChangedFields(listing);
          return (
            <div
              key={`${title}-${index}-${listing.title}-${listing.company ?? ''}-${listing.applyUrl ?? ''}`}
              className="rounded-md border border-white/[0.06] bg-black/20 px-2 py-1.5"
            >
              <div className="break-words font-medium text-foreground">
                {listing.title}
              </div>
              <div className="mt-0.5 break-words text-[11px] text-muted-foreground">
                {formatListingDetails(listing)}
              </div>
              {listing.reason ? (
                <div className="mt-1 break-words text-[11px] text-orange-200/90">
                  {listing.reason}
                </div>
              ) : null}
              {changedFields.length > 0 ? (
                <div className="mt-1 space-y-0.5 font-mono text-[10px] text-sky-200/85">
                  {changedFields.map(field => (
                    <div key={field} className="break-words">
                      {field}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const ScrapeProgressEventRow = ({
  event,
}: {
  readonly event: DesktopAdminScrapeProgressEvent;
}) => {
  const payload = scrapeLogPayload(event.payload);
  const meta = scrapeLogMeta(payload);
  const level = scrapeProgressLevel(event, payload);
  const classes = scrapeLevelClasses(level);
  const diagnostics = payload.diagnostics?.reasons ?? [];
  const diagnosticLabel =
    payload.provider === 'all' || payload.status === 'error'
      ? 'Issue'
      : 'Why not created';
  const breakdown = payload.persistBreakdown
    ? Object.entries(payload.persistBreakdown).filter(
        ([, value]) => typeof value === 'number' && value > 0,
      )
    : [];

  return (
    <div
      className={cn('space-y-2 border-l-2 px-3 py-3 font-sans', classes.row)}
    >
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'inline-flex max-w-full rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase',
                classes.badge,
              )}
            >
              <span className="truncate">
                {payload.provider
                  ? formatProvider(String(payload.provider))
                  : event.kind}
              </span>
            </span>
            {payload.status ? (
              <span className="rounded bg-white/[0.045] px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                {payload.status}
              </span>
            ) : null}
          </div>
          <p className={cn('break-words font-medium', classes.text)}>
            {formatScrapeLogMessage(event, payload)}
          </p>
        </div>
        <time className="shrink-0 font-mono text-[10px] text-muted-foreground/70">
          {new Date(event.emittedAt).toLocaleTimeString()}
        </time>
      </div>

      {meta.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {meta.map(item => (
            <span
              key={item}
              className="rounded bg-black/20 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {item}
            </span>
          ))}
        </div>
      ) : null}

      {diagnostics.length > 0 ? (
        <div className="space-y-1 rounded-md border border-orange-400/15 bg-orange-500/[0.035] px-2 py-1.5 text-[11px] text-orange-100/90">
          {diagnostics.map(reason => (
            <div key={reason} className="break-words">
              {diagnosticLabel}: {reason}
            </div>
          ))}
        </div>
      ) : null}

      {breakdown.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {breakdown.map(([key, value]) => (
            <span
              key={key}
              className="rounded bg-white/[0.045] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
            >
              {formatBreakdownKey(key)}: {value}
            </span>
          ))}
        </div>
      ) : null}

      {payload.provider !== 'all' ? (
        <>
          <ScrapeListingGroup
            title="Created"
            tone="success"
            listings={payload.recentCreatedListings}
          />
          <ScrapeListingGroup
            title="Updated"
            tone="update"
            listings={payload.recentUpdatedListings}
          />
          <ScrapeListingGroup
            title="Skipped"
            tone="warn"
            listings={payload.recentRejectedListings}
          />
        </>
      ) : null}
    </div>
  );
};

interface ProviderRowProps {
  row: DesktopListingsProviderRow;
  capabilities: ManualProviderOption | undefined;
  enabled: boolean;
  override: DesktopAdminProviderOverride | undefined;
  isExpanded: boolean;
  liveStatus: ProviderLiveStatus | undefined;
  isAnyScrapeRunning: boolean;
  isThisProviderRunning: boolean;
  canRunSingle: boolean;
  onToggle: (provider: string, next: boolean) => void;
  onToggleExpand: (provider: string) => void;
  onOverrideChange: (
    provider: string,
    next: DesktopAdminProviderOverride,
  ) => void;
  onOverrideClear: (provider: string) => void;
  onRunSingle: (provider: string) => void;
  onStopScrape: () => void;
  onViewRunHistory: (provider: string) => void;
}

const ProviderRow = ({
  row,
  capabilities,
  enabled,
  override,
  isExpanded,
  liveStatus,
  isAnyScrapeRunning,
  isThisProviderRunning,
  canRunSingle,
  onToggle,
  onToggleExpand,
  onOverrideChange,
  onOverrideClear,
  onRunSingle,
  onStopScrape,
  onViewRunHistory,
}: ProviderRowProps) => {
  // Default everything to "supported" when we don't have a static
  // capability entry — keeps the desktop tolerant of new providers
  // that only the backend knows about.
  const supportsRemote = capabilities?.supportsRemote ?? true;
  const supportsLocation = capabilities?.supportsLocation ?? true;
  const supportsMaxPages = capabilities?.supportsMaxPages ?? true;
  const supportsMode = capabilities?.supportsMode ?? false;
  const supportsPostedWithin = capabilities?.supportsPostedWithin ?? true;
  const maxPagesLabel = capabilities?.maxPagesLabel ?? 'Max pages';
  const maxPagesMax = capabilities?.maxPagesMax ?? 50;
  const isProviderActive =
    isThisProviderRunning &&
    (liveStatus?.status === 'fetching' || liveStatus?.status === 'persisting');
  const isProviderDone = liveStatus?.status === 'complete';
  const hasProviderProgress =
    Boolean(liveStatus) &&
    liveStatus!.status !== 'idle' &&
    liveStatus!.totalPages > 0;
  const providerProgressPct =
    liveStatus?.status === 'complete'
      ? 100
      : liveStatus && liveStatus.totalPages > 0
        ? Math.round((liveStatus.currentPage / liveStatus.totalPages) * 100)
        : 0;
  const errorInfo =
    row.lastStatus === 'error' || !row.runtimeAvailable
      ? getProviderErrorInfo(row.unavailableReason ?? row.lastError)
      : null;
  const hasRunHistory = row.providerRuns > 0;

  const hasOverride =
    override !== undefined &&
    (override.maxPages !== undefined ||
      override.postedWithin !== undefined ||
      override.searchTerm !== undefined ||
      override.insertAnyway !== undefined ||
      override.location !== undefined ||
      override.remote !== undefined);

  const rowBg = errorInfo
    ? errorInfo.category === 'failed' || errorInfo.category === 'botBlock'
      ? 'bg-red-500/[0.03]'
      : 'bg-red-500/[0.02]'
    : row.lastStatus === 'success'
      ? 'bg-green-500/[0.02]'
      : 'bg-white/[0.03]';

  return (
    <div
      className={cn(
        'group relative overflow-hidden backdrop-blur-md transition-colors duration-500',
        rowBg,
      )}
    >
      <div
        className={cn(
          'relative flex items-start gap-3 overflow-hidden px-3',
          isExpanded ? 'min-h-0 pb-0 pt-2.5' : 'min-h-[7.5rem] py-3',
          !enabled && 'opacity-50',
        )}
      >
        {isProviderActive ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />
          </div>
        ) : null}
        <div
          onClick={() => onToggleExpand(row.provider)}
          role="button"
          tabIndex={0}
          onKeyDown={event => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onToggleExpand(row.provider);
            }
          }}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Hide overrides' : 'Show overrides'}
          className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        >
          <ChevronDown
            className={cn(
              'mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform',
              isExpanded && 'rotate-180',
            )}
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {row.lastStatus === 'success' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
              ) : row.lastStatus === 'error' ? (
                <Circle className="h-2.5 w-2.5 shrink-0 fill-current text-red-400" />
              ) : (
                <Circle className="h-2.5 w-2.5 shrink-0 fill-current text-muted-foreground/40" />
              )}
              <span className="min-w-0 truncate text-base font-semibold text-foreground">
                {row.label}
              </span>
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  asChild
                  onClick={event => event.stopPropagation()}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`More actions for ${row.label}`}
                    className="size-7 shrink-0"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  onClick={event => event.stopPropagation()}
                >
                  <DropdownMenuItem
                    onSelect={() => onViewRunHistory(row.provider)}
                  >
                    View run history
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {errorInfo ? (
                <span
                  className={cn(
                    'shrink-0 rounded-md px-1.5 py-0.5 text-[10px]',
                    errorInfo.badgeClassName,
                  )}
                >
                  {errorInfo.badgeLabel}
                </span>
              ) : null}
              {isProviderActive ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
              {isProviderDone ? (
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 animate-in fade-in text-green-500 duration-500" />
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <span className="shrink-0 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-muted-foreground/60">
                {row.sourceSummary}
              </span>
              {hasRunHistory ? (
                <span className="shrink-0 rounded-md bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] text-primary/80">
                  ~{Math.round(row.avgFetched).toLocaleString()} / ~
                  {Math.round(row.avgCreated).toLocaleString()}
                  <span className="ml-1 text-muted-foreground/60">
                    fetched/created per run
                  </span>
                </span>
              ) : (
                <span className="shrink-0 rounded-md bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-muted-foreground/50">
                  No run history yet
                </span>
              )}
              {row.lastRunAt ? (
                <span className="text-[10px] text-muted-foreground/60">
                  Last ran {formatRelative(row.lastRunAt)}
                </span>
              ) : null}
            </div>
            <div
              className={cn(
                'mt-1.5 space-y-1',
                hasProviderProgress &&
                  'animate-in fade-in slide-in-from-top-1 duration-300',
              )}
            >
              <div
                className={cn(
                  'flex items-center justify-between text-[11px]',
                  hasProviderProgress
                    ? 'text-muted-foreground'
                    : 'text-muted-foreground/40',
                )}
              >
                <span>Provider progress</span>
                <span className="font-mono">
                  {liveStatus?.status === 'complete'
                    ? (liveStatus?.totalPages ?? 0)
                    : Math.min(
                        liveStatus?.currentPage ?? 0,
                        liveStatus?.totalPages ?? 0,
                      )}{' '}
                  / {liveStatus?.totalPages ?? 0} pages
                </span>
              </div>
              <Progress
                value={providerProgressPct}
                className={cn('h-1', !hasProviderProgress && 'opacity-30')}
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
              {liveStatus && liveStatus.status !== 'idle' ? (
                <>
                  <span className="text-muted-foreground">
                    {liveStatus.jobsFetched} fetched
                  </span>
                  <span className="text-green-500">
                    {liveStatus.jobsCreated} created
                  </span>
                  <span className="text-blue-500">
                    {liveStatus.jobsUpdated} updated
                  </span>
                  {liveStatus.jobsSkipped > 0 ? (
                    <span className="text-orange-500">
                      {liveStatus.jobsSkipped} skipped
                    </span>
                  ) : null}
                </>
              ) : (
                <>
                  <span className="text-muted-foreground/40">0 fetched</span>
                  <span className="text-muted-foreground/40">0 created</span>
                  <span className="text-muted-foreground/40">0 updated</span>
                </>
              )}
            </div>
          </div>
        </div>
        <Switch
          checked={enabled}
          onCheckedChange={next => onToggle(row.provider, next)}
          aria-label={enabled ? 'Disable provider' : 'Enable provider'}
          title={enabled ? 'Disable provider' : 'Enable provider'}
          size="sm"
          className="mt-1 shrink-0"
        />
      </div>
      {isExpanded ? (
        <div className="px-3 pb-3 pt-1">
          <div className="space-y-3 rounded-2xl border border-white/[0.075] bg-[#141416]/60 px-4 pb-4 pt-3">
            {errorInfo ? (
              <div
                className={cn(
                  'rounded-lg border p-3 text-xs',
                  errorInfo.category === 'failed' ||
                    errorInfo.category === 'botBlock'
                    ? 'border-red-500/15 bg-red-500/[0.04] text-red-100'
                    : 'border-amber-500/20 bg-amber-500/[0.04] text-amber-100',
                )}
              >
                <div
                  className={cn(
                    'flex flex-wrap items-center gap-2 font-medium',
                    errorInfo.category === 'failed' ||
                      errorInfo.category === 'botBlock'
                      ? 'text-red-200'
                      : 'text-amber-200',
                  )}
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <span>{errorInfo.badgeLabel}</span>
                  {row.lastRunAt ? (
                    <span
                      className={cn(
                        'font-normal',
                        errorInfo.category === 'failed' ||
                          errorInfo.category === 'botBlock'
                          ? 'text-red-200/60'
                          : 'text-amber-200/60',
                      )}
                    >
                      {new Date(row.lastRunAt).toLocaleString()}
                    </span>
                  ) : null}
                </div>
                {errorInfo.shortMessage ? (
                  <p
                    className={cn(
                      'mt-2',
                      errorInfo.category === 'failed' ||
                        errorInfo.category === 'botBlock'
                        ? 'text-red-100/80'
                        : 'text-amber-100/80',
                    )}
                  >
                    {errorInfo.shortMessage}
                  </p>
                ) : null}
              </div>
            ) : null}
            <fieldset
              disabled={!enabled}
              className={cn(
                'space-y-3',
                enabled ? '' : 'pointer-events-none opacity-50',
              )}
            >
              <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(8rem,0.7fr)_minmax(8rem,0.7fr)]">
                <div className="min-w-0 space-y-1.5">
                  <Label
                    htmlFor={`provider-search-${row.provider}`}
                    className="text-xs"
                  >
                    Search term
                  </Label>
                  <Input
                    id={`provider-search-${row.provider}`}
                    value={override?.searchTerm ?? ''}
                    placeholder="(inherit global)"
                    onChange={event =>
                      onOverrideChange(row.provider, {
                        ...(override ?? {}),
                        searchTerm: event.target.value || undefined,
                      })
                    }
                  />
                </div>
                {supportsRemote ? (
                  <div className="min-w-0 space-y-1.5">
                    <Label className="text-xs">Remote only</Label>
                    <div className="flex items-start pt-1.5">
                      <Switch
                        checked={override?.remote ?? false}
                        onCheckedChange={checked =>
                          onOverrideChange(row.provider, {
                            ...(override ?? {}),
                            remote: checked,
                          })
                        }
                        aria-label={`Toggle remote only for ${row.label}`}
                        size="sm"
                      />
                    </div>
                  </div>
                ) : null}
                <div className="min-w-0 space-y-1.5">
                  <Label className="text-xs">Insert anyway</Label>
                  <div className="flex items-start pt-1.5">
                    <Switch
                      checked={override?.insertAnyway ?? false}
                      onCheckedChange={checked =>
                        onOverrideChange(row.provider, {
                          ...(override ?? {}),
                          insertAnyway: checked,
                        })
                      }
                      aria-label={`Insert fetched ${row.label} jobs even when they do not match filters`}
                      size="sm"
                    />
                  </div>
                </div>
              </div>

              {supportsLocation && !(override?.remote ?? false) ? (
                <div className="grid items-start gap-3 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(0,1fr)]">
                  <div className="min-w-0 space-y-1.5">
                    <Label
                      htmlFor={`provider-city-${row.provider}`}
                      className="text-xs"
                    >
                      City
                    </Label>
                    <Input
                      id={`provider-city-${row.provider}`}
                      value={
                        (override?.location ?? '').split(',')[0]?.trim() || ''
                      }
                      onChange={event => {
                        const parts = (override?.location ?? '')
                          .split(',')
                          .map(part => part.trim());
                        parts[0] = event.target.value;
                        const joined = parts.filter(Boolean).join(', ');
                        onOverrideChange(row.provider, {
                          ...(override ?? {}),
                          location: joined || undefined,
                        });
                      }}
                      placeholder="City"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label
                      htmlFor={`provider-state-${row.provider}`}
                      className="text-xs"
                    >
                      State
                    </Label>
                    <Input
                      id={`provider-state-${row.provider}`}
                      value={
                        (override?.location ?? '').split(',')[1]?.trim() || ''
                      }
                      onChange={event => {
                        const parts = (override?.location ?? '')
                          .split(',')
                          .map(part => part.trim());
                        while (parts.length < 2) parts.push('');
                        parts[1] = event.target.value;
                        const joined = parts.filter(Boolean).join(', ');
                        onOverrideChange(row.provider, {
                          ...(override ?? {}),
                          location: joined || undefined,
                        });
                      }}
                      placeholder="State"
                    />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label
                      htmlFor={`provider-country-${row.provider}`}
                      className="text-xs"
                    >
                      Country
                    </Label>
                    <Input
                      id={`provider-country-${row.provider}`}
                      value={
                        (override?.location ?? '').split(',')[2]?.trim() || ''
                      }
                      onChange={event => {
                        const parts = (override?.location ?? '')
                          .split(',')
                          .map(part => part.trim());
                        while (parts.length < 3) parts.push('');
                        parts[2] = event.target.value;
                        const joined = parts.filter(Boolean).join(', ');
                        onOverrideChange(row.provider, {
                          ...(override ?? {}),
                          location: joined || undefined,
                        });
                      }}
                      placeholder="Country"
                    />
                  </div>
                </div>
              ) : null}

              {supportsMaxPages || supportsMode || supportsPostedWithin ? (
                <div className="flex flex-wrap items-start gap-3">
                  {supportsMaxPages ? (
                    <div className="min-w-24 flex-[0.75_1_0] space-y-1.5">
                      <Label
                        htmlFor={`provider-max-pages-${row.provider}`}
                        className="text-xs"
                      >
                        {maxPagesLabel}
                      </Label>
                      <Input
                        id={`provider-max-pages-${row.provider}`}
                        type="number"
                        min={1}
                        max={maxPagesMax}
                        value={override?.maxPages ?? ''}
                        placeholder="(inherit)"
                        onChange={event => {
                          const raw = event.target.value;
                          const parsed = raw === '' ? undefined : Number(raw);
                          onOverrideChange(row.provider, {
                            ...(override ?? {}),
                            maxPages:
                              parsed !== undefined &&
                              Number.isFinite(parsed) &&
                              parsed > 0
                                ? parsed
                                : undefined,
                          });
                        }}
                      />
                    </div>
                  ) : null}
                  {supportsMode ? (
                    <div className="min-w-40 flex-1 space-y-1.5">
                      <Label
                        htmlFor={`provider-mode-${row.provider}`}
                        className="text-xs"
                      >
                        Mode
                      </Label>
                      <Select
                        value={override?.mode ?? 'sync'}
                        onValueChange={value =>
                          onOverrideChange(row.provider, {
                            ...(override ?? {}),
                            mode: value as DesktopAdminProviderOverride['mode'],
                          })
                        }
                      >
                        <SelectTrigger id={`provider-mode-${row.provider}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sync">Sync</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="backfill">Backfill</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                  {supportsPostedWithin ? (
                    <div className="min-w-56 flex-[1.8_1_0] space-y-1.5">
                      <Label
                        htmlFor={`provider-posted-within-${row.provider}`}
                        className="text-xs"
                      >
                        Date range
                      </Label>
                      <Select
                        value={override?.postedWithin ?? 'inherit'}
                        onValueChange={value =>
                          onOverrideChange(row.provider, {
                            ...(override ?? {}),
                            postedWithin:
                              value === 'inherit' ? undefined : value,
                          })
                        }
                      >
                        <SelectTrigger
                          id={`provider-posted-within-${row.provider}`}
                        >
                          <SelectValue placeholder="(inherit)" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="inherit">(inherit)</SelectItem>
                          <SelectItem value="1">Past 24h</SelectItem>
                          <SelectItem value="3">Past 3 days</SelectItem>
                          <SelectItem value="7">Past week</SelectItem>
                          <SelectItem value="14">Past 2 weeks</SelectItem>
                          <SelectItem value="30">Past month</SelectItem>
                          <SelectItem value="90">Past 3 months</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </fieldset>

            <div className="flex items-center justify-between gap-3 pt-1">
              {hasOverride ? (
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  onClick={() => onOverrideClear(row.provider)}
                  className="text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Clear overrides
                </Button>
              ) : (
                <span />
              )}
              {isThisProviderRunning ? (
                <Button
                  onClick={onStopScrape}
                  variant="destructive"
                  size="sm"
                  className="shrink-0"
                >
                  <Square className="h-3.5 w-3.5" />
                  Stop
                </Button>
              ) : (
                <Button
                  onClick={() => onRunSingle(row.provider)}
                  disabled={
                    isAnyScrapeRunning ||
                    !enabled ||
                    !row.runtimeAvailable ||
                    !canRunSingle
                  }
                  size="sm"
                  className="shrink-0"
                >
                  <Play className="h-4 w-4" />
                  Run
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

interface AdminListingsManualPageProps {
  onDashboardCacheInvalidate?: () => void;
  onRefreshRequest?: () => void;
}

export const AdminListingsManualPage = (
  props: AdminListingsManualPageProps,
) => {
  const { onDashboardCacheInvalidate } = props;
  const [result, setResult] =
    useState<DesktopAdminListingsProvidersApiResult | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [remote, setRemote] = useState(true);
  const [insertAnyway, setInsertAnyway] = useState(false);
  const [city, setCity] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [country, setCountry] = useState('United States');
  const [globalMaxPages, setGlobalMaxPages] = useState('');
  const [globalDateRange, setGlobalDateRange] = useState<
    'all' | '1' | '3' | '7' | '14' | '30' | '90'
  >('all');
  const [initialScrapeProgress] = useState(loadPersistedScrapeProgress);
  const [activeScrapeId, setActiveScrapeId] = useState<string | null>(
    () => initialScrapeProgress?.activeScrapeId ?? null,
  );
  const [isScrapePaused, setIsScrapePaused] = useState(
    () => initialScrapeProgress?.isScrapePaused ?? false,
  );
  const [scrapeStatus, setScrapeStatus] = useState<ScrapeStatusState>(
    () => initialScrapeProgress?.scrapeStatus ?? emptyScrapeStatus,
  );
  const [progressEvents, setProgressEvents] = useState<
    DesktopAdminScrapeProgressEvent[]
  >(() => [...(initialScrapeProgress?.progressEvents ?? [])]);
  const progressLogRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollProgressRef = useRef(true);
  const [scrapeTerminalStatus, setScrapeTerminalStatus] = useState<
    string | null
  >(() => initialScrapeProgress?.scrapeTerminalStatus ?? null);
  const [providerLiveStatuses, setProviderLiveStatuses] = useState<
    Record<string, ProviderLiveStatus>
  >(() => initialScrapeProgress?.providerLiveStatuses ?? {});
  const [runningProvider, setRunningProvider] = useState<string | null>(
    () => initialScrapeProgress?.runningProvider ?? null,
  );
  const [providerEnabled, setProviderEnabled] =
    useState<Record<string, boolean>>(loadProviderEnabled);
  const [providerOverrides, setProviderOverrides] = useState<
    Record<string, DesktopAdminProviderOverride>
  >({});
  const [expandedProviders, setExpandedProviders] = useState<
    ReadonlySet<string>
  >(new Set());

  const handleToggleExpand = (provider: string) => {
    setExpandedProviders(prev => {
      const next = new Set(prev);
      if (next.has(provider)) next.delete(provider);
      else next.add(provider);
      return next;
    });
  };

  const handleOverrideChange = (
    provider: string,
    next: DesktopAdminProviderOverride,
  ) => {
    setProviderOverrides(prev => ({ ...prev, [provider]: next }));
  };

  const handleOverrideClear = (provider: string) => {
    setProviderOverrides(prev => {
      const next = { ...prev };
      delete next[provider];
      return next;
    });
  };
  const [savedSearches, setSavedSearches] = useState<
    readonly DesktopAdminSavedSearchRow[]
  >([]);
  const [isSavingSearch, setIsSavingSearch] = useState(false);
  const [runHistoryProvider, setRunHistoryProvider] = useState<string | null>(
    null,
  );
  const [runHistory, setRunHistory] = useState<
    readonly DesktopAdminProviderRunRow[]
  >([]);
  const [isLoadingRunHistory, setIsLoadingRunHistory] = useState(false);
  const [runHistoryError, setRunHistoryError] = useState<string | null>(null);

  const handleViewRunHistory = async (provider: string) => {
    setRunHistoryProvider(provider);
    setRunHistory([]);
    setRunHistoryError(null);
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.getProviderRuns) return;
    setIsLoadingRunHistory(true);
    try {
      const response = await adminApi.getProviderRuns({ provider, limit: 25 });
      if (response.ok) {
        setRunHistory(response.runs);
      } else {
        setRunHistoryError(response.error);
      }
    } catch (error) {
      setRunHistoryError(
        error instanceof Error ? error.message : String(error),
      );
    } finally {
      setIsLoadingRunHistory(false);
    }
  };

  const isCurrentSearchSaved = savedSearches.some(
    s =>
      s.searchTerm === searchTerm.trim() &&
      (s.location ?? '') ===
        (remote
          ? ''
          : [city.trim(), stateCode, country].filter(Boolean).join(', ')),
  );

  const handleSaveCurrentSearch = async () => {
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.saveSearch) return;
    const term = searchTerm.trim();
    if (!term || isSavingSearch || isCurrentSearchSaved) return;
    setIsSavingSearch(true);
    const location = remote
      ? null
      : [city.trim(), stateCode, country].filter(Boolean).join(', ') || null;
    const parsedMaxPages = globalMaxPages.trim()
      ? Number(globalMaxPages)
      : undefined;
    try {
      const response = await adminApi.saveSearch({
        searchTerm: term,
        location,
        remote,
        maxPages:
          parsedMaxPages !== undefined &&
          Number.isFinite(parsedMaxPages) &&
          parsedMaxPages > 0
            ? parsedMaxPages
            : undefined,
        postedWithin: globalDateRange === 'all' ? undefined : globalDateRange,
      });
      if (response.ok) {
        setSavedSearches(prev => [
          response.search,
          ...prev.filter(s => s.id !== response.search.id),
        ]);
      } else {
        setScrapeStatus({ message: response.error, tone: 'error' });
      }
    } catch (error) {
      setScrapeStatus({
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    } finally {
      setIsSavingSearch(false);
    }
  };

  useEffect(() => {
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.getSavedSearches) return;
    void adminApi
      .getSavedSearches()
      .then(response => {
        if (response.ok) setSavedSearches(response.searches);
      })
      .catch(() => {
        /* non-fatal */
      });
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PROVIDER_TOGGLE_STORAGE_KEY,
        JSON.stringify(providerEnabled),
      );
    } catch {
      /* ignore */
    }
  }, [providerEnabled]);

  const handleToggleProvider = (provider: string, next: boolean) => {
    setProviderEnabled(prev => ({ ...prev, [provider]: next }));
  };

  const isProviderEnabled = (provider: string): boolean =>
    providerEnabled[provider] !== false; // Default to true when never toggled.

  useEffect(() => {
    writePersistedScrapeProgress({
      activeScrapeId,
      isScrapePaused,
      progressEvents,
      providerLiveStatuses,
      runningProvider,
      scrapeStatus,
      scrapeTerminalStatus,
    });
  }, [
    activeScrapeId,
    isScrapePaused,
    progressEvents,
    providerLiveStatuses,
    runningProvider,
    scrapeStatus,
    scrapeTerminalStatus,
  ]);

  // Subscribe to scrape progress whenever activeScrapeId is set.
  useEffect(() => {
    if (!activeScrapeId) return;
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.subscribeScrape || !adminApi.onScrapeProgress) return;

    shouldAutoScrollProgressRef.current = true;

    const off = adminApi.onScrapeProgress(delta => {
      if (delta.scrapeId !== activeScrapeId) return;
      if (!delta.ok) {
        setScrapeStatus({
          message: delta.error,
          tone: 'error',
        });
        return;
      }
      if (delta.events && delta.events.length > 0) {
        setProgressEvents(prev => mergeProgressEvents(prev, delta.events!));
        setProviderLiveStatuses(prev =>
          mergeProviderLiveStatuses(prev, delta.events!),
        );
      }
      if (delta.terminal) {
        setScrapeTerminalStatus(delta.status);
        setActiveScrapeId(null);
        setIsScrapePaused(false);
        setRunningProvider(null);
        onDashboardCacheInvalidate?.();
        void fetchAnalytics();
        setScrapeStatus({
          message: `Scrape ${delta.status.toLowerCase()}.`,
          tone:
            delta.status === 'COMPLETED'
              ? 'idle'
              : delta.status === 'FAILED'
                ? 'error'
                : 'idle',
        });
      }
    });
    void adminApi.subscribeScrape({ scrapeId: activeScrapeId });

    return () => {
      off();
      void adminApi.unsubscribeScrape?.({ scrapeId: activeScrapeId });
    };
  }, [activeScrapeId, onDashboardCacheInvalidate]);

  useEffect(() => {
    const log = progressLogRef.current;
    if (!log || !shouldAutoScrollProgressRef.current) return;
    log.scrollTop = log.scrollHeight;
  }, [progressEvents.length]);

  const fetchProviders = async () => {
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi) {
      setResult({ error: 'Desktop admin bridge unavailable.', ok: false });
      return;
    }
    try {
      const next = await adminApi.getListingsProviders();
      setResult(next);
    } catch (error) {
      setResult({
        error: error instanceof Error ? error.message : String(error),
        ok: false,
      });
    }
  };

  // Stub: this page used to refresh listings analytics after every
  // scrape event, but the analytics panel was moved to the Dashboard
  // view. The call sites still reference it as a hook for future use
  // (e.g. a "Recent scrapes" summary on this page) — define it as a
  // no-op so those `void fetchAnalytics()` calls don't ReferenceError.
  const fetchAnalytics = async (): Promise<void> => {};

  useEffect(() => {
    void fetchProviders();
  }, []);

  const handleStartScrape = async () => {
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.startScrape) return;
    setScrapeStatus({
      message: 'Starting scrape…',
      tone: 'running',
    });
    setProgressEvents([]);
    setProviderLiveStatuses({});
    setScrapeTerminalStatus(null);
    setIsScrapePaused(false);
    setRunningProvider(null);
    // Always send the enabled provider list — the desktop IPC requires
    // providers to be non-empty even when "all enabled" is the user intent.
    const enabledProviders = result?.ok
      ? result.providers
          .filter(p => isProviderEnabled(p.provider))
          .map(p => p.provider)
      : [];

    const nonEmptyOverrides = Object.fromEntries(
      Object.entries(providerOverrides).filter(
        ([provider, override]) =>
          // Only include overrides for providers that are enabled and that
          // actually have a non-empty field set, otherwise it's noise.
          isProviderEnabled(provider) &&
          (override.maxPages !== undefined ||
            override.postedWithin !== undefined ||
            override.searchTerm !== undefined ||
            override.insertAnyway !== undefined ||
            override.location !== undefined ||
            override.remote !== undefined),
      ),
    );

    const parsedGlobalMaxPages = globalMaxPages.trim()
      ? Number(globalMaxPages)
      : undefined;

    try {
      const response = await adminApi.startScrape({
        providerOverrides:
          Object.keys(nonEmptyOverrides).length > 0
            ? nonEmptyOverrides
            : undefined,
        providers: enabledProviders,
        remote,
        searchTerm: searchTerm.trim() || undefined,
        insertAnyway,
        city: remote ? undefined : city.trim() || undefined,
        stateCode: remote ? undefined : stateCode || undefined,
        country: remote ? undefined : country || undefined,
        globalDateRange:
          globalDateRange === 'all' ? undefined : globalDateRange,
        maxPages:
          parsedGlobalMaxPages !== undefined &&
          Number.isFinite(parsedGlobalMaxPages) &&
          parsedGlobalMaxPages > 0
            ? parsedGlobalMaxPages
            : undefined,
      });
      if (response.ok) {
        setActiveScrapeId(response.scrapeId);
        onDashboardCacheInvalidate?.();
        void fetchAnalytics();
        setScrapeStatus({
          message: response.scrapeId
            ? `Scrape started (scrapeId ${response.scrapeId.slice(0, 8)}…).`
            : 'Scrape started.',
          tone: 'running',
        });
      } else {
        setScrapeStatus({
          message:
            response.status === 403
              ? 'Forbidden — sign in to the web admin in this Electron window first so the session cookie is available.'
              : response.error,
          tone: 'error',
        });
      }
    } catch (error) {
      setScrapeStatus({
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const handleStartSingleProvider = async (provider: string) => {
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.startScrape) return;
    setScrapeStatus({
      message: `Starting ${provider}…`,
      tone: 'running',
    });
    setProgressEvents([]);
    setProviderLiveStatuses({});
    setScrapeTerminalStatus(null);
    setIsScrapePaused(false);
    const override = providerOverrides[provider];
    const parsedGlobalMaxPages = globalMaxPages.trim()
      ? Number(globalMaxPages)
      : undefined;
    try {
      const response = await adminApi.startScrape({
        providers: [provider],
        providerOverrides: override ? { [provider]: override } : undefined,
        searchTerm: searchTerm.trim() || undefined,
        remote,
        insertAnyway,
        city: remote ? undefined : city.trim() || undefined,
        stateCode: remote ? undefined : stateCode || undefined,
        country: remote ? undefined : country || undefined,
        globalDateRange:
          globalDateRange === 'all' ? undefined : globalDateRange,
        maxPages:
          parsedGlobalMaxPages !== undefined &&
          Number.isFinite(parsedGlobalMaxPages) &&
          parsedGlobalMaxPages > 0
            ? parsedGlobalMaxPages
            : undefined,
      });
      if (response.ok) {
        setActiveScrapeId(response.scrapeId);
        setIsScrapePaused(false);
        setRunningProvider(provider);
        onDashboardCacheInvalidate?.();
        void fetchAnalytics();
        setScrapeStatus({
          message: `Running ${provider}…`,
          tone: 'running',
        });
      } else {
        setScrapeStatus({
          message:
            response.status === 403
              ? 'Forbidden — sign in to the web admin in this Electron window first so the session cookie is available.'
              : response.error,
          tone: 'error',
        });
      }
    } catch (error) {
      setScrapeStatus({
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const handleStopScrape = async () => {
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.stopScrape || !activeScrapeId) return;
    setScrapeStatus(prev => ({ ...prev, message: 'Stopping…' }));
    try {
      const response = await adminApi.stopScrape({
        scrapeId: activeScrapeId,
      });
      if (response.ok) {
        setActiveScrapeId(null);
        setRunningProvider(null);
        setIsScrapePaused(false);
        setScrapeTerminalStatus('CANCELLED');
        onDashboardCacheInvalidate?.();
        void fetchAnalytics();
        setScrapeStatus({
          message: 'Scrape cancelled.',
          tone: 'idle',
        });
      } else {
        setScrapeStatus({
          message: response.error,
          tone: 'error',
        });
      }
    } catch (error) {
      setScrapeStatus({
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const handlePauseScrape = async () => {
    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.pauseScrape || !activeScrapeId) return;
    const nextPaused = !isScrapePaused;
    setIsScrapePaused(nextPaused);
    setScrapeStatus({
      message: nextPaused ? 'Scrape paused.' : 'Scrape resumed.',
      tone: 'running',
    });
    try {
      const response = await adminApi.pauseScrape({
        scrapeId: activeScrapeId,
        paused: nextPaused,
      });
      if (!response.ok) {
        setIsScrapePaused(!nextPaused);
        setScrapeStatus({
          message: response.error,
          tone: 'error',
        });
      }
    } catch (error) {
      setIsScrapePaused(!nextPaused);
      setScrapeStatus({
        message: error instanceof Error ? error.message : String(error),
        tone: 'error',
      });
    }
  };

  const providersResult = result?.ok ? result : null;
  const providerRows = providersResult?.providers ?? [];
  const providerLoadError = result && !result.ok ? result.error : null;
  const isProviderDataLoading = result === null;

  const errorProviders = providerRows.filter(
    p => !p.runtimeAvailable || p.lastStatus === 'error',
  ).length;
  const successProviders = providerRows.filter(
    p => p.lastStatus === 'success',
  ).length;
  const enabledCount = providerRows.filter(p =>
    isProviderEnabled(p.provider),
  ).length;

  const isRunning = activeScrapeId !== null && !scrapeTerminalStatus;
  const isProgressActive = isRunning && !isScrapePaused;
  const statusBg =
    scrapeStatus.tone === 'error'
      ? 'border-red-500/15 bg-red-500/[0.04] text-red-100'
      : scrapeStatus.tone === 'running'
        ? 'border-blue-500/15 bg-blue-500/[0.04] text-blue-100'
        : 'border-white/[0.06] bg-card/40 text-muted-foreground';

  const allEnabled =
    providerRows.length > 0 &&
    providerRows.every(p => isProviderEnabled(p.provider));
  const noneEnabled = providerRows.length === 0 || enabledCount === 0;

  const enabledWithHistory = providerRows.filter(
    p => isProviderEnabled(p.provider) && p.providerRuns > 0,
  );
  const nextRunEstimate = enabledWithHistory.reduce(
    (acc, p) => ({
      fetched: acc.fetched + Math.round(p.avgFetched),
      created: acc.created + Math.round(p.avgCreated),
    }),
    { fetched: 0, created: 0 },
  );

  return (
    <div className="space-y-6">
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <div className="min-w-0 space-y-6">
          <section className="desktop-admin-card space-y-4 p-4">
            <div className="grid items-end gap-3 md:grid-cols-[minmax(0,1fr)_auto_auto_minmax(12rem,16rem)]">
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="searchTerm" className="text-xs">
                  Search Term
                </Label>
                <Input
                  id="searchTerm"
                  value={searchTerm}
                  onChange={event => setSearchTerm(event.target.value)}
                  placeholder="e.g. software engineer"
                  disabled={isRunning}
                />
              </div>
              <div className="self-start space-y-1">
                <Label htmlFor="global-insert-anyway" className="block text-xs">
                  Insert anyway
                </Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="global-insert-anyway"
                    checked={insertAnyway}
                    onCheckedChange={setInsertAnyway}
                    disabled={isRunning}
                    aria-label="Insert fetched jobs even when they do not match filters"
                  />
                </div>
              </div>
              <div className="self-start space-y-1">
                <Label htmlFor="global-remote-only" className="block text-xs">
                  Remote only
                </Label>
                <div className="flex h-9 items-center">
                  <Switch
                    id="global-remote-only"
                    checked={remote}
                    onCheckedChange={setRemote}
                    disabled={isRunning}
                    aria-label="Toggle remote only filter"
                  />
                </div>
              </div>
              <div className="min-w-0 space-y-1.5">
                <Label htmlFor="saved-searches" className="text-xs">
                  Saved searches
                </Label>
                {savedSearches.length > 0 ? (
                  <Select
                    disabled={isRunning}
                    onValueChange={value => {
                      const saved = savedSearches.find(s => s.id === value);
                      if (!saved) return;
                      setSearchTerm(saved.searchTerm);
                      if (saved.remote !== null) setRemote(saved.remote);
                    }}
                  >
                    <SelectTrigger id="saved-searches">
                      <SelectValue placeholder="Load saved" />
                    </SelectTrigger>
                    <SelectContent>
                      {savedSearches.map(s => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.searchTerm}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select disabled>
                    <SelectTrigger id="saved-searches">
                      <SelectValue placeholder="No saved searches" />
                    </SelectTrigger>
                  </Select>
                )}
              </div>
            </div>

            <div
              className={cn(
                'grid gap-2 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_180px] transition-opacity duration-300',
                remote && 'pointer-events-none opacity-40',
              )}
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
                  disabled={remote || isRunning}
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
                  disabled={remote || isRunning}
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
                  disabled={remote || isRunning}
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

            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="flex flex-wrap items-start gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={
                    !searchTerm.trim() ||
                    isSavingSearch ||
                    isCurrentSearchSaved ||
                    isRunning
                  }
                  onClick={() => void handleSaveCurrentSearch()}
                  aria-label={
                    isCurrentSearchSaved
                      ? 'Search saved'
                      : 'Save current search'
                  }
                  title={
                    isCurrentSearchSaved
                      ? 'Search saved'
                      : 'Save current search'
                  }
                  className="mt-5 h-9 shrink-0 border-white/[0.08] bg-black/25 text-foreground/70 hover:border-white/[0.12] hover:bg-black/35 hover:text-foreground"
                >
                  {isSavingSearch ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Star
                      className={cn(
                        'h-4 w-4',
                        isCurrentSearchSaved && 'fill-current text-primary',
                      )}
                    />
                  )}
                  Save
                </Button>
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
                    onChange={event => setGlobalMaxPages(event.target.value)}
                    placeholder="Default"
                    disabled={isRunning}
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
                    disabled={isRunning}
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
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handlePauseScrape}
                      className="h-10"
                    >
                      {isScrapePaused ? (
                        <Play className="h-3.5 w-3.5" />
                      ) : (
                        <Pause className="h-3.5 w-3.5" />
                      )}
                      {isScrapePaused ? 'Resume' : 'Pause'}
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={handleStopScrape}
                      className="h-10 bg-gradient-to-br from-red-500/90 to-red-950 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.18)] hover:from-red-500 hover:to-red-900"
                    >
                      <Square className="h-3 w-3 fill-current" />
                      Stop All
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleStartScrape}
                    disabled={!searchTerm.trim() || noneEnabled}
                  >
                    <Play className="h-4 w-4" />
                    Run All
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-lg bg-primary/5 px-3 py-2.5 ring-1 ring-inset ring-primary/15">
              <div className="text-[11px] text-muted-foreground">
                Next run estimate{' '}
                <span className="text-muted-foreground/60">
                  (avg across {enabledWithHistory.length} providers with
                  history)
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                <span className="text-foreground">
                  ~{nextRunEstimate.fetched.toLocaleString()}{' '}
                  <span className="text-muted-foreground">fetched</span>
                </span>
                <span className="text-green-500">
                  ~{nextRunEstimate.created.toLocaleString()}{' '}
                  <span className="text-muted-foreground">created</span>
                </span>
              </div>
            </div>

            {scrapeStatus.message ? (
              <div
                className={`rounded-lg border px-3 py-2 text-[11px] ${statusBg}`}
              >
                {scrapeStatus.message}
              </div>
            ) : null}
          </section>

          <section className="desktop-admin-card space-y-4 p-4">
            <div className="flex items-center justify-between gap-3 px-3">
              <div className="flex items-center gap-2">
                <p className="text-xs font-medium text-foreground">
                  Provider runs
                </p>
                <span className="text-[10px] text-muted-foreground">
                  {providerRows.length > 0
                    ? `${enabledCount} of ${providerRows.length} enabled`
                    : 'Provider data pending'}
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
                  checked={allEnabled}
                  disabled={providerRows.length === 0}
                  onCheckedChange={next => {
                    if (next) {
                      setProviderEnabled({});
                    } else {
                      const map: Record<string, boolean> = {};
                      for (const p of providerRows) map[p.provider] = false;
                      setProviderEnabled(map);
                    }
                  }}
                  aria-label="Toggle all providers"
                  size="sm"
                />
              </div>
            </div>

            {providerRows.length > 0 && enabledCount === 0 ? (
              <p className="px-3 text-[11px] text-amber-400">
                All providers disabled — enable at least one to run a scrape.
              </p>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-white/[0.06]">
              {isProviderDataLoading ? (
                <div className="space-y-px">
                  {[0, 1, 2, 3].map(index => (
                    <div
                      key={index}
                      className="flex items-center gap-3 bg-black/15 px-4 py-3"
                    >
                      <div className="h-8 w-8 animate-pulse rounded-md bg-white/[0.06]" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-36 animate-pulse rounded bg-white/[0.07]" />
                        <div className="h-2.5 w-56 max-w-full animate-pulse rounded bg-white/[0.045]" />
                      </div>
                      <div className="h-6 w-20 animate-pulse rounded bg-white/[0.055]" />
                    </div>
                  ))}
                </div>
              ) : providerLoadError ? (
                <div className="border border-red-500/15 bg-red-500/[0.04] p-4 text-sm text-red-100">
                  <div className="font-medium text-red-200">
                    Failed to load scraper data
                  </div>
                  <pre className="mt-2 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed text-red-100/80">
                    {providerLoadError}
                  </pre>
                </div>
              ) : (
                providerRows.map((row, idx) => (
                  <div
                    key={row.provider}
                    className={cn(idx > 0 && 'border-t-2 border-black/60')}
                  >
                    <ProviderRow
                      row={row}
                      capabilities={MANUAL_PROVIDER_OPTIONS_BY_ID[row.provider]}
                      enabled={isProviderEnabled(row.provider)}
                      override={providerOverrides[row.provider]}
                      isExpanded={expandedProviders.has(row.provider)}
                      liveStatus={providerLiveStatuses[row.provider]}
                      isAnyScrapeRunning={isRunning}
                      isThisProviderRunning={runningProvider === row.provider}
                      canRunSingle={Boolean(searchTerm.trim())}
                      onToggle={handleToggleProvider}
                      onToggleExpand={handleToggleExpand}
                      onOverrideChange={handleOverrideChange}
                      onOverrideClear={handleOverrideClear}
                      onRunSingle={handleStartSingleProvider}
                      onStopScrape={handleStopScrape}
                      onViewRunHistory={p => void handleViewRunHistory(p)}
                    />
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between gap-3 px-3 text-[11px] text-muted-foreground/70">
              <span>
                {providerLoadError ? (
                  <span className="text-red-400">Scraper data unavailable</span>
                ) : isProviderDataLoading ? (
                  <span>Scraper data is loading inline</span>
                ) : (
                  <>
                    <span className="text-green-400">
                      {successProviders} healthy
                    </span>
                    {errorProviders > 0 ? (
                      <>
                        {' · '}
                        <span className="text-red-400">
                          {errorProviders} with issues
                        </span>
                      </>
                    ) : null}
                    {' · '}aggregated from automationAuditLog in{' '}
                    {providersResult.durationMs}ms
                  </>
                )}
              </span>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="link"
                  size="xs"
                  onClick={() => setProviderEnabled({})}
                  title="Reset all providers to enabled"
                  className="h-auto p-0 text-[10px] text-muted-foreground hover:text-foreground"
                >
                  Reset toggles
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  disabled={isRefreshing}
                  onClick={async () => {
                    setIsRefreshing(true);
                    await Promise.all([fetchProviders(), fetchAnalytics()]);
                    setIsRefreshing(false);
                  }}
                  className="gap-1.5"
                >
                  <RefreshCw
                    className={cn('h-3 w-3', isRefreshing && 'animate-spin')}
                  />
                  Refresh
                </Button>
              </div>
            </div>
          </section>
        </div>

        <div className="desktop-admin-card flex min-h-[28rem] flex-col overflow-hidden xl:sticky xl:top-4 xl:h-[calc(100vh-8rem)] xl:self-start">
          <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-4 py-3">
            <h2 className="flex min-w-0 items-center gap-2 text-lg font-semibold">
              <RefreshCw
                className={cn(
                  'h-4 w-4 shrink-0',
                  isProgressActive && 'animate-spin',
                )}
              />
              <span className="truncate">Live Progress</span>
              {scrapeTerminalStatus ? (
                <span className="rounded bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] font-normal text-muted-foreground">
                  {scrapeTerminalStatus.toLowerCase()}
                </span>
              ) : null}
            </h2>
            <div className="flex shrink-0 items-center gap-2">
              <span className="font-mono text-[10px] text-muted-foreground">
                {progressEvents.length} events
              </span>
              {progressEvents.length > 0 && !activeScrapeId ? (
                <button
                  type="button"
                  onClick={() => {
                    setProgressEvents([]);
                    setProviderLiveStatuses({});
                    setScrapeTerminalStatus(null);
                    setScrapeStatus(emptyScrapeStatus);
                  }}
                  className="rounded-md px-2 py-1 text-[10px] text-muted-foreground/60 transition-colors hover:text-foreground"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>
          <div
            ref={progressLogRef}
            onScroll={event => {
              const target = event.currentTarget;
              const distanceFromBottom =
                target.scrollHeight - target.scrollTop - target.clientHeight;
              shouldAutoScrollProgressRef.current = distanceFromBottom < 24;
            }}
            className="min-h-0 flex-1 overflow-y-auto text-xs leading-relaxed"
          >
            {progressEvents.length === 0 ? (
              <div className="flex min-h-full items-center justify-center px-3 py-3 text-muted-foreground">
                Logs will appear here…
              </div>
            ) : (
              <div className="divide-y divide-white/[0.055]">
                {progressEvents.map(event => (
                  <ScrapeProgressEventRow key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={runHistoryProvider !== null}
        onOpenChange={open => {
          if (!open) setRunHistoryProvider(null);
        }}
      >
        <ModalContent className="max-w-2xl">
          <ModalHeader>
            <ModalTitle>
              Run history{runHistoryProvider ? ` · ${runHistoryProvider}` : ''}
            </ModalTitle>
            <ModalDescription>
              Last 25 runs aggregated from automationAuditLog.
            </ModalDescription>
          </ModalHeader>
          <div className="max-h-[60vh] overflow-y-auto">
            {isLoadingRunHistory ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading runs…
              </div>
            ) : runHistoryError ? (
              <div className="rounded-md border border-red-500/15 bg-red-500/[0.04] p-3 text-xs text-red-100">
                {runHistoryError}
              </div>
            ) : runHistory.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No runs recorded yet for this provider.
              </div>
            ) : (
              <div className="divide-y divide-white/[0.05]">
                {runHistory.map(run => (
                  <div
                    key={run.id}
                    className="flex flex-wrap items-start gap-x-4 gap-y-1 px-1 py-2 text-xs"
                  >
                    <span className="font-mono text-muted-foreground">
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-0.5 text-[10px] font-medium',
                        run.status === 'success'
                          ? 'bg-green-500/10 text-green-300'
                          : run.status === 'error'
                            ? 'bg-red-500/10 text-red-300'
                            : 'bg-white/[0.04] text-muted-foreground',
                      )}
                    >
                      {run.status}
                    </span>
                    <span className="text-foreground">
                      {run.jobsFetched} fetched
                    </span>
                    <span className="text-green-500">
                      {run.jobsCreated} created
                    </span>
                    {run.jobsUpdated > 0 ? (
                      <span className="text-blue-500">
                        {run.jobsUpdated} updated
                      </span>
                    ) : null}
                    {run.durationMs !== null ? (
                      <span className="text-muted-foreground">
                        {(run.durationMs / 1000).toFixed(1)}s
                      </span>
                    ) : null}
                    {run.searchTerm ? (
                      <span className="ml-auto truncate text-muted-foreground/70">
                        “{run.searchTerm}”
                      </span>
                    ) : null}
                    {run.error ? (
                      <div className="w-full text-[11px] text-red-400">
                        {run.error}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </ModalContent>
      </Modal>
    </div>
  );
};
AdminListingsManualPage.displayName = 'AdminListingsManualPage';
