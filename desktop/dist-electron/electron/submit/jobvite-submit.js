/**
 * Jobvite submit runner. Jobvite jobs live at `jobs.jobvite.com/<company>`
 * and `careers.jobvite.com/<company>`. Forms use camelCase ids.
 *
 * The Jobvite submit CTA is sometimes an `<input type="submit">` rather
 * than a `<button>`, so the override list includes both.
 */
import { runGenericSubmitLead, } from './generic-submit.js';
const JOBVITE_OVERRIDES = {
    providerLabel: 'Jobvite',
    identitySelectors: {
        firstName: [
            'input#firstName',
            'input[name="firstName"]',
            'input[name="first_name"]',
        ],
        lastName: [
            'input#lastName',
            'input[name="lastName"]',
            'input[name="last_name"]',
        ],
        email: [
            'input#eMailAddr',
            'input#email',
            'input[name="eMailAddr"]',
            'input[name="email"]',
            'input[type="email"]',
        ],
        phone: [
            'input#homePhone',
            'input#phone',
            'input[name="homePhone"]',
            'input[name="phone"]',
            'input[type="tel"]',
        ],
    },
    resumeFileSelectors: [
        'input#resume',
        'input[name="resume"][type="file"]',
        'input[name="jvResume"][type="file"]',
        'input[type="file"][accept*="pdf"]',
    ],
    submitButtonSelectors: [
        'input[type="submit"][value*="Submit" i]',
        'input[type="submit"][value*="Apply" i]',
        'button[type="submit"]',
        'input[type="submit"]',
    ],
};
export async function runJobviteSubmitLead(registry, request, options = {}) {
    return runGenericSubmitLead(registry, request, {
        ...options,
        providerOverrides: JOBVITE_OVERRIDES,
    });
}
export function isJobviteApplicationUrl(url) {
    return /(?:jobs|careers)\.jobvite\.com/i.test(url);
}
