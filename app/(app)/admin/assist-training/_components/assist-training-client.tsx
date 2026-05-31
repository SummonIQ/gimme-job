'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useEvent } from '@/hooks/use-event';
import { useToast } from '@/hooks/use-toast';
import { useUserChannel } from '@/hooks/use-user-channel';
import type { AssistTrainingProgressPayload } from '@/types/events';
import { DataEventType } from '@/types/events';
import {
  Activity,
  CheckCircle2,
  CircleHelp,
  Copy,
  Eye,
  Globe,
  Loader2,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

interface TrainingSession {
  id: string;
  status: string;
  targetUrl: string;
  hostname: string;
  atsSystemName: string | null;
  totalSteps: number;
  completedSteps: number;
  progress: number;
  observationsCreated: number;
  rulesPromoted: number;
  error: string | null;
  stepLogs: Record<string, unknown>[];
  startedAt: string;
  completedAt: string | null;
}

interface HostnameInsight {
  completedSessionCount: number;
  enabledRuleCount: number;
  failedSessionCount: number;
  flowCompiledFromRuleCount: number | null;
  flowConfidence: number | null;
  healthReason: string | null;
  healthStatus: 'at-risk' | 'building' | 'healthy' | 'stale';
  flowStatus: string | null;
  flowStepCount: number;
  flowVersion: number | null;
  hostname: string;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  reviewReady: boolean;
  reviewReason: string | null;
  reviewStatus: string | null;
  retrainingNeeded: boolean;
  retrainingPriority: 'high' | 'low' | 'medium' | null;
  retrainingReason: string | null;
  totalSessionCount: number;
  trustEligibility: string | null;
  trustReason: string | null;
}

interface TrainingStats {
  total: number;
  completed: number;
  failed: number;
  running: number;
  observations: number;
  rulesPromoted: number;
}

interface AssistTrainingClientProps {
  initialHostnameInsights: Record<string, HostnameInsight>;
  initialSessions: TrainingSession[];
  initialStats: TrainingStats;
}

interface RandomJobSummary {
  company: string | null;
  id: string;
  jobProvider?: string | null;
  jobProviderUrl: string | null;
  source?: string | null;
  title: string;
}

interface RandomJobDetail {
  applyOptions?: unknown;
  atsSystemName?: string | null;
  company?: string | null;
  jobProviderUrl?: string | null;
  title?: string | null;
}

interface RandomJobMeta {
  atsSystemName: string | null;
  provider: string | null;
  title: string | null;
}

function TrainingFieldHelp({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-muted-foreground/70 transition-colors hover:text-foreground"
          aria-label={text}
        >
          <CircleHelp className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-64 leading-5" side="top">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

function isGoogleUrl(link: string): boolean {
  try {
    const hostname = new URL(link).hostname;
    return (
      hostname === 'google.com' ||
      hostname.endsWith('.google.com') ||
      hostname.endsWith('.googleapis.com')
    );
  } catch {
    return false;
  }
}

function extractApplyOptionUrls(applyOptions: unknown): string[] {
  if (!applyOptions) {
    return [];
  }

  if (Array.isArray(applyOptions)) {
    return applyOptions
      .map(option => {
        if (!option || typeof option !== 'object') {
          return null;
        }

        const candidate = option as Record<string, unknown>;
        const link =
          typeof candidate.link === 'string'
            ? candidate.link
            : typeof candidate.url === 'string'
              ? candidate.url
              : typeof candidate.applyUrl === 'string'
                ? candidate.applyUrl
                : null;

        return link?.trim() || null;
      })
      .filter((link): link is string => Boolean(link));
  }

  if (typeof applyOptions === 'object') {
    const candidate = applyOptions as Record<string, unknown>;
    const link =
      typeof candidate.applyUrl === 'string'
        ? candidate.applyUrl
        : typeof candidate.link === 'string'
          ? candidate.link
          : typeof candidate.url === 'string'
            ? candidate.url
            : null;

    return link?.trim() ? [link.trim()] : [];
  }

  return [];
}

function getBestTrainingUrl(detail: RandomJobDetail): string | null {
  const applyOptionUrls = extractApplyOptionUrls(detail.applyOptions);
  const nonGoogleApplyUrl = applyOptionUrls.find(link => !isGoogleUrl(link));
  if (nonGoogleApplyUrl) {
    return nonGoogleApplyUrl;
  }

  return null;
}

function detectAtsNameFromUrl(url: string): string | null {
  const normalizedUrl = url.toLowerCase();

  const commonPatterns: Array<{ name: string; pattern: string }> = [
    { pattern: 'boards.greenhouse.io', name: 'Greenhouse' },
    { pattern: 'greenhouse.io', name: 'Greenhouse' },
    { pattern: 'jobs.lever.co', name: 'Lever' },
    { pattern: 'lever.co', name: 'Lever' },
    { pattern: 'myworkdayjobs.com', name: 'Workday' },
    { pattern: 'workday.com', name: 'Workday' },
    { pattern: 'icims.com', name: 'iCIMS' },
    { pattern: 'smartrecruiters.com', name: 'SmartRecruiters' },
    { pattern: 'bamboohr.com', name: 'BambooHR' },
    { pattern: 'workable.com', name: 'Workable' },
    { pattern: 'ashbyhq.com', name: 'Ashby' },
    { pattern: 'pinpointhq.com', name: 'Pinpoint' },
    { pattern: 'jazz.co', name: 'JazzHR' },
    { pattern: 'applytojob.com', name: 'JazzHR' },
    { pattern: 'taleo.net', name: 'Taleo' },
  ];

  const match = commonPatterns.find(({ pattern }) => normalizedUrl.includes(pattern));
  return match?.name ?? null;
}

function normalizeLoadedJobMetaLabel(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

function formatProviderLabel(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed.toLowerCase().replace(/[_-]+/g, ' ');
  const specialCases: Record<string, string> = {
    coresignal: 'CoreSignal',
    fantasticjobs: 'FantasticJobs',
    serpapi: 'SerpAPI',
    usajobs: 'USAJobs',
  };

  if (specialCases[normalized.replace(/\s+/g, '')]) {
    return specialCases[normalized.replace(/\s+/g, '')];
  }

  return normalized.replace(/\b\w/g, letter => letter.toUpperCase());
}

export function AssistTrainingClient({
  initialHostnameInsights,
  initialSessions,
  initialStats,
}: AssistTrainingClientProps) {
  const router = useRouter();
  const [hostnameInsights, setHostnameInsights] = useState<
    Record<string, HostnameInsight>
  >(initialHostnameInsights);
  const [sessions, setSessions] = useState<TrainingSession[]>(initialSessions);
  const [isStarting, setIsStarting] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [dryRun, setDryRun] = useState(false);
  const [maxSteps, setMaxSteps] = useState(15);
  const [maxDurationMin, setMaxDurationMin] = useState(5);
  const [captureScreenshots, setCaptureScreenshots] = useState(true);
  const [disableJavascript, setDisableJavascript] = useState(false);
  const [mobileViewport, setMobileViewport] = useState(false);
  const [hostnameQuery, setHostnameQuery] = useState('');
  const { toast } = useToast();
  const userChannel = useUserChannel();
  const [retryingIds, setRetryingIds] = useState<Set<string>>(new Set());
  const [reviewingHostnames, setReviewingHostnames] = useState<Set<string>>(
    new Set(),
  );
  const [isBatchReviewing, setIsBatchReviewing] = useState(false);
  const [sessionSort, setSessionSort] = useState<
    'latest' | 'most-observations' | 'problem-first'
  >('problem-first');
  const [sessionStatusFilter, setSessionStatusFilter] = useState<
    'active' | 'all' | 'completed' | 'failed'
  >('all');
  // ATS breakdown card filter — clicking a card narrows every list on the
  // page to sessions from that ATS (or its overflow group). `null` means
  // show all. `__other__` means "anything that rolled into the Other card".
  const [atsCardFilter, setAtsCardFilter] = useState<string | null>(null);
  const [atsOtherMembers, setAtsOtherMembers] = useState<string[]>([]);
  // Live-stats card drawer — clicking a stat card opens a side panel
  // listing the sessions that contribute to that metric.
  const [statDrawerKey, setStatDrawerKey] = useState<
    | 'total'
    | 'completed'
    | 'running'
    | 'failed'
    | 'success-rate'
    | 'avg-steps'
    | 'observations'
    | 'rules-promoted'
    | null
  >(null);
  // On-demand data for observations/rules drawers
  const [drawerObservations, setDrawerObservations] = useState<
    Array<{
      id: string;
      hostname: string;
      fieldLabel: string | null;
      fieldDisplayName: string | null;
      fieldName: string | null;
      ariaLabel: string | null;
      actionType: string;
      stableSelector: string | null;
      observationCount: number;
      success: boolean;
    }>
  >([]);
  const [drawerRules, setDrawerRules] = useState<
    Array<{
      id: string;
      hostname: string;
      fieldLabel: string | null;
      fieldName: string | null;
      actionType: string;
      stableSelector: string;
      stepIndex: number;
      observationCount: number;
      confidence: number;
      enabled: boolean;
    }>
  >([]);
  const [drawerItemsLoading, setDrawerItemsLoading] = useState(false);

  useEffect(() => {
    if (statDrawerKey === 'observations') {
      setDrawerItemsLoading(true);
      fetch('/api/admin/observations?limit=200')
        .then(r => r.json())
        .then(data => setDrawerObservations(data.observations ?? []))
        .catch(() => setDrawerObservations([]))
        .finally(() => setDrawerItemsLoading(false));
    } else if (statDrawerKey === 'rules-promoted') {
      setDrawerItemsLoading(true);
      fetch('/api/admin/rules?limit=200')
        .then(r => r.json())
        .then(data => setDrawerRules(data.rules ?? []))
        .catch(() => setDrawerRules([]))
        .finally(() => setDrawerItemsLoading(false));
    }
  }, [statDrawerKey]);
  const [trainingFocus, setTrainingFocus] = useState<
    | 'all'
    | 'approved'
    | 'at-risk'
    | 'auto-ready'
    | 'needs-more'
    | 'retraining'
    | 'review'
  >('all');
  const [trainingHostnames, setTrainingHostnames] = useState<Set<string>>(
    new Set(),
  );
  const [isBatchTraining, setIsBatchTraining] = useState(false);
  const [loadingRandomJob, setLoadingRandomJob] = useState(false);
  const [randomJobMeta, setRandomJobMeta] = useState<RandomJobMeta | null>(null);

  // Live stats derived from sessions — updates in realtime via Pusher
  const stats = useMemo(() => {
    const completed = sessions.filter(s => s.status === 'completed').length;
    const failed = sessions.filter(s => s.status === 'failed').length;
    const running = sessions.filter(
      s => s.status === 'running' || s.status === 'pending',
    ).length;
    const obs = sessions.reduce((sum, s) => sum + s.observationsCreated, 0);
    const rules = sessions.reduce((sum, s) => sum + s.rulesPromoted, 0);
    const avgSteps =
      completed > 0
        ? (
            sessions
              .filter(s => s.status === 'completed')
              .reduce((sum, s) => sum + s.completedSteps, 0) / completed
          ).toFixed(1)
        : '—';
    const successRate =
      sessions.length > 0 ? Math.round((completed / sessions.length) * 100) : 0;
    return {
      total: Math.max(initialStats.total, sessions.length),
      completed: Math.max(initialStats.completed, completed),
      failed: Math.max(initialStats.failed, failed),
      running,
      observations: Math.max(initialStats.observations, obs),
      rulesPromoted: Math.max(initialStats.rulesPromoted, rules),
      avgSteps,
      successRate,
    };
  }, [sessions, initialStats]);

  const trainingImpact = useMemo(() => {
    const insights = Object.values(hostnameInsights) as HostnameInsight[];

    return {
      approved: insights.filter(insight => insight.reviewStatus === 'approved')
        .length,
      approvedForAutomation: insights.filter(
        insight =>
          insight.reviewStatus === 'approved' &&
          insight.trustEligibility === 'AUTO_STEP_GUARDED',
      ).length,
      atRisk: insights.filter(insight => insight.healthStatus === 'at-risk')
        .length,
      hostnamesLearned: insights.filter(
        insight => insight.flowVersion !== null || insight.totalSessionCount > 0,
      ).length,
      needsMoreTraining: insights.filter(
        insight => insight.reviewStatus === 'needs-more-training',
      ).length,
      onHold: insights.filter(insight => insight.reviewStatus === 'hold').length,
      readyForReview: insights.filter(
        insight => insight.reviewReady && insight.reviewStatus !== 'approved',
      ).length,
      stale: insights.filter(insight => insight.healthStatus === 'stale').length,
      totalEnabledRules: insights.reduce(
        (sum, insight) => sum + insight.enabledRuleCount,
        0,
      ),
      waitingForApproval: insights.filter(
        insight => insight.reviewStatus === null && insight.reviewReady,
      ).length,
      waitingForConfirmation: insights.filter(
        insight =>
          insight.reviewStatus !== 'approved' &&
          insight.trustEligibility === 'ACTION_WITH_CONFIRMATION',
      ).length,
      retrainingNeeded: insights.filter(insight => insight.retrainingNeeded)
        .length,
    };
  }, [hostnameInsights]);

  const trainingSummaryCards = useMemo(
    () => [
      {
        description: 'Hostnames the system has already learned from.',
        title: 'Learned Hostnames',
        value: trainingImpact.hostnamesLearned,
      },
      {
        description: 'Ready for you to approve, hold, or send back.',
        title: 'Waiting for Review',
        value: trainingImpact.readyForReview,
      },
      {
        description: 'Approved hostnames that can keep improving.',
        title: 'Approved',
        value: trainingImpact.approved,
      },
      {
        description: 'Approved hostnames cleared for guarded auto-step.',
        title: 'Approved for Auto-Step',
        value: trainingImpact.approvedForAutomation,
      },
      {
        description: 'Hostnames that still need more training runs.',
        title: 'Needs More Training',
        value: trainingImpact.needsMoreTraining,
      },
      {
        description: 'Reusable rules the system has learned so far.',
        title: 'Learned Rules',
        value: trainingImpact.totalEnabledRules,
      },
    ],
    [trainingImpact],
  );

  const normalizedHostnameQuery = hostnameQuery.trim().toLowerCase();

  const matchesTrainingFocus = useCallback(
    (hostname: string): boolean => {
      const insight = hostnameInsights[hostname];

      if (
        normalizedHostnameQuery &&
        !hostname.toLowerCase().includes(normalizedHostnameQuery)
      ) {
        return false;
      }

      if (!insight) {
        return trainingFocus === 'all';
      }

      switch (trainingFocus) {
        case 'approved':
          return insight.reviewStatus === 'approved';
        case 'at-risk':
          return insight.healthStatus === 'at-risk';
        case 'auto-ready':
          return (
            insight.reviewStatus === 'approved' &&
            insight.trustEligibility === 'AUTO_STEP_GUARDED'
          );
        case 'needs-more':
          return insight.reviewStatus === 'needs-more-training';
        case 'retraining':
          return insight.retrainingNeeded;
        case 'review':
          return (
            insight.reviewStatus !== 'approved' &&
            (insight.reviewReady || Boolean(insight.reviewStatus))
          );
        default:
          return true;
      }
    },
    [hostnameInsights, normalizedHostnameQuery, trainingFocus],
  );

  const hostnameTrainingQueue = useMemo(() => {
    const groups = new Map<
      string,
      {
        failedSessions: number;
        hostname: string;
        latestStartedAt: string;
        latestSessionId: string;
        recentUrls: string[];
        runningSessions: number;
        successfulSessions: number;
        totalSessions: number;
      }
    >();

    for (const session of sessions) {
      const existing = groups.get(session.hostname) ?? {
        failedSessions: 0,
        hostname: session.hostname,
        latestStartedAt: session.startedAt,
        latestSessionId: session.id,
        recentUrls: [],
        runningSessions: 0,
        successfulSessions: 0,
        totalSessions: 0,
      };

      existing.totalSessions += 1;
      if (session.status === 'failed') {
        existing.failedSessions += 1;
      }
      if (session.status === 'completed') {
        existing.successfulSessions += 1;
      }
      if (session.status === 'running' || session.status === 'pending') {
        existing.runningSessions += 1;
      }
      if (
        !existing.recentUrls.includes(session.targetUrl) &&
        existing.recentUrls.length < 3
      ) {
        existing.recentUrls.push(session.targetUrl);
      }
      if (
        new Date(session.startedAt).getTime() >
        new Date(existing.latestStartedAt).getTime()
      ) {
        existing.latestStartedAt = session.startedAt;
        existing.latestSessionId = session.id;
      }

      groups.set(session.hostname, existing);
    }

    return Array.from(groups.values()).sort((left, right) => {
      const leftInsight = hostnameInsights[left.hostname];
      const rightInsight = hostnameInsights[right.hostname];
      const leftRetrainingPriority =
        leftInsight?.retrainingPriority === 'high'
          ? 150
          : leftInsight?.retrainingPriority === 'medium'
            ? 90
            : leftInsight?.retrainingPriority === 'low'
              ? 35
              : 0;
      const rightRetrainingPriority =
        rightInsight?.retrainingPriority === 'high'
          ? 150
          : rightInsight?.retrainingPriority === 'medium'
            ? 90
            : rightInsight?.retrainingPriority === 'low'
              ? 35
              : 0;
      const leftPriority =
        leftRetrainingPriority +
        (leftInsight?.reviewStatus === 'needs-more-training' ? 100 : 0) +
        (leftInsight?.reviewStatus === 'hold' ? 25 : 0) +
        (leftInsight?.reviewReady ? 10 : 0) +
        left.failedSessions;
      const rightPriority =
        rightRetrainingPriority +
        (rightInsight?.reviewStatus === 'needs-more-training' ? 100 : 0) +
        (rightInsight?.reviewStatus === 'hold' ? 25 : 0) +
        (rightInsight?.reviewReady ? 10 : 0) +
        right.failedSessions;

      if (leftPriority !== rightPriority) {
        return rightPriority - leftPriority;
      }

      return (
        new Date(right.latestStartedAt).getTime() -
        new Date(left.latestStartedAt).getTime()
      );
    });
  }, [hostnameInsights, sessions]);

  const hostnameReviewQueue = useMemo(
    () =>
      hostnameTrainingQueue.filter(hostnameGroup => {
        const insight = hostnameInsights[hostnameGroup.hostname];
        return Boolean(
          insight &&
            insight.reviewStatus !== 'approved' &&
            (insight.reviewReady || insight.reviewStatus),
        );
      }).sort((left, right) => {
        const leftInsight = hostnameInsights[left.hostname];
        const rightInsight = hostnameInsights[right.hostname];
        const leftPriority =
          (leftInsight?.reviewReady ? 100 : 0) +
          (leftInsight?.reviewStatus === 'needs-more-training'
            ? 75
            : leftInsight?.reviewStatus === 'hold'
              ? 25
              : 0) +
          (leftInsight?.completedSessionCount ?? 0);
        const rightPriority =
          (rightInsight?.reviewReady ? 100 : 0) +
          (rightInsight?.reviewStatus === 'needs-more-training'
            ? 75
            : rightInsight?.reviewStatus === 'hold'
              ? 25
              : 0) +
          (rightInsight?.completedSessionCount ?? 0);

        return rightPriority - leftPriority;
      }),
    [hostnameInsights, hostnameTrainingQueue],
  );

  const approvedHostnameQueue = useMemo(
    () =>
      hostnameTrainingQueue.filter(hostnameGroup => {
        const insight = hostnameInsights[hostnameGroup.hostname];
        return insight?.reviewStatus === 'approved';
      }),
    [hostnameInsights, hostnameTrainingQueue],
  );

  const retrainingHostnameQueue = useMemo(
    () =>
      hostnameTrainingQueue.filter(hostnameGroup => {
        const insight = hostnameInsights[hostnameGroup.hostname];
        return insight?.retrainingNeeded;
      }),
    [hostnameInsights, hostnameTrainingQueue],
  );

  const trainingFocusCounts = useMemo(
    () => ({
      all: hostnameTrainingQueue.length,
      approved: approvedHostnameQueue.length,
      'at-risk': hostnameTrainingQueue.filter(hostnameGroup => {
        const insight = hostnameInsights[hostnameGroup.hostname];
        return insight?.healthStatus === 'at-risk';
      }).length,
      'auto-ready': hostnameTrainingQueue.filter(hostnameGroup => {
        const insight = hostnameInsights[hostnameGroup.hostname];
        return (
          insight?.reviewStatus === 'approved' &&
          insight.trustEligibility === 'AUTO_STEP_GUARDED'
        );
      }).length,
      'needs-more': hostnameTrainingQueue.filter(hostnameGroup => {
        const insight = hostnameInsights[hostnameGroup.hostname];
        return insight?.reviewStatus === 'needs-more-training';
      }).length,
      retraining: retrainingHostnameQueue.length,
      review: hostnameReviewQueue.length,
    }),
    [
      approvedHostnameQueue,
      hostnameInsights,
      hostnameReviewQueue,
      hostnameTrainingQueue,
      retrainingHostnameQueue,
    ],
  );

  const sessionStatusCounts = useMemo(
    () => ({
      active: sessions.filter(
        session =>
          matchesTrainingFocus(session.hostname) &&
          (session.status === 'running' || session.status === 'pending'),
      ).length,
      all: sessions.filter(session => matchesTrainingFocus(session.hostname))
        .length,
      completed: sessions.filter(
        session =>
          matchesTrainingFocus(session.hostname) &&
          session.status === 'completed',
      ).length,
      failed: sessions.filter(
        session =>
          matchesTrainingFocus(session.hostname) &&
          session.status === 'failed',
      ).length,
    }),
    [matchesTrainingFocus, sessions],
  );

  const filteredHostnameTrainingQueue = useMemo(
    () =>
      hostnameTrainingQueue.filter(hostnameGroup =>
        matchesTrainingFocus(hostnameGroup.hostname),
      ),
    [hostnameTrainingQueue, matchesTrainingFocus],
  );

  const filteredHostnameReviewQueue = useMemo(
    () =>
      hostnameReviewQueue.filter(hostnameGroup =>
        matchesTrainingFocus(hostnameGroup.hostname),
      ),
    [hostnameReviewQueue, matchesTrainingFocus],
  );

  const filteredRetrainingHostnameQueue = useMemo(
    () =>
      retrainingHostnameQueue.filter(hostnameGroup =>
        matchesTrainingFocus(hostnameGroup.hostname),
      ),
    [matchesTrainingFocus, retrainingHostnameQueue],
  );

  const filteredApprovedHostnameQueue = useMemo(
    () =>
      approvedHostnameQueue.filter(hostnameGroup =>
        matchesTrainingFocus(hostnameGroup.hostname),
      ),
    [approvedHostnameQueue, matchesTrainingFocus],
  );

  const filteredSessions = useMemo(
    () =>
      sessions
        .filter(session => matchesTrainingFocus(session.hostname))
        .filter(session => {
          if (!atsCardFilter) return true;
          const ats =
            session.atsSystemName ||
            detectAtsNameFromUrl(`https://${session.hostname}`) ||
            'Unknown';
          if (atsCardFilter === '__other__') {
            return atsOtherMembers.includes(ats);
          }
          return ats === atsCardFilter;
        })
        .filter(session => {
          switch (sessionStatusFilter) {
            case 'active':
              return (
                session.status === 'running' || session.status === 'pending'
              );
            case 'completed':
              return session.status === 'completed';
            case 'failed':
              return session.status === 'failed';
            default:
              return true;
          }
        })
        .sort((left, right) => {
          if (sessionSort === 'problem-first') {
            const getPriority = (session: TrainingSession): number => {
              if (session.status === 'failed') return 0;
              if (session.status === 'running') return 1;
              if (session.status === 'pending') return 2;
              return 3;
            };

            const priorityDifference = getPriority(left) - getPriority(right);
            if (priorityDifference !== 0) {
              return priorityDifference;
            }
          }

          if (sessionSort === 'most-observations') {
            return right.observationsCreated - left.observationsCreated;
          }

          return (
            new Date(right.startedAt).getTime() -
            new Date(left.startedAt).getTime()
          );
        }),
    [
      atsCardFilter,
      atsOtherMembers,
      matchesTrainingFocus,
      sessionSort,
      sessionStatusFilter,
      sessions,
    ],
  );

  const currentSessions = useMemo(
    () =>
      filteredSessions.filter(
        session =>
          session.status === 'running' || session.status === 'pending',
      ),
    [filteredSessions],
  );

  const previousSessions = useMemo(
    () =>
      filteredSessions.filter(
        session =>
          session.status !== 'running' && session.status !== 'pending',
      ),
    [filteredSessions],
  );

  const focusHostname = useCallback((hostname: string) => {
    setHostnameQuery(hostname);
    setTrainingFocus('all');
  }, []);

  const loadRandomJob = async (providerScope?: 'greenhouse') => {
    setLoadingRandomJob(true);
    setRandomJobMeta(null);
    try {
      const params = providerScope ? `?provider=${providerScope}` : '';
      const res = await fetch(`/api/assist-training/random-job${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
        throw new Error(err.error ?? `API returned ${res.status}`);
      }

      const job = (await res.json()) as Record<string, unknown>;
      const jobUrl =
        typeof job.url === 'string' && job.url.trim().length > 0
          ? job.url.trim()
          : typeof job.applicationUrl === 'string' &&
              job.applicationUrl.trim().length > 0
            ? job.applicationUrl.trim()
            : typeof job.jobProviderUrl === 'string' &&
                job.jobProviderUrl.trim().length > 0
              ? job.jobProviderUrl.trim()
              : null;

      if (!jobUrl) {
        throw new Error('Random job response did not include a valid URL.');
      }

      const title =
        typeof job.title === 'string' && job.title.trim().length > 0
          ? job.title.trim()
          : 'Untitled job';
      const company =
        typeof job.company === 'string' && job.company.trim().length > 0
          ? job.company.trim()
          : null;
      const loadedProvider =
        typeof job.jobProvider === 'string' ? job.jobProvider : null;
      const source = typeof job.source === 'string' ? job.source : null;

      setUrlInput(jobUrl);
      setRandomJobMeta({
        atsSystemName: detectAtsNameFromUrl(jobUrl),
        provider: formatProviderLabel(loadedProvider ?? source),
        title,
      });
      toast({
        title: 'Job loaded',
        description: `${title} — ${company ?? ''}`,
      });
    } catch (err) {
      console.error('[loadRandomJob]', err);
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : String(err),
        variant: 'destructive',
      });
    } finally {
      setLoadingRandomJob(false);
    }
  };

  // Auto-populate the URL input with a random job on first mount so the
  // trainer is always ready to launch without clicking "Random" first.
  const hasAutoLoadedRandomJobRef = useRef(false);
  useEffect(() => {
    if (hasAutoLoadedRandomJobRef.current) return;
    if (urlInput.trim().length > 0) {
      hasAutoLoadedRandomJobRef.current = true;
      return;
    }
    hasAutoLoadedRandomJobRef.current = true;
    loadRandomJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    toast({ title: 'Copied', description: 'URL copied to clipboard.' });
  };

  // Listen for realtime training progress via Pusher
  const handleTrainingUpdate = useCallback(
    (payload?: { type?: string; data?: AssistTrainingProgressPayload }) => {
      if (
        !payload?.data ||
        payload.type !== DataEventType.ASSIST_TRAINING_PROGRESS
      )
        return;

      const update = payload.data;
      const nextInsight = update.hostnameInsight ?? null;
      setSessions(prev => {
        const idx = prev.findIndex(s => s.id === update.sessionId);
        if (nextInsight) {
          setHostnameInsights(current => ({
            ...current,
            [nextInsight.hostname]: nextInsight,
          }));
        }
        if (idx === -1) {
          // New session — prepend it
          return [
            {
              id: update.sessionId,
              status: update.status,
              hostname: update.hostname,
              targetUrl: '',
              atsSystemName: null,
              totalSteps: update.totalSteps,
              completedSteps: update.completedSteps,
              progress: update.progress,
              observationsCreated: update.observationsCreated,
              rulesPromoted: update.rulesPromoted,
              error: update.error ?? null,
              stepLogs: update.stepLogs ?? [],
              startedAt: new Date().toISOString(),
              completedAt: update.completedAt ?? null,
            },
            ...prev,
          ];
        }
        // Merge into existing session
        const updated = [...prev];
        updated[idx] = {
          ...updated[idx],
          status: update.status,
          completedSteps: update.completedSteps,
          totalSteps: update.totalSteps,
          progress: update.progress,
          observationsCreated: update.observationsCreated,
          rulesPromoted: update.rulesPromoted,
          error: update.error ?? updated[idx].error,
          completedAt: update.completedAt ?? updated[idx].completedAt,
          stepLogs: update.stepLogs ?? updated[idx].stepLogs,
        };
        return updated;
      });
    },
    [],
  );

  useEvent(userChannel, 'data-update', handleTrainingUpdate);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch('/api/assist-training?limit=30', {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const data = await res.json();
      setHostnameInsights(data.hostnameInsights ?? {});
      setSessions(data.sessions ?? []);
    } catch {
      // Silently ignore fetch errors
    }
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchSessions();
      }
    }, 5000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchSessions]);

  const retrySession = async (session: TrainingSession) => {
    setRetryingIds(prev => new Set(prev).add(session.id));
    try {
      const res = await fetch('/api/assist-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [session.targetUrl],
          dryRun,
          maxStepsPerUrl: maxSteps,
          maxDurationMin,
          captureScreenshots,
          disableJavascript,
          mobileViewport,
        }),
      });
      if (!res.ok) throw new Error('Retry failed');
      toast({
        title: 'Retrying',
        description: `Re-queued ${session.hostname}`,
      });
      await fetchSessions();
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to retry session',
        variant: 'destructive',
      });
    } finally {
      setRetryingIds(prev => {
        const next = new Set(prev);
        next.delete(session.id);
        return next;
      });
    }
  };

  const startTraining = async () => {
    const urls = urlInput
      .split('\n')
      .map(u => u.trim())
      .filter(u => {
        try {
          new URL(u);
          return true;
        } catch {
          return false;
        }
      });

    if (urls.length === 0) {
      toast({
        title: 'No valid URLs',
        description: 'Enter at least one valid URL to train on.',
        variant: 'destructive',
      });
      return;
    }

    setIsStarting(true);
    try {
      const res = await fetch('/api/assist-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls,
          dryRun,
          maxStepsPerUrl: maxSteps,
          maxDurationMin,
          captureScreenshots,
          disableJavascript,
          mobileViewport,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? 'Failed to start training');
      }

      const result = await res.json();
      const createdSessions = result.sessions as { id: string }[];

      toast({
        title: 'Training Started',
        description: `Created ${urls.length} training session(s).`,
      });
      setUrlInput('');

      // Navigate to the first session's detail page. Use router.push so the
      // intercepted parallel route fires and opens the slide-up modal rather
      // than hard-loading the full page.
      if (createdSessions.length === 1) {
        router.push(
          `/admin/assist-training/${createdSessions[0].id}` as never,
        );
        return;
      }

      await fetchSessions();
    } catch (error) {
      toast({
        title: 'Error',
        description:
          error instanceof Error ? error.message : 'Failed to start training',
        variant: 'destructive',
      });
    } finally {
      setIsStarting(false);
    }
  };

  const startHostnameTraining = async (
    hostname: string,
    urls: string[],
  ): Promise<void> => {
    const uniqueUrls = Array.from(new Set(urls)).slice(0, 3);

    if (uniqueUrls.length === 0) {
      toast({
        description: 'No recent URLs are available for this hostname.',
        title: 'No URLs',
        variant: 'destructive',
      });
      return;
    }

    setTrainingHostnames(prev => new Set(prev).add(hostname));
    try {
      const response = await fetch('/api/assist-training', {
        body: JSON.stringify({
          captureScreenshots,
          disableJavascript,
          dryRun,
          maxDurationMin,
          maxStepsPerUrl: maxSteps,
          mobileViewport,
          urls: uniqueUrls,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Failed to queue hostname training');
      }

      toast({
        description: `Queued ${uniqueUrls.length} training run(s) for ${hostname}.`,
        title: 'Hostname training queued',
      });
      await fetchSessions();
    } catch {
      toast({
        description: 'Failed to queue hostname training.',
        title: 'Error',
        variant: 'destructive',
      });
    } finally {
      setTrainingHostnames(prev => {
        const next = new Set(prev);
        next.delete(hostname);
        return next;
      });
    }
  };

  const batchStartHostnameTraining = async (
    hostnameGroups: Array<{
      hostname: string;
      recentUrls: string[];
      runningSessions: number;
    }>,
  ): Promise<void> => {
    const candidates = hostnameGroups
      .filter(group => group.runningSessions === 0)
      .filter(group => !trainingHostnames.has(group.hostname))
      .slice(0, 5);

    if (candidates.length === 0) {
      toast({
        description: 'No visible hostnames are ready for retraining.',
        title: 'Nothing to queue',
      });
      return;
    }

    setIsBatchTraining(true);
    try {
      for (const hostnameGroup of candidates) {
        await startHostnameTraining(
          hostnameGroup.hostname,
          hostnameGroup.recentUrls,
        );
      }
    } finally {
      setIsBatchTraining(false);
    }
  };

  const setHostnameReviewState = async ({
    hostname,
    reviewStatus,
    sessionId,
  }: {
    hostname: string;
    reviewStatus: 'approved' | 'hold' | 'needs-more-training';
    sessionId: string;
  }): Promise<void> => {
    setReviewingHostnames(prev => new Set(prev).add(hostname));
    try {
      const response = await fetch(`/api/assist-training/${sessionId}`, {
        body: JSON.stringify({
          action: 'set-review-state',
          reviewStatus,
        }),
        headers: { 'Content-Type': 'application/json' },
        method: 'PATCH',
      });

      if (!response.ok) {
        throw new Error('Failed to update training review');
      }

      toast({
        description: `${hostname} is now marked ${reviewStatus}.`,
        title: 'Training review updated',
      });
      await fetchSessions();
    } catch {
      toast({
        description: 'Failed to update hostname review state.',
        title: 'Error',
        variant: 'destructive',
      });
    } finally {
      setReviewingHostnames(prev => {
        const next = new Set(prev);
        next.delete(hostname);
        return next;
      });
    }
  };

  const batchSetHostnameReviewState = async ({
    hostnameGroups,
    reviewStatus,
  }: {
    hostnameGroups: Array<{
      hostname: string;
      latestSessionId: string;
    }>;
    reviewStatus: 'approved' | 'hold' | 'needs-more-training';
  }): Promise<void> => {
    const candidates = hostnameGroups
      .filter(group => !reviewingHostnames.has(group.hostname))
      .slice(0, 10);

    if (candidates.length === 0) {
      toast({
        description: 'No visible hostnames are ready for review updates.',
        title: 'Nothing to update',
      });
      return;
    }

    setIsBatchReviewing(true);
    try {
      for (const hostnameGroup of candidates) {
        await setHostnameReviewState({
          hostname: hostnameGroup.hostname,
          reviewStatus,
          sessionId: hostnameGroup.latestSessionId,
        });
      }
    } finally {
      setIsBatchReviewing(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="size-4 text-green-500" />;
      case 'running':
        return <Loader2 className="size-4 animate-spin text-blue-500" />;
      case 'failed':
        return <XCircle className="size-4 text-red-500" />;
      default:
        return <Activity className="size-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { className: string; label: string }> = {
      completed: {
        className: 'bg-green-400/10 text-green-400 border-green-500/20',
        label: 'Completed',
      },
      running: {
        className:
          'bg-blue-400/10 text-blue-400 border-blue-500/20 animate-pulse',
        label: 'Running',
      },
      failed: {
        className: 'bg-red-400/10 text-red-400 border-red-500/20',
        label: 'Failed',
      },
      pending: {
        className: 'bg-muted text-muted-foreground border-border',
        label: 'Pending',
      },
    };
    const c = config[status] ?? config.pending;
    return (
      <Badge variant="outline" className={c.className}>
        {c.label}
      </Badge>
    );
  };

  const formatSessionDuration = (session: TrainingSession): string => {
    const end = session.completedAt
      ? new Date(session.completedAt).getTime()
      : Date.now();
    const elapsed = Math.max(0, end - new Date(session.startedAt).getTime());
    const mins = Math.floor(elapsed / 60000);
    const secs = Math.floor((elapsed % 60000) / 1000);
    return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
  };

  const formatRelativeTime = (value: string | null): string | null => {
    if (!value) {
      return null;
    }

    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) {
      return null;
    }

    const diffMs = timestamp - Date.now();
    const diffMinutes = Math.round(diffMs / 60000);
    const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });

    if (Math.abs(diffMinutes) < 1) {
      return 'just now';
    }

    if (Math.abs(diffMinutes) < 60) {
      return rtf.format(diffMinutes, 'minute');
    }

    const diffHours = Math.round(diffMinutes / 60);
    if (Math.abs(diffHours) < 24) {
      return rtf.format(diffHours, 'hour');
    }

    const diffDays = Math.round(diffHours / 24);
    if (Math.abs(diffDays) < 7) {
      return rtf.format(diffDays, 'day');
    }

    const diffWeeks = Math.round(diffDays / 7);
    if (Math.abs(diffWeeks) < 5) {
      return rtf.format(diffWeeks, 'week');
    }

    const diffMonths = Math.round(diffDays / 30);
    if (Math.abs(diffMonths) < 12) {
      return rtf.format(diffMonths, 'month');
    }

    const diffYears = Math.round(diffDays / 365);
    return rtf.format(diffYears, 'year');
  };

  const getSecondsPerStep = (session: TrainingSession): string | null => {
    if (!session.startedAt || session.completedSteps <= 0) {
      return null;
    }

    const end = session.completedAt
      ? new Date(session.completedAt).getTime()
      : Date.now();
    const perStep =
      (end - new Date(session.startedAt).getTime()) /
      1000 /
      session.completedSteps;

    return `${perStep.toFixed(1)}s/step`;
  };

  const getLatestStepSummary = (session: TrainingSession): string | null => {
    const latestStep = session.stepLogs.at(-1);
    if (!latestStep) {
      return null;
    }

    const stepIndex =
      typeof latestStep.stepIndex === 'number' ? latestStep.stepIndex + 1 : null;
    const pageType =
      typeof latestStep.pageType === 'string' ? latestStep.pageType : null;
    const observationCount =
      typeof latestStep.observationsRecorded === 'number'
        ? latestStep.observationsRecorded
        : null;

    const parts = [
      stepIndex !== null ? `Step ${stepIndex}` : null,
      pageType ? pageType.replace(/_/g, ' ') : null,
      observationCount !== null ? `${observationCount} observations` : null,
    ].filter(Boolean);

    return parts.length > 0 ? parts.join(' · ') : null;
  };

  const hasValidUrls = useMemo(() => {
    return urlInput.split('\n').some(u => {
      try {
        new URL(u.trim());
        return true;
      } catch {
        return false;
      }
    });
  }, [urlInput]);

  // Detect ATS system from hostname
  const detectAts = (hostname: string): string | null => {
    const atsPatterns: Record<string, string> = {
      'greenhouse.io': 'Greenhouse',
      'lever.co': 'Lever',
      'myworkdayjobs.com': 'Workday',
      'workday.com': 'Workday',
      'icims.com': 'iCIMS',
      'taleo.net': 'Taleo',
      'smartrecruiters.com': 'SmartRecruiters',
      'jobvite.com': 'Jobvite',
      'ashbyhq.com': 'Ashby',
      'bamboohr.com': 'BambooHR',
      'jazz.co': 'JazzHR',
      'breezy.hr': 'Breezy',
      'recruitee.com': 'Recruitee',
      'applytojob.com': 'ApplyToJob',
      'ultipro.com': 'UltiPro',
      'successfactors.com': 'SuccessFactors',
      cornerstone: 'Cornerstone',
      'paycom.com': 'Paycom',
      'paylocity.com': 'Paylocity',
      'usajobs.gov': 'USAJobs',
    };
    const h = hostname.toLowerCase();
    for (const [pattern, name] of Object.entries(atsPatterns)) {
      if (h.includes(pattern)) return name;
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* New Training */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md">
        <h2 className="text-lg font-semibold">New Training Session</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Enter an application URL to train on. The system will analyze the page
          with GPT-4o Vision and record field observations.
        </p>

        <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-md">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <p className="text-[10px] font-medium text-muted-foreground">
                    Application URL
                  </p>
                  <TrainingFieldHelp text="Paste the job application URL you want the trainer to open. Use a direct apply page when possible, not a search results page." />
                </div>
                {randomJobMeta?.title ? (
                  (() => {
                    const normalizedProvider = normalizeLoadedJobMetaLabel(
                      randomJobMeta.provider,
                    );
                    const normalizedAts = normalizeLoadedJobMetaLabel(
                      randomJobMeta.atsSystemName,
                    );
                    const shouldShowProvider =
                      Boolean(randomJobMeta.provider) &&
                      normalizedProvider !== normalizedAts;

                    return (
                  <p className="flex min-w-0 items-center gap-1 text-[10px] text-muted-foreground">
                    Loaded:{' '}
                    <span className="max-w-48 truncate font-medium text-foreground">
                      {randomJobMeta.title}
                    </span>
                    {shouldShowProvider ? (
                      <>
                        {' '}
                        <span className="text-muted-foreground/60">|</span>{' '}
                        {randomJobMeta.provider}
                      </>
                    ) : null}
                    {randomJobMeta.atsSystemName ? (
                      <>
                        {' '}
                        <span className="text-muted-foreground/60">|</span>{' '}
                        {randomJobMeta.atsSystemName}
                      </>
                    ) : null}
                  </p>
                    );
                  })()
                ) : null}
              </div>
              <div className="flex h-9 w-full items-center gap-2 rounded-lg border border-zinc-700 bg-gradient-to-br from-zinc-400 to-zinc-500 px-2 dark:border-zinc-900 dark:from-zinc-800 dark:to-zinc-950">
                <Globe className="size-4 shrink-0 text-zinc-400" />
                <Input
                  className="h-8 min-w-0 flex-1 rounded-none border-0 bg-zinc-200 px-3 font-mono text-sm shadow-none focus-visible:ring-0 dark:bg-zinc-950"
                  value={urlInput}
                  onChange={e => setUrlInput(e.target.value)}
                  placeholder="https://boards.greenhouse.io/company/jobs/123"
                  onKeyDown={e => {
                    if (e.key === 'Enter' && hasValidUrls) startTraining();
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => loadRandomJob()}
                  disabled={loadingRandomJob}
                  className="ml-auto h-7 shrink-0 gap-1.5 px-1 text-xs"
                >
                  {loadingRandomJob ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3" />
                  )}
                  Random
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => loadRandomJob('greenhouse')}
                  disabled={loadingRandomJob}
                  className="h-7 shrink-0 gap-1.5 px-1 text-xs"
                >
                  <RefreshCw className="size-3" />
                  Greenhouse
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-5 lg:flex-nowrap lg:gap-6">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(6,max-content)] lg:justify-start lg:gap-x-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label
                      htmlFor="maxSteps"
                      className="text-[10px] whitespace-nowrap text-muted-foreground"
                    >
                      Steps
                    </Label>
                    <TrainingFieldHelp text="Maximum number of page interactions the trainer will take before stopping. Lower values are safer for short checks; higher values let it explore longer flows." />
                  </div>
                  <Input
                    id="maxSteps"
                    type="number"
                    min={1}
                    max={30}
                    value={maxSteps}
                    onChange={e => setMaxSteps(parseInt(e.target.value) || 15)}
                    className="h-9 border-border bg-zinc-200 text-xs dark:bg-zinc-950"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label
                      htmlFor="maxDuration"
                      className="text-[10px] whitespace-nowrap text-muted-foreground"
                    >
                      Max min
                    </Label>
                    <TrainingFieldHelp text="Maximum number of minutes a training run can stay active before it times out and records what it learned so far." />
                  </div>
                  <Input
                    id="maxDuration"
                    type="number"
                    min={1}
                    max={15}
                    value={maxDurationMin}
                    onChange={e => setMaxDurationMin(parseInt(e.target.value) || 5)}
                    className="h-9 border-border bg-zinc-200 text-xs dark:bg-zinc-950"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label
                      htmlFor="dryRun"
                      className="text-[10px] cursor-pointer text-muted-foreground"
                    >
                      Dry
                    </Label>
                    <TrainingFieldHelp text="Dry mode keeps the trainer in observation mode. It analyzes pages and records learning signals without intentionally filling live fields." />
                  </div>
                  <Switch
                    id="dryRun"
                    checked={dryRun}
                    onCheckedChange={setDryRun}
                    className="h-7 w-12 border-0 data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-zinc-800 dark:data-[state=checked]:bg-primary data-[state=unchecked]:[&>span]:translate-x-[4px] data-[state=checked]:[&>span]:translate-x-6 [&>span]:h-5 [&>span]:w-5"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label
                      htmlFor="captureScreenshots"
                      className="text-[10px] cursor-pointer text-muted-foreground"
                    >
                      Screens
                    </Label>
                    <TrainingFieldHelp text="Capture screenshots during training so you can inspect what the trainer saw at each step. Useful for debugging, but it stores more data." />
                  </div>
                  <Switch
                    id="captureScreenshots"
                    checked={captureScreenshots}
                    onCheckedChange={setCaptureScreenshots}
                    className="h-7 w-12 border-0 data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-zinc-800 dark:data-[state=checked]:bg-primary data-[state=unchecked]:[&>span]:translate-x-[4px] data-[state=checked]:[&>span]:translate-x-6 [&>span]:h-5 [&>span]:w-5"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="disableJs" className="text-[10px] cursor-pointer text-muted-foreground">
                      JS off
                    </Label>
                    <TrainingFieldHelp text="Turn this on only when you intentionally want to inspect a no-JavaScript fallback. Most ATS application flows need JavaScript enabled to train successfully." />
                  </div>
                  <Switch
                    id="disableJs"
                    checked={disableJavascript}
                    onCheckedChange={setDisableJavascript}
                    className="h-7 w-12 border-0 data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-zinc-800 dark:data-[state=checked]:bg-primary data-[state=unchecked]:[&>span]:translate-x-[4px] data-[state=checked]:[&>span]:translate-x-6 [&>span]:h-5 [&>span]:w-5"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-1">
                    <Label htmlFor="mobileViewport" className="text-[10px] cursor-pointer text-muted-foreground">
                      Mobile
                    </Label>
                    <TrainingFieldHelp text="Use a mobile-sized viewport for applications that serve a different mobile flow. Leave it off for the standard desktop training path." />
                  </div>
                  <Switch
                    id="mobileViewport"
                    checked={mobileViewport}
                    onCheckedChange={setMobileViewport}
                    className="h-7 w-12 border-0 data-[state=unchecked]:bg-zinc-200 data-[state=checked]:bg-primary dark:data-[state=unchecked]:bg-zinc-800 dark:data-[state=checked]:bg-primary data-[state=unchecked]:[&>span]:translate-x-[4px] data-[state=checked]:[&>span]:translate-x-6 [&>span]:h-5 [&>span]:w-5"
                  />
                </div>
              </div>

              <Button
                onClick={startTraining}
                disabled={isStarting || !hasValidUrls}
                size="sm"
                className="-translate-y-1 h-9 gap-1.5"
                title={
                  dryRun
                    ? 'Start an observation-only training run.'
                    : 'Start a live training run that can fill fields.'
                }
              >
                {isStarting ? (
                  <>
                    <Loader2 className="size-3.5 animate-spin" /> Starting...
                  </>
                ) : (
                  <>
                    <Eye className="size-3.5" /> {dryRun ? 'Observe' : 'Train'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

      </div>

      {/* Live Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-8">
        {(
          [
            {
              title: 'Total',
              value: stats.total.toLocaleString(),
              key: 'total',
              highlight: false,
              error: false,
            },
            {
              title: 'Completed',
              value: stats.completed.toLocaleString(),
              key: 'completed',
              highlight: false,
              error: false,
            },
            {
              title: 'Running',
              value: stats.running.toLocaleString(),
              key: 'running',
              highlight: stats.running > 0,
              error: false,
            },
            {
              title: 'Failed',
              value: stats.failed.toLocaleString(),
              key: 'failed',
              highlight: false,
              error: stats.failed > 0,
            },
            {
              title: 'Success Rate',
              value: `${stats.successRate}%`,
              key: 'success-rate',
              highlight: false,
              error: false,
            },
            {
              title: 'Avg Steps',
              value: stats.avgSteps,
              key: 'avg-steps',
              highlight: false,
              error: false,
            },
            {
              title: 'Observations',
              value: stats.observations.toLocaleString(),
              key: 'observations',
              highlight: false,
              error: false,
            },
            {
              title: 'Rules Promoted',
              value: stats.rulesPromoted.toLocaleString(),
              key: 'rules-promoted',
              highlight: false,
              error: false,
            },
          ] satisfies Array<{
            title: string;
            value: string | number;
            key: NonNullable<typeof statDrawerKey>;
            highlight: boolean;
            error: boolean;
          }>
        ).map(card => (
          <button
            key={card.title}
            type="button"
            onClick={() => setStatDrawerKey(card.key)}
            className={`rounded-lg border p-3 text-left backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-primary/5 ${
              card.highlight
                ? 'border-blue-500/30 bg-blue-500/5'
                : card.error
                  ? 'border-red-500/30 bg-red-500/5'
                  : 'border-white/[0.06] bg-white/[0.03]'
            }`}
          >
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {card.title}
            </p>
            <p
              className={`font-mono text-xl font-semibold ${
                card.highlight
                  ? 'text-blue-400'
                  : card.error
                    ? 'text-red-400'
                    : ''
              }`}
            >
              {card.value}
            </p>
          </button>
        ))}
      </div>

      {/* Stat drawer — lists sessions contributing to the clicked metric */}
      <Sheet
        open={statDrawerKey !== null}
        onOpenChange={open => {
          if (!open) setStatDrawerKey(null);
        }}
      >
        <SheetContent
          side="bottom"
          className="flex h-[70vh] flex-col gap-0 overflow-hidden rounded-t-2xl border-t p-0"
        >
          {(() => {
            const key = statDrawerKey;
            const config: Record<
              NonNullable<typeof statDrawerKey>,
              {
                title: string;
                description: string;
                filter: (s: (typeof sessions)[number]) => boolean;
                sort?: (
                  a: (typeof sessions)[number],
                  b: (typeof sessions)[number],
                ) => number;
                customRenderer?: 'observations' | 'rules';
              }
            > = {
              total: {
                title: 'All training sessions',
                description: `${stats.total.toLocaleString()} sessions total`,
                filter: () => true,
                sort: (a, b) =>
                  new Date(b.startedAt).getTime() -
                  new Date(a.startedAt).getTime(),
              },
              completed: {
                title: 'Completed sessions',
                description: `${stats.completed.toLocaleString()} sessions completed successfully`,
                filter: s => s.status === 'completed',
                sort: (a, b) =>
                  new Date(
                    b.completedAt ?? b.startedAt,
                  ).getTime() -
                  new Date(a.completedAt ?? a.startedAt).getTime(),
              },
              running: {
                title: 'Running sessions',
                description: `${stats.running.toLocaleString()} active right now`,
                filter: s =>
                  s.status === 'running' || s.status === 'pending',
                sort: (a, b) =>
                  new Date(b.startedAt).getTime() -
                  new Date(a.startedAt).getTime(),
              },
              failed: {
                title: 'Failed sessions',
                description: `${stats.failed.toLocaleString()} sessions failed — click to investigate`,
                filter: s => s.status === 'failed',
                sort: (a, b) =>
                  new Date(
                    b.completedAt ?? b.startedAt,
                  ).getTime() -
                  new Date(a.completedAt ?? a.startedAt).getTime(),
              },
              'success-rate': {
                title: 'Success rate breakdown',
                description: `${stats.successRate}% of finished sessions completed successfully`,
                filter: s =>
                  s.status === 'completed' || s.status === 'failed',
                sort: (a, b) => {
                  if (a.status !== b.status) {
                    return a.status === 'completed' ? -1 : 1;
                  }
                  return (
                    new Date(b.startedAt).getTime() -
                    new Date(a.startedAt).getTime()
                  );
                },
              },
              'avg-steps': {
                title: 'Sessions by steps completed',
                description: `Average ${stats.avgSteps} steps per session`,
                filter: () => true,
                sort: (a, b) => b.completedSteps - a.completedSteps,
              },
              observations: {
                title: 'All observations',
                description: `${stats.observations.toLocaleString()} field observations across all hostnames`,
                filter: () => false, // not session-based — handled separately
                sort: () => 0,
                customRenderer: 'observations',
              },
              'rules-promoted': {
                title: 'All promoted rules',
                description: `${stats.rulesPromoted.toLocaleString()} rules promoted from training`,
                filter: () => false, // not session-based — handled separately
                sort: () => 0,
                customRenderer: 'rules',
              },
            };
            const current = key ? config[key] : null;
            if (!current) {
              return (
                <SheetHeader className="px-4 pt-4">
                  <SheetTitle className="text-base">Sessions</SheetTitle>
                </SheetHeader>
              );
            }
            // Custom renderers for observations and rules
            if ('customRenderer' in current && current.customRenderer === 'observations') {
              return (
                <>
                  <SheetHeader className="px-4 pt-4">
                    <SheetTitle className="text-base">{current.title}</SheetTitle>
                    <SheetDescription className="text-[11px]">{current.description}</SheetDescription>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto px-3 pb-4">
                    {drawerItemsLoading ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">Loading...</div>
                    ) : drawerObservations.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">No observations yet.</div>
                    ) : (
                      <div className="space-y-1.5 pt-2">
                        {drawerObservations.map(obs => (
                          <div key={obs.id} className="rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">{obs.actionType}</Badge>
                                <span className="truncate text-xs font-medium">{obs.fieldDisplayName || obs.fieldLabel || obs.fieldName || obs.ariaLabel || '—'}</span>
                              </div>
                              <span className="shrink-0 font-mono text-[10px] text-muted-foreground">×{obs.observationCount}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="truncate">{obs.hostname}</span>
                              {obs.stableSelector ? <span className="truncate font-mono text-muted-foreground/50">{obs.stableSelector}</span> : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            }

            if ('customRenderer' in current && current.customRenderer === 'rules') {
              return (
                <>
                  <SheetHeader className="px-4 pt-4">
                    <SheetTitle className="text-base">{current.title}</SheetTitle>
                    <SheetDescription className="text-[11px]">{current.description}</SheetDescription>
                  </SheetHeader>
                  <div className="flex-1 overflow-y-auto px-3 pb-4">
                    {drawerItemsLoading ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">Loading...</div>
                    ) : drawerRules.length === 0 ? (
                      <div className="py-8 text-center text-xs text-muted-foreground">No rules yet.</div>
                    ) : (
                      <div className="space-y-1.5 pt-2">
                        {drawerRules.map(rule => (
                          <div key={rule.id} className={`rounded-md border p-2.5 ${rule.enabled ? 'border-green-500/20 bg-green-500/5' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex min-w-0 items-center gap-1.5">
                                <Badge variant="secondary" className="shrink-0 px-1.5 py-0 text-[9px]">{rule.actionType}</Badge>
                                <span className="truncate text-xs font-medium">{rule.fieldLabel || rule.fieldName || '—'}</span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2">
                                <span className="font-mono text-[10px] text-muted-foreground">{Math.round(rule.confidence * 100)}%</span>
                                {!rule.enabled && <span className="text-[9px] text-red-400">disabled</span>}
                              </div>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="truncate">{rule.hostname}</span>
                              <span className="font-mono text-muted-foreground/50">step {rule.stepIndex}</span>
                              <span className="font-mono text-muted-foreground/50">×{rule.observationCount}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              );
            }

            const list = sessions
              .filter(current.filter)
              .sort(current.sort ?? (() => 0))
              .slice(0, 100);
            return (
              <>
                <SheetHeader className="px-4 pt-4">
                  <SheetTitle className="text-base">
                    {current.title}
                  </SheetTitle>
                  <SheetDescription className="text-[11px]">
                    {current.description}
                  </SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-3 pb-4">
                  {list.length === 0 ? (
                    <div className="py-8 text-center text-xs text-muted-foreground">
                      No sessions match this filter.
                    </div>
                  ) : (
                    <div className="space-y-1.5 pt-2">
                      {list.map(session => {
                        const statusColor =
                          session.status === 'completed'
                            ? 'text-green-400'
                            : session.status === 'failed'
                              ? 'text-red-400'
                              : session.status === 'running' ||
                                  session.status === 'pending'
                                ? 'text-blue-400'
                                : 'text-muted-foreground';
                        return (
                          <button
                            key={session.id}
                            type="button"
                            onClick={() => {
                              setStatDrawerKey(null);
                              router.push(
                                `/admin/assist-training/${session.id}` as never,
                              );
                            }}
                            className="block w-full rounded-md border border-white/[0.06] bg-white/[0.02] p-2.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-medium">
                                  {session.hostname}
                                </p>
                                <p className="truncate font-mono text-[10px] text-muted-foreground/80">
                                  {session.targetUrl}
                                </p>
                              </div>
                              <Badge
                                variant="outline"
                                className={`shrink-0 px-1.5 py-0 text-[9px] uppercase tracking-wide ${statusColor}`}
                              >
                                {session.status}
                              </Badge>
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[10px] text-muted-foreground">
                              <span>
                                {session.completedSteps}/{session.totalSteps}{' '}
                                steps
                              </span>
                              <span>{session.observationsCreated} obs</span>
                              <span>{session.rulesPromoted} rules</span>
                              {session.atsSystemName ? (
                                <span className="font-medium text-foreground/60">
                                  {session.atsSystemName}
                                </span>
                              ) : null}
                              <span className="ml-auto">
                                {new Date(session.startedAt).toLocaleString()}
                              </span>
                            </div>
                            {session.error ? (
                              <p className="mt-1.5 truncate text-[10px] text-red-400/80">
                                {session.error}
                              </p>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {filteredHostnameTrainingQueue.length === 0 &&
      filteredHostnameReviewQueue.length === 0 &&
      filteredApprovedHostnameQueue.length === 0 &&
      filteredSessions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-white/[0.08] bg-white/[0.02] p-6 text-sm text-muted-foreground">
          No training items match the current hostname filter or focus.
        </div>
      ) : null}

      {/* ATS Breakdown */}
      {(() => {
        const atsCounts = new Map<
          string,
          { total: number; completed: number; failed: number; obs: number }
        >();
        for (const s of sessions) {
          const ats = s.atsSystemName || detectAts(s.hostname) || 'Unknown';
          const entry = atsCounts.get(ats) ?? {
            total: 0,
            completed: 0,
            failed: 0,
            obs: 0,
          };
          entry.total++;
          if (s.status === 'completed') entry.completed++;
          if (s.status === 'failed') entry.failed++;
          entry.obs += s.observationsCreated;
          atsCounts.set(ats, entry);
        }
        const allEntries = Array.from(atsCounts.entries());
        if (allEntries.length === 0) return null;
        if (allEntries.length === 1 && allEntries[0][0] === 'Unknown') return null;

        const TOTAL_SLOTS = 6;
        const unknownEntry =
          allEntries.find(([name]) => name === 'Unknown') ?? null;
        const namedEntries = allEntries
          .filter(([name]) => name !== 'Unknown')
          .sort((a, b) => b[1].total - a[1].total);

        const slotsBeforeTrailing = unknownEntry ? TOTAL_SLOTS - 1 : TOTAL_SLOTS;
        const needsOther = namedEntries.length > slotsBeforeTrailing;
        const topNamedCount = needsOther
          ? slotsBeforeTrailing - 1
          : namedEntries.length;
        const topNamed = namedEntries.slice(0, topNamedCount);
        const overflow = namedEntries.slice(topNamedCount);

        const otherEntry: [
          string,
          { total: number; completed: number; failed: number; obs: number },
        ] | null = needsOther && overflow.length > 0
          ? [
              'Other',
              overflow.reduce(
                (acc, [, data]) => ({
                  total: acc.total + data.total,
                  completed: acc.completed + data.completed,
                  failed: acc.failed + data.failed,
                  obs: acc.obs + data.obs,
                }),
                { total: 0, completed: 0, failed: 0, obs: 0 },
              ),
            ]
          : null;

        const displayEntries: Array<
          [string, { total: number; completed: number; failed: number; obs: number }]
        > = [
          ...topNamed,
          ...(otherEntry ? [otherEntry] : []),
          ...(unknownEntry ? [unknownEntry] : []),
        ];

        const currentOtherMembers = overflow.map(([name]) => name);

        return (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
              {displayEntries.map(([ats, data]) => {
                const isOther = ats === 'Other';
                const filterKey = isOther ? '__other__' : ats;
                const isActive = atsCardFilter === filterKey;
                const title =
                  isOther && overflow.length > 0
                    ? `Other (${currentOtherMembers.join(', ')}) — click to filter`
                    : `Click to filter to ${ats}`;
                return (
                  <button
                    key={ats}
                    type="button"
                    title={title}
                    onClick={() => {
                      if (isActive) {
                        setAtsCardFilter(null);
                        setAtsOtherMembers([]);
                      } else {
                        setAtsCardFilter(filterKey);
                        setAtsOtherMembers(
                          isOther ? currentOtherMembers : [],
                        );
                      }
                    }}
                    className={`rounded-lg border p-3 text-left backdrop-blur-md transition-colors hover:border-primary/40 hover:bg-primary/5 ${
                      isActive
                        ? 'border-primary/60 bg-primary/10 ring-1 ring-primary/40'
                        : 'border-white/[0.06] bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium truncate">{ats}</p>
                      {data.total > 0 ? (
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {Math.round((data.completed / data.total) * 100)}%
                        </span>
                      ) : null}
                    </div>
                    <p className="font-mono text-lg font-semibold">
                      {data.total}
                    </p>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-1">
                      <span className="text-green-400">
                        {data.completed} ok
                      </span>
                      {data.failed > 0 && (
                        <span className="text-red-400">
                          {data.failed} fail
                        </span>
                      )}
                      <span>{data.obs} obs</span>
                    </div>
                    {data.total > 0 && (
                      <Progress
                        value={(data.completed / data.total) * 100}
                        className="h-1 mt-1.5"
                      />
                    )}
                  </button>
                );
              })}
            </div>
            {atsCardFilter ? (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>
                  Filtering to{' '}
                  <span className="font-medium text-foreground">
                    {atsCardFilter === '__other__'
                      ? `Other (${atsOtherMembers.join(', ')})`
                      : atsCardFilter}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setAtsCardFilter(null);
                    setAtsOtherMembers([]);
                  }}
                  className="rounded border border-border/60 px-2 py-0.5 text-[10px] hover:bg-muted/40"
                >
                  Clear
                </button>
              </div>
            ) : null}
          </div>
        );
      })()}

      <Tabs defaultValue="sessions" className="space-y-5">
        <TabsList>
          <TabsTrigger value="sessions">Sessions</TabsTrigger>
          <TabsTrigger value="hostnames">Hostnames</TabsTrigger>
        </TabsList>

        <TabsContent value="hostnames" className="space-y-5">
          {filteredHostnameTrainingQueue.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Hostname Training Control</h2>
                  <p className="text-sm text-muted-foreground">
                    Queue repeated training runs by hostname and watch which domains
                    are becoming trustworthy.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {filteredHostnameTrainingQueue.length} hostnames
                  </Badge>
                  <Badge variant="outline">
                    {trainingImpact.retrainingNeeded} need retraining
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBatchTraining}
                    onClick={() =>
                      batchStartHostnameTraining(filteredHostnameTrainingQueue)
                    }
                  >
                    {isBatchTraining ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 size-3.5" />
                    )}
                    Retrain top visible
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {filteredHostnameTrainingQueue.map(hostnameGroup => {
                  const insight = hostnameInsights[hostnameGroup.hostname];
                  const isTraining = trainingHostnames.has(hostnameGroup.hostname);

                  return (
                    <div
                      key={hostnameGroup.hostname}
                      className="rounded-md border border-border/50 bg-background p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {hostnameGroup.hostname}
                            </p>
                            {insight?.trustEligibility ? (
                              <Badge
                                variant="outline"
                                className={
                                  insight.trustEligibility === 'AUTO_STEP_GUARDED'
                                    ? 'border-emerald-500/30 text-emerald-500'
                                    : insight.trustEligibility ===
                                        'ACTION_WITH_CONFIRMATION'
                                      ? 'border-blue-500/30 text-blue-500'
                                      : ''
                                }
                              >
                                {insight.trustEligibility}
                              </Badge>
                            ) : null}
                            {insight?.flowVersion ? (
                              <Badge variant="outline">
                                Flow v{insight.flowVersion}
                              </Badge>
                            ) : null}
                            {insight?.healthStatus ? (
                              <Badge
                                variant="outline"
                                className={
                                  insight.healthStatus === 'at-risk'
                                    ? 'border-amber-500/30 text-amber-500'
                                    : insight.healthStatus === 'stale'
                                      ? 'border-orange-500/30 text-orange-500'
                                      : insight.healthStatus === 'healthy'
                                        ? 'border-emerald-500/30 text-emerald-500'
                                        : 'border-muted-foreground/30 text-muted-foreground'
                                }
                              >
                                {insight.healthStatus}
                              </Badge>
                            ) : null}
                            {insight?.retrainingNeeded ? (
                              <Badge
                                variant="outline"
                                className={
                                  insight.retrainingPriority === 'high'
                                    ? 'border-amber-500/30 text-amber-500'
                                    : insight.retrainingPriority === 'medium'
                                      ? 'border-yellow-500/30 text-yellow-500'
                                      : 'border-muted-foreground/30 text-muted-foreground'
                                }
                              >
                                Retraining {insight.retrainingPriority ?? 'needed'}
                              </Badge>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => focusHostname(hostnameGroup.hostname)}
                            >
                              Focus
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{hostnameGroup.totalSessions} total runs</span>
                            <span>{hostnameGroup.successfulSessions} completed</span>
                            <span>{hostnameGroup.failedSessions} failed</span>
                            <span>{hostnameGroup.runningSessions} active</span>
                            {typeof insight?.enabledRuleCount === 'number' ? (
                              <span>{insight.enabledRuleCount} enabled rules</span>
                            ) : null}
                            {insight?.flowStepCount ? (
                              <span>{insight.flowStepCount} compiled steps</span>
                            ) : null}
                          </div>
                          {insight?.trustReason ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {insight.trustReason}
                            </p>
                          ) : null}
                          {insight?.healthReason ? (
                            <p className="mt-1 text-xs text-muted-foreground/80">
                              {insight.healthReason}
                            </p>
                          ) : null}
                          {insight?.retrainingReason ? (
                            <p className="mt-1 text-xs text-muted-foreground/80">
                              {insight.retrainingReason}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          disabled={isTraining || hostnameGroup.runningSessions > 0}
                          onClick={() =>
                            startHostnameTraining(
                              hostnameGroup.hostname,
                              hostnameGroup.recentUrls,
                            )
                          }
                        >
                          {isTraining ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1.5 size-3.5" />
                          )}
                          Retrain hostname
                        </Button>
                      </div>
                      {hostnameGroup.recentUrls.length > 0 ? (
                        <div className="mt-3 space-y-1">
                          {hostnameGroup.recentUrls.map(url => (
                            <div
                              key={url}
                              className="truncate font-mono text-[10px] text-muted-foreground/60"
                            >
                              {url}
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {filteredHostnameReviewQueue.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Training Review Queue</h2>
              <p className="text-sm text-muted-foreground">
                Review hostnames that now have enough learned coverage to
                approve, hold, or send back for more training.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">
                {filteredHostnameReviewQueue.length} queued
              </Badge>
              <Button
                size="sm"
                variant="outline"
                disabled={isBatchReviewing}
                onClick={() =>
                  batchSetHostnameReviewState({
                    hostnameGroups: filteredHostnameReviewQueue,
                    reviewStatus: 'hold',
                  })
                }
              >
                {isBatchReviewing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Hold top visible
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={isBatchReviewing}
                onClick={() =>
                  batchSetHostnameReviewState({
                    hostnameGroups: filteredHostnameReviewQueue,
                    reviewStatus: 'needs-more-training',
                  })
                }
              >
                {isBatchReviewing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Needs more top visible
              </Button>
              <Button
                size="sm"
                disabled={isBatchReviewing}
                onClick={() =>
                  batchSetHostnameReviewState({
                    hostnameGroups: filteredHostnameReviewQueue,
                    reviewStatus: 'approved',
                  })
                }
              >
                {isBatchReviewing ? (
                  <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                ) : null}
                Approve top visible
              </Button>
            </div>
          </div>
          <div className="mt-4 space-y-3">
            {filteredHostnameReviewQueue.map(hostnameGroup => {
              const insight = hostnameInsights[hostnameGroup.hostname];
              const isReviewing = reviewingHostnames.has(hostnameGroup.hostname);

              if (!insight) {
                return null;
              }

              return (
                <div
                  key={hostnameGroup.hostname}
                  className="rounded-md border border-border/50 bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {hostnameGroup.hostname}
                        </p>
                        {insight.reviewStatus ? (
                          <Badge variant="outline">{insight.reviewStatus}</Badge>
                        ) : null}
                        {insight.reviewReady ? (
                          <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                            Ready for review
                          </Badge>
                        ) : null}
                        <Badge
                          variant="outline"
                          className={
                            insight.healthStatus === 'at-risk'
                              ? 'border-amber-500/30 text-amber-500'
                              : insight.healthStatus === 'stale'
                                ? 'border-orange-500/30 text-orange-500'
                                : insight.healthStatus === 'healthy'
                                  ? 'border-emerald-500/30 text-emerald-500'
                                  : 'border-muted-foreground/30 text-muted-foreground'
                          }
                        >
                          {insight.healthStatus}
                        </Badge>
                        {insight.retrainingNeeded ? (
                          <Badge
                            variant="outline"
                            className={
                              insight.retrainingPriority === 'high'
                                ? 'border-amber-500/30 text-amber-500'
                                : insight.retrainingPriority === 'medium'
                                  ? 'border-yellow-500/30 text-yellow-500'
                                  : 'border-muted-foreground/30 text-muted-foreground'
                            }
                          >
                            Retraining {insight.retrainingPriority ?? 'needed'}
                          </Badge>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => focusHostname(hostnameGroup.hostname)}
                        >
                          Focus
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{insight.completedSessionCount} completed runs</span>
                        <span>{insight.failedSessionCount} failed runs</span>
                        <span>{insight.enabledRuleCount} enabled rules</span>
                        <span>{insight.flowStepCount} compiled steps</span>
                        {insight.flowVersion ? (
                          <span>Flow v{insight.flowVersion}</span>
                        ) : null}
                        {insight.trustEligibility ? (
                          <span>{insight.trustEligibility}</span>
                        ) : null}
                      </div>
                      {insight.reviewReason ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {insight.reviewReason}
                        </p>
                      ) : null}
                      {insight.healthReason ? (
                        <p className="mt-1 text-xs text-muted-foreground/80">
                          {insight.healthReason}
                        </p>
                      ) : null}
                      {insight.retrainingReason ? (
                        <p className="mt-1 text-xs text-muted-foreground/80">
                          {insight.retrainingReason}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isReviewing}
                        onClick={() =>
                          setHostnameReviewState({
                            hostname: hostnameGroup.hostname,
                            reviewStatus: 'needs-more-training',
                            sessionId: hostnameGroup.latestSessionId,
                          })
                        }
                      >
                        {isReviewing ? (
                          <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                        ) : null}
                        Needs more
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isReviewing}
                        onClick={() =>
                          setHostnameReviewState({
                            hostname: hostnameGroup.hostname,
                            reviewStatus: 'hold',
                            sessionId: hostnameGroup.latestSessionId,
                          })
                        }
                      >
                        Hold
                      </Button>
                      <Button
                        size="sm"
                        disabled={isReviewing}
                        onClick={() =>
                          setHostnameReviewState({
                            hostname: hostnameGroup.hostname,
                            reviewStatus: 'approved',
                            sessionId: hostnameGroup.latestSessionId,
                          })
                        }
                      >
                        Approve
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          )}

          {filteredApprovedHostnameQueue.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Approved Hostnames</h2>
              <p className="text-sm text-muted-foreground">
                Hostnames already reviewed and approved from training.
              </p>
            </div>
            <Badge variant="outline">
              {filteredApprovedHostnameQueue.length} approved
            </Badge>
          </div>
          <div className="mt-4 space-y-3">
            {filteredApprovedHostnameQueue.map(hostnameGroup => {
              const insight = hostnameInsights[hostnameGroup.hostname];
              const isTraining = trainingHostnames.has(hostnameGroup.hostname);

              if (!insight) {
                return null;
              }

              return (
                <div
                  key={hostnameGroup.hostname}
                  className="rounded-md border border-border/50 bg-background p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {hostnameGroup.hostname}
                        </p>
                        <Badge className="bg-emerald-500 text-white hover:bg-emerald-500">
                          approved
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            insight.healthStatus === 'at-risk'
                              ? 'border-amber-500/30 text-amber-500'
                              : insight.healthStatus === 'stale'
                                ? 'border-orange-500/30 text-orange-500'
                                : insight.healthStatus === 'healthy'
                                  ? 'border-emerald-500/30 text-emerald-500'
                                  : 'border-muted-foreground/30 text-muted-foreground'
                          }
                        >
                          {insight.healthStatus}
                        </Badge>
                        {insight.retrainingNeeded ? (
                          <Badge
                            variant="outline"
                            className={
                              insight.retrainingPriority === 'high'
                                ? 'border-amber-500/30 text-amber-500'
                                : insight.retrainingPriority === 'medium'
                                  ? 'border-yellow-500/30 text-yellow-500'
                                  : 'border-muted-foreground/30 text-muted-foreground'
                            }
                          >
                            Retraining {insight.retrainingPriority ?? 'needed'}
                          </Badge>
                        ) : null}
                        {insight.flowVersion ? (
                          <Badge variant="outline">Flow v{insight.flowVersion}</Badge>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => focusHostname(hostnameGroup.hostname)}
                        >
                          Focus
                        </Button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{insight.completedSessionCount} completed runs</span>
                        <span>{insight.enabledRuleCount} enabled rules</span>
                        <span>{insight.flowStepCount} compiled steps</span>
                        {insight.trustEligibility ? (
                          <span>{insight.trustEligibility}</span>
                        ) : null}
                      </div>
                      {insight.reviewReason ? (
                        <p className="mt-2 text-xs text-muted-foreground">
                          {insight.reviewReason}
                        </p>
                      ) : null}
                      {insight.healthReason ? (
                        <p className="mt-1 text-xs text-muted-foreground/80">
                          {insight.healthReason}
                        </p>
                      ) : null}
                      {insight.retrainingReason ? (
                        <p className="mt-1 text-xs text-muted-foreground/80">
                          {insight.retrainingReason}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isTraining || hostnameGroup.runningSessions > 0}
                      onClick={() =>
                        startHostnameTraining(
                          hostnameGroup.hostname,
                          hostnameGroup.recentUrls,
                        )
                      }
                    >
                      {isTraining ? (
                        <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-1.5 size-3.5" />
                      )}
                      Reinforce training
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Learning Summary</h2>
                <p className="text-sm text-muted-foreground">
                  A rollup of what training has already taught the system.
                </p>
              </div>
            </div>
            <div className="mt-4 space-y-3">
              <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
                {trainingSummaryCards.map(card => (
                  <div
                    key={card.title}
                    className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3 backdrop-blur-md"
                  >
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {card.title}
                    </p>
                    <p className="font-mono text-xl font-semibold">
                      {card.value.toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      {card.description}
                    </p>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span>
                  On hold:{' '}
                  <span className="font-medium text-foreground">
                    {trainingImpact.onHold.toLocaleString()}
                  </span>
                </span>
                <span>
                  Waiting for first approval:{' '}
                  <span className="font-medium text-foreground">
                    {trainingImpact.waitingForApproval.toLocaleString()}
                  </span>
                </span>
                <span>
                  Still confirmation-only:{' '}
                  <span className="font-medium text-foreground">
                    {trainingImpact.waitingForConfirmation.toLocaleString()}
                  </span>
                </span>
                <span>
                  At risk:{' '}
                  <span className="font-medium text-foreground">
                    {trainingImpact.atRisk.toLocaleString()}
                  </span>
                </span>
                <span>
                  Stale approved:{' '}
                  <span className="font-medium text-foreground">
                    {trainingImpact.stale.toLocaleString()}
                  </span>
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 backdrop-blur-md">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-semibold">Training Focus</h2>
                <p className="text-xs text-muted-foreground">
                  Filter hostname queues and session history together.
                </p>
              </div>
              <div className="w-full xl:max-w-sm">
                <Input
                  className="h-9"
                  onChange={e => setHostnameQuery(e.target.value)}
                  placeholder="Filter by hostname"
                  value={hostnameQuery}
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { label: 'All', value: 'all' },
                { label: 'Needs More', value: 'needs-more' },
                { label: 'At Risk', value: 'at-risk' },
                { label: 'Retraining Needed', value: 'retraining' },
                { label: 'Review Queue', value: 'review' },
                { label: 'Approved', value: 'approved' },
                { label: 'Auto-Step Ready', value: 'auto-ready' },
              ].map(filter => (
                <Button
                  key={filter.value}
                  className="h-8"
                  onClick={() =>
                    setTrainingFocus(
                      filter.value as
                        | 'all'
                        | 'approved'
                        | 'at-risk'
                        | 'auto-ready'
                        | 'needs-more'
                        | 'retraining'
                        | 'review',
                    )
                  }
                  size="sm"
                  variant={
                    trainingFocus === filter.value ? 'default' : 'outline'
                  }
                >
                  {filter.label}{' '}
                  <span className="ml-1 font-mono text-[11px]">
                    {
                      trainingFocusCounts[
                        filter.value as keyof typeof trainingFocusCounts
                      ]
                    }
                  </span>
                </Button>
              ))}
              {(hostnameQuery || trainingFocus !== 'all') && (
                <Button
                  className="h-8"
                  onClick={() => {
                    setHostnameQuery('');
                    setTrainingFocus('all');
                  }}
                  size="sm"
                  variant="ghost"
                >
                  Clear filters
                </Button>
              )}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span>
                Hostnames:{' '}
                <span className="font-medium text-foreground">
                  {filteredHostnameTrainingQueue.length}
                </span>
              </span>
              <span>
                Retraining:{' '}
                <span className="font-medium text-foreground">
                  {filteredRetrainingHostnameQueue.length}
                </span>
              </span>
              <span>
                Review queue:{' '}
                <span className="font-medium text-foreground">
                  {filteredHostnameReviewQueue.length}
                </span>
              </span>
              <span>
                Approved:{' '}
                <span className="font-medium text-foreground">
                  {filteredApprovedHostnameQueue.length}
                </span>
              </span>
              <span>
                Sessions:{' '}
                <span className="font-medium text-foreground">
                  {filteredSessions.length}
                </span>
              </span>
            </div>
          </div>

          {filteredRetrainingHostnameQueue.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Retraining Needed</h2>
                  <p className="text-sm text-muted-foreground">
                    Hostnames whose learned rules or compiled flow have drifted and
                    should be retrained before trust rises again.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">
                    {filteredRetrainingHostnameQueue.length} flagged
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isBatchTraining}
                    onClick={() =>
                      batchStartHostnameTraining(filteredRetrainingHostnameQueue)
                    }
                  >
                    {isBatchTraining ? (
                      <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-1.5 size-3.5" />
                    )}
                    Retrain flagged hostnames
                  </Button>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {filteredRetrainingHostnameQueue.map(hostnameGroup => {
                  const insight = hostnameInsights[hostnameGroup.hostname];
                  const isTraining = trainingHostnames.has(hostnameGroup.hostname);

                  if (!insight) {
                    return null;
                  }

                  return (
                    <div
                      key={hostnameGroup.hostname}
                      className="rounded-md border border-border/50 bg-background p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-medium">
                              {hostnameGroup.hostname}
                            </p>
                            <Badge
                              variant="outline"
                              className={
                                insight.retrainingPriority === 'high'
                                  ? 'border-amber-500/30 text-amber-500'
                                  : insight.retrainingPriority === 'medium'
                                    ? 'border-yellow-500/30 text-yellow-500'
                                    : 'border-muted-foreground/30 text-muted-foreground'
                              }
                            >
                              Retraining {insight.retrainingPriority ?? 'needed'}
                            </Badge>
                            {insight.flowVersion ? (
                              <Badge variant="outline">
                                Flow v{insight.flowVersion}
                              </Badge>
                            ) : null}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 px-2 text-[11px]"
                              onClick={() => focusHostname(hostnameGroup.hostname)}
                            >
                              Focus
                            </Button>
                          </div>
                          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span>{hostnameGroup.totalSessions} total runs</span>
                            <span>{hostnameGroup.successfulSessions} completed</span>
                            <span>{hostnameGroup.failedSessions} failed</span>
                            <span>{insight.enabledRuleCount} enabled rules</span>
                            <span>{insight.flowStepCount} compiled steps</span>
                            {insight.lastCompletedAt ? (
                              <span>
                                Last success{' '}
                                {new Date(insight.lastCompletedAt).toLocaleDateString()}
                              </span>
                            ) : null}
                            {insight.lastFailedAt ? (
                              <span>
                                Last failure{' '}
                                {new Date(insight.lastFailedAt).toLocaleDateString()}
                              </span>
                            ) : null}
                          </div>
                          {insight.retrainingReason ? (
                            <p className="mt-2 text-xs text-muted-foreground">
                              {insight.retrainingReason}
                            </p>
                          ) : null}
                        </div>
                        <Button
                          size="sm"
                          disabled={isTraining || hostnameGroup.runningSessions > 0}
                          onClick={() =>
                            startHostnameTraining(
                              hostnameGroup.hostname,
                              hostnameGroup.recentUrls,
                            )
                          }
                        >
                          {isTraining ? (
                            <Loader2 className="mr-1.5 size-3.5 animate-spin" />
                          ) : (
                            <RefreshCw className="mr-1.5 size-3.5" />
                          )}
                          Retrain now
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        <TabsContent value="sessions" className="space-y-5">
          {currentSessions.length > 0 && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5 backdrop-blur-md">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold">Current Training Session</h2>
                <Badge className="border-blue-500/30 bg-blue-500/10 text-blue-300">
                  In progress
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Active runs are kept separate from historical sessions so you can
                track live progress clearly.
              </p>
            </div>
            <Badge variant="outline">{currentSessions.length} active</Badge>
          </div>

          <div className="mt-4 space-y-3">
            {currentSessions.map(session => {
              const insight = hostnameInsights[session.hostname];
              const latestStepSummary = getLatestStepSummary(session);
              const secondsPerStep = getSecondsPerStep(session);

              return (
                <button
                  key={session.id}
                  type="button"
                  className="w-full rounded-lg border border-blue-500/20 bg-background/80 p-4 text-left transition-colors hover:bg-muted/30"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={() => router.push(`/admin/assist-training/${session.id}` as any)}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-medium">
                          {session.hostname}
                        </p>
                        {getStatusBadge(session.status)}
                        <Badge variant="outline">
                          {session.completedSteps}/{session.totalSteps} steps
                        </Badge>
                        {insight?.flowStepCount ? (
                          <Badge variant="outline">
                            {insight.flowStepCount} compiled steps
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {session.targetUrl}
                      </p>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      <div>{formatSessionDuration(session)}</div>
                      <div>
                        {formatRelativeTime(
                          session.completedAt ?? session.startedAt,
                        ) ?? ''}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {Math.floor(session.progress)}% complete
                      </span>
                      <span>
                        {session.observationsCreated} observations ·{' '}
                        {session.rulesPromoted} rules
                      </span>
                    </div>
                    <Progress value={session.progress} className="h-2" />
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    {latestStepSummary ? <span>{latestStepSummary}</span> : null}
                    {secondsPerStep ? (
                      <span className="font-mono">{secondsPerStep}</span>
                    ) : null}
                    {(session.atsSystemName || detectAts(session.hostname)) && (
                      <Badge
                        variant="outline"
                        className="border-violet-500/30 text-[10px] text-violet-400"
                      >
                        {session.atsSystemName || detectAts(session.hostname)}
                      </Badge>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
            </div>
          )}

          {sessions.length > 0 && (
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.03] p-5 backdrop-blur-md">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold">
              Previous Sessions
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {previousSessions.length}
              </span>
            </h2>
            <div className="flex items-center gap-3">
              <div className="inline-flex h-7 items-center rounded-lg bg-muted/50 p-0.5 text-[11px]">
                {[
                  { label: 'All', value: 'all' },
                  { label: 'Active', value: 'active' },
                  { label: 'Done', value: 'completed' },
                  { label: 'Failed', value: 'failed' },
                ].map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() =>
                      setSessionStatusFilter(
                        filter.value as 'active' | 'all' | 'completed' | 'failed',
                      )
                    }
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      sessionStatusFilter === filter.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {filter.label}
                    <span className="ml-1 font-mono opacity-60">
                      {sessionStatusCounts[filter.value as keyof typeof sessionStatusCounts]}
                    </span>
                  </button>
                ))}
              </div>
              <div className="inline-flex h-7 items-center rounded-lg bg-muted/50 p-0.5 text-[11px]">
                {[
                  { label: 'Problems', value: 'problem-first' },
                  { label: 'Latest', value: 'latest' },
                  { label: 'Most obs', value: 'most-observations' },
                ].map(sortOption => (
                  <button
                    key={sortOption.value}
                    type="button"
                    onClick={() =>
                      setSessionSort(
                        sortOption.value as
                          | 'latest'
                          | 'most-observations'
                          | 'problem-first',
                      )
                    }
                    className={`rounded-md px-2.5 py-1 font-medium transition-colors ${
                      sessionSort === sortOption.value
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {sortOption.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-3">
            {previousSessions.length === 0 && (
              <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
                No sessions match this filter.
              </div>
            )}
            {previousSessions.map(session => {
              const insight = hostnameInsights[session.hostname];

              return (
                <div
                  key={session.id}
                  className="rounded-md border border-border/50 bg-background"
                >
                {/* Session header */}
                <button
                  type="button"
                  className="flex w-full items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors"
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  onClick={() => router.push(`/admin/assist-training/${session.id}` as any)}
                >
                  {getStatusIcon(session.status)}
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-sm font-medium">
                      {session.hostname}
                    </p>
                    <div className="flex items-center gap-0.5 min-w-0">
                      <p className="truncate text-xs text-muted-foreground">
                        {session.targetUrl}
                      </p>
                      <span
                        role="button"
                        tabIndex={0}
                        className="shrink-0 rounded p-0.5 text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={e => {
                          e.stopPropagation();
                          copyUrl(session.targetUrl);
                        }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.stopPropagation();
                            copyUrl(session.targetUrl);
                          }
                        }}
                        title="Copy URL"
                      >
                        <Copy className="size-3" />
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {getStatusBadge(session.status)}
                    {insight?.trustEligibility ? (
                      <Badge
                        variant="outline"
                        className={
                          insight.trustEligibility === 'AUTO_STEP_GUARDED'
                            ? 'border-emerald-500/30 text-emerald-500'
                            : insight.trustEligibility ===
                                'ACTION_WITH_CONFIRMATION'
                              ? 'border-blue-500/30 text-blue-500'
                              : ''
                        }
                      >
                        {insight.trustEligibility}
                      </Badge>
                    ) : null}
                    {insight?.reviewStatus ? (
                      <Badge variant="outline">{insight.reviewStatus}</Badge>
                    ) : null}
                    <span
                      role="button"
                      tabIndex={0}
                      className="inline-flex h-6 items-center rounded-md px-2 text-[11px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      onClick={event => {
                        event.stopPropagation();
                        focusHostname(session.hostname);
                      }}
                      onKeyDown={event => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          event.stopPropagation();
                          focusHostname(session.hostname);
                        }
                      }}
                    >
                      Focus
                    </span>
                  </div>
                </button>

                {/* Stats bar — shown for ALL sessions */}
                <div className="px-3 pb-3 space-y-2">
                  {(session.status === 'running' ||
                    session.status === 'pending') && (
                    <Progress value={session.progress} className="h-2" />
                  )}
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span className="font-mono">
                      {session.completedSteps}/{session.totalSteps} steps
                      {session.status === 'running' &&
                        ` · ${Math.floor(session.progress)}%`}
                    </span>
                    <span>{session.observationsCreated} observations</span>
                    <span>{session.rulesPromoted} rules</span>
                    {(session.atsSystemName || detectAts(session.hostname)) && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-violet-500/30 text-violet-400"
                      >
                        {session.atsSystemName || detectAts(session.hostname)}
                      </Badge>
                    )}
                    {insight?.flowVersion ? (
                      <Badge variant="outline" className="text-[10px]">
                        Flow v{insight.flowVersion}
                        {typeof insight.flowConfidence === 'number'
                          ? ` · ${Math.round(insight.flowConfidence * 100)}%`
                          : ''}
                      </Badge>
                    ) : null}
                    {insight?.flowStepCount ? (
                      <span>{insight.flowStepCount} compiled steps</span>
                    ) : null}
                    {typeof insight?.enabledRuleCount === 'number' ? (
                      <span>{insight.enabledRuleCount} enabled rules</span>
                    ) : null}
                    {session.startedAt && (
                      <span>
                        {(() => {
                          const end = session.completedAt
                            ? new Date(session.completedAt).getTime()
                            : Date.now();
                          const elapsed =
                            end - new Date(session.startedAt).getTime();
                          const mins = Math.floor(elapsed / 60000);
                          const secs = Math.floor((elapsed % 60000) / 1000);
                          return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
                        })()}
                      </span>
                    )}
                    <span>
                      {formatRelativeTime(
                        session.completedAt ?? session.startedAt,
                      ) ?? ''}
                    </span>
                    {session.completedSteps > 0 && session.startedAt && (
                      <span className="font-mono">
                        {(() => {
                          const end = session.completedAt
                            ? new Date(session.completedAt).getTime()
                            : Date.now();
                          return (
                            (end - new Date(session.startedAt).getTime()) /
                            1000 /
                            session.completedSteps
                          ).toFixed(1);
                        })()}
                        s/step
                      </span>
                    )}
                  </div>
                  {insight?.trustReason ? (
                    <div className="px-3 pb-3 text-xs text-muted-foreground">
                      {insight.reviewReason ?? insight.trustReason}
                    </div>
                  ) : null}
                </div>

                {/* Failure message + retry */}
                {session.status === 'failed' && (
                  <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/5 p-2.5">
                    <XCircle className="size-4 shrink-0 text-red-500" />
                    <p className="flex-1 text-xs text-red-400 truncate">
                      {session.error || 'Training session failed'}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="shrink-0 h-7 text-xs gap-1.5"
                      disabled={retryingIds.has(session.id)}
                      onClick={e => {
                        e.stopPropagation();
                        retrySession(session);
                      }}
                    >
                      {retryingIds.has(session.id) ? (
                        <Loader2 className="size-3 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3" />
                      )}
                      Retry
                    </Button>
                  </div>
                )}
                </div>
              );
            })}
          </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Floating session status panel */}
      {(() => {
        const activeSessions = sessions.filter(
          s => s.status === 'running' || s.status === 'pending',
        );
        const recentCompleted = sessions.filter(
          s =>
            s.status === 'completed' &&
            s.completedAt &&
            Date.now() - new Date(s.completedAt).getTime() < 30000,
        );
        const recentFailed = sessions.filter(
          s =>
            s.status === 'failed' &&
            s.completedAt &&
            Date.now() - new Date(s.completedAt).getTime() < 30000,
        );
        const visible = [
          ...activeSessions,
          ...recentCompleted,
          ...recentFailed,
        ];
        if (visible.length === 0) return null;
        return (
          <div className="fixed bottom-4 left-4 z-50 w-72 space-y-1.5 rounded-xl border border-white/[0.06] bg-black/80 p-3 shadow-2xl backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Sessions ({visible.length})
            </p>
            {visible.slice(0, 5).map(s => (
              <div
                key={s.id}
                className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2"
              >
                {s.status === 'running' ? (
                  <Loader2 className="size-3 shrink-0 animate-spin text-blue-400" />
                ) : s.status === 'pending' ? (
                  <div className="size-3 shrink-0 rounded-full border-2 border-muted-foreground/40" />
                ) : s.status === 'completed' ? (
                  <CheckCircle2 className="size-3 shrink-0 text-green-500" />
                ) : (
                  <XCircle className="size-3 shrink-0 text-red-500" />
                )}
                <span className="flex-1 truncate text-xs font-medium">
                  {s.hostname}
                </span>
                {(s.status === 'running' || s.status === 'pending') && (
                  <span className="shrink-0 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {s.completedSteps}/{s.totalSteps}
                  </span>
                )}
                {s.status === 'running' && (
                  <div className="h-1 w-12 shrink-0 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-500"
                      style={{ width: `${Math.floor(s.progress)}%` }}
                    />
                  </div>
                )}
              </div>
            ))}
            {visible.length > 5 && (
              <p className="text-center text-[10px] text-muted-foreground">
                +{visible.length - 5} more
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}
