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
/**
 * Phrase-based signals. The list is intentionally curated — adding a
 * substring that overlaps with normal job-posting copy ("position
 * filled" appears in some success-story testimonials) leads to false
 * positives. Each entry should match copy that ONLY appears on a
 * closed-posting page.
 */
const CLOSED_POSTING_PHRASES = [
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
    'this position is closed',
    // Workday
    'job not found',
    'requisition not found',
];
const NOT_FOUND_PHRASES = [
    'page not found',
    '404 not found',
    '404 — not found',
    '404 - not found',
];
const GONE_PHRASES = [
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
const CLOSED_POSTING_MARKERS = [
    '[data-closed-posting]',
    '[data-posting-closed="true"]',
    '[data-state="closed"]',
];
export function detectClosedPosting(snapshot) {
    const haystack = `${snapshot.title}\n${snapshot.html}`.toLowerCase();
    for (const phrase of CLOSED_POSTING_PHRASES) {
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
