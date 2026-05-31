import type { PlanBoardTaskView } from '@/lib/admin/plan-board-types';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  AssigneePill,
  formatCount,
  formatDateTime,
  formatEventType,
  formatList,
  getTaskActionGuidance,
  getAgentInitials,
  taskNeedsStevenAction,
} from '../plan-board-shared';

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

describe('plan-board-shared', () => {
  describe('formatCount', () => {
    it('returns empty string for empty array', () => {
      expect(formatCount([], 'dep')).toBe('');
    });

    it('uses singular for one item', () => {
      expect(formatCount(['a'], 'dep')).toBe('1 dep');
    });

    it('pluralizes for multiple items', () => {
      expect(formatCount(['a', 'b', 'c'], 'file')).toBe('3 files');
    });
  });

  describe('formatList', () => {
    it('returns "None" for empty', () => {
      expect(formatList([])).toBe('None');
    });

    it('joins values with comma-space', () => {
      expect(formatList(['P1.1', 'P2.3'])).toBe('P1.1, P2.3');
    });
  });

  describe('formatDateTime', () => {
    it('returns "No live update" for null', () => {
      expect(formatDateTime(null)).toBe('No live update');
    });

    it('formats an ISO date', () => {
      const result = formatDateTime('2026-04-22T09:00:00Z');
      expect(result).not.toBe('No live update');
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('formatEventType', () => {
    it('title-cases underscored enum', () => {
      expect(formatEventType('STATUS_CHANGED')).toBe('Status Changed');
    });
  });

  describe('getAgentInitials', () => {
    it('returns ?? for empty handle', () => {
      expect(getAgentInitials('')).toBe('??');
    });

    it('takes first two tokens', () => {
      expect(getAgentInitials('claude-code')).toBe('CC');
    });

    it('single word returns single char', () => {
      expect(getAgentInitials('codex')).toBe('C');
    });
  });

  describe('AssigneePill', () => {
    it('renders "Unassigned" when agentHandle is null', () => {
      render(<AssigneePill agentHandle={null} />);
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('renders the agent handle', () => {
      render(<AssigneePill agentHandle="claude-code" />);
      expect(screen.getByText('claude-code')).toBeInTheDocument();
    });
  });

  describe('taskNeedsStevenAction', () => {
    it('detects manual Steven follow-up language on todo and blocked tasks', () => {
      expect(
        taskNeedsStevenAction(
          makeTask({
            acceptance: 'Steven signs off after one real submission.',
            status: 'BLOCKED',
          }),
        ),
      ).toBe(true);
    });

    it('ignores the same language on non-manual statuses', () => {
      expect(
        taskNeedsStevenAction(
          makeTask({
            acceptance: 'Steven signs off after one real submission.',
            status: 'DONE',
          }),
        ),
      ).toBe(false);
    });

    it('does not flag casual mentions of Steven or "manual" in ticket prose', () => {
      // Regression: prior pattern matched any \bsteven\b or \bmanual\b which
      // produced false-positive "Needs Steven" badges across descriptive
      // ticket bodies (e.g. "Steven supplies credentials once" or "manual —
      // confirm via dev tools" inside a Tests required field).
      expect(
        taskNeedsStevenAction(
          makeTask({
            acceptance:
              'Steven supplies his my.greenhouse.io credentials once via the desktop credential vault.',
            status: 'TODO',
            testsRequired:
              'unit — endpoint contract; manual — confirm idle network panel via dev tools.',
          }),
        ),
      ).toBe(false);

      expect(
        taskNeedsStevenAction(
          makeTask({
            acceptance:
              'E2E (gated): one real submission against a known sandbox posting.',
            status: 'TODO',
          }),
        ),
      ).toBe(false);
    });
  });

  describe('getTaskActionGuidance', () => {
    it('surfaces Steven-facing guidance for blocked manual tasks', () => {
      expect(
        getTaskActionGuidance(
          makeTask({
            events: [
              {
                agentHandle: 'codex',
                assignmentReason: null,
                createdAt: '2026-04-23T20:00:00.000Z',
                eventType: 'NOTE_ADDED',
                fromStatus: 'BLOCKED',
                id: 'event-1',
                message: 'Waiting on Steven for a real submission result.',
                nextAgentHandle: null,
                previousAgentHandle: null,
                toStatus: 'BLOCKED',
              },
            ],
            status: 'BLOCKED',
          }),
        ),
      ).toMatchObject({
        headline: 'Waiting on you',
        needsStevenAction: true,
        showManualReport: true,
      });
    });

    it('treats plain todo tasks as ready to start', () => {
      expect(
        getTaskActionGuidance(
          makeTask({
            status: 'TODO',
          }),
        ),
      ).toMatchObject({
        headline: 'Ready to start',
        needsStevenAction: false,
        showManualReport: false,
      });
    });
  });
});
