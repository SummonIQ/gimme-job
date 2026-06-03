/**
 * BreezyHR submit runner. BreezyHR hosts at `app.breezy.hr/p/<id>` and
 * `<company>.breezy.hr/p/<id>`. Identity fields use camelCase naming.
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

const BREEZY_OVERRIDES: GenericSubmitProviderOverrides = {
  providerLabel: 'BreezyHR',
  identitySelectors: {
    firstName: [
      'input#firstName',
      'input[name="firstName"]',
    ],
    lastName: [
      'input#lastName',
      'input[name="lastName"]',
    ],
    fullName: [
      'input#name',
      'input[name="name"]:not([type="hidden"])',
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
    'input[type="file"][accept*="pdf"]',
  ],
  submitButtonSelectors: [
    'button[type="submit"][data-action*="submit" i]',
    'button[type="submit"]',
  ],
};

export async function runBreezySubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  return runGenericSubmitLead(registry, request, {
    ...options,
    providerOverrides: BREEZY_OVERRIDES,
  });
}

export function isBreezyApplicationUrl(url: string): boolean {
  return /\.breezy\.hr/i.test(url);
}
