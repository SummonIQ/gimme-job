import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Sheet, SheetContent } from '@/components/ui/sheet';
import type { PlanBoardTaskView } from '@/lib/admin/plan-board-types';

import {
  buildTaskDetailDiffRows,
  TaskDetailDrawer,
} from '../task-detail-drawer';

function makeTask(
  overrides: Partial<PlanBoardTaskView> = {},
): PlanBoardTaskView {
  return {
    acceptance: 'Must do the thing',
    agentHandle: null,
    assignmentReason: null,
    claimedAt: null,
    claimState: 'UNASSIGNED',
    dependsOn: [],
    events: [],
    files: [],
    labels: [],
    isClaimStale: false,
    markdownStatus: 'TODO',
    notes: null,
    phaseId: 'P1',
    phaseTitle: 'Test phase',
    sortOrder: 0,
    status: 'TODO',
    taskId: 'P1.1',
    testsRequired: 'unit',
    title: 'Test task',
    updatedAt: null,
    ...overrides,
  };
}

function renderDrawer(task: PlanBoardTaskView) {
  return render(
    <Sheet open>
      <SheetContent>
        <TaskDetailDrawer task={task} />
      </SheetContent>
    </Sheet>,
  );
}

describe('TaskDetailDrawer', () => {
  it('renders task id, title, and phase', () => {
    renderDrawer(makeTask());
    expect(screen.getByText('P1.1')).toBeInTheDocument();
    expect(screen.getByText('Test task')).toBeInTheDocument();
    expect(screen.getByText('P1 - Test phase')).toBeInTheDocument();
  });

  it('shows "Unassigned" when agentHandle is null', () => {
    renderDrawer(makeTask({ agentHandle: null }));
    expect(screen.getAllByText('Unassigned').length).toBeGreaterThan(0);
  });

  it('shows assignee handle when set', () => {
    renderDrawer(makeTask({ agentHandle: 'codex' }));
    expect(screen.getAllByText('codex').length).toBeGreaterThan(0);
  });

  it('renders "Matches plan default" when status matches markdownStatus', () => {
    renderDrawer(makeTask({ status: 'TODO', markdownStatus: 'TODO' }));
    expect(screen.getByText(/Matches plan default: Todo/)).toBeInTheDocument();
  });

  it('renders status transition when live diverges from markdown', () => {
    renderDrawer(makeTask({ status: 'IN_PROGRESS', markdownStatus: 'TODO' }));
    expect(screen.getByText(/Todo → In progress/)).toBeInTheDocument();
  });

  it('renders claim state and assignment reason', () => {
    renderDrawer(
      makeTask({
        agentHandle: 'codex',
        assignmentReason: 'Steven reassigned this ticket',
        claimedAt: '2026-04-22T10:00:00.000Z',
        claimState: 'CLAIMED',
        status: 'IN_PROGRESS',
      }),
    );

    expect(screen.getAllByText('Claimed').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Steven reassigned this ticket'),
    ).toBeInTheDocument();
  });

  it('formats compact detail diff rows', () => {
    const rows = buildTaskDetailDiffRows(
      makeTask({
        agentHandle: 'codex',
        claimState: 'CLAIMED',
        events: [
          {
            agentHandle: 'codex',
            createdAt: '2026-04-22T10:00:00.000Z',
            eventType: 'NOTE_ADDED',
            fromStatus: 'TODO',
            id: 'event-1',
            message: 'Implementation note',
            toStatus: 'TODO',
          },
        ],
        notes: 'Live note',
        status: 'IN_PROGRESS',
      }),
    );

    expect(rows).toEqual([
      { label: 'Status', value: 'Todo → In progress' },
      { label: 'Assignee', value: 'Assigned to codex' },
      { label: 'Claim', value: 'Claimed' },
      { label: 'Notes', value: 'Live note' },
      { label: 'Latest event', value: 'Implementation note' },
    ]);
  });

  it('renders ownership history transitions', () => {
    renderDrawer(
      makeTask({
        agentHandle: 'codex',
        events: [
          {
            agentHandle: 'codex',
            assignmentReason: 'Claude handed it off',
            createdAt: '2026-04-22T10:00:00.000Z',
            eventType: 'AGENT_ASSIGNED',
            fromStatus: 'TODO',
            id: 'event-1',
            message: null,
            nextAgentHandle: 'codex',
            previousAgentHandle: 'claude',
            toStatus: 'TODO',
          },
        ],
      }),
    );

    expect(screen.getByText('Ownership history')).toBeInTheDocument();
    expect(screen.getByText('Claude handed it off')).toBeInTheDocument();
    expect(screen.getByText('claude')).toBeInTheDocument();
    expect(screen.getAllByText('codex').length).toBeGreaterThan(0);
  });

  it('shows manual result controls when a task needs Steven action', () => {
    renderDrawer(
      makeTask({
        acceptance: 'Steven must run one real submission and report the result.',
        status: 'BLOCKED',
      }),
    );

    expect(screen.getByText('Waiting on you')).toBeInTheDocument();
    expect(screen.getByText('Needs Steven')).toBeInTheDocument();
    expect(screen.getByText('Manual step done')).toBeInTheDocument();
    expect(screen.getByLabelText('What happened')).toBeInTheDocument();
  });
});
