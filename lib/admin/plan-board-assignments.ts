import type {
  PlanBoardClaimState,
  PlanBoardTaskStatus,
} from '@/lib/admin/plan-board-types';

export const PLAN_BOARD_STALE_CLAIM_MS = 4 * 60 * 60 * 1000;

export interface PlanBoardAssignmentState {
  agentHandle: string | null;
  assignmentReason: string | null;
  claimedAt: Date | null;
  status: PlanBoardTaskStatus;
}

interface BuildAssignmentUpdateInput {
  assignmentReason: string | null | undefined;
  currentTask: PlanBoardAssignmentState | null;
  message: string | null | undefined;
  nextAgentHandle: string | null | undefined;
  nextStatus: PlanBoardTaskStatus;
  now: Date;
}

export interface PlanBoardAssignmentUpdate {
  agentHandle: string | null;
  assignmentChanged: boolean;
  assignmentReason: string | null;
  claimedAt: Date | null;
  nextAgentHandle: string | null;
  previousAgentHandle: string | null;
}

export function buildPlanBoardAssignmentUpdate({
  assignmentReason,
  currentTask,
  message,
  nextAgentHandle,
  nextStatus,
  now,
}: BuildAssignmentUpdateInput): PlanBoardAssignmentUpdate {
  const previousAgentHandle = currentTask?.agentHandle ?? null;
  const hasNextAgentHandle = nextAgentHandle !== undefined;
  const agentHandle = hasNextAgentHandle
    ? nextAgentHandle
    : previousAgentHandle;
  const assignmentChanged =
    hasNextAgentHandle && previousAgentHandle !== agentHandle;
  const shouldRefreshClaim =
    nextStatus === 'IN_PROGRESS' &&
    Boolean(agentHandle) &&
    (!currentTask?.claimedAt ||
      currentTask.status !== 'IN_PROGRESS' ||
      assignmentChanged);

  return {
    agentHandle,
    assignmentChanged,
    assignmentReason: resolveAssignmentReason({
      assignmentChanged,
      assignmentReason,
      currentTask,
      message,
    }),
    claimedAt: shouldRefreshClaim ? now : (currentTask?.claimedAt ?? null),
    nextAgentHandle: agentHandle,
    previousAgentHandle,
  };
}

export function getPlanBoardClaimState(
  task: PlanBoardAssignmentState,
  now: Date = new Date(),
): PlanBoardClaimState {
  if (!task.agentHandle) {
    return 'UNASSIGNED';
  }

  if (task.status !== 'IN_PROGRESS') {
    return 'ASSIGNED';
  }

  if (
    task.claimedAt &&
    now.getTime() - task.claimedAt.getTime() > PLAN_BOARD_STALE_CLAIM_MS
  ) {
    return 'STALE';
  }

  return 'CLAIMED';
}

function resolveAssignmentReason({
  assignmentChanged,
  assignmentReason,
  currentTask,
  message,
}: {
  assignmentChanged: boolean;
  assignmentReason: string | null | undefined;
  currentTask: PlanBoardAssignmentState | null;
  message: string | null | undefined;
}) {
  if (assignmentReason !== undefined) {
    return assignmentReason;
  }

  if (assignmentChanged) {
    return message ?? null;
  }

  return currentTask?.assignmentReason ?? null;
}
