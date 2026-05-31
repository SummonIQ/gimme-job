/**
 * Provider-neutral closed-posting detection (P17.5).
 *
 * The original detector lived under `desktop/electron/submit/` and was
 * shaped around Greenhouse-specific phrasing. This file is the shared
 * location every runner should import from. The phrase + DOM-marker
 * sets cover the major ATS providers we ship runners for; provider-
 * specific copy gets added here, not in individual runners.
 *
 * Pure function over a DOM snapshot — no IO, no IPC. Safe to run inside
 * a serverless route or an Electron main-process tick.
 */

export type ClosedPostingReason =
  | 'closed_posting_copy'
  | 'closed_posting_marker'
  | 'embed_410'
  | 'embed_422'
  | 'http_404'
  | 'http_410'
  | 'unknown';

export interface ClosedPostingVerdict {
  readonly closed: boolean;
  readonly detectedPhrase: string | null;
  readonly reason: ClosedPostingReason | null;
}

export interface ClosedPostingSnapshot {
  readonly html: string;
  readonly title: string;
}

/**
 * Phrase-based signals. The list is intentionally curated — adding a
 * substring that overlaps with normal job-posting copy ("position
 * filled" appears in some success-story testimonials) leads to false
 * positives. Each entry should match copy that ONLY appears on a
 * closed-posting page.
 */
const CLOSED_POSTING_PHRASES: ReadonlyArray<string> = [
  // Generic / cross-ATS
  'this position is no longer accepting applications',
  'this position has been closed',
  'this position has been filled',
  'this job is no longer available',
  'this job is no longer accepting applications',
  'this job listing is no longer accepting applications',
  'job posting is no longer available',
  'this requisition is no longer accepting applications',
  'this opening has been filled',
  'the job you are looking for is no longer open',
  'the position you are looking for is no longer available',
  // Ashby
  'this job is no longer open',
  'job is no longer accepting candidates',
  // Lever
  'this posting has been filled',
  'this posting is no longer accepting applications',
  // Workable
  'this job posting is no longer active',
  // SmartRecruiters
  'sorry, this job has expired',
  'this job has expired',
  'this position is closed',
  // Workday
  'job not found',
  'requisition not found',
];

const NOT_FOUND_PHRASES: ReadonlyArray<string> = [
  'page not found',
  '404 not found',
  '404 — not found',
  '404 - not found',
];

const GONE_PHRASES: ReadonlyArray<string> = [
  '410 gone',
  'http 410',
  'this resource is gone',
];

/**
 * DOM markers a host can opt into. The shared runner registry can wire
 * a hostname-specific selector that signals a closed posting (e.g. the
 * "[data-closed-posting]" attribute we instrument on our own
 * fixtures); landing on a page with the marker is treated as
 * authoritative.
 */
const CLOSED_POSTING_MARKERS: ReadonlyArray<string> = [
  '[data-closed-posting]',
  '[data-posting-closed="true"]',
  '[data-state="closed"]',
];

const CLOSED_POSTING_CLASSIFIERS: ReadonlyArray<RegExp> = [
  /\b(?:sorry[, ]+)?(?:this|the|that|a|an)\s+(?:job|position|posting|listing|opening|role|opportunity|requisition|vacancy|job\s+ad|job\s+post)\s+(?:has\s+)?(?:expired|closed)(?![-\w])/i,
  /\b(?:this|the|that|a|an)\s+(?:job|position|posting|listing|opening|role|opportunity|requisition|vacancy|job\s+ad|job\s+post)\s+(?:is|was|has\s+been)\s+(?:closed|filled|archived|removed|deleted|unavailable|inactive)(?![-\w])/i,
  /\b(?:this|the|that|a|an)\s+(?:job|position|posting|listing|opening|role|opportunity|requisition|vacancy|job\s+ad|job\s+post)\s+(?:is|was)\s+no\s+longer\s+(?:available|open|active|accepting(?:\s+applications?)?)\b/i,
  /\b(?:job|position|posting|listing|opening|role|opportunity|requisition|vacancy|job\s+ad|job\s+post)\s+(?:is\s+)?no\s+longer\s+(?:available|open|active|accepting(?:\s+applications?)?)\b/i,
  /\b(?:applications?|submissions?)\s+(?:are|is)\s+no\s+longer\s+(?:being\s+)?accepted\b/i,
  /\b(?:applications?|submissions?)\s+(?:are|is)\s+(?:closed|disabled)\b/i,
  /\b(?:recruitment|hiring|application)\s+(?:period|process|window)\s+(?:has\s+)?(?:ended|closed|expired)(?![-\w])/i,
];

export function detectClosedPosting(
  snapshot: ClosedPostingSnapshot,
): ClosedPostingVerdict {
  const haystack = normalizeClosedPostingText(
    `${snapshot.title}\n${snapshot.html}`,
  );

  for (const phrase of CLOSED_POSTING_PHRASES) {
    if (haystack.includes(phrase)) {
      return {
        closed: true,
        detectedPhrase: phrase,
        reason: 'closed_posting_copy',
      };
    }
  }

  const classifiedPhrase = detectClosedPostingClassifier(haystack);
  if (classifiedPhrase) {
    return {
      closed: true,
      detectedPhrase: classifiedPhrase,
      reason: 'closed_posting_copy',
    };
  }

  for (const phrase of NOT_FOUND_PHRASES) {
    if (haystack.includes(phrase)) {
      return {
        closed: true,
        detectedPhrase: phrase,
        reason: 'http_404',
      };
    }
  }

  for (const phrase of GONE_PHRASES) {
    if (haystack.includes(phrase)) {
      return {
        closed: true,
        detectedPhrase: phrase,
        reason: 'http_410',
      };
    }
  }

  for (const marker of CLOSED_POSTING_MARKERS) {
    // Cheap substring scan — skips the cost of a full DOM parse for
    // the common negative case while still catching attribute markers
    // a host has explicitly opted into.
    if (snapshot.html.includes(marker.replace(/^\[|\]$/g, ''))) {
      return {
        closed: true,
        detectedPhrase: marker,
        reason: 'closed_posting_marker',
      };
    }
  }

  return { closed: false, detectedPhrase: null, reason: null };
}

function detectClosedPostingClassifier(text: string): string | null {
  for (const pattern of CLOSED_POSTING_CLASSIFIERS) {
    const match = text.match(pattern);
    const phrase = match?.[0]?.trim();
    if (phrase) return phrase;
  }
  return null;
}

function normalizeClosedPostingText(value: string): string {
  return value
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
    .toLowerCase()
    .trim();
}
