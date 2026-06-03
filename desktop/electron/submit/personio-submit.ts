/**
 * Personio submit runner. Personio hosts at `jobs.personio.com/<company>`
 * and `<company>.jobs.personio.com`. Application forms use Rails-style
 * bracketed names: `job_application[first_name]`, `[last_name]`, `[email]`,
 * `[phone]`, `[recent_job]` etc.
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

const PERSONIO_OVERRIDES: GenericSubmitProviderOverrides = {
  providerLabel: 'Personio',
  identitySelectors: {
    firstName: [
      'input[name="job_application[first_name]"]',
      'input#first_name',
    ],
    lastName: [
      'input[name="job_application[last_name]"]',
      'input#last_name',
    ],
    email: [
      'input[name="job_application[email]"]',
      'input#email',
      'input[type="email"]',
    ],
    phone: [
      'input[name="job_application[phone]"]',
      'input#phone',
      'input[type="tel"]',
    ],
  },
  resumeFileSelectors: [
    'input[name="job_application[document_data]"][type="file"]',
    'input[name*="resume" i][type="file"]',
    'input[name*="document" i][type="file"]',
    'input[type="file"][accept*="pdf"]',
  ],
  submitButtonSelectors: [
    'button[type="submit"][data-test-id*="apply" i]',
    'button[type="submit"]',
  ],
};

export async function runPersonioSubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  return runGenericSubmitLead(registry, request, {
    ...options,
    providerOverrides: PERSONIO_OVERRIDES,
  });
}

export function isPersonioApplicationUrl(url: string): boolean {
  return /(?:jobs\.personio\.com|\.jobs\.personio\.com)/i.test(url);
}
