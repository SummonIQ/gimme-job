import { load } from 'cheerio';

const CLOSED_POSTING_PATTERNS: Array<{
  pattern: RegExp;
  reason: string;
}> = [
  {
    pattern:
      /\bsorry,\s*this\s+(position|role|job)\s+has\s+been\s+filled\b/i,
    reason: 'This posting appears to be unavailable.',
  },
  {
    pattern:
      /\b(this\s+(position|role|job)\s+has\s+been\s+filled|position\s+has\s+been\s+filled)\b/i,
    reason: 'This posting appears to be unavailable.',
  },
  {
    pattern:
      /\b(no\s+longer\s+accepting\s+applications|is\s+not\s+accepting\s+applications)\b/i,
    reason: 'This posting may no longer be accepting applications.',
  },
  {
    pattern:
      /\b(application\s+is\s+closed|job\s+is\s+closed|posting\s+is\s+closed)\b/i,
    reason: 'This posting appears to be closed.',
  },
  {
    pattern:
      /\b(job\s+has\s+expired|job\s+is\s+expired|posting\s+has\s+expired)\b/i,
    reason: 'This posting appears to be unavailable.',
  },
  {
    pattern:
      /\b(no\s+longer\s+available|posting\s+has\s+been\s+removed|position\s+has\s+been\s+removed)\b/i,
    reason: 'This posting appears to be unavailable.',
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

export function detectClosedPostingMessage(html: string): string | null {
  const pageText = normalizePageText(html);

  for (const entry of CLOSED_POSTING_PATTERNS) {
    if (entry.pattern.test(pageText)) {
      return entry.reason;
    }
  }

  return null;
}

export interface ClosedPostingDetection {
  reason: string;
  /** The exact text snippet from the page that triggered the match. */
  matchedPhrase: string;
  /** A sentence-sized slice of surrounding context for the captured phrase. */
  contextSnippet: string;
}

/**
 * Like `detectClosedPostingMessage`, but also returns the exact matched
 * phrase and a short context snippet. Used by the closed-posting learning
 * pipeline to capture novel wording variations per hostname.
 */
export function detectClosedPostingMessageDetailed(
  html: string,
): ClosedPostingDetection | null {
  const pageText = normalizePageText(html);

  for (const entry of CLOSED_POSTING_PATTERNS) {
    const match = pageText.match(entry.pattern);
    if (match) {
      const [matchedPhrase] = match;
      const idx = match.index ?? pageText.indexOf(matchedPhrase);
      const start = Math.max(0, idx - 60);
      const end = Math.min(pageText.length, idx + matchedPhrase.length + 60);
      const contextSnippet = pageText.slice(start, end).trim();
      return {
        reason: entry.reason,
        matchedPhrase,
        contextSnippet,
      };
    }
  }

  return null;
}
