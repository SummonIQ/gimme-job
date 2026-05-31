'use client';

import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Circle,
  FileText,
  GitCompareArrows,
  History,
} from 'lucide-react';
import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import type {
  PlanBoardEventView,
  PlanBoardTaskDetailDiffRow,
  PlanBoardTaskStatus,
  PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';

import {
  AssigneePill,
  CLAIM_STATE_LABELS,
  formatDateTime,
  formatEventType,
  formatList,
  getTaskActionGuidance,
  STATUS_BADGE_VARIANTS,
  STATUS_LABELS,
} from './plan-board-shared';

const REPORT_OUTCOME_LABELS = {
  completed: 'Completed manual step',
  failed: 'Manual step failed',
  unclear: 'Result is unclear',
} as const;

type ManualReportOutcome = keyof typeof REPORT_OUTCOME_LABELS;

export function TaskDetailDrawer({
  task,
  onTaskUpdated,
}: {
  onTaskUpdated?: (task: PlanBoardTaskView) => void;
  task: PlanBoardTaskView;
}) {
  const changeRows = buildTaskDetailDiffRows(task);
  const ownershipRows = buildOwnershipRows(task);
  const actionGuidance = useMemo(() => getTaskActionGuidance(task), [task]);
  const commentEvents = useMemo(
    () => task.events.filter(event => Boolean(event.message?.trim())),
    [task.events],
  );
  const defaultReportStatus =
    task.status === 'BLOCKED' ? 'TODO' : task.status;
  const [reportOutcome, setReportOutcome] =
    useState<ManualReportOutcome>('completed');
  const [reportStatus, setReportStatus] =
    useState<PlanBoardTaskStatus>(defaultReportStatus);
  const [reportSummary, setReportSummary] = useState('');
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  useEffect(() => {
    setReportOutcome('completed');
    setReportStatus(task.status === 'BLOCKED' ? 'TODO' : task.status);
    setReportSummary('');
  }, [task.taskId, task.status]);

  const handleSubmitManualReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedSummary = reportSummary.trim();
    if (!trimmedSummary) {
      toast.error('Add a short summary before saving the result.');
      return;
    }

    setIsSubmittingReport(true);

    try {
      const response = await fetch(`/api/admin/plan-board/tasks/${task.taskId}`, {
        body: JSON.stringify({
          eventType: reportStatus === task.status ? 'NOTE_ADDED' : undefined,
          message: buildManualReportMessage({
            outcome: reportOutcome,
            summary: trimmedSummary,
          }),
          status: reportStatus,
        }),
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'PATCH',
      });

      const payload = (await response.json()) as {
        error?: string;
        task?: PlanBoardTaskView;
      };

      if (!response.ok || !payload.task) {
        throw new Error(payload.error ?? 'Failed to record manual result.');
      }

      onTaskUpdated?.(payload.task);
      setReportSummary('');
      toast.success('Plan-board result saved.');
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : 'Failed to record manual result.',
      );
    } finally {
      setIsSubmittingReport(false);
    }
  };

  return (
    <>
      <SheetHeader className="border-b border-border/40 p-4 pr-10">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{task.taskId}</Badge>
          <Badge variant={STATUS_BADGE_VARIANTS[task.status]}>
            {STATUS_LABELS[task.status]}
          </Badge>
        </div>
        <SheetTitle className="pr-5 text-base leading-snug">
          {task.title}
        </SheetTitle>
        <SheetDescription>
          {task.phaseId} - {task.phaseTitle}
        </SheetDescription>
      </SheetHeader>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <Tabs defaultValue="status" className="flex min-h-0 flex-col gap-3">
          <TabsList>
            <TabsTrigger value="status">Status</TabsTrigger>
            <TabsTrigger value="changes">Changes</TabsTrigger>
            <TabsTrigger value="definition">Definition</TabsTrigger>
          </TabsList>

          <TabsContent
            value="status"
            scrollable={false}
            className="mt-0 flex flex-col gap-3"
          >
            <div className="grid grid-cols-2 gap-2">
              <DetailMetric
                icon={Circle}
                label="Live status"
                value={STATUS_LABELS[task.status]}
              />
              <DetailMetric
                icon={CalendarClock}
                label="Last update"
                value={formatDateTime(task.updatedAt)}
              />
              <DetailMetric
                icon={History}
                label="Claim state"
                value={CLAIM_STATE_LABELS[task.claimState]}
              />
              <DetailMetric
                icon={CalendarClock}
                label="Claimed at"
                value={formatDateTime(task.claimedAt)}
              />
            </div>
            <div className="rounded-xl border border-border/40 bg-background/45 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium uppercase text-muted-foreground/75">
                    Next move
                  </p>
                  <p className="mt-2 text-sm font-semibold text-foreground">
                    {actionGuidance.headline}
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {actionGuidance.summary}
                  </p>
                </div>
                {actionGuidance.needsStevenAction ? (
                  <Badge variant="outline">Needs Steven</Badge>
                ) : null}
              </div>
              {actionGuidance.detail ? (
                <div className="mt-3 rounded-lg border border-border/35 bg-background/45 p-2.5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium uppercase text-muted-foreground/75">
                        Current note
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {actionGuidance.detail}
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
              {task.dependsOn.length > 0 ? (
                <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                  Depends on: {formatList(task.dependsOn)}
                </p>
              ) : null}
              {actionGuidance.showManualReport ? (
                <form
                  className="mt-4 flex flex-col gap-3 rounded-lg border border-border/35 bg-background/45 p-3"
                  onSubmit={handleSubmitManualReport}
                >
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReportOutcome('completed');
                        setReportStatus('TODO');
                      }}
                    >
                      Manual step done
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReportOutcome('unclear');
                        setReportStatus('BLOCKED');
                      }}
                    >
                      Still blocked
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setReportOutcome('failed');
                        setReportStatus('BLOCKED');
                      }}
                    >
                      Manual step failed
                    </Button>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-board-report-outcome">Outcome</Label>
                      <Select
                        value={reportOutcome}
                        onValueChange={value =>
                          setReportOutcome(value as ManualReportOutcome)
                        }
                      >
                        <SelectTrigger
                          id="plan-board-report-outcome"
                          size="sm"
                        >
                          <SelectValue placeholder="Select outcome" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(REPORT_OUTCOME_LABELS).map(
                            ([value, label]) => (
                              <SelectItem key={value} value={value}>
                                {label}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="plan-board-report-status">
                        Status after report
                      </Label>
                      <Select
                        value={reportStatus}
                        onValueChange={value =>
                          setReportStatus(value as PlanBoardTaskStatus)
                        }
                      >
                        <SelectTrigger id="plan-board-report-status" size="sm">
                          <SelectValue placeholder="Select status" />
                        </SelectTrigger>
                        <SelectContent>
                          {(
                            ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'] as const
                          ).map(status => (
                            <SelectItem key={status} value={status}>
                              {STATUS_LABELS[status]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="plan-board-report-summary">
                      What happened
                    </Label>
                    <Textarea
                      id="plan-board-report-summary"
                      value={reportSummary}
                      onChange={event => setReportSummary(event.target.value)}
                      placeholder="What did you do, and what result should the agent continue from?"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-muted-foreground">
                      This writes a live event through the plan-board PATCH API.
                    </p>
                    <Button
                      type="submit"
                      size="sm"
                      inProgress={isSubmittingReport}
                    >
                      Save result
                    </Button>
                  </div>
                </form>
              ) : null}
            </div>
            <div className="rounded-xl border border-border/40 bg-background/45 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/75">
                Assignee
              </p>
              <AssigneePill agentHandle={task.agentHandle} size="lg" />
              {task.assignmentReason ? (
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                  {task.assignmentReason}
                </p>
              ) : null}
            </div>
            <div className="rounded-xl border border-border/40 bg-background/45 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/75">
                Ownership history
              </p>
              {ownershipRows.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {ownershipRows.map(row => (
                    <div
                      className="rounded-lg bg-background/45 p-2 text-xs"
                      key={row.key}
                    >
                      <div className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
                        <span>{row.from}</span>
                        <ArrowRight className="size-3" />
                        <span className="font-medium text-foreground">
                          {row.to}
                        </span>
                      </div>
                      <p className="mt-1 text-muted-foreground">
                        {row.timestamp}
                      </p>
                      {row.reason ? (
                        <p className="mt-1 leading-relaxed text-muted-foreground">
                          {row.reason}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No assignment changes yet.
                </p>
              )}
            </div>
            <div className="rounded-xl border border-border/40 bg-background/45 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/75">
                Live state diff
              </p>
              <div className="flex flex-col gap-2">
                {changeRows.map(row => (
                  <div
                    className="flex items-start gap-2 rounded-lg bg-background/45 p-2 text-xs"
                    key={row.label}
                  >
                    <GitCompareArrows className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{row.label}</p>
                      <p className="text-muted-foreground">{row.value}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-xl border border-border/40 bg-background/45 p-3">
              <p className="mb-2 text-xs font-medium uppercase text-muted-foreground/75">
                Comments
              </p>
              {task.notes ? (
                <p className="mb-2 text-sm leading-relaxed text-foreground/85">
                  {task.notes}
                </p>
              ) : null}
              {commentEvents.length > 0 ? (
                <div className="flex flex-col gap-2">
                  {commentEvents.map(event => (
                    <div
                      className="rounded-lg bg-background/45 p-2 text-xs"
                      key={event.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-1.5 text-muted-foreground">
                        <span className="font-medium text-foreground">
                          {event.agentHandle ?? formatEventType(event.eventType)}
                        </span>
                        <span>{formatDateTime(event.createdAt)}</span>
                      </div>
                      <p className="mt-1 leading-relaxed text-muted-foreground">
                        {event.message}
                      </p>
                    </div>
                  ))}
                </div>
              ) : task.notes ? null : (
                <p className="text-sm text-muted-foreground">
                  No comments yet.
                </p>
              )}
            </div>
          </TabsContent>

          <TabsContent
            value="changes"
            scrollable={false}
            className="mt-0 flex flex-col gap-2"
          >
            {task.events.length > 0 ? (
              task.events.map(event => (
                <TaskEventRow key={event.id} event={event} />
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-border/60 bg-background/35 p-4 text-sm text-muted-foreground">
                No live events yet.
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="definition"
            scrollable={false}
            className="mt-0 flex flex-col gap-3"
          >
            <DefinitionBlock label="Acceptance" value={task.acceptance} />
            <DefinitionBlock
              label="Tests required"
              value={task.testsRequired}
            />
            <DefinitionBlock
              label="Depends on"
              value={formatList(task.dependsOn)}
            />
            <DefinitionBlock label="Files" value={formatList(task.files)} />
            <DefinitionBlock label="Labels" value={formatList(task.labels)} />
            <DefinitionBlock label="Notes" value={task.notes} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function DetailMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Circle;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/45 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="size-3.5" />
        {label}
      </div>
      <p className="mt-2 truncate text-sm font-semibold text-foreground">
        {value}
      </p>
    </div>
  );
}

function TaskEventRow({ event }: { event: PlanBoardEventView }) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/45 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileText className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-foreground">
            {formatEventType(event.eventType)}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">
          {formatDateTime(event.createdAt)}
        </span>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {event.fromStatus ? STATUS_LABELS[event.fromStatus] : 'New'}
        <ArrowRight className="size-3" />
        {event.toStatus ? STATUS_LABELS[event.toStatus] : 'No status'}
      </div>
      <div className="mt-2">
        <AssigneePill agentHandle={event.agentHandle} />
      </div>
      {event.assignmentReason ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Reason: {event.assignmentReason}
        </p>
      ) : null}
      {event.message ? (
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          {event.message}
        </p>
      ) : null}
    </div>
  );
}

function DefinitionBlock({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) {
  return (
    <div className="rounded-xl border border-border/40 bg-background/45 p-3">
      <p className="mb-1 text-xs font-medium uppercase text-muted-foreground/75">
        {label}
      </p>
      <p className="text-sm leading-relaxed text-foreground/85">
        {value || 'None'}
      </p>
    </div>
  );
}

export function buildTaskDetailDiffRows(
  task: PlanBoardTaskView,
): PlanBoardTaskDetailDiffRow[] {
  const rows = [
    {
      label: 'Status',
      value:
        task.status === task.markdownStatus
          ? `Matches plan default: ${STATUS_LABELS[task.markdownStatus]}`
          : `${STATUS_LABELS[task.markdownStatus]} → ${STATUS_LABELS[task.status]}`,
    },
    {
      label: 'Assignee',
      value: task.agentHandle
        ? `Assigned to ${task.agentHandle}`
        : 'No agent assigned yet',
    },
    {
      label: 'Claim',
      value:
        task.claimState === 'STALE'
          ? `Stale since ${formatDateTime(task.claimedAt)}`
          : CLAIM_STATE_LABELS[task.claimState],
    },
    {
      label: 'Notes',
      value: task.notes ? task.notes : 'No live notes yet',
    },
  ];

  if (task.events.length > 0) {
    rows.push({
      label: 'Latest event',
      value:
        task.events[0].message ?? formatEventType(task.events[0].eventType),
    });
  }

  return rows;
}

function buildOwnershipRows(task: PlanBoardTaskView) {
  return task.events
    .filter(
      event =>
        event.eventType === 'AGENT_ASSIGNED' ||
        event.previousAgentHandle !== null ||
        event.nextAgentHandle !== null,
    )
    .map(event => ({
      from: event.previousAgentHandle ?? 'Unassigned',
      key: event.id,
      reason: event.assignmentReason ?? event.message,
      timestamp: formatDateTime(event.createdAt),
      to: event.nextAgentHandle ?? 'Unassigned',
    }));
}

function buildManualReportMessage({
  outcome,
  summary,
}: {
  outcome: ManualReportOutcome;
  summary: string;
}) {
  return `Steven report (${REPORT_OUTCOME_LABELS[outcome]}): ${summary}`;
}
