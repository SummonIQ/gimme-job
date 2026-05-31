import { db } from '@/lib/db/client';
import { evaluateRuntimeTrustPolicy } from '@/lib/runtime-trust-policy';

export interface AssistTrainingHostnameInsight {
  completedSessionCount: number;
  enabledRuleCount: number;
  failedSessionCount: number;
  flowCompiledFromRuleCount: number | null;
  flowConfidence: number | null;
  healthReason: string | null;
  healthStatus: 'at-risk' | 'building' | 'healthy' | 'stale';
  flowStatus: string | null;
  flowStepCount: number;
  flowVersion: number | null;
  hostname: string;
  lastCompletedAt: string | null;
  lastFailedAt: string | null;
  reviewReady: boolean;
  reviewReason: string | null;
  reviewStatus: string | null;
  retrainingNeeded: boolean;
  retrainingPriority: 'high' | 'low' | 'medium' | null;
  retrainingReason: string | null;
  retrainingTargetUrl: string | null;
  totalSessionCount: number;
  trustEligibility: string | null;
  trustReason: string | null;
}

export async function getAssistTrainingHostnameInsight(
  hostname: string,
): Promise<AssistTrainingHostnameInsight> {
  const [
    enabledRuleCount,
    activeFlow,
    trustPolicy,
    sessionStats,
    latestCompletedSession,
    latestFailedSession,
  ] = await Promise.all([
    db.aTSRule.count({
      where: {
        enabled: true,
        hostname,
      },
    }),
    db.applicationFlowDefinition.findFirst({
      include: {
        steps: {
          select: { id: true },
        },
      },
      orderBy: [{ version: 'desc' }, { updatedAt: 'desc' }],
      where: {
        hostname,
        status: {
          in: ['ACTIVE', 'EMPTY', 'DISABLED'],
        },
      },
    }),
    evaluateRuntimeTrustPolicy({ hostname }),
    db.assistTrainingSession.groupBy({
      _count: { id: true },
      by: ['status'],
      where: { hostname },
    }),
    db.assistTrainingSession.findFirst({
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true, targetUrl: true },
      where: {
        completedAt: { not: null },
        hostname,
        status: 'completed',
      },
    }),
    db.assistTrainingSession.findFirst({
      orderBy: { completedAt: 'desc' },
      select: { completedAt: true },
      where: {
        completedAt: { not: null },
        hostname,
        status: 'failed',
      },
    }),
  ]);

  const totalSessionCount = sessionStats.reduce(
    (sum, row) => sum + row._count.id,
    0,
  );
  const completedSessionCount =
    sessionStats.find(row => row.status === 'completed')?._count.id ?? 0;
  const failedSessionCount =
    sessionStats.find(row => row.status === 'failed')?._count.id ?? 0;
  const flowMetadata =
    activeFlow?.metadata && typeof activeFlow.metadata === 'object'
      ? (activeFlow.metadata as Record<string, unknown>)
      : null;
  const storedReview =
    flowMetadata?.trainingReview &&
    typeof flowMetadata.trainingReview === 'object'
      ? (flowMetadata.trainingReview as Record<string, unknown>)
      : null;
  const reviewStatus =
    storedReview && typeof storedReview.status === 'string'
      ? storedReview.status
      : null;
  const reviewReady =
    completedSessionCount >= 2 &&
    enabledRuleCount >= 3 &&
    (activeFlow?.steps.length ?? 0) >= 2 &&
    trustPolicy.eligibility !== 'SUGGEST_ONLY';
  const reviewReason =
    storedReview && typeof storedReview.reason === 'string'
      ? storedReview.reason
      : reviewReady
        ? 'This hostname has enough successful training runs, learned rules, and compiled steps to review.'
        : 'This hostname still needs more successful runs or stronger learned coverage before review.';
  const lastCompletedAt =
    latestCompletedSession?.completedAt?.toISOString() ?? null;
  const lastFailedAt = latestFailedSession?.completedAt?.toISOString() ?? null;
  const retrainingSignals: Array<{
    needed: boolean;
    priority: 'high' | 'low' | 'medium' | null;
    reason: string | null;
  }> = [
    reviewStatus === 'needs-more-training'
      ? {
          needed: true,
          priority: 'high',
          reason: 'Marked as needing more training.',
        }
      : { needed: false, priority: null, reason: null },
    activeFlow?.status === 'DISABLED'
      ? {
          needed: true,
          priority: 'high',
          reason: 'The learned flow is disabled and needs retraining.',
        }
      : { needed: false, priority: null, reason: null },
    flowMetadata &&
    activeFlow != null &&
    activeFlow.confidence != null &&
    activeFlow.confidence < 0.7
      ? {
          needed: true,
          priority: 'medium',
          reason: 'Flow confidence is still low for this hostname.',
        }
      : { needed: false, priority: null, reason: null },
    failedSessionCount >= 2 && failedSessionCount >= completedSessionCount
      ? {
          needed: true,
          priority: 'high',
          reason: 'Recent hostname training is failing too often.',
        }
      : { needed: false, priority: null, reason: null },
    completedSessionCount > 0 &&
    trustPolicy.eligibility === 'SUGGEST_ONLY' &&
    reviewStatus !== 'approved'
      ? {
          needed: true,
          priority: 'medium',
          reason: 'This hostname is still stuck at suggest-only trust.',
        }
      : { needed: false, priority: null, reason: null },
    completedSessionCount >= 1 && enabledRuleCount < 3
      ? {
          needed: true,
          priority: 'low',
          reason: 'This hostname needs more learned rules before it is reliable.',
        }
      : { needed: false, priority: null, reason: null },
  ];
  const retrainingSignal =
    retrainingSignals.find(signal => signal.needed) ?? {
      needed: false,
      priority: null,
      reason: null,
    };
  const staleThresholdMs = 1000 * 60 * 60 * 24 * 21;
  const isStaleApprovedHostname =
    reviewStatus === 'approved' &&
    lastCompletedAt !== null &&
    Date.now() - new Date(lastCompletedAt).getTime() > staleThresholdMs;
  const healthStatus: AssistTrainingHostnameInsight['healthStatus'] =
    retrainingSignal.needed &&
    (retrainingSignal.priority === 'high' ||
      retrainingSignal.priority === 'medium')
      ? 'at-risk'
      : isStaleApprovedHostname
        ? 'stale'
        : reviewStatus === 'approved'
          ? 'healthy'
          : 'building';
  const healthReason =
    healthStatus === 'at-risk'
      ? retrainingSignal.reason
      : healthStatus === 'stale'
        ? 'This approved hostname has not had a successful training refresh recently.'
        : healthStatus === 'healthy'
          ? 'This hostname is approved and its learned flow is currently stable.'
          : reviewReason;

  return {
    completedSessionCount,
    enabledRuleCount,
    failedSessionCount,
    flowCompiledFromRuleCount: activeFlow?.compiledFromRuleCount ?? null,
    flowConfidence: activeFlow?.confidence ?? null,
    healthReason,
    healthStatus,
    flowStatus: activeFlow?.status ?? null,
    flowStepCount: activeFlow?.steps.length ?? 0,
    flowVersion: activeFlow?.version ?? null,
    hostname,
    lastCompletedAt,
    lastFailedAt,
    reviewReady,
    reviewReason,
    reviewStatus,
    retrainingNeeded: retrainingSignal.needed,
    retrainingPriority: retrainingSignal.priority,
    retrainingReason: retrainingSignal.reason,
    retrainingTargetUrl: latestCompletedSession?.targetUrl ?? null,
    totalSessionCount,
    trustEligibility: trustPolicy.eligibility ?? null,
    trustReason: trustPolicy.reason ?? null,
  };
}

export async function getAssistTrainingHostnameInsights(
  hostnames: string[],
): Promise<Record<string, AssistTrainingHostnameInsight>> {
  const uniqueHostnames = Array.from(
    new Set(hostnames.filter(hostname => hostname.trim().length > 0)),
  );

  const entries = await Promise.all(
    uniqueHostnames.map(async hostname => [
      hostname,
      await getAssistTrainingHostnameInsight(hostname),
    ] as const),
  );

  return Object.fromEntries(entries);
}
