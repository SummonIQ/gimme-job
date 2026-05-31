import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  PlanBoardHealthReport,
  PlanBoardSyncReport,
  PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';
import type { PlanBoardRealtimeConfig } from '@/lib/admin/summonflow';

import { parseRealtimePayload, PlanBoardClient } from '../plan-board-client';

const realtimeMock = vi.hoisted(() => {
  const stateChangeHandlers = new Set<(payload: unknown) => void>();
  const errorHandlers = new Set<(payload: unknown) => void>();
  const taskHandlers = new Set<(payload: unknown) => void>();

  return {
    emitConnectionError() {
      errorHandlers.forEach(handler => handler({}));
    },
    emitState(current: string) {
      stateChangeHandlers.forEach(handler => handler({ current }));
    },
    emitTaskUpdated(payload: unknown) {
      taskHandlers.forEach(handler => handler(payload));
    },
    errorHandlers,
    reset() {
      stateChangeHandlers.clear();
      errorHandlers.clear();
      taskHandlers.clear();
    },
    stateChangeHandlers,
    taskHandlers,
  };
});

vi.mock('@summoniq/summonflow-client-sdk', () => {
  class MockSummonFlow {
    connection = {
      bind: (event: string, handler: (payload: unknown) => void) => {
        if (event === 'state_change') {
          realtimeMock.stateChangeHandlers.add(handler);
        }
        if (event === 'error') {
          realtimeMock.errorHandlers.add(handler);
        }
      },
      state: 'initialized' as const,
      unbind: (event: string, handler?: (payload: unknown) => void) => {
        if (event === 'state_change' && handler) {
          realtimeMock.stateChangeHandlers.delete(handler);
        }
        if (event === 'error' && handler) {
          realtimeMock.errorHandlers.delete(handler);
        }
      },
    };

    disconnect = vi.fn();

    subscribe() {
      return {
        bind: (event: string, handler: (payload: unknown) => void) => {
          if (event === 'plan-task-updated') {
            realtimeMock.taskHandlers.add(handler);
          }
        },
        unbind: (event: string, handler?: (payload: unknown) => void) => {
          if (event === 'plan-task-updated' && handler) {
            realtimeMock.taskHandlers.delete(handler);
          }
        },
      };
    }
  }

  return {
    default: MockSummonFlow,
  };
});

const originalFetch = globalThis.fetch;

const DISABLED_REALTIME_CONFIG: PlanBoardRealtimeConfig = {
  appKey: '',
  channelName: 'public-gimme-job-plan-board',
  forceTLS: true,
  wsHost: 'realtime.summonflow.com',
  wsPort: 443,
};

const ENABLED_REALTIME_CONFIG: PlanBoardRealtimeConfig = {
  ...DISABLED_REALTIME_CONFIG,
  appKey: 'test-app-key',
};

function makeTask(
  overrides: Partial<PlanBoardTaskView> = {},
): PlanBoardTaskView {
  return {
    acceptance: null,
    agentHandle: 'codex',
    assignmentReason: null,
    claimedAt: null,
    claimState: 'ASSIGNED',
    dependsOn: [],
    events: [],
    files: [],
    labels: [],
    isClaimStale: false,
    markdownStatus: 'TODO',
    notes: null,
    phaseId: 'P0',
    phaseTitle: 'Ground truth',
    sortOrder: 0,
    status: 'TODO',
    taskId: 'P0.2',
    testsRequired: null,
    title: 'Realtime task',
    updatedAt: null,
    ...overrides,
  };
}

function makeSyncReport(
  overrides: Partial<PlanBoardSyncReport> = {},
): PlanBoardSyncReport {
  return {
    isSynced: true,
    missingLiveTasks: [],
    orphanedLiveTasks: [],
    possibleRenamedTaskIds: [],
    syncedTaskCount: 1,
    totalLiveTasks: 1,
    totalMarkdownTasks: 1,
    ...overrides,
  };
}

function makeHealthReport(
  overrides: Partial<PlanBoardHealthReport> = {},
): PlanBoardHealthReport {
  return {
    blockedAge: {
      attentionThresholdHours: 24,
      blockedCount: 0,
      oldestBlockedTask: null,
    },
    phaseProgress: [
      {
        blockedCount: 0,
        doneCount: 0,
        inProgressCount: 0,
        phaseId: 'P0',
        phaseTitle: 'Ground truth',
        progressPercent: 0,
        todoCount: 1,
        totalCount: 1,
      },
    ],
    recentAgents: [],
    staleAssignments: {
      staleCount: 0,
      tasks: [],
      thresholdHours: 24,
    },
    taskAging: {
      agingCount: 0,
      oldestTask: null,
      thresholdHours: 72,
    },
    ...overrides,
  };
}

function getColumn(title: string) {
  const heading = screen.getByRole('heading', { name: title });
  const section = heading.closest('section');
  if (!section) {
    throw new Error(`Column ${title} was not rendered`);
  }

  return within(section);
}

afterEach(() => {
  vi.restoreAllMocks();
  realtimeMock.reset();
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: originalFetch,
    writable: true,
  });
  vi.useRealTimers();
});

describe('PlanBoardClient', () => {
  it('parses valid realtime payloads and rejects malformed updates', () => {
    const task = makeTask({
      status: 'IN_PROGRESS',
      taskId: 'P15.4',
      title: 'Realtime hardening',
    });
    const event = {
      agentHandle: 'codex',
      eventType: 'STATUS_CHANGED',
      fromStatus: 'TODO',
      message: 'Started realtime hardening',
      toStatus: 'IN_PROGRESS',
    };

    expect(parseRealtimePayload({ event, task })).toEqual({ event, task });
    expect(
      parseRealtimePayload({
        event,
        task: { ...task, status: 'STARTED' },
      }),
    ).toBeNull();
    expect(parseRealtimePayload({ task })).toBeNull();
  });

  it('does not poll the tasks endpoint when realtime is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
    });
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(
      <PlanBoardClient
        initialHealthReport={makeHealthReport()}
        initialSyncReport={makeSyncReport()}
        initialTasks={[makeTask()]}
        realtimeConfig={DISABLED_REALTIME_CONFIG}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(screen.getByText('Realtime unavailable')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('applies SummonFlow task updates without polling and refreshes the open drawer', async () => {
    const initialTask = makeTask({
      taskId: 'P15.3',
      title: 'Original selected task',
    });
    const refreshedTask = makeTask({
      events: [
        {
          agentHandle: 'codex',
          createdAt: '2026-04-22T10:00:00.000Z',
          eventType: 'NOTE_ADDED',
          fromStatus: 'TODO',
          id: 'event-1',
          message: 'Updated while drawer was open',
          toStatus: 'TODO',
        },
      ],
      taskId: 'P15.3',
      status: 'DONE',
      title: 'Updated selected task',
      updatedAt: '2026-04-22T10:00:00.000Z',
    });
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: fetchMock,
      writable: true,
    });

    render(
      <PlanBoardClient
        initialHealthReport={makeHealthReport()}
        initialSyncReport={makeSyncReport()}
        initialTasks={[initialTask]}
        realtimeConfig={ENABLED_REALTIME_CONFIG}
      />,
    );

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    fireEvent.click(screen.getByText('Original selected task'));
    expect(
      within(screen.getByRole('dialog')).getByText('Original selected task'),
    ).toBeInTheDocument();

    await act(async () => {
      realtimeMock.emitState('connected');
      realtimeMock.emitTaskUpdated({
        event: refreshedTask.events[0],
        task: refreshedTask,
      });
    });

    expect(screen.getByText('Realtime connected')).toBeInTheDocument();
    expect(screen.getByText('Done 1')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText('Updated selected task'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getAllByText(
        'Updated while drawer was open',
      ).length,
    ).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
