import { db } from '@/lib/db/client';

const TRUST_WINDOW_DAYS = 7;
export const MANUAL_RECOVERY_COOLDOWN_MINUTES = 20;
const RECENT_THRESHOLD = new Date(
  Date.now() - TRUST_WINDOW_DAYS * 24 * 60 * 60 * 1000,
);

export interface RuntimeTrustPolicy {
  eligibility:
    | 'ACTION_WITH_CONFIRMATION'
    | 'AUTO_STEP_GUARDED'
    | 'SUGGEST_ONLY';
  hostname: string;
  metrics: {
    confirmationEvents: number;
    dominantConfirmationSignalCount: number;
    dominantSubmitBlockedSignalCount: number;
    enabledRuleCount: number;
    flowConfidence: number;
    flowStepCount: number;
    hostnameTrustedSubmitSuppressed: boolean;
    manualRecoveryActive: boolean;
    manualRecoveryCooldownActive: boolean;
    manualRecoveryCooldownRemainingMinutes: number;
    recentFailureEvents: number;
    recentSubmitBlockedEvents: number;
    recentUserOverrides: number;
    trainingReviewApproved: boolean;
    trainingReviewStatus: string | null;
    weakRuleCount: number;
  };
  reason: string;
  recommendedMode:
    | 'ACTION_WITH_CONFIRMATION'
    | 'AUTO_STEP_GUARDED'
    | 'SUGGEST_ONLY';
}

function getDominantSignalCount(value: unknown): number {
  if (!value || typeof value !== 'object') {
    return 0;
  }

  let dominantCount = 0;

  for (const count of Object.values(value as Record<string, unknown>)) {
    if (typeof count === 'number' && count > dominantCount) {
      dominantCount = count;
    }
  }

  return dominantCount;
}

function getCooldownRemainingMinutes(cooldownUntil: string): number {
  return Math.max(
    0,
    Math.ceil((new Date(cooldownUntil).getTime() - Date.now()) / 60000),
  );
}

export function getManualRecoveryCooldownState(value: unknown): {
  active: boolean;
  remainingMinutes: number;
  until: string | null;
} {
  if (!value || typeof value !== 'object') {
    return {
      active: false,
      remainingMinutes: 0,
      until: null,
    };
  }

  const metadata = value as {
    manualRecovery?: {
      cooldownUntil?: unknown;
    };
  };
  const cooldownUntil =
    typeof metadata.manualRecovery?.cooldownUntil === 'string'
      ? metadata.manualRecovery.cooldownUntil
      : null;

  if (!cooldownUntil) {
    return {
      active: false,
      remainingMinutes: 0,
      until: null,
    };
  }

  const remainingMinutes = getCooldownRemainingMinutes(cooldownUntil);

  return {
    active: remainingMinutes > 0,
    remainingMinutes,
    until: cooldownUntil,
  };
}

export async function evaluateRuntimeTrustPolicy(input: {
  hostname: string;
}): Promise<RuntimeTrustPolicy> {
  const [
    flow,
    rules,
    recentFailures,
    recentOverrides,
    recentSubmitBlockedEvents,
  ] = await Promise.all([
    db.applicationFlowDefinition.findFirst({
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
      select: {
        confidence: true,
        metadata: true,
        steps: {
          select: { id: true },
        },
      },
      where: {
        hostname: input.hostname,
        status: 'ACTIVE',
      },
    }),
    db.aTSRule.findMany({
      select: {
        confidence: true,
        consecutiveFailures: true,
        enabled: true,
      },
      where: {
        enabled: true,
        hostname: input.hostname,
      },
    }),
    db.applicationRuntimeEvent.count({
      where: {
        createdAt: { gte: RECENT_THRESHOLD },
        eventType: {
          in: ['ACTION_EXECUTED', 'ACTION_FAILED', 'SESSION_ABORTED'],
        },
        success: false,
        url: {
          contains: input.hostname,
        },
      },
    }),
    db.applicationRuntimeEvent.count({
      where: {
        createdAt: { gte: RECENT_THRESHOLD },
        eventType: 'USER_OVERRIDE',
        url: {
          contains: input.hostname,
        },
      },
    }),
    db.applicationRuntimeEvent.count({
      where: {
        createdAt: { gte: RECENT_THRESHOLD },
        errorCode: 'SUBMIT_BLOCKED',
        eventType: 'VALIDATION_ERROR',
        url: {
          contains: input.hostname,
        },
      },
    }),
  ]);

  const enabledRuleCount = rules.length;
  const weakRuleCount = rules.filter(
    rule => rule.confidence < 0.6 || rule.consecutiveFailures > 0,
  ).length;
  const disabledRuleCount = rules.filter(
    rule => rule.consecutiveFailures >= 3 || rule.confidence < 0.3,
  ).length;
  const flowMetadata =
    flow?.metadata && typeof flow.metadata === 'object'
      ? (flow.metadata as Record<string, unknown>)
      : {};
  const flowStepCount = flow?.steps.length ?? 0;
  const flowConfidence = flow?.confidence ?? 0;
  const confirmationEvents =
    typeof flowMetadata.confirmationEvents === 'number'
      ? flowMetadata.confirmationEvents
      : 0;
  const dominantConfirmationSignalCount = getDominantSignalCount(
    flowMetadata.confirmationSignalCounts,
  );
  const dominantSubmitBlockedSignalCount = getDominantSignalCount(
    flowMetadata.submitBlockedSignalCounts,
  );
  const hostnameTrustedSubmitControl =
    flowMetadata.trustedSubmitControl &&
    typeof flowMetadata.trustedSubmitControl === 'object'
      ? (flowMetadata.trustedSubmitControl as Record<string, unknown>)
      : null;
  const hostnameTrustedSubmitSuppressed =
    hostnameTrustedSubmitControl?.disabled === true;
  const trainingReview =
    flowMetadata.trainingReview &&
    typeof flowMetadata.trainingReview === 'object'
      ? (flowMetadata.trainingReview as Record<string, unknown>)
      : null;
  const trainingReviewStatus =
    typeof trainingReview?.status === 'string' ? trainingReview.status : null;
  const trainingReviewApproved = trainingReviewStatus === 'approved';
  const hasCrossSiteRules = flowMetadata.hasCrossSiteRules === true;
  const hasStableConfirmationSignal =
    dominantConfirmationSignalCount >= 2 || confirmationEvents >= 3;
  const hasStableBlockedSignal = dominantSubmitBlockedSignalCount >= 2;

  const metrics = {
    confirmationEvents,
    dominantConfirmationSignalCount,
    dominantSubmitBlockedSignalCount,
    enabledRuleCount,
    flowConfidence,
    flowStepCount,
    hostnameTrustedSubmitSuppressed,
    manualRecoveryActive: false,
    manualRecoveryCooldownActive: false,
    manualRecoveryCooldownRemainingMinutes: 0,
    recentFailureEvents: recentFailures,
    recentSubmitBlockedEvents,
    recentUserOverrides: recentOverrides,
    trainingReviewApproved,
    trainingReviewStatus,
    weakRuleCount,
  };

  if (hostnameTrustedSubmitSuppressed) {
    if (
      flowStepCount >= 1 &&
      flowConfidence >= 0.6 &&
      enabledRuleCount >= 2 &&
      hasStableConfirmationSignal
    ) {
      return {
        eligibility: 'ACTION_WITH_CONFIRMATION',
        hostname: input.hostname,
        metrics,
        reason:
          'Trusted submit is suppressed for this hostname, so learned flow usage remains confirmation-guarded.',
        recommendedMode: 'ACTION_WITH_CONFIRMATION',
      };
    }

    return {
      eligibility: 'SUGGEST_ONLY',
      hostname: input.hostname,
      metrics,
      reason:
        'Trusted submit is suppressed for this hostname and learned coverage is not yet strong enough for confirmation-driven execution.',
      recommendedMode: 'SUGGEST_ONLY',
    };
  }

  if (
    flowStepCount >= 2 &&
    flowConfidence >= 0.85 &&
    enabledRuleCount >= 4 &&
    weakRuleCount === 0 &&
    disabledRuleCount === 0 &&
    hasStableConfirmationSignal &&
    !hasStableBlockedSignal &&
    recentFailures <= 1 &&
    recentSubmitBlockedEvents === 0 &&
    recentOverrides <= 2
  ) {
    const canAutoStep = trainingReviewApproved && !hasCrossSiteRules;
    return {
      eligibility: canAutoStep
        ? 'AUTO_STEP_GUARDED'
        : 'ACTION_WITH_CONFIRMATION',
      hostname: input.hostname,
      metrics,
      reason: hasCrossSiteRules
        ? 'Flow includes cross-site rules that have not been locally confirmed. Capped at confirmation mode until local observations validate them.'
        : !trainingReviewApproved
          ? 'Stored flow coverage is strong, but this hostname has not been approved through the training review workflow yet.'
          : 'Stored flow coverage is strong, confirmation signals are repeating consistently, and recent runtime intervention is low.',
      recommendedMode: canAutoStep
        ? 'AUTO_STEP_GUARDED'
        : 'ACTION_WITH_CONFIRMATION',
    };
  }

  if (
    !trainingReviewApproved &&
    flowStepCount >= 1 &&
    flowConfidence >= 0.6 &&
    enabledRuleCount >= 2 &&
    hasStableConfirmationSignal
  ) {
    return {
      eligibility: 'ACTION_WITH_CONFIRMATION',
      hostname: input.hostname,
      metrics,
      reason:
        trainingReviewStatus === 'hold'
          ? 'This hostname is currently held in the training review workflow, so automation remains confirmation-guarded.'
          : trainingReviewStatus === 'needs-more-training'
            ? 'This hostname still needs more training coverage, so automation remains confirmation-guarded.'
            : 'This hostname has usable learned coverage, but it still needs explicit training approval before guarded auto-step is allowed.',
      recommendedMode: 'ACTION_WITH_CONFIRMATION',
    };
  }

  if (recentSubmitBlockedEvents >= 2 || hasStableBlockedSignal) {
    return {
      eligibility: 'SUGGEST_ONLY',
      hostname: input.hostname,
      metrics,
      reason: hasStableBlockedSignal
        ? 'Blocked-submit signals are recurring consistently on this hostname, so it should stay in suggestion mode.'
        : 'Recent submission blocks indicate this hostname is drifting and should stay in suggestion mode.',
      recommendedMode: 'SUGGEST_ONLY',
    };
  }

  if (
    flowStepCount >= 1 &&
    flowConfidence >= 0.6 &&
    enabledRuleCount >= 2 &&
    hasStableConfirmationSignal
  ) {
    return {
      eligibility: 'ACTION_WITH_CONFIRMATION',
      hostname: input.hostname,
      metrics,
      reason:
        recentSubmitBlockedEvents > 0
          ? 'This hostname has usable learned coverage, but recent submit blocks require confirmation guardrails.'
          : 'This hostname has usable learned coverage and stable confirmation signals, but still needs confirmation guardrails.',
      recommendedMode: 'ACTION_WITH_CONFIRMATION',
    };
  }

  return {
    eligibility: 'SUGGEST_ONLY',
    hostname: input.hostname,
    metrics,
    reason: hasStableConfirmationSignal
      ? 'Flow coverage is improving, but it is still too thin or unstable for autonomous stepping.'
      : 'Flow coverage is still too thin or lacks stable confirmation signals for autonomous stepping.',
    recommendedMode: 'SUGGEST_ONLY',
  };
}

export function applyRuntimeTrustPolicyGuards(
  policy: RuntimeTrustPolicy,
  value: unknown,
): RuntimeTrustPolicy {
  const metadata =
    value && typeof value === 'object'
      ? (value as {
          manualRecovery?: {
            active?: unknown;
            cooldownUntil?: unknown;
          };
        })
      : null;
  const manualRecoveryActive = metadata?.manualRecovery?.active === true;
  const cooldownState = getManualRecoveryCooldownState(value);
  const nextMetrics = {
    ...policy.metrics,
    manualRecoveryActive,
    manualRecoveryCooldownActive: cooldownState.active,
    manualRecoveryCooldownRemainingMinutes: cooldownState.remainingMinutes,
  };

  if (manualRecoveryActive) {
    return {
      ...policy,
      eligibility: 'SUGGEST_ONLY',
      metrics: nextMetrics,
      reason:
        'Manual recovery is active for this session, so autonomous escalation remains disabled until the run is stabilized.',
      recommendedMode: 'SUGGEST_ONLY',
    };
  }

  if (
    cooldownState.active &&
    policy.recommendedMode === 'AUTO_STEP_GUARDED'
  ) {
    return {
      ...policy,
      eligibility: 'ACTION_WITH_CONFIRMATION',
      metrics: nextMetrics,
      reason: `Manual recovery cooldown is active for another ${cooldownState.remainingMinutes} minute${
        cooldownState.remainingMinutes === 1 ? '' : 's'
      }, so guarded auto-step stays locked behind confirmation.`,
      recommendedMode: 'ACTION_WITH_CONFIRMATION',
    };
  }

  return {
    ...policy,
    metrics: nextMetrics,
  };
}
