// @vitest-environment node
import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import {
  calculatePromotionScore,
  OWNER_CONFIRMED_RUNTIME_SOURCE,
  RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD,
  RUNTIME_PROMOTION_SOURCE_WEIGHTS,
  type RuntimePromotionSignal,
} from '@/lib/runtime-learning/scoring';
import { describe, expect, it } from 'vitest';

function repeatSignal(
  count: number,
  signal: RuntimePromotionSignal,
): RuntimePromotionSignal[] {
  return Array.from({ length: count }, () => signal);
}

describe('runtime promotion scoring', () => {
  it('uses the exact P1.3 provenance weights', () => {
    expect(RUNTIME_PROMOTION_SOURCE_WEIGHTS).toEqual({
      AI_SELF_PLAY: {
        negative: 1.0,
        positive: 0.15,
      },
      BOOTSTRAP: 0.4,
      LEGACY: 0.3,
      OWNER_CONFIRMED: 1.0,
      OWNER_OVERRIDE: 1.2,
      RECONSTRUCTION: 0.5,
      REPLAY: 0.35,
      SYNTHETIC_FIXTURE: 0.25,
      TRUE_EXECUTION: 1.0,
    });
  });

  it('does not let ten reconstruction observations beat three true-execution observations', () => {
    const reconstructionScore = calculatePromotionScore({
      signals: repeatSignal(10, {
        source: ApplicationRuntimeSource.RECONSTRUCTION,
        success: true,
      }),
    });
    const trueExecutionScore = calculatePromotionScore({
      signals: repeatSignal(3, {
        source: ApplicationRuntimeSource.TRUE_EXECUTION,
        success: true,
      }),
    });

    expect(trueExecutionScore.positiveWeight).toBeLessThan(
      reconstructionScore.positiveWeight,
    );
    expect(trueExecutionScore.confidence).toBeGreaterThan(
      reconstructionScore.confidence,
    );
  });

  it('lets one owner override beat twenty AI self-play clean successes', () => {
    const aiSelfPlayScore = calculatePromotionScore({
      signals: repeatSignal(20, {
        source: ApplicationRuntimeSource.AI_SELF_PLAY,
        success: true,
      }),
    });
    const ownerOverrideScore = calculatePromotionScore({
      signals: [
        ...repeatSignal(20, {
          source: ApplicationRuntimeSource.AI_SELF_PLAY,
          success: true,
        }),
        {
          source: ApplicationRuntimeSource.OWNER_OVERRIDE,
          success: false,
        },
      ],
    });

    expect(aiSelfPlayScore.confidence).toBeLessThan(
      RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD,
    );
    expect(ownerOverrideScore.failureWeight).toBe(1.2);
    expect(ownerOverrideScore.confidence).toBeLessThan(
      aiSelfPlayScore.confidence,
    );
  });

  it('caps negative AI self-play below promotion until true execution confirms the path', () => {
    const cappedScore = calculatePromotionScore({
      signals: [
        ...repeatSignal(20, {
          source: ApplicationRuntimeSource.AI_SELF_PLAY,
          success: true,
        }),
        {
          source: ApplicationRuntimeSource.AI_SELF_PLAY,
          success: false,
        },
      ],
    });
    const confirmedScore = calculatePromotionScore({
      signals: [
        ...repeatSignal(20, {
          source: ApplicationRuntimeSource.AI_SELF_PLAY,
          success: true,
        }),
        {
          source: ApplicationRuntimeSource.AI_SELF_PLAY,
          success: false,
        },
        {
          source: ApplicationRuntimeSource.TRUE_EXECUTION,
          success: true,
        },
      ],
    });

    expect(cappedScore.confidence).toBeLessThan(
      RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD,
    );
    expect(confirmedScore.confidence).toBeGreaterThanOrEqual(
      RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD,
    );
  });

  it('does not implicitly increase legacy observation weight over time', () => {
    const fiveLegacySignals = calculatePromotionScore({
      signals: repeatSignal(5, {
        source: ApplicationRuntimeSource.LEGACY,
        success: true,
      }),
    });
    const fiftyLegacySignals = calculatePromotionScore({
      signals: repeatSignal(50, {
        source: ApplicationRuntimeSource.LEGACY,
        success: true,
      }),
    });

    expect(fiveLegacySignals.confidence).toBe(0.6);
    expect(fiftyLegacySignals.confidence).toBe(fiveLegacySignals.confidence);
  });

  it('treats owner-confirmed training review evidence as trusted execution evidence', () => {
    const score = calculatePromotionScore({
      signals: [
        {
          source: OWNER_CONFIRMED_RUNTIME_SOURCE,
          success: true,
        },
      ],
    });

    expect(score.trustedPositiveWeight).toBe(1);
    expect(score.confidence).toBeGreaterThanOrEqual(
      RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD,
    );
  });
});
