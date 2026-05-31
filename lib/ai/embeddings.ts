import { embed } from 'ai';
import { createOllama } from 'ollama-ai-provider-v2';
import { db } from '@/lib/db/client';

// Local-only embeddings. Ollama serves nomic-embed-text (768 dims) which
// is fast (~50ms on Apple Silicon) and free. Switched off OpenAI's
// text-embedding-3-small (1536 dims) so the resolver no longer hits a
// 429 / billing wall when the API quota is exhausted.
//
// NOTE: pgvector embedding columns were migrated from vector(1536) to
// vector(768) at the same time — see prisma/migrations. Rows that were
// previously embedded against OpenAI's model now have NULL embeddings
// and get lazily re-embedded the next time they're saved.
const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434/api',
  headers: process.env.OLLAMA_AUTH_TOKEN
    ? { Authorization: `Bearer ${process.env.OLLAMA_AUTH_TOKEN}` }
    : undefined,
});

const EMBEDDING_MODEL = process.env.OLLAMA_EMBEDDING_MODEL ?? 'nomic-embed-text';

export async function generateEmbedding(text: string): Promise<number[]> {
  // `maxRetries: 0` — the embedding service either responds quickly or it
  // doesn't. Default retry behaviour (3× with exponential backoff) costs
  // ~15s per field when the upstream is down, which makes the whole
  // submission flow feel hung. Callers already swallow errors and
  // continue, so failing fast is what we want.
  const { embedding } = await embed({
    model: ollama.embedding(EMBEDDING_MODEL),
    value: text,
    maxRetries: 0,
  });
  return embedding;
}

/** Format a JS array as a pgvector literal: '[1.23,4.56,...]'. */
function toVectorLiteral(values: readonly number[]): string {
  return JSON.stringify(values);
}

/**
 * Build searchable text for an ATSRule, mirroring observationToText so a
 * rule promoted from observations stays close in vector space.
 */
function ruleToText(rule: {
  fieldLabel?: string | null;
  action: string;
  actionType: string;
  hostname: string;
  reason?: string | null;
}): string {
  return [
    rule.fieldLabel,
    `${rule.action} ${rule.actionType}`,
    rule.hostname,
    rule.reason,
  ]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Generate + persist an embedding for an ATSRule.
 */
export async function embedRule(ruleId: string): Promise<void> {
  const rule = await db.aTSRule.findUnique({
    where: { id: ruleId },
    select: {
      action: true,
      actionType: true,
      fieldLabel: true,
      hostname: true,
      reason: true,
    },
  });
  if (!rule) return;
  const text = ruleToText(rule);
  if (!text.trim()) return;
  const vector = toVectorLiteral(await generateEmbedding(text));
  await db.$executeRaw`
    UPDATE "ATSRule"
    SET "embedding" = ${vector}::vector
    WHERE "id" = ${ruleId}
  `;
}

/**
 * Generate + persist an embedding for a FormFieldFeedback row keyed on
 * fieldLabel. Used to match a new field's question to prior approve /
 * reject feedback even when phrasing differs.
 */
export async function embedFormFieldFeedback(id: string): Promise<void> {
  const row = await db.formFieldFeedback.findUnique({
    where: { id },
    select: { fieldLabel: true },
  });
  if (!row?.fieldLabel?.trim()) return;
  const vector = await generateEmbedding(row.fieldLabel);
  const literal = toVectorLiteral(vector);
  await db.$executeRaw`
    UPDATE "FormFieldFeedback"
    SET "embedding" = ${literal}::vector
    WHERE "id" = ${id}
  `;
}

/**
 * Generate + persist an embedding for a UserFieldRule row keyed on the
 * `question` text.
 */
export async function embedUserFieldRule(id: string): Promise<void> {
  const row = await db.userFieldRule.findUnique({
    where: { id },
    select: { question: true },
  });
  if (!row?.question?.trim()) return;
  const vector = await generateEmbedding(row.question);
  const literal = toVectorLiteral(vector);
  await db.$executeRaw`
    UPDATE "UserFieldRule"
    SET "embedding" = ${literal}::vector
    WHERE "id" = ${id}
  `;
}

export interface SimilarFeedbackRow {
  readonly id: string;
  readonly fieldLabel: string;
  readonly hostname: string;
  readonly feedback: string;
  readonly filledValue: string | null;
  readonly rejectReason: string | null;
  readonly status: string | null;
  readonly similarity: number;
}

/**
 * Top-K most semantically similar FormFieldFeedback rows for the given
 * user + question text. minSimilarity defaults to 0.78 — high enough to
 * reject unrelated questions while still catching paraphrases.
 */
export async function findSimilarFieldFeedback(
  userId: string,
  queryText: string,
  options?: { limit?: number; minSimilarity?: number },
): Promise<readonly SimilarFeedbackRow[]> {
  const trimmed = queryText.trim();
  if (!trimmed) return [];
  const limit = options?.limit ?? 8;
  const minSimilarity = options?.minSimilarity ?? 0.78;
  const vector = toVectorLiteral(await generateEmbedding(trimmed));
  const rows = await db.$queryRaw<SimilarFeedbackRow[]>`
    SELECT
      id,
      "fieldLabel" as "fieldLabel",
      hostname,
      feedback,
      "filledValue" as "filledValue",
      "rejectReason" as "rejectReason",
      status,
      1 - ("embedding" <=> ${vector}::vector) as similarity
    FROM "FormFieldFeedback"
    WHERE "userId" = ${userId}
      AND "embedding" IS NOT NULL
    ORDER BY "embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `;
  return rows.filter(r => r.similarity >= minSimilarity);
}

export interface SimilarUserFieldRuleRow {
  readonly id: string;
  readonly hostname: string | null;
  readonly question: string;
  readonly answer: string;
  readonly source: string;
  readonly similarity: number;
}

/**
 * Top-K most semantically similar UserFieldRule rows for a user. Prefers
 * the requested hostname (rules tagged with the same hostname rank
 * higher) but falls back to global rules.
 */
export async function findSimilarUserFieldRules(
  userId: string,
  hostname: string | null,
  queryText: string,
  options?: { limit?: number; minSimilarity?: number },
): Promise<readonly SimilarUserFieldRuleRow[]> {
  const trimmed = queryText.trim();
  if (!trimmed) return [];
  const limit = options?.limit ?? 5;
  const minSimilarity = options?.minSimilarity ?? 0.82;
  const vector = toVectorLiteral(await generateEmbedding(trimmed));
  const rows = await db.$queryRaw<SimilarUserFieldRuleRow[]>`
    SELECT
      id,
      hostname,
      question,
      answer,
      source,
      1 - ("embedding" <=> ${vector}::vector) as similarity
    FROM "UserFieldRule"
    WHERE "userId" = ${userId}
      AND "embedding" IS NOT NULL
      AND (hostname = ${hostname} OR hostname IS NULL)
    ORDER BY
      (CASE WHEN hostname = ${hostname} THEN 0 ELSE 1 END),
      "embedding" <=> ${vector}::vector
    LIMIT ${limit}
  `;
  return rows.filter(r => r.similarity >= minSimilarity);
}

/**
 * Build a searchable text representation of a field observation.
 */
function observationToText(observation: {
  fieldLabel?: string | null;
  fieldName?: string | null;
  ariaLabel?: string | null;
  placeholder?: string | null;
  tagName: string;
  inputType?: string | null;
  action: string;
  actionType: string;
  hostname: string;
}): string {
  const parts = [
    observation.fieldLabel,
    observation.fieldName,
    observation.ariaLabel,
    observation.placeholder,
    `${observation.tagName} ${observation.inputType ?? ''}`.trim(),
    `${observation.action} ${observation.actionType}`,
    observation.hostname,
  ].filter(Boolean);
  return parts.join(' | ');
}

/**
 * Generate and store an embedding for a field observation.
 */
export async function embedObservation(observationId: string): Promise<void> {
  const observation = await db.aTSFieldObservation.findUnique({
    where: { id: observationId },
  });
  if (!observation) return;

  const text = observationToText(observation);
  const embedding = await generateEmbedding(text);

  await db.$executeRaw`
    UPDATE "ATSFieldObservation"
    SET "embedding" = ${JSON.stringify(embedding)}::vector
    WHERE "id" = ${observationId}
  `;
}

/**
 * Find similar field observations across all sites using vector similarity.
 * Returns observations that are semantically similar to the query text,
 * enabling cross-site pattern transfer.
 */
export async function findSimilarObservations(
  queryText: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    excludeHostname?: string;
  },
): Promise<
  Array<{
    id: string;
    hostname: string;
    fieldLabel: string | null;
    action: string;
    actionType: string;
    similarity: number;
  }>
> {
  const embedding = await generateEmbedding(queryText);
  const limit = options?.limit ?? 10;
  const minSimilarity = options?.minSimilarity ?? 0.7;
  const excludeHostname = options?.excludeHostname ?? '';

  const results = await db.$queryRaw<
    Array<{
      id: string;
      hostname: string;
      fieldLabel: string | null;
      action: string;
      actionType: string;
      similarity: number;
    }>
  >`
    SELECT
      id,
      hostname,
      "fieldLabel" as "fieldLabel",
      action,
      "actionType" as "actionType",
      1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM "ATSFieldObservation"
    WHERE "embedding" IS NOT NULL
      AND (${excludeHostname} = '' OR hostname != ${excludeHostname})
    ORDER BY "embedding" <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit}
  `;

  return results.filter(r => r.similarity >= minSimilarity);
}

/**
 * Find similar rules from other sites that might apply to a new field.
 */
export async function findSimilarRules(
  queryText: string,
  options?: {
    limit?: number;
    minSimilarity?: number;
    excludeHostname?: string;
  },
): Promise<
  Array<{
    id: string;
    hostname: string;
    stableSelector: string;
    action: string;
    actionType: string;
    fieldLabel: string | null;
    reason: string | null;
    confidence: number;
    similarity: number;
  }>
> {
  const embedding = await generateEmbedding(queryText);
  const limit = options?.limit ?? 5;
  const minSimilarity = options?.minSimilarity ?? 0.75;
  const excludeHostname = options?.excludeHostname ?? '';

  const results = await db.$queryRaw<
    Array<{
      id: string;
      hostname: string;
      stableSelector: string;
      action: string;
      actionType: string;
      fieldLabel: string | null;
      reason: string | null;
      confidence: number;
      similarity: number;
    }>
  >`
    SELECT
      id,
      hostname,
      "stableSelector" as "stableSelector",
      action,
      "actionType" as "actionType",
      "fieldLabel" as "fieldLabel",
      reason,
      confidence,
      1 - ("embedding" <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM "ATSRule"
    WHERE "embedding" IS NOT NULL
      AND enabled = true
      AND (${excludeHostname} = '' OR hostname != ${excludeHostname})
    ORDER BY "embedding" <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit}
  `;

  return results.filter(r => r.similarity >= minSimilarity);
}
