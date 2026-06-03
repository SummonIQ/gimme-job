/**
 * Recruitee submit runner. Recruitee jobs live at
 * `<company>.recruitee.com/o/<id>` or `apply.recruitee.com/o/<id>` and use
 * Rails-style bracketed field names: `candidate[name]`, `candidate[email]`,
 * `candidate[phone]`, `candidate[resume]`.
 *
 * Recruitee has a single-name field by default, no separate first/last.
 */
import { runGenericSubmitLead, } from './generic-submit.js';
const RECRUITEE_OVERRIDES = {
    providerLabel: 'Recruitee',
    identitySelectors: {
        fullName: [
            'input[name="candidate[name]"]',
            'input#candidate_name',
        ],
        firstName: [
            'input[name="candidate[first_name]"]',
            'input#candidate_first_name',
        ],
        lastName: [
            'input[name="candidate[last_name]"]',
            'input#candidate_last_name',
        ],
        email: [
            'input[name="candidate[email]"]',
            'input#candidate_email',
            'input[type="email"]',
        ],
        phone: [
            'input[name="candidate[phone]"]',
            'input#candidate_phone',
            'input[type="tel"]',
        ],
    },
    resumeFileSelectors: [
        'input[name="candidate[resume]"][type="file"]',
        'input#candidate_resume',
        'input[type="file"][accept*="pdf"]',
    ],
    submitButtonSelectors: [
        'button[type="submit"][data-recruitee*="apply" i]',
        'button[type="submit"]',
    ],
};
export async function runRecruiteeSubmitLead(registry, request, options = {}) {
    return runGenericSubmitLead(registry, request, {
        ...options,
        providerOverrides: RECRUITEE_OVERRIDES,
    });
}
export function isRecruiteeApplicationUrl(url) {
    return /(?:apply\.recruitee\.com|\.recruitee\.com\/o\/)/i.test(url);
}
