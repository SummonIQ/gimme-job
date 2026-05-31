'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Loader2,
  XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

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
  fieldName: string | null;
  fieldLabel: string | null;
  fieldDisplayName: string | null;
  ariaLabel: string | null;
  placeholder: string | null;
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

interface SessionDetailModalProps {
  session: TrainingSession | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDuration(startedAt: string, completedAt: string | null): string {
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const elapsed = end - new Date(startedAt).getTime();
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

export function SessionDetailModal({
  session,
  open,
  onOpenChange,
}: SessionDetailModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [detailsLoaded, setDetailsLoaded] = useState(false);
  const [togglingRule, setTogglingRule] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'actions' | 'observations' | 'rules'
  >('actions');
  const { toast } = useToast();

  // Reset state when session changes
  useEffect(() => {
    if (session) {
      setCurrentStep(0);
      setDetailsLoaded(false);
      setObservations([]);
      setRules([]);
      setActiveTab('actions');
    }
  }, [session?.id]);

  // Fetch observations and rules
  useEffect(() => {
    if (!open || !session || detailsLoaded) return;
    (async () => {
      try {
        const res = await fetch(`/api/assist-training/${session.id}`);
        if (!res.ok) return;
        const data = await res.json();
        setObservations(data.observations ?? []);
        setRules(data.rules ?? []);
      } catch {
        /* ignore */
      }
      setDetailsLoaded(true);
    })();
  }, [open, session, detailsLoaded]);

  const toggleRule = useCallback(
    async (ruleId: string, enabled: boolean) => {
      if (!session) return;
      setTogglingRule(ruleId);
      try {
        const res = await fetch(`/api/assist-training/${session.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ruleId, enabled }),
        });
        if (res.ok) {
          setRules(prev =>
            prev.map(r => (r.id === ruleId ? { ...r, enabled } : r)),
          );
          toast({ title: enabled ? 'Rule approved' : 'Rule rejected' });
        }
      } catch {
        /* ignore */
      }
      setTogglingRule(null);
    },
    [session, toast],
  );

  if (!session) return null;

  const logs = session.stepLogs;
  const log = logs[currentStep] as Record<string, unknown> | undefined;
  const actions =
    (log?.actionsPerformed as Array<Record<string, unknown>>) ?? [];
  const screenshot = log?.screenshotBase64 as string | undefined;
  const stepObservations = observations.filter(
    o => o.stepIndex === currentStep,
  );
  const stepRules = rules.filter(r => r.stepIndex === currentStep);

  const statusConfig: Record<string, { color: string; label: string }> = {
    completed: { color: 'text-green-400', label: 'Completed' },
    running: { color: 'text-blue-400', label: 'Running' },
    failed: { color: 'text-red-400', label: 'Failed' },
    pending: { color: 'text-muted-foreground', label: 'Pending' },
  };
  const sc = statusConfig[session.status] ?? statusConfig.pending;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-6xl max-h-[60vh] p-0 gap-0 overflow-hidden">
        <ModalTitle className="sr-only">
          Training Session — {session.hostname}
        </ModalTitle>
        <ModalDescription className="sr-only">
          Details for training session on {session.hostname}
        </ModalDescription>

        <div className="flex h-[55vh]">
          {/* Left sidebar */}
          <div className="flex w-72 shrink-0 flex-col border-r border-border bg-muted/20">
            {/* Session info header */}
            <div className="space-y-3 border-b border-border p-4">
              <div className="flex items-center gap-2">
                {session.status === 'completed' && (
                  <CheckCircle2 className="size-4 text-green-500" />
                )}
                {session.status === 'running' && (
                  <Loader2 className="size-4 animate-spin text-blue-500" />
                )}
                {session.status === 'failed' && (
                  <XCircle className="size-4 text-red-500" />
                )}
                {session.status === 'pending' && (
                  <Clock className="size-4 text-muted-foreground" />
                )}
                <span className={`text-sm font-semibold ${sc.color}`}>
                  {sc.label}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium truncate">
                  {session.hostname}
                </p>
                <a
                  href={session.targetUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary truncate"
                >
                  <span className="truncate">{session.targetUrl}</span>
                  <ExternalLink className="size-2.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </div>

              {/* Key metrics */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md bg-background px-2.5 py-1.5 text-center">
                  <p className="font-mono text-sm font-semibold">
                    {session.completedSteps}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Steps</p>
                </div>
                <div className="rounded-md bg-background px-2.5 py-1.5 text-center">
                  <p className="font-mono text-sm font-semibold">
                    {session.observationsCreated}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Obs</p>
                </div>
                <div className="rounded-md bg-background px-2.5 py-1.5 text-center">
                  <p className="font-mono text-sm font-semibold">
                    {session.rulesPromoted}
                  </p>
                  <p className="text-[9px] text-muted-foreground">Rules</p>
                </div>
              </div>

              {(session.status === 'running' ||
                session.status === 'pending') && (
                <Progress value={session.progress} className="h-1.5" />
              )}

              <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                {session.atsSystemName && (
                  <Badge
                    variant="outline"
                    className="text-[9px] border-violet-500/30 text-violet-400"
                  >
                    {session.atsSystemName}
                  </Badge>
                )}
                <span className="flex items-center gap-1">
                  <Clock className="size-2.5" />
                  {formatDuration(session.startedAt, session.completedAt)}
                </span>
              </div>
            </div>

            {/* Step list */}
            <div className="flex-1 overflow-y-auto">
              <div className="px-3 py-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Steps ({logs.length})
                </p>
              </div>
              <div className="space-y-0.5 px-2 pb-2">
                {logs.map((l, idx) => {
                  const a =
                    (l.actionsPerformed as Array<Record<string, unknown>>) ??
                    [];
                  const isActive = idx === currentStep;
                  return (
                    <button
                      key={idx}
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                      }`}
                      onClick={() => setCurrentStep(idx)}
                    >
                      <span className="shrink-0 w-4 text-right font-mono text-[10px]">
                        {idx + 1}
                      </span>
                      <span className="shrink-0">
                        {l.error ? (
                          <XCircle className="size-3 text-red-500" />
                        ) : (
                          <CheckCircle2 className="size-3 text-green-500" />
                        )}
                      </span>
                      <span className="flex-1 truncate">
                        {String(l.pageType ?? 'unknown')}
                      </span>
                      <span className="shrink-0 font-mono text-[9px] opacity-60">
                        {a.length}a · {String(l.observationsRecorded ?? 0)}o
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right content area */}
          <div className="flex flex-1 flex-col overflow-hidden">
            {logs.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
                No step data available
              </div>
            ) : (
              <>
                {/* Step header bar */}
                <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={currentStep === 0}
                        onClick={() => setCurrentStep(prev => prev - 1)}
                      >
                        <ChevronLeft className="size-4" />
                      </Button>
                      <span className="min-w-[60px] text-center text-xs font-medium">
                        Step {currentStep + 1} / {logs.length}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        disabled={currentStep === logs.length - 1}
                        onClick={() => setCurrentStep(prev => prev + 1)}
                      >
                        <ChevronRight className="size-4" />
                      </Button>
                    </div>

                    {log && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">
                          {String(log.pageType ?? 'unknown')}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {String(log.fieldsDetected ?? 0)} fields
                        </span>
                      </div>
                    )}
                  </div>

                  {Boolean(log?.url) && (
                    <a
                      href={String(log!.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary truncate max-w-[300px]"
                    >
                      <Globe className="size-3 shrink-0" />
                      <span className="truncate">{String(log!.url)}</span>
                    </a>
                  )}
                </div>

                {/* Main content scroll area */}
                <div className="flex-1 overflow-y-auto">
                  <div className="p-4 space-y-4">
                    {/* Screenshot */}
                    {screenshot && (
                      <div className="overflow-hidden rounded-lg border border-border">
                        <img
                          src={
                            screenshot.startsWith('data:')
                              ? screenshot
                              : `data:image/png;base64,${screenshot}`
                          }
                          alt={`Step ${currentStep + 1} screenshot`}
                          className="w-full"
                        />
                      </div>
                    )}

                    {/* Error */}
                    {Boolean(log?.error) && (
                      <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/5 p-3">
                        <XCircle className="size-4 shrink-0 text-red-500 mt-0.5" />
                        <p className="text-sm text-red-400">
                          {String(log!.error)}
                        </p>
                      </div>
                    )}

                    {/* Tab bar */}
                    <div className="flex gap-1 rounded-lg bg-muted/40 p-1">
                      {[
                        {
                          key: 'actions' as const,
                          label: 'Actions',
                          count: actions.length,
                        },
                        {
                          key: 'observations' as const,
                          label: 'Observations',
                          count: stepObservations.length,
                        },
                        {
                          key: 'rules' as const,
                          label: 'Rules',
                          count: stepRules.length,
                        },
                      ].map(tab => (
                        <button
                          key={tab.key}
                          type="button"
                          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                            activeTab === tab.key
                              ? 'bg-background text-foreground shadow-sm'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                          onClick={() => setActiveTab(tab.key)}
                        >
                          {tab.label}
                          {tab.count > 0 && (
                            <span
                              className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-mono ${
                                activeTab === tab.key
                                  ? 'bg-primary/10 text-primary'
                                  : 'bg-muted text-muted-foreground'
                              }`}
                            >
                              {tab.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>

                    {/* Actions tab */}
                    {activeTab === 'actions' && (
                      <div className="space-y-2">
                        {actions.length === 0 && (
                          <p className="py-6 text-center text-xs text-muted-foreground">
                            No actions in this step
                          </p>
                        )}
                        {actions.map((action, i) => (
                          <div
                            key={i}
                            className="group flex items-start gap-3 rounded-lg border border-border/60 bg-background p-3 transition-colors hover:border-border"
                          >
                            <div className="mt-0.5">
                              {action.success ? (
                                <CheckCircle2 className="size-4 text-green-500" />
                              ) : (
                                <XCircle className="size-4 text-red-500" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 space-y-1">
                              <div className="flex items-center gap-2">
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] px-1.5 py-0 font-mono"
                                >
                                  {String(
                                    action.actionType ??
                                      action.action ??
                                      'unknown',
                                  )}
                                </Badge>
                                <span className="text-sm font-medium truncate">
                                  {String(action.label ?? '')}
                                </span>
                                {action.confidence != null && (
                                  <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                    {Math.round(
                                      Number(action.confidence) * 100,
                                    )}
                                    %
                                  </span>
                                )}
                              </div>
                              {Boolean(action.value) && (
                                <p className="text-xs text-muted-foreground">
                                  <span className="text-muted-foreground/60">
                                    →
                                  </span>{' '}
                                  {String(action.value)}
                                </p>
                              )}
                              {Boolean(action.selector) && (
                                <p className="font-mono text-[10px] text-muted-foreground/40 truncate">
                                  {String(action.selector)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Observations tab */}
                    {activeTab === 'observations' && (
                      <div className="space-y-2">
                        {stepObservations.length === 0 && (
                          <p className="py-6 text-center text-xs text-muted-foreground">
                            No observations in this step
                          </p>
                        )}
                        {stepObservations.map(obs => (
                          <div
                            key={obs.id}
                            className="rounded-lg border border-border/60 bg-background p-3 space-y-2"
                          >
                            <div className="flex items-center gap-2">
                              {obs.success ? (
                                <CheckCircle2 className="size-4 text-green-500 shrink-0" />
                              ) : (
                                <XCircle className="size-4 text-red-500 shrink-0" />
                              )}
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 font-mono"
                              >
                                {obs.actionType}
                              </Badge>
                              <span className="text-sm font-medium truncate">
                                {obs.fieldDisplayName ||
                                  obs.fieldLabel ||
                                  obs.fieldName ||
                                  obs.ariaLabel ||
                                  obs.tagName}
                              </span>
                            </div>

                            {obs.valueFilled && (
                              <div className="ml-6 inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1">
                                <span className="text-[10px] text-emerald-500/60">
                                  Value
                                </span>
                                <span className="text-xs font-medium text-emerald-400">
                                  {obs.valueFilled}
                                </span>
                              </div>
                            )}

                            {/* Constraints */}
                            {(obs.maxLength ||
                              obs.minLength ||
                              obs.pattern ||
                              obs.inputMode) && (
                              <div className="ml-6 flex flex-wrap gap-1">
                                {obs.maxLength && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px]"
                                  >
                                    max: {obs.maxLength}
                                  </Badge>
                                )}
                                {obs.minLength && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px]"
                                  >
                                    min: {obs.minLength}
                                  </Badge>
                                )}
                                {obs.inputMode && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px]"
                                  >
                                    mode: {obs.inputMode}
                                  </Badge>
                                )}
                                {obs.pattern && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] font-mono"
                                  >
                                    /{obs.pattern}/
                                  </Badge>
                                )}
                              </div>
                            )}

                            {obs.aiReason && (
                              <p className="ml-6 text-xs italic text-muted-foreground">
                                {obs.aiReason}
                              </p>
                            )}

                            {obs.stableSelector && (
                              <p className="ml-6 font-mono text-[10px] text-muted-foreground/30 truncate">
                                {obs.stableSelector}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Rules tab */}
                    {activeTab === 'rules' && (
                      <div className="space-y-2">
                        {stepRules.length === 0 && (
                          <p className="py-6 text-center text-xs text-muted-foreground">
                            No rules in this step
                          </p>
                        )}
                        {stepRules.map(rule => (
                          <div
                            key={rule.id}
                            className={`rounded-lg border p-3 space-y-2.5 transition-colors ${
                              rule.enabled
                                ? 'border-green-500/20 bg-green-500/5'
                                : 'border-border/60 bg-background'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="text-[10px] px-1.5 py-0 font-mono"
                              >
                                {rule.actionType}
                              </Badge>
                              <span className="text-sm font-medium truncate flex-1">
                                {rule.fieldLabel ||
                                  rule.fieldName ||
                                  rule.ariaLabel ||
                                  rule.tagName}
                              </span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">
                                  {Math.round(rule.confidence * 100)}%
                                </span>
                                <span className="text-[10px] text-muted-foreground">
                                  {rule.observationCount} obs
                                </span>
                              </div>
                            </div>

                            {rule.reason && (
                              <p className="text-xs italic text-muted-foreground">
                                {rule.reason}
                              </p>
                            )}

                            <p className="font-mono text-[10px] text-muted-foreground/30 truncate">
                              {rule.stableSelector}
                            </p>

                            <div className="flex items-center justify-between pt-1">
                              <div className="flex items-center gap-2">
                                <Switch
                                  checked={rule.enabled}
                                  onCheckedChange={checked =>
                                    toggleRule(rule.id, checked)
                                  }
                                  disabled={togglingRule === rule.id}
                                  className="scale-75 origin-left"
                                />
                                <span
                                  className={`text-[11px] font-medium ${rule.enabled ? 'text-green-400' : 'text-muted-foreground'}`}
                                >
                                  {rule.enabled ? 'Active' : 'Disabled'}
                                </span>
                                {togglingRule === rule.id && (
                                  <Loader2 className="size-3 animate-spin" />
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </ModalContent>
    </Modal>
  );
}
