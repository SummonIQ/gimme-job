import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { PlanBoardEventType } from '@/generated/prisma/client';
import { getPlanBoardTasks } from '@/lib/admin/plan-board';
import { buildPlanBoardAssignmentUpdate } from '@/lib/admin/plan-board-assignments';
import {
  isMissingPlanBoardAssignmentSemanticsColumnError,
  planBoardHasAssignmentSemantics,
} from '@/lib/admin/plan-board-db';
import type { PlanBoardTaskView } from '@/lib/admin/plan-board-types';
import { isAdminUser } from '@/lib/admin/scrape-service';
import {
  PLAN_BOARD_TASK_EVENT,
  publishPlanBoardEvent,
} from '@/lib/admin/summonflow';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const updateTaskSchema = z.object({
  agentHandle: z.string().trim().max(80).nullable().optional(),
  assignmentReason: z.string().trim().max(500).nullable().optional(),
  eventType: z
    .enum(['STATUS_CHANGED', 'AGENT_ASSIGNED', 'NOTE_ADDED', 'SIMULATION_STEP'])
    .optional(),
  message: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE']).optional(),
  title: z.string().trim().min(1).max(300).optional(),
  description: z.string().trim().max(20_000).nullable().optional(),
  acceptance: z.string().trim().max(20_000).nullable().optional(),
  testsRequired: z.string().trim().max(2000).nullable().optional(),
  phaseId: z.string().trim().max(20).optional(),
  phaseTitle: z.string().trim().max(200).optional(),
  labels: z.array(z.string().trim().min(1).max(50)).optional(),
  files: z.array(z.string().trim().min(1).max(300)).optional(),
  dependsOn: z.array(z.string().trim().min(1).max(50)).optional(),
});

interface RouteContext {
  params: Promise<{
    taskId: string;
  }>;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { taskId } = await context.params;

  const parsedBody = updateTaskSchema.safeParse(await request.json());
  if (!parsedBody.success) {
    return NextResponse.json(
      { error: 'Invalid request body', issues: parsedBody.error.issues },
      { status: 400 },
    );
  }

  const body = parsedBody.data;
  const now = new Date();
  const hasAssignmentSemantics = await planBoardHasAssignmentSemantics();
  const existingTask = await findExistingPlanBoardTask({
    hasAssignmentSemantics,
    taskId,
  });
  if (!existingTask) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }
  const fromStatus = existingTask.status;
  const nextStatus = body.status ?? fromStatus;
  const assignmentUpdate = buildPlanBoardAssignmentUpdate({
    assignmentReason: body.assignmentReason,
    currentTask: {
      agentHandle: existingTask.agentHandle,
      assignmentReason:
        hasAssignmentSemantics && 'assignmentReason' in existingTask
          ? existingTask.assignmentReason ?? null
          : null,
      claimedAt:
        hasAssignmentSemantics && 'claimedAt' in existingTask
          ? existingTask.claimedAt ?? null
          : null,
      status: existingTask.status,
    },
    message: body.message,
    nextAgentHandle: body.agentHandle,
    nextStatus: nextStatus,
    now,
  });
  const eventType = resolveEventType({
    assignmentChanged: assignmentUpdate.assignmentChanged,
    eventType: body.eventType,
    notesChanged: body.notes !== undefined,
    statusChanged: fromStatus !== nextStatus,
  });
  const hasAssignmentTouch =
    body.agentHandle !== undefined ||
    body.assignmentReason !== undefined ||
    assignmentUpdate.assignmentChanged;
  const buildEventCreate = (includeAssignmentSemantics: boolean) => ({
    agentHandle: body.agentHandle ?? user.email,
    eventType,
    fromStatus,
    message: body.message ?? null,
    toStatus: nextStatus,
    ...(includeAssignmentSemantics
      ? {
          assignmentReason: hasAssignmentTouch
            ? assignmentUpdate.assignmentReason
            : null,
          nextAgentHandle: hasAssignmentTouch
            ? assignmentUpdate.nextAgentHandle
            : null,
          previousAgentHandle: hasAssignmentTouch
            ? assignmentUpdate.previousAgentHandle
            : null,
        }
      : {}),
  });
  const eventCreate = buildEventCreate(hasAssignmentSemantics);
  const updateData = {
    agentHandle:
      body.agentHandle === undefined
        ? undefined
        : assignmentUpdate.agentHandle,
    ...(hasAssignmentSemantics
      ? {
          assignmentReason:
            body.assignmentReason === undefined &&
            !assignmentUpdate.assignmentChanged
              ? undefined
              : assignmentUpdate.assignmentReason,
          claimedAt: assignmentUpdate.claimedAt,
        }
      : {}),
    events: {
      create: eventCreate,
    },
    notes: body.notes === undefined ? undefined : body.notes,
    ...(body.status !== undefined && { status: body.status }),
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description }),
    ...(body.acceptance !== undefined && { acceptance: body.acceptance }),
    ...(body.testsRequired !== undefined && {
      testsRequired: body.testsRequired,
    }),
    ...(body.phaseId !== undefined && { phaseId: body.phaseId }),
    ...(body.phaseTitle !== undefined && { phaseTitle: body.phaseTitle }),
    ...(body.labels !== undefined && { labels: body.labels }),
    ...(body.files !== undefined && { files: body.files }),
    ...(body.dependsOn !== undefined && { dependsOn: body.dependsOn }),
  };

  try {
    await db.planBoardTask.update({
      data: updateData,
      where: { taskId },
    });
  } catch (error) {
    if (
      !hasAssignmentSemantics ||
      !isMissingPlanBoardAssignmentSemanticsColumnError(error)
    ) {
      throw error;
    }

    await db.planBoardTask.update({
      data: {
        ...updateData,
        events: {
          create: buildEventCreate(false),
        },
        assignmentReason: undefined,
        claimedAt: undefined,
      },
      where: { taskId },
    });
  }

  const updatedTask = await findTaskView(taskId);

  await publishPlanBoardEvent({
    data: {
      event: {
        agentHandle: body.agentHandle ?? user.email,
        assignmentReason: hasAssignmentTouch
          ? assignmentUpdate.assignmentReason
          : null,
        eventType,
        fromStatus,
        message: body.message ?? null,
        nextAgentHandle: hasAssignmentTouch
          ? assignmentUpdate.nextAgentHandle
          : null,
        previousAgentHandle: hasAssignmentTouch
          ? assignmentUpdate.previousAgentHandle
          : null,
        toStatus: nextStatus,
      },
      task: updatedTask,
    },
    event: PLAN_BOARD_TASK_EVENT,
  });

  return NextResponse.json({ task: updatedTask });
}

async function findExistingPlanBoardTask({
  hasAssignmentSemantics,
  taskId,
}: {
  hasAssignmentSemantics: boolean;
  taskId: string;
}) {
  const buildSelect = (includeAssignmentSemantics: boolean) => ({
    agentHandle: true,
    status: true,
    ...(includeAssignmentSemantics ? { assignmentReason: true } : {}),
  });

  if (hasAssignmentSemantics) {
    try {
      return await db.planBoardTask.findUnique({
        select: {
          ...buildSelect(true),
          claimedAt: true,
        },
        where: { taskId },
      });
    } catch (error) {
      if (!isMissingPlanBoardAssignmentSemanticsColumnError(error)) {
        throw error;
      }
    }
  }

  return db.planBoardTask.findUnique({
    select: buildSelect(false),
    where: { taskId },
  });
}

async function findTaskView(taskId: string): Promise<PlanBoardTaskView> {
  const tasks = await getPlanBoardTasks();
  const task = tasks.find(candidate => candidate.taskId === taskId);

  if (!task) {
    throw new Error(`Task ${taskId} disappeared after update`);
  }

  return task;
}

function resolveEventType({
  assignmentChanged,
  eventType,
  notesChanged,
  statusChanged,
}: {
  assignmentChanged: boolean;
  eventType: PlanBoardEventType | undefined;
  notesChanged: boolean;
  statusChanged: boolean;
}): PlanBoardEventType {
  if (eventType) {
    return eventType;
  }

  if (assignmentChanged) {
    return 'AGENT_ASSIGNED';
  }

  if (notesChanged && !statusChanged) {
    return 'NOTE_ADDED';
  }

  return 'STATUS_CHANGED';
}
