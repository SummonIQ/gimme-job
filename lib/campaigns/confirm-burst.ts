import {
  ATSAutomationPostureLevel,
  SubmissionTier,
  type ApplicationConfirmationState,
} from '@/generated/prisma/client';
import { db } from '@/lib/db/client';
import {
  JobQueueStatus,
  JobType,
  enqueueJob,
} from '@/lib/pipeline/durable-queue';
import {
  TRUST_LEVEL_INDEX,
  evaluateScopedTrust,
  type ScopedSignal,
  type TrustLevel,
} from '@/lib/runtime-trust-ladder';

export type BurstMode = SubmissionTier;

/** Posture caps per burst mode (per FINAL_PLAN.md section 11). */
const MODE_POSTURE_REQUIREMENTS: Record<
  BurstMode,
  readonly ATSAutomationPostureLevel[]
> = {
  FIRE_AND_FORGET: [ATSAutomationPostureLevel.ALLOWED],
  GENERIC: [ATSAutomationPostureLevel.ALLOWED],
  TARGETED: [
    ATSAutomationPostureLevel.ALLOWED,
    ATSAutomationPostureLevel.GRAY,
    ATSAutomationPostureLevel.FORBIDDEN,
  ],
};

/** Minimum trust level per burst mode. */
const MODE_TRUST_MINIMUM: Record<BurstMode, TrustLevel> = {
  FIRE_AND_FORGET: 'FULL_AUTO',
  GENERIC: 'ACTION_WITH_CONFIRMATION',
  TARGETED: 'OBSERVE_ONLY',
};

/** A lead's tier ceiling vs requested burst mode. */
function tierPermitsMode(tier: SubmissionTier, mode: BurstMode): boolean {
  const order: SubmissionTier[] = [
    SubmissionTier.TARGETED,
    SubmissionTier.GENERIC,
    SubmissionTier.FIRE_AND_FORGET,
  ];
  return order.indexOf(tier) >= order.indexOf(mode);
}

/** Given a lead's tier and the requested burst mode, the effective mode is
 * the *stricter* (lower) of the two. Stricter = more human review. */
export function effectiveModeFor(
  requestedMode: BurstMode,
  leadTier: SubmissionTier,
): BurstMode {
  const order: SubmissionTier[] = [
    SubmissionTier.TARGETED,
    SubmissionTier.GENERIC,
    SubmissionTier.FIRE_AND_FORGET,
  ];
  const requestedIdx = order.indexOf(requestedMode);
  const tierIdx = order.indexOf(leadTier);
  return order[Math.min(requestedIdx, tierIdx)];
}

export type EligibilityDenialReason =
  | 'LEAD_NOT_FOUND'
  | 'LEAD_HOSTNAME_UNRESOLVED'
  | 'LEAD_ATS_FAMILY_UNRESOLVED'
  | 'POSTURE_BLOCKS_MODE'
  | 'TIER_BLOCKS_MODE'
  | 'TRUST_BELOW_MINIMUM'
  | 'RATE_BUDGET_EMPTY'
  | 'ALREADY_CONFIRMED';

export interface EligibleLeadCandidate {
  readonly leadId: string;
  readonly hostname: string;
  readonly atsFamily: string;
  readonly tier: SubmissionTier;
  readonly posture: ATSAutomationPostureLevel | null;
  readonly confirmationState: ApplicationConfirmationState;
  readonly trustSignals: readonly ScopedSignal[];
  readonly regressionPassingAt: Date | null;
}

export interface ConfirmBurstInput {
  readonly leadIds: readonly string[];
  readonly mode: BurstMode;
  readonly userId: string;
  readonly now?: Date;
}

export interface EnqueuedBurstItem {
  readonly leadId: string;
  readonly queueItemId: string;
  readonly effectiveMode: BurstMode;
  readonly trustLevel: TrustLevel;
}

export interface SkippedBurstItem {
  readonly leadId: string;
  readonly reason: EligibilityDenialReason;
  readonly detail?: string;
}

export interface ConfirmBurstResult {
  readonly mode: BurstMode;
  readonly enqueued: readonly EnqueuedBurstItem[];
  readonly skipped: readonly SkippedBurstItem[];
}

interface RateBudgetChecker {
  readonly hasBudget: (hostname: string) => boolean;
}

interface RateBudgetSnapshot {
  readonly dayCount: number;
  readonly dayLimit: number | null;
  readonly tokens: number;
}

/**
 * Pure evaluator - decide eligibility + effective mode for a single lead.
 * DB-free so tests can pin behavior.
 */
export function evaluateLeadForBurst(params: {
  candidate: EligibleLeadCandidate;
  mode: BurstMode;
  now: Date;
  rateBudget: RateBudgetChecker;
}):
  | {
      readonly ok: true;
      readonly effectiveMode: BurstMode;
      readonly trustLevel: TrustLevel;
    }
  | { readonly ok: false; readonly reason: EligibilityDenialReason; readonly detail?: string } {
  const { candidate, mode, now, rateBudget } = params;

  if (
    candidate.confirmationState === 'EMAIL_CONFIRMED' ||
    candidate.confirmationState === 'ATS_CONFIRMED' ||
    candidate.confirmationState === 'DASHBOARD_CONFIRMED'
  ) {
    return { ok: false, reason: 'ALREADY_CONFIRMED' };
  }

  if (!candidate.hostname) {
    return { ok: false, reason: 'LEAD_HOSTNAME_UNRESOLVED' };
  }
  if (!candidate.atsFamily) {
    return { ok: false, reason: 'LEAD_ATS_FAMILY_UNRESOLVED' };
  }

  if (!tierPermitsMode(candidate.tier, mode)) {
    return {
      detail: `lead tier ${candidate.tier} is below mode ${mode}`,
      ok: false,
      reason: 'TIER_BLOCKS_MODE',
    };
  }

  const effectiveMode = effectiveModeFor(mode, candidate.tier);

  if (
    candidate.posture !== null &&
    !MODE_POSTURE_REQUIREMENTS[effectiveMode].includes(candidate.posture)
  ) {
    return {
      detail: `posture ${candidate.posture} blocks ${effectiveMode}`,
      ok: false,
      reason: 'POSTURE_BLOCKS_MODE',
    };
  }

  const trustMinimum = MODE_TRUST_MINIMUM[effectiveMode];
  const trust = evaluateScopedTrust({
    context: {
      now,
      regressionPassingAt: candidate.regressionPassingAt,
    },
    scope: {
      actionType: 'submit',
      atsFamily: candidate.atsFamily,
      hostname: candidate.hostname,
      node: null,
      transition: null,
    },
    signals: candidate.trustSignals,
  });

  if (TRUST_LEVEL_INDEX[trust.level] < TRUST_LEVEL_INDEX[trustMinimum]) {
    return {
      detail: `trust ${trust.level} < required ${trustMinimum}`,
      ok: false,
      reason: 'TRUST_BELOW_MINIMUM',
    };
  }

  if (!rateBudget.hasBudget(candidate.hostname)) {
    return { ok: false, reason: 'RATE_BUDGET_EMPTY' };
  }

  return { effectiveMode, ok: true, trustLevel: trust.level };
}

interface LoadedLeadRow {
  readonly id: string;
  readonly userId: string;
  readonly submissionTier: SubmissionTier;
  readonly jobListing: {
    readonly company: string | null;
    readonly title: string;
    readonly jobProviderUrl: string | null;
  };
  readonly applicationSubmissions: ReadonlyArray<{
    readonly confirmationState: ApplicationConfirmationState;
  }>;
}

function hostnameFrom(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

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

/**
 * Main entry point. Loads the requested leads, assesses eligibility per
 * lead, enqueues DESKTOP_SUBMIT_REQUEST job rows for the ones that pass,
 * and returns a per-lead outcome list.
 *
 * Rate budget is computed once per distinct hostname via a
 * `HostRateLimitState` snapshot - this is intentionally *read-only*; the
 * actual token consumption happens in the burst runner (P11.3) at
 * dispatch time, not here.
 */
export async function confirmBurst(
  input: ConfirmBurstInput,
): Promise<ConfirmBurstResult> {
  const now = input.now ?? new Date();
  const leadIds = [...new Set(input.leadIds)];

  if (leadIds.length === 0) {
    return { enqueued: [], mode: input.mode, skipped: [] };
  }

  const leads = (await db.jobLead.findMany({
    include: {
      applicationSubmissions: {
        orderBy: { createdAt: 'desc' },
        select: { confirmationState: true },
        take: 1,
      },
      jobListing: {
        select: { company: true, jobProviderUrl: true, title: true },
      },
    },
    where: { id: { in: leadIds }, userId: input.userId },
  })) as unknown as readonly LoadedLeadRow[];

  const byId = new Map(leads.map(l => [l.id, l] as const));

  // Posture lookup - keyed by family.
  const postures = await db.aTSAutomationPosture.findMany({
    where: {
      family: {
        in: Array.from(
          new Set(
            leads
              .map(l => familyFromHostname(hostnameFrom(l.jobListing.jobProviderUrl)))
              .filter((f): f is string => typeof f === 'string'),
          ),
        ),
      },
    },
  });
  const postureByFamily = new Map(postures.map(p => [p.family, p.posture] as const));

  // Rate-budget snapshot - one DB round-trip per distinct hostname.
  const hostnames = Array.from(
    new Set(leads.map(l => hostnameFrom(l.jobListing.jobProviderUrl)).filter(Boolean)),
  );
  const rateRows = hostnames.length
    ? await db.hostRateLimitState.findMany({
        where: { actionType: 'submit', hostname: { in: hostnames } },
      })
    : [];
  const rateBudgetByHost = new Map<string, RateBudgetSnapshot>(
    rateRows.map(r => [
      r.hostname,
      {
        dayCount: r.dayCount,
        dayLimit: r.dayLimit,
        tokens: r.tokens,
      },
    ]),
  );
  // Hosts with no row yet are assumed to have budget - they'll be created
  // on first acquire at dispatch time.
  const rateBudget: RateBudgetChecker = {
    hasBudget: hostname => {
      const budget = rateBudgetByHost.get(hostname);
      if (!budget) return true;
      if (budget.tokens < 1) return false;
      if (budget.dayLimit !== null && budget.dayCount >= budget.dayLimit) {
        return false;
      }
      return true;
    },
  };

  const enqueued: EnqueuedBurstItem[] = [];
  const skipped: SkippedBurstItem[] = [];

  for (const leadId of leadIds) {
    const lead = byId.get(leadId);
    if (!lead) {
      skipped.push({ leadId, reason: 'LEAD_NOT_FOUND' });
      continue;
    }

    const hostname = hostnameFrom(lead.jobListing.jobProviderUrl);
    const family = familyFromHostname(hostname);
    const posture = family ? (postureByFamily.get(family) ?? null) : null;
    const candidate: EligibleLeadCandidate = {
      atsFamily: family ?? '',
      confirmationState:
        lead.applicationSubmissions[0]?.confirmationState ?? 'PENDING',
      hostname,
      leadId,
      posture,
      regressionPassingAt: null, // wired when regression dashboard lands (P7.3)
      tier: lead.submissionTier,
      trustSignals: [], // wired when provenance mapping lands (P1.3 follow-up)
    };

    const verdict = evaluateLeadForBurst({
      candidate,
      mode: input.mode,
      now,
      rateBudget,
    });

    if (!verdict.ok) {
      skipped.push({
        detail: verdict.detail,
        leadId,
        reason: verdict.reason,
      });
      continue;
    }

    const queueItem = await enqueueJob({
      deduplicationKey: `confirm-burst:${leadId}:${input.mode}`,
      payload: {
        applicationUrl: lead.jobListing.jobProviderUrl,
        company: lead.jobListing.company,
        effectiveMode: verdict.effectiveMode,
        jobLeadId: leadId,
        jobTitle: lead.jobListing.title,
        mode: input.mode,
        requestedMode: input.mode,
        trustLevel: verdict.trustLevel,
      },
      type: JobType.DESKTOP_SUBMIT_REQUEST,
      userId: input.userId,
    });

    enqueued.push({
      effectiveMode: verdict.effectiveMode,
      leadId,
      queueItemId: queueItem.id,
      trustLevel: verdict.trustLevel,
    });
  }

  return { enqueued, mode: input.mode, skipped };
}

export { JobQueueStatus, JobType };
