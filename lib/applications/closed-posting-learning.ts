import { db } from '@/lib/db/client';

interface RecordClosedPostingPhraseInput {
  hostname: string;
  /** The raw text snippet that triggered the closed-posting detection. */
  phrase: string;
  /** Why the detector flagged this (from the matched rule). */
  detectorReason?: string | null;
  /** An example URL where the phrase appeared. */
  exampleUrl?: string | null;
}

const MIN_PHRASE_LENGTH = 8;
const MAX_PHRASE_LENGTH = 280;

function normalizePhrase(phrase: string): string {
  return phrase
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/**
 * Persist a phrase that indicates a job posting is no longer available.
 * Used to grow a corpus of expiration/closed-posting signals per hostname —
 * kept intentionally separate from the AI-assist rule-learning pipeline.
 */
export async function recordClosedPostingPhrase({
  hostname,
  phrase,
  detectorReason,
  exampleUrl,
}: RecordClosedPostingPhraseInput): Promise<void> {
  const trimmedHost = hostname.trim().toLowerCase();
  if (!trimmedHost) return;

  const original = phrase.replace(/\s+/g, ' ').trim().slice(0, MAX_PHRASE_LENGTH);
  const normalized = normalizePhrase(original);
  if (normalized.length < MIN_PHRASE_LENGTH) return;

  try {
    await db.closedPostingPhrase.upsert({
      where: {
        hostname_normalizedPhrase: {
          hostname: trimmedHost,
          normalizedPhrase: normalized,
        },
      },
      create: {
        hostname: trimmedHost,
        normalizedPhrase: normalized,
        originalPhrase: original,
        detectorReason: detectorReason ?? null,
        exampleUrl: exampleUrl ?? null,
      },
      update: {
        observationCount: { increment: 1 },
        lastObservedAt: new Date(),
        // Refresh example/reason when we see a new one to keep the record current.
        ...(exampleUrl ? { exampleUrl } : {}),
        ...(detectorReason ? { detectorReason } : {}),
      },
    });
  } catch (error) {
    console.warn('[ClosedPostingLearning] Failed to record phrase:', error);
  }
}

/**
 * Fetch all learned phrases for a hostname (or globally) so downstream
 * consumers — e.g. job listing scrapers, expiration checks — can match
 * incoming pages against the learned corpus.
 */
export async function getLearnedClosedPostingPhrases({
  hostname,
  limit = 200,
}: {
  hostname?: string;
  limit?: number;
} = {}): Promise<
  Array<{
    hostname: string;
    normalizedPhrase: string;
    originalPhrase: string;
    observationCount: number;
  }>
> {
  const where = hostname
    ? { hostname: hostname.trim().toLowerCase() }
    : undefined;
  try {
    return await db.closedPostingPhrase.findMany({
      where,
      orderBy: { observationCount: 'desc' },
      take: limit,
      select: {
        hostname: true,
        normalizedPhrase: true,
        originalPhrase: true,
        observationCount: true,
      },
    });
  } catch (error) {
    console.warn('[ClosedPostingLearning] Failed to load phrases:', error);
    return [];
  }
}

export { normalizePhrase };
