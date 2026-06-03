import type { CSSProperties, ReactNode } from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from 'react';
import {
  Activity,
  Briefcase,
  ChevronRight,
  Database,
  FileText,
  Target,
  Users,
  Zap,
} from 'lucide-react';

import {
  DEFAULT_DESKTOP_PANEL_SIZES,
  DESKTOP_RESIZE_HANDLE_WIDTH,
} from '../../electron/window-layout';
import { DesktopAgentChat } from '../components/desktop-agent-chat';
import {
  DesktopAppHeader,
  type DesktopAppHeaderSection,
} from '../components/desktop-app-header';
import {
  buildAgentObservation,
  type DesktopAgentObservation,
} from '../components/desktop-observations-popover';
import {
  DesktopSidebar,
  type DesktopDebugEvent,
  type DesktopHistoryEntry,
  type DesktopSidebarTab,
} from '../components/desktop-sidebar';
import { DesktopPageHeader } from '../components/desktop-page-header';
import { DesktopStatusBar } from '../components/desktop-status-bar';
import { useBrowserViewOverlayGuard } from '../hooks/use-browser-view-overlay-guard';
import { usePersistedState } from '../hooks/use-persisted-state';
import { DesktopTabBar, type DesktopTab } from '../components/desktop-tab-bar';
import {
  TailorResumePanel,
  type TailoredResumeRecord,
} from '../components/tailor-resume-panel';
import {
  DesktopBrowserBar,
  DesktopControlPanel,
} from '../components/desktop-toolbar';
import { AdminListingsManualPage } from '../admin/pages/admin-listings-manual';
import { AdminSmokeTestsPage } from '../admin/pages/admin-smoke-tests';
import { createLeadKey } from '../lib/submit-lead-storage';
import type {
  DesktopAgentChatRequest,
  DesktopAgentChatResult,
  DesktopAdminDashboardStatsApiResult,
  DesktopAdminListingsAnalyticsApiResult,
  DesktopAiProvider,
  DesktopAssistPageContext,
  DesktopAssistPageField,
  DesktopAssistNavState,
  DesktopAuthState,
  DesktopRuntimeProviderInfo,
  DesktopShellState,
  DesktopSubmitLeadRequest,
  DesktopSubmitLeadResult,
  DesktopUserActionReport,
} from '../desktop-api';
import type { DesktopFieldObservation } from '../components/desktop-sidebar';
import {
  loadSavedAiProvider,
  loadSavedEyeSaverMode,
  loadSavedMode,
  loadSavedRandomFilters,
  readSavedAiProvider,
  readSavedEyeSaverMode,
  readSavedMode,
  readSavedRandomFilters,
  readSavedRandomSearches,
  readSavedSubmitLeadDrafts,
  upsertSavedRandomSearch,
  upsertSavedSubmitLeadDraft,
  writeSavedAiProvider,
  writeSavedEyeSaverMode,
  writeSavedMode,
  writeSavedRandomFilters,
  writeSavedRandomSearches,
  writeSavedSubmitLeadDrafts,
  type DesktopUiMode,
  type SavedRandomFilters,
  type SavedRandomSearch,
  type SavedSubmitLeadDraft,
} from '../lib/submit-lead-storage';

const defaultAppUrl =
  import.meta.env.VITE_GIMME_JOB_APP_URL ?? 'https://app.gimme-job.com';
const defaultAssistUrl =
  import.meta.env.VITE_GIMME_JOB_ASSIST_URL ??
  'https://job-boards.greenhouse.io';

const MAX_DEBUG_EVENTS = 200;
const MAX_HISTORY_ENTRIES = 50;
const DESKTOP_DASHBOARD_CACHE_TTL_MS = 15 * 60 * 1000;

// Used by usePersistedState validators to guard against stale shapes when the
// JSON in localStorage was written by an older build that knew different
// section / tab names.
const HEADER_SECTIONS = new Set<string>([
  'dashboard',
  'training',
  'scraper',
]);
const SIDEBAR_TABS = new Set<string>([
  'controls',
  'chat',
  'state',
  'debug',
  'history',
  'observations',
]);

function parseAsString(raw: string): string | undefined {
  // Stored values may be either a raw string ('dashboard') or a JSON string
  // ('"dashboard"') depending on how the hook serialized them. Try both.
  if (raw && raw[0] === '"') {
    try {
      const parsed = JSON.parse(raw);
      return typeof parsed === 'string' ? parsed : undefined;
    } catch {
      return undefined;
    }
  }
  return raw;
}

function parseAsBoolean(raw: string): boolean | undefined {
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return undefined;
}

interface DesktopDashboardCache {
  cachedAt: number;
  dashboardStats: DesktopAdminDashboardStatsApiResult | null;
  listingsAnalytics: DesktopAdminListingsAnalyticsApiResult | null;
}

let desktopDashboardCache: DesktopDashboardCache | null = null;

function getDesktopDashboardCache() {
  if (!desktopDashboardCache) return null;
  if (
    Date.now() - desktopDashboardCache.cachedAt >
    DESKTOP_DASHBOARD_CACHE_TTL_MS
  ) {
    desktopDashboardCache = null;
    return null;
  }
  return desktopDashboardCache;
}

function invalidateDesktopDashboardCache() {
  desktopDashboardCache = null;
}

function writeDesktopDashboardCache(
  update: Partial<
    Pick<DesktopDashboardCache, 'dashboardStats' | 'listingsAnalytics'>
  >,
) {
  const current = getDesktopDashboardCache();
  desktopDashboardCache = {
    cachedAt: Date.now(),
    dashboardStats: Object.prototype.hasOwnProperty.call(
      update,
      'dashboardStats',
    )
      ? (update.dashboardStats ?? null)
      : (current?.dashboardStats ?? null),
    listingsAnalytics: Object.prototype.hasOwnProperty.call(
      update,
      'listingsAnalytics',
    )
      ? (update.listingsAnalytics ?? null)
      : (current?.listingsAnalytics ?? null),
  };
}

function formatSavedRandomSearchName(filters: SavedRandomFilters) {
  const title = filters.searchTitle.trim() || 'Any role';
  const location = filters.searchRemote
    ? 'Remote'
    : filters.searchLocation.trim() || 'Any location';
  const providerCount =
    filters.providers.length === 0
      ? 'all providers'
      : `${filters.providers.length} provider${filters.providers.length === 1 ? '' : 's'}`;
  return `${title} · ${location} · ${providerCount}`;
}

function formatPriorFailureSummary(entry: DesktopHistoryEntry): string {
  const time = new Date(entry.timestamp).toLocaleTimeString();
  const reason = entry.errorToolMessage ?? entry.message ?? 'failed';
  const trimmed = reason.length > 160 ? `${reason.slice(0, 157)}…` : reason;
  return `${time}: ${trimmed}`;
}

// Total attempts per job application before autopilot moves on. First
// pass starts fresh; subsequent passes use continueFromCurrentPage so
// the runner picks up where it left off (e.g. after a verification-code
// email finally arrives, or a lazy-mounted field appears). Retries skip
// already-filled fields (see readAlreadyFilledSelectorSet) so this no
// longer means "redo the whole form 5x" — each pass concentrates on the
// fields that still need attention. The validation-fingerprint check
// short-circuits when retrying won't help (same field, same error twice).
const MAX_AUTOPILOT_ATTEMPTS_PER_JOB = 5;
interface AutopilotStartOptions {
  readonly initialLead?: {
    readonly applicationUrl: string;
    readonly company?: string | null;
    readonly jobLeadId?: string | null;
    readonly jobListingId?: string;
    readonly title?: string | null;
  };
  readonly skipCurrent?: boolean;
}

// True when the URL points at a specific job application page (e.g.
// https://job-boards.greenhouse.io/<company>/jobs/<id>). Bare ATS roots
// (https://job-boards.greenhouse.io, https://boards.greenhouse.io/) and
// empty/about-blank URLs do NOT count — those should trigger a random
// pick instead of being treated as the "current job" on autopilot start.
function isJobApplicationUrl(url: string): boolean {
  if (!url) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;
  // Pathname is at least "/<segment>/<segment>..." — bare hostnames give "/".
  const pathSegments = parsed.pathname.split('/').filter(Boolean);
  return pathSegments.length >= 2;
}

function isRetriableAutopilotFailure(result: DesktopSubmitLeadResult): boolean {
  return result.status === 'failed';
}

// Pulls a short, readable label from a URL for tab titles. Falls back
// to the trimmed URL itself if hostname parsing fails (unusual urls
// like about:blank).
function deriveTabTitleFromUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return trimmed.length > 30 ? `${trimmed.slice(0, 28)}…` : trimmed;
  }
}

// P17.7 — fingerprint of structured validation failures so the autopilot
// retry loop can detect "we tried, the same fields complained the same way,
// trying again won't help" and short-circuit instead of burning every
// remaining attempt on an unanswerable form.
export function buildValidationFingerprint(
  failures: DesktopSubmitLeadResult['validationFailures'],
): string | null {
  if (!failures || failures.length === 0) return null;
  return failures
    .map(failure => `${failure.fieldLabel.trim()}::${failure.message.trim()}`)
    .sort()
    .join('|');
}

export function DesktopApp() {
  const [authState, setAuthState] = useState<DesktopAuthState>({
    message: 'Checking desktop token...',
    status: 'unpaired',
  });
  const [shellState, setShellState] = useState<DesktopShellState>({
    appUrl: defaultAppUrl,
    assistUrl: defaultAssistUrl,
    isEyeSaverMode: readSavedEyeSaverMode(),
    panelSizes: DEFAULT_DESKTOP_PANEL_SIZES,
  });
  const [pairingCode, setPairingCode] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isPickingRandom, startRandomTransition] = useTransition();
  const [isRunning, startRunTransition] = useTransition();
  const [headerSection, setHeaderSection] =
    usePersistedState<DesktopAppHeaderSection>(
      'desktop:header-section',
      'dashboard',
      {
        parse: raw => {
          const parsed = parseAsString(raw);
          return parsed && HEADER_SECTIONS.has(parsed)
            ? (parsed as DesktopAppHeaderSection)
            : undefined;
        },
        serialize: value => value,
      },
    );
  // BrowserViews are composited above the renderer's HTML by Electron —
  // there's no z-index escape hatch. We tell main which section is active
  // so it can collapse the BrowserViews to 0×0 on non-Training pages.
  useEffect(() => {
    const shell = window.gimmeJobDesktop?.shell;
    if (!shell?.setActiveSection) return;
    void shell.setActiveSection(headerSection);
  }, [headerSection]);
  // Hide BrowserViews while any Radix dropdown / popover / dialog is open
  // — same compositor limitation — so popovers that extend into the
  // BrowserView area aren't visually covered.
  useBrowserViewOverlayGuard();
  // Local theme toggle. Desktop styles are dark-by-default so this
  // starts true; flipping it strips the `.dark` class from <html> so
  // dark-mode-only Tailwind utilities go inactive.
  const [isDarkMode, setIsDarkMode] = useState(true);
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Tab state. Each tab carries the URL it's bound to so switching
  // between tabs swaps the BrowserView. Empty url ('') means the tab
  // has no destination yet — switching leaves the BrowserView alone.
  const [tabs, setTabs] = usePersistedState<readonly DesktopTab[]>(
    'desktop:tabs',
    [
      {
        id: 'working',
        title: 'Working',
        kind: 'working',
        closable: false,
        url: '',
      },
    ],
    {
      parse: raw => {
        try {
          const parsed = JSON.parse(raw);
          if (!Array.isArray(parsed)) return undefined;
          const tabs: DesktopTab[] = [];
          for (const candidate of parsed) {
            if (!candidate || typeof candidate !== 'object') continue;
            const c = candidate as Partial<DesktopTab>;
            if (
              typeof c.id !== 'string' ||
              typeof c.title !== 'string' ||
              typeof c.kind !== 'string' ||
              typeof c.url !== 'string' ||
              typeof c.closable !== 'boolean'
            ) {
              continue;
            }
            tabs.push({
              closable: c.closable,
              id: c.id,
              kind: c.kind as DesktopTab['kind'],
              title: c.title,
              url: c.url,
            });
          }
          if (tabs.length === 0) return undefined;
          // Guarantee a 'working' tab exists so the rest of the UI keeps its
          // invariants — if the stored list dropped it for some reason,
          // splice one back in at the start.
          if (!tabs.some(tab => tab.id === 'working')) {
            tabs.unshift({
              closable: false,
              id: 'working',
              kind: 'working',
              title: 'Working',
              url: '',
            });
          }
          return tabs;
        } catch {
          return undefined;
        }
      },
    },
  );
  const [activeTabId, setActiveTabId] = usePersistedState<string>(
    'desktop:active-tab-id',
    'working',
    { parse: parseAsString, serialize: value => value },
  );
  const tabIdCounterRef = useRef(0);

  // If localStorage restored an activeTabId pointing at a tab that no longer
  // exists (e.g. the tabs list was edited from another window or corrupted),
  // fall back to the always-present 'working' tab.
  useEffect(() => {
    if (tabs.some(tab => tab.id === activeTabId)) return;
    setActiveTabId(tabs[0]?.id ?? 'working');
  }, [activeTabId, setActiveTabId, tabs]);

  const handleCreateTab = useCallback((nextUrl?: string) => {
    tabIdCounterRef.current += 1;
    const id = `tab-${Date.now()}-${tabIdCounterRef.current}`;
    setTabs(current => [
      ...current,
      {
        id,
        title:
          deriveTabTitleFromUrl(nextUrl ?? '') ?? `New tab ${current.length}`,
        kind: 'custom',
        closable: true,
        url: nextUrl ?? '',
      },
    ]);
    setActiveTabId(id);
  }, []);

  const navigateToUrl = useCallback((nextUrl: string) => {
    const trimmed = nextUrl.trim();
    if (!trimmed) return;
    void window.gimmeJobDesktop?.shell.setAssistUrl(trimmed);
  }, []);

  const handleSelectTab = useCallback(
    (id: string) => {
      setActiveTabId(id);
      const tab = tabs.find(t => t.id === id);
      if (tab?.url) {
        navigateToUrl(tab.url);
      }
    },
    [navigateToUrl, tabs],
  );

  const handleCloseTab = useCallback(
    (id: string) => {
      setTabs(current => {
        const target = current.find(tab => tab.id === id);
        if (!target?.closable) return current;
        const next = current.filter(tab => tab.id !== id);
        setActiveTabId(activeId => {
          if (activeId !== id) return activeId;
          const fallback =
            next.find(tab => tab.kind === 'working') ?? next[next.length - 1];
          if (fallback?.url) {
            navigateToUrl(fallback.url);
          }
          return fallback?.id ?? activeId;
        });
        return next;
      });
    },
    [navigateToUrl],
  );

  const handleReorderTabs = useCallback((nextIds: readonly string[]) => {
    setTabs(current => {
      const byId = new Map(current.map(tab => [tab.id, tab]));
      const reordered: DesktopTab[] = [];
      for (const id of nextIds) {
        const tab = byId.get(id);
        if (tab) reordered.push(tab);
      }
      // Drop any IDs that vanished mid-drag, append any tabs that were
      // missing from the reorder list to keep state stable.
      for (const tab of current) {
        if (!nextIds.includes(tab.id)) reordered.push(tab);
      }
      return reordered;
    });
  }, []);

  const [observations, setObservations] = useState<
    readonly DesktopAgentObservation[]
  >([]);
  const [assistPageContext, setAssistPageContext] =
    useState<DesktopAssistPageContext | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] =
    usePersistedState<DesktopSidebarTab>(
      'desktop:sidebar-tab',
      'controls',
      {
        parse: raw => {
          const parsed = parseAsString(raw);
          return parsed && SIDEBAR_TABS.has(parsed)
            ? (parsed as DesktopSidebarTab)
            : undefined;
        },
        serialize: value => value,
      },
    );
  const [isSidebarOpen, setIsSidebarOpen] = usePersistedState<boolean>(
    'desktop:sidebar-open',
    true,
    { parse: parseAsBoolean, serialize: value => String(value) },
  );
  // User preference: when on, picking a random job / loading a saved job
  // spawns a new tab instead of replacing the current view. Persisted in
  // localStorage. Off by default. The wiring is intentionally minimal —
  // we call handleCreateTab() before the URL set so the tab strip shows
  // a fresh tab for the new job context.
  const [openInNewTab, setOpenInNewTab] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      return window.localStorage.getItem('desktop:open-in-new-tab') === 'true';
    } catch {
      return false;
    }
  });
  const handleOpenInNewTabChange = useCallback((value: boolean) => {
    setOpenInNewTab(value);
    try {
      window.localStorage.setItem(
        'desktop:open-in-new-tab',
        value ? 'true' : 'false',
      );
    } catch {
      // localStorage unavailable — preference will reset next launch.
    }
  }, []);
  const openInNewTabRef = useRef(openInNewTab);
  useEffect(() => {
    openInNewTabRef.current = openInNewTab;
  }, [openInNewTab]);

  // Sync external URL changes (URL bar submit, random pick, saved load,
  // reload, autopilot) onto the currently-active tab so the strip
  // reflects what the BrowserView is actually showing. Only updates
  // when the URL actually changes for this tab to avoid render loops.
  useEffect(() => {
    const liveUrl = shellState.assistUrl;
    setTabs(currentTabs => {
      const active = currentTabs.find(tab => tab.id === activeTabId);
      if (!active || active.url === liveUrl) return currentTabs;
      const nextTitle =
        active.kind === 'working'
          ? 'Working'
          : (deriveTabTitleFromUrl(liveUrl) ?? active.title);
      return currentTabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, url: liveUrl, title: nextTitle }
          : tab,
      );
    });
  }, [activeTabId, shellState.assistUrl]);
  const [isAuthPopoverOpen, setIsAuthPopoverOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('Ready');

  const [debugEvents, setDebugEvents] = useState<readonly DesktopDebugEvent[]>(
    [],
  );
  const [history, setHistory] = useState<readonly DesktopHistoryEntry[]>([]);

  const [mode, setMode] = useState<DesktopUiMode>(() => readSavedMode());
  const [aiProvider, setAiProvider] = useState<DesktopAiProvider>(() =>
    readSavedAiProvider(),
  );
  const settingsHydratedRef = useRef(false);
  const initialRandomFilters = readSavedRandomFilters();
  const [randomProvider, setRandomProvider] = useState(
    initialRandomFilters.provider,
  );
  const [randomProviders, setRandomProviders] = useState(
    initialRandomFilters.providers,
  );
  const [runtimeProviderSelection, setRuntimeProviderSelection] = useState(
    initialRandomFilters.runtimeProviders,
  );
  const [runtimeProviderOptions, setRuntimeProviderOptions] = useState<
    readonly DesktopRuntimeProviderInfo[]
  >([]);
  const [detectedRuntimeProvider, setDetectedRuntimeProvider] =
    useState<DesktopRuntimeProviderInfo | null>(null);
  const [searchTitle, setSearchTitle] = useState(
    initialRandomFilters.searchTitle,
  );
  const [searchLocation, setSearchLocation] = useState(
    initialRandomFilters.searchLocation,
  );
  const [searchRemote, setSearchRemote] = useState(
    initialRandomFilters.searchRemote,
  );
  const [jobLeadId, setJobLeadId] = useState('');
  const [currentTitle, setCurrentTitle] = useState('');
  const [savedDrafts, setSavedDrafts] = useState<
    readonly SavedSubmitLeadDraft[]
  >([]);
  const [savedSearches, setSavedSearches] = useState<
    readonly SavedRandomSearch[]
  >([]);
  const [isSavedMenuOpen, setIsSavedMenuOpen] = useState(false);
  const [lastSubmittedLeadKey, setLastSubmittedLeadKey] = useState<
    string | null
  >(null);
  const [assistNavState, setAssistNavState] = useState<DesktopAssistNavState>({
    canGoBack: false,
    canGoForward: false,
  });
  const [fieldObservations, setFieldObservations] = useState<
    readonly DesktopFieldObservation[]
  >([]);
  const [isAutopilotEnabled, setIsAutopilotEnabled] = useState(false);
  const [isAutopilotActive, setIsAutopilotActive] = useState(false);
  const autopilotActiveRef = useRef(false);
  const autopilotLoopActiveRef = useRef(false);
  const startAutopilotRef = useRef<
    ((options?: AutopilotStartOptions) => void) | null
  >(null);
  const [isAutopilotPaused, setIsAutopilotPaused] = useState(false);
  const autopilotPausedRef = useRef(false);
  const [isAutofillPaused, setIsAutofillPaused] = useState(false);

  const isRefreshingAssistPageContextRef = useRef(false);
  // Rotate recently-served random picks so the user doesn't keep
  // landing on the same listing or the same company. Listings keep a
  // longer history (30) while companies turn over faster (8) so a
  // company isn't blacklisted forever just because they have many
  // openings.
  const recentRandomListingIdsRef = useRef<readonly string[]>([]);
  const recentRandomCompaniesRef = useRef<readonly string[]>([]);
  // URLs we've already attempted to submit during this autopilot session.
  // Prevents the same job from coming up twice when our random picker
  // hands back a fresh listing-id that points at a URL we've already
  // tried (cross-source duplicates) or when a confirmation false-negative
  // failed to record a real submission server-side.
  const attemptedSubmitUrlsRef = useRef<Set<string>>(new Set());
  // P17.15 — URLs whose autopilot run hit the same validation fingerprint
  // twice (P17.7). Cleared on app quit only; future picks skip these.
  const validationBlockedUrlsRef = useRef<Set<string>>(new Set());
  // When a refresh is requested while another is already in flight (e.g.
  // submit run completes mid-poll), queue exactly one follow-up so the
  // requester sees the post-action state instead of the snapshot the
  // in-flight call captured a moment too early.
  const pendingAssistPageContextRefreshRef = useRef(false);
  const jobLeadIdRef = useRef(jobLeadId);
  useEffect(() => {
    jobLeadIdRef.current = jobLeadId;
  }, [jobLeadId]);

  // Fetch the runtime ATS provider list once on mount. Filter to providers
  // that ship a real runner so the picker only offers training-ready ATSes.
  useEffect(() => {
    const providersApi = window.gimmeJobDesktop?.providers;
    if (!providersApi) return;
    let cancelled = false;
    void providersApi
      .listRuntime()
      .then(list => {
        if (cancelled) return;
        setRuntimeProviderOptions(
          list.filter(provider => provider.runner !== null),
        );
      })
      .catch(() => {
        // Non-fatal — the multi-select will fall back to an empty option list.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-detect the runtime ATS whenever the active page URL changes so the
  // State tab can show e.g. "Detected ATS: Lever (production)".
  useEffect(() => {
    const providersApi = window.gimmeJobDesktop?.providers;
    if (!providersApi) return;
    const url = shellState.assistUrl;
    if (!url) {
      setDetectedRuntimeProvider(null);
      return;
    }
    let cancelled = false;
    void providersApi
      .detectFor(url)
      .then(provider => {
        if (cancelled) return;
        setDetectedRuntimeProvider(provider);
      })
      .catch(() => {
        if (cancelled) return;
        setDetectedRuntimeProvider(null);
      });
    return () => {
      cancelled = true;
    };
  }, [shellState.assistUrl]);

  const pushDebugEvent = useCallback(
    (
      kind: DesktopDebugEvent['kind'],
      message: string,
      detail?: string,
      status?: DesktopDebugEvent['status'],
    ) => {
      const event: DesktopDebugEvent = {
        detail,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind,
        message,
        status,
        timestamp: new Date().toISOString(),
      };
      setDebugEvents(current => [event, ...current].slice(0, MAX_DEBUG_EVENTS));
    },
    [],
  );

  const announce = useCallback(
    (message: string, kind: DesktopDebugEvent['kind'] = 'status') => {
      setStatusMessage(message);
      pushDebugEvent(kind, message);
    },
    [pushDebugEvent],
  );

  const refreshAssistPageContext = useCallback(async () => {
    const getAssistPageContext =
      window.gimmeJobDesktop?.shell.getAssistPageContext;
    if (!getAssistPageContext) {
      setAssistPageContext(null);
      return;
    }
    if (isRefreshingAssistPageContextRef.current) {
      pendingAssistPageContextRefreshRef.current = true;
      return;
    }

    isRefreshingAssistPageContextRef.current = true;
    try {
      const context = await getAssistPageContext();
      setAssistPageContext(context ?? null);
    } catch {
      setAssistPageContext(null);
    } finally {
      isRefreshingAssistPageContextRef.current = false;
      if (pendingAssistPageContextRefreshRef.current) {
        pendingAssistPageContextRefreshRef.current = false;
        // Run the queued follow-up in a microtask so React commits the
        // setAssistPageContext from this run before the next read.
        void Promise.resolve().then(() => refreshAssistPageContext());
      }
    }
  }, []);

  useEffect(() => {
    if (
      (!isRunning && !isAutopilotActive) ||
      !isSidebarOpen ||
      (activeSidebarTab !== 'state' && activeSidebarTab !== 'controls')
    ) {
      return;
    }

    void refreshAssistPageContext();
    const intervalId = window.setInterval(() => {
      void refreshAssistPageContext();
    }, 1000);

    // Also refresh immediately when the assist webContents reports a
    // navigation — without this the State tab can lag up to a second
    // behind a navigation and momentarily show stale fields from the
    // previous page.
    const unsubscribe = window.gimmeJobDesktop?.shell?.onAssistPageChanged?.(
      () => {
        void refreshAssistPageContext();
      },
    );

    return () => {
      window.clearInterval(intervalId);
      unsubscribe?.();
    };
  }, [
    activeSidebarTab,
    isAutopilotActive,
    isRunning,
    isSidebarOpen,
    refreshAssistPageContext,
  ]);

  useEffect(() => {
    setSavedDrafts(readSavedSubmitLeadDrafts());
    setSavedSearches(readSavedRandomSearches());
  }, []);

  useEffect(() => {
    const unsubscribe = window.gimmeJobDesktop?.userActions.onReport(report => {
      const summary = `User ${report.trigger}: ${
        report.userChangedFields.length
      } changed, ${report.userFilledFields.length} filled, ${
        report.unchangedFields.length
      } untouched`;
      const detail = formatUserActionReport(report);
      pushDebugEvent('action', summary, detail);

      const hostname = readHostname(report.url);
      if (hostname) {
        const newObservations: DesktopFieldObservation[] = [
          ...report.userChangedFields.map(change =>
            buildFieldObservation({
              action: change.type,
              fieldId: change.id,
              fieldLabel: change.label,
              fieldType: change.type,
              hostname,
              priorAiValue: change.aiValue,
              value: change.userValue,
            }),
          ),
          ...report.userFilledFields.map(filled =>
            buildFieldObservation({
              action: filled.type,
              fieldId: filled.id,
              fieldLabel: filled.label,
              fieldType: filled.type,
              hostname,
              priorAiValue: null,
              value: filled.value,
            }),
          ),
        ];
        if (newObservations.length > 0) {
          setFieldObservations(current =>
            mergeFieldObservations(current, newObservations),
          );
        }
      }

      const observation: DesktopAgentObservation = {
        capturedAt: report.capturedAt,
        fieldCount: report.aiBaseline.length + report.userFilledFields.length,
        issueMessages: [
          ...report.userChangedFields.map(
            change =>
              `Corrected ${change.label || change.id}: "${change.aiValue}" → "${change.userValue}"`,
          ),
          ...report.userFilledFields.map(
            filled => `User filled ${filled.label || filled.id}`,
          ),
        ],
        requiredEmptyCount: report.emptyFields.length,
        submitStatus: report.trigger,
        title: report.url,
        url: report.url,
      };
      setObservations(current => [observation, ...current].slice(0, 20));
      void refreshAssistPageContext();

      if (report.trigger === 'submit') {
        const recordManualSubmit =
          window.gimmeJobDesktop?.submit.recordManualSubmit;
        if (recordManualSubmit) {
          const knownJobLeadId = jobLeadIdRef.current.trim() || undefined;
          recordManualSubmit({
            applicationUrl: report.url,
            jobLeadId: knownJobLeadId,
            message: 'User clicked submit on the assist page.',
          })
            .then(result => {
              if (result.outcome === 'applied') {
                invalidateDesktopDashboardCache();
                pushDebugEvent(
                  'submit',
                  'Marked application as submitted from manual click.',
                );
                if (autopilotActiveRef.current) {
                  startAutopilotRef.current?.({ skipCurrent: true });
                }
              }
            })
            .catch(error => {
              pushDebugEvent(
                'submit',
                'Failed to record manual submit.',
                error instanceof Error ? error.message : String(error),
                'error',
              );
            });
        }
      }
    });
    return unsubscribe;
  }, [pushDebugEvent, refreshAssistPageContext]);

  const isOverlayActive =
    headerSection !== 'training' || isSavedMenuOpen || isAuthPopoverOpen;

  useEffect(() => {
    void window.gimmeJobDesktop?.shell
      .setAssistOverlayActive(isOverlayActive)
      .catch(() => undefined);
  }, [isOverlayActive]);

  useEffect(() => {
    if (!settingsHydratedRef.current) return;
    writeSavedAiProvider(aiProvider);
  }, [aiProvider]);

  useEffect(() => {
    if (!settingsHydratedRef.current) return;
    writeSavedMode(mode);
  }, [mode]);

  useEffect(() => {
    let isCancelled = false;
    void Promise.all([
      loadSavedRandomFilters(),
      loadSavedMode(),
      loadSavedAiProvider(),
      loadSavedEyeSaverMode(),
    ]).then(([filters, savedMode, savedAi, savedEyeSaver]) => {
      if (isCancelled) return;
      setRandomProvider(filters.provider);
      setRandomProviders(filters.providers);
      setSearchTitle(filters.searchTitle);
      setSearchLocation(filters.searchLocation);
      setSearchRemote(filters.searchRemote);
      setMode(savedMode);
      setAiProvider(savedAi);
      setShellState(currentState =>
        currentState.isEyeSaverMode === savedEyeSaver
          ? currentState
          : { ...currentState, isEyeSaverMode: savedEyeSaver },
      );
      settingsHydratedRef.current = true;
    });
    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!settingsHydratedRef.current) return;
    writeSavedRandomFilters({
      provider: randomProvider,
      providers: randomProviders,
      runtimeProviders: runtimeProviderSelection,
      searchLocation,
      searchRemote,
      searchTitle,
    });
  }, [
    randomProvider,
    randomProviders,
    runtimeProviderSelection,
    searchLocation,
    searchRemote,
    searchTitle,
  ]);

  useEffect(() => {
    let isMounted = true;

    window.gimmeJobDesktop?.auth
      .getState()
      .then(nextState => {
        if (isMounted) setAuthState(nextState);
      })
      .catch(error => {
        if (!isMounted) return;
        setAuthState({
          message: error instanceof Error ? error.message : 'Auth check failed',
          status: 'invalid',
        });
      });

    if (!window.gimmeJobDesktop) {
      setAuthState({
        message: 'Desktop bridge unavailable.',
        status: 'invalid',
      });
    }

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let isMounted = true;

    window.gimmeJobDesktop?.shell
      .getState()
      .then(nextState => {
        if (isMounted) {
          setShellState(nextState);
          void refreshAssistPageContext();
        }
      })
      .catch(() => undefined);

    return () => {
      isMounted = false;
    };
  }, [refreshAssistPageContext]);

  const handlePair = () => {
    startTransition(async () => {
      try {
        const nextState =
          await window.gimmeJobDesktop?.auth.pairWithCode(pairingCode);
        if (nextState) {
          setAuthState(nextState);
          if (nextState.status === 'paired') setPairingCode('');
        }
      } catch (error) {
        setAuthState({
          message: error instanceof Error ? error.message : 'Pairing failed',
          status: 'invalid',
        });
      }
    });
  };

  const handleClearToken = () => {
    startTransition(async () => {
      const nextState = await window.gimmeJobDesktop?.auth.clearToken();
      if (nextState) setAuthState(nextState);
    });
  };

  const recordHistoryEntry = useCallback(
    (result: DesktopSubmitLeadResult, title: string) => {
      const failingCall = result.toolCalls.find(call => !call.ok);
      const newEntry: DesktopHistoryEntry = {
        aiProvider,
        applicationUrl: result.applicationUrl,
        errorTool: failingCall?.tool,
        errorToolReason: failingCall?.reason,
        errorToolMessage: failingCall?.errorMessage,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        jobLeadId: result.jobLeadId,
        message: result.message,
        mode: result.mode,
        status: result.status,
        timestamp: new Date().toISOString(),
        title: title || result.applicationUrl,
        toolCallCount: result.toolCalls.length,
        attemptCount: 1,
        priorFailureCount: 0,
        priorFailureSummaries: [],
      };
      setHistory(current => {
        // Dedupe: collapse retries of the same applicationUrl into a single
        // row so the History tab doesn't get spammed when autopilot retries
        // a job 3-4 times. The newest run becomes the visible row; prior
        // failure summaries are preserved in the merged entry's details.
        const existingIndex = current.findIndex(
          entry => entry.applicationUrl === result.applicationUrl,
        );
        if (existingIndex === -1) {
          return [newEntry, ...current].slice(0, MAX_HISTORY_ENTRIES);
        }
        const previous = current[existingIndex]!;
        const previousFailureSummary =
          previous.status === 'failed'
            ? formatPriorFailureSummary(previous)
            : null;
        const merged: DesktopHistoryEntry = {
          ...newEntry,
          attemptCount: (previous.attemptCount ?? 1) + 1,
          priorFailureCount:
            (previous.priorFailureCount ?? 0) +
            (previous.status === 'failed' ? 1 : 0),
          priorFailureSummaries: previousFailureSummary
            ? [
                previousFailureSummary,
                ...(previous.priorFailureSummaries ?? []),
              ].slice(0, 5)
            : previous.priorFailureSummaries,
        };
        const next = current.slice();
        next.splice(existingIndex, 1);
        return [merged, ...next].slice(0, MAX_HISTORY_ENTRIES);
      });
    },
    [aiProvider],
  );

  const handleCancelRun = useCallback(() => {
    pushDebugEvent('action', 'Stop run requested');
    const cancelRun = window.gimmeJobDesktop?.submit.cancelRun;
    if (!cancelRun) {
      const message =
        'Desktop bridge unavailable — restart the desktop app to load new IPC handlers.';
      pushDebugEvent('action', 'Stop run requested', message, 'error');
      announce(message, 'error');
      return;
    }
    void cancelRun()
      .then(result => {
        if (result.cancelled) {
          announce('Stopping run…');
          pushDebugEvent('action', 'Stop run requested', undefined, 'ok');
        } else {
          pushDebugEvent(
            'action',
            'Stop run requested',
            'No active run to cancel.',
            'warning',
          );
        }
      })
      .catch(error => {
        const message =
          error instanceof Error ? error.message : 'Failed to stop run';
        pushDebugEvent('action', 'Stop run requested', message, 'error');
        announce(message, 'error');
      });
  }, [announce, pushDebugEvent]);

  const handleRunSubmit = useCallback(
    (runMode: DesktopUiMode) => {
      if (authState.status !== 'paired') {
        announce('Pair this desktop before submit.', 'error');
        return;
      }
      const fallbackApplicationUrl = shellState.assistUrl.trim();
      if (!fallbackApplicationUrl) {
        announce('Load a Greenhouse lead before submitting.', 'error');
        return;
      }
      setMode(runMode);

      startRunTransition(async () => {
        let liveContext: DesktopAssistPageContext | null | undefined;
        try {
          liveContext =
            await window.gimmeJobDesktop?.shell.getAssistPageContext?.();
        } catch {
          liveContext = null;
        }
        if (liveContext) {
          setAssistPageContext(liveContext);
        }
        const applicationUrl =
          liveContext?.url?.trim() || fallbackApplicationUrl;
        const currentLeadKey = createLeadKey(applicationUrl, jobLeadId);
        const continueFromCurrentPage = lastSubmittedLeadKey === currentLeadKey;

        announce(
          runMode === 'submit'
            ? `Submitting ${applicationUrl}…`
            : `Autofilling ${applicationUrl}…`,
          'submit',
        );
        try {
          const nextShellState =
            await window.gimmeJobDesktop?.shell.setAssistUrl(applicationUrl);
          if (nextShellState) setShellState(nextShellState);

          const result = await window.gimmeJobDesktop?.submit.runLead({
            aiProvider,
            applicationUrl,
            continueFromCurrentPage,
            jobLeadId: jobLeadId.trim() || undefined,
            mode: runMode,
          });
          if (!result) throw new Error('Desktop submit bridge unavailable.');

          announce(
            `Result: ${result.status.replaceAll('_', ' ')}`,
            result.status === 'failed' ? 'error' : 'submit',
          );
          recordHistoryEntry(result, currentTitle);
          if (result.status !== 'cancelled') {
            invalidateDesktopDashboardCache();
          }

          if (
            result.status === 'blocked_by_submit_guard' ||
            result.status === 'completed'
          ) {
            setLastSubmittedLeadKey(currentLeadKey);
          }
          if (autopilotActiveRef.current && runMode === 'submit') {
            startAutopilotRef.current?.({ skipCurrent: true });
          }

          for (const call of result.toolCalls) {
            const summary = `${call.tool}${
              call.selector ? ` ${call.selector}` : ''
            }`;
            const detailParts: string[] = [];
            if (call.reason) detailParts.push(`reason: ${call.reason}`);
            if (call.input) {
              detailParts.push(`input: ${JSON.stringify(call.input, null, 2)}`);
            }
            const fieldError =
              !call.ok && isFieldInputTool(call.tool)
                ? (call.errorMessage ?? 'Field action failed.')
                : null;
            if (fieldError) {
              detailParts.push(`field error: ${fieldError}`);
            } else if (call.errorMessage) {
              detailParts.push(`error: ${call.errorMessage}`);
            }
            const detail =
              detailParts.length > 0 ? detailParts.join('\n') : undefined;
            const kind: DesktopDebugEvent['kind'] = isObservationTool(call.tool)
              ? 'observation'
              : 'action';
            pushDebugEvent(kind, summary, detail, call.ok ? 'ok' : 'error');
          }
          void refreshAssistPageContext();
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Submit run failed';
          announce(message, 'error');
        }
      });
    },
    [
      aiProvider,
      announce,
      authState.status,
      currentTitle,
      jobLeadId,
      lastSubmittedLeadKey,
      pushDebugEvent,
      recordHistoryEntry,
      refreshAssistPageContext,
      shellState.assistUrl,
    ],
  );

  const handlePickRandom = useCallback(() => {
    if (authState.status !== 'paired') return;
    startRandomTransition(async () => {
      const providerLabel =
        randomProviders.length === 0
          ? 'all providers'
          : randomProviders.length === 1
            ? 'selected provider'
            : `${randomProviders.length} providers`;
      announce(`Picking a random ${providerLabel} lead…`, 'random');
      try {
        const recentListingIds = recentRandomListingIdsRef.current;
        const recentCompanies = recentRandomCompaniesRef.current;
        const result =
          await window.gimmeJobDesktop?.submit.pickRandomGreenhouseLead({
            excludeCompanies: recentCompanies,
            excludeListingIds: recentListingIds,
            location: searchRemote ? undefined : searchLocation,
            provider: randomProvider,
            providers: randomProviders,
            runtimeProviders: runtimeProviderSelection,
            remote: searchRemote,
            search: searchTitle,
          });
        if (!result) {
          throw new Error('Desktop random job bridge unavailable.');
        }

        recentRandomListingIdsRef.current = [
          result.jobListingId,
          ...recentListingIds.filter(id => id !== result.jobListingId),
        ].slice(0, 30);
        if (result.company) {
          recentRandomCompaniesRef.current = [
            result.company,
            ...recentCompanies.filter(name => name !== result.company),
          ].slice(0, 50);
        }

        if (openInNewTabRef.current) {
          handleCreateTab(result.applicationUrl);
        }

        const nextShellState = await window.gimmeJobDesktop?.shell.setAssistUrl(
          result.applicationUrl,
        );
        if (nextShellState) setShellState(nextShellState);
        void refreshAssistPageContext();
        setJobLeadId(result.jobLeadId ?? '');
        setCurrentTitle(result.title ?? '');
        const labelParts = [
          result.title,
          result.company ? `at ${result.company}` : null,
          result.location ? `in ${result.location}` : null,
        ].filter(Boolean);
        announce(
          `Loaded random ${providerLabel} job: ${labelParts.join(' ')}`,
          'random',
        );
        if (autopilotActiveRef.current) {
          startAutopilotRef.current?.({
            initialLead: {
              applicationUrl: result.applicationUrl,
              company: result.company,
              jobLeadId: result.jobLeadId,
              jobListingId: result.jobListingId,
              title: result.title,
            },
          });
        }
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Random job selection failed';
        announce(message, 'error');
      }
    });
  }, [
    announce,
    authState.status,
    handleCreateTab,
    randomProvider,
    randomProviders,
    refreshAssistPageContext,
    runtimeProviderSelection,
    searchLocation,
    searchRemote,
    searchTitle,
  ]);

  const stopAutopilot = useCallback(() => {
    if (!autopilotActiveRef.current) return;
    autopilotActiveRef.current = false;
    autopilotLoopActiveRef.current = false;
    autopilotPausedRef.current = false;
    setIsAutopilotEnabled(false);
    setIsAutopilotActive(false);
    setIsAutopilotPaused(false);
    announce('Autopilot stopped.', 'action');
    void window.gimmeJobDesktop?.submit.cancelRun().catch(() => undefined);
  }, [announce]);

  const handleToggleAutofillPause = useCallback(() => {
    setIsAutofillPaused(prev => {
      const next = !prev;
      void window.gimmeJobDesktop?.shell
        .setAutofillPaused(next)
        .catch(() => undefined);
      announce(
        next
          ? 'Autofill paused — agent will idle until resumed.'
          : 'Autofill resumed.',
      );
      return next;
    });
  }, [announce]);

  const handleToggleAutopilotPause = useCallback(() => {
    if (!autopilotActiveRef.current) return;
    const next = !autopilotPausedRef.current;
    autopilotPausedRef.current = next;
    setIsAutopilotPaused(next);
    announce(
      next
        ? 'Autopilot paused — finishing current step, then idle.'
        : 'Autopilot resumed.',
      'action',
    );
  }, [announce]);

  const startAutopilot = useCallback(
    (options: AutopilotStartOptions = {}) => {
      if (autopilotLoopActiveRef.current) return;
      if (authState.status !== 'paired') {
        announce('Pair this desktop before starting autopilot.', 'error');
        return;
      }
      if (!autopilotActiveRef.current) {
        autopilotActiveRef.current = true;
        setIsAutopilotActive(true);
      }
      autopilotLoopActiveRef.current = true;
      const autopilotMode = mode;
      announce(
        autopilotMode === 'submit'
          ? 'Autopilot running Submit.'
          : 'Autopilot running Autofill.',
        'submit',
      );

      // If a specific job page is already loaded, run it first instead of
      // immediately reloading a new random pick. Bare ATS roots (e.g.
      // https://job-boards.greenhouse.io with no path) are NOT a job — fall
      // through to the random picker instead.
      const initialUrl =
        options.initialLead?.applicationUrl ??
        (options.skipCurrent ? '' : shellState.assistUrl.trim());
      const initialLeadId =
        options.initialLead?.jobLeadId ?? (jobLeadId.trim() || undefined);
      const initialListingId = options.initialLead?.jobListingId;
      const initialTitle = options.initialLead?.title ?? currentTitle;
      const initialCompany = options.initialLead?.company ?? null;
      let usedInitial = options.skipCurrent
        ? true
        : !isJobApplicationUrl(initialUrl);

      void (async () => {
        try {
          while (autopilotActiveRef.current) {
            // If paused, idle in place until resumed or stopped. Polls fast
            // enough to feel responsive without burning CPU.
            if (autopilotPausedRef.current) {
              await new Promise(resolve => setTimeout(resolve, 500));
              continue;
            }
            let leadUrl: string;
            let leadId: string | undefined;
            let leadListingId: string | undefined;
            let leadTitle: string | undefined;
            let leadCompany: string | null | undefined;

            if (!usedInitial && initialUrl && isJobApplicationUrl(initialUrl)) {
              // First iteration: use the already-loaded job.
              usedInitial = true;
              leadUrl = initialUrl;
              leadId = initialLeadId;
              leadListingId = initialListingId;
              leadTitle = initialTitle;
              leadCompany = initialCompany;
              announce(
                `Autopilot: starting with current job${
                  initialTitle ? ` — ${initialTitle}` : ''
                }`,
                'submit',
              );
            } else {
              usedInitial = true;
              // Pick a random job that matches the current filters.
              let randomResult: Awaited<
                ReturnType<
                  NonNullable<
                    typeof window.gimmeJobDesktop
                  >['submit']['pickRandomGreenhouseLead']
                >
              > | null = null;
              try {
                randomResult =
                  (await window.gimmeJobDesktop?.submit.pickRandomGreenhouseLead(
                    {
                      excludeCompanies: recentRandomCompaniesRef.current,
                      excludeListingIds: recentRandomListingIdsRef.current,
                      location: searchRemote ? undefined : searchLocation,
                      provider: randomProvider,
                      providers: randomProviders,
                      runtimeProviders: runtimeProviderSelection,
                      remote: searchRemote,
                      search: searchTitle,
                    },
                  )) ?? null;
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Autopilot random pick failed';
                announce(message, 'error');
                await new Promise(resolve => setTimeout(resolve, 1500));
                continue;
              }
              if (!autopilotActiveRef.current) break;
              if (!randomResult) {
                announce(
                  'Autopilot: no matching jobs found, retrying soon…',
                  'random',
                );
                await new Promise(resolve => setTimeout(resolve, 1500));
                continue;
              }

              // If we've already attempted this URL in the current session
              // (cross-source duplicate, or a previous confirmation
              // false-negative that didn't record server-side), skip. Also
              // skip URLs the validation-fingerprint blocklist (P17.15)
              // captured on a prior pass — those are unanswerable for this
              // session.
              const isValidationBlocked = validationBlockedUrlsRef.current.has(
                randomResult.applicationUrl,
              );
              const isAttemptedSubmit =
                autopilotMode === 'submit' &&
                attemptedSubmitUrlsRef.current.has(randomResult.applicationUrl);
              if (isAttemptedSubmit || isValidationBlocked) {
                const reason = isValidationBlocked
                  ? 'validation errors recurred earlier this session'
                  : 'already attempted this URL this session';
                announce(
                  `Autopilot: skipping ${randomResult.title ?? 'job'} — ${reason}.`,
                  'random',
                );
                // Still record the listing-id so we don't keep cycling here.
                recentRandomListingIdsRef.current = [
                  randomResult.jobListingId,
                  ...recentRandomListingIdsRef.current.filter(
                    id => id !== randomResult!.jobListingId,
                  ),
                ].slice(0, 30);
                continue;
              }

              // Track recent picks so we don't loop on the same listing/company.
              recentRandomListingIdsRef.current = [
                randomResult.jobListingId,
                ...recentRandomListingIdsRef.current.filter(
                  id => id !== randomResult!.jobListingId,
                ),
              ].slice(0, 30);
              if (randomResult.company) {
                recentRandomCompaniesRef.current = [
                  randomResult.company,
                  ...recentRandomCompaniesRef.current.filter(
                    c => c !== randomResult!.company,
                  ),
                ].slice(0, 8);
              }

              // Load the new URL in the assist view.
              try {
                const nextShellState =
                  await window.gimmeJobDesktop?.shell.setAssistUrl(
                    randomResult.applicationUrl,
                  );
                if (nextShellState) setShellState(nextShellState);
              } catch {
                continue;
              }
              setJobLeadId(randomResult.jobLeadId ?? '');
              setCurrentTitle(randomResult.title ?? '');
              announce(
                `Autopilot: ${randomResult.title ?? 'job'}${
                  randomResult.company ? ` at ${randomResult.company}` : ''
                }`,
                'random',
              );

              leadUrl = randomResult.applicationUrl;
              leadId = randomResult.jobLeadId ?? undefined;
              leadListingId = randomResult.jobListingId ?? undefined;
              leadTitle = randomResult.title ?? undefined;
              leadCompany = randomResult.company;
            }
            void leadCompany;

            // Give the page time to load before the agent starts inspecting.
            // Poll the assist page context until it returns a meaningful page
            // (or a 7-second cap). This is more reliable than a fixed sleep
            // because Greenhouse pages can be slow to render their forms.
            const pageLoadDeadline = Date.now() + 7000;
            let pageReady = false;
            while (Date.now() < pageLoadDeadline) {
              if (!autopilotActiveRef.current) break;
              try {
                const ctx =
                  await window.gimmeJobDesktop?.shell.getAssistPageContext();
                const fields = ctx?.fields ?? [];
                if (fields.length > 0) {
                  pageReady = true;
                  break;
                }
              } catch {
                // ignore — try again next tick
              }
              await new Promise(resolve => setTimeout(resolve, 600));
            }
            if (!autopilotActiveRef.current) break;
            if (!pageReady) {
              announce(
                'Autopilot: page never finished loading, skipping',
                'action',
              );
              continue;
            }

            // 3. Run the submit flow. The runner has its own
            //    closed-posting detection; on a 404 we just continue. On a
            //    transient `failed`, retry once before giving up.
            // Mark submit-mode URLs as attempted up-front so even if the run
            // errors mid-flight (or reports a confirmation false-negative), the
            // URL won't come up again in this session. Autofill mode can revisit
            // a job because the user may still submit it manually.
            if (autopilotMode === 'submit') {
              attemptedSubmitUrlsRef.current.add(leadUrl);
            }
            let runStatus: string | undefined;
            let shouldRetryRun = false;
            // Per-job memory of validation-failure fingerprints. Cleared each
            // outer iteration so the next job starts fresh.
            const seenValidationFingerprints = new Set<string>();
            for (
              let attempt = 0;
              attempt < MAX_AUTOPILOT_ATTEMPTS_PER_JOB;
              attempt += 1
            ) {
              if (!autopilotActiveRef.current) break;
              shouldRetryRun = false;
              try {
                const result = await window.gimmeJobDesktop?.submit.runLead({
                  aiProvider,
                  applicationUrl: leadUrl,
                  continueFromCurrentPage: attempt > 0,
                  jobLeadId: leadId,
                  jobListingId: leadListingId,
                  mode: autopilotMode,
                });
                if (result) {
                  recordHistoryEntry(result, leadTitle ?? '');
                  if (result.status !== 'cancelled') {
                    invalidateDesktopDashboardCache();
                  }
                  const headline = `Autopilot result: ${result.status.replaceAll('_', ' ')}`;
                  const message =
                    result.message && result.message.trim()
                      ? result.message
                      : null;
                  const announceText = message
                    ? `${headline} — ${message}`
                    : headline;
                  announce(
                    announceText,
                    result.status === 'failed' ? 'error' : 'submit',
                  );
                  if (result.status === 'failed' && message) {
                    pushDebugEvent(
                      'action',
                      `Autopilot failure (${leadUrl})`,
                      `${message}\nTool calls: ${result.toolCalls.length}\nLog: ~/Documents/Gimme Job/run-logs/`,
                      'error',
                    );
                  }
                  runStatus = result.status;
                  shouldRetryRun =
                    autopilotMode === 'submit' &&
                    isRetriableAutopilotFailure(result);

                  // P17.7: if the same set of (fieldLabel, errorText) tuples
                  // comes back twice on this job, retrying won't help — the
                  // resolver doesn't have an answer for those fields. Stop
                  // hammering the form and let the outer loop move on.
                  const fingerprint = buildValidationFingerprint(
                    result.validationFailures,
                  );
                  if (fingerprint) {
                    if (seenValidationFingerprints.has(fingerprint)) {
                      announce(
                        'Autopilot: identical validation errors recurred — moving on',
                        'error',
                      );
                      pushDebugEvent(
                        'action',
                        `Autopilot validation short-circuit (${leadUrl})`,
                        `Same field(s) failed validation twice: ${fingerprint.replaceAll('|', '\n')}`,
                        'error',
                      );
                      runStatus = 'validation_failed';
                      shouldRetryRun = false;
                      // P17.15 — drop the URL into the session blocklist so
                      // subsequent random picks skip it until app quit.
                      validationBlockedUrlsRef.current.add(leadUrl);
                    } else {
                      seenValidationFingerprints.add(fingerprint);
                    }
                  }
                }
              } catch (error) {
                const message =
                  error instanceof Error
                    ? error.message
                    : 'Autopilot submit failed';
                announce(message, 'error');
                shouldRetryRun = autopilotMode === 'submit';
              }
              // Retry only on a hard failure (not on cancel / blocked / completed
              // / paused-for-review). Up to 2 retries (3 total attempts) catches
              // transient flakes — verification email arriving late, lazy fields
              // mounting after a delay, intl-tel-input phone rewrite — without
              // spending forever on a dead listing.
              if (!shouldRetryRun) break;
              if (!autopilotActiveRef.current) break;
              if (attempt >= MAX_AUTOPILOT_ATTEMPTS_PER_JOB - 1) break;
              announce(
                `Autopilot: retrying after failed run (attempt ${attempt + 2}/${MAX_AUTOPILOT_ATTEMPTS_PER_JOB})…`,
                'action',
              );
              await new Promise(resolve => setTimeout(resolve, 1500));
            }

            void refreshAssistPageContext();

            if (!autopilotActiveRef.current) break;
            if (autopilotMode !== 'submit') break;

            // 4. Pause so the user can see the post-submit confirmation page
            //    (thank-you / "application received") before we navigate to the
            //    next pick. Longer on a successful submit, short on failure.
            // For non-completed runs (failed / paused / blocked / validation),
            // fall through to pick the next random — the URL is already in
            // attemptedSubmitUrlsRef / validationBlockedUrlsRef so the picker
            // won't re-deal the same listing.
            const settleMs = runStatus === 'completed' ? 3500 : 1500;
            await new Promise(resolve => setTimeout(resolve, settleMs));
          }
        } finally {
          autopilotLoopActiveRef.current = false;
          if (!autopilotActiveRef.current) {
            setIsAutopilotActive(false);
          }
        }
      })();
    },
    [
      aiProvider,
      announce,
      authState.status,
      currentTitle,
      jobLeadId,
      mode,
      randomProvider,
      randomProviders,
      recordHistoryEntry,
      refreshAssistPageContext,
      runtimeProviderSelection,
      searchLocation,
      searchRemote,
      searchTitle,
      shellState.assistUrl,
    ],
  );
  startAutopilotRef.current = startAutopilot;

  const handleToggleAutopilot = useCallback(() => {
    if (autopilotActiveRef.current) {
      stopAutopilot();
    } else {
      setIsAutopilotEnabled(true);
      autopilotActiveRef.current = true;
      setIsAutopilotActive(true);
      announce(
        isRunning
          ? 'Autopilot on — will pick the next matching job after this run finishes.'
          : mode === 'submit'
            ? 'Autopilot on — picking the next matching job.'
            : 'Autopilot on — picking a matching job to autofill.',
        'action',
      );
      if (!isRunning) {
        startAutopilotRef.current?.({ skipCurrent: true });
      }
    }
  }, [announce, isRunning, mode, stopAutopilot]);

  const resolveJobTitle = useCallback(async (): Promise<string> => {
    const trimmedCurrent = currentTitle.trim();
    if (trimmedCurrent) return trimmedCurrent;
    try {
      const assistTitle = await window.gimmeJobDesktop?.shell.getAssistTitle();
      if (typeof assistTitle === 'string' && assistTitle.trim()) {
        return assistTitle.trim();
      }
    } catch {
      /* ignore — fall through to URL fallback */
    }
    return shellState.assistUrl;
  }, [currentTitle, shellState.assistUrl]);

  const handleSaveCurrentJob = useCallback(async () => {
    const resolvedTitle = await resolveJobTitle();
    const nextDraft: SavedSubmitLeadDraft = {
      applicationUrl: shellState.assistUrl,
      jobLeadId,
      mode,
      title: resolvedTitle,
    };
    const nextDrafts = upsertSavedSubmitLeadDraft(savedDrafts, nextDraft);

    writeSavedSubmitLeadDrafts(nextDrafts);
    setSavedDrafts(nextDrafts);
    setIsSavedMenuOpen(false);
    announce(`Saved "${resolvedTitle}" locally.`);
  }, [
    announce,
    jobLeadId,
    mode,
    resolveJobTitle,
    savedDrafts,
    shellState.assistUrl,
  ]);

  const getCurrentRandomFilters = useCallback(
    (): SavedRandomFilters => ({
      provider: randomProvider,
      providers: randomProviders,
      runtimeProviders: runtimeProviderSelection,
      searchLocation,
      searchRemote,
      searchTitle,
    }),
    [
      randomProvider,
      randomProviders,
      runtimeProviderSelection,
      searchLocation,
      searchRemote,
      searchTitle,
    ],
  );

  const handleSaveCurrentSearch = useCallback(() => {
    const filters = getCurrentRandomFilters();
    const now = new Date().toISOString();
    const nextSearch: SavedRandomSearch = {
      createdAt: now,
      filters,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: formatSavedRandomSearchName(filters),
      updatedAt: now,
    };
    const nextSearches = upsertSavedRandomSearch(savedSearches, nextSearch);
    writeSavedRandomSearches(nextSearches);
    setSavedSearches(nextSearches);
    announce(`Saved search: ${nextSearch.name}`);
  }, [announce, getCurrentRandomFilters, savedSearches]);

  const handleLoadSavedSearch = useCallback(
    (search: SavedRandomSearch) => {
      setRandomProvider(search.filters.provider);
      setRandomProviders(search.filters.providers);
      setRuntimeProviderSelection(search.filters.runtimeProviders);
      setSearchLocation(search.filters.searchLocation);
      setSearchRemote(search.filters.searchRemote);
      setSearchTitle(search.filters.searchTitle);
      announce(`Loaded search: ${search.name}`);
    },
    [announce],
  );

  const handleLoadSavedJob = useCallback(
    (draft: SavedSubmitLeadDraft) => {
      setJobLeadId(draft.jobLeadId);
      setMode(draft.mode);
      setCurrentTitle(draft.title);
      setIsSavedMenuOpen(false);
      announce(`Loaded saved job: ${draft.title}`);
      if (openInNewTabRef.current) {
        handleCreateTab(draft.applicationUrl);
      }
      void window.gimmeJobDesktop?.shell
        .setAssistUrl(draft.applicationUrl)
        .then(nextState => {
          if (nextState) setShellState(nextState);
          void refreshAssistPageContext();
        });
    },
    [announce, handleCreateTab, refreshAssistPageContext],
  );

  const handleRemoveSavedJob = useCallback(
    (applicationUrl: string) => {
      const nextDrafts = savedDrafts.filter(
        draft => draft.applicationUrl !== applicationUrl,
      );
      writeSavedSubmitLeadDrafts(nextDrafts);
      setSavedDrafts(nextDrafts);
      if (nextDrafts.length === 0) setIsSavedMenuOpen(false);
    },
    [savedDrafts],
  );

  const handleAgentChat = async (
    request: DesktopAgentChatRequest,
  ): Promise<DesktopAgentChatResult> => {
    const result = await window.gimmeJobDesktop?.agent.chat(request);
    if (!result) {
      throw new Error('Desktop agent chat bridge unavailable.');
    }

    return result;
  };

  const handleChatResult = (result: DesktopAgentChatResult) => {
    setObservations(currentObservations =>
      [buildAgentObservation(result.context), ...currentObservations].slice(
        0,
        20,
      ),
    );
    setAssistPageContext(result.context);
  };

  const handleAssistUrlChange = useCallback((value: string) => {
    setShellState(currentState => ({ ...currentState, assistUrl: value }));
    setCurrentTitle('');
  }, []);

  const handleSubmitToolbarUrl = useCallback(() => {
    const url = shellState.assistUrl.trim();
    if (!url) return;
    void window.gimmeJobDesktop?.shell.setAssistUrl(url).then(nextState => {
      if (nextState) setShellState(nextState);
      void refreshAssistPageContext();
    });
  }, [refreshAssistPageContext, shellState.assistUrl]);

  const handleReload = useCallback(() => {
    const url = shellState.assistUrl.trim();
    if (!url) return;
    announce(`Reloading ${url}…`);
    void window.gimmeJobDesktop?.shell.setAssistUrl(url).then(nextState => {
      if (nextState) setShellState(nextState);
      void refreshAssistPageContext();
    });
  }, [announce, refreshAssistPageContext, shellState.assistUrl]);

  const handleFocusAssistField = useCallback(
    (field: DesktopAssistPageField) => {
      const selector = field.selector.trim();
      if (!selector) return;

      const highlightAssistField =
        window.gimmeJobDesktop?.shell.highlightAssistField;
      if (!highlightAssistField) {
        announce(
          'Desktop bridge unavailable — restart the desktop app to load new IPC handlers.',
          'error',
        );
        return;
      }

      void highlightAssistField(selector)
        .then(wasHighlighted => {
          if (!wasHighlighted) {
            announce('Field not found on current page.', 'error');
          }
        })
        .catch(error => {
          const message =
            error instanceof Error ? error.message : 'Failed to locate field';
          announce(message, 'error');
        });
    },
    [announce],
  );

  const handleTailorResume = useCallback(
    async (leadId: string): Promise<TailoredResumeRecord> => {
      const tailor = window.gimmeJobDesktop?.submit.tailorResumeForLead;
      if (!tailor) {
        throw new Error(
          'Resume tailoring is unavailable — restart the desktop app.',
        );
      }
      announce('Tailoring resume…', 'random');
      const result = await tailor({ leadId });
      announce('Tailored resume ready.');
      return {
        emphasizedKeywords: result.emphasizedKeywords,
        formats: { docx: result.formats.docx, pdf: result.formats.pdf },
        revisionId: result.revisionId,
        summary: result.summary,
      };
    },
    [announce],
  );

  const handleUseTailoredResumeInAssist = useCallback(
    async (record: TailoredResumeRecord) => {
      const swap = window.gimmeJobDesktop?.submit.swapAssistResumeFile;
      if (!swap) {
        return {
          injected: false,
          reason: 'Resume swap is unavailable — restart the desktop app.',
        };
      }
      return swap({
        fileName: `${record.summary.slice(0, 60).replace(/[^A-Za-z0-9._-]+/g, '_')}.pdf`,
        pdfUrl: record.formats.pdf,
      });
    },
    [],
  );

  const handleAssistGoBack = useCallback(() => {
    void window.gimmeJobDesktop?.shell.assistGoBack().then(nextState => {
      if (nextState) setAssistNavState(nextState);
      void refreshAssistPageContext();
    });
  }, [refreshAssistPageContext]);

  const handleAssistGoForward = useCallback(() => {
    void window.gimmeJobDesktop?.shell.assistGoForward().then(nextState => {
      if (nextState) setAssistNavState(nextState);
      void refreshAssistPageContext();
    });
  }, [refreshAssistPageContext]);

  useEffect(() => {
    void window.gimmeJobDesktop?.shell.getAssistNavState().then(nextState => {
      if (nextState) setAssistNavState(nextState);
    });
    const unsubscribe = window.gimmeJobDesktop?.shell.onAssistNavStateChange(
      nextState => {
        setAssistNavState(nextState);
        void refreshAssistPageContext();
      },
    );
    return () => {
      unsubscribe?.();
    };
  }, [refreshAssistPageContext]);

  const handleToggleEyeSaverMode = useCallback(() => {
    const nextMode = !shellState.isEyeSaverMode;

    setShellState(currentState => ({
      ...currentState,
      isEyeSaverMode: nextMode,
    }));
    writeSavedEyeSaverMode(nextMode);
    announce(nextMode ? 'Eye saver mode on' : 'Eye saver mode off');

    const setAssistEyeSaverMode =
      window.gimmeJobDesktop?.shell.setAssistEyeSaverMode;
    if (!setAssistEyeSaverMode) return;

    void setAssistEyeSaverMode(nextMode)
      .then(nextState => {
        setShellState(nextState);
      })
      .catch(error => {
        setShellState(currentState => ({
          ...currentState,
          isEyeSaverMode: !nextMode,
        }));
        writeSavedEyeSaverMode(!nextMode);
        announce(
          error instanceof Error ? error.message : 'Eye saver mode failed.',
          'error',
        );
      });
  }, [announce, shellState.isEyeSaverMode]);

  const lastOpenPanelSizesRef = useRef(shellState.panelSizes);
  useEffect(() => {
    if (isSidebarOpen) lastOpenPanelSizesRef.current = shellState.panelSizes;
  }, [isSidebarOpen, shellState.panelSizes]);

  const handleToggleSidebar = useCallback(() => {
    const nextOpen = !isSidebarOpen;
    setIsSidebarOpen(nextOpen);

    const targetSizes = nextOpen
      ? lastOpenPanelSizesRef.current
      : {
          assist: 100,
          main: shellState.panelSizes.main,
          sidebar: 0,
        };

    void window.gimmeJobDesktop?.shell
      .setPanelSizes(targetSizes)
      .then(nextState => {
        if (nextOpen) {
          setShellState(nextState);
        } else {
          setShellState(currentState => ({
            ...currentState,
            panelSizes: nextState.panelSizes,
          }));
        }
      })
      .catch(() => undefined);
  }, [isSidebarOpen, shellState.panelSizes.main]);

  const sidebarPct = isSidebarOpen ? (shellState.panelSizes.sidebar ?? 33) : 0;

  return (
    <main
      className="desktop-shell"
      style={
        {
          '--desktop-resize-handle-width': `${DESKTOP_RESIZE_HANDLE_WIDTH}px`,
        } as CSSProperties
      }
    >
      <DesktopAppHeader
        activeSection={headerSection}
        onSectionChange={setHeaderSection}
        isDarkMode={isDarkMode}
        onToggleDarkMode={() => setIsDarkMode(prev => !prev)}
        authState={authState}
        onSignOut={handleClearToken}
      />
      <svg
        aria-hidden
        className="pointer-events-none absolute left-0 -z-10 h-[38vw] w-full select-none"
        preserveAspectRatio="none"
        style={{
          top: '-36px',
          filter:
            'drop-shadow(0 0 0.4px rgba(255,255,255,0.06)) drop-shadow(0 0 0.4px rgba(255,255,255,0.06))',
        }}
        viewBox="0 0 100 22"
      >
        <text
          dominantBaseline="hanging"
          fill="rgba(255,255,255,0.06)"
          fontFamily='Impact, "Arial Black", "Helvetica Neue", sans-serif'
          fontWeight={900}
          lengthAdjust="spacingAndGlyphs"
          textLength="98"
          x="1"
          y="0"
        >
          ADMIN
        </text>
      </svg>
      {headerSection === 'dashboard' ? (
        <DesktopDashboardView
          aiProvider={aiProvider}
          authStatus={authState.status}
          currentTitle={currentTitle}
          fieldObservationCount={fieldObservations.length}
          isAutopilotActive={isAutopilotActive}
          isRunning={isRunning}
          mode={mode}
          observationCount={observations.length}
          onOpenScraper={() => setHeaderSection('scraper')}
          onOpenTraining={() => setHeaderSection('training')}
          randomProvider={randomProvider}
          savedDraftCount={savedDrafts.length}
          targetUrl={shellState.assistUrl}
        />
      ) : headerSection === 'training' ? (
        <div className="desktop-admin-scene desktop-training-scene">
          <div className="desktop-shell-body">
            {isSidebarOpen ? (
              <div className="desktop-shell-panels">
                <aside
                  className="desktop-sidebar-panel"
                  id="desktop-sidebar"
                  style={{
                    flexBasis: `calc(${sidebarPct}% + var(--desktop-resize-handle-width))`,
                  }}
                >
                  <DesktopSidebar
                    activeTab={activeSidebarTab}
                    agentChatView={
                      <DesktopAgentChat
                        authStatus={authState.status}
                        onChatResult={handleChatResult}
                        onSendMessage={handleAgentChat}
                      />
                    }
                    assistPageContext={assistPageContext}
                    controlsView={
                      <DesktopControlPanel
                        aiProvider={aiProvider}
                        applicationUrl={shellState.assistUrl}
                        authStatus={authState.status}
                        isAutopilotActive={isAutopilotActive}
                        isAutopilotEnabled={isAutopilotEnabled}
                        isAutopilotPaused={isAutopilotPaused}
                        isAutofillPaused={isAutofillPaused}
                        isPickingRandom={isPickingRandom}
                        isRunning={isRunning}
                        mode={mode}
                        onAiProviderChange={setAiProvider}
                        onCancelRun={handleCancelRun}
                        onLoadSavedSearch={handleLoadSavedSearch}
                        onModeChange={setMode}
                        onOpenInNewTabChange={handleOpenInNewTabChange}
                        onPickRandom={handlePickRandom}
                        onAutopilotEnabledChange={setIsAutopilotEnabled}
                        onRandomProvidersChange={providers => {
                          setRandomProviders(providers);
                          setRandomProvider(
                            providers.length === 1 &&
                              providers[0] === 'greenhouse-boards'
                              ? 'greenhouse'
                              : 'any',
                          );
                        }}
                        onRunAutofill={() => handleRunSubmit('training')}
                        onRunSubmit={() => handleRunSubmit('submit')}
                        onSaveCurrentSearch={handleSaveCurrentSearch}
                        onSearchLocationChange={setSearchLocation}
                        onSearchRemoteChange={setSearchRemote}
                        onSearchTitleChange={setSearchTitle}
                        onToggleAutofillPause={handleToggleAutofillPause}
                        onToggleAutopilot={handleToggleAutopilot}
                        onToggleAutopilotPause={handleToggleAutopilotPause}
                        openInNewTab={openInNewTab}
                        randomProviders={randomProviders}
                        runtimeProviderOptions={runtimeProviderOptions}
                        runtimeProviders={runtimeProviderSelection}
                        onRuntimeProvidersChange={setRuntimeProviderSelection}
                        savedSearches={savedSearches}
                        searchLocation={searchLocation}
                        searchRemote={searchRemote}
                        searchTitle={searchTitle}
                      />
                    }
                    debugEvents={debugEvents}
                    fieldObservations={fieldObservations}
                    history={history}
                    isAutofillPaused={isAutofillPaused}
                    isRuntimeBusy={
                      isRunning || isPickingRandom || isAutopilotActive
                    }
                    observations={observations}
                    onCancelRun={handleCancelRun}
                    onFocusAssistField={handleFocusAssistField}
                    onLoadSavedJob={handleLoadSavedJob}
                    onRefreshAssistPageContext={refreshAssistPageContext}
                    onTabChange={setActiveSidebarTab}
                    onToggleAutofillPause={handleToggleAutofillPause}
                    onToggleSidebar={handleToggleSidebar}
                    savedDrafts={savedDrafts}
                    tailorResumeView={
                      <TailorResumePanel
                        context={assistPageContext}
                        jobLeadId={jobLeadId.trim() || null}
                        onTailor={handleTailorResume}
                        onUseInAssist={handleUseTailoredResumeInAssist}
                      />
                    }
                    title="Training"
                    description="Run the agent on a real application, then correct fields or save rules to teach it for next time."
                    detectedRuntimeProvider={detectedRuntimeProvider}
                    runtimeProviderOptions={runtimeProviderOptions}
                  />
                </aside>

                <div className="desktop-browserview-panel" id="desktop-assist">
                  <DesktopTabBar
                    tabs={tabs}
                    activeTabId={activeTabId}
                    onSelectTab={handleSelectTab}
                    onCloseTab={handleCloseTab}
                    onCreateTab={handleCreateTab}
                    onReorderTabs={handleReorderTabs}
                  />
                  <DesktopBrowserBar
                    applicationUrl={shellState.assistUrl}
                    canGoBack={assistNavState.canGoBack}
                    canGoForward={assistNavState.canGoForward}
                    isSavedMenuOpen={isSavedMenuOpen}
                    isEyeSaverMode={shellState.isEyeSaverMode}
                    onApplicationUrlChange={handleAssistUrlChange}
                    onBack={handleAssistGoBack}
                    onForward={handleAssistGoForward}
                    onLoadSavedJob={handleLoadSavedJob}
                    onReload={handleReload}
                    onRemoveSavedJob={handleRemoveSavedJob}
                    onSaveCurrentJob={() => {
                      void handleSaveCurrentJob();
                    }}
                    onSubmitUrl={handleSubmitToolbarUrl}
                    onToggleSavedMenu={() => setIsSavedMenuOpen(open => !open)}
                    onToggleEyeSaverMode={handleToggleEyeSaverMode}
                    savedDrafts={savedDrafts}
                  />
                  <div aria-hidden className="desktop-browserview-spacer" />
                </div>
              </div>
            ) : (
              <div className="desktop-browserview-panel desktop-browserview-panel--solo">
                <DesktopTabBar
                  tabs={tabs}
                  activeTabId={activeTabId}
                  onSelectTab={handleSelectTab}
                  onCloseTab={handleCloseTab}
                  onCreateTab={handleCreateTab}
                  onReorderTabs={handleReorderTabs}
                />
                <DesktopBrowserBar
                  applicationUrl={shellState.assistUrl}
                  canGoBack={assistNavState.canGoBack}
                  canGoForward={assistNavState.canGoForward}
                  isSavedMenuOpen={isSavedMenuOpen}
                  isEyeSaverMode={shellState.isEyeSaverMode}
                  onApplicationUrlChange={handleAssistUrlChange}
                  onBack={handleAssistGoBack}
                  onForward={handleAssistGoForward}
                  onLoadSavedJob={handleLoadSavedJob}
                  onReload={handleReload}
                  onRemoveSavedJob={handleRemoveSavedJob}
                  onSaveCurrentJob={() => {
                    void handleSaveCurrentJob();
                  }}
                  onSubmitUrl={handleSubmitToolbarUrl}
                  onToggleSavedMenu={() => setIsSavedMenuOpen(open => !open)}
                  onToggleEyeSaverMode={handleToggleEyeSaverMode}
                  savedDrafts={savedDrafts}
                />
                <div aria-hidden className="desktop-browserview-spacer" />
              </div>
            )}
          </div>
        </div>
      ) : headerSection === 'scraper' ? (
        <div className="desktop-admin-scene desktop-scraper-scene">
          <div className="desktop-shell-body desktop-shell-body--scraper">
            <DesktopPageHeader
              className="px-0"
              title="Scraper"
              description="Set the global search, then enable providers below and run them all at once."
            />
            <div className="desktop-scraper-pane">
              <AdminListingsManualPage
                onDashboardCacheInvalidate={invalidateDesktopDashboardCache}
              />
            </div>
          </div>
        </div>
      ) : headerSection === 'smoke-tests' ? (
        <div className="desktop-admin-scene desktop-scraper-scene">
          <div className="desktop-shell-body desktop-shell-body--scraper">
            <DesktopPageHeader
              className="px-0"
              title="Smoke tests"
              description="Inspect per-provider smoke-test reports and copy run-log paths."
            />
            <div className="desktop-scraper-pane">
              <AdminSmokeTestsPage />
            </div>
          </div>
        </div>
      ) : null}

      <DesktopStatusBar
        activeUrl={shellState.assistUrl}
        authMessage={authState.message}
        authStatus={authState.status}
        fieldObservationCount={fieldObservations.length}
        historyCount={history.length}
        isAutopilotActive={isAutopilotActive}
        isAuthPopoverOpen={isAuthPopoverOpen}
        isPairing={isPending}
        isRunning={isRunning}
        onAuthPopoverOpenChange={setIsAuthPopoverOpen}
        onClearToken={handleClearToken}
        onPair={handlePair}
        onPairingCodeChange={setPairingCode}
        pairingCode={pairingCode}
        statusMessage={statusMessage}
      />
    </main>
  );
}

interface DesktopDashboardViewProps {
  readonly aiProvider: DesktopAiProvider;
  readonly authStatus: DesktopAuthState['status'];
  readonly currentTitle: string;
  readonly fieldObservationCount: number;
  readonly isAutopilotActive: boolean;
  readonly isRunning: boolean;
  readonly mode: DesktopUiMode;
  readonly observationCount: number;
  readonly onOpenScraper: () => void;
  readonly onOpenTraining: () => void;
  readonly randomProvider: 'any' | 'greenhouse';
  readonly savedDraftCount: number;
  readonly targetUrl: string;
}

function DesktopDashboardView({
  authStatus,
  isAutopilotActive,
  isRunning,
}: DesktopDashboardViewProps) {
  const [dashboardStats, setDashboardStats] =
    useState<DesktopAdminDashboardStatsApiResult | null>(
      () => getDesktopDashboardCache()?.dashboardStats ?? null,
    );
  const [listingsAnalytics, setListingsAnalytics] =
    useState<DesktopAdminListingsAnalyticsApiResult | null>(
      () => getDesktopDashboardCache()?.listingsAnalytics ?? null,
    );

  useEffect(() => {
    const cached = getDesktopDashboardCache();
    const needsDashboardStats = !cached?.dashboardStats;
    const needsListingsAnalytics = !cached?.listingsAnalytics;
    if (!needsDashboardStats && !needsListingsAnalytics) return;

    const adminApi = window.gimmeJobDesktop?.admin;
    if (!adminApi?.getDashboardStats || !adminApi.getListingsAnalytics) {
      const unavailableResult = {
        ok: false,
        error:
          'Desktop admin bridge unavailable — preload failed to expose window.gimmeJobDesktop.admin.',
      } as const;
      if (needsDashboardStats) {
        setDashboardStats(unavailableResult);
      }
      if (needsListingsAnalytics) {
        setListingsAnalytics(unavailableResult);
      }
      const nextCache: Partial<
        Pick<DesktopDashboardCache, 'dashboardStats' | 'listingsAnalytics'>
      > = {};
      if (needsDashboardStats) {
        nextCache.dashboardStats = unavailableResult;
      }
      if (needsListingsAnalytics) {
        nextCache.listingsAnalytics = unavailableResult;
      }
      writeDesktopDashboardCache(nextCache);
      return;
    }

    let cancelled = false;
    const toError = (error: unknown) =>
      error instanceof Error ? error.message : String(error);

    if (needsDashboardStats) {
      void adminApi
        .getDashboardStats()
        .then(nextDashboardStats => {
          if (cancelled || !nextDashboardStats) return;
          setDashboardStats(nextDashboardStats);
          writeDesktopDashboardCache({ dashboardStats: nextDashboardStats });
        })
        .catch(reason => {
          if (cancelled) return;
          console.error('[dashboard] getDashboardStats rejected', reason);
          const nextDashboardStats: DesktopAdminDashboardStatsApiResult = {
            ok: false,
            error: toError(reason),
          };
          setDashboardStats(nextDashboardStats);
          writeDesktopDashboardCache({ dashboardStats: nextDashboardStats });
        });
    }

    if (needsListingsAnalytics) {
      void adminApi
        .getListingsAnalytics()
        .then(nextListingsAnalytics => {
          if (cancelled || !nextListingsAnalytics) return;
          setListingsAnalytics(nextListingsAnalytics);
          writeDesktopDashboardCache({
            listingsAnalytics: nextListingsAnalytics,
          });
        })
        .catch(reason => {
          if (cancelled) return;
          console.error('[dashboard] getListingsAnalytics rejected', reason);
          const nextListingsAnalytics: DesktopAdminListingsAnalyticsApiResult = {
            ok: false,
            error: toError(reason),
          };
          setListingsAnalytics(nextListingsAnalytics);
          writeDesktopDashboardCache({
            listingsAnalytics: nextListingsAnalytics,
          });
        });
    }

    return () => {
      cancelled = true;
    };
  }, []);

  const runtimeState = isAutopilotActive
    ? 'Autopilot'
    : isRunning
      ? 'Running'
      : 'Ready';
  const stats = dashboardStats?.ok ? dashboardStats.stats : null;
  const listings = listingsAnalytics?.ok ? listingsAnalytics : null;

  return (
    <div className="desktop-admin-scene desktop-dashboard-scene">
      <div className="desktop-dashboard-body">
        <DesktopPageHeader
          className="px-0"
          title="Dashboard"
          description={`Platform-wide funnel, health KPIs, and activity overview. Desktop runtime: ${runtimeState}.`}
        />
        {stats ? (
          <WebAdminDashboardSection authStatus={authStatus} stats={stats} />
        ) : (
          <WebAdminDashboardSectionLoading
            authStatus={authStatus}
            error={dashboardStats?.ok === false ? dashboardStats.error : null}
          />
        )}

        {listings ? (
          <ListingsDashboardSection analytics={listings} />
        ) : (
          <ListingsDashboardSectionLoading
            error={
              listingsAnalytics?.ok === false ? listingsAnalytics.error : null
            }
          />
        )}
      </div>
    </div>
  );
}

type DesktopDashboardStats = Extract<
  DesktopAdminDashboardStatsApiResult,
  { ok: true }
>['stats'];
type DesktopListingsAnalytics = Extract<
  DesktopAdminListingsAnalyticsApiResult,
  { ok: true }
>;

function WebAdminDashboardSectionLoading({
  authStatus,
  error,
}: {
  readonly authStatus: DesktopAuthState['status'];
  readonly error: string | null;
}) {
  return (
    <section className="desktop-dashboard-section">
      <DashboardPanel
        description="End-to-end pipeline from ingestion to offers."
        title="Platform Funnel"
      >
        {error ? (
          <DashboardLoadingNotice text={`Failed to load: ${error}`} />
        ) : (
          <DashboardFunnelLoading />
        )}
      </DashboardPanel>

      <div className="desktop-dashboard-widget-grid desktop-dashboard-widget-grid--two">
        <DashboardPanel
          description="Platform activity in the last 24 hours."
          title="24h Activity"
        >
          <DashboardMiniGridLoading count={5} variant="five" />
          <DashboardLoadingLines count={2} />
        </DashboardPanel>

        <DashboardPanel
          description="Weekly volume across pipeline stages."
          title="7-Day Trends"
        >
          <DashboardLoadingLines count={3} />
        </DashboardPanel>
      </div>

      <div className="desktop-dashboard-widget-grid desktop-dashboard-widget-grid--three">
        <DashboardPanel title="Resume Health" icon={FileText}>
          <DashboardMiniGridLoading count={4} />
        </DashboardPanel>

        <DashboardPanel title="Applications" icon={Briefcase}>
          <DashboardMiniGridLoading count={4} />
        </DashboardPanel>

        <DashboardPanel title="Users & Platform" icon={Users}>
          <DashboardMiniGridLoading count={4} />
          <p className="desktop-dashboard-auth-note">
            Desktop auth: {authStatus}
          </p>
        </DashboardPanel>
      </div>

      <div className="desktop-dashboard-widget-grid desktop-dashboard-widget-grid--two">
        <DashboardPanel title="Last 5 Users" icon={Users}>
          <DashboardLoadingLines count={5} />
        </DashboardPanel>

        <DashboardPanel title="Automation & Ops" icon={Zap}>
          <DashboardMiniGridLoading count={3} variant="three" />
          <DashboardMiniGridLoading count={2} variant="two" />
        </DashboardPanel>
      </div>

      <DashboardPanel title="Fantastic Budget">
        <div className="desktop-dashboard-budget-grid">
          <DashboardBudgetLoading />
          <DashboardBudgetLoading />
          <DashboardLoadingTile />
          <DashboardLoadingTile />
        </div>
      </DashboardPanel>
    </section>
  );
}

function ListingsDashboardSectionLoading({
  error,
}: {
  readonly error: string | null;
}) {
  return (
    <section className="desktop-dashboard-section">
      {error ? <DashboardLoadingNotice text={`Failed to load: ${error}`} /> : null}
      <div className="desktop-admin-stat-grid">
        {[
          'Total Listings',
          'Created 24h',
          'Created 7d',
          'Unreviewed',
          'Dismissed',
          'Lead Conversion',
        ].map(title => (
          <DashboardStatCardLoading key={title} title={title} />
        ))}
      </div>

      <div className="desktop-dashboard-scraper-grid">
        <DashboardPanel
          description="Latest 15 ingested listings."
          title="Recent Listings"
        >
          <DashboardTableLoading />
        </DashboardPanel>

        <DashboardPanel
          description="Total listings by source provider."
          title="Provider Breakdown"
        >
          <DashboardLoadingLines count={5} />
        </DashboardPanel>
      </div>
    </section>
  );
}

function ListingsDashboardSection({
  analytics,
}: {
  readonly analytics: DesktopListingsAnalytics;
}) {
  return (
    <section className="desktop-dashboard-section">
      <div className="desktop-admin-stat-grid">
        {[
          {
            title: 'Total Listings',
            value: analytics.totals.totalListings.toLocaleString(),
          },
          {
            title: 'Created 24h',
            value: analytics.totals.created24h.toLocaleString(),
          },
          {
            title: 'Created 7d',
            value: analytics.totals.created7d.toLocaleString(),
          },
          {
            title: 'Unreviewed',
            value: analytics.totals.unreviewedListings.toLocaleString(),
          },
          {
            title: 'Dismissed',
            value: analytics.totals.dismissedListings.toLocaleString(),
          },
          {
            helper: `${analytics.totals.leadsConverted.toLocaleString()} moved to leads`,
            title: 'Lead Conversion',
            value: `${analytics.totals.conversionRate}%`,
          },
        ].map(card => (
          <DashboardStatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="desktop-dashboard-scraper-grid">
        <DashboardPanel
          description="Latest 15 ingested listings."
          title="Recent Listings"
        >
          {analytics.recentListings.length === 0 ? (
            <p className="desktop-dashboard-empty">No listings ingested yet.</p>
          ) : (
            <div className="desktop-dashboard-table">
              <div className="desktop-dashboard-table-head">
                <span>Title / Company</span>
                <span>Provider</span>
                <span>Date</span>
              </div>
              {analytics.recentListings.map(listing => (
                <div className="desktop-dashboard-table-row" key={listing.id}>
                  <div className="min-w-0">
                    <p>{listing.title}</p>
                    <span>{listing.company ?? '-'}</span>
                  </div>
                  <strong>{formatProvider(listing.provider)}</strong>
                  <time>{formatMonthDay(listing.createdAt)}</time>
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>

        <DashboardPanel
          description="Total listings by source provider."
          title="Provider Breakdown"
        >
          {analytics.providerBreakdown.length === 0 ? (
            <p className="desktop-dashboard-empty">No provider data yet.</p>
          ) : (
            <div className="desktop-dashboard-provider-list">
              {analytics.providerBreakdown.map(row => (
                <div
                  className="desktop-dashboard-provider-row"
                  key={row.provider}
                >
                  <div>
                    <span>{formatProvider(row.provider)}</span>
                    <strong>{row.count.toLocaleString()}</strong>
                  </div>
                  <ProgressLine value={row.percentage} />
                </div>
              ))}
            </div>
          )}
        </DashboardPanel>
      </div>
    </section>
  );
}

function WebAdminDashboardSection({
  authStatus,
  stats,
}: {
  readonly authStatus: DesktopAuthState['status'];
  readonly stats: DesktopDashboardStats;
}) {
  const jobsBudgetPercent = percent(
    stats.budget.jobsUsed,
    stats.budget.jobsLimit,
  );
  const requestsBudgetPercent = percent(
    stats.budget.requestsUsed,
    stats.budget.requestsLimit,
  );

  return (
    <section className="desktop-dashboard-section">
      <DashboardPanel
        description="End-to-end pipeline from ingestion to offers."
        title="Platform Funnel"
      >
        <div className="desktop-dashboard-funnel">
          <FunnelStage
            count={stats.funnel.totalListings}
            icon={Database}
            label="Listings"
          />
          <ChevronRight aria-hidden="true" />
          <FunnelStage
            count={stats.funnel.totalLeads}
            icon={Target}
            label="Leads"
            rate={stats.funnel.listingToLeadRate}
          />
          <ChevronRight aria-hidden="true" />
          <FunnelStage
            count={stats.funnel.totalApplications}
            icon={Briefcase}
            label="Applications"
            rate={stats.funnel.leadToAppRate}
          />
          <ChevronRight aria-hidden="true" />
          <FunnelStage
            count={stats.funnel.interviewCount}
            icon={Activity}
            label="Interviews"
            rate={stats.funnel.appToInterviewRate}
          />
          <ChevronRight aria-hidden="true" />
          <FunnelStage
            count={stats.funnel.offerCount}
            icon={Zap}
            label="Offers"
            rate={stats.funnel.interviewToOfferRate}
          />
        </div>
      </DashboardPanel>

      <div className="desktop-dashboard-widget-grid desktop-dashboard-widget-grid--two">
        <DashboardPanel
          description="Platform activity in the last 24 hours."
          title="24h Activity"
        >
          <div className="desktop-dashboard-mini-grid desktop-dashboard-mini-grid--five">
            <MiniStat label="Listings" value={stats.activity24h.listings} />
            <MiniStat label="Leads" value={stats.activity24h.leads} />
            <MiniStat
              label="Applications"
              value={stats.activity24h.applications}
            />
            <MiniStat label="Resumes" value={stats.activity24h.resumes} />
            <MiniStat
              label="Notifications"
              value={stats.activity24h.notifications}
            />
          </div>
          <div className="desktop-dashboard-provider-daily">
            {Object.entries(stats.providerDaily).length === 0 ? (
              <span>No provider activity in the last 24h.</span>
            ) : (
              Object.entries(stats.providerDaily).map(([provider, count]) => (
                <span key={provider}>
                  {formatProvider(provider)}
                  <strong>{count.toLocaleString()}</strong>
                </span>
              ))
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel
          description="Weekly volume across pipeline stages."
          title="7-Day Trends"
        >
          <TrendRow
            label="Listings ingested"
            total={stats.funnel.totalListings}
            value={stats.trends.listings7d}
          />
          <TrendRow
            label="Leads created"
            total={stats.funnel.totalLeads}
            value={stats.trends.leads7d}
          />
          <TrendRow
            label="Applications submitted"
            total={stats.funnel.totalApplications}
            value={stats.trends.applications7d}
          />
          <p className="desktop-dashboard-footnote">
            30-day listings: {stats.trends.listings30d.toLocaleString()}
          </p>
        </DashboardPanel>
      </div>

      <div className="desktop-dashboard-widget-grid desktop-dashboard-widget-grid--three">
        <DashboardPanel title="Resume Health" icon={FileText}>
          <div className="desktop-dashboard-mini-grid">
            <MiniStat
              label="Total Resumes"
              value={stats.resumeHealth.totalResumes}
            />
            <MiniStat
              label="Avg Score"
              value={
                stats.resumeHealth.avgScore > 0
                  ? `${stats.resumeHealth.avgScore}/100`
                  : 'N/A'
              }
            />
            <MiniStat
              label="Analyses Done"
              value={stats.resumeHealth.analysesCompleted}
            />
            <MiniStat
              label="Optimizations"
              value={stats.resumeHealth.optimizationsCompleted}
            />
          </div>
          {stats.resumeHealth.analysesFailed > 0 ? (
            <StatusNotice
              tone="danger"
              text={`${stats.resumeHealth.analysesFailed.toLocaleString()} failed analyses`}
            />
          ) : null}
        </DashboardPanel>

        <DashboardPanel title="Applications" icon={Briefcase}>
          <div className="desktop-dashboard-mini-grid">
            <MiniStat label="Submitted" value={stats.applications.submitted} />
            <MiniStat label="Pending" value={stats.applications.pending} />
            <MiniStat label="Automated" value={stats.applications.automated} />
            <MiniStat label="Manual" value={stats.applications.manualCount} />
          </div>
          {stats.applications.failed > 0 ? (
            <StatusNotice
              tone="warning"
              text={`${stats.applications.failed.toLocaleString()} in failure bucket`}
            />
          ) : null}
        </DashboardPanel>

        <DashboardPanel title="Users & Platform" icon={Users}>
          <div className="desktop-dashboard-mini-grid">
            <MiniStat label="Total Users" value={stats.users.total} />
            <MiniStat label="New (7d)" value={stats.users.new7d} />
            <MiniStat
              label="Active Sessions"
              value={stats.users.activeSessions}
            />
            <MiniStat
              label="Paid Subs"
              value={stats.users.activeSubscriptions}
            />
          </div>
          <p className="desktop-dashboard-auth-note">
            Desktop auth: {authStatus}
          </p>
        </DashboardPanel>
      </div>

      <div className="desktop-dashboard-widget-grid desktop-dashboard-widget-grid--two">
        <DashboardPanel title="Last 5 Users" icon={Users}>
          <div className="desktop-dashboard-user-list">
            {stats.users.latest.length === 0 ? (
              <p className="desktop-dashboard-empty">No users yet.</p>
            ) : (
              stats.users.latest.map(user => (
                <div className="desktop-dashboard-user-row" key={user.id}>
                  <div>
                    <p>{user.name || user.email}</p>
                    <span>{user.email}</span>
                  </div>
                  <time>{formatMonthDay(user.createdAt)}</time>
                </div>
              ))
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Automation & Ops" icon={Zap}>
          <div className="desktop-dashboard-mini-grid desktop-dashboard-mini-grid--three">
            <MiniStat
              label="Scheduled Queue"
              value={stats.automation.scheduledApps}
            />
            <MiniStat
              label="Audit Logs (24h)"
              value={stats.automation.auditLogs24h}
            />
            <MiniStat
              label="Lead Pipeline"
              value={stats.pipeline.leadsActive}
            />
          </div>
          <div className="desktop-dashboard-mini-grid desktop-dashboard-mini-grid--two">
            <MiniStat
              label="Leads Applied"
              value={stats.pipeline.leadsApplied}
            />
            <MiniStat
              label="Leads Dismissed"
              value={stats.pipeline.leadsDismissed}
            />
          </div>
        </DashboardPanel>
      </div>

      <DashboardPanel
        description={`${new Date(stats.budget.cycleStart).toLocaleDateString()} - ${new Date(stats.budget.cycleEnd).toLocaleDateString()}`}
        title="Fantastic Budget"
      >
        <div className="desktop-dashboard-budget-grid">
          <BudgetRow
            label="Jobs"
            limit={stats.budget.jobsLimit}
            percent={jobsBudgetPercent}
            used={stats.budget.jobsUsed}
          />
          <BudgetRow
            label="Requests"
            limit={stats.budget.requestsLimit}
            percent={requestsBudgetPercent}
            used={stats.budget.requestsUsed}
          />
          <MiniStat
            label="Projected Jobs"
            value={stats.budget.projectedJobsUsed}
          />
          <MiniStat
            label="Projected Requests"
            value={stats.budget.projectedRequestsUsed}
          />
        </div>
      </DashboardPanel>
    </section>
  );
}

function DashboardPanel({
  children,
  description,
  icon: Icon,
  title,
}: {
  readonly children: ReactNode;
  readonly description?: string;
  readonly icon?: typeof Database;
  readonly title: string;
}) {
  return (
    <article className="desktop-admin-card desktop-dashboard-panel">
      <div className="desktop-dashboard-panel-header">
        <div>
          <h2>
            {Icon ? <Icon aria-hidden="true" /> : null}
            {title}
          </h2>
          {description ? <p>{description}</p> : null}
        </div>
      </div>
      {children}
    </article>
  );
}

function DashboardLoadingNotice({ text }: { readonly text: string }) {
  return (
    <div className="desktop-dashboard-loading-notice">
      <span>{text}</span>
    </div>
  );
}

function DashboardFunnelLoading() {
  return (
    <div className="desktop-dashboard-funnel">
      {['Listings', 'Leads', 'Applications', 'Interviews', 'Offers'].map(
        (label, index) => (
          <Fragment key={label}>
            {index > 0 ? <ChevronRight aria-hidden="true" /> : null}
            <div
              className="desktop-dashboard-funnel-stage desktop-dashboard-skeleton-tile"
            >
              <DashboardSkeletonLine width="62%" />
              <span>{label}</span>
              <DashboardSkeletonLine width="44%" />
            </div>
          </Fragment>
        ),
      )}
    </div>
  );
}

function DashboardMiniGridLoading({
  count,
  variant,
}: {
  readonly count: number;
  readonly variant?: 'two' | 'three' | 'five';
}) {
  const className = [
    'desktop-dashboard-mini-grid',
    variant ? `desktop-dashboard-mini-grid--${variant}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={className}>
      {Array.from({ length: count }, (_, index) => (
        <DashboardLoadingTile key={index} />
      ))}
    </div>
  );
}

function DashboardLoadingTile() {
  return (
    <div className="desktop-dashboard-mini-stat desktop-dashboard-skeleton-tile">
      <DashboardSkeletonLine width="48%" />
      <DashboardSkeletonLine width="68%" />
    </div>
  );
}

function DashboardBudgetLoading() {
  return (
    <div className="desktop-dashboard-budget-row desktop-dashboard-skeleton-tile">
      <div>
        <DashboardSkeletonLine width="40%" />
        <DashboardSkeletonLine width="58%" />
      </div>
      <DashboardSkeletonLine width="100%" />
    </div>
  );
}

function DashboardStatCardLoading({ title }: { readonly title: string }) {
  return (
    <article className="desktop-admin-card desktop-dashboard-stat-card desktop-dashboard-skeleton-tile">
      <span>{title}</span>
      <DashboardSkeletonLine width="58%" />
      <DashboardSkeletonLine width="42%" />
    </article>
  );
}

function DashboardTableLoading() {
  return (
    <div className="desktop-dashboard-table desktop-dashboard-table--loading">
      <div className="desktop-dashboard-table-head">
        <span>Title / Company</span>
        <span>Provider</span>
        <span>Date</span>
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <div className="desktop-dashboard-table-row" key={index}>
          <DashboardSkeletonLine width="72%" />
          <DashboardSkeletonLine width="54px" />
          <DashboardSkeletonLine width="44px" />
        </div>
      ))}
    </div>
  );
}

function DashboardLoadingLines({ count }: { readonly count: number }) {
  return (
    <div className="desktop-dashboard-loading-lines">
      {Array.from({ length: count }, (_, index) => (
        <DashboardSkeletonLine
          key={index}
          width={index % 2 === 0 ? '78%' : '52%'}
        />
      ))}
    </div>
  );
}

function DashboardSkeletonLine({ width }: { readonly width: string }) {
  return (
    <span
      aria-hidden="true"
      className="desktop-dashboard-skeleton-line"
      style={{ width }}
    />
  );
}

function DashboardStatCard({
  helper,
  title,
  value,
}: {
  readonly helper?: string;
  readonly title: string;
  readonly value: string;
}) {
  return (
    <article className="desktop-admin-card desktop-dashboard-stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
      {helper ? <p>{helper}</p> : null}
    </article>
  );
}

function FunnelStage({
  count,
  icon: Icon,
  label,
  rate,
}: {
  readonly count: number;
  readonly icon: typeof Database;
  readonly label: string;
  readonly rate?: number;
}) {
  return (
    <div className="desktop-dashboard-funnel-stage">
      <div>
        <Icon aria-hidden="true" />
        <strong>{count.toLocaleString()}</strong>
      </div>
      <span>{label}</span>
      {rate === undefined ? null : <em>{rate}% conv</em>}
    </div>
  );
}

function MiniStat({
  label,
  value,
}: {
  readonly label: string;
  readonly value: number | string;
}) {
  return (
    <div className="desktop-dashboard-mini-stat">
      <span>{label}</span>
      <strong>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </strong>
    </div>
  );
}

function StatusNotice({
  text,
  tone,
}: {
  readonly text: string;
  readonly tone: 'danger' | 'warning';
}) {
  return (
    <div
      className={`desktop-dashboard-status-notice desktop-dashboard-status-notice--${tone}`}
    >
      <span>{text}</span>
    </div>
  );
}

function TrendRow({
  label,
  total,
  value,
}: {
  readonly label: string;
  readonly total: number;
  readonly value: number;
}) {
  const rowPercent = percent(value, total);
  return (
    <div className="desktop-dashboard-trend-row">
      <div>
        <span>{label}</span>
        <strong>
          {value.toLocaleString()} <em>({rowPercent}% of total)</em>
        </strong>
      </div>
      <ProgressLine value={rowPercent} />
    </div>
  );
}

function BudgetRow({
  label,
  limit,
  percent: percentValue,
  used,
}: {
  readonly label: string;
  readonly limit: number;
  readonly percent: number;
  readonly used: number;
}) {
  return (
    <div className="desktop-dashboard-budget-row">
      <div>
        <span>{label}</span>
        <strong>
          {used.toLocaleString()} / {limit.toLocaleString()}
        </strong>
      </div>
      <ProgressLine value={percentValue} />
    </div>
  );
}

function ProgressLine({ value }: { readonly value: number }) {
  return (
    <div className="desktop-dashboard-progress" aria-hidden="true">
      <span style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

const formatProvider = (provider: string | null): string =>
  (provider ?? '?').replaceAll('_', ' ').toUpperCase();

const formatMonthDay = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });

const percent = (value: number, total: number): number =>
  total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;

const OBSERVATION_TOOLS = new Set([
  'inspect',
  'observe',
  'snapshot',
  'page_context',
  'collect_form',
  'read',
  'screenshot',
]);

const FIELD_INPUT_TOOLS = new Set(['fill', 'select', 'upload', 'check']);

function isObservationTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  if (OBSERVATION_TOOLS.has(normalized)) return true;
  return /(observe|inspect|snapshot|read|capture)/i.test(normalized);
}

function isFieldInputTool(toolName: string): boolean {
  const normalized = toolName.toLowerCase();
  if (FIELD_INPUT_TOOLS.has(normalized)) return true;
  return /(fill|select|upload|check)/i.test(normalized);
}

function readHostname(url: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function buildFieldObservation(input: {
  readonly action: string;
  readonly fieldId: string;
  readonly fieldLabel: string;
  readonly fieldType: string;
  readonly hostname: string;
  readonly priorAiValue: string | null;
  readonly value: string;
}): DesktopFieldObservation {
  const action = isSelectFieldType(input.fieldType) ? 'select' : 'fill';
  return {
    action,
    fieldId: input.fieldId,
    fieldLabel: input.fieldLabel || input.fieldId,
    fieldType: input.fieldType,
    hostname: input.hostname,
    id: `${input.hostname}|${input.fieldId}`,
    lastSeenAt: new Date().toISOString(),
    lastValue: input.value,
    occurrences: 1,
    priorAiValue: input.priorAiValue,
    selector: buildFieldSelector(input.fieldId),
  };
}

function isSelectFieldType(fieldType: string): boolean {
  const normalized = fieldType.toLowerCase();
  return (
    normalized === 'select-one' ||
    normalized === 'select-multiple' ||
    normalized === 'select' ||
    normalized === 'radio' ||
    normalized === 'checkbox'
  );
}

function buildFieldSelector(fieldId: string): string {
  const trimmed = fieldId.trim();
  if (!trimmed) return '';
  if (/^[A-Za-z][\w-]*$/.test(trimmed)) {
    return `[name="${trimmed}"], #${trimmed}`;
  }
  return `[name="${trimmed.replace(/"/g, '\\"')}"]`;
}

function mergeFieldObservations(
  existing: readonly DesktopFieldObservation[],
  incoming: readonly DesktopFieldObservation[],
): DesktopFieldObservation[] {
  const byId = new Map<string, DesktopFieldObservation>();
  for (const obs of existing) byId.set(obs.id, obs);
  for (const obs of incoming) {
    const prior = byId.get(obs.id);
    byId.set(
      obs.id,
      prior
        ? {
            ...obs,
            occurrences: prior.occurrences + 1,
          }
        : obs,
    );
  }
  return Array.from(byId.values()).sort((a, b) =>
    b.lastSeenAt.localeCompare(a.lastSeenAt),
  );
}

function formatUserActionReport(report: DesktopUserActionReport): string {
  const lines: string[] = [];
  lines.push(`URL: ${report.url}`);
  lines.push(`Captured: ${report.capturedAt}`);
  lines.push(`Trigger: ${report.trigger}`);
  if (report.unchangedFields.length > 0) {
    lines.push('', `AI got these right (${report.unchangedFields.length}):`);
    for (const field of report.unchangedFields) {
      lines.push(`  ✓ ${field.label || field.id} = ${field.value}`);
    }
  }
  if (report.userChangedFields.length > 0) {
    lines.push('', `You corrected (${report.userChangedFields.length}):`);
    for (const change of report.userChangedFields) {
      lines.push(
        `  ✎ ${change.label || change.id}: "${change.aiValue}" → "${change.userValue}"`,
      );
    }
  }
  if (report.userFilledFields.length > 0) {
    lines.push('', `AI missed (${report.userFilledFields.length}):`);
    for (const field of report.userFilledFields) {
      lines.push(`  + ${field.label || field.id} = ${field.value}`);
    }
  }
  if (report.emptyFields.length > 0) {
    lines.push('', `Still empty (${report.emptyFields.length}):`);
    for (const field of report.emptyFields) {
      lines.push(`  · ${field.label || field.id}`);
    }
  }
  return lines.join('\n');
}
