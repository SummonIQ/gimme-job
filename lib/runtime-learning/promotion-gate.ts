export interface PromotionGateInput {
  readonly atsSystemId?: string | null;
  readonly candidateId?: string;
  readonly hostname: string;
}

export type PromotionGateMode =
  | 'disabled'
  | 'no_family'
  | 'no_harness'
  | 'failed'
  | 'passed';

export interface PromotionGateResult {
  readonly allowed: boolean;
  readonly atsFamily: string | null;
  readonly mode: PromotionGateMode;
  readonly reason: string;
}

export interface RegressionHarnessRunner {
  (atsFamily: string): Promise<RegressionHarnessOutcome | null>;
}

export interface RegressionHarnessOutcome {
  readonly passed: boolean;
  readonly summary: string;
}

let regressionHarnessRunner: RegressionHarnessRunner = async () => null;

export function registerRegressionHarnessRunner(
  runner: RegressionHarnessRunner,
): void {
  regressionHarnessRunner = runner;
}

export function resetRegressionHarnessRunner(): void {
  regressionHarnessRunner = async () => null;
}

export async function checkRegressionGate(
  input: PromotionGateInput,
): Promise<PromotionGateResult> {
  const atsFamily = inferAtsFamily(input.hostname);

  if (process.env.RULE_PROMOTION_GATE_ENABLED !== '1') {
    return {
      allowed: true,
      atsFamily,
      mode: 'disabled',
      reason:
        'Regression gate disabled (RULE_PROMOTION_GATE_ENABLED is not "1"). Promotion permitted.',
    };
  }

  if (!atsFamily) {
    return {
      allowed: true,
      atsFamily: null,
      mode: 'no_family',
      reason: `No known ATS family for hostname "${input.hostname}"; gate skipped.`,
    };
  }

  const outcome = await regressionHarnessRunner(atsFamily);

  if (outcome === null) {
    return {
      allowed: false,
      atsFamily,
      mode: 'no_harness',
      reason: `Regression harness not registered for family "${atsFamily}". Promotion blocked until the harness is wired up (P7.1–P7.3).`,
    };
  }

  if (!outcome.passed) {
    return {
      allowed: false,
      atsFamily,
      mode: 'failed',
      reason: `Regression suite failed for family "${atsFamily}": ${outcome.summary}`,
    };
  }

  return {
    allowed: true,
    atsFamily,
    mode: 'passed',
    reason: `Regression suite passed for family "${atsFamily}": ${outcome.summary}`,
  };
}

const ATS_FAMILY_PATTERNS: ReadonlyArray<{
  readonly family: string;
  readonly pattern: RegExp;
}> = [
  { family: 'greenhouse', pattern: /(?:^|\.)greenhouse\.io$/i },
  { family: 'lever', pattern: /(?:^|\.)lever\.co$/i },
  { family: 'ashby', pattern: /(?:^|\.)ashbyhq\.com$/i },
  { family: 'workable', pattern: /(?:^|\.)workable\.com$/i },
  { family: 'smartrecruiters', pattern: /(?:^|\.)smartrecruiters\.com$/i },
  { family: 'workday', pattern: /myworkdayjobs\.com$/i },
];

export function inferAtsFamily(hostname: string): string | null {
  const trimmed = hostname.trim().toLowerCase();
  if (!trimmed) return null;

  for (const { family, pattern } of ATS_FAMILY_PATTERNS) {
    if (pattern.test(trimmed)) return family;
  }

  return null;
}
