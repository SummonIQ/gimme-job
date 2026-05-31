'use client';

import {
  Resume,
  ResumeAnalysis,
  ResumeOptimization,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { FileScan } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { Progress } from '@/components/ui/progress';
import { ShimmerCard, ShimmerCardContent } from '@/components/ui/shimmer-card';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import { cn } from '@/lib/css';
import {
  isActiveResumeOptimizationStatus,
  isTerminalResumeOptimizationStatus,
  mergeResumeOptimizationProgressState,
} from '@/lib/resumes/optimization-state';
import { QueueState } from '@/types/data';
import { DataEventType, EventType } from '@/types/events';
import type { ResumeOptimizationProgressPayload } from '@/types/resumes';

import { DateLabel } from '../data/date-label';
import { ResumeOptimizationStatusBadge } from './resume-optimization-status-badge';

export interface ResumeOptimizationQueueProps {
  queue?: Array<
    Resume & {
      analysis?: ResumeAnalysis | null;
      analysisId?: string | null;
      createdAt?: Date;
      id?: string;
      name?: string;
      optimization?: ResumeOptimization | null;
      optimizationId?: string | null;
      updatedAt?: Date;
    }
  >;
}

const ResumeOptimizationQueue = ({
  queue: resumeOptimizationQueue,
}: ResumeOptimizationQueueProps) => {
  type ResumeQueueEntry = QueueState<ResumeOptimizationStatus>[string] & {
    emittedAt?: string;
    sequence?: number;
  };

  const userChannel = useUserChannel();
  // Track IDs that were removed via Pusher terminal events so stale server
  // data arriving later cannot resurrect them.
  const completedIds = useRef<Set<string>>(new Set());
  // Drop entries whose optimization hasn't progressed in a while — likely stale
  // server cache data from a completed optimization whose cache tag was missed.
  const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

  const [queue, setQueue] = useState<Record<string, ResumeQueueEntry>>(() => {
    const now = Date.now();
    return (
      resumeOptimizationQueue
        ?.filter(resume => resume.optimization?.progress !== 100)
        .reduce((acc, resume) => {
          if (resume.optimization?.progress !== undefined) {
            const updatedAt =
              resume.optimization?.updatedAt ?? resume.updatedAt;
            const age = updatedAt
              ? now - new Date(updatedAt).getTime()
              : Infinity;
            if (age > STALE_THRESHOLD_MS) return acc;

            acc[resume.id as string] = {
              ...resume,
              createdAt: resume.createdAt,
              name: resume?.name ?? '',
              progress: resume.optimization?.progress ?? 0,
              status:
                resume.optimization?.status ?? ResumeOptimizationStatus.QUEUED,
              updatedAt: resume.updatedAt,
            };
          }
          return acc;
        }, {} as QueueState<ResumeOptimizationStatus>) ?? {}
    );
  });

  useEffect(() => {
    if (!resumeOptimizationQueue) return;

    setQueue(prevQueue => {
      const nextQueue = resumeOptimizationQueue
        .filter(resume => resume.optimization?.progress !== 100)
        .reduce((acc, resume) => {
          if (resume.optimization?.progress !== undefined) {
            const id = resume.id as string;

            // Skip entries that were already completed via Pusher events -
            // stale server cache may still include them.
            if (completedIds.current.has(id)) return acc;

            const prevProgress = prevQueue[id]?.progress;
            const prevStatus = prevQueue[id]?.status;
            const serverProgress = resume.optimization?.progress ?? 0;
            const serverStatus =
              resume.optimization?.status ?? ResumeOptimizationStatus.QUEUED;

            // Use the higher of client / server progress so we never go
            // backwards, but still pick up server progress when no Pusher
            // event has been received yet.
            const progress =
              prevProgress !== undefined
                ? Math.max(prevProgress, serverProgress)
                : serverProgress;
            const mergedStatus =
              prevStatus !== undefined
                ? mergeResumeOptimizationProgressState({
                    incomingProgress: serverProgress,
                    incomingStatus: serverStatus,
                    previousProgress: prevProgress,
                    previousStatus: prevStatus,
                  }).status
                : serverStatus;

            acc[id] = {
              ...resume,
              createdAt: prevQueue[id]?.createdAt ?? resume.createdAt,
              name: resume?.name ?? '',
              progress,
              status: mergedStatus,
              updatedAt: resume.updatedAt,
            };
          }
          return acc;
        }, {} as QueueState<ResumeOptimizationStatus>);

      // Preserve active optimistic entries that may not be present in the latest
      // server payload yet (for example, during cache propagation).
      // Only keep them for a short window (30s) — after that, trust the server.
      const preserveWindowMs = 30_000;
      const now = Date.now();
      for (const [resumeId, queuedResume] of Object.entries(prevQueue)) {
        if (nextQueue[resumeId]) continue;
        if (completedIds.current.has(resumeId)) continue;
        if (!isActiveResumeOptimizationStatus(queuedResume.status)) continue;
        if ((queuedResume.progress ?? 0) >= 100) continue;

        // If the entry has been around longer than the preserve window and
        // the server no longer includes it, drop it — the server is the
        // source of truth and the completion Pusher event was likely missed.
        const entryAge = queuedResume.updatedAt
          ? now - new Date(queuedResume.updatedAt).getTime()
          : Infinity;
        if (entryAge > preserveWindowMs) continue;

        nextQueue[resumeId] = queuedResume;
      }

      return nextQueue;
    });
  }, [resumeOptimizationQueue]);

  const handleResumeOptimizationEvent = useCallback(
    (payload?: {
      data: ResumeOptimizationProgressPayload;
      type: DataEventType.RESUME_OPTIMIZATION_PROGRESS;
    }) => {
      if (!payload) return;
      if (payload.type !== DataEventType.RESUME_OPTIMIZATION_PROGRESS) return;

      const { id, progress, status, name, sequence } = payload.data;
      if (!id) return;

      setQueue(prev => {
        const previousEntry = prev[id];
        if (
          typeof sequence === 'number' &&
          typeof previousEntry?.sequence === 'number' &&
          sequence < previousEntry.sequence
        ) {
          return prev;
        }

        if (progress >= 100 || isTerminalResumeOptimizationStatus(status)) {
          completedIds.current.add(id);
          if (!previousEntry) return prev;
          const newQueue = { ...prev };
          delete newQueue[id];
          return newQueue;
        }

        const mergedState = mergeResumeOptimizationProgressState({
          incomingProgress: progress,
          incomingStatus: status,
          previousProgress: previousEntry?.progress ?? 0,
          previousStatus:
            previousEntry?.status ?? ResumeOptimizationStatus.QUEUED,
        });

        const newQueue = { ...prev };
        newQueue[id] = {
          ...previousEntry,
          createdAt: !previousEntry ? new Date() : previousEntry.createdAt,
          emittedAt: payload.data.emittedAt,
          name,
          progress: mergedState.progress,
          sequence:
            typeof sequence === 'number' ? sequence : previousEntry?.sequence,
          status: mergedState.status,
          updatedAt: new Date(),
        };

        return newQueue;
      });
    },
    [],
  );

  useEvent<{
    data: ResumeOptimizationProgressPayload;
    type: DataEventType.RESUME_OPTIMIZATION_PROGRESS;
  }>(userChannel, EventType.DataUpdate, handleResumeOptimizationEvent);

  const visible = Object.keys(queue).length > 0;

  return (
    <ShimmerCard
      className={cn(
        '&:before:absolute &:before:inset-0 &:before:bg-amber-500/50 &:before:blur-sm &:before:z-10 relative border-transparent bg-transparent shadow-none transition-all duration-300',
        !visible
          ? 'scale-y-30 mb-0 !h-0 -translate-y-6 overflow-hidden border-none border-transparent opacity-0 shadow-none shadow-transparent'
          : 'mb-4 translate-y-0 scale-y-100 border-transparent opacity-100',
      )}
    >
      <ShimmerCardContent
        className={cn(!visible ? '' : 'gap-2 px-0 pb-0 pt-0')}
      >
        <h3 className="pl-1.5 text-center font-semibold text-muted-foreground/90">
          Resume Optimization Queue
        </h3>
        <div className="flex w-full flex-col gap-2">
          {Object.keys(queue).map(resumeId => {
            // const resume = resumeOptimizationQueue?.find(
            //   resumeOpt => resumeOpt.id === resumeId,
            // );

            // if (!resume) return null;

            const { name, progress, status } = queue[resumeId];
            const roundedProgress = Math.ceil(progress ?? 0);

            return (
              <Link
                className="flex w-full cursor-pointer flex-col rounded-md border border-border/50 bg-background p-3 shadow-sm ring-offset-0 transition-all duration-300 hover:border-transparent hover:shadow-md hover:shadow-amber-500/20 hover:ring-2 hover:ring-amber-500/40 md:flex-row"
                href={`/profile/resumes/${resumeId}`}
                key={resumeId}
              >
                <div className="flex w-full flex-row items-center gap-1 pb-2 md:w-2/5">
                  <div className="-mt-1 flex items-start justify-center rounded-sm bg-amber-500/10 p-2">
                    <FileScan className="size-5 text-amber-500" />
                  </div>

                  <div className="flex flex-col px-3.5 py-0.5">
                    <h5 className="text-sm font-semibold text-foreground/75">
                      {name}
                    </h5>
                    <p className="text-pretty text-xs text-muted-foreground/70">
                      Started{' '}
                      <DateLabel
                        date={queue[resumeId]?.createdAt ?? new Date()}
                      />
                    </p>
                  </div>

                  {/* <div className="flex flex-row items-center gap-2 border-r border-border/50 px-6">
                    <ResumeOptimizationStatusBadge status={status} />
                  </div> */}
                </div>

                <div className="flex grow flex-col justify-center gap-1 rounded-sm border border-border/50 bg-accent/20 p-3">
                  <div className="flex flex-row items-center justify-between gap-1">
                    <p className="flex-nowrap text-xs font-medium text-muted-foreground">
                      <b>{`${roundedProgress}%`}</b>
                      {' complete'}
                    </p>

                    <ResumeOptimizationStatusBadge
                      className="bg-transparent p-0"
                      status={status}
                      variant="ghost"
                    />

                    {/* <p className="text-xs text-muted-foreground">
                      <b>
                        {queue[resume.id]?.jobListingsCount
                          ? queue[resume.id]?.jobListingsCount
                          : (resume.jobListingsCount ?? 0)}
                      </b>{' '}
                      job listings added
                    </p> */}
                  </div>
                  <Progress
                    className="h-2.5 [&>div]:bg-linear-to-r [&>div]:from-amber-500 [&>div]:via-yellow-400 [&>div]:to-emerald-400"
                    value={progress}
                    // variant="default"
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </ShimmerCardContent>
    </ShimmerCard>
  );
};
ResumeOptimizationQueue.displayName = 'ResumeOptimizationQueue';

export { ResumeOptimizationQueue };
