'use client';

import { Loader2, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Fragment, useEffect, useRef, useState, useTransition } from 'react';

import { JobLeadStatusAccents } from '@/constants/job-leads/attributes';
import { JobLeadStatus } from '@/generated/prisma/browser';
import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import { cn } from '@/lib/css';
import { revalidateJobLead } from '@/lib/job-leads/revalidate';
import { EventType } from '@/types/events';
import { DataEventType } from '@/types/events/data-update';
import type { JobLeadOptimizationProgressPayload } from '@/types/job-lead/event';

export type JobLeadProgressTrackerProps = {
  analyzeComplete: boolean;
  analyzeProgress: number;
  className?: string;
  createComplete: boolean;
  jobLeadId: string;
  jobLeadStatus: JobLeadStatus;
  // optimizedComplete: boolean;
  optimizedProgress: number;
};

const ProgressRefreshIcon = () => {
  return (
    <svg
      aria-hidden="true"
      className="size-2.5 shrink-0 animate-spin text-muted-foreground/30"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="M20 8a8 8 0 0 0-14.6-2.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="m5.6 3.7-.5 3.7 3.7.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="M4 16a8 8 0 0 0 14.6 2.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
      <path
        d="m18.4 20.3.5-3.7-3.7-.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.5"
      />
    </svg>
  );
};

const JobLeadProgressTracker = ({
  jobLeadId,
  className,
  createComplete,
  analyzeComplete,
  analyzeProgress: initialAnalyzeProgress,
  jobLeadStatus,
  // optimizedComplete: initialOptimizedComplete,
  optimizedProgress: initialOptimizedProgress,
}: JobLeadProgressTrackerProps) => {
  const [analyzeProgress, setAnalyzeProgress] = useState(
    initialAnalyzeProgress,
  );
  const [optimizedProgress, setOptimizedProgress] = useState(
    initialOptimizedProgress,
  );
  const [liveJobLeadStatus, setLiveJobLeadStatus] = useState(jobLeadStatus);
  // const [optimizedComplete, setOptimizedComplete] = useState(
  //   initialOptimizedComplete,
  // );
  const [isPending, startTransition] = useTransition();
  const [isRetrying, setIsRetrying] = useState(false);
  const router = useRouter();
  const userChannel = useUserChannel();

  // Guard: prevent stacking multiple router.refresh() calls
  const refreshPendingRef = useRef(false);
  // Track current optimizedProgress in a ref so the event callback
  // always reads the latest value without needing to be recreated.
  const optimizedProgressRef = useRef(optimizedProgress);
  optimizedProgressRef.current = optimizedProgress;
  useEffect(() => {
    setLiveJobLeadStatus(jobLeadStatus);
  }, [jobLeadStatus]);

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

    const { id, progress } = payload.data;

    if (id !== jobLeadId) return;

    startTransition(async () => {
      if (progress >= 100) {
        // If we already refreshed for completion, don't refresh again.
        // Never reset refreshPendingRef — one refresh per component mount.
        if (refreshPendingRef.current || optimizedProgressRef.current >= 100) {
          return;
        }
        refreshPendingRef.current = true;
        setOptimizedProgress(100);
        setTimeout(async () => {
          await revalidateJobLead(jobLeadId);
          router.refresh();
        }, 1500);
      } else if (progress > optimizedProgressRef.current) {
        if (progress >= 0 && progress < 60) {
          setLiveJobLeadStatus(JobLeadStatus.ANALYZING);
          setAnalyzeProgress(progress);
        } else if (progress >= 60) {
          setLiveJobLeadStatus(JobLeadStatus.OPTIMIZING);
          setOptimizedProgress(progress);
          setAnalyzeProgress(100);
        }
      }
    });
  });

  const jobLeadRank = {
    [JobLeadStatus.ADDED]: 0,
    [JobLeadStatus.ANALYZING]: 1,
    [JobLeadStatus.ANALYZED]: 2,
    [JobLeadStatus.ANALYSIS_FAILED]: 2,
    [JobLeadStatus.OPTIMIZING]: 3,
    [JobLeadStatus.OPTIMIZED]: 4,
    [JobLeadStatus.OPTIMIZATION_FAILED]: 4,
    [JobLeadStatus.APPLYING]: 5,
    [JobLeadStatus.APPLIED]: 6,
    [JobLeadStatus.ADVANCED]: 7,
    [JobLeadStatus.REJECTED]: 6,
    [JobLeadStatus.INTERVIEW_SCHEDULED]: 8,
    [JobLeadStatus.INTERVIEW_CANCELLED]: 8,
    [JobLeadStatus.INTERVIEW_COMPLETED]: 9,
    [JobLeadStatus.INTERVIEWED_NOT_SELECTED]: 9,
    [JobLeadStatus.OFFER]: 10,
    [JobLeadStatus.OFFER_DECLINED]: 10,
    [JobLeadStatus.HIRED]: 11,
    [JobLeadStatus.REMOVED]: 0,
  }[liveJobLeadStatus];

  // Failure state detection
  const isAnalysisFailed =
    liveJobLeadStatus === JobLeadStatus.ANALYSIS_FAILED ||
    (liveJobLeadStatus === JobLeadStatus.OPTIMIZATION_FAILED &&
      !analyzeComplete);
  const isOptimizationFailed =
    !isAnalysisFailed &&
    liveJobLeadStatus === JobLeadStatus.OPTIMIZATION_FAILED;
  const isFailed = isAnalysisFailed || isOptimizationFailed;

  // Derive stage states from jobLeadStatus (source of truth) + progress for real-time updates
  const isAnalyzing = liveJobLeadStatus === JobLeadStatus.ANALYZING;
  const isAnalyzeComplete =
    !isAnalysisFailed && !isAnalyzing && (analyzeComplete || jobLeadRank >= 2);
  const isOptimizing = liveJobLeadStatus === JobLeadStatus.OPTIMIZING;
  const isOptimizedComplete =
    !isOptimizationFailed && !isOptimizing && jobLeadRank >= 4;
  const isApplied = jobLeadRank >= 6;
  const isInterviewScheduled = jobLeadRank >= 8;
  const isInterviewed = jobLeadRank >= 9;
  const isOfferMade = jobLeadRank >= 10;
  const addedAccent = JobLeadStatusAccents[JobLeadStatus.ADDED];
  const analyzedAccent = isAnalysisFailed
    ? JobLeadStatusAccents[JobLeadStatus.ANALYSIS_FAILED]
    : JobLeadStatusAccents[JobLeadStatus.ANALYZED];
  const optimizedAccent = isOptimizationFailed
    ? JobLeadStatusAccents[JobLeadStatus.OPTIMIZATION_FAILED]
    : JobLeadStatusAccents[JobLeadStatus.OPTIMIZED];
  const appliedAccent = JobLeadStatusAccents[JobLeadStatus.APPLIED];
  const interviewScheduledAccent =
    JobLeadStatusAccents[JobLeadStatus.INTERVIEW_SCHEDULED];
  const interviewedAccent =
    JobLeadStatusAccents[JobLeadStatus.INTERVIEW_COMPLETED];
  const offerAccent = JobLeadStatusAccents[JobLeadStatus.OFFER];

  const stages = [
    {
      key: 'added',
      label: 'Added',
      active: createComplete,
      pulse: false,
      failed: false,
      dotClass: addedAccent.dotClass,
      glowColor: addedAccent.glowColor,
      textClass: addedAccent.textClass,
      inactiveDotClass: addedAccent.inactiveDotClass,
      ringClass: addedAccent.ringClass,
    },
    {
      key: 'analyzed',
      label: isAnalysisFailed
        ? 'Failed'
        : isAnalyzeComplete
          ? 'Analyzed'
          : 'Analysis',
      active: isAnalyzeComplete || isAnalysisFailed,
      pulse: isAnalyzing,
      failed: isAnalysisFailed,
      dotClass: analyzedAccent.dotClass,
      glowColor: analyzedAccent.glowColor,
      textClass: analyzedAccent.textClass,
      inactiveDotClass: analyzedAccent.inactiveDotClass,
      ringClass: analyzedAccent.ringClass,
    },
    {
      key: 'optimized',
      label: isOptimizationFailed
        ? 'Failed'
        : isOptimizedComplete
          ? 'Optimized'
          : 'Optimizing',
      active: isOptimizedComplete || isOptimizationFailed,
      pulse: isOptimizing,
      failed: isOptimizationFailed,
      dotClass: optimizedAccent.dotClass,
      glowColor: optimizedAccent.glowColor,
      textClass: optimizedAccent.textClass,
      inactiveDotClass: optimizedAccent.inactiveDotClass,
      ringClass: optimizedAccent.ringClass,
    },
    {
      key: 'applied',
      label: 'Applied',
      active: isApplied,
      pulse: false,
      failed: false,
      dotClass: appliedAccent.dotClass,
      glowColor: appliedAccent.glowColor,
      textClass: appliedAccent.textClass,
      inactiveDotClass: appliedAccent.inactiveDotClass,
      ringClass: appliedAccent.ringClass,
    },
    {
      key: 'interview-scheduled',
      label: 'Interview Scheduled',
      active: isInterviewScheduled,
      pulse: false,
      failed: false,
      dotClass: interviewScheduledAccent.dotClass,
      glowColor: interviewScheduledAccent.glowColor,
      textClass: interviewScheduledAccent.textClass,
      inactiveDotClass: interviewScheduledAccent.inactiveDotClass,
      ringClass: interviewScheduledAccent.ringClass,
    },
    {
      key: 'interviewed',
      label: 'Interviewed',
      active: isInterviewed,
      pulse: false,
      failed: false,
      dotClass: interviewedAccent.dotClass,
      glowColor: interviewedAccent.glowColor,
      textClass: interviewedAccent.textClass,
      inactiveDotClass: interviewedAccent.inactiveDotClass,
      ringClass: interviewedAccent.ringClass,
    },
    {
      key: 'offer-made',
      label: 'Offer Made',
      active: isOfferMade,
      pulse: false,
      failed: false,
      dotClass: offerAccent.dotClass,
      glowColor: offerAccent.glowColor,
      textClass: offerAccent.textClass,
      inactiveDotClass: offerAccent.inactiveDotClass,
      ringClass: offerAccent.ringClass,
    },
  ];

  // Explicit gradient classes (Tailwind can't purge dynamic classes)
  // Smooth gradients - colors blend gradually across the line
  const solidGradients: Record<string, Record<string, string>> = {
    'bg-gray-400': {
      'bg-blue-400':
        'bg-gradient-to-r from-gray-400 from-15% via-slate-400/60 via-50% to-blue-400 to-85%',
      'bg-red-400':
        'bg-gradient-to-r from-gray-400 from-15% via-rose-300/60 via-50% to-red-400 to-85%',
    },
    'bg-yellow-400': {
      'bg-orange-400':
        'bg-gradient-to-r from-yellow-400 from-15% via-amber-400/60 via-50% to-orange-400 to-85%',
      'bg-blue-400':
        'bg-gradient-to-r from-yellow-400 from-15% via-sky-500/55 via-50% to-blue-400 to-85%',
    },
    'bg-blue-400': {
      'bg-amber-400':
        'bg-gradient-to-r from-blue-400 from-15% via-sky-400/55 via-50% to-amber-400 to-85%',
      'bg-purple-400':
        'bg-gradient-to-r from-blue-400 from-15% via-indigo-400/60 via-50% to-purple-400 to-85%',
    },
    'bg-amber-400': {
      'bg-yellow-400':
        'bg-gradient-to-r from-amber-400 from-15% via-amber-300/60 via-50% to-yellow-400 to-85%',
      'bg-emerald-400':
        'bg-gradient-to-r from-amber-400 from-15% via-lime-400/60 via-50% to-emerald-400 to-85%',
    },
    'bg-orange-400': {
      'bg-blue-400':
        'bg-gradient-to-r from-orange-400 from-15% via-amber-400/55 via-45% to-blue-400 to-85%',
    },
  };
  // Fade-out gradients for transition from completed to incomplete
  const fadeGradients: Record<string, string> = {
    'bg-gray-400':
      'bg-gradient-to-r from-gray-400 via-gray-400/50 via-20% to-muted-foreground/20',
    'bg-amber-400':
      'bg-gradient-to-r from-amber-400 via-amber-400/20 via-20% to-muted-foreground/20',
    'bg-yellow-400':
      'bg-gradient-to-r from-yellow-400 via-yellow-400/50 via-20% to-muted-foreground/20',
    'bg-blue-400':
      'bg-gradient-to-r from-blue-400 via-blue-400/50 via-20% to-muted-foreground/20',
    'bg-orange-400':
      'bg-gradient-to-r from-orange-400 via-orange-400/50 via-20% to-muted-foreground/20',
    'bg-purple-400':
      'bg-gradient-to-r from-purple-400 via-purple-400/50 via-20% to-muted-foreground/20',
    'bg-red-400':
      'bg-gradient-to-r from-red-400 via-red-400/50 via-20% to-muted-foreground/20',
  };

  // Determine connector style and thickness
  const getConnectorStyle = (
    currentStage: (typeof stages)[0],
    nextStage: (typeof stages)[0] | undefined,
  ) => {
    if (!currentStage.active) {
      // After incomplete stages - thin muted line
      return { className: 'bg-muted-foreground/20', thin: true };
    }
    // After a failed stage, always show thin muted line (no gradient forward)
    if (currentStage.failed) {
      return { className: 'bg-muted-foreground/20', thin: true };
    }
    if (nextStage?.active) {
      // Both complete - solid gradient, thick
      const gradient =
        solidGradients[currentStage.dotClass]?.[nextStage.dotClass];
      return { className: gradient || 'bg-muted-foreground/20', thin: false };
    }
    // Current complete, next incomplete - fade gradient, half thick half thin
    const fadeGradient = fadeGradients[currentStage.dotClass];
    return {
      className: fadeGradient || 'bg-muted-foreground/20',
      thin: 'transition',
    };
  };

  return (
    <div
      className={cn(
        'mb-4 w-full rounded-lg border border-border/70 bg-muted/20 px-8 py-6 shadow-none',
        className,
      )}
      data-testid="job-lead-progress-tracker"
    >
      <div className="flex w-full flex-col gap-2">
        <div className="flex w-full items-center">
          {stages.map((stage, index) => {
            const isLast = index === stages.length - 1;
            const nextStage = stages[index + 1];
            const connectorStyle = getConnectorStyle(stage, nextStage);
            const connectorGradientClass = connectorStyle.className;
            return (
              <Fragment key={stage.key}>
                <div
                  className={cn(
                    'relative flex items-center justify-center rounded-full p-[3px]',
                    stage.active ? 'bg-transparent' : 'bg-muted/20',
                  )}
                >
                  {stage.active && (
                    <div
                      className={cn(
                        'pointer-events-none absolute -inset-2 rounded-full blur-lg opacity-45',
                        stage.dotClass,
                      )}
                    />
                  )}
                  {stage.pulse && !stage.active ? (
                    <div className="relative z-10">
                      <ProgressRefreshIcon />
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'relative z-10 flex size-2.5 shrink-0 rounded-full ring-2 ring-muted/50',
                        stage.active
                          ? stage.dotClass
                          : 'bg-muted-foreground/30',
                        !stage.active && 'size-2',
                        stage.active && stage.textClass,
                        stage.active && stage.ringClass,
                        stage.pulse && 'animate-pulse',
                      )}
                      style={
                        stage.active
                          ? {
                              boxShadow: `0 0 0 6px ${stage.glowColor}`,
                            }
                          : undefined
                      }
                    />
                  )}
                </div>
                {!isLast && (
                  <div className="relative mx-0 flex-1">
                    {connectorStyle.thin !== true && (
                      <div
                        className={cn(
                          'pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full blur-sm opacity-80',
                          connectorGradientClass,
                          connectorStyle.thin === 'transition' && 'opacity-65',
                        )}
                      />
                    )}
                    <div
                      className={cn(
                        'relative h-0.5 rounded-full',
                        connectorGradientClass,
                      )}
                    />
                  </div>
                )}
              </Fragment>
            );
          })}
        </div>
        <div className="relative h-4 w-full">
          {stages.map((stage, index) => {
            const isFirst = index === 0;
            const isLast = index === stages.length - 1;
            const stageCount = Math.max(stages.length - 1, 1);
            const positionPercent = (index / stageCount) * 100;
            const centerCorrectionPx = (0.5 - index / stageCount) * 8;
            const interviewedNudgePx = stage.key === 'interviewed' ? -1.5 : 0;

            return (
              <div
                className={cn(
                  'absolute text-[10px] font-semibold uppercase tracking-wide leading-tight whitespace-nowrap [text-shadow:0_0_8px_hsl(var(--background))]',
                  stage.active ? stage.textClass : 'text-muted-foreground/40',
                  stage.pulse && 'animate-pulse',
                )}
                key={`${stage.key}-label`}
                style={
                  isFirst
                    ? { left: 0, top: '-3px' }
                    : isLast
                      ? { right: 0, top: '-3px' }
                      : {
                          top: '-3px',
                          left: `${positionPercent}%`,
                          transform: `translateX(${centerCorrectionPx - 2.5 + interviewedNudgePx}px)`,
                        }
                }
              >
                {stage.label}
              </div>
            );
          })}
        </div>
        {isFailed && (
          <div className="mt-3 flex items-center justify-center">
            <button
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border border-red-500/30 px-3 py-1',
                'text-xs font-medium text-red-500 transition-colors',
                'hover:bg-red-500/10 hover:text-red-600',
                'disabled:opacity-50',
              )}
              disabled={isRetrying}
              onClick={async () => {
                setIsRetrying(true);
                setLiveJobLeadStatus(JobLeadStatus.ANALYZING);
                setAnalyzeProgress(0);
                setOptimizedProgress(0);
                try {
                  const { reoptimizeJobLead } =
                    await import('@/lib/job-leads/reoptimize');
                  await reoptimizeJobLead({ jobLeadId });
                } catch {
                  // Status will update via realtime events
                } finally {
                  setIsRetrying(false);
                }
              }}
              type="button"
            >
              {isRetrying ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <RefreshCw className="size-3" />
              )}
              Retry {isAnalysisFailed ? 'Analysis' : 'Optimization'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export { JobLeadProgressTracker };
