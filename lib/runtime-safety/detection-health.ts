import {
  ATSAutomationPostureLevel,
  type Prisma,
} from '@/generated/prisma/client';
import { publishDetectionHealthEvent } from '@/lib/admin/summonflow';
import { db } from '@/lib/db/client';

/**
 * Inline ATS-family classifier. Kept local so P16.6 does not depend on
 * `lib/runtime-safety/checks.ts` (P16.1), which stacks on a different
 * branch. When both land, the two copies can collapse to a single shared
 * `familyFromHostname` in `lib/applications/services/platform-detection`.
 */
function familyFromHostname(hostname: string): string | null {
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

export type DetectionSignal =
  | 'CAPTCHA_SPIKE'
  | 'SESSION_ABANDONMENT_SPIKE'
  | 'HTTP_ERROR_SPIKE'
  | 'LATENCY_SPIKE'
  | 'REPLY_RATE_COLLAPSE';

export interface DetectionThresholds {
  /** Captcha events / total submit events in window. Default 0.1 = 10%. */
  readonly captchaRatio: number;
  /** Session abandonment / sessions started in window. Default 0.35. */
  readonly sessionAbandonmentRatio: number;
  /** Non-2xx submit events / total submit events. Default 0.2. */
  readonly httpErrorRatio: number;
  /**
   * Observed median submit latency must stay within `latencyMultiplier` of
   * the hostname's trailing-baseline; default 2.0 = 2x baseline.
   */
  readonly latencyMultiplier: number;
  /**
   * Reply rate over the most recent submissions (window-scoped) must stay
   * >= baseline - `replyRateDrop`; default 0.3 (drop by 30 percentage
   * points triggers alert).
   */
  readonly replyRateDrop: number;
  /** Minimum sample size (total submit events) needed to evaluate. */
  readonly minSampleSize: number;
}

export const DEFAULT_THRESHOLDS: DetectionThresholds = Object.freeze({
  captchaRatio: 0.1,
  httpErrorRatio: 0.2,
  latencyMultiplier: 2.0,
  minSampleSize: 10,
  replyRateDrop: 0.3,
  sessionAbandonmentRatio: 0.35,
});

export interface HostSignals {
  readonly hostname: string;
  readonly window: { readonly start: Date; readonly end: Date };
  readonly submitEvents: number;
  readonly captchaEvents: number;
  readonly httpErrorEvents: number;
  readonly sessionsStarted: number;
  readonly sessionsAbandoned: number;
  readonly medianSubmitLatencyMs: number | null;
  readonly baselineSubmitLatencyMs: number | null;
  readonly replyRate: number | null;
  readonly baselineReplyRate: number | null;
}

export interface TriggeredSignal {
  readonly type: DetectionSignal;
  readonly value: number;
  readonly threshold: number;
  readonly detail: string;
}

export interface HostHealthVerdict {
  readonly hostname: string;
  readonly family: string | null;
  readonly triggered: readonly TriggeredSignal[];
  readonly sampleSize: number;
}

function ratio(num: number, denom: number): number {
  if (denom <= 0) return 0;
  return num / denom;
}

/**
 * Pure — given a hostname's aggregated signals, return the subset of
 * thresholds that tripped.
 */
export function analyzeHostHealth(
  signals: HostSignals,
  thresholds: DetectionThresholds = DEFAULT_THRESHOLDS,
): HostHealthVerdict {
  const triggered: TriggeredSignal[] = [];
  const totalSubmit = signals.submitEvents;

  if (totalSubmit >= thresholds.minSampleSize) {
    const captchaR = ratio(signals.captchaEvents, totalSubmit);
    if (captchaR >= thresholds.captchaRatio) {
      triggered.push({
        detail: `${signals.captchaEvents}/${totalSubmit} submits saw CAPTCHA`,
        threshold: thresholds.captchaRatio,
        type: 'CAPTCHA_SPIKE',
        value: captchaR,
      });
    }

    const errR = ratio(signals.httpErrorEvents, totalSubmit);
    if (errR >= thresholds.httpErrorRatio) {
      triggered.push({
        detail: `${signals.httpErrorEvents}/${totalSubmit} submits returned non-2xx`,
        threshold: thresholds.httpErrorRatio,
        type: 'HTTP_ERROR_SPIKE',
        value: errR,
      });
    }
  }

  if (signals.sessionsStarted >= thresholds.minSampleSize) {
    const abandon = ratio(signals.sessionsAbandoned, signals.sessionsStarted);
    if (abandon >= thresholds.sessionAbandonmentRatio) {
      triggered.push({
        detail: `${signals.sessionsAbandoned}/${signals.sessionsStarted} sessions abandoned`,
        threshold: thresholds.sessionAbandonmentRatio,
        type: 'SESSION_ABANDONMENT_SPIKE',
        value: abandon,
      });
    }
  }

  if (
    signals.medianSubmitLatencyMs !== null &&
    signals.baselineSubmitLatencyMs !== null &&
    signals.baselineSubmitLatencyMs > 0
  ) {
    const factor = signals.medianSubmitLatencyMs / signals.baselineSubmitLatencyMs;
    if (factor >= thresholds.latencyMultiplier) {
      triggered.push({
        detail: `median ${signals.medianSubmitLatencyMs}ms vs baseline ${signals.baselineSubmitLatencyMs}ms (${factor.toFixed(2)}x)`,
        threshold: thresholds.latencyMultiplier,
        type: 'LATENCY_SPIKE',
        value: factor,
      });
    }
  }

  if (
    signals.replyRate !== null &&
    signals.baselineReplyRate !== null &&
    signals.baselineReplyRate > 0
  ) {
    const drop = signals.baselineReplyRate - signals.replyRate;
    if (drop >= thresholds.replyRateDrop) {
      triggered.push({
        detail: `reply rate ${(signals.replyRate * 100).toFixed(1)}% vs baseline ${(signals.baselineReplyRate * 100).toFixed(1)}% (drop ${(drop * 100).toFixed(1)}pt)`,
        threshold: thresholds.replyRateDrop,
        type: 'REPLY_RATE_COLLAPSE',
        value: drop,
      });
    }
  }

  return {
    family: familyFromHostname(signals.hostname),
    hostname: signals.hostname,
    sampleSize: totalSubmit,
    triggered,
  };
}

export interface ApplyActionsResult {
  readonly hostname: string;
  readonly family: string | null;
  readonly posturesFlipped: readonly string[];
  readonly overrideIds: readonly string[];
  readonly auditLogId: string | null;
}

export interface ApplyActionsInput {
  readonly verdict: HostHealthVerdict;
  readonly userId: string;
  readonly now?: Date;
  /** Skip DB writes (useful for dry-run mode). Default false. */
  readonly dryRun?: boolean;
}

/**
 * Flip posture to GRAY (from ALLOWED only — FORBIDDEN stays FORBIDDEN),
 * write a RuntimeTrustOverride capping trust at ACTION_WITH_CONFIRMATION,
 * and audit both actions.
 */
export async function applyDetectionHealthActions(
  input: ApplyActionsInput,
): Promise<ApplyActionsResult> {
  const now = input.now ?? new Date();
  if (input.verdict.triggered.length === 0) {
    return {
      auditLogId: null,
      family: input.verdict.family,
      hostname: input.verdict.hostname,
      overrideIds: [],
      posturesFlipped: [],
    };
  }
  if (input.dryRun) {
    return {
      auditLogId: null,
      family: input.verdict.family,
      hostname: input.verdict.hostname,
      overrideIds: [],
      posturesFlipped: [],
    };
  }

  const posturesFlipped: string[] = [];
  const overrideIds: string[] = [];

  // Posture flip — only when family resolves and current posture is ALLOWED.
  if (input.verdict.family) {
    const posture = await db.aTSAutomationPosture.findUnique({
      where: { family: input.verdict.family },
    });
    if (posture && posture.posture === ATSAutomationPostureLevel.ALLOWED) {
      await db.aTSAutomationPosture.update({
        data: {
          notes: `Auto-flipped to GRAY by detection-health at ${now.toISOString()}`,
          posture: ATSAutomationPostureLevel.GRAY,
        },
        where: { family: input.verdict.family },
      });
      posturesFlipped.push(input.verdict.family);
    }
  }

  // Trust override — cap the hostname at ACTION_WITH_CONFIRMATION.
  const override = await db.runtimeTrustOverride.create({
    data: {
      actionType: 'submit',
      atsFamily: input.verdict.family ?? '',
      demotedTo: 'ACTION_WITH_CONFIRMATION',
      hostname: input.verdict.hostname,
      node: null,
      reason: `Auto-demoted by detection-health: ${input.verdict.triggered
        .map(t => t.type)
        .join(', ')}`,
      transition: null,
      userId: input.userId,
    },
  });
  overrideIds.push(override.id);

  const audit = await db.automationAuditLog.create({
    data: {
      action: 'AUTO_DETECTION_HEALTH_DEMOTE',
      actionType: 'TRUST_POLICY',
      metadata: {
        hostname: input.verdict.hostname,
        overrideIds,
        posturesFlipped,
        sampleSize: input.verdict.sampleSize,
        triggered: input.verdict.triggered.map(t => ({
          detail: t.detail,
          threshold: t.threshold,
          type: t.type,
          value: t.value,
        })),
      } satisfies Prisma.InputJsonValue,
      userId: input.userId,
    },
  });

  await publishDetectionHealthEvent({
    data: {
      auditLogId: audit.id,
      family: input.verdict.family,
      hostname: input.verdict.hostname,
      overrideIds,
      posturesFlipped,
      timestamp: now.toISOString(),
      triggered: input.verdict.triggered.map(t => t.type),
      userId: input.userId,
    },
  });

  return {
    auditLogId: audit.id,
    family: input.verdict.family,
    hostname: input.verdict.hostname,
    overrideIds,
    posturesFlipped,
  };
}

/**
 * DB-backed loader — aggregates ApplicationRuntimeEvent + JobLead /
 * ApplicationSubmission metrics over a window for every hostname the
 * user has submitted to. Kept separate from `analyzeHostHealth` so the
 * aggregation query can evolve without touching the pure scorer.
 */
export interface LoadSignalsInput {
  readonly userId: string;
  readonly now?: Date;
  readonly windowMinutes?: number;
}

export async function loadHostSignals(
  input: LoadSignalsInput,
): Promise<readonly HostSignals[]> {
  const now = input.now ?? new Date();
  const windowMinutes = input.windowMinutes ?? 60;
  const windowStart = new Date(now.getTime() - windowMinutes * 60 * 1000);

  // Runtime event aggregation — keyed by host pulled from `url`.
  const events = await db.applicationRuntimeEvent.findMany({
    select: {
      createdAt: true,
      errorCode: true,
      eventType: true,
      metadata: true,
      success: true,
      url: true,
    },
    where: {
      createdAt: { gte: windowStart, lte: now },
      userId: input.userId,
    },
  });

  const byHost = new Map<string, { submit: number; captcha: number; err: number; latencies: number[] }>();
  for (const ev of events) {
    const hostname = ev.url ? (() => {
      try {
        return new URL(ev.url).hostname;
      } catch {
        return '';
      }
    })() : '';
    if (!hostname) continue;
    const bucket =
      byHost.get(hostname) ??
      ({ captcha: 0, err: 0, latencies: [], submit: 0 } as const);
    const mutable = {
      captcha: bucket.captcha,
      err: bucket.err,
      latencies: [...bucket.latencies],
      submit: bucket.submit,
    };
    if (ev.eventType === 'submit' || ev.eventType === 'submit_attempt') {
      mutable.submit += 1;
      if (ev.success === false) mutable.err += 1;
      const latency = (ev.metadata as { latencyMs?: number } | null)?.latencyMs;
      if (typeof latency === 'number') mutable.latencies.push(latency);
    }
    if (ev.eventType === 'captcha' || ev.errorCode === 'CAPTCHA') {
      mutable.captcha += 1;
    }
    byHost.set(hostname, mutable);
  }

  const signals: HostSignals[] = [];
  for (const [hostname, bucket] of byHost) {
    const sortedLat = [...bucket.latencies].sort((a, b) => a - b);
    const medianLat =
      sortedLat.length > 0
        ? sortedLat[Math.floor(sortedLat.length / 2)]
        : null;
    signals.push({
      baselineReplyRate: null,
      baselineSubmitLatencyMs: null,
      captchaEvents: bucket.captcha,
      hostname,
      httpErrorEvents: bucket.err,
      medianSubmitLatencyMs: medianLat,
      replyRate: null,
      sessionsAbandoned: 0,
      sessionsStarted: 0,
      submitEvents: bucket.submit,
      window: { end: now, start: windowStart },
    });
  }

  return signals;
}

export const __TESTING__ = {
  DEFAULT_THRESHOLDS,
};
