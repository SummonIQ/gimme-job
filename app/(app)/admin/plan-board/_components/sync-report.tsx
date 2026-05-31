'use client';

import { AlertCircle, CheckCircle2, GitCompareArrows } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge } from '@/components/ui/badge';
import type {
  PlanBoardRenameHint,
  PlanBoardSyncReport as PlanBoardSyncReportData,
} from '@/lib/admin/plan-board-types';

const MAX_VISIBLE_ITEMS = 4;

export function SyncReport({ report }: { report: PlanBoardSyncReportData }) {
  const issueCount =
    report.missingLiveTasks.length + report.orphanedLiveTasks.length;
  const StatusIcon = report.isSynced ? CheckCircle2 : AlertCircle;

  return (
    <section className="shrink-0 rounded-xl border border-border/40 bg-background/35 p-3 shadow-sm backdrop-blur-md dark:bg-background/20">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <StatusIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Definition sync
            </h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {report.syncedTaskCount} of {report.totalMarkdownTasks} plan tasks
              have live rows. {report.totalLiveTasks} live rows exist.
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-1.5 lg:justify-end">
          <Badge variant={report.isSynced ? 'secondary' : 'outline'}>
            {report.isSynced ? 'Synced' : `${issueCount} issues`}
          </Badge>
          {report.possibleRenamedTaskIds.length > 0 ? (
            <Badge variant="secondary">
              {report.possibleRenamedTaskIds.length} rename hints
            </Badge>
          ) : null}
        </div>
      </div>

      {report.isSynced ? (
        <p className="mt-3 rounded-lg border border-border/35 bg-background/45 p-2 text-xs text-muted-foreground">
          Markdown task definitions and live board rows match.
        </p>
      ) : (
        <div className="mt-3 grid gap-2 lg:grid-cols-3">
          <SyncIssueGroup
            title="Missing live rows"
            items={report.missingLiveTasks.map(
              task => `${task.taskId} - ${task.title}`,
            )}
          />
          <SyncIssueGroup
            title="Orphaned live rows"
            items={report.orphanedLiveTasks.map(task => task.taskId)}
          />
          <SyncIssueGroup
            title="Rename hints"
            items={report.possibleRenamedTaskIds.map(formatRenameHint)}
            icon={<GitCompareArrows className="size-3.5" />}
          />
        </div>
      )}
    </section>
  );
}

function SyncIssueGroup({
  icon,
  items,
  title,
}: {
  icon?: ReactNode;
  items: string[];
  title: string;
}) {
  const visibleItems = items.slice(0, MAX_VISIBLE_ITEMS);
  const hiddenCount = items.length - visibleItems.length;

  return (
    <div className="rounded-lg border border-border/35 bg-background/45 p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-foreground">
          {icon}
          <span className="truncate">{title}</span>
        </div>
        <Badge className="px-1.5 py-0.5 text-xs" variant="outline">
          {items.length}
        </Badge>
      </div>
      {visibleItems.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {visibleItems.map(item => (
            <li
              className="truncate text-xs leading-relaxed text-muted-foreground"
              key={item}
            >
              {item}
            </li>
          ))}
          {hiddenCount > 0 ? (
            <li className="text-xs leading-relaxed text-muted-foreground">
              +{hiddenCount} more
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">None</p>
      )}
    </div>
  );
}

function formatRenameHint(hint: PlanBoardRenameHint): string {
  return `${hint.orphanedTaskId} -> ${hint.candidateTaskIds.join(', ')}`;
}
