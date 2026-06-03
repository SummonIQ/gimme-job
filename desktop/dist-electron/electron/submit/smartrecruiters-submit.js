/**
 * SmartRecruiters submit runner. Hosted on `jobs.smartrecruiters.com/<company>/<id>`.
 * Identity fields use camelCase ids/names:
 *   - input#firstName  / input[name="firstName"]
 *   - input#lastName   / input[name="lastName"]
 *   - input#email      / input[name="email"]
 *   - input#phoneNumber / input[name="phoneNumber"]
 *   - input[type="file"][accept*="pdf"] for resume
 *
 * Submit CTA: `button[type="submit"]` with text "Apply now" / "Submit".
 */
import { runGenericSubmitLead, } from './generic-submit.js';
const SMARTRECRUITERS_OVERRIDES = {
    providerLabel: 'SmartRecruiters',
    identitySelectors: {
        firstName: [
            'input#firstName',
            'input[name="firstName"]',
            'input[data-test-id="firstName"]',
        ],
        lastName: [
            'input#lastName',
            'input[name="lastName"]',
            'input[data-test-id="lastName"]',
        ],
        email: [
            'input#email',
            'input[name="email"]',
            'input[type="email"]',
        ],
        phone: [
            'input#phoneNumber',
            'input[name="phoneNumber"]',
            'input[type="tel"]',
        ],
    },
    resumeFileSelectors: [
        'input[name="resume"][type="file"]',
        'input[data-test-id="resume-upload"]',
        'input[type="file"][accept*="pdf"]',
    ],
    submitButtonSelectors: [
        'button[type="submit"][data-test-id*="apply" i]',
        'button[type="submit"][data-test-id*="submit" i]',
        'button[type="submit"]',
    ],
};
export async function runSmartRecruitersSubmitLead(registry, request, options = {}) {
    return runGenericSubmitLead(registry, request, {
        ...options,
        providerOverrides: SMARTRECRUITERS_OVERRIDES,
    });
}
export function isSmartRecruitersApplicationUrl(url) {
    return /jobs\.smartrecruiters\.com/i.test(url);
}
