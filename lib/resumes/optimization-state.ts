import { ResumeOptimizationStatus } from '@/generated/prisma/browser';

export const RESUME_OPTIMIZATION_STATUS_ORDER: Readonly<
  Record<ResumeOptimizationStatus, number>
> = {
  [ResumeOptimizationStatus.QUEUED]: 0,
  [ResumeOptimizationStatus.PROCESSING]: 1,
  [ResumeOptimizationStatus.REVISING]: 2,
  [ResumeOptimizationStatus.ANALYZING]: 3,
  [ResumeOptimizationStatus.ANALYZED]: 4,
  [ResumeOptimizationStatus.OPTIMIZING]: 5,
  [ResumeOptimizationStatus.COMPLETED]: 6,
  [ResumeOptimizationStatus.FAILED]: 7,
};

export const isTerminalResumeOptimizationStatus = (
  status: ResumeOptimizationStatus,
): boolean => {
  return (
    status === ResumeOptimizationStatus.COMPLETED ||
    status === ResumeOptimizationStatus.FAILED
  );
};

export const isActiveResumeOptimizationStatus = (
  status?: ResumeOptimizationStatus,
): boolean => {
  if (!status) return false;
  return !isTerminalResumeOptimizationStatus(status);
};

export const mergeResumeOptimizationProgressState = ({
  incomingProgress,
  incomingStatus,
  previousProgress,
  previousStatus,
}: {
  incomingProgress: number;
  incomingStatus: ResumeOptimizationStatus;
  previousProgress: number;
  previousStatus: ResumeOptimizationStatus;
}): {
  progress: number;
  status: ResumeOptimizationStatus;
} => {
  const progress = Math.max(incomingProgress, previousProgress);
  const previousRank = RESUME_OPTIMIZATION_STATUS_ORDER[previousStatus];
  const incomingRank = RESUME_OPTIMIZATION_STATUS_ORDER[incomingStatus];
  const status = incomingRank >= previousRank ? incomingStatus : previousStatus;

  return { progress, status };
};
