import type { GenerateCoverLetterForLeadResult } from '@/lib/cover-letters/generate-for-lead';

export interface WarmupRunnerInput {
  /** AbortSignal for cooperative cancellation. */
  readonly abortSignal?: AbortSignal;
  /**
   * Maximum total estimated tokens to spend across all leads. If the estimate
   * (perLeadTokenEstimate * leadIds.length) exceeds this, the runner aborts
   * before starting any work and the report's `aborted` flag is set.
   */
  readonly budgetTokens: number;
  /** Concurrent in-flight tailorings. */
  readonly concurrency?: number;
  /** The leads to warm up. Order preserved in the report. */
  readonly leadIds: readonly string[];
  /**
   * Token estimate per lead used for the budget check. Tune as the tailoring
   * pipeline grows; default reflects ~one cover letter generation.
   */
  readonly perLeadTokenEstimate?: number;
  /**
   * Tailoring step. Defaults to cover-letter generation. Tests (and future
   * P9.2 resume tailoring) can inject their own.
   */
  readonly tailor?: (leadId: string) => Promise<WarmupTailorResult>;
}

export interface WarmupTailorResult {
  readonly missingContext: readonly string[];
  readonly skipped: boolean;
  readonly skippedReason?: string;
}

export interface WarmupLeadOutcome {
  readonly durationMs: number;
  readonly error?: string;
  readonly leadId: string;
  readonly missingContext: readonly string[];
  readonly skipped: boolean;
  readonly skippedReason?: string;
  readonly status: 'completed' | 'skipped' | 'failed' | 'aborted';
}

export interface WarmupReport {
  readonly aborted: boolean;
  readonly abortReason?: string;
  readonly completedCount: number;
  readonly estimatedTokensTotal: number;
  readonly failedCount: number;
  readonly outcomes: readonly WarmupLeadOutcome[];
  readonly skippedCount: number;
  readonly totalDurationMs: number;
}

const DEFAULT_CONCURRENCY = 4;
const DEFAULT_PER_LEAD_TOKEN_ESTIMATE = 3_000;

export async function runPreBurstWarmup(
  input: WarmupRunnerInput,
): Promise<WarmupReport> {
  const concurrency = Math.max(1, input.concurrency ?? DEFAULT_CONCURRENCY);
  const perLeadEstimate =
    input.perLeadTokenEstimate ?? DEFAULT_PER_LEAD_TOKEN_ESTIMATE;
  const estimatedTotal = perLeadEstimate * input.leadIds.length;
  const startedAt = Date.now();

  if (input.budgetTokens > 0 && estimatedTotal > input.budgetTokens) {
    return {
      aborted: true,
      abortReason: `Estimated token spend ${estimatedTotal} exceeds budget ${input.budgetTokens} (${input.leadIds.length} leads × ${perLeadEstimate}/lead).`,
      completedCount: 0,
      estimatedTokensTotal: estimatedTotal,
      failedCount: 0,
      outcomes: [],
      skippedCount: 0,
      totalDurationMs: 0,
    };
  }

  if (input.abortSignal?.aborted) {
    return {
      aborted: true,
      abortReason: 'Aborted before any work started.',
      completedCount: 0,
      estimatedTokensTotal: estimatedTotal,
      failedCount: 0,
      outcomes: [],
      skippedCount: 0,
      totalDurationMs: 0,
    };
  }

  const tailor = input.tailor ?? defaultTailor;
  const outcomes = new Array<WarmupLeadOutcome | null>(input.leadIds.length);
  let nextIndex = 0;
  let aborted = false;
  let abortReason: string | undefined;

  async function worker(): Promise<void> {
    while (true) {
      if (input.abortSignal?.aborted) {
        aborted = true;
        abortReason = abortReason ?? 'Aborted via signal.';
        return;
      }
      const index = nextIndex++;
      if (index >= input.leadIds.length) return;

      const leadId = input.leadIds[index]!;
      const leadStart = Date.now();
      try {
        const result = await tailor(leadId);
        outcomes[index] = {
          durationMs: Date.now() - leadStart,
          leadId,
          missingContext: result.missingContext,
          skipped: result.skipped,
          skippedReason: result.skippedReason,
          status: result.skipped ? 'skipped' : 'completed',
        };
      } catch (error) {
        outcomes[index] = {
          durationMs: Date.now() - leadStart,
          error: error instanceof Error ? error.message : String(error),
          leadId,
          missingContext: [],
          skipped: false,
          status: 'failed',
        };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, input.leadIds.length) }, worker),
  );

  for (let index = 0; index < outcomes.length; index += 1) {
    if (outcomes[index] === null || outcomes[index] === undefined) {
      outcomes[index] = {
        durationMs: 0,
        leadId: input.leadIds[index]!,
        missingContext: [],
        skipped: true,
        skippedReason: 'Skipped because the run was aborted.',
        status: 'aborted',
      };
    }
  }

  const completedCount = outcomes.filter(o => o?.status === 'completed').length;
  const skippedCount = outcomes.filter(
    o => o?.status === 'skipped' || o?.status === 'aborted',
  ).length;
  const failedCount = outcomes.filter(o => o?.status === 'failed').length;

  return {
    aborted,
    abortReason,
    completedCount,
    estimatedTokensTotal: estimatedTotal,
    failedCount,
    outcomes: outcomes as readonly WarmupLeadOutcome[],
    skippedCount,
    totalDurationMs: Date.now() - startedAt,
  };
}

async function defaultTailor(leadId: string): Promise<WarmupTailorResult> {
  const { generateCoverLetterForLead } = await import(
    '@/lib/cover-letters/generate-for-lead'
  );
  const result: GenerateCoverLetterForLeadResult =
    await generateCoverLetterForLead(leadId);
  return {
    missingContext: result.missingContext,
    skipped: result.skipped,
    skippedReason: result.skippedReason,
  };
}
