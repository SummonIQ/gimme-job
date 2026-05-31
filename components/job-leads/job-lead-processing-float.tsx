'use client';

import { JobLeadStatus } from '@/generated/prisma/browser';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import { cn } from '@/lib/css';
import { EventType } from '@/types/events';
import { DataEventType } from '@/types/events/data-update';
import type { JobLeadOptimizationProgressPayload } from '@/types/job-lead/event';
import { useEffect, useState } from 'react';

const TERMINAL_STATUSES: ReadonlySet<JobLeadStatus> = new Set<JobLeadStatus>([
  JobLeadStatus.OPTIMIZED,
  JobLeadStatus.ANALYSIS_FAILED,
  JobLeadStatus.OPTIMIZATION_FAILED,
]);

interface QueueItem {
  id: string;
  phase: string;
  title: string;
  progress: number;
  status: string;
}

export interface JobLeadProcessingFloatProps {
  initialItems?: Array<{ id: string; title: string; status: string }>;
}

const statusLabel: Record<string, string> = {
  [JobLeadStatus.QUEUED]: 'Queued',
  [JobLeadStatus.ANALYZING]: 'Analyzing',
  [JobLeadStatus.OPTIMIZING]: 'Optimizing',
};

const statusColor: Record<string, string> = {
  [JobLeadStatus.QUEUED]: 'bg-violet-500',
  [JobLeadStatus.ANALYZING]: 'bg-blue-500',
  [JobLeadStatus.OPTIMIZING]: 'bg-emerald-500',
};

const getDefaultPhase = (status: string): string => {
  if (status === JobLeadStatus.QUEUED) {
    return 'Waiting for available slot';
  }

  if (status === JobLeadStatus.ANALYZING) {
    return 'Running fit analysis';
  }

  if (status === JobLeadStatus.OPTIMIZING) {
    return 'Generating tailored resume';
  }

  return 'Processing';
};

const JobLeadProcessingFloat = ({
  initialItems = [],
}: JobLeadProcessingFloatProps) => {
  const userChannel = useUserChannel();
  const [items, setItems] = useState<Record<string, QueueItem>>(() =>
    Object.fromEntries(
      initialItems.map(item => [
        item.id,
        {
          id: item.id,
          phase: getDefaultPhase(item.status),
          title: item.title,
          status: item.status,
          progress: 0,
        },
      ]),
    ),
  );

  useEffect(() => {
    if (initialItems.length === 0) return;
    setItems(prev => {
      const next = { ...prev };
      for (const item of initialItems) {
        if (!next[item.id]) {
          next[item.id] = {
            id: item.id,
            phase: getDefaultPhase(item.status),
            title: item.title,
            status: item.status,
            progress: 0,
          };
        }
      }
      return next;
    });
  }, [initialItems]);

  useEvent<{
    data: JobLeadOptimizationProgressPayload;
    type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS;
  }>(userChannel, EventType.DataUpdate, payload => {
    if (!payload) return;
    if (
      (payload as { type?: string }).type !==
      DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS
    ) {
      return;
    }

    const { id, phase, progress, title, status } = payload.data;
    if (!id) return;

    if (
      progress >= 100 ||
      (status && TERMINAL_STATUSES.has(status as JobLeadStatus))
    ) {
      setItems(prev => {
        if (!prev[id]) return prev;
        const next = { ...prev };
        delete next[id];
        return next;
      });
      return;
    }

    setItems(prev => {
      const existing = prev[id];
      return {
        ...prev,
        [id]: {
          id,
          phase: phase ?? existing?.phase ?? getDefaultPhase(status ?? ''),
          title: title ?? existing?.title ?? 'Job Lead',
          progress: Math.max(progress, existing?.progress ?? 0),
          status: status ?? existing?.status ?? JobLeadStatus.ANALYZING,
        },
      };
    });
  });

  const entries = Object.values(items);
  if (entries.length === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-6 right-6 z-50 flex flex-col gap-2',
        'w-72 rounded-xl border border-border/60 bg-background/95 shadow-xl shadow-black/20 backdrop-blur-sm',
        'p-3',
      )}
    >
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
        Processing {entries.length} lead{entries.length !== 1 ? 's' : ''}
      </p>
      <div className="flex flex-col gap-2">
        {entries.map(item => {
          const barColor = statusColor[item.status] ?? 'bg-blue-500';
          const label = statusLabel[item.status] ?? item.status;
          const displayProgress =
            item.status === JobLeadStatus.QUEUED ? 0 : item.progress;
          const progressPercent = Math.min(
            99,
            Math.max(
              displayProgress,
              item.status === JobLeadStatus.QUEUED ? 8 : displayProgress,
            ),
          );

          return (
            <div
              className="flex flex-col gap-1.5 rounded-lg border border-border/40 bg-muted/20 p-2.5"
              key={item.id}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-foreground/80">
                  {item.title}
                </span>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    item.status === JobLeadStatus.QUEUED &&
                      'bg-violet-500/10 text-violet-400',
                    item.status === JobLeadStatus.ANALYZING &&
                      'bg-blue-500/10 text-blue-400',
                    item.status === JobLeadStatus.OPTIMIZING &&
                      'bg-emerald-500/10 text-emerald-400',
                  )}
                >
                  {label}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-[11px] text-muted-foreground">
                  {item.phase}
                </span>
                <span className="text-[11px] font-medium tabular-nums text-muted-foreground/90">
                  {progressPercent}%
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted/50">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-500',
                    barColor,
                    item.status === JobLeadStatus.QUEUED && 'animate-pulse',
                  )}
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

JobLeadProcessingFloat.displayName = 'JobLeadProcessingFloat';

export { JobLeadProcessingFloat };
