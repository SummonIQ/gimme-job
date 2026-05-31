import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  ATSAutomationPostureLevel,
  type ConfirmationInbox,
  type ApplicationFlowDefinition,
} from '@/generated/prisma/client';
import { db } from '@/lib/db/client';

export type ReasonCode =
  | 'POSTURE_GRAY'
  | 'POSTURE_FORBIDDEN'
  | 'POSTURE_UNKNOWN'
  | 'CONFIRMATION_MISSING'
  | 'RATE_BUDGET_EMPTY'
  | 'INBOX_UNREACHABLE'
  | 'GUARD_OFF'
  | 'REGRESSION_STALE'
  | 'HOST_BLOCKLISTED'
  | 'HOSTNAME_UNKNOWN_FAMILY';

export interface CheckResult {
  readonly ok: boolean;
  readonly reasonCode?: ReasonCode;
  readonly detail: string;
}

const REGRESSION_STALE_DAYS = 7;
const BLOCKLIST_PATH = 'docs/hostname-blocklist.md';

/**
 * Minimal family classifier for safety-gate checks. Kept inline so the
 * safety-gate lib has zero runtime dependency on the larger classifier
 * graph.
 */
export function familyFromHostname(hostname: string): string | null {
  const lower = hostname.toLowerCase();
  if (lower.includes('greenhouse.io')) return 'greenhouse';
  if (lower.includes('lever.co')) return 'lever';
  if (lower.includes('ashbyhq.com')) return 'ashby';
  if (lower.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (lower.includes('icims.com')) return 'icims';
  if (lower.includes('myworkdayjobs.com') || lower.includes('workday.com'))
    return 'workday';
  if (lower.includes('taleo.net')) return 'taleo';
  if (lower.includes('jobvite.com')) return 'jobvite';
  if (lower.includes('successfactors.com')) return 'successfactors';
  if (lower.includes('bamboohr.com')) return 'bamboohr';
  if (lower.includes('csod.com')) return 'cornerstone';
  return null;
}

/**
 * Parse the hostname blocklist markdown file. Public + pure so tests can
 * drive it with fixture strings without touching disk.
 */
export function parseBlocklist(markdown: string): Set<string> {
  const result = new Set<string>();
  const lines = markdown.split('\n');
  let insideEntries = false;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('## ')) {
      insideEntries = /^##\s+entries\b/i.test(line);
      continue;
    }
    if (!insideEntries) continue;
    if (!line.startsWith('-')) continue;
    const remainder = line.slice(1).trimStart();
    const host = remainder.split(/\s|<!--/)[0]?.trim().toLowerCase();
    if (host) result.add(host);
  }
  return result;
}

export async function loadBlocklist(
  root: string = process.cwd(),
): Promise<Set<string>> {
  const file = path.resolve(root, BLOCKLIST_PATH);
  try {
    const text = await readFile(file, 'utf8');
    return parseBlocklist(text);
  } catch {
    return new Set();
  }
}

export async function checkHostBlocklist(
  hostname: string,
  opts: { blocklist?: Set<string>; root?: string } = {},
): Promise<CheckResult> {
  const blocklist = opts.blocklist ?? (await loadBlocklist(opts.root));
  const host = hostname.toLowerCase();
  if (blocklist.has(host)) {
    return {
      detail: `${host} is present in ${BLOCKLIST_PATH}`,
      ok: false,
      reasonCode: 'HOST_BLOCKLISTED',
    };
  }
  return { detail: `${host} is not blocklisted`, ok: true };
}

export async function checkAtsPosture(hostname: string): Promise<CheckResult> {
  const family = familyFromHostname(hostname);
  if (!family) {
    return {
      detail: `Cannot resolve ATS family for hostname ${hostname}`,
      ok: false,
      reasonCode: 'HOSTNAME_UNKNOWN_FAMILY',
    };
  }

  const row = await db.aTSAutomationPosture.findUnique({
    where: { family },
  });

  if (!row) {
    return {
      detail: `No ATSAutomationPosture row for family ${family}`,
      ok: false,
      reasonCode: 'POSTURE_UNKNOWN',
    };
  }

  if (row.posture === ATSAutomationPostureLevel.ALLOWED) {
    return {
      detail: `${family} posture is ALLOWED`,
      ok: true,
    };
  }
  if (row.posture === ATSAutomationPostureLevel.GRAY) {
    return {
      detail: `${family} posture is GRAY — requires explicit promotion`,
      ok: false,
      reasonCode: 'POSTURE_GRAY',
    };
  }
  return {
    detail: `${family} posture is FORBIDDEN`,
    ok: false,
    reasonCode: 'POSTURE_FORBIDDEN',
  };
}

export async function checkConfirmationPhraseRegistered(
  hostname: string,
): Promise<CheckResult> {
  const count = await db.submissionConfirmationPhrase.count({
    where: { hostname: hostname.toLowerCase() },
  });
  if (count === 0) {
    return {
      detail: `No SubmissionConfirmationPhrase rows for ${hostname}`,
      ok: false,
      reasonCode: 'CONFIRMATION_MISSING',
    };
  }
  return { detail: `${count} confirmation phrase(s) registered`, ok: true };
}

export async function checkRateBudget(
  hostname: string,
  opts: { actionType?: string } = {},
): Promise<CheckResult> {
  const actionType = opts.actionType ?? 'submit';
  const row = await db.hostRateLimitState.findUnique({
    where: {
      hostname_actionType: { actionType, hostname },
    },
  });
  if (!row) {
    // No row means the bucket hasn't been seeded yet. The first dispatch
    // seeds it with full capacity — treat as OK.
    return {
      detail: `No bucket row; first dispatch will seed full capacity`,
      ok: true,
    };
  }
  if (row.tokens < 1) {
    return {
      detail: `Bucket has ${row.tokens.toFixed(2)} tokens (<1)`,
      ok: false,
      reasonCode: 'RATE_BUDGET_EMPTY',
    };
  }
  if (row.dayLimit !== null && row.dayCount >= row.dayLimit) {
    return {
      detail: `Day limit reached (${row.dayCount}/${row.dayLimit})`,
      ok: false,
      reasonCode: 'RATE_BUDGET_EMPTY',
    };
  }
  return {
    detail: `Bucket has ${row.tokens.toFixed(2)} tokens`,
    ok: true,
  };
}

export function isInboxReachable(
  inbox: Pick<ConfirmationInbox, 'isActive' | 'lastPolledAt' | 'pollingCadenceSeconds'>,
  now: Date,
): boolean {
  if (!inbox.isActive) return false;
  // If the inbox has never been polled, we treat it as reachable — the
  // worker will attempt on next tick.
  if (!inbox.lastPolledAt) return true;
  // Reachable if we've heard from it within 3x its polling cadence (the
  // cadence is in seconds).
  const stalenessMs = now.getTime() - inbox.lastPolledAt.getTime();
  return stalenessMs <= inbox.pollingCadenceSeconds * 3 * 1000;
}

export async function checkConfirmationInbox(
  opts: { userId?: string; now?: Date } = {},
): Promise<CheckResult> {
  const now = opts.now ?? new Date();
  const inboxes = await db.confirmationInbox.findMany({
    where: opts.userId ? { userId: opts.userId } : {},
  });
  if (inboxes.length === 0) {
    return {
      detail: 'No ConfirmationInbox rows configured',
      ok: false,
      reasonCode: 'INBOX_UNREACHABLE',
    };
  }
  const reachable = inboxes.filter(inbox => isInboxReachable(inbox, now));
  if (reachable.length === 0) {
    return {
      detail: `${inboxes.length} inbox(es) configured, none reachable`,
      ok: false,
      reasonCode: 'INBOX_UNREACHABLE',
    };
  }
  return {
    detail: `${reachable.length}/${inboxes.length} inbox(es) reachable`,
    ok: true,
  };
}

function submitGuardFromEnv(): boolean {
  const raw = process.env.SUBMIT_GUARD ?? process.env.APP_SUBMIT_GUARD;
  if (raw === undefined) return true; // default on per FINAL_PLAN.md
  const normalized = raw.trim().toLowerCase();
  return !['false', '0', 'off', 'no'].includes(normalized);
}

export function checkSubmitGuard(): CheckResult {
  if (submitGuardFromEnv()) {
    return { detail: 'submit_guard default (true)', ok: true };
  }
  return {
    detail: 'submit_guard env flag is explicitly off',
    ok: false,
    reasonCode: 'GUARD_OFF',
  };
}

function regressionPassingAtFromFlow(
  flow: ApplicationFlowDefinition,
): Date | null {
  const raw = flow.metadata as { regressionPassedAt?: string } | null;
  const fromMetadata = raw?.regressionPassedAt
    ? new Date(raw.regressionPassedAt)
    : null;
  if (fromMetadata && !Number.isNaN(fromMetadata.getTime())) {
    return fromMetadata;
  }
  // Fallback: a freshly compiled flow satisfies the 7-day window.
  return flow.lastCompiledAt;
}

export async function checkRegressionFreshness(
  hostname: string,
  opts: { now?: Date } = {},
): Promise<CheckResult> {
  const now = opts.now ?? new Date();
  const flow = await db.applicationFlowDefinition.findFirst({
    orderBy: { version: 'desc' },
    where: { hostname: hostname.toLowerCase(), status: 'ACTIVE' },
  });
  if (!flow) {
    return {
      detail: `No ACTIVE ApplicationFlowDefinition for ${hostname}`,
      ok: false,
      reasonCode: 'REGRESSION_STALE',
    };
  }
  const passingAt = regressionPassingAtFromFlow(flow);
  if (!passingAt) {
    return {
      detail: 'Flow has no regression timestamp',
      ok: false,
      reasonCode: 'REGRESSION_STALE',
    };
  }
  const ageDays =
    (now.getTime() - passingAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays > REGRESSION_STALE_DAYS) {
    return {
      detail: `Regression last passed ${ageDays.toFixed(1)}d ago (>${REGRESSION_STALE_DAYS}d)`,
      ok: false,
      reasonCode: 'REGRESSION_STALE',
    };
  }
  return {
    detail: `Regression passed ${ageDays.toFixed(1)}d ago`,
    ok: true,
  };
}

export interface RunAllInput {
  readonly hostname: string;
  readonly userId?: string;
  readonly actionType?: string;
  readonly now?: Date;
  readonly blocklist?: Set<string>;
  readonly blocklistRoot?: string;
}

export interface CheckReportEntry {
  readonly name: string;
  readonly ok: boolean;
  readonly reasonCode?: ReasonCode;
  readonly detail: string;
}

export interface SafetyGateReport {
  readonly hostname: string;
  readonly ok: boolean;
  readonly checks: readonly CheckReportEntry[];
  /** Unique reason codes of any failing check. */
  readonly failingReasons: readonly ReasonCode[];
}

export async function runAllChecks(
  input: RunAllInput,
): Promise<SafetyGateReport> {
  const hostname = input.hostname.toLowerCase();
  const now = input.now ?? new Date();

  const blocklist =
    input.blocklist ?? (await loadBlocklist(input.blocklistRoot));

  const [
    blocklistResult,
    postureResult,
    confirmationResult,
    rateResult,
    inboxResult,
    regressionResult,
  ] = await Promise.all([
    checkHostBlocklist(hostname, { blocklist }),
    checkAtsPosture(hostname),
    checkConfirmationPhraseRegistered(hostname),
    checkRateBudget(hostname, { actionType: input.actionType }),
    checkConfirmationInbox({ now, userId: input.userId }),
    checkRegressionFreshness(hostname, { now }),
  ]);
  const guardResult = checkSubmitGuard();

  const checks: CheckReportEntry[] = [
    { name: 'host-blocklist', ...blocklistResult },
    { name: 'ats-posture', ...postureResult },
    { name: 'confirmation-phrase', ...confirmationResult },
    { name: 'rate-budget', ...rateResult },
    { name: 'inbox-reachable', ...inboxResult },
    { name: 'regression-fresh', ...regressionResult },
    { name: 'submit-guard', ...guardResult },
  ];

  const failing = checks
    .filter(c => !c.ok && c.reasonCode)
    .map(c => c.reasonCode as ReasonCode);

  return {
    checks,
    failingReasons: Array.from(new Set(failing)),
    hostname,
    ok: checks.every(c => c.ok),
  };
}

export const __TESTING__ = {
  BLOCKLIST_PATH,
  REGRESSION_STALE_DAYS,
};
