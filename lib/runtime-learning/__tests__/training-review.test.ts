// @vitest-environment node
import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import {
  reviewRulePromotionCandidate,
  RUNTIME_TRAINING_REVIEW_DECISIONS,
} from '@/lib/runtime-learning';
import { OWNER_CONFIRMED_RUNTIME_SOURCE } from '@/lib/runtime-learning/scoring';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auditCreate: vi.fn(),
  candidateFindUnique: vi.fn(),
  candidateUpdate: vi.fn(),
  ruleCreate: vi.fn(),
  ruleFindUnique: vi.fn(),
  ruleUpdate: vi.fn(),
  runtimeSessionFindUnique: vi.fn(),
  trainingReviewCreate: vi.fn(),
  transaction: vi.fn(),
}));

vi.mock('@/lib/db/client', () => {
  const tx = {
    aTSRule: {
      create: mocks.ruleCreate,
      findUnique: mocks.ruleFindUnique,
      update: mocks.ruleUpdate,
    },
    applicationRuntimeSession: {
      findUnique: mocks.runtimeSessionFindUnique,
    },
    automationAuditLog: {
      create: mocks.auditCreate,
    },
    rulePromotionCandidate: {
      findUnique: mocks.candidateFindUnique,
      update: mocks.candidateUpdate,
    },
    runtimeTrainingReview: {
      create: mocks.trainingReviewCreate,
    },
  };

  return {
    db: {
      ...tx,
      $transaction: mocks.transaction.mockImplementation(
        async (callback: (transaction: typeof tx) => unknown) => callback(tx),
      ),
    },
  };
});

vi.mock('@/lib/assist-training/auto-retrain', () => ({
  checkAndQueueRetraining: vi.fn(),
}));

vi.mock('@/lib/assist-training/confidence', () => ({
  recomputeRuleConfidence: vi.fn(),
}));

vi.mock('@/lib/runtime-model-support', () => ({
  hasRuntimeLearningModels: () => true,
}));

function makeCandidate() {
  return {
    action: 'fill',
    actionType: 'fill',
    atsSystemId: 'ats-1',
    confidence: 0.72,
    fieldLabel: 'Email',
    fieldName: 'email',
    hostname: 'jobs.example.test',
    id: 'candidate-1',
    observationCount: 4,
    stableSelector: '[name="email"]',
    tagName: 'input',
    userId: 'user-1',
  };
}

describe('reviewRulePromotionCandidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transaction.mockImplementation(
      async (callback: (transaction: unknown) => unknown) =>
        callback({
          aTSRule: {
            create: mocks.ruleCreate,
            findUnique: mocks.ruleFindUnique,
            update: mocks.ruleUpdate,
          },
          applicationRuntimeSession: {
            findUnique: mocks.runtimeSessionFindUnique,
          },
          automationAuditLog: {
            create: mocks.auditCreate,
          },
          rulePromotionCandidate: {
            findUnique: mocks.candidateFindUnique,
            update: mocks.candidateUpdate,
          },
          runtimeTrainingReview: {
            create: mocks.trainingReviewCreate,
          },
        }),
    );
    mocks.candidateFindUnique.mockResolvedValue(makeCandidate());
    mocks.runtimeSessionFindUnique.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
    });
    mocks.ruleFindUnique.mockResolvedValue(null);
    mocks.ruleCreate.mockResolvedValue({ id: 'rule-1' });
    mocks.ruleUpdate.mockResolvedValue({ id: 'rule-1' });
    mocks.trainingReviewCreate.mockResolvedValue({ id: 'review-1' });
  });

  it('approves a candidate by creating an owner-confirmed rule, review, and audit log', async () => {
    const result = await reviewRulePromotionCandidate({
      candidateId: 'candidate-1',
      decision: RUNTIME_TRAINING_REVIEW_DECISIONS.APPROVED,
      reviewerNote: 'Selector matched the replay artifact.',
      sessionId: 'session-1',
      userId: 'user-1',
    });

    expect(result).toEqual({
      decision: 'APPROVED',
      promotionStatus: 'PROMOTED',
      reviewId: 'review-1',
      ruleId: 'rule-1',
    });
    expect(mocks.ruleCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        confidence: 1,
        source: ApplicationRuntimeSource.OWNER_CONFIRMED,
        sourceTrainingSessionIds: ['session-1'],
      }),
    });
    expect(mocks.candidateUpdate).toHaveBeenCalledWith({
      data: {
        confidence: 1,
        promotionStatus: 'PROMOTED',
      },
      where: { id: 'candidate-1' },
    });
    expect(mocks.trainingReviewCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        candidateId: 'candidate-1',
        decision: 'APPROVED',
        ruleId: 'rule-1',
        sessionId: 'session-1',
        userId: 'user-1',
      }),
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'runtime_training_review',
        actionType: 'APPROVED',
        metadata: expect.objectContaining({
          source: OWNER_CONFIRMED_RUNTIME_SOURCE,
        }),
        userId: 'user-1',
      }),
    });
  });

  it('rejects a candidate without creating or syncing a rule', async () => {
    const result = await reviewRulePromotionCandidate({
      candidateId: 'candidate-1',
      decision: RUNTIME_TRAINING_REVIEW_DECISIONS.REJECTED,
      sessionId: 'session-1',
      userId: 'user-1',
    });

    expect(result).toEqual({
      decision: 'REJECTED',
      promotionStatus: 'REJECTED',
      reviewId: 'review-1',
      ruleId: null,
    });
    expect(mocks.ruleCreate).not.toHaveBeenCalled();
    expect(mocks.ruleUpdate).not.toHaveBeenCalled();
    expect(mocks.candidateUpdate).toHaveBeenCalledWith({
      data: { promotionStatus: 'REJECTED' },
      where: { id: 'candidate-1' },
    });
  });
});
