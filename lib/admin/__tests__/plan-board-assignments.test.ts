import { describe, expect, it } from 'vitest';

import {
  buildPlanBoardAssignmentUpdate,
  getPlanBoardClaimState,
} from '@/lib/admin/plan-board-assignments';

const NOW = new Date('2026-04-22T12:00:00.000Z');

describe('plan-board assignment semantics', () => {
  it('sets claimedAt when an assigned task moves in progress', () => {
    const update = buildPlanBoardAssignmentUpdate({
      assignmentReason: undefined,
      currentTask: {
        agentHandle: 'codex',
        assignmentReason: null,
        claimedAt: null,
        status: 'TODO',
      },
      message: 'Starting work',
      nextAgentHandle: 'codex',
      nextStatus: 'IN_PROGRESS',
      now: NOW,
    });

    expect(update.agentHandle).toBe('codex');
    expect(update.claimedAt).toBe(NOW);
    expect(update.previousAgentHandle).toBe('codex');
    expect(update.nextAgentHandle).toBe('codex');
  });

  it('records reassignment reason without overwriting prior agent identity', () => {
    const update = buildPlanBoardAssignmentUpdate({
      assignmentReason: 'Claude ran out of tokens',
      currentTask: {
        agentHandle: 'claude',
        assignmentReason: 'Original assignment',
        claimedAt: new Date('2026-04-22T08:00:00.000Z'),
        status: 'IN_PROGRESS',
      },
      message: 'Handoff',
      nextAgentHandle: 'codex',
      nextStatus: 'IN_PROGRESS',
      now: NOW,
    });

    expect(update.assignmentChanged).toBe(true);
    expect(update.assignmentReason).toBe('Claude ran out of tokens');
    expect(update.previousAgentHandle).toBe('claude');
    expect(update.nextAgentHandle).toBe('codex');
    expect(update.claimedAt).toBe(NOW);
  });

  it('preserves explicit unassignment transitions', () => {
    const update = buildPlanBoardAssignmentUpdate({
      assignmentReason: 'Steven cleared the reservation',
      currentTask: {
        agentHandle: 'codex',
        assignmentReason: 'Original assignment',
        claimedAt: new Date('2026-04-22T08:00:00.000Z'),
        status: 'TODO',
      },
      message: null,
      nextAgentHandle: null,
      nextStatus: 'TODO',
      now: NOW,
    });

    expect(update.agentHandle).toBeNull();
    expect(update.assignmentChanged).toBe(true);
    expect(update.assignmentReason).toBe('Steven cleared the reservation');
    expect(update.previousAgentHandle).toBe('codex');
    expect(update.nextAgentHandle).toBeNull();
  });

  it('detects stale in-progress claims', () => {
    expect(
      getPlanBoardClaimState(
        {
          agentHandle: 'codex',
          assignmentReason: null,
          claimedAt: new Date('2026-04-22T07:59:59.000Z'),
          status: 'IN_PROGRESS',
        },
        NOW,
      ),
    ).toBe('STALE');
  });

  it('does not mark assigned todo tickets stale', () => {
    expect(
      getPlanBoardClaimState(
        {
          agentHandle: 'codex',
          assignmentReason: null,
          claimedAt: new Date('2026-04-22T07:00:00.000Z'),
          status: 'TODO',
        },
        NOW,
      ),
    ).toBe('ASSIGNED');
  });
});
