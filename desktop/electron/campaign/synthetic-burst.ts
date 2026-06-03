const DEFAULT_SYNTHETIC_CONCURRENCY = 25;
const DEFAULT_TOKEN_SPEND_PER_SESSION = 120;
const DEFAULT_COST_PER_1K_TOKENS_USD = 0.002;

export const SYNTHETIC_FIXTURE_FAMILIES = [
  'greenhouse',
  'lever',
  'ashby',
  'smartrecruiters',
] as const;

export type SyntheticFixtureFamily =
  (typeof SYNTHETIC_FIXTURE_FAMILIES)[number];

export interface SyntheticBurstCostModel {
  readonly costPerThousandTokensUsd?: number;
  readonly tokensPerSession?: number;
}

export interface SyntheticBurstInput {
  readonly concurrency?: number;
  readonly costModel?: SyntheticBurstCostModel;
  readonly families?: readonly SyntheticFixtureFamily[];
  readonly fetchImpl?: typeof fetch;
  readonly fixtureBaseUrl: string;
  readonly sessionCount: number;
}

export interface SyntheticFixtureManifest {
  readonly confirmationPhrase: string;
  readonly family: SyntheticFixtureFamily;
  readonly submitPath: string;
}

export interface SyntheticBurstSessionOutcome {
  readonly confirmationMatched: boolean;
  readonly error?: string;
  readonly family: SyntheticFixtureFamily;
  readonly index: number;
  readonly latencyMs: Readonly<Record<SyntheticBurstStepName, number>>;
  readonly reference?: string | null;
  readonly status: 'failed' | 'succeeded';
  readonly tokensSpent: number;
}

export type SyntheticBurstStepName =
  | 'load_application'
  | 'load_manifest'
  | 'submit';

export interface SyntheticBurstStepLatency {
  readonly averageMs: number;
  readonly count: number;
  readonly maxMs: number;
  readonly p95Ms: number;
  readonly step: SyntheticBurstStepName;
}

export interface SyntheticBurstReport {
  readonly completed: number;
  readonly durationMs: number;
  readonly estimatedCostUsd: number;
  readonly failed: number;
  readonly outcomes: readonly SyntheticBurstSessionOutcome[];
  readonly requested: number;
  readonly stepLatencies: readonly SyntheticBurstStepLatency[];
  readonly succeeded: number;
  readonly successRate: number;
  readonly throughputPerMinute: number;
  readonly tokensSpent: number;
}

interface RunSyntheticSessionInput {
  readonly baseUrl: string;
  readonly costModel: Required<SyntheticBurstCostModel>;
  readonly family: SyntheticFixtureFamily;
  readonly fetchImpl: typeof fetch;
  readonly index: number;
}

export async function runSyntheticBurst(
  input: SyntheticBurstInput,
): Promise<SyntheticBurstReport> {
  const families = input.families ?? SYNTHETIC_FIXTURE_FAMILIES;
  if (families.length === 0) {
    throw new Error('Synthetic burst requires at least one fixture family.');
  }
  const sessionCount = positiveInteger(input.sessionCount, 'sessionCount');
  const concurrency = positiveIntegerOrDefault(
    input.concurrency,
    DEFAULT_SYNTHETIC_CONCURRENCY,
  );
  const fetchImpl = input.fetchImpl ?? fetch;
  const costModel = normalizeCostModel(input.costModel);
  const startedAt = Date.now();
  const outcomes = await mapWithConcurrency(
    Array.from({ length: sessionCount }).map((_, index) => index),
    concurrency,
    index =>
      runSyntheticSession({
        baseUrl: input.fixtureBaseUrl,
        costModel,
        family: families[index % families.length],
        fetchImpl,
        index,
      }),
  );
  const durationMs = Math.max(1, Date.now() - startedAt);
  const succeeded = outcomes.filter(
    outcome => outcome.status === 'succeeded',
  ).length;
  const failed = outcomes.length - succeeded;
  const tokensSpent = outcomes.reduce(
    (sum, outcome) => sum + outcome.tokensSpent,
    0,
  );

  return {
    completed: outcomes.length,
    durationMs,
    estimatedCostUsd: roundCurrency(
      (tokensSpent / 1000) * costModel.costPerThousandTokensUsd,
    ),
    failed,
    outcomes,
    requested: sessionCount,
    stepLatencies: summarizeStepLatencies(outcomes),
    succeeded,
    successRate: outcomes.length === 0 ? 0 : succeeded / outcomes.length,
    throughputPerMinute: roundMetric((outcomes.length / durationMs) * 60_000),
    tokensSpent,
  };
}

async function runSyntheticSession({
  baseUrl,
  costModel,
  family,
  fetchImpl,
  index,
}: RunSyntheticSessionInput): Promise<SyntheticBurstSessionOutcome> {
  const latencyMs: Record<SyntheticBurstStepName, number> = {
    load_application: 0,
    load_manifest: 0,
    submit: 0,
  };

  try {
    const manifest = await measureStep(latencyMs, 'load_manifest', () =>
      loadManifest({ baseUrl, family, fetchImpl }),
    );

    await measureStep(latencyMs, 'load_application', async () => {
      const response = await fetchImpl(
        fixtureUrl(baseUrl, `/fixtures/${family}/application`),
      );
      if (!response.ok) {
        throw new Error(
          `Fixture application load failed for ${family}: ${response.status}`,
        );
      }
      await response.text();
    });

    const submit = await measureStep(latencyMs, 'submit', () =>
      submitFixture({ baseUrl, fetchImpl, manifest }),
    );

    return {
      confirmationMatched: submit.confirmationMatched,
      family,
      index,
      latencyMs,
      reference: submit.reference,
      status: submit.confirmationMatched ? 'succeeded' : 'failed',
      tokensSpent: costModel.tokensPerSession,
    };
  } catch (error) {
    return {
      confirmationMatched: false,
      error: error instanceof Error ? error.message : 'Synthetic session failed.',
      family,
      index,
      latencyMs,
      status: 'failed',
      tokensSpent: costModel.tokensPerSession,
    };
  }
}

async function loadManifest(input: {
  readonly baseUrl: string;
  readonly family: SyntheticFixtureFamily;
  readonly fetchImpl: typeof fetch;
}): Promise<SyntheticFixtureManifest> {
  const response = await input.fetchImpl(
    fixtureUrl(input.baseUrl, `/fixtures/${input.family}/fixture.json`),
  );
  if (!response.ok) {
    throw new Error(
      `Fixture manifest load failed for ${input.family}: ${response.status}`,
    );
  }

  const manifest = (await response.json()) as Partial<SyntheticFixtureManifest>;
  if (
    manifest.family !== input.family ||
    typeof manifest.submitPath !== 'string' ||
    typeof manifest.confirmationPhrase !== 'string'
  ) {
    throw new Error(`Fixture manifest is invalid for ${input.family}.`);
  }

  return {
    confirmationPhrase: manifest.confirmationPhrase,
    family: manifest.family,
    submitPath: manifest.submitPath,
  };
}

async function submitFixture(input: {
  readonly baseUrl: string;
  readonly fetchImpl: typeof fetch;
  readonly manifest: SyntheticFixtureManifest;
}): Promise<{ confirmationMatched: boolean; reference: string | null }> {
  const response = await input.fetchImpl(
    fixtureUrl(input.baseUrl, input.manifest.submitPath),
    {
      body: new URLSearchParams({
        email: 'synthetic@example.test',
        name: 'Synthetic Candidate',
      }),
      headers: {
        'content-type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    },
  );
  if (!response.ok) {
    throw new Error(
      `Fixture submit failed for ${input.manifest.family}: ${response.status}`,
    );
  }

  const body = await response.text();
  return {
    confirmationMatched: body.includes(input.manifest.confirmationPhrase),
    reference: response.headers.get('x-fixture-reference'),
  };
}

async function measureStep<T>(
  latencyMs: Record<SyntheticBurstStepName, number>,
  step: SyntheticBurstStepName,
  fn: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  try {
    return await fn();
  } finally {
    latencyMs[step] = Math.max(0, Date.now() - startedAt);
  }
}

function summarizeStepLatencies(
  outcomes: readonly SyntheticBurstSessionOutcome[],
): SyntheticBurstStepLatency[] {
  return (['load_manifest', 'load_application', 'submit'] as const).map(
    step => {
      const values = outcomes
        .map(outcome => outcome.latencyMs[step])
        .filter(value => Number.isFinite(value))
        .sort((a, b) => a - b);
      return {
        averageMs: roundMetric(average(values)),
        count: values.length,
        maxMs: values.at(-1) ?? 0,
        p95Ms: percentile(values, 0.95),
        step,
      };
    },
  );
}

function fixtureUrl(baseUrl: string, pathname: string): string {
  return new URL(pathname, baseUrl).toString();
}

function normalizeCostModel(
  costModel: SyntheticBurstCostModel | undefined,
): Required<SyntheticBurstCostModel> {
  return {
    costPerThousandTokensUsd:
      costModel?.costPerThousandTokensUsd ??
      DEFAULT_COST_PER_1K_TOKENS_USD,
    tokensPerSession:
      costModel?.tokensPerSession ?? DEFAULT_TOKEN_SPEND_PER_SESSION,
  };
}

function positiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }

  return value;
}

function positiveIntegerOrDefault(
  value: number | undefined,
  defaultValue: number,
): number {
  if (value === undefined) return defaultValue;
  return positiveInteger(value, 'concurrency');
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: readonly number[], percentileValue: number): number {
  if (values.length === 0) return 0;
  const index = Math.min(
    values.length - 1,
    Math.ceil(values.length * percentileValue) - 1,
  );
  return values[index] ?? 0;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100_000) / 100_000;
}

async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }).map(() =>
      worker(),
    ),
  );
  return results;
}
