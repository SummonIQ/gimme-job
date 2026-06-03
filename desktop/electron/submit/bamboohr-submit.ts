/**
 * BambooHR submit runner. BambooHR hosts careers pages at
 * `<company>.bamboohr.com/careers/<id>`. Forms use camelCase ids that
 * mirror their HRIS field names.
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

const BAMBOOHR_OVERRIDES: GenericSubmitProviderOverrides = {
  providerLabel: 'BambooHR',
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
    'input#resume',
    'input[name="resume"][type="file"]',
    'input[type="file"][accept*="pdf"]',
  ],
  submitButtonSelectors: [
    'button[type="submit"][data-test*="submit" i]',
    'button[type="submit"]',
  ],
};

export async function runBambooHrSubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  return runGenericSubmitLead(registry, request, {
    ...options,
    providerOverrides: BAMBOOHR_OVERRIDES,
  });
}

export function isBambooHrApplicationUrl(url: string): boolean {
  return /\.bamboohr\.com\/(?:careers|jobs)/i.test(url);
}
