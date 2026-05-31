'use client';

import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import type { PlanBoardHealthReport } from '@/lib/admin/plan-board-types';

const MAX_VISIBLE_PHASES = 4;

export function BoardHealth({ report }: { report: PlanBoardHealthReport }) {
  const totalTasks = report.phaseProgress.reduce(
    (sum, phase) => sum + phase.totalCount,
    0,
  );
  const totalDone = report.phaseProgress.reduce(
    (sum, phase) => sum + phase.doneCount,
    0,
  );
  const totalProgress =
    totalTasks === 0 ? 0 : Math.round((totalDone / totalTasks) * 100);

  return (
    <section className="shrink-0 rounded-xl border border-border/40 bg-background/35 p-3 shadow-sm backdrop-blur-md dark:bg-background/20">
      <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-sm font-semibold text-foreground">
            Board health
          </h2>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Attention, age, phase progress, and recent agent activity.
          </p>
        </div>
        <Badge
          variant={report.blockedAge.blockedCount > 0 ? 'outline' : 'secondary'}
        >
          {totalProgress}% complete
        </Badge>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        <HealthMetric
          detail={formatOldestTask(report.blockedAge.oldestBlockedTask)}
          label="Blocked"
          value={report.blockedAge.blockedCount}
        />
        <HealthMetric
          detail={`${report.staleAssignments.thresholdHours}h threshold`}
          label="Stale claims"
          value={report.staleAssignments.staleCount}
        />
        <HealthMetric
          detail={`${report.taskAging.thresholdHours}h threshold`}
          label="Aging tasks"
          value={report.taskAging.agingCount}
        />
        <HealthMetric
          detail={`${totalDone}/${totalTasks} tasks done`}
          label="Phase progress"
          value={`${totalProgress}%`}
        />
        <HealthMetric
          detail="Last board events"
          label="Active agents"
          value={report.recentAgents.length}
        />
      </div>

      <div className="mt-3 grid gap-2 lg:grid-cols-[1fr_20rem]">
        <div className="rounded-lg border border-border/35 bg-background/45 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              Phase progress
            </p>
            <Badge className="px-1.5 py-0.5 text-xs" variant="outline">
              {report.phaseProgress.length} phases
            </Badge>
          </div>
          <div className="mt-2 flex flex-col gap-2">
            {report.phaseProgress.slice(0, MAX_VISIBLE_PHASES).map(phase => (
              <div className="flex flex-col gap-1" key={phase.phaseId}>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-foreground">
                    {phase.phaseId} - {phase.phaseTitle}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {phase.doneCount}/{phase.totalCount}
                  </span>
                </div>
                <Progress className="h-1.5" value={phase.progressPercent} />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/35 bg-background/45 p-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-foreground">
              Recent agents
            </p>
            <Badge className="px-1.5 py-0.5 text-xs" variant="outline">
              {report.recentAgents.length}
            </Badge>
          </div>
          <div className="mt-2 flex flex-col gap-1.5">
            {report.recentAgents.length === 0 ? (
              <p className="text-xs text-muted-foreground">No agent events.</p>
            ) : (
              report.recentAgents.map(agent => (
                <div
                  className="flex items-center justify-between gap-2 text-xs"
                  key={agent.agentHandle}
                >
                  <span className="truncate text-foreground">
                    {agent.agentHandle}
                  </span>
                  <span className="shrink-0 text-muted-foreground">
                    {agent.activeTaskCount} active / {agent.eventCount} events
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function HealthMetric({
  detail,
  label,
  value,
}: {
  detail: string;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-lg border border-border/35 bg-background/45 p-2">
      <p className="text-xs font-medium uppercase text-muted-foreground/75">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-foreground">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function formatOldestTask(
  task: PlanBoardHealthReport['blockedAge']['oldestBlockedTask'],
) {
  if (!task) {
    return 'No blocked tasks';
  }

  if (task.ageHours === null) {
    return `${task.taskId} has no timestamp`;
  }

  return `${task.taskId} blocked ${formatAge(task.ageHours)}`;
}

function formatAge(ageHours: number) {
  if (ageHours < 1) {
    return '<1h';
  }

  if (ageHours < 24) {
    return `${ageHours}h`;
  }

  const days = Math.floor(ageHours / 24);
  const hours = ageHours % 24;
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}
