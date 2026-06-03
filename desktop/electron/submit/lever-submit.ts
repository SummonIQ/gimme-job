/**
 * Lever submit runner. Lever job posts live at `jobs.lever.co/<company>/<id>`
 * and the application form mounts under `/apply` on the same host. Lever
 * uses simple, stable input names — `name`, `email`, `phone`, `org`,
 * `resume` — which we target directly before falling back to label
 * heuristics.
 *
 * Submit CTA: `button[type="submit"]` with text "Submit application".
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

const LEVER_OVERRIDES: GenericSubmitProviderOverrides = {
  providerLabel: 'Lever',
  identitySelectors: {
    // Lever's primary application form uses a single "name" input rather
    // than first/last; some custom forms add explicit firstName/lastName.
    fullName: [
      'input[name="name"]:not([type="hidden"])',
      'input#name',
    ],
    firstName: [
      'input[name="firstName"]',
      'input[name="first_name"]',
    ],
    lastName: [
      'input[name="lastName"]',
      'input[name="last_name"]',
    ],
    email: ['input[name="email"]', 'input[type="email"]'],
    phone: ['input[name="phone"]', 'input[type="tel"]'],
  },
  resumeFileSelectors: [
    'input[name="resume"][type="file"]',
    'input#resume-upload-input',
    'input[type="file"][accept*="pdf"]',
  ],
  submitButtonSelectors: [
    'button[type="submit"][data-qa="btn-submit"]',
    'button#btn-submit',
    'button[type="submit"]',
  ],
};

export async function runLeverSubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  const applicationUrl = getLeverApplyUrl(request.applicationUrl);
  return runGenericSubmitLead(registry, { ...request, applicationUrl }, {
    ...options,
    providerOverrides: LEVER_OVERRIDES,
  });
}

export function isLeverApplicationUrl(url: string): boolean {
  return /jobs\.lever\.co/i.test(url);
}

export function getLeverApplyUrl(url: string): string {
  if (!isLeverApplicationUrl(url)) return url;
  try {
    const parsed = new URL(url);
    if (/\/apply\/?$/i.test(parsed.pathname)) return url;
    parsed.pathname = `${parsed.pathname.replace(/\/+$/, '')}/apply`;
    return parsed.toString();
  } catch {
    return url;
  }
}
