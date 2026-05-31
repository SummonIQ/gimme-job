#!/usr/bin/env bun

import { readFile } from 'node:fs/promises';

import {
  PLAN_BOARD_EVENT_TYPES,
  PLAN_BOARD_STATUSES,
  type PlanBoardSnapshot,
  type PlanBoardTaskEventType,
  type PlanBoardTaskStatus,
  type PlanBoardTaskUpdatePayload,
  type PlanBoardTaskView,
} from '@/lib/admin/plan-board-types';

const DEFAULT_BASE_URL = 'http://localhost:10100';
const DEFAULT_AGENT_HANDLE = 'codex';
const ACTIONS = ['assign', 'note', 'start', 'block', 'done', 'todo'] as const;

type PlanBoardAction = (typeof ACTIONS)[number];

export interface ParsedPlanBoardUpdateArgs {
  action: PlanBoardAction;
  agentHandle: string;
  baseUrl: string;
  cookie?: string;
  cookieFile?: string;
  email?: string;
  json: boolean;
  message?: string;
  notes?: string;
  password?: string;
  taskId: string;
}

interface AuthHeadersInput {
  baseUrl: string;
  cookie?: string;
  cookieFile?: string;
  email?: string;
  password?: string;
}

interface CliOptionState {
  action?: string;
  flags: Record<string, string | undefined>;
  positionals: string[];
}

interface PlanBoardTasksResponse {
  tasks?: PlanBoardTaskView[];
}

export function parseUpdatePlanBoardArgs(
  argv: string[],
  env: Record<string, string | undefined> = process.env,
): ParsedPlanBoardUpdateArgs {
  const parsed = parseCliOptions(argv);
  const [taskId, action] = parsed.positionals;

  if (!taskId || !action) {
    throw new Error(usage('Missing taskId or action'));
  }

  if (!isPlanBoardAction(action)) {
    throw new Error(
      usage(
        `Unknown action "${action}". Expected one of: ${ACTIONS.join(', ')}`,
      ),
    );
  }

  const agentHandle =
    parsed.flags.agent ??
    parsed.flags['agent-handle'] ??
    env.PLAN_BOARD_AGENT ??
    DEFAULT_AGENT_HANDLE;
  const baseUrl =
    parsed.flags['base-url'] ?? env.PLAN_BOARD_BASE_URL ?? DEFAULT_BASE_URL;
  const message = parsed.flags.message ?? parsed.flags.m;
  const notes = parsed.flags.notes;

  validateRequiredActionFields({ action, agentHandle, message });

  return {
    action,
    agentHandle,
    baseUrl: trimTrailingSlash(baseUrl),
    cookie: parsed.flags.cookie ?? env.PLAN_BOARD_COOKIE,
    cookieFile: parsed.flags['cookie-file'] ?? env.PLAN_BOARD_COOKIE_FILE,
    email: parsed.flags.email ?? env.PLAN_BOARD_EMAIL,
    json: parsed.flags.json === 'true',
    message,
    notes,
    password: parsed.flags.password ?? env.PLAN_BOARD_PASSWORD,
    taskId,
  };
}

export function buildPlanBoardTaskUpdatePayload({
  action,
  agentHandle,
  currentStatus,
  message,
  notes,
}: {
  action: PlanBoardAction;
  agentHandle: string;
  currentStatus: PlanBoardTaskStatus;
  message?: string;
  notes?: string;
}): PlanBoardTaskUpdatePayload {
  const status = getActionStatus(action, currentStatus);
  const eventType = getActionEventType(action);
  const payload: PlanBoardTaskUpdatePayload = {
    agentHandle,
    eventType,
    message: message ?? getDefaultMessage({ action, agentHandle, status }),
    status,
  };

  if (notes !== undefined) {
    payload.notes = notes;
  }

  validatePlanBoardTaskUpdatePayload(payload);

  return payload;
}

export function validatePlanBoardTaskUpdatePayload(
  payload: PlanBoardTaskUpdatePayload,
): void {
  if (!PLAN_BOARD_STATUSES.includes(payload.status)) {
    throw new Error(`Invalid status "${payload.status}"`);
  }

  if (!PLAN_BOARD_EVENT_TYPES.includes(payload.eventType)) {
    throw new Error(`Invalid eventType "${payload.eventType}"`);
  }

  if (payload.message && payload.message.length > 500) {
    throw new Error('Message must be 500 characters or fewer');
  }

  if (payload.notes && payload.notes.length > 2000) {
    throw new Error('Notes must be 2000 characters or fewer');
  }
}

export async function updatePlanBoardTask(
  args: ParsedPlanBoardUpdateArgs,
): Promise<PlanBoardTaskView> {
  const authHeaders = await getAuthHeaders(args);
  const task = await getCurrentTask({
    authHeaders,
    baseUrl: args.baseUrl,
    taskId: args.taskId,
  });
  const payload = buildPlanBoardTaskUpdatePayload({
    action: args.action,
    agentHandle: args.agentHandle,
    currentStatus: task.status,
    message: args.message,
    notes: args.notes,
  });

  const response = await fetch(
    `${args.baseUrl}/api/admin/plan-board/tasks/${encodeURIComponent(args.taskId)}`,
    {
      body: JSON.stringify(payload),
      headers: {
        ...authHeaders,
        'content-type': 'application/json',
      },
      method: 'PATCH',
    },
  );

  if (!response.ok) {
    throw new Error(
      `Plan-board update failed (${response.status}): ${await response.text()}`,
    );
  }

  const body = (await response.json()) as { task?: PlanBoardTaskView };
  if (!body.task) {
    throw new Error('Plan-board update response did not include task');
  }

  return body.task;
}

async function main() {
  const args = parseUpdatePlanBoardArgs(process.argv.slice(2));
  const task = await updatePlanBoardTask(args);

  if (args.json) {
    console.log(JSON.stringify({ task }, null, 2));
    return;
  }

  console.log(
    `${task.taskId} ${task.status} (${task.agentHandle ?? 'unassigned'}): ${task.title}`,
  );
}

function parseCliOptions(argv: string[]): CliOptionState {
  const state: CliOptionState = { flags: {}, positionals: [] };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith('-')) {
      state.positionals.push(token);
      continue;
    }

    if (token === '--json') {
      state.flags.json = 'true';
      continue;
    }

    const [rawName, inlineValue] = token.replace(/^--?/, '').split('=', 2);
    const value = inlineValue ?? argv[index + 1];

    if (!value || value.startsWith('-')) {
      throw new Error(usage(`Missing value for --${rawName}`));
    }

    state.flags[rawName] = value;
    if (inlineValue === undefined) {
      index += 1;
    }
  }

  return state;
}

function validateRequiredActionFields({
  action,
  agentHandle,
  message,
}: {
  action: PlanBoardAction;
  agentHandle: string;
  message?: string;
}) {
  if (!agentHandle.trim()) {
    throw new Error(usage('Agent handle is required'));
  }

  if ((action === 'note' || action === 'block') && !message?.trim()) {
    throw new Error(usage(`${action} requires --message`));
  }
}

function getActionStatus(
  action: PlanBoardAction,
  currentStatus: PlanBoardTaskStatus,
): PlanBoardTaskStatus {
  switch (action) {
    case 'assign':
    case 'note':
      return currentStatus;
    case 'start':
      return 'IN_PROGRESS';
    case 'block':
      return 'BLOCKED';
    case 'done':
      return 'DONE';
    case 'todo':
      return 'TODO';
  }
}

function getActionEventType(action: PlanBoardAction): PlanBoardTaskEventType {
  switch (action) {
    case 'assign':
      return 'AGENT_ASSIGNED';
    case 'note':
      return 'NOTE_ADDED';
    case 'start':
    case 'block':
    case 'done':
    case 'todo':
      return 'STATUS_CHANGED';
  }
}

function getDefaultMessage({
  action,
  agentHandle,
  status,
}: {
  action: PlanBoardAction;
  agentHandle: string;
  status: PlanBoardTaskStatus;
}): string {
  switch (action) {
    case 'assign':
      return `Assigned to ${agentHandle}.`;
    case 'note':
      return `Note added by ${agentHandle}.`;
    case 'start':
      return `Started by ${agentHandle}.`;
    case 'block':
      return `Blocked by ${agentHandle}.`;
    case 'done':
      return `Completed by ${agentHandle}.`;
    case 'todo':
      return `Moved to ${status} by ${agentHandle}.`;
  }
}

async function getCurrentTask({
  authHeaders,
  baseUrl,
  taskId,
}: {
  authHeaders: Record<string, string>;
  baseUrl: string;
  taskId: string;
}): Promise<PlanBoardTaskView> {
  const response = await fetch(`${baseUrl}/api/admin/plan-board/tasks`, {
    headers: authHeaders,
  });

  if (!response.ok) {
    throw new Error(
      `Plan-board fetch failed (${response.status}): ${await response.text()}`,
    );
  }

  const snapshot = (await response.json()) as PlanBoardSnapshot &
    PlanBoardTasksResponse;
  const task = snapshot.tasks?.find(candidate => candidate.taskId === taskId);

  if (!task) {
    throw new Error(`Task ${taskId} was not found on the plan board`);
  }

  return task;
}

async function getAuthHeaders(
  input: AuthHeadersInput,
): Promise<Record<string, string>> {
  const cookie =
    input.cookie ??
    (input.cookieFile ? await readCookieFile(input.cookieFile) : undefined) ??
    (input.email && input.password ? await signInForCookie(input) : undefined);

  if (!cookie) {
    throw new Error(
      usage(
        'Provide PLAN_BOARD_COOKIE, PLAN_BOARD_COOKIE_FILE, or PLAN_BOARD_EMAIL/PLAN_BOARD_PASSWORD',
      ),
    );
  }

  return { cookie };
}

async function signInForCookie({
  baseUrl,
  email,
  password,
}: AuthHeadersInput): Promise<string> {
  if (!email || !password) {
    throw new Error('Email and password are required for sign-in');
  }

  const response = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
    body: JSON.stringify({ email, password }),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });

  if (!response.ok) {
    throw new Error(`Plan-board sign-in failed (${response.status})`);
  }

  const setCookie = getSetCookieHeaders(response.headers);
  const cookie = setCookie
    .map(value => value.split(';')[0])
    .filter(Boolean)
    .join('; ');

  if (!cookie) {
    throw new Error('Plan-board sign-in did not return cookies');
  }

  return cookie;
}

function getSetCookieHeaders(headers: Headers): string[] {
  const getSetCookie = (headers as Headers & { getSetCookie?: () => string[] })
    .getSetCookie;

  if (getSetCookie) {
    return getSetCookie.call(headers);
  }

  const setCookie = headers.get('set-cookie');
  return setCookie ? [setCookie] : [];
}

async function readCookieFile(cookieFile: string): Promise<string> {
  const contents = await readFile(cookieFile, 'utf8');
  const cookies = contents
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(
      line => line && (!line.startsWith('#') || line.startsWith('#HttpOnly_')),
    )
    .map(line => line.replace(/^#HttpOnly_/, ''))
    .map(line => {
      const parts = line.split(/\s+/);
      if (parts.length >= 7) {
        return `${parts[5]}=${parts.slice(6).join('')}`;
      }

      return line.includes('=') ? line : '';
    })
    .filter(Boolean);

  if (cookies.length === 0) {
    throw new Error(`No cookies found in ${cookieFile}`);
  }

  return cookies.join('; ');
}

function isPlanBoardAction(value: string): value is PlanBoardAction {
  return ACTIONS.includes(value as PlanBoardAction);
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function usage(reason: string): string {
  return `${reason}

Usage:
  bun scripts/update-plan-board-task.ts <taskId> <assign|note|start|block|done|todo> --agent <handle> [--message <text>]

Auth:
  PLAN_BOARD_COOKIE='better-auth.session_token=...' ...
  PLAN_BOARD_COOKIE_FILE=/tmp/gimme-job-plan-board-cookies.txt ...
  PLAN_BOARD_EMAIL=<email> PLAN_BOARD_PASSWORD=<password> ...`;
}

if (import.meta.main) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
