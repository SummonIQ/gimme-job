import { getRuntimeProviderForUrl } from './provider-registry.js';

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
  readonly url?: string;
}

const GENERIC_CLOSED_POSTING_PHRASES: ReadonlyArray<string> = [
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
  'this job is no longer open',
  'job is no longer accepting candidates',
  'this posting has been filled',
  'this posting is no longer accepting applications',
  'this job posting is no longer active',
  'this position is closed',
  'job not found',
  'requisition not found',
];

const PROVIDER_CLOSED_POSTING_PHRASES: Readonly<
  Record<string, readonly string[]>
> = {
  ashby: [
    'this job posting is no longer active',
    'this role is no longer accepting applications',
    'this job is no longer accepting applications',
    'application submissions are no longer being accepted for this role',
  ],
  bamboohr: [
    'this job posting is no longer available',
    'this opening is no longer available',
    'this position is no longer available',
    'this job is no longer open',
  ],
  breezy: [
    'this position is no longer accepting applications',
    'this position has been closed',
    'this job is no longer accepting applications',
    'this opening is no longer available',
  ],
  greenhouse: GENERIC_CLOSED_POSTING_PHRASES,
  jobvite: [
    'the job you are looking for is no longer open',
    'this job is no longer available',
    'this requisition is no longer accepting applications',
    'this position is no longer available',
  ],
  lever: [
    'this job posting is no longer active',
    'this job is no longer available',
    'this posting is no longer accepting applications',
    'this position has been closed',
  ],
  personio: [
    'this job is no longer available',
    'this position is no longer available',
    'this job ad is no longer online',
    'this job posting is no longer active',
  ],
  recruitee: [
    'this job is no longer available',
    'this job opening is no longer available',
    'this offer has been archived',
    'this vacancy is no longer available',
  ],
  smartrecruiters: [
    'this job is no longer accepting applications',
    'this job is no longer available',
    'this posting is no longer active',
    'this position is no longer accepting applications',
  ],
  teamtailor: [
    'this job is no longer available',
    'this position is no longer available',
    'this job opening is no longer available',
    'this role is no longer accepting applications',
  ],
  workable: [
    'this job is no longer accepting applications',
    'this job is no longer available',
    'this job posting is no longer available',
    'this position is no longer accepting applications',
  ],
};

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

const CLOSED_POSTING_MARKERS: ReadonlyArray<string> = [
  '[data-closed-posting]',
  '[data-posting-closed="true"]',
  '[data-state="closed"]',
];

export function detectClosedPosting(
  snapshot: ClosedPostingSnapshot,
): ClosedPostingVerdict {
  const haystack = `${snapshot.title}\n${snapshot.html}`.toLowerCase();
  const providerId = snapshot.url
    ? getRuntimeProviderForUrl(snapshot.url).id
    : 'greenhouse';
  const providerPhrases = PROVIDER_CLOSED_POSTING_PHRASES[providerId] ?? [];

  for (const phrase of providerPhrases) {
    if (haystack.includes(phrase)) {
      return {
        closed: true,
        detectedPhrase: phrase,
        reason: 'closed_posting_copy',
      };
    }
  }

  for (const phrase of GENERIC_CLOSED_POSTING_PHRASES) {
    if (haystack.includes(phrase)) {
      return {
        closed: true,
        detectedPhrase: phrase,
        reason: 'closed_posting_copy',
      };
    }
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
