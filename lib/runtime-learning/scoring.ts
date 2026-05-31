import { ApplicationRuntimeSource } from '@/generated/prisma/client';

export const OWNER_CONFIRMED_RUNTIME_SOURCE = 'OWNER_CONFIRMED';
export const RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD = 0.75;

export type RuntimePromotionSource =
  | ApplicationRuntimeSource
  | typeof OWNER_CONFIRMED_RUNTIME_SOURCE;

export interface RuntimePromotionSignal {
  source: RuntimePromotionSource;
  success?: boolean | null;
}

export const RUNTIME_PROMOTION_SOURCE_WEIGHTS = {
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
} as const satisfies Record<
  RuntimePromotionSource,
  number | { negative: number; positive: number }
>;

function getPromotionSignalWeight(signal: RuntimePromotionSignal): number {
  const sourceWeight = RUNTIME_PROMOTION_SOURCE_WEIGHTS[signal.source];

  if (typeof sourceWeight === 'number') {
    return sourceWeight;
  }

  return signal.success === false
    ? sourceWeight.negative
    : sourceWeight.positive;
}

function getPositiveSourceConfidenceCap(
  source: RuntimePromotionSource,
): number {
  switch (source) {
    case 'OWNER_OVERRIDE':
      return 0.98;
    case 'OWNER_CONFIRMED':
    case 'TRUE_EXECUTION':
      return 0.9;
    case 'RECONSTRUCTION':
      return 0.72;
    case 'BOOTSTRAP':
      return 0.68;
    case 'REPLAY':
      return 0.64;
    case 'LEGACY':
      return 0.6;
    case 'SYNTHETIC_FIXTURE':
      return 0.58;
    case 'AI_SELF_PLAY':
      return 0.55;
  }
}

function isTrustedPositiveSource(source: RuntimePromotionSource): boolean {
  return (
    source === 'OWNER_OVERRIDE' ||
    source === 'OWNER_CONFIRMED' ||
    source === 'TRUE_EXECUTION'
  );
}

export function calculatePromotionScore(input: {
  signals: readonly RuntimePromotionSignal[];
}): {
  confidence: number;
  failureWeight: number;
  positiveWeight: number;
  trustedPositiveWeight: number;
} {
  let failureWeight = 0;
  let hasNegativeAiSelfPlay = false;
  let hasNegativeOwnerOverride = false;
  let hasTrustedPositiveAfterNegativeAiSelfPlay = false;
  let positiveConfidenceCap = 0.5;
  let positiveWeight = 0;
  let trustedPositiveWeight = 0;

  for (const signal of input.signals) {
    if (signal.success !== true && signal.success !== false) {
      continue;
    }

    const weight = getPromotionSignalWeight(signal);

    if (signal.success) {
      positiveWeight += weight;
      positiveConfidenceCap = Math.max(
        positiveConfidenceCap,
        getPositiveSourceConfidenceCap(signal.source),
      );

      if (isTrustedPositiveSource(signal.source)) {
        trustedPositiveWeight += weight;
        if (hasNegativeAiSelfPlay) {
          hasTrustedPositiveAfterNegativeAiSelfPlay = true;
        }
      }
      continue;
    }

    failureWeight += weight;
    if (signal.source === 'AI_SELF_PLAY') {
      hasNegativeAiSelfPlay = true;
    }
    if (signal.source === 'OWNER_OVERRIDE') {
      hasNegativeOwnerOverride = true;
    }
  }

  const totalWeight = positiveWeight + failureWeight;
  if (totalWeight === 0) {
    return {
      confidence: 0.2,
      failureWeight,
      positiveWeight,
      trustedPositiveWeight,
    };
  }

  const positiveShare = positiveWeight / totalWeight;
  let confidenceCap = positiveConfidenceCap;

  if (hasNegativeOwnerOverride) {
    confidenceCap = Math.min(confidenceCap, 0.45);
  }

  if (hasNegativeAiSelfPlay && !hasTrustedPositiveAfterNegativeAiSelfPlay) {
    confidenceCap = Math.min(
      confidenceCap,
      RUNTIME_PROMOTION_CONFIDENCE_THRESHOLD - 0.01,
    );
  }

  const confidence = Math.min(confidenceCap, 0.5 + positiveShare * 0.35);

  return {
    confidence: Math.max(0, Math.min(1, confidence)),
    failureWeight,
    positiveWeight,
    trustedPositiveWeight,
  };
}
