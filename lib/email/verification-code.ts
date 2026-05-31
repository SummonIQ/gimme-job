/**
 * Detect a one-time verification code in an inbound email.
 *
 * Greenhouse and other ATS platforms email candidates a numeric code
 * (commonly 4-8 digits) as part of identity verification mid-application.
 * The webhook scans the body for this pattern so the desktop submit
 * flow can auto-fill the matching field, and the user gets a toast on
 * the web app with the code ready to copy.
 *
 * The matcher prefers codes that look intentional (preceded by hint
 * words like "code", "verify", "verification") over loose digit runs
 * elsewhere in the body, but falls back to the longest standalone
 * digit run if no hint context is present.
 */

const HINT_PATTERN =
  /(?:verification\s+code|verify\s+(?:your\s+)?(?:identity|email|account)|one[-\s]?time\s+(?:code|password|pin)|security\s+code|confirmation\s+code|access\s+code|sign[-\s]?in\s+code|login\s+code|your\s+code(?:\s+is)?|code\s*:|code\s+is|otp|pin\s+code)/i;

const HINT_CODE_PATTERN =
  /(?:code|otp|pin)[\s\S]{0,80}?(?<![a-z0-9])(?=[a-z0-9]{4,8}(?![a-z0-9]))(?=[a-z0-9]*\d)([a-z0-9]{4,8})(?![a-z0-9])/i;

const STANDALONE_CODE_PATTERN =
  /(?<![a-z0-9])(?=[a-z0-9]{4,8}(?![a-z0-9]))(?=[a-z0-9]*\d)([a-z0-9]{4,8})(?![a-z0-9])/gi;

export interface VerificationCodeMatch {
  readonly code: string;
  readonly digits: number;
  readonly source: 'hint' | 'standalone';
}

function normalizeVerificationText(text: string): string {
  return text
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractVerificationCode(
  text: string | null | undefined,
  subject?: string | null,
): VerificationCodeMatch | null {
  if (!text || text.trim().length === 0) return null;

  const haystack = `${subject ?? ''}\n${normalizeVerificationText(text)}`;
  const hasHint = HINT_PATTERN.test(haystack);

  // Hint-anchored extraction first — if the body literally says
  // "Your verification code is 12345678", grab that exact run.
  const hintMatch = haystack.match(HINT_CODE_PATTERN);
  if (hintMatch && hintMatch[1]) {
    return {
      code: hintMatch[1].toUpperCase(),
      digits: hintMatch[1].length,
      source: 'hint',
    };
  }

  // Without a hint phrase, refuse to match. Random 4-8 digit numbers
  // appear in zip codes, dates, employee IDs, and order numbers — we
  // don't want to push a stale "code" toast for every email that
  // mentions a number.
  if (!hasHint) return null;

  let best: VerificationCodeMatch | null = null;
  for (const match of haystack.matchAll(STANDALONE_CODE_PATTERN)) {
    const code = match[1];
    if (!code) continue;
    if (!best || code.length > best.digits) {
      best = {
        code: code.toUpperCase(),
        digits: code.length,
        source: 'standalone',
      };
    }
  }
  return best;
}
