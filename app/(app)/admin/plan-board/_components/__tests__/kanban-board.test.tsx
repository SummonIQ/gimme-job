import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { PlanBoardTaskView } from '@/lib/admin/plan-board-types';

import { BOARD_LAYOUT_TRANSITION } from '../plan-board-shared';
import { KanbanBoard } from '../kanban-board';

function makeTask(
  overrides: Partial<PlanBoardTaskView> = {},
): PlanBoardTaskView {
  return {
    acceptance: null,
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
    testsRequired: null,
    title: 'Test task',
    updatedAt: null,
    ...overrides,
  };
}

describe('KanbanBoard', () => {
  it('renders all four status columns', () => {
    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={() => {}}
        selectedTaskId={null}
        tasks={[]}
      />,
    );
    expect(screen.getByText('Todo')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('renders tasks in the matching status column', () => {
    const tasks = [
      makeTask({ taskId: 'P1.1', title: 'Todo task', status: 'TODO' }),
      makeTask({
        taskId: 'P1.2',
        title: 'Done task',
        status: 'DONE',
      }),
    ];

    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={() => {}}
        selectedTaskId={null}
        tasks={tasks}
      />,
    );
    expect(screen.getByText('Todo task')).toBeInTheDocument();
    expect(screen.getByText('Done task')).toBeInTheDocument();
  });

  it('puts recently completed tasks first in the done column', () => {
    const tasks = [
      makeTask({
        sortOrder: 1,
        status: 'DONE',
        taskId: 'P1.1',
        title: 'Older done task',
        updatedAt: '2026-04-22T10:00:00.000Z',
      }),
      makeTask({
        sortOrder: 2,
        status: 'DONE',
        taskId: 'P1.2',
        title: 'Newer done task',
        updatedAt: '2026-04-22T11:00:00.000Z',
      }),
    ];

    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={() => {}}
        selectedTaskId={null}
        tasks={tasks}
      />,
    );

    const taskCards = screen
      .getAllByRole('button')
      .map(card => card.textContent ?? '');
    const newerTaskIndex = taskCards.findIndex(card =>
      card.includes('Newer done task'),
    );
    const olderTaskIndex = taskCards.findIndex(card =>
      card.includes('Older done task'),
    );

    expect(newerTaskIndex).toBeGreaterThanOrEqual(0);
    expect(olderTaskIndex).toBeGreaterThanOrEqual(0);
    expect(newerTaskIndex).toBeLessThan(olderTaskIndex);
  });

  it('shows empty state when a column has no tasks', () => {
    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={() => {}}
        selectedTaskId={null}
        tasks={[]}
      />,
    );
    const empties = screen.getAllByText('No tasks');
    expect(empties.length).toBe(4);
  });

  it('calls onSelectTask when a card is clicked', () => {
    const onSelectTask = vi.fn();
    const task = makeTask({ taskId: 'P1.1', title: 'Click me' });

    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={onSelectTask}
        selectedTaskId={null}
        tasks={[task]}
      />,
    );
    fireEvent.click(screen.getByText('Click me'));
    expect(onSelectTask).toHaveBeenCalledWith('P1.1');
  });

  it('shows dependency and file counts on a task card', () => {
    const task = makeTask({
      dependsOn: ['P0.1', 'P0.2'],
      files: ['a.ts'],
      title: 'With counts',
    });

    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={() => {}}
        selectedTaskId={null}
        tasks={[task]}
      />,
    );
    expect(screen.getByText('2 deps')).toBeInTheDocument();
    expect(screen.getByText('1 file')).toBeInTheDocument();
  });

  it('shows stale claim state on a task card', () => {
    const task = makeTask({
      agentHandle: 'codex',
      claimState: 'STALE',
      isClaimStale: true,
      status: 'IN_PROGRESS',
      title: 'Stale task',
    });

    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={() => {}}
        selectedTaskId={null}
        tasks={[task]}
      />,
    );
    expect(screen.getByText('Stale claim')).toBeInTheDocument();
  });

  it('flags cards that likely need Steven action', () => {
    const task = makeTask({
      acceptance: 'Steven must confirm the real submission result.',
      status: 'BLOCKED',
      title: 'Manual follow-up ticket',
    });

    render(
      <KanbanBoard
        layoutTransition={BOARD_LAYOUT_TRANSITION}
        onSelectTask={() => {}}
        selectedTaskId={null}
        tasks={[task]}
      />,
    );

    expect(screen.getAllByText('Needs Steven').length).toBeGreaterThan(0);
  });
});
