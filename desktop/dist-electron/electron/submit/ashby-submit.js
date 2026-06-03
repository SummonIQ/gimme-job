/**
 * Ashby submit runner. Ashby's job-board pages (`jobs.ashbyhq.com/*`) are
 * single-page React apps that expose stable system-field names — we hit
 * those directly for identity fills and fall through to the shared
 * generic runner for everything else (custom questions, demographics,
 * confirmation detection).
 *
 * System fields seen in practice on Ashby application pages:
 *   - input[name="_systemfield_name"]      — full name (single field)
 *   - input[name="_systemfield_email"]
 *   - input[name="_systemfield_phone"]
 *   - input[name="_systemfield_resume"]    — resume file input
 *   - input[name="_systemfield_location"]  — typeahead, handled by LLM
 *
 * Submit CTA is `button[type="submit"]` with text "Submit Application".
 */
import { runGenericSubmitLead, } from './generic-submit.js';
const ASHBY_OVERRIDES = {
    providerLabel: 'Ashby',
    identitySelectors: {
        fullName: [
            'input[name="_systemfield_name"]',
            'input#_systemfield_name',
        ],
        firstName: [
            'input[name="firstName"]',
            'input[name="first_name"]',
        ],
        lastName: [
            'input[name="lastName"]',
            'input[name="last_name"]',
        ],
        email: [
            'input[name="_systemfield_email"]',
            'input#_systemfield_email',
            'input[type="email"]',
        ],
        phone: [
            'input[name="_systemfield_phone"]',
            'input#_systemfield_phone',
            'input[type="tel"]',
        ],
    },
    resumeFileSelectors: [
        'input[name="_systemfield_resume"][type="file"]',
        'input#_systemfield_resume',
        'input[type="file"][accept*="pdf"]',
    ],
    submitButtonSelectors: [
        'button[type="submit"][data-testid*="submit" i]',
        'button[type="submit"]',
    ],
};
export async function runAshbySubmitLead(registry, request, options = {}) {
    return runGenericSubmitLead(registry, request, {
        ...options,
        providerOverrides: ASHBY_OVERRIDES,
    });
}
export function isAshbyApplicationUrl(url) {
    return /(?:jobs|job-boards)\.ashbyhq\.com/i.test(url);
}
