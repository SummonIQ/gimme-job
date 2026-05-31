'use client';

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  type Transition,
} from 'framer-motion';

import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import type { PlanBoardTaskView } from '@/lib/admin/plan-board-types';
import { cn } from '@/lib/css';

import {
  AssigneePill,
  CLAIM_STATE_LABELS,
  formatCount,
  getTaskActionGuidance,
  STATUS_BADGE_VARIANTS,
  STATUS_COLUMNS,
  STATUS_LABELS,
} from './plan-board-shared';

interface KanbanBoardProps {
  layoutTransition: Transition;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  tasks: PlanBoardTaskView[];
}

export function KanbanBoard({
  layoutTransition,
  onSelectTask,
  selectedTaskId,
  tasks,
}: KanbanBoardProps) {
  return (
    <LayoutGroup id="admin-plan-board">
      {/* All four columns sit in a single horizontal row. Outer container
          scrolls horizontally on narrow viewports (so Done / Blocked never
          wrap below Todo / In Progress); each column scrolls vertically on
          its own. Columns get a fixed comfortable width — narrower than
          the previous quarter-of-viewport grid cells — so 4-up fits at
          ~1280px without scroll, and narrower viewports get horizontal
          scroll instead of a 2x2 wrap. */}
      <div className="flex min-h-0 flex-1 flex-row gap-3 overflow-x-auto overflow-y-hidden">
        {STATUS_COLUMNS.map(column => (
          <PlanBoardColumn
            key={column.status}
            column={column}
            layoutTransition={layoutTransition}
            tasks={getColumnTasks(tasks, column.status)}
            selectedTaskId={selectedTaskId}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>
    </LayoutGroup>
  );
}

function getColumnTasks(
  tasks: PlanBoardTaskView[],
  status: (typeof STATUS_COLUMNS)[number]['status'],
): PlanBoardTaskView[] {
  const columnTasks = tasks.filter(task => task.status === status);

  if (status !== 'DONE') {
    return columnTasks;
  }

  return [...columnTasks].sort(compareDoneTasks);
}

function compareDoneTasks(
  firstTask: PlanBoardTaskView,
  secondTask: PlanBoardTaskView,
): number {
  const updatedAtDelta =
    getTaskUpdatedAtMs(secondTask) - getTaskUpdatedAtMs(firstTask);

  if (updatedAtDelta !== 0) {
    return updatedAtDelta;
  }

  return firstTask.sortOrder - secondTask.sortOrder;
}

function getTaskUpdatedAtMs(task: PlanBoardTaskView): number {
  if (!task.updatedAt) {
    return 0;
  }

  const updatedAt = Date.parse(task.updatedAt);
  return Number.isNaN(updatedAt) ? 0 : updatedAt;
}

export function PlanBoardColumn({
  column,
  tasks,
  selectedTaskId,
  onSelectTask,
  layoutTransition,
}: {
  column: (typeof STATUS_COLUMNS)[number];
  layoutTransition: Transition;
  onSelectTask: (taskId: string) => void;
  selectedTaskId: string | null;
  tasks: PlanBoardTaskView[];
}) {
  const Icon = column.icon;

  return (
    <motion.section
      layout
      transition={layoutTransition}
      className="flex h-full w-72 shrink-0 flex-col overflow-hidden rounded-xl border border-border/35 bg-card/40 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-md backdrop-saturate-150 dark:bg-card/30"
    >
      <div className="flex shrink-0 items-center justify-between gap-2 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-3.5 shrink-0 text-muted-foreground" />
          <h2 className="truncate text-xs font-semibold uppercase tracking-wide text-foreground/85">
            {column.title}
          </h2>
        </div>
        <Badge
          variant={STATUS_BADGE_VARIANTS[column.status]}
          className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums"
        >
          {tasks.length}
        </Badge>
      </div>
      <Separator className="shrink-0 opacity-50" />
      <ScrollArea className="min-h-0 flex-1 [&>[data-radix-scroll-area-viewport]>div]:!block [&>[data-radix-scroll-area-viewport]>div]:!w-full">
        <motion.div layout className="flex w-full min-w-0 flex-col gap-2 p-2">
          <AnimatePresence initial={false}>
            {tasks.length > 0 ? (
              tasks.map(task => (
                <PlanTaskCard
                  key={task.taskId}
                  layoutTransition={layoutTransition}
                  isSelected={task.taskId === selectedTaskId}
                  task={task}
                  onSelectTask={onSelectTask}
                />
              ))
            ) : (
              <motion.div
                key={`${column.status}-empty`}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={layoutTransition}
                className="rounded-lg border border-dashed border-border/40 px-3 py-6 text-center text-xs text-muted-foreground/70"
              >
                No tasks
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </ScrollArea>
    </motion.section>
  );
}

export function PlanTaskCard({
  isSelected,
  layoutTransition,
  task,
  onSelectTask,
}: {
  isSelected: boolean;
  layoutTransition: Transition;
  onSelectTask: (taskId: string) => void;
  task: PlanBoardTaskView;
}) {
  const dependencySummary = formatCount(task.dependsOn, 'dep');
  const fileSummary = formatCount(task.files, 'file');
  const detail = task.acceptance ?? task.notes;
  const actionGuidance = getTaskActionGuidance(task);

  return (
    <motion.button
      layout
      layoutId={`plan-task-${task.taskId}`}
      type="button"
      initial={{ opacity: 0, scale: 0.98, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98, y: -8 }}
      whileHover={{ y: -1 }}
      transition={layoutTransition}
      onClick={() => onSelectTask(task.taskId)}
      className={cn(
        // Layout: full-width within column, content-sized height. min-w-0
        // is critical — without it the flex children with long unbreakable
        // strings (task IDs, badges) can push the button wider than the
        // column.
        'group relative flex w-full min-w-0 flex-col overflow-hidden rounded-lg text-left',
        // Surface: subtle elevation that grows on hover. Layered shadows
        // (large + small) read as "soft drop shadow + tight contact"
        // instead of one harsh blur.
        'border border-border/50 bg-card/85 backdrop-blur-md backdrop-saturate-150 shadow-[0_1px_2px_-1px_rgba(0,0,0,0.18),0_2px_4px_-2px_rgba(0,0,0,0.10)] transition-[transform,box-shadow,border-color,background-color] duration-150',
        'hover:border-border/80 hover:bg-card/95 hover:shadow-[0_4px_8px_-2px_rgba(0,0,0,0.22),0_2px_4px_-2px_rgba(0,0,0,0.12)]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        'dark:bg-card/60 dark:hover:bg-card/75',
        isSelected &&
          'border-primary/55 bg-card shadow-[0_0_0_1px_hsl(var(--primary)/0.35),0_4px_10px_-3px_rgba(0,0,0,0.30)] dark:bg-card/85',
      )}
    >
      {/* Inner padding container. min-w-0 lets line-clamp / truncate work. */}
      <div className="flex min-w-0 flex-col gap-1.5 p-2.5">
        {/* Top row: taskId chip · phase chip · (right-aligned) status chips
            + assignee. Status badge is dropped — already obvious from the
            column. Phase muted-title line is dropped — already in the chip. */}
        <div className="flex min-w-0 items-center gap-1">
          <Badge
            className="shrink-0 px-1.5 py-0.5 text-[10px] font-semibold tracking-tight"
            variant="outline"
          >
            {task.taskId}
          </Badge>
          <Badge
            className="shrink-0 px-1.5 py-0.5 text-[10px] font-medium"
            variant="default"
          >
            {task.phaseId}
          </Badge>
          <div className="ml-auto flex shrink-0 items-center gap-1">
            {actionGuidance.needsStevenAction ? (
              <Badge
                className="px-1.5 py-0.5 text-[10px]"
                variant="outline"
              >
                Needs Steven
              </Badge>
            ) : null}
            {task.isClaimStale ? (
              <Badge
                className="px-1.5 py-0.5 text-[10px]"
                variant="warning"
              >
                {CLAIM_STATE_LABELS[task.claimState]}
              </Badge>
            ) : null}
            {task.agentHandle ? (
              <AssigneePill agentHandle={task.agentHandle} compact />
            ) : null}
          </div>
        </div>

        {/* Title. min-w-0 + wrap-anywhere lets long unbreakable tokens
            (paths, URLs) break inside the flex column instead of forcing
            a horizontal overflow. */}
        <h3 className="line-clamp-2 min-w-0 [overflow-wrap:anywhere] text-[13px] font-semibold leading-snug text-foreground">
          {task.title}
        </h3>

        {detail ? (
          <p className="line-clamp-1 min-w-0 [overflow-wrap:anywhere] text-[11px] leading-relaxed text-muted-foreground/85">
            {detail}
          </p>
        ) : null}

        {/* Footer row: labels first, then dep/file counts. */}
        {task.labels.length > 0 || dependencySummary || fileSummary ? (
          <div className="flex min-w-0 flex-wrap items-center gap-1 pt-0.5">
            {task.labels.map(label => (
              <Badge
                key={label}
                className="px-1.5 py-0.5 text-[10px] font-normal"
                variant="secondary"
              >
                {label}
              </Badge>
            ))}
            {dependencySummary ? (
              <Badge
                className="px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
                variant="outline"
              >
                {dependencySummary}
              </Badge>
            ) : null}
            {fileSummary ? (
              <Badge
                className="px-1.5 py-0.5 text-[10px] font-normal text-muted-foreground"
                variant="outline"
              >
                {fileSummary}
              </Badge>
            ) : null}
          </div>
        ) : null}
      </div>
    </motion.button>
  );
}
