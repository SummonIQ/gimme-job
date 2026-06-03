/**
 * Teamtailor submit runner. Teamtailor hosts at `<company>.teamtailor.com`
 * with applications mounted under `/jobs/<id>/applications/new`. Identity
 * fields use snake_case ids matching their model.
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

const TEAMTAILOR_OVERRIDES: GenericSubmitProviderOverrides = {
  providerLabel: 'Teamtailor',
  identitySelectors: {
    firstName: [
      'input#first_name',
      'input[name="job_application[first_name]"]',
    ],
    lastName: [
      'input#last_name',
      'input[name="job_application[last_name]"]',
    ],
    email: [
      'input#email',
      'input[name="job_application[email]"]',
      'input[type="email"]',
    ],
    phone: [
      'input#phone',
      'input[name="job_application[phone]"]',
      'input[type="tel"]',
    ],
  },
  resumeFileSelectors: [
    'input#cv',
    'input[name="job_application[resume]"][type="file"]',
    'input[name*="resume" i][type="file"]',
    'input[type="file"][accept*="pdf"]',
  ],
  submitButtonSelectors: [
    'button[type="submit"][name="commit"]',
    'button[type="submit"]',
    'input[type="submit"]',
  ],
};

export async function runTeamtailorSubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  return runGenericSubmitLead(registry, request, {
    ...options,
    providerOverrides: TEAMTAILOR_OVERRIDES,
  });
}

export function isTeamtailorApplicationUrl(url: string): boolean {
  return /\.teamtailor\.com/i.test(url);
}
