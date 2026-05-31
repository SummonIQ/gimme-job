import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { PlanBoardSyncReport as PlanBoardSyncReportData } from '@/lib/admin/plan-board-types';

import { SyncReport } from '../sync-report';

function makeReport(
  overrides: Partial<PlanBoardSyncReportData> = {},
): PlanBoardSyncReportData {
  return {
    isSynced: true,
    missingLiveTasks: [],
    orphanedLiveTasks: [],
    possibleRenamedTaskIds: [],
    syncedTaskCount: 2,
    totalLiveTasks: 2,
    totalMarkdownTasks: 2,
    ...overrides,
  };
}

describe('SyncReport', () => {
  it('renders a synced state', () => {
    render(<SyncReport report={makeReport()} />);

    expect(screen.getByText('Definition sync')).toBeInTheDocument();
    expect(screen.getByText('Synced')).toBeInTheDocument();
    expect(
      screen.getByText('Markdown task definitions and live board rows match.'),
    ).toBeInTheDocument();
  });

  it('renders missing, orphaned, and rename hint counts', () => {
    render(
      <SyncReport
        report={makeReport({
          isSynced: false,
          missingLiveTasks: [
            { phaseId: 'P15', taskId: 'P15.1', title: 'Missing task' },
          ],
          orphanedLiveTasks: [
            {
              agentHandle: 'codex',
              phaseId: 'P15',
              status: 'DONE',
              taskId: 'P15.99',
              updatedAt: '2026-04-22T10:00:00.000Z',
            },
          ],
          possibleRenamedTaskIds: [
            {
              candidateTaskIds: ['P15.1'],
              orphanedTaskId: 'P15.99',
              phaseId: 'P15',
            },
          ],
          syncedTaskCount: 1,
          totalLiveTasks: 2,
          totalMarkdownTasks: 2,
        })}
      />,
    );

    expect(screen.getByText('2 issues')).toBeInTheDocument();
    expect(screen.getByText('P15.1 - Missing task')).toBeInTheDocument();
    expect(screen.getByText('P15.99')).toBeInTheDocument();
    expect(screen.getByText('P15.99 -> P15.1')).toBeInTheDocument();
  });
});
