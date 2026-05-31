'use client';

import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  PLAN_BOARD_STATUSES,
  type PlanBoardHealthReport,
  type PlanBoardRealtimePayload,
  type PlanBoardSyncReport as PlanBoardSyncReportData,
  type PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';
import type { PlanBoardRealtimeConfig } from '@/lib/admin/summonflow';

import { KanbanBoard } from './_components/kanban-board';
import { BoardHealth } from './_components/board-health';
import {
  BOARD_LAYOUT_TRANSITION,
  REDUCED_MOTION_TRANSITION,
} from './_components/plan-board-shared';
import { SyncReport } from './_components/sync-report';
import { TaskDetailDrawer } from './_components/task-detail-drawer';

interface PlanBoardClientProps {
  initialHealthReport: PlanBoardHealthReport;
  initialSyncReport: PlanBoardSyncReportData;
  initialTasks: PlanBoardTaskView[];
  realtimeConfig: PlanBoardRealtimeConfig;
}

type SummonFlowConnectionState =
  | 'initialized'
  | 'connecting'
  | 'connected'
  | 'unavailable'
  | 'failed'
  | 'disconnected';

interface SummonFlowConnection {
  bind: (event: string, handler: (payload: unknown) => void) => void;
  state?: SummonFlowConnectionState;
  unbind: (event: string, handler?: (payload: unknown) => void) => void;
}

interface SummonFlowChannel {
  bind: (event: string, handler: (payload: unknown) => void) => void;
  unbind: (event: string, handler?: (payload: unknown) => void) => void;
}

interface SummonFlowClient {
  connection: SummonFlowConnection;
  disconnect: () => void;
  subscribe: (channelName: string) => SummonFlowChannel;
}

type SummonFlowConstructor = new (
  appKey: string,
  options: {
    forceTLS: boolean;
    reconnectMaxDelay: number;
    reconnectMinDelay: number;
    wsHost: string;
    wsPort: number;
    wssPort?: number;
  },
) => SummonFlowClient;

type PlanBoardConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unavailable';

interface PlanBoardConnectionCopy {
  label: string;
  title: string;
  variant: 'default' | 'outline' | 'secondary';
}

interface SummonFlowConnectionStateChange {
  current?: SummonFlowConnectionState;
}

interface UnknownRecord {
  [key: string]: unknown;
}

const REALTIME_RECONNECT_MIN_DELAY_MS = 1_000;
const REALTIME_RECONNECT_MAX_DELAY_MS = 10_000;
const PLAN_BOARD_STATUS_SET: ReadonlySet<string> = new Set(PLAN_BOARD_STATUSES);

const CONNECTION_COPY: Record<
  PlanBoardConnectionState,
  PlanBoardConnectionCopy
> = {
  connected: {
    label: 'Realtime connected',
    title: 'SummonFlow is connected and streaming plan-board updates.',
    variant: 'secondary',
  },
  connecting: {
    label: 'Realtime connecting',
    title: 'Connecting to SummonFlow for live plan-board updates.',
    variant: 'outline',
  },
  reconnecting: {
    label: 'Realtime reconnecting',
    title: 'SummonFlow is reconnecting; live plan-board updates are paused.',
    variant: 'outline',
  },
  unavailable: {
    label: 'Realtime unavailable',
    title: 'SummonFlow is unavailable; the board stays on the loaded snapshot.',
    variant: 'outline',
  },
};
export function PlanBoardClient({
  initialHealthReport,
  initialSyncReport,
  initialTasks,
  realtimeConfig,
}: PlanBoardClientProps) {
  const [healthReport, setHealthReport] = useState(initialHealthReport);
  const [syncReport, setSyncReport] = useState(initialSyncReport);
  const [tasks, setTasks] = useState(initialTasks);
  const [query, setQuery] = useState('');
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [connectionState, setConnectionState] =
    useState<PlanBoardConnectionState>(
      realtimeConfig.appKey ? 'connecting' : 'unavailable',
    );
  const shouldReduceMotion = useReducedMotion();
  const layoutTransition = shouldReduceMotion
    ? REDUCED_MOTION_TRANSITION
    : BOARD_LAYOUT_TRANSITION;

  const applyTaskUpdate = useCallback((task: PlanBoardTaskView) => {
    setTasks(currentTasks =>
      currentTasks.map(currentTask =>
        currentTask.taskId === task.taskId ? task : currentTask,
      ),
    );
  }, []);

  const reportRealtimeIssue = useCallback(
    (summary: string, payload: unknown) => {
      const details = describeRealtimeIssue(payload);
      console.warn('[PlanBoard] SummonFlow realtime issue', {
        appKeyPresent: Boolean(realtimeConfig.appKey),
        channelName: realtimeConfig.channelName,
        details,
        forceTLS: realtimeConfig.forceTLS,
        summary,
        wsHost: realtimeConfig.wsHost,
        wsPort: realtimeConfig.wsPort,
      });
    },
    [realtimeConfig],
  );

  useEffect(() => {
    if (!realtimeConfig.appKey) {
      setConnectionState('unavailable');
      return;
    }

    let client: SummonFlowClient | null = null;
    let channel: SummonFlowChannel | null = null;
    let isMounted = true;

    setConnectionState('connecting');

    const handleTaskUpdated = (payload: unknown) => {
      const update = parseRealtimePayload(payload);
      if (!update) {
        return;
      }
      applyTaskUpdate(update.task);
    };

    const handleConnectionStateChange = (payload: unknown) => {
      const nextState = parseConnectionStateChange(payload);
      if (!nextState || !isMounted) {
        return;
      }

      setConnectionState(mapConnectionState(nextState));
      if (nextState === 'unavailable' || nextState === 'failed') {
        reportRealtimeIssue(`SummonFlow connection state changed to ${nextState}`, payload);
      }
    };

    const handleConnectionError = (payload: unknown) => {
      if (!isMounted) {
        return;
      }

      reportRealtimeIssue('SummonFlow connection error', payload);
      setConnectionState('unavailable');
    };

    void import('@summoniq/summonflow-client-sdk')
      .then(module => {
        if (!isMounted) {
          return;
        }

        const SummonFlow = (module.default ??
          module.SummonFlow) as SummonFlowConstructor;
        client = new SummonFlow(realtimeConfig.appKey, {
          forceTLS: realtimeConfig.forceTLS,
          reconnectMaxDelay: REALTIME_RECONNECT_MAX_DELAY_MS,
          reconnectMinDelay: REALTIME_RECONNECT_MIN_DELAY_MS,
          wsHost: realtimeConfig.wsHost,
          wsPort: realtimeConfig.wsPort,
          wssPort: realtimeConfig.forceTLS ? realtimeConfig.wsPort : undefined,
        });
        client.connection.bind('state_change', handleConnectionStateChange);
        client.connection.bind('error', handleConnectionError);
        setConnectionState(mapConnectionState(client.connection.state));
        channel = client.subscribe(realtimeConfig.channelName);
        channel.bind('plan-task-updated', handleTaskUpdated);
      })
      .catch(() => {
        if (!isMounted) {
          return;
        }

        reportRealtimeIssue(
          'SummonFlow client failed to load',
          'The realtime client module could not be imported.',
        );
        setConnectionState('unavailable');
      });

    return () => {
      isMounted = false;
      channel?.unbind('plan-task-updated', handleTaskUpdated);
      client?.connection.unbind('state_change', handleConnectionStateChange);
      client?.connection.unbind('error', handleConnectionError);
      client?.disconnect();
    };
  }, [applyTaskUpdate, realtimeConfig]);

  const filteredTasks = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return tasks;
    }

    return tasks.filter(task =>
      [
        task.taskId,
        task.title,
        task.phaseTitle,
        task.agentHandle ?? '',
        task.assignmentReason ?? '',
        task.claimState,
        task.notes ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [query, tasks]);

  const selectedTask = useMemo(
    () =>
      selectedTaskId
        ? (tasks.find(task => task.taskId === selectedTaskId) ?? null)
        : null,
    [selectedTaskId, tasks],
  );
  const connectionCopy = CONNECTION_COPY[connectionState];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Card className="flex min-h-0 flex-1 flex-col overflow-visible bg-card/55 dark:bg-card/45 xl:overflow-hidden">
        <CardContent className="flex min-h-0 flex-1 flex-col p-2.5 md:p-3">
          <Tabs
            defaultValue="board"
            className="flex min-h-0 flex-1 flex-col gap-2"
          >
            <div className="flex shrink-0 flex-row flex-nowrap items-center gap-3">
              <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <h1 className="truncate text-base font-semibold text-foreground">
                  Plan Board
                </h1>
                <p className="truncate text-xs text-muted-foreground">
                  Live task board for application-runtime agents and Steven&apos;s review flow.
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <div className="relative flex items-center">
                  <AnimatePresence initial={false} mode="wait">
                    {isSearchOpen ? (
                      <motion.div
                        key="search-input"
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 240 }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                        className="overflow-hidden"
                      >
                        <Input
                          ref={searchInputRef}
                          type="search"
                          size="sm"
                          value={query}
                          onChange={event => setQuery(event.target.value)}
                          onBlur={() => {
                            if (!query.trim()) {
                              setIsSearchOpen(false);
                            }
                          }}
                          onKeyDown={event => {
                            if (event.key === 'Escape') {
                              setQuery('');
                              setIsSearchOpen(false);
                            }
                          }}
                          placeholder="Search task, phase, agent, or note"
                          className="h-8 w-full border-border/45 bg-background/60 shadow-sm backdrop-blur-md dark:bg-background/35"
                        />
                      </motion.div>
                    ) : (
                      <motion.button
                        key="search-icon"
                        type="button"
                        aria-label="Open search"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.12 }}
                        onClick={() => {
                          setIsSearchOpen(true);
                          requestAnimationFrame(() => searchInputRef.current?.focus());
                        }}
                        className="flex size-8 items-center justify-center rounded-md border border-border/45 bg-background/60 text-muted-foreground shadow-sm backdrop-blur-md transition-colors hover:text-foreground dark:bg-background/35"
                      >
                        <Search className="size-4" />
                      </motion.button>
                    )}
                  </AnimatePresence>
                  {isSearchOpen && query ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => {
                        setQuery('');
                        searchInputRef.current?.focus();
                      }}
                      className="absolute right-1.5 flex size-6 items-center justify-center rounded text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-3.5" />
                    </button>
                  ) : null}
                </div>
                <Badge
                  aria-label={`Plan board connection: ${connectionCopy.label}`}
                  className="px-2 py-1 text-xs"
                  title={connectionCopy.title}
                  variant={connectionCopy.variant}
                >
                  {connectionCopy.label}
                </Badge>
                <TabsList className="shrink-0">
                  <TabsTrigger value="board">Board</TabsTrigger>
                  <TabsTrigger value="health">Health</TabsTrigger>
                  <TabsTrigger value="sync">Sync</TabsTrigger>
                </TabsList>
              </div>
            </div>

            <TabsContent
              value="board"
              scrollable={false}
              className="mt-0 flex min-h-0 flex-1 flex-col"
            >
              <KanbanBoard
                layoutTransition={layoutTransition}
                onSelectTask={setSelectedTaskId}
                selectedTaskId={selectedTaskId}
                tasks={filteredTasks}
              />
            </TabsContent>

            <TabsContent
              value="health"
              scrollable
              className="mt-0 flex min-h-0 flex-1 flex-col"
            >
              <BoardHealth report={healthReport} />
            </TabsContent>

            <TabsContent
              value="sync"
              scrollable
              className="mt-0 flex min-h-0 flex-1 flex-col"
            >
              <SyncReport report={syncReport} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      <Sheet
        open={Boolean(selectedTask)}
        onOpenChange={isOpen => {
          if (!isOpen) {
            setSelectedTaskId(null);
          }
        }}
      >
        <SheetContent className="w-screen border-border/50 bg-card/85 p-0 backdrop-blur-xl sm:max-w-xl">
          {selectedTask ? (
            <TaskDetailDrawer
              task={selectedTask}
              onTaskUpdated={applyTaskUpdate}
            />
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export function parseRealtimePayload(
  payload: unknown,
): PlanBoardRealtimePayload | null {
  if (!isRecord(payload)) {
    return null;
  }

  const task = payload.task;
  const event = payload.event;
  if (!isPlanBoardTask(task) || !isRecord(event)) {
    return null;
  }
  if (typeof event.eventType !== 'string') {
    return null;
  }

  return payload as unknown as PlanBoardRealtimePayload;
}

function parseConnectionStateChange(
  payload: unknown,
): SummonFlowConnectionState | null {
  if (!isRecord(payload)) {
    return null;
  }

  const { current } = payload as SummonFlowConnectionStateChange;
  return isSummonFlowConnectionState(current) ? current : null;
}

function mapConnectionState(
  state: SummonFlowConnectionState | undefined,
): PlanBoardConnectionState {
  switch (state) {
    case 'connected':
      return 'connected';
    case 'connecting':
    case 'initialized':
      return 'connecting';
    case 'disconnected':
      return 'reconnecting';
    case 'unavailable':
    case 'failed':
    default:
      return 'unavailable';
  }
}

function isPlanBoardTask(value: unknown): value is PlanBoardTaskView {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.taskId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.status === 'string' &&
    PLAN_BOARD_STATUS_SET.has(value.status)
  );
}

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isSummonFlowConnectionState(
  value: unknown,
): value is SummonFlowConnectionState {
  return (
    value === 'initialized' ||
    value === 'connecting' ||
    value === 'connected' ||
    value === 'unavailable' ||
    value === 'failed' ||
    value === 'disconnected'
  );
}

function describeRealtimeIssue(payload: unknown): string {
  if (typeof payload === 'string' && payload.trim()) {
    return payload.trim();
  }

  if (payload instanceof Error) {
    return payload.message;
  }

  if (!isRecord(payload)) {
    return 'No additional error details were provided.';
  }

  const message = payload.message;
  if (typeof message === 'string' && message.trim()) {
    return message.trim();
  }

  const current = payload.current;
  if (typeof current === 'string' && current.trim()) {
    return `Current state: ${current.trim()}.`;
  }

  try {
    return JSON.stringify(payload);
  } catch {
    return 'The realtime client emitted an unreadable error payload.';
  }
}
