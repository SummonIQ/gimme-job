'use client';

import { ResumeOptimizationStatus } from '@/generated/prisma/browser';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { ResumeOptimizationStatusBadge } from '@/components/resumes/resume-optimization-status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import {
  isActiveResumeOptimizationStatus,
  isTerminalResumeOptimizationStatus,
  mergeResumeOptimizationProgressState,
} from '@/lib/resumes/optimization-state';
import { DataEventType, EventType } from '@/types/events';
import { ResumeOptimizationProgressPayload } from '@/types/resumes';

interface ResumeRealtimeStatusProps {
  initialProgress?: number | null;
  initialStatus?: ResumeOptimizationStatus | null;
  resumeId: string;
}

const ResumeRealtimeStatus = ({
  initialProgress,
  initialStatus,
  resumeId,
}: ResumeRealtimeStatusProps) => {
  const router = useRouter();
  const userChannel = useUserChannel();
  const latestSequence = useRef<number>(-1);
  const completionToastShownRef = useRef(false);
  const [progress, setProgress] = useState<number>(initialProgress ?? 0);
  const [status, setStatus] = useState<ResumeOptimizationStatus>(
    initialStatus ?? ResumeOptimizationStatus.QUEUED,
  );
  const progressRef = useRef(progress);
  const statusRef = useRef(status);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const handleResumeOptimizationEvent = useCallback(
    (payload?: {
      data: ResumeOptimizationProgressPayload;
      type: DataEventType.RESUME_OPTIMIZATION_PROGRESS;
    }) => {
      if (!payload) return;
      if (payload.type !== DataEventType.RESUME_OPTIMIZATION_PROGRESS) return;
      if (payload.data.id !== resumeId) return;

      if (typeof payload.data.sequence === 'number') {
        if (payload.data.sequence < latestSequence.current) {
          return;
        }
        latestSequence.current = payload.data.sequence;
      }

      const mergedState = mergeResumeOptimizationProgressState({
        incomingProgress: payload.data.progress,
        incomingStatus: payload.data.status,
        previousProgress: progressRef.current,
        previousStatus: statusRef.current,
      });
      progressRef.current = mergedState.progress;
      statusRef.current = mergedState.status;
      setProgress(mergedState.progress);
      setStatus(mergedState.status);

      if (
        isTerminalResumeOptimizationStatus(mergedState.status) ||
        payload.data.progress >= 100
      ) {
        if (
          mergedState.status === ResumeOptimizationStatus.COMPLETED &&
          !completionToastShownRef.current
        ) {
          completionToastShownRef.current = true;
          toast.success('Resume optimization complete.', {
            action: {
              label: 'View optimized resume',
              onClick: () => {
                router.push(
                  `/profile/resumes/${resumeId}?tab=optimized-resume`,
                );
              },
            },
            duration: 8000,
          });
        }
        router.refresh();
      }
    },
    [resumeId, router],
  );

  useEvent<{
    data: ResumeOptimizationProgressPayload;
    type: DataEventType.RESUME_OPTIMIZATION_PROGRESS;
  }>(userChannel, EventType.DataUpdate, handleResumeOptimizationEvent);

  const roundedProgress = useMemo(() => Math.ceil(progress), [progress]);

  if (!isActiveResumeOptimizationStatus(status)) {
    return null;
  }

  return (
    <Alert className="border-amber-400/35 bg-amber-500/[0.06]">
      <AlertTitle className="flex items-center justify-between gap-3">
        <span>Resume optimization in progress</span>
        <ResumeOptimizationStatusBadge status={status} variant="outline" />
      </AlertTitle>
      <AlertDescription className="space-y-2 pt-2">
        <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
          <span>Live update</span>
          <span>{roundedProgress}% complete</span>
        </div>
        <Progress className="h-2.5 [&>div]:bg-amber-500" value={progress} />
      </AlertDescription>
    </Alert>
  );
};

export { ResumeRealtimeStatus };
