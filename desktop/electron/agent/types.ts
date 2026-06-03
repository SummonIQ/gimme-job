import type {
  DesktopToolCallRequest,
  DesktopToolCallResult,
  DesktopToolName,
} from '../tools/types.js';

export interface DesktopValidationFailure {
  readonly fieldLabel: string;
  readonly fieldSelector: string;
  readonly message: string;
}

export const DESKTOP_AGENT_MODES = ['training', 'submit'] as const;

export type DesktopAgentMode = (typeof DESKTOP_AGENT_MODES)[number];

/**
 * Typed submit-failure statuses. Every terminal state of a desktop run
 * lands as one of these. The string-literal value is what the desktop
 * IPC, the web ingest endpoint, and the admin trace all read; do NOT
 * rename a value without coordinating an end-to-end migration.
 *
 *   completed                 — verified success (confirmation matched).
 *   paused_for_manual_review  — runner asked Steven to take over (e.g. an
 *                               unexpected modal). Not a failure.
 *   blocked_by_submit_guard   — submit_guard env disabled the click.
 *   validation_failed         — the form rejected the data we entered;
 *                               see ApplicationSubmission.failureReason
 *                               + extracted validation errors (P17.8).
 *   manual_auth_required      — site needs a sign-in / account-creation
 *                               step we can't automate (P17.10).
 *   captcha_required          — runner detected a captcha; submission
 *                               aborted before any click.
 *   closed_posting            — provider-neutral closed-posting detector
 *                               matched (P17.5).
 *   confirmation_timeout      — submit click landed but no confirmation
 *                               phrase was detected within the timeout
 *                               window.
 *   unsupported_provider      — autopilot picked a hostname whose
 *                               provider readiness label is `unsupported`
 *                               (P17.2). Refused before navigation.
 *   failed                    — generic fallback. Use only when none of
 *                               the typed reasons fit; the resolver
 *                               above is the long-term goal.
 *   cancelled                 — user pressed Cancel mid-run.
 *   unavailable               — the runtime itself was unavailable
 *                               (e.g. ollama daemon not running).
 */
export const DESKTOP_AGENT_SESSION_STATUSES = [
  'blocked_by_submit_guard',
  'cancelled',
  'captcha_required',
  'closed_posting',
  'completed',
  'confirmation_timeout',
  'failed',
  'manual_auth_required',
  'paused_for_manual_review',
  'unavailable',
  'unsupported_provider',
  'validation_failed',
] as const;

export type DesktopAgentSessionStatus =
  (typeof DESKTOP_AGENT_SESSION_STATUSES)[number];

export function isDesktopAgentSessionStatus(
  value: unknown,
): value is DesktopAgentSessionStatus {
  return (
    typeof value === 'string' &&
    (DESKTOP_AGENT_SESSION_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Set of statuses that represent terminal failure modes (i.e. the
 * runner finished but the submission did not succeed). `failed` is in
 * here as the "we don't know which" fallback; over time we want this
 * set to become exhaustive enough that `failed` is never emitted.
 */
export const DESKTOP_AGENT_FAILURE_STATUSES = [
  'captcha_required',
  'closed_posting',
  'confirmation_timeout',
  'failed',
  'manual_auth_required',
  'unsupported_provider',
  'validation_failed',
] as const satisfies readonly DesktopAgentSessionStatus[];

export type DesktopAgentFailureStatus =
  (typeof DESKTOP_AGENT_FAILURE_STATUSES)[number];

export function isDesktopAgentFailureStatus(
  value: unknown,
): value is DesktopAgentFailureStatus {
  return (
    typeof value === 'string' &&
    (DESKTOP_AGENT_FAILURE_STATUSES as readonly string[]).includes(value)
  );
}

export class DesktopAgentCancelledError extends Error {
  constructor(message = 'Run cancelled by user.') {
    super(message);
    this.name = 'DesktopAgentCancelledError';
  }
}

export interface DesktopAgentToolCall extends DesktopToolCallRequest {
  reason?: string;
}

export interface DesktopAgentToolDefinition {
  description: string;
  name: DesktopToolName;
}

export interface DesktopAgentToolEvent extends DesktopAgentToolCall {
  result: DesktopToolCallResult;
}

export interface DesktopAgentRuntimeInput {
  callTool: (request: DesktopAgentToolCall) => Promise<DesktopToolCallResult>;
  mode: DesktopAgentMode;
  objective: string;
  signal?: AbortSignal;
  systemPrompt: string;
  tools: readonly DesktopAgentToolDefinition[];
}

export interface DesktopAgentRuntimeResult {
  message: string;
  status?: DesktopAgentSessionStatus;
  validationFailures?: readonly DesktopValidationFailure[];
}

export interface DesktopAgentRuntime {
  run: (input: DesktopAgentRuntimeInput) => Promise<DesktopAgentRuntimeResult>;
}

export interface DesktopAgentSessionOptions {
  mode?: DesktopAgentMode;
  runtime: DesktopAgentRuntime;
}

export interface DesktopAgentRunInput {
  objective: string;
  signal?: AbortSignal;
}

export interface DesktopAgentRunResult {
  events: DesktopAgentToolEvent[];
  message: string;
  mode: DesktopAgentMode;
  status: DesktopAgentSessionStatus;
  systemPrompt: string;
  validationFailures?: readonly DesktopValidationFailure[];
}
