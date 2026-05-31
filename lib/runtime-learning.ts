import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import { type Prisma } from '@/generated/prisma/browser';
import { embedRule } from '@/lib/ai/embeddings';
import { db } from '@/lib/db/client';
import { checkRegressionGate } from '@/lib/runtime-learning/promotion-gate';
import {
  calculatePromotionScore,
  OWNER_CONFIRMED_RUNTIME_SOURCE,
  RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD,
  type RuntimePromotionSignal,
  type RuntimePromotionSource,
} from '@/lib/runtime-learning/scoring';
import { hasRuntimeLearningModels } from '@/lib/runtime-model-support';

export {
  calculatePromotionScore,
  OWNER_CONFIRMED_RUNTIME_SOURCE,
  RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD,
  RUNTIME_PROMOTION_SOURCE_WEIGHTS,
  type RuntimePromotionSignal,
  type RuntimePromotionSource,
} from '@/lib/runtime-learning/scoring';

interface RuntimeEventCandidateInput {
  actionType?: string | null;
  errorMessage?: string | null;
  fieldLabel?: string | null;
  fieldName?: string | null;
  hostname: string;
  metadata?: Prisma.InputJsonValue;
  reason?: string | null;
  selector?: string | null;
  source?: ApplicationRuntimeSource;
  stepIndex?: number | null;
  success?: boolean | null;
  userId: string;
}

export const RUNTIME_TRAINING_REVIEW_DECISIONS = {
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type RuntimeTrainingReviewDecision =
  (typeof RUNTIME_TRAINING_REVIEW_DECISIONS)[keyof typeof RUNTIME_TRAINING_REVIEW_DECISIONS];

interface ReviewRulePromotionCandidateInput {
  candidateId: string;
  decision: RuntimeTrainingReviewDecision;
  metadata?: Prisma.InputJsonValue;
  reviewerNote?: string | null;
  sessionId: string;
  userId: string;
}

interface ReviewRulePromotionCandidateResult {
  decision: RuntimeTrainingReviewDecision;
  promotionStatus: string;
  reviewId: string;
  ruleId: string | null;
}

const PROMOTABLE_ACTION_TYPES = new Set([
  'activate',
  'click',
  'fill',
  'upload',
]);

interface RuntimeRuleConfidenceInput {
  consecutiveFailures: number;
  hostname: string;
  observationCount: number;
  stableSelector: string;
}

async function recomputeRuntimeRuleConfidence(
  rule: RuntimeRuleConfidenceInput,
): Promise<number> {
  try {
    const { recomputeRuleConfidence } =
      await import('@/lib/assist-training/confidence');
    return recomputeRuleConfidence(rule);
  } catch {
    const base = Math.min(1, rule.observationCount / 10);
    const failurePenalty = Math.pow(0.7, Math.max(0, rule.consecutiveFailures));
    return Math.max(0, Math.min(1, base * failurePenalty));
  }
}

function checkAndQueueRuntimeRetraining(
  hostname: string,
  userId: string,
): void {
  void import('@/lib/assist-training/auto-retrain')
    .then(({ checkAndQueueRetraining }) =>
      checkAndQueueRetraining(hostname, userId),
    )
    .catch(() => undefined);
}

async function syncRuntimeFlowDefinitionForHostname(input: {
  atsSystemId?: string | null;
  hostname: string;
}): Promise<void> {
  try {
    const { syncApplicationFlowDefinitionForHostname } =
      await import('@/lib/runtime-flow-definitions');
    await syncApplicationFlowDefinitionForHostname(input);
  } catch {
    // Flow-definition sync is unavailable until the runtime-flow module lands.
  }
}

function inferTagNameFromActionType(actionType: string): string {
  if (actionType === 'click' || actionType === 'activate') {
    return 'button';
  }

  if (actionType === 'upload') {
    return 'input';
  }

  return 'input';
}

function normalizeSelector(selector?: string | null): string | null {
  if (!selector) {
    return null;
  }

  const trimmed = selector.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function incrementSignalCounts(input: {
  counts: Record<string, unknown>;
  signal?: string | null;
}): Record<string, number> {
  const nextCounts: Record<string, number> = {};

  for (const [key, value] of Object.entries(input.counts)) {
    if (typeof value === 'number') {
      nextCounts[key] = value;
    }
  }

  if (!input.signal) {
    return nextCounts;
  }

  nextCounts[input.signal] = (nextCounts[input.signal] ?? 0) + 1;
  return nextCounts;
}

function buildCandidateFingerprint(input: {
  actionType: string;
  fieldLabel?: string | null;
  fieldName?: string | null;
  selector: string;
}): string {
  return [
    input.actionType.toLowerCase(),
    input.selector.toLowerCase(),
    input.fieldName?.trim().toLowerCase() ?? '',
    input.fieldLabel?.trim().toLowerCase() ?? '',
  ].join('|');
}

function buildPromotionSignals(input: {
  currentSource: RuntimePromotionSource;
  currentSuccess?: boolean | null;
  failureCount: number;
  successCount: number;
  userOverrideCount: number;
}): RuntimePromotionSignal[] {
  const signals: RuntimePromotionSignal[] = [];

  for (let index = 0; index < input.successCount; index += 1) {
    signals.push({ source: 'LEGACY', success: true });
  }

  for (let index = 0; index < input.failureCount; index += 1) {
    signals.push({ source: 'LEGACY', success: false });
  }

  for (let index = 0; index < input.userOverrideCount; index += 1) {
    signals.push({ source: 'OWNER_OVERRIDE', success: false });
  }

  signals.push({
    source: input.currentSource,
    success: input.currentSuccess,
  });

  return signals;
}

function resolvePromotionStatus(input: {
  confidence: number;
  failureWeight: number;
  observationCount: number;
  positiveWeight: number;
  trustedPositiveWeight: number;
}): string {
  if (input.failureWeight >= 3) {
    return 'NEEDS_REVIEW';
  }

  if (
    input.confidence >= RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD &&
    input.trustedPositiveWeight >= 1
  ) {
    return 'PROMOTED_READY';
  }

  if (input.confidence >= 0.65 || input.positiveWeight >= 3) {
    return 'CANDIDATE';
  }

  return input.observationCount > 1 ? 'REVIEWING' : 'OBSERVATION';
}

async function maybePromoteCandidateToRule(input: {
  action: string;
  actionType: string;
  atsSystemId?: string | null;
  confidence: number;
  fieldLabel?: string | null;
  fieldName?: string | null;
  hostname: string;
  observationCount: number;
  promotionStatus: string;
  reason?: string | null;
  stableSelector: string;
  stepIndex?: number | null;
}): Promise<string> {
  if (input.promotionStatus !== 'PROMOTED_READY') {
    return input.promotionStatus;
  }

  if (!PROMOTABLE_ACTION_TYPES.has(input.actionType)) {
    return 'PROMOTION_SKIPPED';
  }

  const gate = await checkRegressionGate({
    atsSystemId: input.atsSystemId,
    hostname: input.hostname,
  });
  if (!gate.allowed) {
    console.warn(
      `[runtime-learning] Promotion gate blocked auto-promotion for ${input.hostname} (${gate.mode}): ${gate.reason}`,
    );
    return 'PROMOTION_BLOCKED_BY_GATE';
  }

  const upsertedRule = await db.aTSRule.upsert({
    create: {
      action: input.action,
      actionType: input.actionType,
      atsSystemId: input.atsSystemId,
      confidence: input.confidence,
      fieldLabel: input.fieldLabel ?? undefined,
      fieldName: input.fieldName ?? undefined,
      hostname: input.hostname,
      observationCount: input.observationCount,
      reason:
        input.reason ??
        'Promoted automatically from runtime learning candidate',
      stableSelector: input.stableSelector,
      stepIndex: input.stepIndex ?? 0,
      tagName: inferTagNameFromActionType(input.actionType),
    },
    update: {
      confidence: input.confidence,
      consecutiveFailures: 0,
      enabled: true,
      fieldLabel: input.fieldLabel ?? undefined,
      fieldName: input.fieldName ?? undefined,
      observationCount: input.observationCount,
      reason:
        input.reason ??
        'Promoted automatically from runtime learning candidate',
      stepIndex: input.stepIndex ?? undefined,
    },
    where: {
      unique_rule: {
        action: input.action,
        hostname: input.hostname,
        stableSelector: input.stableSelector,
      },
    },
    select: { id: true },
  });
  void embedRule(upsertedRule.id).catch(error => {
    console.warn('[runtime-learning] embed rule failed', error);
  });

  await syncRuntimeFlowDefinitionForHostname({
    atsSystemId: input.atsSystemId,
    hostname: input.hostname,
  });

  return 'PROMOTED';
}

export async function reviewRulePromotionCandidate(
  input: ReviewRulePromotionCandidateInput,
): Promise<ReviewRulePromotionCandidateResult | null> {
  if (!hasRuntimeLearningModels()) {
    return null;
  }

  const result = await db.$transaction(async tx => {
    const [candidate, session] = await Promise.all([
      tx.rulePromotionCandidate.findUnique({
        select: {
          action: true,
          actionType: true,
          atsSystemId: true,
          confidence: true,
          fieldLabel: true,
          fieldName: true,
          hostname: true,
          id: true,
          observationCount: true,
          stableSelector: true,
          tagName: true,
          userId: true,
        },
        where: { id: input.candidateId },
      }),
      tx.applicationRuntimeSession.findUnique({
        select: { id: true, userId: true },
        where: { id: input.sessionId },
      }),
    ]);

    if (!candidate) {
      throw new Error(
        `Rule promotion candidate not found: ${input.candidateId}`,
      );
    }
    if (!session || session.userId !== input.userId) {
      throw new Error(`Runtime session not found: ${input.sessionId}`);
    }

    let ruleId: string | null = null;
    let promotionStatus = 'REJECTED';

    if (input.decision === RUNTIME_TRAINING_REVIEW_DECISIONS.APPROVED) {
      if (!PROMOTABLE_ACTION_TYPES.has(candidate.actionType)) {
        throw new Error(
          `Rule promotion candidate ${candidate.id} action type is not promotable`,
        );
      }

      const existingRule = await tx.aTSRule.findUnique({
        select: { id: true, sourceTrainingSessionIds: true },
        where: {
          unique_rule: {
            action: candidate.action,
            hostname: candidate.hostname,
            stableSelector: candidate.stableSelector,
          },
        },
      });
      const sourceTrainingSessionIds = [
        ...new Set([
          ...(existingRule?.sourceTrainingSessionIds ?? []),
          input.sessionId,
        ]),
      ];

      const rule = existingRule
        ? await tx.aTSRule.update({
            data: {
              actionType: candidate.actionType,
              atsSystemId: candidate.atsSystemId ?? undefined,
              confidence: 1,
              consecutiveFailures: 0,
              enabled: true,
              fieldLabel: candidate.fieldLabel ?? undefined,
              fieldName: candidate.fieldName ?? undefined,
              observationCount: candidate.observationCount,
              reason:
                input.reviewerNote ??
                'Promoted from owner-confirmed runtime training review',
              source: ApplicationRuntimeSource.OWNER_CONFIRMED,
              sourceTrainingSessionIds: { set: sourceTrainingSessionIds },
              tagName:
                candidate.tagName ??
                inferTagNameFromActionType(candidate.actionType),
            },
            where: { id: existingRule.id },
          })
        : await tx.aTSRule.create({
            data: {
              action: candidate.action,
              actionType: candidate.actionType,
              atsSystemId: candidate.atsSystemId ?? undefined,
              confidence: 1,
              fieldLabel: candidate.fieldLabel ?? undefined,
              fieldName: candidate.fieldName ?? undefined,
              hostname: candidate.hostname,
              observationCount: candidate.observationCount,
              reason:
                input.reviewerNote ??
                'Promoted from owner-confirmed runtime training review',
              source: ApplicationRuntimeSource.OWNER_CONFIRMED,
              sourceTrainingSessionIds,
              stableSelector: candidate.stableSelector,
              stepIndex: 0,
              tagName:
                candidate.tagName ??
                inferTagNameFromActionType(candidate.actionType),
            },
          });

      ruleId = rule.id;
      promotionStatus = 'PROMOTED';

      await tx.rulePromotionCandidate.update({
        data: {
          confidence: 1,
          promotionStatus,
        },
        where: { id: candidate.id },
      });
    } else {
      await tx.rulePromotionCandidate.update({
        data: { promotionStatus },
        where: { id: candidate.id },
      });
    }

    const review = await tx.runtimeTrainingReview.create({
      data: {
        candidateId: candidate.id,
        decision: input.decision,
        metadata: input.metadata ?? undefined,
        reviewerNote: input.reviewerNote ?? undefined,
        ruleId,
        sessionId: input.sessionId,
        userId: input.userId,
      },
    });

    await tx.automationAuditLog.create({
      data: {
        action: 'runtime_training_review',
        actionType: input.decision,
        metadata: {
          candidateId: candidate.id,
          promotionStatus,
          reviewId: review.id,
          ruleId,
          sessionId: input.sessionId,
          source:
            input.decision === RUNTIME_TRAINING_REVIEW_DECISIONS.APPROVED
              ? OWNER_CONFIRMED_RUNTIME_SOURCE
              : null,
        },
        userId: input.userId,
      },
    });

    return {
      atsSystemId: candidate.atsSystemId,
      decision: input.decision,
      hostname: candidate.hostname,
      promotionStatus,
      reviewId: review.id,
      ruleId,
    };
  });

  if (result.ruleId) {
    void embedRule(result.ruleId).catch(error => {
      console.warn('[runtime-learning] embed rule failed', error);
    });
    await syncRuntimeFlowDefinitionForHostname({
      atsSystemId: result.atsSystemId,
      hostname: result.hostname,
    });
  }

  return {
    decision: result.decision,
    promotionStatus: result.promotionStatus,
    reviewId: result.reviewId,
    ruleId: result.ruleId,
  };
}

export async function resolveAtsSystemForHostname(
  hostname: string,
): Promise<string | null> {
  const atsSystem = await db.aTSSystem.findFirst({
    select: { id: true },
    where: {
      OR: [{ detectedDomain: hostname }, { domainPatterns: { has: hostname } }],
    },
  });

  return atsSystem?.id ?? null;
}

export async function recordRuntimeRuleOutcome(input: {
  hostname: string;
  selector?: string | null;
  success?: boolean | null;
}): Promise<void> {
  if (!hasRuntimeLearningModels()) {
    return;
  }

  const selector = normalizeSelector(input.selector);
  if (!selector) {
    return;
  }

  const existingRule = await db.aTSRule.findFirst({
    select: {
      atsSystemId: true,
      consecutiveFailures: true,
      hostname: true,
      id: true,
      observationCount: true,
      stableSelector: true,
    },
    where: {
      enabled: true,
      hostname: input.hostname,
      stableSelector: selector,
    },
  });

  if (!existingRule) {
    return;
  }

  const nextFailureCount =
    input.success === false ? existingRule.consecutiveFailures + 1 : 0;

  const newConfidence =
    input.success === false
      ? await recomputeRuntimeRuleConfidence({
          consecutiveFailures: nextFailureCount,
          hostname: existingRule.hostname,
          observationCount: existingRule.observationCount,
          stableSelector: existingRule.stableSelector,
        })
      : undefined;

  await db.aTSRule.update({
    data: {
      confidence: newConfidence,
      consecutiveFailures: nextFailureCount,
      enabled: input.success === false ? nextFailureCount < 3 : true,
    },
    where: { id: existingRule.id },
  });

  await syncRuntimeFlowDefinitionForHostname({
    atsSystemId: existingRule.atsSystemId,
    hostname: input.hostname,
  });

  // Check if hostname health degraded and queue retraining if needed
  if (input.success === false) {
    // Get userId from the most recent observation for this hostname
    const recentObs = await db.aTSFieldObservation.findFirst({
      where: { hostname: input.hostname },
      orderBy: { updatedAt: 'desc' },
      select: { userId: true },
    });
    if (recentObs) {
      checkAndQueueRuntimeRetraining(input.hostname, recentObs.userId);
    }
  }
}

export async function recordSubmitBlockedOutcome(input: {
  errorMessage?: string | null;
  hostname: string;
  signal?: string | null;
  stepIndex?: number | null;
}): Promise<void> {
  if (!hasRuntimeLearningModels()) {
    return;
  }

  const activeFlow = await db.applicationFlowDefinition.findFirst({
    orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
    select: {
      atsSystemId: true,
      id: true,
      metadata: true,
      steps: {
        orderBy: { stepIndex: 'desc' },
        select: {
          stepIndex: true,
        },
      },
    },
    where: {
      hostname: input.hostname,
      status: 'ACTIVE',
    },
  });

  const targetStepIndex =
    input.stepIndex ??
    activeFlow?.steps[0]?.stepIndex ??
    (
      await db.aTSRule.findFirst({
        orderBy: [{ stepIndex: 'desc' }, { updatedAt: 'desc' }],
        select: { stepIndex: true },
        where: { enabled: true, hostname: input.hostname },
      })
    )?.stepIndex ??
    0;

  const stepRules = await db.aTSRule.findMany({
    select: {
      consecutiveFailures: true,
      hostname: true,
      id: true,
      observationCount: true,
      stableSelector: true,
    },
    where: {
      enabled: true,
      hostname: input.hostname,
      stepIndex: targetStepIndex,
    },
  });

  if (stepRules.length > 0) {
    const updatedConfidences = await Promise.all(
      stepRules.map(rule =>
        recomputeRuntimeRuleConfidence({
          consecutiveFailures: rule.consecutiveFailures + 1,
          hostname: rule.hostname,
          observationCount: rule.observationCount,
          stableSelector: rule.stableSelector,
        }),
      ),
    );

    await db.$transaction(
      stepRules.map((rule, index) =>
        db.aTSRule.update({
          data: {
            confidence: updatedConfidences[index],
            consecutiveFailures: rule.consecutiveFailures + 1,
            enabled: rule.consecutiveFailures + 1 < 3,
          },
          where: { id: rule.id },
        }),
      ),
    );
  }

  if (activeFlow) {
    const existingMetadata =
      activeFlow.metadata && typeof activeFlow.metadata === 'object'
        ? (activeFlow.metadata as Record<string, unknown>)
        : {};
    const previousBlockedEvents =
      typeof existingMetadata.submitBlockedEvents === 'number'
        ? existingMetadata.submitBlockedEvents
        : 0;
    const nextBlockedEvents = previousBlockedEvents + 1;

    await db.applicationFlowDefinition.update({
      data: {
        confidence: { decrement: 0.08 },
        metadata: {
          ...existingMetadata,
          lastSubmitBlockedAt: new Date().toISOString(),
          lastSubmitBlockedReason:
            input.errorMessage ?? existingMetadata.lastSubmitBlockedReason,
          lastSubmitBlockedSignal:
            input.signal ?? existingMetadata.lastSubmitBlockedSignal,
          submitBlockedEvents: nextBlockedEvents,
          submitBlockedSignalCounts: incrementSignalCounts({
            counts:
              existingMetadata.submitBlockedSignalCounts &&
              typeof existingMetadata.submitBlockedSignalCounts === 'object'
                ? (existingMetadata.submitBlockedSignalCounts as Record<
                    string,
                    unknown
                  >)
                : {},
            signal: input.signal,
          }),
          submitBlockedStepIndex: targetStepIndex,
        },
        status: nextBlockedEvents >= 3 ? 'DISABLED' : undefined,
      },
      where: { id: activeFlow.id },
    });
  }

  await syncRuntimeFlowDefinitionForHostname({
    atsSystemId: activeFlow?.atsSystemId,
    hostname: input.hostname,
  });

  // Queue retraining if hostname health degraded after submit block
  const recentObs = await db.aTSFieldObservation.findFirst({
    where: { hostname: input.hostname },
    orderBy: { updatedAt: 'desc' },
    select: { userId: true },
  });
  if (recentObs) {
    checkAndQueueRuntimeRetraining(input.hostname, recentObs.userId);
  }
}

export async function recordSubmissionConfirmedOutcome(input: {
  hostname: string;
  signal?: string | null;
}): Promise<void> {
  if (!hasRuntimeLearningModels()) {
    return;
  }

  const activeFlow = await db.applicationFlowDefinition.findFirst({
    orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
    select: {
      id: true,
      metadata: true,
    },
    where: {
      hostname: input.hostname,
      status: 'ACTIVE',
    },
  });

  if (!activeFlow) {
    return;
  }

  const existingMetadata =
    activeFlow.metadata && typeof activeFlow.metadata === 'object'
      ? (activeFlow.metadata as Record<string, unknown>)
      : {};
  const previousConfirmationEvents =
    typeof existingMetadata.confirmationEvents === 'number'
      ? existingMetadata.confirmationEvents
      : 0;

  await db.applicationFlowDefinition.update({
    data: {
      confidence: { increment: 0.02 },
      metadata: {
        ...existingMetadata,
        confirmationEvents: previousConfirmationEvents + 1,
        confirmationSignalCounts: incrementSignalCounts({
          counts:
            existingMetadata.confirmationSignalCounts &&
            typeof existingMetadata.confirmationSignalCounts === 'object'
              ? (existingMetadata.confirmationSignalCounts as Record<
                  string,
                  unknown
                >)
              : {},
          signal: input.signal,
        }),
        lastConfirmationAt: new Date().toISOString(),
        lastConfirmationSignal:
          input.signal ?? existingMetadata.lastConfirmationSignal,
      },
    },
    where: { id: activeFlow.id },
  });
}

export async function upsertRulePromotionCandidate(
  input: RuntimeEventCandidateInput,
): Promise<void> {
  if (!hasRuntimeLearningModels()) {
    return;
  }

  const selector = normalizeSelector(input.selector);
  const actionType = input.actionType?.trim();

  if (!selector || !actionType) {
    return;
  }

  const atsSystemId = await resolveAtsSystemForHostname(input.hostname);
  const candidateFingerprint = buildCandidateFingerprint({
    actionType,
    fieldLabel: input.fieldLabel,
    fieldName: input.fieldName,
    selector,
  });

  const existing = await db.rulePromotionCandidate.findUnique({
    select: {
      failureCount: true,
      id: true,
      observationCount: true,
      successCount: true,
      userOverrideCount: true,
    },
    where: {
      hostname_candidateFingerprint: {
        candidateFingerprint,
        hostname: input.hostname,
      },
    },
  });

  const isUserOverride = actionType === 'user_override';
  const observationCount = (existing?.observationCount ?? 0) + 1;
  const successCount =
    (existing?.successCount ?? 0) +
    (!isUserOverride && input.success === true ? 1 : 0);
  const failureCount =
    (existing?.failureCount ?? 0) +
    (!isUserOverride && input.success === false ? 1 : 0);
  const userOverrideCount =
    (existing?.userOverrideCount ?? 0) + (isUserOverride ? 1 : 0);
  const currentSource = isUserOverride
    ? ApplicationRuntimeSource.OWNER_OVERRIDE
    : (input.source ?? ApplicationRuntimeSource.LEGACY);
  const currentSuccess = isUserOverride ? false : input.success;

  const promotionScore = calculatePromotionScore({
    signals: buildPromotionSignals({
      currentSource,
      currentSuccess,
      failureCount: existing?.failureCount ?? 0,
      successCount: existing?.successCount ?? 0,
      userOverrideCount: existing?.userOverrideCount ?? 0,
    }),
  });
  const confidence = promotionScore.confidence;
  const resolvedPromotionStatus = resolvePromotionStatus({
    confidence,
    failureWeight: promotionScore.failureWeight,
    observationCount,
    positiveWeight: promotionScore.positiveWeight,
    trustedPositiveWeight: promotionScore.trustedPositiveWeight,
  });

  const promotionStatus = await maybePromoteCandidateToRule({
    action: actionType,
    actionType,
    atsSystemId,
    confidence,
    fieldLabel: input.fieldLabel,
    fieldName: input.fieldName,
    hostname: input.hostname,
    observationCount,
    promotionStatus: resolvedPromotionStatus,
    reason: input.reason,
    stableSelector: selector,
    stepIndex: input.stepIndex,
  });

  const candidateData = {
    action: actionType,
    actionType,
    atsSystemId,
    candidateFingerprint,
    confidence,
    failureCount,
    fieldLabel: input.fieldLabel ?? undefined,
    fieldName: input.fieldName ?? undefined,
    hostname: input.hostname,
    lastObservedAt: new Date(),
    observationCount,
    promotionStatus,
    stableSelector: selector,
    successCount,
    userId: input.userId,
    userOverrideCount,
  };

  if (!existing) {
    await db.rulePromotionCandidate.create({
      data: candidateData,
    });
    return;
  }

  await db.rulePromotionCandidate.update({
    data: candidateData,
    where: { id: existing.id },
  });
}
