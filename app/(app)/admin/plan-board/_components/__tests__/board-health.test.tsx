import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PlanBoardHealthReport } from '@/lib/admin/plan-board-types';

import { BoardHealth } from '../board-health';

describe('BoardHealth', () => {
  it('renders compact health metrics and recent agents', () => {
    render(<BoardHealth report={makeReport()} />);

    expect(screen.getByText('Board health')).toBeInTheDocument();
    expect(screen.getByText('Blocked')).toBeInTheDocument();
    expect(screen.getByText('Stale claims')).toBeInTheDocument();
    expect(screen.getByText('P15.1 blocked 1d 6h')).toBeInTheDocument();
    expect(screen.getByText('codex')).toBeInTheDocument();
    expect(screen.getByText('1 active / 3 events')).toBeInTheDocument();
  });
});

function makeReport(): PlanBoardHealthReport {
  return {
    blockedAge: {
      attentionThresholdHours: 24,
      blockedCount: 1,
      oldestBlockedTask: {
        ageHours: 30,
        agentHandle: 'claude-code',
        phaseId: 'P15',
        status: 'BLOCKED',
        taskId: 'P15.1',
        title: 'Blocked task',
        updatedAt: '2026-04-22T06:00:00.000Z',
      },
    },
    phaseProgress: [
      {
        blockedCount: 1,
        doneCount: 2,
        inProgressCount: 1,
        phaseId: 'P15',
        phaseTitle: 'Agent coordination board',
        progressPercent: 50,
        todoCount: 0,
        totalCount: 4,
      },
    ],
    recentAgents: [
      {
        activeTaskCount: 1,
        agentHandle: 'codex',
        eventCount: 3,
        lastActiveAt: '2026-04-23T10:00:00.000Z',
      },
    ],
    staleAssignments: {
      staleCount: 1,
      tasks: [],
      thresholdHours: 24,
    },
    taskAging: {
      agingCount: 1,
      oldestTask: null,
      thresholdHours: 72,
    },
  };
}
