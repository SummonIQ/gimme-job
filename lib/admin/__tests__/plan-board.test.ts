import { beforeAll, describe, expect, it, vi } from 'vitest';
import type {
  ParsedPlanTask,
  PlanBoardHealthReport,
  PlanBoardLiveTaskState,
  PlanBoardSyncReport,
  PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db/client', () => ({ db: {} }));

let buildPlanBoardSyncReport: (
  parsedTasks: ParsedPlanTask[],
  liveTasks: PlanBoardLiveTaskState[],
) => PlanBoardSyncReport;
let buildPlanBoardHealthReport: (
  tasks: PlanBoardTaskView[],
  now?: Date,
) => PlanBoardHealthReport;
let parsePlanTasks: (content: string) => ParsedPlanTask[];

const PLAN_WITH_TWO_TASKS = `
### Phase 15 — Agent coordination board

- [ ] **P15.1** Build sync report.
  - Files: \`lib/admin/plan-board.ts\`.
  - Depends on: —
  - Acceptance: report works.
  - Tests required: unit.

- [x] **P15.2** Keep status visible.
  - Files: \`app/page.tsx\`.
  - Depends on: P15.1
  - Acceptance: status visible.
  - Tests required: unit.
`;

function makeLiveTask(
  overrides: Partial<PlanBoardLiveTaskState> = {},
): PlanBoardLiveTaskState {
  return {
    agentHandle: 'codex',
    status: 'TODO',
    taskId: 'P15.1',
    updatedAt: '2026-04-22T10:00:00.000Z',
    ...overrides,
  };
}

function makeTaskView(
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
    taskId: 'P15.1',
    testsRequired: null,
    title: 'Plan board task',
    updatedAt: '2026-04-23T10:00:00.000Z',
    ...overrides,
  };
}

describe('plan-board sync', () => {
  beforeAll(async () => {
    const planBoard = await import('@/lib/admin/plan-board');
    buildPlanBoardHealthReport = planBoard.buildPlanBoardHealthReport;
    buildPlanBoardSyncReport = planBoard.buildPlanBoardSyncReport;
    parsePlanTasks = planBoard.parsePlanTasks;
  });

  it('parses plan task definitions', () => {
    const tasks = parsePlanTasks(PLAN_WITH_TWO_TASKS);

    expect(tasks).toMatchObject([
      {
        dependsOn: [],
        files: ['lib/admin/plan-board.ts'],
        markdownStatus: 'TODO',
        phaseId: 'P15',
        taskId: 'P15.1',
        title: 'Build sync report',
      },
      {
        dependsOn: ['P15.1'],
        markdownStatus: 'DONE',
        taskId: 'P15.2',
      },
    ]);
  });

  it('strips HTML protocol comments from titles and acceptance', () => {
    // Regression: titles like `**P4.2** Shelved alongside P4.1. <!-- codex 2026-04-23: ... --> <!-- claudie:done 2026-05-03 -->`
    // were rendering the entire HTML comment chain into the title (and
    // detail-drawer headline) because stripMarkdown only handled backticks
    // and asterisks. Comments are agent-protocol metadata — they belong in
    // the markdown for git history but never in user-facing surfaces.
    const PLAN = `
### Phase 4 — Ashby network-replay spike

- [!] **P4.2** Shelved alongside P4.1 (per docs/network-replay-decision.md). The schema exists. <!-- codex 2026-04-23: schema landed --> <!-- claudie:done 2026-05-03 reclassified [>] -> [!] -->
  - Files: \`lib/admin/runtime/runtime-replay.ts\`.
  - Depends on: —
  - Acceptance: row exists with all fields populated. <!-- codex 2026-04-23: confirmed -->
`;
    const tasks = parsePlanTasks(PLAN);
    expect(tasks[0]?.title).toBe(
      'Shelved alongside P4.1 (per docs/network-replay-decision.md). The schema exists',
    );
    expect(tasks[0]?.title).not.toContain('<!--');
    expect(tasks[0]?.title).not.toContain('codex');
    expect(tasks[0]?.title).not.toContain('claudie');
    expect(tasks[0]?.acceptance).toBe(
      'row exists with all fields populated',
    );
    expect(tasks[0]?.acceptance).not.toContain('<!--');
  });

  it('inherits phase-default labels and honors per-task overrides', () => {
    const PLAN = `
### Phase 15 — Agent coordination board

- [ ] **P15.1** Inherits phase default.
  - Files: \`lib/admin/plan-board.ts\`.
  - Depends on: —

- [ ] **P15.2** Has explicit labels.
  - Files: \`app/page.tsx\`.
  - Depends on: —
  - Labels: Workday, Job Scrapers
`;
    const tasks = parsePlanTasks(PLAN);

    expect(tasks[0]?.labels).toEqual(['Agent Coordination']);
    expect(tasks[1]?.labels).toEqual(['Workday', 'Job Scrapers']);
  });

  it('reports unchanged tasks as synced', () => {
    const parsedTasks = parsePlanTasks(PLAN_WITH_TWO_TASKS);
    const report = buildPlanBoardSyncReport(parsedTasks, [
      makeLiveTask({ taskId: 'P15.1' }),
      makeLiveTask({ status: 'DONE', taskId: 'P15.2' }),
    ]);

    expect(report.isSynced).toBe(true);
    expect(report.syncedTaskCount).toBe(2);
    expect(report.missingLiveTasks).toHaveLength(0);
    expect(report.orphanedLiveTasks).toHaveLength(0);
  });

  it('reports added markdown tasks missing live rows', () => {
    const parsedTasks = parsePlanTasks(PLAN_WITH_TWO_TASKS);
    const report = buildPlanBoardSyncReport(parsedTasks, [
      makeLiveTask({ taskId: 'P15.1' }),
    ]);

    expect(report.isSynced).toBe(false);
    expect(report.missingLiveTasks).toEqual([
      {
        phaseId: 'P15',
        taskId: 'P15.2',
        title: 'Keep status visible',
      },
    ]);
  });

  it('reports removed live rows as orphaned', () => {
    const parsedTasks = parsePlanTasks(PLAN_WITH_TWO_TASKS).slice(0, 1);
    const report = buildPlanBoardSyncReport(parsedTasks, [
      makeLiveTask({ taskId: 'P15.1' }),
      makeLiveTask({ status: 'DONE', taskId: 'P15.99' }),
    ]);

    expect(report.isSynced).toBe(false);
    expect(report.orphanedLiveTasks).toMatchObject([
      { phaseId: 'P15', taskId: 'P15.99' },
    ]);
  });

  it('flags same-phase orphan and missing pairs as rename hints', () => {
    const parsedTasks: ParsedPlanTask[] = [
      {
        acceptance: null,
        dependsOn: [],
        files: [],
        labels: [],
        markdownStatus: 'TODO',
        phaseId: 'P15',
        phaseTitle: 'Agent coordination board',
        sortOrder: 0,
        taskId: 'P15.2',
        testsRequired: null,
        title: 'New task id',
      },
    ];
    const report = buildPlanBoardSyncReport(parsedTasks, [
      makeLiveTask({ taskId: 'P15.99' }),
    ]);

    expect(report.possibleRenamedTaskIds).toEqual([
      {
        candidateTaskIds: ['P15.2'],
        orphanedTaskId: 'P15.99',
        phaseId: 'P15',
      },
    ]);
  });

  it('calculates board health metrics for blocked age, stale assignments, phase progress, and recent agents', () => {
    const report = buildPlanBoardHealthReport(
      [
        makeTaskView({
          agentHandle: 'claude-code',
          events: [
            {
              agentHandle: 'claude-code',
              createdAt: '2026-04-22T06:00:00.000Z',
              eventType: 'STATUS_CHANGED',
              fromStatus: 'TODO',
              id: 'event-blocked',
              message: 'Blocked',
              toStatus: 'BLOCKED',
            },
          ],
          status: 'BLOCKED',
          taskId: 'P15.1',
          title: 'Blocked task',
          updatedAt: '2026-04-22T06:00:00.000Z',
        }),
        makeTaskView({
          agentHandle: 'codex',
          events: [
            {
              agentHandle: 'codex',
              createdAt: '2026-04-23T10:00:00.000Z',
              eventType: 'NOTE_ADDED',
              fromStatus: 'IN_PROGRESS',
              id: 'event-codex',
              message: 'Progress',
              toStatus: 'IN_PROGRESS',
            },
          ],
          status: 'IN_PROGRESS',
          taskId: 'P15.2',
          title: 'Stale task',
          updatedAt: '2026-04-22T10:00:00.000Z',
        }),
        makeTaskView({
          status: 'TODO',
          taskId: 'P15.3',
          title: 'Aging task',
          updatedAt: '2026-04-18T00:00:00.000Z',
        }),
        makeTaskView({
          status: 'DONE',
          taskId: 'P15.4',
          title: 'Done task',
          updatedAt: '2026-04-23T08:00:00.000Z',
        }),
        makeTaskView({
          phaseId: 'P16',
          phaseTitle: 'Runbooks',
          status: 'DONE',
          taskId: 'P16.1',
        }),
        makeTaskView({
          phaseId: 'P16',
          phaseTitle: 'Runbooks',
          status: 'TODO',
          taskId: 'P16.2',
        }),
      ],
      new Date('2026-04-23T12:00:00.000Z'),
    );

    expect(report.blockedAge.blockedCount).toBe(1);
    expect(report.blockedAge.oldestBlockedTask).toMatchObject({
      ageHours: 30,
      taskId: 'P15.1',
    });
    expect(report.staleAssignments).toMatchObject({
      staleCount: 1,
      tasks: [{ ageHours: 26, taskId: 'P15.2' }],
    });
    expect(report.taskAging).toMatchObject({
      agingCount: 1,
      oldestTask: { taskId: 'P15.3' },
    });
    expect(report.phaseProgress).toMatchObject([
      {
        doneCount: 1,
        phaseId: 'P15',
        progressPercent: 25,
        totalCount: 4,
      },
      {
        doneCount: 1,
        phaseId: 'P16',
        progressPercent: 50,
        totalCount: 2,
      },
    ]);
    expect(report.recentAgents[0]).toMatchObject({
      activeTaskCount: 1,
      agentHandle: 'codex',
      eventCount: 1,
    });
  });

  it('canonicalizes recent-agent handles and drops phantom ones', () => {
    // Regression: dashboard previously showed `claude` as a separate row from
    // `claude-code`, and Steven's auth email occasionally surfaced as an
    // "agent". Both should be filtered or canonicalized so the panel reflects
    // the real agent population (claude-code / codex / copilot).
    const report = buildPlanBoardHealthReport([
      makeTaskView({
        agentHandle: 'claude',
        events: [
          {
            agentHandle: 'claude',
            assignmentReason: null,
            createdAt: '2026-05-09T10:00:00.000Z',
            eventType: 'STATUS_CHANGED',
            fromStatus: 'TODO',
            id: 'evt-claude-1',
            message: 'started',
            nextAgentHandle: null,
            previousAgentHandle: null,
            toStatus: 'IN_PROGRESS',
          },
        ],
        status: 'IN_PROGRESS',
        taskId: 'P18.1',
        updatedAt: '2026-05-09T10:00:00.000Z',
      }),
      makeTaskView({
        agentHandle: 'claude-code',
        status: 'IN_PROGRESS',
        taskId: 'P18.2',
        updatedAt: '2026-05-09T10:30:00.000Z',
      }),
      makeTaskView({
        agentHandle: 'bright-and-early@outlook.com',
        events: [
          {
            agentHandle: 'bright-and-early@outlook.com',
            assignmentReason: null,
            createdAt: '2026-05-09T11:00:00.000Z',
            eventType: 'NOTE_ADDED',
            fromStatus: 'IN_PROGRESS',
            id: 'evt-email',
            message: 'note',
            nextAgentHandle: null,
            previousAgentHandle: null,
            toStatus: 'IN_PROGRESS',
          },
        ],
        status: 'IN_PROGRESS',
        taskId: 'P18.3',
        updatedAt: '2026-05-09T11:00:00.000Z',
      }),
    ]);

    const handles = report.recentAgents.map(agent => agent.agentHandle);
    expect(handles).toContain('claude-code');
    expect(handles).not.toContain('claude');
    expect(handles).not.toContain('bright-and-early@outlook.com');
    // claude + claude-code should merge into one row with combined counts.
    const claudeCode = report.recentAgents.find(
      agent => agent.agentHandle === 'claude-code',
    );
    expect(claudeCode?.activeTaskCount).toBe(2);
  });
});
