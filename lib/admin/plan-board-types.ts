export const PLAN_BOARD_STATUSES = [
  'TODO',
  'IN_PROGRESS',
  'BLOCKED',
  'DONE',
] as const;

export type PlanBoardTaskStatus = (typeof PLAN_BOARD_STATUSES)[number];

export const PLAN_BOARD_CLAIM_STATES = [
  'UNASSIGNED',
  'ASSIGNED',
  'CLAIMED',
  'STALE',
] as const;

export type PlanBoardClaimState = (typeof PLAN_BOARD_CLAIM_STATES)[number];

export const PLAN_BOARD_EVENT_TYPES = [
  'STATUS_CHANGED',
  'AGENT_ASSIGNED',
  'NOTE_ADDED',
  'SIMULATION_STEP',
] as const;

export type PlanBoardTaskEventType = (typeof PLAN_BOARD_EVENT_TYPES)[number];

export interface PlanBoardTaskUpdatePayload {
  agentHandle?: string | null;
  eventType: PlanBoardTaskEventType;
  message?: string | null;
  notes?: string | null;
  status: PlanBoardTaskStatus;
}

export interface ParsedPlanTask {
  acceptance: string | null;
  dependsOn: string[];
  files: string[];
  labels: string[];
  markdownStatus: PlanBoardTaskStatus;
  phaseId: string;
  phaseTitle: string;
  sortOrder: number;
  taskId: string;
  testsRequired: string | null;
  title: string;
}

export interface PlanBoardEventView {
  agentHandle: string | null;
  assignmentReason: string | null;
  createdAt: string;
  eventType: string;
  fromStatus: PlanBoardTaskStatus | null;
  id: string;
  message: string | null;
  nextAgentHandle: string | null;
  previousAgentHandle: string | null;
  toStatus: PlanBoardTaskStatus | null;
}

export interface PlanBoardTaskView extends ParsedPlanTask {
  agentHandle: string | null;
  assignmentReason: string | null;
  claimedAt: string | null;
  claimState: PlanBoardClaimState;
  events: PlanBoardEventView[];
  isClaimStale: boolean;
  notes: string | null;
  status: PlanBoardTaskStatus;
  updatedAt: string | null;
}

export interface PlanBoardTaskDetailDiffRow {
  label: string;
  value: string;
}

export interface PlanBoardLiveTaskState {
  agentHandle: string | null;
  status: PlanBoardTaskStatus;
  taskId: string;
  updatedAt: string | null;
}

export interface PlanBoardMissingTaskState {
  phaseId: string;
  taskId: string;
  title: string;
}

export interface PlanBoardOrphanedTaskState extends PlanBoardLiveTaskState {
  phaseId: string | null;
}

export interface PlanBoardRenameHint {
  candidateTaskIds: string[];
  orphanedTaskId: string;
  phaseId: string;
}

export interface PlanBoardSyncReport {
  isSynced: boolean;
  missingLiveTasks: PlanBoardMissingTaskState[];
  orphanedLiveTasks: PlanBoardOrphanedTaskState[];
  possibleRenamedTaskIds: PlanBoardRenameHint[];
  syncedTaskCount: number;
  totalLiveTasks: number;
  totalMarkdownTasks: number;
}

export interface PlanBoardHealthTask {
  ageHours: number | null;
  agentHandle: string | null;
  phaseId: string;
  status: PlanBoardTaskStatus;
  taskId: string;
  title: string;
  updatedAt: string | null;
}

export interface PlanBoardPhaseProgress {
  blockedCount: number;
  doneCount: number;
  inProgressCount: number;
  phaseId: string;
  phaseTitle: string;
  progressPercent: number;
  todoCount: number;
  totalCount: number;
}

export interface PlanBoardRecentAgent {
  activeTaskCount: number;
  agentHandle: string;
  eventCount: number;
  lastActiveAt: string | null;
}

export interface PlanBoardHealthReport {
  blockedAge: {
    attentionThresholdHours: number;
    blockedCount: number;
    oldestBlockedTask: PlanBoardHealthTask | null;
  };
  phaseProgress: PlanBoardPhaseProgress[];
  recentAgents: PlanBoardRecentAgent[];
  staleAssignments: {
    staleCount: number;
    tasks: PlanBoardHealthTask[];
    thresholdHours: number;
  };
  taskAging: {
    agingCount: number;
    oldestTask: PlanBoardHealthTask | null;
    thresholdHours: number;
  };
}

export interface PlanBoardSnapshot {
  healthReport: PlanBoardHealthReport;
  syncReport: PlanBoardSyncReport;
  tasks: PlanBoardTaskView[];
}

export interface PlanBoardRealtimePayload {
  event: {
    agentHandle: string | null;
    assignmentReason: string | null;
    eventType: string;
    fromStatus: PlanBoardTaskStatus | null;
    message: string | null;
    nextAgentHandle: string | null;
    previousAgentHandle: string | null;
    toStatus: PlanBoardTaskStatus | null;
  };
  task: PlanBoardTaskView;
}
