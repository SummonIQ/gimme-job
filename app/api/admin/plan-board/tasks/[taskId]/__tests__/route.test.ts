// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { NextRequest } from 'next/server';

import type {
  ParsedPlanTask,
  PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';

const mocks = vi.hoisted(() => ({
  findParsedPlanTask: vi.fn(),
  getCurrentUser: vi.fn(),
  getPlanBoardTasks: vi.fn(),
  isMissingPlanBoardAssignmentSemanticsColumnError: vi.fn(),
  isAdminUser: vi.fn(),
  planBoardHasAssignmentSemantics: vi.fn(),
  planBoardTaskFindUnique: vi.fn(),
  planBoardTaskUpsert: vi.fn(),
  publishPlanBoardEvent: vi.fn(),
}));

vi.mock('@/lib/user/query', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/lib/admin/scrape-service', () => ({
  isAdminUser: mocks.isAdminUser,
}));

vi.mock('@/lib/admin/plan-board', () => ({
  findParsedPlanTask: mocks.findParsedPlanTask,
  getPlanBoardTasks: mocks.getPlanBoardTasks,
}));

vi.mock('@/lib/admin/plan-board-db', () => ({
  isMissingPlanBoardAssignmentSemanticsColumnError:
    mocks.isMissingPlanBoardAssignmentSemanticsColumnError,
  planBoardHasAssignmentSemantics: mocks.planBoardHasAssignmentSemantics,
}));

vi.mock('@/lib/admin/summonflow', () => ({
  PLAN_BOARD_TASK_EVENT: 'plan-task-updated',
  publishPlanBoardEvent: mocks.publishPlanBoardEvent,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    planBoardTask: {
      findUnique: mocks.planBoardTaskFindUnique,
      upsert: mocks.planBoardTaskUpsert,
    },
  },
}));

import { PATCH } from '../route';

function makeParsedTask(
  overrides: Partial<ParsedPlanTask> = {},
): ParsedPlanTask {
  return {
    acceptance: null,
    dependsOn: [],
    files: [],
    labels: [],
    markdownStatus: 'TODO',
    phaseId: 'P15',
    phaseTitle: 'Agent coordination board',
    sortOrder: 0,
    taskId: 'P15.5',
    testsRequired: null,
    title: 'Scenario simulator',
    ...overrides,
  };
}

function makeTaskView(
  overrides: Partial<PlanBoardTaskView> = {},
): PlanBoardTaskView {
  return {
    ...makeParsedTask(),
    agentHandle: 'simulator-agent',
    events: [],
    notes: null,
    status: 'IN_PROGRESS',
    updatedAt: '2026-04-23T04:00:00.000Z',
    ...overrides,
  };
}

function makeRequest(body: unknown) {
  return new Request('http://localhost/api/admin/plan-board/tasks/P15.5', {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'PATCH',
  }) as NextRequest;
}

beforeEach(() => {
  mocks.getCurrentUser.mockResolvedValue({ email: 'admin@example.com' });
  mocks.isAdminUser.mockResolvedValue(true);
  mocks.isMissingPlanBoardAssignmentSemanticsColumnError.mockReturnValue(false);
  mocks.findParsedPlanTask.mockResolvedValue(makeParsedTask());
  mocks.getPlanBoardTasks.mockResolvedValue([makeTaskView()]);
  mocks.planBoardHasAssignmentSemantics.mockResolvedValue(true);
  mocks.planBoardTaskUpsert.mockResolvedValue({});
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('plan-board task PATCH route simulation sequence', () => {
  it('writes assignment, status, and note events for simulator steps', async () => {
    const steps = [
      {
        agentHandle: 'simulator-agent',
        eventType: 'AGENT_ASSIGNED',
        message: 'Simulation assigned P15.5.',
        status: 'TODO',
      },
      {
        agentHandle: 'simulator-agent',
        eventType: 'STATUS_CHANGED',
        message: 'Simulation started P15.5.',
        status: 'IN_PROGRESS',
      },
      {
        agentHandle: 'simulator-agent',
        eventType: 'NOTE_ADDED',
        message: 'Simulation progress note for P15.5.',
        status: 'IN_PROGRESS',
      },
    ] as const;

    mocks.planBoardTaskFindUnique
      .mockResolvedValueOnce({ status: 'TODO' })
      .mockResolvedValueOnce({ status: 'TODO' })
      .mockResolvedValueOnce({ status: 'IN_PROGRESS' });

    for (const step of steps) {
      const response = await PATCH(makeRequest(step), {
        params: Promise.resolve({ taskId: 'P15.5' }),
      });
      expect(response.status).toBe(200);
    }

    expect(mocks.planBoardTaskUpsert).toHaveBeenCalledTimes(3);
    for (const [index, step] of steps.entries()) {
      expect(mocks.planBoardTaskUpsert).toHaveBeenNthCalledWith(
        index + 1,
        expect.objectContaining({
          update: expect.objectContaining({
            events: {
              create: expect.objectContaining({
                agentHandle: step.agentHandle,
                eventType: step.eventType,
                message: step.message,
                toStatus: step.status,
              }),
            },
            status: step.status,
          }),
        }),
      );
    }
    expect(mocks.publishPlanBoardEvent).toHaveBeenCalledTimes(3);
  });

  it('omits claimedAt reads and writes when the column is unavailable', async () => {
    mocks.planBoardHasAssignmentSemantics.mockResolvedValue(false);
    mocks.planBoardTaskFindUnique.mockResolvedValue({
      agentHandle: 'simulator-agent',
      status: 'TODO',
    });

    const response = await PATCH(
      makeRequest({
        agentHandle: 'simulator-agent',
        message: 'Simulation started P15.5.',
        status: 'IN_PROGRESS',
      }),
      {
        params: Promise.resolve({ taskId: 'P15.5' }),
      },
    );

    expect(response.status).toBe(200);
    expect(mocks.planBoardTaskFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.not.objectContaining({
          assignmentReason: true,
          claimedAt: true,
        }),
      }),
    );
    expect(mocks.planBoardTaskUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.not.objectContaining({
          assignmentReason: expect.anything(),
          claimedAt: expect.anything(),
        }),
        update: expect.not.objectContaining({
          assignmentReason: expect.anything(),
          claimedAt: expect.anything(),
        }),
      }),
    );
  });
});
