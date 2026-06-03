/**
 * Jobvite submit runner. Jobvite jobs live at `jobs.jobvite.com/<company>`
 * and `careers.jobvite.com/<company>`. Forms use camelCase ids.
 *
 * The Jobvite submit CTA is sometimes an `<input type="submit">` rather
 * than a `<button>`, so the override list includes both.
 */
import {
  runGenericSubmitLead,
  type GenericSubmitProviderOverrides,
} from './generic-submit.js';
import type {
  DesktopSubmitLeadRequest,
  DesktopSubmitLeadResult,
} from './greenhouse-submit.js';
import type { DesktopToolRegistry } from '../tools/registry.js';

const JOBVITE_OVERRIDES: GenericSubmitProviderOverrides = {
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

export async function runJobviteSubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  return runGenericSubmitLead(registry, request, {
    ...options,
    providerOverrides: JOBVITE_OVERRIDES,
  });
}

export function isJobviteApplicationUrl(url: string): boolean {
  return /(?:jobs|careers)\.jobvite\.com/i.test(url);
}
