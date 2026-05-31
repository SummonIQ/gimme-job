import { load } from 'cheerio';

import { db } from '@/lib/db/client';

/**
 * Baseline patterns that reliably indicate a submitted application was
 * accepted by the ATS. The learning module (below) grows a per-hostname
 * corpus on top of this baseline — but this set gives us coverage on day 1
 * before any training has happened.
 */
const SUBMISSION_CONFIRMATION_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
}> = [
  {
    pattern: /\b(thanks?|thank you)\b[^.!?]{0,40}\bfor\b[^.!?]{0,40}\b(apply|applying|application|interest)\b/i,
    reason: 'Thank-you confirmation message.',
  },
  {
    pattern: /\b(we('| ha)ve\s+(received|got))\b[^.!?]{0,40}\b(application|submission)\b/i,
    reason: 'Application received confirmation.',
  },
  {
    pattern: /\byour\s+application\s+has\s+been\s+(submitted|received|sent)\b/i,
    reason: 'Application submitted confirmation.',
  },
  {
    pattern: /\b(application|submission)\s+(complete|successful|confirmed|received)\b/i,
    reason: 'Submission completion confirmation.',
  },
  {
    pattern: /\bwe('| wi)ll\s+(be\s+)?(review(ing)?|in\s+touch|contact\s+you)\b/i,
    reason: 'Follow-up-promise confirmation.',
  },
  {
    pattern: /\bapplication\s+id\s*[:#]\s*[A-Z0-9-]+/i,
    reason: 'Application ID issued.',
  },
];

function normalizePageText(html: string): string {
  try {
    const $ = load(html);
    return $('body').text().replace(/\s+/g, ' ').trim();
  } catch {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
}

export interface SubmissionConfirmationDetection {
  reason: string;
  matchedPhrase: string;
  contextSnippet: string;
}

export function detectSubmissionConfirmation(
  html: string,
): SubmissionConfirmationDetection | null {
  const pageText = normalizePageText(html);

  for (const entry of SUBMISSION_CONFIRMATION_PATTERNS) {
    const match = pageText.match(entry.pattern);
    if (match) {
      const [matchedPhrase] = match;
      const idx = match.index ?? pageText.indexOf(matchedPhrase);
      const start = Math.max(0, idx - 60);
      const end = Math.min(pageText.length, idx + matchedPhrase.length + 60);
      return {
        reason: entry.reason,
        matchedPhrase,
        contextSnippet: pageText.slice(start, end).trim(),
      };
    }
  }

  return null;
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

interface RecordSubmissionConfirmationInput {
  hostname: string;
  atsSystemId?: string | null;
  phrase: string;
  exampleUrl?: string | null;
}

/**
 * Persist a phrase that confirmed a successful application submission.
 * Used to grow a per-hostname corpus so auto-submit can detect the
 * positive terminal state reliably.
 */
export async function recordSubmissionConfirmationPhrase({
  hostname,
  atsSystemId,
  phrase,
  exampleUrl,
}: RecordSubmissionConfirmationInput): Promise<void> {
  const trimmedHost = hostname.trim().toLowerCase();
  if (!trimmedHost) return;

  const original = phrase.replace(/\s+/g, ' ').trim().slice(0, MAX_PHRASE_LENGTH);
  const normalized = normalizePhrase(original);
  if (normalized.length < MIN_PHRASE_LENGTH) return;

  try {
    await db.submissionConfirmationPhrase.upsert({
      where: {
        hostname_normalizedPhrase: {
          hostname: trimmedHost,
          normalizedPhrase: normalized,
        },
      },
      create: {
        hostname: trimmedHost,
        atsSystemId: atsSystemId ?? null,
        normalizedPhrase: normalized,
        originalPhrase: original,
        exampleUrl: exampleUrl ?? null,
      },
      update: {
        observationCount: { increment: 1 },
        lastObservedAt: new Date(),
        ...(exampleUrl ? { exampleUrl } : {}),
        ...(atsSystemId ? { atsSystemId } : {}),
      },
    });
  } catch (error) {
    console.warn('[SubmissionConfirmation] Failed to record phrase:', error);
  }
}

export async function getLearnedSubmissionConfirmationPhrases({
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
    return await db.submissionConfirmationPhrase.findMany({
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
    console.warn('[SubmissionConfirmation] Failed to load phrases:', error);
    return [];
  }
}
