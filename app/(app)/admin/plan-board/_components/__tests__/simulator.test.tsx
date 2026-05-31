// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PlanBoardTaskView } from '@/lib/admin/plan-board-types';

import { PlanBoardSimulator } from '../simulator';

const originalFetch = globalThis.fetch;

function makeTask(
  overrides: Partial<PlanBoardTaskView> = {},
): PlanBoardTaskView {
  return {
    acceptance: null,
    agentHandle: null,
    dependsOn: [],
    events: [],
    files: [],
    labels: [],
    markdownStatus: 'TODO',
    notes: null,
    phaseId: 'P15',
    phaseTitle: 'Agent coordination board',
    sortOrder: 0,
    status: 'TODO',
    taskId: 'P15.5',
    testsRequired: null,
    title: 'Scenario simulator',
    updatedAt: null,
    ...overrides,
  };
}

function installFetchMock() {
  const fetchMock = vi.fn(
    async (_input: RequestInfo | URL, init?: RequestInit) => {
      const payload = JSON.parse(String(init?.body)) as {
        agentHandle: string | null;
        status: PlanBoardTaskView['status'];
      };

      return {
        json: async () => ({
          task: makeTask({
            agentHandle: payload.agentHandle,
            status: payload.status,
          }),
        }),
        ok: true,
      };
    },
  );

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  });

  return fetchMock;
}

function getRequestBodies(fetchMock: ReturnType<typeof installFetchMock>) {
  return fetchMock.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: originalFetch,
    writable: true,
  });
});

describe('PlanBoardSimulator', () => {
  it('runs assignment and progress note steps through the task API', async () => {
    const fetchMock = installFetchMock();
    const onTaskUpdated = vi.fn();

    render(
      <PlanBoardSimulator
        onTaskUpdated={onTaskUpdated}
        tasks={[makeTask({ taskId: 'P15.5' })]}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Run Assignment + notes' }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/admin/plan-board/tasks/P15.5',
    );
    expect(getRequestBodies(fetchMock)).toMatchObject([
      {
        agentHandle: 'simulator-agent',
        eventType: 'AGENT_ASSIGNED',
        status: 'TODO',
      },
      {
        agentHandle: 'simulator-agent',
        eventType: 'STATUS_CHANGED',
        status: 'IN_PROGRESS',
      },
      {
        agentHandle: 'simulator-agent',
        eventType: 'NOTE_ADDED',
        status: 'IN_PROGRESS',
      },
    ]);
    expect(onTaskUpdated).toHaveBeenCalledTimes(3);
  });

  it('blocks a todo task when its dependencies are not done', async () => {
    const fetchMock = installFetchMock();

    render(
      <PlanBoardSimulator
        onTaskUpdated={() => {}}
        tasks={[
          makeTask({ status: 'TODO', taskId: 'P15.6' }),
          makeTask({
            dependsOn: ['P15.8'],
            status: 'TODO',
            taskId: 'P15.7',
          }),
        ]}
      />,
    );

    await userEvent.click(
      screen.getByRole('button', { name: 'Run Blocked dependency' }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/admin/plan-board/tasks/P15.7',
    );
    expect(getRequestBodies(fetchMock)[0]).toMatchObject({
      eventType: 'STATUS_CHANGED',
      status: 'BLOCKED',
    });
  });

  it('disables scenarios that have no eligible target task', () => {
    render(
      <PlanBoardSimulator
        onTaskUpdated={() => {}}
        tasks={[makeTask({ status: 'DONE' })]}
      />,
    );

    expect(
      screen.getByRole('button', { name: 'Run Assignment + notes' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Run Blocked dependency' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Run Reassignment' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Run Completion' }),
    ).toBeDisabled();
  });
});
