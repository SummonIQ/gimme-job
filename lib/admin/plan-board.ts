import 'server-only';

import { PlanBoardEventType } from '@/generated/prisma/client';
import type {
  PlanBoardEventView,
  PlanBoardHealthReport,
  PlanBoardHealthTask,
  PlanBoardPhaseProgress,
  PlanBoardRecentAgent,
  PlanBoardSnapshot,
  PlanBoardSyncReport,
  PlanBoardTaskStatus,
  PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';
import { getPlanBoardClaimState } from '@/lib/admin/plan-board-assignments';
import {
  isMissingPlanBoardAssignmentSemanticsColumnError,
  planBoardHasAssignmentSemantics,
} from '@/lib/admin/plan-board-db';
import { db } from '@/lib/db/client';
import {
  PLAN_BOARD_TASK_EVENT,
  publishPlanBoardEvent,
} from '@/lib/admin/summonflow';

const BLOCKED_ATTENTION_THRESHOLD_HOURS = 24;
const STALE_ASSIGNMENT_THRESHOLD_HOURS = 24;
const TASK_AGING_THRESHOLD_HOURS = 72;
const MAX_HEALTH_TASKS = 5;
const MAX_RECENT_AGENTS = 5;

// Canonical agent handles. The plan-board surface treats anything outside
// this set as noise — email-shaped handles (Steven's auth email got logged
// once as an "agent") and bare-name aliases (`claude` → `claude-code`) are
// either canonicalized or filtered out. Add a new handle here when a new
// agent enters the repo; agents that don't match are silently dropped from
// the Recent Agents panel so it stays an honest view of who's actually
// working.
const CANONICAL_AGENT_HANDLES = new Set(['claude-code', 'codex', 'copilot']);

const AGENT_HANDLE_ALIASES: Record<string, string> = {
  claude: 'claude-code',
  'claude-code-1m': 'claude-code',
  'claude-opus': 'claude-code',
  claudie: 'claude-code',
};

function canonicalizeAgentHandle(handle: string | null): string | null {
  if (!handle) return null;
  const trimmed = handle.trim();
  if (!trimmed) return null;
  // Drop email-shaped values (Steven's auth email occasionally gets recorded
  // as an "agent" handle by the API path that defaults `agentHandle` from
  // the session user).
  if (trimmed.includes('@')) return null;
  const lower = trimmed.toLowerCase();
  const aliased = AGENT_HANDLE_ALIASES[lower] ?? lower;
  return CANONICAL_AGENT_HANDLES.has(aliased) ? aliased : null;
}

// Phase-level default labels. A task without an explicit `- Labels:` line
// inherits its phase's defaults so the kanban surface always has at least
// one categorical tag. Per-task `- Labels:` overrides these — no merge.
const PHASE_DEFAULT_LABELS: Record<string, readonly string[]> = {
  P0: ['Foundation'],
  P1: ['Provenance', 'Data Model'],
  P2: ['Reconstruction Plane'],
  P3: ['Greenhouse Runtime'],
  P4: ['Ashby Runtime'],
  P5: ['Desktop Shell'],
  P6: ['Observability'],
  P7: ['Evaluation'],
  P8: ['Trust'],
  P9: ['Pre-submit'],
  P10: ['Outcomes'],
  P11: ['Live Run'],
  P12: ['Recruiter Response'],
  P13: ['Benchmark'],
  P14: ['Live Run'],
  P15: ['Agent Coordination'],
  P16: ['Ops Safety'],
  P17: ['Provider Runtime'],
  P18: ['Job Scrapers'],
};

export type {
  PlanBoardEventView,
  PlanBoardSnapshot,
  PlanBoardSyncReport,
  PlanBoardTaskView,
};

export async function getPlanBoardTasks(): Promise<PlanBoardTaskView[]> {
  const snapshot = await getPlanBoardSnapshot();
  return snapshot.tasks;
}

export async function getPlanBoardSnapshot(): Promise<PlanBoardSnapshot> {
  const taskRows = await findPlanBoardTaskRows();
  const tasks = taskRows.map(row => {
    const claimedAt = getClaimedAt(row);
    const assignmentReason = getOptionalRowString(row, 'assignmentReason');
    const claimState = getPlanBoardClaimState({
      agentHandle: row.agentHandle ?? null,
      assignmentReason,
      claimedAt,
      status: row.status,
    });

    const labels =
      row.labels && row.labels.length > 0
        ? row.labels
        : [...(PHASE_DEFAULT_LABELS[row.phaseId] ?? [])];

    return {
      acceptance: row.acceptance ?? null,
      agentHandle: row.agentHandle ?? null,
      assignmentReason,
      claimedAt: claimedAt?.toISOString() ?? null,
      claimState,
      dependsOn: row.dependsOn ?? [],
      events:
        row.events?.map(event => ({
          agentHandle: event.agentHandle,
          assignmentReason: getOptionalRowString(event, 'assignmentReason'),
          createdAt: event.createdAt.toISOString(),
          eventType: event.eventType,
          fromStatus: event.fromStatus,
          id: event.id,
          message: event.message,
          nextAgentHandle: getOptionalRowString(event, 'nextAgentHandle'),
          previousAgentHandle: getOptionalRowString(
            event,
            'previousAgentHandle',
          ),
          toStatus: event.toStatus,
        })) ?? [],
      files: row.files ?? [],
      isClaimStale: claimState === 'STALE',
      labels,
      markdownStatus: row.status,
      notes: row.notes ?? null,
      phaseId: row.phaseId,
      phaseTitle: row.phaseTitle,
      sortOrder: row.sortOrder ?? 0,
      status: row.status,
      taskId: row.taskId,
      testsRequired: row.testsRequired ?? null,
      title: row.title,
      updatedAt: row.updatedAt.toISOString(),
    } satisfies PlanBoardTaskView;
  });

  tasks.sort((a, b) => {
    if (a.phaseId !== b.phaseId) return a.phaseId.localeCompare(b.phaseId);
    return a.sortOrder - b.sortOrder;
  });

  return {
    healthReport: buildPlanBoardHealthReport(tasks),
    syncReport: {
      isSynced: true,
      missingLiveTasks: [],
      orphanedLiveTasks: [],
      possibleRenamedTaskIds: [],
      syncedTaskCount: tasks.length,
      totalLiveTasks: tasks.length,
      totalMarkdownTasks: tasks.length,
    },
    tasks,
  };
}

async function findPlanBoardTaskRows() {
  const hasAssignmentSemantics = await planBoardHasAssignmentSemantics();
  const buildSelect = (includeAssignmentSemantics: boolean) => ({
    acceptance: true,
    agentHandle: true,
    dependsOn: true,
    events: {
      orderBy: { createdAt: 'desc' as const },
      select: {
        agentHandle: true,
        createdAt: true,
        eventType: true,
        fromStatus: true,
        id: true,
        message: true,
        toStatus: true,
        ...(includeAssignmentSemantics
          ? {
              assignmentReason: true,
              nextAgentHandle: true,
              previousAgentHandle: true,
            }
          : {}),
      },
      take: 10,
    },
    files: true,
    labels: true,
    notes: true,
    phaseId: true,
    phaseTitle: true,
    sortOrder: true,
    status: true,
    taskId: true,
    testsRequired: true,
    title: true,
    updatedAt: true,
    ...(includeAssignmentSemantics ? { assignmentReason: true } : {}),
  });

  if (hasAssignmentSemantics) {
    try {
      return await db.planBoardTask.findMany({
        select: {
          ...buildSelect(true),
          claimedAt: true,
        },
      });
    } catch (error) {
      if (!isMissingPlanBoardAssignmentSemanticsColumnError(error)) {
        throw error;
      }
    }
  }

  return db.planBoardTask.findMany({
    select: buildSelect(false),
  });
}

function getClaimedAt(
  row:
    | {
        claimedAt?: Date | null;
      }
    | undefined,
): Date | null {
  if (!row || !('claimedAt' in row)) {
    return null;
  }

  return row.claimedAt ?? null;
}

function getOptionalRowString<
  T extends {
    assignmentReason?: string | null;
    nextAgentHandle?: string | null;
    previousAgentHandle?: string | null;
  },
>(
  row: T | undefined,
  key: 'assignmentReason' | 'nextAgentHandle' | 'previousAgentHandle',
): string | null {
  if (!row || !(key in row)) {
    return null;
  }

  return row[key] ?? null;
}

interface UpdatePlanBoardTaskInput {
  agentHandle?: string | null;
  eventActor?: string | null;
  eventType?: PlanBoardEventType;
  message?: string | null;
  notes?: string | null;
  status?: PlanBoardTaskStatus;
  taskId: string;
  title?: string;
  description?: string | null;
  acceptance?: string | null;
  testsRequired?: string | null;
  phaseId?: string;
  phaseTitle?: string;
  labels?: string[];
  files?: string[];
  dependsOn?: string[];
  sortOrder?: number;
}

/**
 * Canonical write path for plan-board task state.
 *
 * Updates the row, records a PlanBoardEvent (when status changes), and
 * publishes the SummonFlow broadcast so any open board client reflects
 * the change without polling. Use this from the API route, from agent
 * scripts — anywhere a task state changes. Bypassing it (raw
 * db.planBoardTask writes) will silently break realtime updates.
 */
export async function updatePlanBoardTaskState(
  input: UpdatePlanBoardTaskInput,
): Promise<PlanBoardTaskView> {
  const existingTask = await db.planBoardTask.findUnique({
    select: { status: true },
    where: { taskId: input.taskId },
  });
  if (!existingTask) {
    throw new Error(`Plan-board task ${input.taskId} not found`);
  }

  const fromStatus = existingTask.status;
  const nextStatus = input.status ?? fromStatus;
  const eventActor = input.eventActor ?? input.agentHandle ?? 'system';
  const statusChanged = input.status !== undefined && input.status !== fromStatus;
  const eventType: PlanBoardEventType =
    input.eventType ?? (statusChanged ? 'STATUS_CHANGED' : 'NOTE_ADDED');

  const eventCreate =
    statusChanged ||
    input.eventType !== undefined ||
    input.message !== undefined
      ? {
          create: {
            agentHandle: eventActor,
            eventType,
            fromStatus,
            message: input.message ?? null,
            toStatus: nextStatus,
          },
        }
      : undefined;

  await db.planBoardTask.update({
    data: {
      ...(input.agentHandle !== undefined && {
        agentHandle: input.agentHandle,
      }),
      ...(eventCreate && { events: eventCreate }),
      ...(input.notes !== undefined && { notes: input.notes }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.title !== undefined && { title: input.title }),
      ...(input.description !== undefined && {
        description: input.description,
      }),
      ...(input.acceptance !== undefined && { acceptance: input.acceptance }),
      ...(input.testsRequired !== undefined && {
        testsRequired: input.testsRequired,
      }),
      ...(input.phaseId !== undefined && { phaseId: input.phaseId }),
      ...(input.phaseTitle !== undefined && { phaseTitle: input.phaseTitle }),
      ...(input.labels !== undefined && { labels: input.labels }),
      ...(input.files !== undefined && { files: input.files }),
      ...(input.dependsOn !== undefined && { dependsOn: input.dependsOn }),
      ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
    },
    where: { taskId: input.taskId },
  });

  const updatedTask = await findPlanBoardTaskView(input.taskId);

  await publishPlanBoardEvent({
    data: {
      event: {
        agentHandle: eventActor,
        eventType,
        fromStatus,
        message: input.message ?? null,
        toStatus: nextStatus,
      },
      task: updatedTask,
    },
    event: PLAN_BOARD_TASK_EVENT,
  });

  return updatedTask;
}

export async function findPlanBoardTaskView(
  taskId: string,
): Promise<PlanBoardTaskView> {
  const tasks = await getPlanBoardTasks();
  const task = tasks.find(candidate => candidate.taskId === taskId);
  if (!task) {
    throw new Error(`Task ${taskId} not found in plan-board snapshot`);
  }
  return task;
}

export function buildPlanBoardHealthReport(
  tasks: PlanBoardTaskView[],
  now = new Date(),
): PlanBoardHealthReport {
  const activeTasks = tasks.filter(task => task.status !== 'DONE');
  const blockedTasks = tasks.filter(task => task.status === 'BLOCKED');
  const inProgressTasks = tasks.filter(
    task => task.status === 'IN_PROGRESS' && task.agentHandle,
  );
  const agedTasks = activeTasks
    .map(task => toHealthTask(task, now))
    .filter(
      task =>
        task.ageHours !== null && task.ageHours >= TASK_AGING_THRESHOLD_HOURS,
    )
    .sort(compareHealthTaskAgeDesc)
    .slice(0, MAX_HEALTH_TASKS);
  const staleAssignments = inProgressTasks
    .map(task => toHealthTask(task, now))
    .filter(
      task =>
        task.ageHours !== null &&
        task.ageHours >= STALE_ASSIGNMENT_THRESHOLD_HOURS,
    )
    .sort(compareHealthTaskAgeDesc)
    .slice(0, MAX_HEALTH_TASKS);

  return {
    blockedAge: {
      attentionThresholdHours: BLOCKED_ATTENTION_THRESHOLD_HOURS,
      blockedCount: blockedTasks.length,
      oldestBlockedTask:
        blockedTasks
          .map(task => toHealthTask(task, now))
          .sort(compareHealthTaskAgeDesc)[0] ?? null,
    },
    phaseProgress: buildPhaseProgress(tasks),
    recentAgents: buildRecentAgents(tasks),
    staleAssignments: {
      staleCount: staleAssignments.length,
      tasks: staleAssignments,
      thresholdHours: STALE_ASSIGNMENT_THRESHOLD_HOURS,
    },
    taskAging: {
      agingCount: agedTasks.length,
      oldestTask: agedTasks[0] ?? null,
      thresholdHours: TASK_AGING_THRESHOLD_HOURS,
    },
  };
}

function buildPhaseProgress(
  tasks: PlanBoardTaskView[],
): PlanBoardHealthReport['phaseProgress'] {
  const phases = new Map<string, PlanBoardPhaseProgress>();

  for (const task of tasks) {
    const phase = phases.get(task.phaseId) ?? {
      blockedCount: 0,
      doneCount: 0,
      inProgressCount: 0,
      phaseId: task.phaseId,
      phaseTitle: task.phaseTitle,
      progressPercent: 0,
      todoCount: 0,
      totalCount: 0,
    };

    phase.totalCount += 1;
    if (task.status === 'BLOCKED') {
      phase.blockedCount += 1;
    }
    if (task.status === 'DONE') {
      phase.doneCount += 1;
    }
    if (task.status === 'IN_PROGRESS') {
      phase.inProgressCount += 1;
    }
    if (task.status === 'TODO') {
      phase.todoCount += 1;
    }

    phases.set(task.phaseId, phase);
  }

  return [...phases.values()]
    .map(phase => ({
      ...phase,
      progressPercent:
        phase.totalCount === 0
          ? 0
          : Math.round((phase.doneCount / phase.totalCount) * 100),
    }))
    .sort(comparePhaseIds);
}

function buildRecentAgents(tasks: PlanBoardTaskView[]): PlanBoardRecentAgent[] {
  const agents = new Map<string, PlanBoardRecentAgent>();

  for (const task of tasks) {
    const taskHandle = canonicalizeAgentHandle(task.agentHandle);
    if (taskHandle && task.status !== 'DONE') {
      const agent = getRecentAgent(agents, taskHandle);
      agent.activeTaskCount += 1;
      agent.lastActiveAt = getLaterIsoDate(agent.lastActiveAt, task.updatedAt);
    }

    for (const event of task.events) {
      const eventHandle = canonicalizeAgentHandle(event.agentHandle);
      if (!eventHandle) {
        continue;
      }

      const agent = getRecentAgent(agents, eventHandle);
      agent.eventCount += 1;
      agent.lastActiveAt = getLaterIsoDate(agent.lastActiveAt, event.createdAt);
    }
  }

  return [...agents.values()]
    .sort((firstAgent, secondAgent) => {
      const dateDelta =
        getDateMs(secondAgent.lastActiveAt) -
        getDateMs(firstAgent.lastActiveAt);

      if (dateDelta !== 0) {
        return dateDelta;
      }

      return firstAgent.agentHandle.localeCompare(secondAgent.agentHandle);
    })
    .slice(0, MAX_RECENT_AGENTS);
}

function getRecentAgent(
  agents: Map<string, PlanBoardRecentAgent>,
  agentHandle: string,
): PlanBoardRecentAgent {
  const agent = agents.get(agentHandle);

  if (agent) {
    return agent;
  }

  const nextAgent = {
    activeTaskCount: 0,
    agentHandle,
    eventCount: 0,
    lastActiveAt: null,
  };
  agents.set(agentHandle, nextAgent);
  return nextAgent;
}

function toHealthTask(task: PlanBoardTaskView, now: Date): PlanBoardHealthTask {
  return {
    ageHours: getAgeHours(task.updatedAt, now),
    agentHandle: task.agentHandle,
    phaseId: task.phaseId,
    status: task.status,
    taskId: task.taskId,
    title: task.title,
    updatedAt: task.updatedAt,
  };
}

function compareHealthTaskAgeDesc(
  firstTask: PlanBoardHealthTask,
  secondTask: PlanBoardHealthTask,
): number {
  return (secondTask.ageHours ?? -1) - (firstTask.ageHours ?? -1);
}

function comparePhaseIds(
  firstPhase: PlanBoardPhaseProgress,
  secondPhase: PlanBoardPhaseProgress,
): number {
  return (
    getPhaseNumber(firstPhase.phaseId) - getPhaseNumber(secondPhase.phaseId)
  );
}

function getPhaseNumber(phaseId: string): number {
  const phaseMatch = phaseId.match(/^P(\d+)$/);
  return phaseMatch ? Number(phaseMatch[1]) : Number.MAX_SAFE_INTEGER;
}

function getAgeHours(value: string | null, now: Date): number | null {
  const valueMs = getDateMs(value);

  if (valueMs === 0) {
    return null;
  }

  return Math.max(0, Math.floor((now.getTime() - valueMs) / 3_600_000));
}

function getLaterIsoDate(
  firstValue: string | null,
  secondValue: string | null,
): string | null {
  if (getDateMs(secondValue) > getDateMs(firstValue)) {
    return secondValue;
  }

  return firstValue;
}

function getDateMs(value: string | null): number {
  if (!value) {
    return 0;
  }

  const valueMs = Date.parse(value);
  return Number.isNaN(valueMs) ? 0 : valueMs;
}

