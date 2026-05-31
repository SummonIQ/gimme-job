'use client';

import { type Transition } from 'framer-motion';
import {
  AlertCircle,
  CheckCircle2,
  Circle,
  UserRoundCheck,
} from 'lucide-react';

import type {
  PlanBoardClaimState,
  PlanBoardTaskStatus,
  PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';
import { cn } from '@/lib/css';

export const STATUS_COLUMNS: Array<{
  description: string;
  icon: typeof Circle;
  status: PlanBoardTaskStatus;
  title: string;
}> = [
  {
    description: 'Ready to start or waiting for Steven to pick the next move.',
    icon: Circle,
    status: 'TODO',
    title: 'Todo',
  },
  {
    description: 'Claimed and actively changing.',
    icon: UserRoundCheck,
    status: 'IN_PROGRESS',
    title: 'In Progress',
  },
  {
    description: 'Waiting on a dependency or a manual Steven step.',
    icon: AlertCircle,
    status: 'BLOCKED',
    title: 'Blocked',
  },
  {
    description: 'Acceptance criteria met.',
    icon: CheckCircle2,
    status: 'DONE',
    title: 'Done',
  },
];

export const STATUS_BADGE_VARIANTS: Record<
  PlanBoardTaskStatus,
  'default' | 'secondary' | 'success' | 'warning'
> = {
  BLOCKED: 'warning',
  DONE: 'success',
  IN_PROGRESS: 'secondary',
  TODO: 'default',
};

export const STATUS_LABELS: Record<PlanBoardTaskStatus, string> = {
  BLOCKED: 'Blocked',
  DONE: 'Done',
  IN_PROGRESS: 'In progress',
  TODO: 'Todo',
};

export const CLAIM_STATE_LABELS: Record<PlanBoardClaimState, string> = {
  ASSIGNED: 'Assigned',
  CLAIMED: 'Claimed',
  STALE: 'Stale claim',
  UNASSIGNED: 'Unassigned',
};

// Match only phrases that indicate the ticket is GATED on a manual / Steven
// action — not casual mentions like "Steven supplies credentials" in body
// prose or "manual — confirm via dev tools" in a test plan. The earlier
// pattern matched any `\bsteven\b` / `\bmanual\b`, which produced a flood of
// false-positive "Needs Steven" badges across descriptive ticket bodies.
const STEVEN_ACTION_PATTERN = new RegExp(
  [
    // Direct gating phrases.
    'needs steven',
    "steven['’]s (?:input|approval|sign[- ]?off|review|decision|go-ahead|kickoff)",
    'waiting on steven',
    'gated on steven',
    'requires steven',
    'steven (?:must|to|will|should) (?:approve|sign|review|run|kick off|kickoff|decide|confirm)',
    // Manual / approval gating phrases.
    'manual approval (?:required|needed)',
    'requires manual approval',
    'manual gate',
    'manual sign[- ]?off',
    'manual kickoff',
    'manual review (?:required|needed)',
    'requires manual review',
    'owner sign[- ]?off',
    'owner approval (?:required|needed)',
    'requires owner approval',
    'approved_by',
    'real submission (?:required|needed)',
    'requires a real submission',
    'live job (?:required|needed)',
    'hand[- ]?picked',
    'tabletop',
    // Phase-doc safety gates that always need owner sign-off.
    'signs off',
    'sign off (?:required|needed)',
  ].join('|'),
  'i',
);

export interface PlanBoardTaskActionGuidance {
  detail: string | null;
  headline: string;
  needsStevenAction: boolean;
  showManualReport: boolean;
  summary: string;
}

export const BOARD_LAYOUT_TRANSITION: Transition = {
  damping: 34,
  mass: 0.7,
  stiffness: 420,
  type: 'spring',
};

export const REDUCED_MOTION_TRANSITION: Transition = {
  duration: 0,
};

export function AssigneePill({
  agentHandle,
  size = 'sm',
  compact = false,
}: {
  agentHandle: string | null;
  size?: 'sm' | 'lg';
  // Compact: icon + initials only (no full handle text). Used on dense
  // kanban cards where the full row would dominate the card.
  compact?: boolean;
}) {
  const label = agentHandle ?? 'Unassigned';
  const initials = getAgentInitials(label);

  return (
    <div
      className={cn(
        'inline-flex min-w-0 items-center rounded-full border border-border/45 bg-background/55 text-foreground shadow-xs',
        compact ? 'gap-1' : 'gap-2',
        size === 'lg'
          ? 'max-w-full px-3 py-2 text-sm'
          : compact
            ? 'max-w-full px-1 py-0.5 text-[10px]'
            : 'max-w-full px-2 py-1 text-xs',
        !agentHandle && 'text-muted-foreground',
      )}
      title={compact && agentHandle ? agentHandle : undefined}
    >
      <span
        className={cn(
          'flex shrink-0 items-center justify-center rounded-full bg-muted font-semibold text-muted-foreground',
          size === 'lg'
            ? 'size-7 text-xs'
            : compact
              ? 'size-4 text-[9px]'
              : 'size-5 text-xs',
          agentHandle && 'bg-primary/12 text-primary',
        )}
      >
        {initials}
      </span>
      {compact ? null : <span className="truncate">{label}</span>}
    </div>
  );
}

// FINAL_PLAN.md task lines often pack a long status comment into the
// same line as the task title (e.g. "Retired. Replaced by ..."). Split
// the parsed `title` into a short headline (first sentence) plus the
// remaining body so the card and drawer can render them separately.
const TITLE_HEADLINE_MAX_CHARS = 90;
export function splitTaskTitle(title: string): {
  body: string | null;
  headline: string;
} {
  const trimmed = title.trim();
  if (!trimmed) {
    return { body: null, headline: '' };
  }

  const sentenceMatch = trimmed.match(/^(.+?[.!?])(\s+)(.+)$/s);
  if (sentenceMatch) {
    const headline = sentenceMatch[1].trim();
    const body = sentenceMatch[3].trim();
    if (headline.length <= TITLE_HEADLINE_MAX_CHARS) {
      return { body: body || null, headline };
    }
  }

  if (trimmed.length <= TITLE_HEADLINE_MAX_CHARS) {
    return { body: null, headline: trimmed };
  }

  const cutoff = trimmed.lastIndexOf(' ', TITLE_HEADLINE_MAX_CHARS);
  const breakAt = cutoff > 40 ? cutoff : TITLE_HEADLINE_MAX_CHARS;
  return {
    body: trimmed.slice(breakAt).trim() || null,
    headline: `${trimmed.slice(0, breakAt).trim()}…`,
  };
}

export function formatCount(values: string[], singularLabel: string) {
  if (values.length === 0) {
    return '';
  }

  return `${values.length} ${singularLabel}${values.length === 1 ? '' : 's'}`;
}

export function formatList(values: string[]) {
  return values.length > 0 ? values.join(', ') : 'None';
}

export function formatDateTime(value: string | null) {
  if (!value) {
    return 'No live update';
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatEventType(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function taskNeedsStevenAction(task: PlanBoardTaskView) {
  if (task.status !== 'TODO' && task.status !== 'BLOCKED') {
    return false;
  }

  const haystack = [
    task.title,
    task.acceptance,
    task.notes,
    task.testsRequired,
    ...task.events.map(event => event.message),
  ]
    .filter(Boolean)
    .join(' ');

  return STEVEN_ACTION_PATTERN.test(haystack);
}

export function getTaskActionGuidance(
  task: PlanBoardTaskView,
): PlanBoardTaskActionGuidance {
  const needsStevenAction = taskNeedsStevenAction(task);
  const detail =
    task.events.find(event => Boolean(event.message))?.message ??
    task.notes ??
    task.acceptance;

  if (task.status === 'BLOCKED') {
    return {
      detail: detail ?? null,
      headline: needsStevenAction ? 'Waiting on you' : 'Blocked on follow-up',
      needsStevenAction,
      showManualReport: true,
      summary: needsStevenAction
        ? 'This blocked ticket is waiting on a manual step, approval, or result from Steven before agent work can continue.'
        : 'This blocked ticket is waiting on another dependency or unresolved issue. If you clear it manually, record the result here.',
    };
  }

  if (task.status === 'TODO') {
    if (task.agentHandle) {
      return {
        detail: detail ?? null,
        headline: 'Reserved but not started',
        needsStevenAction,
        showManualReport: needsStevenAction,
        summary: `This todo card is reserved for ${task.agentHandle}. It is not actively being worked yet.`,
      };
    }

    return {
      detail: detail ?? null,
      headline: needsStevenAction ? 'Waiting on your kickoff' : 'Ready to start',
      needsStevenAction,
      showManualReport: needsStevenAction,
      summary: needsStevenAction
        ? 'This todo card includes a manual step or approval request. Finish that step and report the result, or assign it when you want an agent to continue.'
        : 'Nothing is actively blocking this ticket. Assign it or explicitly ask an agent to start it when you want work to begin.',
    };
  }

  return {
    detail: detail ?? null,
    headline: 'No manual action required',
    needsStevenAction: false,
    showManualReport: false,
    summary: 'This ticket does not currently need direct input from Steven.',
  };
}

export function getAgentInitials(agentHandle: string) {
  const parts = agentHandle
    .split(/[^a-zA-Z0-9]+/)
    .map(part => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return '??';
  }

  return parts
    .slice(0, 2)
    .map(part => part.charAt(0).toUpperCase())
    .join('');
}
