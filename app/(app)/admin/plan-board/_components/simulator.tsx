'use client';

import { PlayCircle } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  PlanBoardTaskStatus,
  PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';

type SimulationEventType =
  | 'AGENT_ASSIGNED'
  | 'NOTE_ADDED'
  | 'SIMULATION_STEP'
  | 'STATUS_CHANGED';

interface SimulationStep {
  payload: {
    agentHandle: string;
    eventType: SimulationEventType;
    message: string;
    status: PlanBoardTaskStatus;
  };
  taskId: string;
}

interface SimulationScenario {
  buildSteps: (tasks: PlanBoardTaskView[]) => SimulationStep[];
  description: string;
  id: string;
  title: string;
}

interface PlanBoardSimulatorProps {
  onTaskUpdated: (task: PlanBoardTaskView) => void;
  tasks: PlanBoardTaskView[];
}

interface SimulationResult {
  message: string;
  status: 'error' | 'success';
}

const SIMULATOR_AGENT = 'simulator-agent';
const HANDOFF_AGENT = 'simulator-handoff';

const SCENARIOS: SimulationScenario[] = [
  {
    buildSteps: buildAssignmentProgressSteps,
    description: 'Assignment, start, and progress note.',
    id: 'assignment-progress',
    title: 'Assignment + notes',
  },
  {
    buildSteps: buildBlockedDependencySteps,
    description: 'Blocks a task with unmet dependencies.',
    id: 'blocked-dependency',
    title: 'Blocked dependency',
  },
  {
    buildSteps: buildReassignmentSteps,
    description: 'Hands an active task to another agent.',
    id: 'reassignment',
    title: 'Reassignment',
  },
  {
    buildSteps: buildCompletionSteps,
    description: 'Adds a closing note and moves a task done.',
    id: 'completion',
    title: 'Completion',
  },
];

export function PlanBoardSimulator({
  onTaskUpdated,
  tasks,
}: PlanBoardSimulatorProps) {
  const [runningScenarioId, setRunningScenarioId] = useState<string | null>(
    null,
  );
  const [result, setResult] = useState<SimulationResult | null>(null);
  const scenarioViews = useMemo(
    () =>
      SCENARIOS.map(scenario => ({
        ...scenario,
        steps: scenario.buildSteps(tasks),
      })),
    [tasks],
  );

  const handleRunScenario = async (
    scenario: SimulationScenario,
    steps: SimulationStep[],
  ) => {
    if (steps.length === 0) {
      setResult({
        message: `${scenario.title} has no eligible target task.`,
        status: 'error',
      });
      return;
    }

    setRunningScenarioId(scenario.id);
    setResult(null);

    try {
      for (const step of steps) {
        const response = await fetch(
          `/api/admin/plan-board/tasks/${encodeURIComponent(step.taskId)}`,
          {
            body: JSON.stringify(step.payload),
            headers: { 'content-type': 'application/json' },
            method: 'PATCH',
          },
        );

        if (!response.ok) {
          throw new Error(await response.text());
        }

        const body = (await response.json()) as { task?: PlanBoardTaskView };
        if (body.task) {
          onTaskUpdated(body.task);
        }
      }

      setResult({
        message: `${scenario.title} ran ${steps.length} API step${steps.length === 1 ? '' : 's'} for ${steps[0].taskId}.`,
        status: 'success',
      });
    } catch (error) {
      setResult({
        message:
          error instanceof Error ? error.message : `${scenario.title} failed.`,
        status: 'error',
      });
    } finally {
      setRunningScenarioId(null);
    }
  };

  return (
    <section className="shrink-0 rounded-xl border border-border/40 bg-background/35 p-3 shadow-sm backdrop-blur-md dark:bg-background/20">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            Scenario simulator
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Runs live task-update scenarios through the same API agents use.
          </p>
        </div>
        {result ? (
          <Badge
            variant={result.status === 'success' ? 'secondary' : 'outline'}
          >
            {result.status === 'success'
              ? 'Last run passed'
              : 'Last run failed'}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {scenarioViews.map(scenario => {
          const targetTaskId = scenario.steps[0]?.taskId ?? null;
          const isRunning = runningScenarioId === scenario.id;

          return (
            <div
              className="flex flex-col gap-3 rounded-lg border border-border/35 bg-background/45 p-2"
              key={scenario.id}
            >
              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <p className="text-xs font-semibold text-foreground">
                    {scenario.title}
                  </p>
                  {targetTaskId ? (
                    <Badge className="px-1.5 py-0.5 text-xs" variant="outline">
                      {targetTaskId}
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {scenario.description}
                </p>
              </div>
              <Button
                aria-label={`Run ${scenario.title}`}
                disabled={scenario.steps.length === 0}
                inProgress={isRunning}
                onClick={() => handleRunScenario(scenario, scenario.steps)}
                size="sm"
                type="button"
                variant="outline"
              >
                <PlayCircle data-icon="inline-start" />
                Run
              </Button>
            </div>
          );
        })}
      </div>

      {result ? (
        <p className="mt-3 rounded-lg border border-border/35 bg-background/45 p-2 text-xs leading-relaxed text-muted-foreground">
          {result.message}
        </p>
      ) : null}
    </section>
  );
}

function buildAssignmentProgressSteps(
  tasks: PlanBoardTaskView[],
): SimulationStep[] {
  const task = tasks.find(candidate => candidate.status === 'TODO');

  if (!task) {
    return [];
  }

  return [
    {
      payload: {
        agentHandle: SIMULATOR_AGENT,
        eventType: 'AGENT_ASSIGNED',
        message: `Simulation assigned ${task.taskId} to ${SIMULATOR_AGENT}.`,
        status: 'TODO',
      },
      taskId: task.taskId,
    },
    {
      payload: {
        agentHandle: SIMULATOR_AGENT,
        eventType: 'STATUS_CHANGED',
        message: `Simulation started ${task.taskId}.`,
        status: 'IN_PROGRESS',
      },
      taskId: task.taskId,
    },
    {
      payload: {
        agentHandle: SIMULATOR_AGENT,
        eventType: 'NOTE_ADDED',
        message: `Simulation progress note for ${task.taskId}.`,
        status: 'IN_PROGRESS',
      },
      taskId: task.taskId,
    },
  ];
}

function buildBlockedDependencySteps(
  tasks: PlanBoardTaskView[],
): SimulationStep[] {
  const taskStatuses = new Map(tasks.map(task => [task.taskId, task.status]));
  const task = tasks.find(
    candidate =>
      candidate.status === 'TODO' &&
      candidate.dependsOn.some(
        dependencyId => taskStatuses.get(dependencyId) !== 'DONE',
      ),
  );

  if (!task) {
    return [];
  }

  return [
    {
      payload: {
        agentHandle: SIMULATOR_AGENT,
        eventType: 'STATUS_CHANGED',
        message: `Simulation blocked ${task.taskId} on dependencies: ${task.dependsOn.join(', ')}.`,
        status: 'BLOCKED',
      },
      taskId: task.taskId,
    },
  ];
}

function buildReassignmentSteps(tasks: PlanBoardTaskView[]): SimulationStep[] {
  const task = tasks.find(candidate => candidate.status === 'IN_PROGRESS');

  if (!task) {
    return [];
  }

  return [
    {
      payload: {
        agentHandle: HANDOFF_AGENT,
        eventType: 'AGENT_ASSIGNED',
        message: `Simulation reassigned ${task.taskId} to ${HANDOFF_AGENT}.`,
        status: 'IN_PROGRESS',
      },
      taskId: task.taskId,
    },
    {
      payload: {
        agentHandle: HANDOFF_AGENT,
        eventType: 'NOTE_ADDED',
        message: `Simulation handoff note for ${task.taskId}.`,
        status: 'IN_PROGRESS',
      },
      taskId: task.taskId,
    },
  ];
}

function buildCompletionSteps(tasks: PlanBoardTaskView[]): SimulationStep[] {
  const task = tasks.find(candidate =>
    ['BLOCKED', 'IN_PROGRESS'].includes(candidate.status),
  );

  if (!task) {
    return [];
  }

  return [
    {
      payload: {
        agentHandle: task.agentHandle ?? SIMULATOR_AGENT,
        eventType: 'NOTE_ADDED',
        message: `Simulation closing note for ${task.taskId}.`,
        status: task.status,
      },
      taskId: task.taskId,
    },
    {
      payload: {
        agentHandle: task.agentHandle ?? SIMULATOR_AGENT,
        eventType: 'STATUS_CHANGED',
        message: `Simulation completed ${task.taskId}.`,
        status: 'DONE',
      },
      taskId: task.taskId,
    },
  ];
}
