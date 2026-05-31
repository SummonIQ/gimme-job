import {
  SubmissionTier,
  type ApplicationConfirmationState,
} from '@/generated/prisma/client';

/**
 * Scale-up policy (FINAL_PLAN.md Section 14.2).
 *
 * Gates when a hostname may move up the tier ladder for burst submissions:
 *
 *   TARGETED          - default; every submission is human-reviewed
 *   GENERIC           - guarded auto; hostname must have 10 successful
 *                       TARGETED submissions inside a trailing 14-day window
 *   FIRE_AND_FORGET   - full auto; hostname must have 50 successful
 *                       confirmed submissions (at any prior tier) inside
 *                       the trailing 14-day window AND zero failures
 *                       inside the same window
 *
 * A "successful" submission in this context means the submission reached a
 * verified confirmation state (EMAIL / ATS / DASHBOARD confirmed). A
 * PRESUMED_FAILED or VERIFIED_FAILED submission counts as a failure.
 *
 * This module is pure. Callers are expected to assemble the trailing-window
 * signals from the DB and pass them in. Pairs with
 * `evaluateScopedTrust()` in `lib/runtime-trust-ladder` - tier and trust
 * escalate independently; the campaign dispatcher should gate a real burst
 * on the intersection of both.
 */

export const GENERIC_TIER_SUCCESS_THRESHOLD = 10;
export const FIRE_AND_FORGET_SUCCESS_THRESHOLD = 50;
export const SCALE_WINDOW_DAYS = 14;

export interface ScaleSignal {
  readonly at: Date;
  /** The tier the submission was dispatched under. */
  readonly tier: SubmissionTier;
  readonly confirmationState: ApplicationConfirmationState;
}

export interface ScalePolicyContext {
  readonly now?: Date;
  readonly windowDays?: number;
}

export interface ScalePolicyResult {
  readonly eligibleTier: SubmissionTier;
  readonly reasons: readonly string[];
  readonly windowStart: Date;
  readonly counts: {
    readonly targetedSuccesses: number;
    readonly totalSuccesses: number;
    readonly failures: number;
  };
}

const SUCCESS_STATES = new Set<ApplicationConfirmationState>([
  'ATS_CONFIRMED',
  'EMAIL_CONFIRMED',
  'DASHBOARD_CONFIRMED',
]);

const FAILURE_STATES = new Set<ApplicationConfirmationState>([
  'PRESUMED_FAILED',
  'VERIFIED_FAILED',
]);

function windowStart(now: Date, windowDays: number): Date {
  return new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
}

/** Pure helper - filter signals to the trailing window. */
export function signalsInWindow(
  signals: readonly ScaleSignal[],
  now: Date,
  windowDays: number,
): readonly ScaleSignal[] {
  const start = windowStart(now, windowDays);
  return signals.filter(s => s.at.getTime() >= start.getTime());
}

/**
 * Returns the highest tier a hostname is eligible to dispatch at, given
 * its trailing-window submission signals. Always returns a tier - the
 * minimum is `TARGETED` (fresh hostnames and any failure conditions).
 */
export function evaluateScalePolicy(
  signals: readonly ScaleSignal[],
  context: ScalePolicyContext = {},
): ScalePolicyResult {
  const now = context.now ?? new Date();
  const windowDays = context.windowDays ?? SCALE_WINDOW_DAYS;
  const start = windowStart(now, windowDays);

  const window = signalsInWindow(signals, now, windowDays);

  const targetedSuccesses = window.filter(
    s =>
      s.tier === SubmissionTier.TARGETED &&
      SUCCESS_STATES.has(s.confirmationState),
  ).length;

  const totalSuccesses = window.filter(s =>
    SUCCESS_STATES.has(s.confirmationState),
  ).length;

  const failures = window.filter(s =>
    FAILURE_STATES.has(s.confirmationState),
  ).length;

  const reasons: string[] = [];
  let tier: SubmissionTier = SubmissionTier.TARGETED;

  if (targetedSuccesses >= GENERIC_TIER_SUCCESS_THRESHOLD) {
    tier = SubmissionTier.GENERIC;
    reasons.push(
      `targeted-successes=${targetedSuccesses}>=${GENERIC_TIER_SUCCESS_THRESHOLD}`,
    );
  } else {
    reasons.push(
      `targeted-successes=${targetedSuccesses}<${GENERIC_TIER_SUCCESS_THRESHOLD}:stay-TARGETED`,
    );
  }

  if (
    tier === SubmissionTier.GENERIC &&
    totalSuccesses >= FIRE_AND_FORGET_SUCCESS_THRESHOLD &&
    failures === 0
  ) {
    tier = SubmissionTier.FIRE_AND_FORGET;
    reasons.push(
      `total-successes=${totalSuccesses}>=${FIRE_AND_FORGET_SUCCESS_THRESHOLD}-and-zero-failures`,
    );
  } else if (tier === SubmissionTier.GENERIC) {
    if (totalSuccesses < FIRE_AND_FORGET_SUCCESS_THRESHOLD) {
      reasons.push(
        `total-successes=${totalSuccesses}<${FIRE_AND_FORGET_SUCCESS_THRESHOLD}:stay-GENERIC`,
      );
    }
    if (failures > 0) {
      reasons.push(
        `failures-in-window=${failures}>0:stay-GENERIC`,
      );
    }
  }

  // Any failure in the window forces at most GENERIC - FIRE_AND_FORGET
  // demands a perfectly clean window.
  if (failures > 0 && tier === SubmissionTier.FIRE_AND_FORGET) {
    tier = SubmissionTier.GENERIC;
    reasons.push(`failures-in-window=${failures}:demote-to-GENERIC`);
  }

  return {
    counts: { failures, targetedSuccesses, totalSuccesses },
    eligibleTier: tier,
    reasons,
    windowStart: start,
  };
}
