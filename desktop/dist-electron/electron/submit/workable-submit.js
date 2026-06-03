/**
 * Workable submit runner. Workable hosts both `*.workable.com/jobs/*` and
 * `apply.workable.com/*` flows. Identity fields use stable id/name pairs:
 *   - input#firstname / input[name="firstname"]
 *   - input#lastname  / input[name="lastname"]
 *   - input#email     / input[name="email"]
 *   - input#phone     / input[name="phone"]
 *   - input#resume    / input[name="resume"] (file)
 *
 * Submit CTA: `button[type="submit"][data-ui="submit-application"]`
 * with text "Submit application".
 */
import { runGenericSubmitLead, } from './generic-submit.js';
const WORKABLE_OVERRIDES = {
    providerLabel: 'Workable',
    identitySelectors: {
        firstName: [
            'input#firstname',
            'input[name="firstname"]',
            'input[data-ui="first-name"]',
        ],
        lastName: [
            'input#lastname',
            'input[name="lastname"]',
            'input[data-ui="last-name"]',
        ],
        email: [
            'input#email',
            'input[name="email"]',
            'input[type="email"]',
        ],
        phone: [
            'input#phone',
            'input[name="phone"]',
            'input[type="tel"]',
        ],
    },
    resumeFileSelectors: [
        'input[name="resume"][type="file"]',
        'input#resume',
        'input[type="file"][accept*="pdf"]',
    ],
    submitButtonSelectors: [
        'button[type="submit"][data-ui="submit-application"]',
        'button[data-ui="submit-application"]',
        'button[type="submit"]',
    ],
};
export async function runWorkableSubmitLead(registry, request, options = {}) {
    return runGenericSubmitLead(registry, request, {
        ...options,
        providerOverrides: WORKABLE_OVERRIDES,
    });
}
export function isWorkableApplicationUrl(url) {
    return /(?:apply\.workable\.com|workable\.com\/jobs)/i.test(url);
}
