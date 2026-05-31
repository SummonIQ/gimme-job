'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable';
import { Switch } from '@/components/ui/switch';
import { useChannel } from '@/hooks/use-channel';
import { useEvent } from '@/hooks/use-event';
import { useToast } from '@/hooks/use-toast';
import { getPrivateUserChannel } from '@/lib/events/channels';
import {
  type AssistTrainingProgressPayload,
  DataEventType,
  EventType,
} from '@/types/events';
import {
  ArrowLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  XCircle,
} from 'lucide-react';
import { EmbeddedPageViewer } from '@/components/assist-training/embedded-page-viewer';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface HostnameInsight {
  completedSessionCount: number;
  enabledRuleCount: number;
  failedSessionCount: number;
  flowCompiledFromRuleCount: number | null;
  flowConfidence: number | null;
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

interface Observation {
  id: string;
  stepIndex: number;
  selector: string;
  stableSelector: string | null;
  tagName: string;
  inputType: string | null;
  fieldName: string | null;
  fieldLabel: string | null;
  fieldDisplayName: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
  autocomplete: string | null;
  role: string | null;
  action: string;
  actionType: string;
  aiReason: string | null;
  valueFilled: string | null;
  success: boolean;
  hostname: string;
  maxLength: number | null;
  minLength: number | null;
  pattern: string | null;
  inputMode: string | null;
  observationCount: number;
  fieldConstraints: Record<string, unknown> | null;
}

interface Rule {
  id: string;
  hostname: string;
  action: string;
  actionType: string;
  stableSelector: string;
  tagName: string;
  fieldName: string | null;
  fieldLabel: string | null;
  ariaLabel: string | null;
  stepIndex: number;
  reason: string | null;
  observationCount: number;
  confidence: number;
  enabled: boolean;
  createdAt: string;
}

interface ActiveFlowStep {
  averageConfidence: number;
  enabledRuleCount: number;
  labels: string[];
  metadata: unknown;
  primarySelector: string | null;
  selectors: string[];
  stepIndex: number;
  stepLabel: string | null;
}

interface ActiveFlow {
  compiledFromRuleCount: number;
  confidence: number;
  createdAt: string;
  id: string;
  lastCompiledAt: string;
  metadata: unknown;
  status: string;
  steps: ActiveFlowStep[];
  updatedAt: string;
  version: number;
}

interface RelatedTrainingSession {
  completedAt: string | null;
  id: string;
  observationsCreated: number;
  progress: number;
  rulesPromoted: number;
  startedAt: string;
  status: string;
  targetUrl: string;
}

interface SessionDetailClientProps {
  activeFlow: ActiveFlow | null;
  hostnameInsight: HostnameInsight;
  session: TrainingSession;
  observations: Observation[];
  relatedSessions: RelatedTrainingSession[];
  rules: Rule[];
  userId: string;
}

type Tab = 'steps' | 'actions' | 'observations' | 'rules';

function formatDuration(startedAt: string, completedAt: string | null): string {
  if (!completedAt) return '—';
  const ms = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

const LABEL_OVERRIDES: Record<string, string> = {
  suggest_only: 'Suggest only',
  action_with_confirmation: 'Confirm each action',
  auto_step_guarded: 'Auto (guarded)',
  auto_step: 'Auto',
  ready: 'Ready',
  pending: 'Pending',
  unavailable: 'Unavailable',
  stable: 'Stable',
  drifting: 'Drifting',
  needed: 'Needed',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
};

function humanizeLabel(value: string | null | undefined): string {
  if (!value) return '—';
  const trimmed = value.trim();
  if (!trimmed) return '—';
  const key = trimmed.toLowerCase().replace(/\s+/g, '_');
  if (LABEL_OVERRIDES[key]) return LABEL_OVERRIDES[key];
  return trimmed
    .replace(/[_-]+/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, char => char.toUpperCase());
}

function formatRetrainingLabel(
  needed: boolean,
  priority: string | null | undefined,
): string {
  if (!needed) return humanizeLabel('stable');
  if (priority && priority !== 'needed') {
    return `Retraining (${priority.toLowerCase()})`;
  }
  return 'Retraining needed';
}

function normalizeStepText(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

function getObservationDisplayName(observation: Observation): string {
  return (
    observation.fieldDisplayName ||
    observation.fieldLabel ||
    observation.fieldName ||
    observation.ariaLabel ||
    observation.tagName
  );
}

export function SessionDetailClient({
  activeFlow,
  hostnameInsight: initialHostnameInsight,
  relatedSessions,
  session: initialSession,
  observations: initialObservations,
  rules: initialRules,
  userId,
}: SessionDetailClientProps) {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(0);
  const [session, setSession] = useState<TrainingSession>(initialSession);
  const [hostnameInsight, setHostnameInsight] = useState<HostnameInsight>(
    initialHostnameInsight,
  );
  const [rules, setRules] = useState<Rule[]>(initialRules);
  const lastRealtimeUpdateRef = useRef(Date.now());

  // Sync fresh props into state whenever the server re-renders (router.refresh
  // or navigation). Without this, useState snapshots the first value and
  // subsequent data from router.refresh() would never reach the UI.
  useEffect(() => {
    setSession(initialSession);
  }, [initialSession]);
  useEffect(() => {
    setHostnameInsight(initialHostnameInsight);
  }, [initialHostnameInsight]);
  useEffect(() => {
    setRules(initialRules);
  }, [initialRules]);

  // ── Real-time updates via Pusher ──────────────────────
  const channelName = getPrivateUserChannel(userId);
  const channel = useChannel(channelName);

  const handleTrainingProgress = useCallback(
    (data?: { data?: AssistTrainingProgressPayload; type?: string }) => {
      if (!data || data.type !== DataEventType.ASSIST_TRAINING_PROGRESS) return;
      const payload = data.data;
      if (!payload || payload.sessionId !== session.id) return;
      lastRealtimeUpdateRef.current = Date.now();

      setSession(prev => ({
        ...prev,
        status: payload.status,
        completedSteps: payload.completedSteps,
        totalSteps: payload.totalSteps,
        progress: payload.progress,
        observationsCreated: payload.observationsCreated,
        rulesPromoted: payload.rulesPromoted,
        error: payload.error ?? null,
        completedAt: payload.completedAt ?? null,
        stepLogs: payload.stepLogs ?? prev.stepLogs,
      }));

      if (payload.hostnameInsight) {
        setHostnameInsight(payload.hostnameInsight);
      }
    },
    [session.id],
  );

  useEvent(channel, EventType.DataUpdate, handleTrainingProgress);

  // Auto-refresh duration while running
  const [, setTick] = useState(0);
  useEffect(() => {
    if (session.status !== 'running' && session.status !== 'pending') return;
    const interval = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(interval);
  }, [session.status]);

  useEffect(() => {
    if (session.status !== 'running' && session.status !== 'pending') {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (Date.now() - lastRealtimeUpdateRef.current > 6000) {
        router.refresh();
      }
    }, 4000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [router, session.status]);
  // Client-driven training loop. When the embedded view loads HTML, we
  // send it to the analyze-step endpoint. If the analysis finds a next
  // link (apply, continue, etc.), we fetch THAT page and repeat. Stops
  // when a submit button is detected or no more pages to follow.
  const analyzingRef = useRef(false);
  const [trainingLog, setTrainingLog] = useState<string[]>([]);

  const analyzeStep = useCallback(
    async (html: string, pageUrl: string, stepIndex: number): Promise<{
      nextUrl?: string;
      isComplete?: boolean;
      fieldsDetected?: number;
    } | null> => {
      try {
        setTrainingLog(prev => [
          ...prev,
          `Step ${stepIndex}: Analyzing ${new URL(pageUrl).pathname}...`,
        ]);

        const res = await fetch(
          `/api/assist-training/${session.id}/analyze-step`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ html, url: pageUrl, stepIndex }),
          },
        );

        if (!res.ok) {
          setTrainingLog(prev => [...prev, `Step ${stepIndex}: Analysis failed (${res.status})`]);
          return null;
        }

        const data = await res.json();
        router.refresh();

        const fieldsDetected = data.fieldsDetected ?? 0;
        const buttonsDetected = data.buttonsDetected ?? 0;
        setTrainingLog(prev => [
          ...prev,
          `Step ${stepIndex}: ${data.pageType} — ${fieldsDetected} fields, ${buttonsDetected} buttons, ${data.observationsCreated ?? 0} observations`,
        ]);

        // Check if we found a submit/apply button (terminal state)
        const buttons = (data.buttons ?? []) as Array<{ label: string; selector: string }>;
        const hasSubmitButton = buttons.some(b =>
          /\b(submit|apply\s*(now)?|send\s*application)\b/i.test(b.label),
        );
        if (hasSubmitButton) {
          setTrainingLog(prev => [...prev, `Step ${stepIndex}: Found submit button — training complete.`]);
          return { isComplete: true, fieldsDetected };
        }

        // Check for a next URL to follow (from buttons or AI nextAction)
        if (data.buttons?.length > 0) {
          // Look for apply/continue links
          for (const btn of data.buttons) {
            if (/\b(apply|continue|next)\b/i.test(btn.label)) {
              // Try to find the href in the HTML
              const hrefMatch = html.match(
                new RegExp(`href\\s*=\\s*["']([^"']*?)["'][^>]*>[^<]*${btn.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i'),
              );
              if (hrefMatch?.[1]) {
                try {
                  const nextUrl = new URL(hrefMatch[1], pageUrl).toString();
                  return { nextUrl, fieldsDetected };
                } catch {
                  // Invalid URL
                }
              }
            }
          }
        }

        return { fieldsDetected };
      } catch (err) {
        setTrainingLog(prev => [
          ...prev,
          `Step ${stepIndex}: Error — ${err instanceof Error ? err.message : String(err)}`,
        ]);
        return null;
      }
    },
    [session.id, router],
  );

  const handleEmbeddedHtmlLoaded = useCallback(
    async (html: string, pageUrl: string) => {
      if (session.status !== 'running' && session.status !== 'pending') return;
      if (analyzingRef.current) return;
      analyzingRef.current = true;

      try {
        let currentUrl = pageUrl;
        let currentHtml = html;
        const maxSteps = session.totalSteps || 15;
        const visited = new Set<string>();

        for (let step = 0; step < maxSteps; step++) {
          if (visited.has(currentUrl)) {
            setTrainingLog(prev => [...prev, `Already visited ${currentUrl}, stopping.`]);
            break;
          }
          visited.add(currentUrl);

          const result = await analyzeStep(currentHtml, currentUrl, step);
          if (!result) break;
          if (result.isComplete) break;

          // If there's a next URL, fetch it and continue
          if (result.nextUrl && result.nextUrl !== currentUrl) {
            setTrainingLog(prev => [...prev, `Following link to ${new URL(result.nextUrl!).pathname}...`]);
            try {
              const params = new URLSearchParams({ url: result.nextUrl, render: '1' });
              const nextRes = await fetch(`/api/assist-mode?${params}`);
              if (nextRes.ok) {
                const nextData = await nextRes.json();
                if (nextData.html) {
                  currentUrl = result.nextUrl;
                  currentHtml = nextData.html;
                  continue;
                }
              }
            } catch {
              setTrainingLog(prev => [...prev, `Failed to fetch next page.`]);
            }
          }

          // No next URL — we're done
          break;
        }

        setTrainingLog(prev => [...prev, 'Training loop finished.']);
        router.refresh();
      } finally {
        analyzingRef.current = false;
      }
    },
    [session.id, session.status, session.totalSteps, analyzeStep, router],
  );

  const { toast } = useToast();
  const [isRerunning, setIsRerunning] = useState(false);

  const rerunTraining = useCallback(async () => {
    setIsRerunning(true);
    try {
      const res = await fetch('/api/assist-training', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          urls: [session.targetUrl],
          dryRun: false,
          maxStepsPerUrl: session.totalSteps,
          maxDurationMin: 5,
          captureScreenshots: true,
        }),
      });
      if (!res.ok) throw new Error('Failed to start training');
      const result = await res.json();
      const newSession = result.sessions?.[0];
      if (newSession?.id) {
        router.push(`/admin/assist-training/${newSession.id}` as never);
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to re-run',
        variant: 'destructive',
      });
      setIsRerunning(false);
    }
  }, [router, session.targetUrl, session.totalSteps, toast]);

  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [reviewAction, setReviewAction] = useState<string | null>(null);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('steps');

  const logs = session.stepLogs;
  const log = logs[currentStep] as Record<string, unknown> | undefined;
  const actions = useMemo(
    () => ((log?.actionsPerformed as Array<Record<string, unknown>>) ?? []),
    [log],
  );
  const screenshot = log?.screenshotBase64 as string | undefined;
  const stepSelectors = useMemo(() => {
    const selectors = new Set<string>();

    for (const action of actions) {
      const selector =
        typeof action.selector === 'string' ? action.selector.trim() : '';
      if (selector) {
        selectors.add(selector);
      }
    }

    const activeFlowStep = activeFlow?.steps.find(
      step => step.stepIndex === currentStep,
    );
    for (const selector of activeFlowStep?.selectors ?? []) {
      const trimmed = selector.trim();
      if (trimmed) {
        selectors.add(trimmed);
      }
    }
    if (activeFlowStep?.primarySelector?.trim()) {
      selectors.add(activeFlowStep.primarySelector.trim());
    }

    return selectors;
  }, [actions, activeFlow?.steps, currentStep]);
  const stepLabels = useMemo(() => {
    const labels = new Set<string>();

    for (const action of actions) {
      const label =
        typeof action.label === 'string' ? normalizeStepText(action.label) : '';
      if (label) {
        labels.add(label);
      }
    }

    const activeFlowStep = activeFlow?.steps.find(
      step => step.stepIndex === currentStep,
    );
    for (const label of activeFlowStep?.labels ?? []) {
      const normalized = normalizeStepText(label);
      if (normalized) {
        labels.add(normalized);
      }
    }
    const stepLabel = normalizeStepText(activeFlowStep?.stepLabel);
    if (stepLabel) {
      labels.add(stepLabel);
    }

    return labels;
  }, [actions, activeFlow?.steps, currentStep]);
  const stepObservations = useMemo(() => {
    const matchesSelector = (observation: Observation): boolean => {
      if (stepSelectors.size === 0) {
        return false;
      }

      return stepSelectors.has(observation.selector)
        || (observation.stableSelector
          ? stepSelectors.has(observation.stableSelector)
          : false);
    };

    const matchesLabel = (observation: Observation): boolean => {
      if (stepLabels.size === 0) {
        return false;
      }

      return stepLabels.has(normalizeStepText(getObservationDisplayName(observation)));
    };

    const exactStepMatches = initialObservations.filter(
      observation => observation.stepIndex === currentStep,
    );
    const selectorMatches = initialObservations.filter(matchesSelector);
    const labelMatches = initialObservations.filter(matchesLabel);
    const mergedMatches = [
      ...exactStepMatches,
      ...selectorMatches,
      ...labelMatches,
    ];

    const uniqueMatches = mergedMatches.filter(
      (observation, index, array) =>
        array.findIndex(candidate => candidate.id === observation.id) === index,
    );

    return uniqueMatches.length > 0 ? uniqueMatches : exactStepMatches;
  }, [currentStep, initialObservations, stepLabels, stepSelectors]);
  const stepRules = useMemo(() => {
    const matchesLabel = (rule: Rule): boolean => {
      if (stepLabels.size === 0) {
        return false;
      }

      return stepLabels.has(
        normalizeStepText(
          rule.fieldLabel || rule.fieldName || rule.ariaLabel || rule.tagName,
        ),
      );
    };

    const matchesSelector = (rule: Rule): boolean =>
      stepSelectors.size > 0 && stepSelectors.has(rule.stableSelector);

    const exactStepMatches = rules.filter(rule => rule.stepIndex === currentStep);
    const selectorMatches = rules.filter(matchesSelector);
    const labelMatches = rules.filter(matchesLabel);
    const mergedMatches = [
      ...exactStepMatches,
      ...selectorMatches,
      ...labelMatches,
    ];

    const uniqueMatches = mergedMatches.filter(
      (rule, index, array) =>
        array.findIndex(candidate => candidate.id === rule.id) === index,
    );

    return uniqueMatches.length > 0 ? uniqueMatches : exactStepMatches;
  }, [currentStep, rules, stepLabels, stepSelectors]);
  const successfulObservations = initialObservations.filter(
    observation => observation.success,
  ).length;
  const failedObservations = initialObservations.length - successfulObservations;
  const uniqueSelectors = new Set(
    initialObservations
      .map(observation => observation.stableSelector ?? observation.selector)
      .filter(Boolean),
  ).size;
  const uniqueFieldLabels = new Set(
    initialObservations
      .map(
        observation =>
          observation.fieldDisplayName ??
          observation.fieldLabel ??
          observation.fieldName ??
          observation.ariaLabel,
      )
      .filter(Boolean),
  ).size;
  const flowMetadata =
    activeFlow?.metadata && typeof activeFlow.metadata === 'object'
      ? (activeFlow.metadata as Record<string, unknown>)
      : null;
  const confirmationEvents =
    flowMetadata && typeof flowMetadata.confirmationEvents === 'number'
      ? flowMetadata.confirmationEvents
      : 0;
  const submitBlockedEvents =
    flowMetadata && typeof flowMetadata.submitBlockedEvents === 'number'
      ? flowMetadata.submitBlockedEvents
      : 0;
  const recentHostnameRuns = relatedSessions.filter(
    relatedSession => relatedSession.id !== session.id,
  );
  const hostnameSuccessCount = relatedSessions.filter(
    relatedSession => relatedSession.status === 'completed',
  ).length;
  const hostnameFailureCount = relatedSessions.filter(
    relatedSession => relatedSession.status === 'failed',
  ).length;
  const enabledRules = useMemo(
    () => rules.filter(rule => rule.enabled).length,
    [rules],
  );

  const toggleRule = useCallback(
    async (ruleId: string, enabled: boolean) => {
      setTogglingRule(ruleId);
      try {
        const res = await fetch(`/api/assist-training/${session.id}`, {
          body: JSON.stringify({ action: 'set-rule-state', enabled, ruleId }),
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
        });
        if (res.ok) {
          setRules(prev => prev.map(r => (r.id === ruleId ? { ...r, enabled } : r)));
          toast({ title: enabled ? 'Rule approved' : 'Rule rejected' });
        }
      } catch {
        /* ignore */
      }
      setTogglingRule(null);
    },
    [session.id, toast],
  );

  const runBulkTrainingAction = useCallback(
    async (
      action: 'disable-rules' | 'enable-rules' | 'recompile-flow',
    ): Promise<void> => {
      setBulkAction(action);
      try {
        const response = await fetch(`/api/assist-training/${session.id}`, {
          body: JSON.stringify(
            action === 'recompile-flow'
              ? { action: 'recompile-flow' }
              : {
                  action: 'set-hostname-rules',
                  enabled: action === 'enable-rules',
                },
          ),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        });

        if (!response.ok) {
          throw new Error('Bulk training action failed');
        }

        if (action === 'enable-rules' || action === 'disable-rules') {
          const enabled = action === 'enable-rules';
          setRules(prev => prev.map(rule => ({ ...rule, enabled })));
        }

        toast({
          description:
            action === 'recompile-flow'
              ? `Recompiled learned flow for ${session.hostname}.`
              : `${
                  action === 'enable-rules' ? 'Enabled' : 'Disabled'
                } learned rules for ${session.hostname}.`,
          title:
            action === 'recompile-flow'
              ? 'Flow updated'
              : action === 'enable-rules'
                ? 'Rules enabled'
                : 'Rules disabled',
        });
      } catch {
        toast({
          description: 'Failed to apply training control.',
          title: 'Error',
          variant: 'destructive',
        });
      } finally {
        setBulkAction(null);
      }
    },
    [session.hostname, session.id, toast],
  );

  const setReviewState = useCallback(
    async (reviewStatus: 'approved' | 'hold' | 'needs-more-training') => {
      setReviewAction(reviewStatus);
      try {
        const response = await fetch(`/api/assist-training/${session.id}`, {
          body: JSON.stringify({
            action: 'set-review-state',
            reviewStatus,
          }),
          headers: { 'Content-Type': 'application/json' },
          method: 'PATCH',
        });

        if (!response.ok) {
          throw new Error('Failed to update review state');
        }

        setHostnameInsight(prev => ({
          ...prev,
          reviewReason:
            reviewStatus === 'approved'
              ? 'Hostname approved from assist training.'
              : reviewStatus === 'hold'
                ? 'Hostname held for manual review.'
                : 'Hostname needs more training coverage.',
          reviewStatus,
        }));
        toast({
          description: `${session.hostname} is now marked ${reviewStatus}.`,
          title: 'Training review updated',
        });
      } catch {
        toast({
          description: 'Failed to update training review state.',
          title: 'Error',
          variant: 'destructive',
        });
      } finally {
        setReviewAction(null);
      }
    },
    [session.hostname, session.id, toast],
  );

  const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
    completed: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/20', label: 'Completed' },
    running: { color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20', label: 'Running' },
    failed: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20', label: 'Failed' },
    pending: { color: 'text-muted-foreground', bg: 'bg-muted border-border', label: 'Pending' },
  };
  const sc = statusConfig[session.status] ?? statusConfig.pending;

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: 'steps', label: 'Steps', count: logs.length },
    { key: 'actions', label: 'Actions', count: actions.length },
    { key: 'observations', label: 'Observations', count: stepObservations.length },
    { key: 'rules', label: 'Rules', count: stepRules.length },
  ];

  return (
    <div className="flex h-[calc(100vh-64px)] flex-col">
      {/* Top bar */}
      <div className="flex shrink-0 items-center gap-4 border-b border-border px-6 py-3">
        <Link
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          href={"/admin/assist-training" as any}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-4" />
          Training
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <p className="truncate font-medium">{session.hostname}</p>
          <Badge variant="outline" className={`shrink-0 text-xs ${sc.color} border`}>
            {sc.label}
          </Badge>
          {session.atsSystemName && (
            <Badge variant="outline" className="shrink-0 border-violet-500/30 text-[11px] text-violet-400">
              {session.atsSystemName}
            </Badge>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            onClick={rerunTraining}
            disabled={isRerunning || session.status === 'running' || session.status === 'pending'}
          >
            {isRerunning ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <RefreshCw className="size-3" />
            )}
            Re-run
          </Button>
          <a
            href={session.targetUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors"
          >
            <ExternalLink className="size-3.5" />
            Open URL
          </a>
        </div>
      </div>

      {/* Metrics strip */}
      <div className="flex shrink-0 items-center gap-6 border-b border-white/[0.06] bg-white/[0.03] px-6 py-2.5 backdrop-blur-md">
        {[
          { label: 'Steps', value: `${session.completedSteps} / ${session.totalSteps}` },
          { label: 'Observations', value: session.observationsCreated },
          { label: 'Rules promoted', value: session.rulesPromoted },
          { label: 'Duration', value: formatDuration(session.startedAt, session.completedAt) },
        ].map(m => (
          <div key={m.label} className="flex items-baseline gap-1.5">
            <span className="font-mono text-sm font-semibold">{m.value}</span>
            <span className="text-[11px] text-muted-foreground">{m.label}</span>
          </div>
        ))}
        {(session.status === 'running' || session.status === 'pending') && (
          <div className="ml-auto flex w-40 items-center gap-2">
            <Progress value={session.progress} className="h-1.5 flex-1" />
            <span className="text-[11px] font-mono text-muted-foreground tabular-nums">
              {Math.floor(session.progress)}%
            </span>
          </div>
        )}
        {session.error && (
          <div className="ml-auto flex items-center gap-1.5 text-xs text-red-400">
            <XCircle className="size-3.5 shrink-0" />
            <span className="truncate max-w-xs">{session.error}</span>
          </div>
        )}
      </div>

      <ResizablePanelGroup
        direction="vertical"
        autoSaveId="assist-training-session-detail-vertical"
        className="!h-auto flex-1"
        style={{ minHeight: 0 }}
      >
        <ResizablePanel defaultSize={38} minSize={15} className="overflow-hidden">
      <div className="h-full overflow-y-auto border-b border-border px-6 py-4">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-border/60 bg-background p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Training Impact
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Observations succeeded</span>
              <span className="font-mono text-sm font-semibold">
                {successfulObservations}/{initialObservations.length}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Failed observations</span>
              <span className="font-mono text-sm font-semibold">
                {failedObservations}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Unique selectors</span>
              <span className="font-mono text-sm font-semibold">
                {uniqueSelectors}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Unique fields</span>
              <span className="font-mono text-sm font-semibold">
                {uniqueFieldLabels}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Hostname Learning State
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Enabled rules</span>
              <span className="font-mono text-sm font-semibold">
                {hostnameInsight.enabledRuleCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Compiled flow</span>
              <span className="font-mono text-sm font-semibold">
                {hostnameInsight.flowVersion
                  ? `v${hostnameInsight.flowVersion}`
                  : 'None'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Flow steps</span>
              <span className="font-mono text-sm font-semibold">
                {hostnameInsight.flowStepCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Trust mode</span>
              <Badge variant="outline" className="text-[10px]">
                {humanizeLabel(hostnameInsight.trustEligibility) !== '—'
                  ? humanizeLabel(hostnameInsight.trustEligibility)
                  : 'Unknown'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Review state</span>
              <Badge variant="outline" className="text-[10px]">
                {humanizeLabel(
                  hostnameInsight.reviewStatus ??
                    (hostnameInsight.reviewReady ? 'ready' : 'pending'),
                )}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">
                Retraining state
              </span>
              <Badge
                variant="outline"
                className={
                  hostnameInsight.retrainingNeeded
                    ? hostnameInsight.retrainingPriority === 'high'
                      ? 'border-amber-500/30 text-[10px] text-amber-500'
                      : hostnameInsight.retrainingPriority === 'medium'
                        ? 'border-yellow-500/30 text-[10px] text-yellow-500'
                        : 'text-[10px]'
                    : 'text-[10px]'
                }
              >
                {formatRetrainingLabel(
                  hostnameInsight.retrainingNeeded,
                  hostnameInsight.retrainingPriority,
                )}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Last success</span>
              <span className="text-xs text-muted-foreground">
                {hostnameInsight.lastCompletedAt
                  ? new Date(hostnameInsight.lastCompletedAt).toLocaleString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Last failure</span>
              <span className="text-xs text-muted-foreground">
                {hostnameInsight.lastFailedAt
                  ? new Date(hostnameInsight.lastFailedAt).toLocaleString()
                  : '—'}
              </span>
            </div>
            {hostnameInsight.trustReason && (
              <p className="pt-1 text-xs text-muted-foreground">
                {hostnameInsight.reviewReason ?? hostnameInsight.trustReason}
              </p>
            )}
            {hostnameInsight.retrainingReason ? (
              <p className="text-xs text-muted-foreground/80">
                {hostnameInsight.retrainingReason}
              </p>
            ) : null}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Active Flow
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Status</span>
              <Badge variant="outline" className="text-[10px]">
                {activeFlow ? humanizeLabel(activeFlow.status) : 'Unavailable'}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <span className="font-mono text-sm font-semibold">
                {activeFlow ? `${Math.round(activeFlow.confidence * 100)}%` : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Compiled from rules</span>
              <span className="font-mono text-sm font-semibold">
                {activeFlow?.compiledFromRuleCount ?? 0}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Last compiled</span>
              <span className="text-xs text-muted-foreground">
                {activeFlow
                  ? new Date(activeFlow.lastCompiledAt).toLocaleString()
                  : '—'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Flow health</span>
              <Badge
                variant="outline"
                className={
                  hostnameInsight.retrainingNeeded
                    ? hostnameInsight.retrainingPriority === 'high'
                      ? 'border-amber-500/30 text-[10px] text-amber-500'
                      : hostnameInsight.retrainingPriority === 'medium'
                        ? 'border-yellow-500/30 text-[10px] text-yellow-500'
                        : 'text-[10px]'
                    : 'text-[10px]'
                }
              >
                {humanizeLabel(
                  hostnameInsight.retrainingNeeded ? 'drifting' : 'stable',
                )}
              </Badge>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-background p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Signal Memory
          </p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Confirmations</span>
              <span className="font-mono text-sm font-semibold">
                {confirmationEvents}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Submit blocked</span>
              <span className="font-mono text-sm font-semibold">
                {submitBlockedEvents}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Hostname completed</span>
              <span className="font-mono text-sm font-semibold">
                {hostnameSuccessCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted-foreground">Hostname failed</span>
              <span className="font-mono text-sm font-semibold">
                {hostnameFailureCount}
              </span>
            </div>
          </div>
        </div>
        </div>
      </div>

        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Body: left panel + browser */}
        <ResizablePanel defaultSize={62} minSize={30}>
      <ResizablePanelGroup
        direction="horizontal"
        autoSaveId="assist-training-session-detail"
        className="min-h-0 h-full"
      >
        {/* Left panel — tabs + content */}
        <ResizablePanel
          defaultSize={28}
          minSize={18}
          maxSize={60}
          className="flex flex-col overflow-hidden border-r border-border"
        >
          {/* Tabs */}
          <div className="shrink-0 border-b border-border px-2 py-1.5">
            <div className="flex gap-0.5 rounded-lg bg-muted/30 p-0.5">
              {tabs.map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[10px] font-medium transition-colors ${
                    activeTab === tab.key
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span className={`rounded-full px-1 py-px font-mono text-[8px] ${
                      activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">
            {/* Steps tab */}
            {activeTab === 'steps' && (
              <div className="space-y-0.5 px-2 py-2">
                {logs.length === 0 && (
                  trainingLog.length > 0 ? (
                    <div className="space-y-1 px-2 py-2">
                      {trainingLog.map((line, i) => (
                        <p key={i} className="text-[11px] text-muted-foreground font-mono">
                          {line}
                        </p>
                      ))}
                    </div>
                  ) : (
                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">No steps yet</p>
                  )
                )}
                {logs.map((l, idx) => {
                  const a = (l.actionsPerformed as Array<Record<string, unknown>>) ?? [];
                  const fields = (l.fieldsDetected as number) ?? 0;
                  const isActive = idx === currentStep;
                  const stepTime = l.timestamp as string | undefined;
                  const nextTime = logs[idx + 1]?.timestamp as string | undefined;
                  const durationSec =
                    stepTime && nextTime
                      ? Math.round((new Date(nextTime).getTime() - new Date(stepTime).getTime()) / 1000)
                      : stepTime && idx === logs.length - 1 && session.completedAt
                        ? Math.round((new Date(session.completedAt).getTime() - new Date(stepTime).getTime()) / 1000)
                        : null;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                      onClick={() => setCurrentStep(idx)}
                    >
                      <span className="w-4 shrink-0 text-right font-mono text-[10px] tabular-nums opacity-60">
                        {idx + 1}
                      </span>
                      {l.error ? (
                        <XCircle className="size-3 shrink-0 text-red-500" />
                      ) : (
                        <CheckCircle2 className="size-3 shrink-0 text-green-500" />
                      )}
                      <span className="flex-1 truncate">{String(l.pageType ?? 'page')}</span>
                      <span className="shrink-0 text-[9px] tabular-nums opacity-50">
                        {fields > 0 ? `${fields} fields` : a.length > 0 ? `${a.length} actions` : ''}
                        {durationSec !== null && durationSec > 0 ? ` · ${durationSec}s` : ''}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Actions tab */}
            {activeTab === 'actions' && (
              <div className="space-y-2 p-3">
                {actions.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No actions recorded</p>
                ) : (
                  actions.map((action, i) => {
                    const rawValue = action.value;
                    const hasValue =
                      rawValue !== undefined &&
                      rawValue !== null &&
                      String(rawValue).length > 0;
                    const displayValue = hasValue ? String(rawValue) : null;
                    const isDryRun = displayValue?.startsWith('[dry-run] ');
                    const cleanValue = isDryRun
                      ? displayValue!.replace(/^\[dry-run\]\s*/, '')
                      : displayValue;
                    return (
                      <div
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-border/60 bg-background p-3"
                      >
                        <div className="mt-0.5 shrink-0">
                          {action.success ? (
                            <CheckCircle2 className="size-3.5 text-green-500" />
                          ) : (
                            <XCircle className="size-3.5 text-red-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Badge
                              variant="secondary"
                              className="px-1.5 py-0 font-mono text-[9px]"
                            >
                              {String(action.actionType ?? action.action ?? '?')}
                            </Badge>
                            <span className="text-xs font-medium">
                              {String(action.label ?? '')}
                            </span>
                            {action.confidence != null && (
                              <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                                {Math.round(Number(action.confidence) * 100)}%
                              </span>
                            )}
                          </div>
                          {cleanValue ? (
                            <div className="inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                              <span className="text-[9px] uppercase tracking-wide text-emerald-500/60">
                                value
                              </span>
                              <span className="truncate text-[11px] font-medium text-emerald-400">
                                {cleanValue}
                              </span>
                              {isDryRun ? (
                                <span className="text-[8px] font-mono text-emerald-500/50">
                                  dry-run
                                </span>
                              ) : null}
                            </div>
                          ) : null}
                          {Boolean(action.selector) && (
                            <p className="truncate font-mono text-[9px] text-muted-foreground/40">
                              {String(action.selector)}
                            </p>
                          )}
                          {Boolean(action.reason) && (
                            <p className="text-[11px] italic text-muted-foreground">
                              {String(action.reason)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Observations tab */}
            {activeTab === 'observations' && (
              <div className="space-y-2 p-3">
                {stepObservations.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No observations</p>
                ) : (
                  stepObservations.map(obs => {
                    const displayName =
                      obs.fieldDisplayName ||
                      obs.fieldLabel ||
                      obs.fieldName ||
                      obs.ariaLabel ||
                      obs.tagName;
                    const constraints = obs.fieldConstraints as
                      | Record<string, unknown>
                      | null
                      | undefined;
                    const constraintEntries = constraints
                      ? Object.entries(constraints).filter(
                          ([, value]) =>
                            value !== null &&
                            value !== undefined &&
                            value !== '',
                        )
                      : [];
                    return (
                      <div
                        key={obs.id}
                        className="space-y-2 rounded-lg border border-border/60 bg-background p-3"
                      >
                        <div className="flex items-center gap-1.5">
                          {obs.success ? (
                            <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />
                          ) : (
                            <XCircle className="size-3.5 shrink-0 text-red-500" />
                          )}
                          <Badge
                            variant="secondary"
                            className="px-1.5 py-0 font-mono text-[9px]"
                          >
                            {obs.actionType}
                          </Badge>
                          <span className="truncate text-xs font-medium">
                            {displayName}
                          </span>
                          {obs.observationCount > 1 ? (
                            <span className="ml-auto font-mono text-[9px] text-muted-foreground">
                              ×{obs.observationCount}
                            </span>
                          ) : null}
                        </div>
                        {obs.valueFilled ? (
                          <div className="ml-5 inline-flex max-w-full items-center gap-1 rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-1">
                            <span className="text-[9px] uppercase tracking-wide text-emerald-500/60">
                              value
                            </span>
                            <span className="truncate text-[11px] font-medium text-emerald-400">
                              {obs.valueFilled}
                            </span>
                          </div>
                        ) : null}
                        <div className="ml-5 flex flex-wrap gap-1 text-[9px] text-muted-foreground">
                          {obs.tagName ? (
                            <span className="rounded-sm bg-muted/40 px-1 py-[1px] font-mono">
                              &lt;{obs.tagName.toLowerCase()}
                              {obs.inputType ? `:${obs.inputType}` : ''}&gt;
                            </span>
                          ) : null}
                          {obs.fieldName ? (
                            <span className="rounded-sm bg-muted/40 px-1 py-[1px] font-mono">
                              name={obs.fieldName}
                            </span>
                          ) : null}
                          {obs.placeholder ? (
                            <span className="rounded-sm bg-muted/40 px-1 py-[1px]">
                              “{obs.placeholder}”
                            </span>
                          ) : null}
                          {obs.autocomplete ? (
                            <span className="rounded-sm bg-muted/40 px-1 py-[1px] font-mono">
                              ac={obs.autocomplete}
                            </span>
                          ) : null}
                          {obs.maxLength ? (
                            <span className="rounded-sm bg-muted/40 px-1 py-[1px] font-mono">
                              max={obs.maxLength}
                            </span>
                          ) : null}
                          {obs.pattern ? (
                            <span
                              className="rounded-sm bg-muted/40 px-1 py-[1px] font-mono"
                              title={obs.pattern}
                            >
                              pattern
                            </span>
                          ) : null}
                          {obs.inputMode ? (
                            <span className="rounded-sm bg-muted/40 px-1 py-[1px] font-mono">
                              mode={obs.inputMode}
                            </span>
                          ) : null}
                          {obs.role ? (
                            <span className="rounded-sm bg-muted/40 px-1 py-[1px] font-mono">
                              role={obs.role}
                            </span>
                          ) : null}
                        </div>
                        {constraintEntries.length > 0 ? (
                          <div className="ml-5 flex flex-wrap gap-1 text-[9px] text-muted-foreground/70">
                            {constraintEntries.map(([key, value]) => (
                              <span
                                key={key}
                                className="rounded-sm bg-muted/30 px-1 py-[1px] font-mono"
                              >
                                {key}={String(value)}
                              </span>
                            ))}
                          </div>
                        ) : null}
                        {obs.aiReason ? (
                          <p className="ml-5 text-[11px] italic text-muted-foreground">
                            {obs.aiReason}
                          </p>
                        ) : null}
                        {obs.stableSelector ? (
                          <p className="ml-5 truncate font-mono text-[9px] text-muted-foreground/30">
                            {obs.stableSelector}
                          </p>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Rules tab */}
            {activeTab === 'rules' && (
              <div className="space-y-2 p-3">
                {stepRules.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">No rules promoted</p>
                ) : (
                  stepRules.map(rule => (
                    <div key={rule.id} className={`space-y-1.5 rounded-lg border p-3 ${rule.enabled ? 'border-green-500/20 bg-green-500/5' : 'border-border/60 bg-background'}`}>
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="px-1.5 py-0 font-mono text-[9px]">{rule.actionType}</Badge>
                        <span className="flex-1 truncate text-xs font-medium">{rule.fieldLabel || rule.fieldName || rule.ariaLabel || rule.tagName}</span>
                        <span className="font-mono text-[9px] text-muted-foreground">{Math.round(rule.confidence * 100)}%</span>
                      </div>
                      {rule.reason && <p className="text-[11px] italic text-muted-foreground">{rule.reason}</p>}
                      <p className="truncate font-mono text-[9px] text-muted-foreground/30">{rule.stableSelector}</p>
                      <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                        <Switch checked={rule.enabled} onCheckedChange={checked => toggleRule(rule.id, checked)} disabled={togglingRule === rule.id} />
                        <span className={`text-[11px] font-medium ${rule.enabled ? 'text-green-400' : 'text-muted-foreground'}`}>{rule.enabled ? 'Active' : 'Disabled'}</span>
                        {togglingRule === rule.id && <Loader2 className="size-3 animate-spin text-muted-foreground" />}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel — error + browser only */}
        <ResizablePanel defaultSize={72} minSize={30} className="flex flex-col">
          {logs.length === 0 && session.status !== 'running' && session.status !== 'pending' ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
              No step data available
            </div>
          ) : (
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {Boolean(log?.error) && (
                <div className="mx-3 mt-2 flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                  <XCircle className="mt-0.5 size-3.5 shrink-0 text-red-500" />
                  <p className="text-xs text-red-400">{String(log!.error)}</p>
                </div>
              )}
              {log?.screenshotBase64 ? (
                <div className="flex-1 overflow-auto bg-zinc-950/50 p-1">
                  <img
                    src={`data:image/jpeg;base64,${log.screenshotBase64 as string}`}
                    alt={`Step ${log.stepIndex as number} screenshot`}
                    className="mx-auto max-h-full max-w-full rounded-sm object-contain"
                  />
                </div>
              ) : log?.url ? (
                <EmbeddedPageViewer url={String(log.url)} className="flex-1" onHtmlLoaded={handleEmbeddedHtmlLoaded} />
              ) : session.status === 'running' ||
                session.status === 'pending' ? (
                <EmbeddedPageViewer url={session.targetUrl} className="flex-1" onHtmlLoaded={handleEmbeddedHtmlLoaded} />
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                  Select a step to preview
                </div>
              )}
            </div>
          )}
        </ResizablePanel>
      </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
