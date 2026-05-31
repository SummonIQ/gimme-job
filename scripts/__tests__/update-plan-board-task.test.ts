import { describe, expect, it } from 'vitest';

import {
  buildPlanBoardTaskUpdatePayload,
  parseUpdatePlanBoardArgs,
  validatePlanBoardTaskUpdatePayload,
} from '../update-plan-board-task';

describe('parseUpdatePlanBoardArgs', () => {
  it('parses a done command with environment defaults', () => {
    const parsed = parseUpdatePlanBoardArgs(
      ['P15.6', 'done', '--message', 'Finished locally.'],
      {
        PLAN_BOARD_AGENT: 'codex',
        PLAN_BOARD_BASE_URL: 'http://localhost:10100/',
        PLAN_BOARD_COOKIE_FILE: '/tmp/cookies.txt',
      },
    );

    expect(parsed).toEqual(
      expect.objectContaining({
        action: 'done',
        agentHandle: 'codex',
        baseUrl: 'http://localhost:10100',
        cookieFile: '/tmp/cookies.txt',
        message: 'Finished locally.',
        taskId: 'P15.6',
      }),
    );
  });

  it('requires a message for notes and blocked updates', () => {
    expect(() =>
      parseUpdatePlanBoardArgs(['P15.6', 'note', '--agent', 'codex'], {}),
    ).toThrow('note requires --message');

    expect(() =>
      parseUpdatePlanBoardArgs(['P15.6', 'block', '--agent', 'codex'], {}),
    ).toThrow('block requires --message');
  });

  it('rejects unknown actions', () => {
    expect(() =>
      parseUpdatePlanBoardArgs(['P15.6', 'ship', '--agent', 'codex'], {}),
    ).toThrow('Unknown action');
  });
});

describe('buildPlanBoardTaskUpdatePayload', () => {
  it('builds an assignment payload without changing current status', () => {
    expect(
      buildPlanBoardTaskUpdatePayload({
        action: 'assign',
        agentHandle: 'claude-code',
        currentStatus: 'TODO',
      }),
    ).toEqual({
      agentHandle: 'claude-code',
      eventType: 'AGENT_ASSIGNED',
      message: 'Assigned to claude-code.',
      status: 'TODO',
    });
  });

  it('builds note, blocked, started, and done payloads', () => {
    expect(
      buildPlanBoardTaskUpdatePayload({
        action: 'note',
        agentHandle: 'codex',
        currentStatus: 'IN_PROGRESS',
        message: 'Waiting on local-only dependency.',
      }),
    ).toEqual({
      agentHandle: 'codex',
      eventType: 'NOTE_ADDED',
      message: 'Waiting on local-only dependency.',
      status: 'IN_PROGRESS',
    });

    expect(
      buildPlanBoardTaskUpdatePayload({
        action: 'block',
        agentHandle: 'codex',
        currentStatus: 'IN_PROGRESS',
        message: 'Dependency missing from origin/main.',
      }),
    ).toEqual(
      expect.objectContaining({
        eventType: 'STATUS_CHANGED',
        message: 'Dependency missing from origin/main.',
        status: 'BLOCKED',
      }),
    );

    expect(
      buildPlanBoardTaskUpdatePayload({
        action: 'start',
        agentHandle: 'codex',
        currentStatus: 'TODO',
      }).status,
    ).toBe('IN_PROGRESS');

    expect(
      buildPlanBoardTaskUpdatePayload({
        action: 'done',
        agentHandle: 'codex',
        currentStatus: 'IN_PROGRESS',
      }).status,
    ).toBe('DONE');
  });

  it('validates message and notes length limits before PATCH', () => {
    expect(() =>
      validatePlanBoardTaskUpdatePayload({
        eventType: 'NOTE_ADDED',
        message: 'x'.repeat(501),
        status: 'TODO',
      }),
    ).toThrow('Message must be 500 characters or fewer');

    expect(() =>
      validatePlanBoardTaskUpdatePayload({
        eventType: 'NOTE_ADDED',
        notes: 'x'.repeat(2001),
        status: 'TODO',
      }),
    ).toThrow('Notes must be 2000 characters or fewer');
  });
});
