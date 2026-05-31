interface RuleConfidenceInput {
  readonly consecutiveFailures: number;
  readonly observationCount: number;
}

export function recomputeRuleConfidence(rule: RuleConfidenceInput): number {
  const base = Math.min(1, Math.max(0, rule.observationCount) / 10);
  const failurePenalty = Math.pow(0.7, Math.max(0, rule.consecutiveFailures));
  return Math.max(0, Math.min(1, base * failurePenalty));
}
