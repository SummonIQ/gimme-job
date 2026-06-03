/**
 * iCIMS submit runner. iCIMS hosts at `jobs-<tenant>.icims.com` and
 * `careers-<tenant>.icims.com`. The newer iCIMS Apply experience renders
 * the form on a single page; older tenants still use a frame-based
 * multi-step flow that's similar in spirit to Workday.
 *
 * Identity field naming on iCIMS Apply:
 *   - input[name="firstname"] / input[id*="firstname"]
 *   - input[name="lastname"]
 *   - input[name="email"]
 *   - input[name="phone"] (some tenants use cellPhone / homePhone)
 *   - input[name*="resume"][type="file"]
 *
 * Submit CTA: `button[type="submit"]` with text "Submit" or "Apply".
 * Older iCIMS uses `input[type="submit"]` with `name="continue"` instead.
 *
 * The runner detects whether we're on the form page or a navigation /
 * disclaimer page and routes accordingly.
 */
import { parse } from 'node-html-parser';

import {
  createClaudeAgentSdkRuntime,
  type LocalClaudeAgentSdkSession,
} from '../agent/claude-agent-sdk.js';
import { createDesktopAgentSession } from '../agent/session.js';
import type {
  DesktopAgentRuntimeInput,
  DesktopAgentRuntimeResult,
} from '../agent/types.js';
import type { DesktopToolRegistry } from '../tools/registry.js';

import { dismissCommonOverlays } from './dismiss-overlays.js';
import {
  call,
  failed,
  loadRequiredIdentity,
  readDomSnapshotHtml,
  readDomSnapshotTitle,
  resolveRemainingFieldsWithLlm,
  setCurrentRunSignal,
  sleep,
  waitForSubmissionConfirmation,
  type DesktopSubmitLeadRequest,
  type DesktopSubmitLeadResult,
} from './greenhouse-submit.js';

const ICIMS_FORM_INDICATOR_SELECTORS: readonly string[] = [
  'input[name="firstname"]',
  'input[id*="firstname" i]',
  'input[id*="iCIMS_FirstName" i]',
  'form[id*="apply" i]',
];

const ICIMS_DISCLAIMER_AGREE_SELECTORS: readonly string[] = [
  'button[name*="agree" i]',
  'input[name*="agree" i]',
  'button[id*="continue" i]',
  'input[type="submit"][value*="Continue" i]',
  'input[type="submit"][value*="I Agree" i]',
];

const ICIMS_SUBMIT_SELECTORS: readonly string[] = [
  'button[type="submit"][data-test*="submit" i]',
  'input[type="submit"][value*="Submit" i]',
  'input[type="submit"][value*="Apply" i]',
  'button[type="submit"]',
  'input[type="submit"]',
];

const ICIMS_IDENTITY_SELECTORS = {
  firstName: [
    'input[name="firstname"]',
    'input[id*="iCIMS_FirstName" i]',
    'input[id*="firstName" i]',
  ],
  lastName: [
    'input[name="lastname"]',
    'input[id*="iCIMS_LastName" i]',
    'input[id*="lastName" i]',
  ],
  email: [
    'input[name="email"]',
    'input[id*="iCIMS_Email" i]',
    'input[type="email"]',
  ],
  phone: [
    'input[name="phone"]',
    'input[name="cellPhone"]',
    'input[name="homePhone"]',
    'input[type="tel"]',
  ],
  resume: [
    'input[name*="resume" i][type="file"]',
    'input[id*="iCIMS_Resume" i]',
    'input[type="file"][accept*="pdf"]',
    'input[type="file"]',
  ],
};

const MAX_STEP_ITERATIONS = 10;

export async function runIcimsSubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  const session = createDesktopAgentSession(registry, {
    mode: request.mode,
    runtime: createClaudeAgentSdkRuntime(createIcimsRuntime(request)),
  });
  const result = await session.run({
    objective: `Run ${request.mode} desktop iCIMS submission: ${request.applicationUrl}`,
    signal: options.signal,
  });

  return {
    applicationUrl: request.applicationUrl,
    executionEnvironment: 'DESKTOP_CDP',
    jobLeadId: request.jobLeadId,
    message: result.message,
    mode: result.mode,
    status: result.status,
    toolCalls: result.events.map(event => ({
      errorMessage: event.result.error?.message,
      input: undefined,
      ok: event.result.ok,
      reason: event.reason,
      selector: undefined,
      tool: event.tool,
    })),
  };
}

export function isIcimsApplicationUrl(url: string): boolean {
  return /\.icims\.com/i.test(url);
}

function createIcimsRuntime(
  request: DesktopSubmitLeadRequest,
): LocalClaudeAgentSdkSession {
  return {
    async run(input) {
      setCurrentRunSignal(input.signal);
      try {
        return await runIcimsRuntime(request, input);
      } finally {
        setCurrentRunSignal(undefined);
      }
    },
  };
}

async function runIcimsRuntime(
  request: DesktopSubmitLeadRequest,
  input: DesktopAgentRuntimeInput,
): Promise<DesktopAgentRuntimeResult> {
  if (!request.continueFromCurrentPage) {
    const navigateResult = await call(
      input,
      'navigate',
      { url: request.applicationUrl },
      'open iCIMS application page',
    );
    if (!navigateResult.ok) return failed(navigateResult);
  }

  const overlaysDismissed = await dismissCommonOverlays(input, call);
  if (overlaysDismissed > 0) {
    console.log(
      `[icims-submit] dismissed ${overlaysDismissed} consent overlay(s)`,
    );
  }

  const identity = await loadRequiredIdentity(input);
  if ('status' in identity) return identity;

  let resumeFilePath = identity.resumePdfPath;
  if (request.prepareTailoredResume) {
    try {
      const tailored = await request.prepareTailoredResume();
      if (tailored) resumeFilePath = tailored;
    } catch (error) {
      console.warn('[icims-submit] tailored resume prep failed:', error);
    }
  }

  const attemptedSelectors = new Set<string>();
  let formReached = false;

  for (let iteration = 0; iteration < MAX_STEP_ITERATIONS; iteration += 1) {
    await sleep(1000);
    const snapshot = await call(
      input,
      'dom_snapshot',
      {},
      `iCIMS step (${iteration + 1})`,
    );
    if (!snapshot.ok) return failed(snapshot);
    const html = readDomSnapshotHtml(snapshot.data);
    const title = readDomSnapshotTitle(snapshot.data);
    if (!html) {
      return {
        message: 'Empty DOM snapshot during iCIMS run.',
        status: 'failed',
      };
    }
    const root = parse(html);

    const onForm = ICIMS_FORM_INDICATOR_SELECTORS.some(selector => {
      try {
        return Boolean(root.querySelector(selector));
      } catch {
        return false;
      }
    });

    if (onForm) {
      formReached = true;
      break;
    }

    // Not on the form yet — try to click through any disclaimer / agree
    // page that older iCIMS tenants use as a gate.
    const advanced = await clickFirstMatching(
      input,
      ICIMS_DISCLAIMER_AGREE_SELECTORS,
      root,
    );
    if (!advanced) {
      // Check title — some tenants land us straight on a confirmation
      // page if the user already applied.
      if (title && /already\s+applied|thank\s+you/i.test(title)) {
        return {
          message:
            'iCIMS reports candidate already applied (or post-confirmation page detected).',
          status: 'completed',
        };
      }
      return {
        message:
          'iCIMS landed on an unrecognized page (no form, no disclaimer). Open the page manually.',
        status: 'paused_for_manual_review',
      };
    }
  }

  if (!formReached) {
    return {
      message: 'iCIMS wizard did not reach the application form within step limit.',
      status: 'failed',
    };
  }

  // Identity fills.
  await fillBySelectors(input, ICIMS_IDENTITY_SELECTORS.firstName, identity.firstName, 'iCIMS first name', attemptedSelectors);
  await fillBySelectors(input, ICIMS_IDENTITY_SELECTORS.lastName, identity.lastName, 'iCIMS last name', attemptedSelectors);
  await fillBySelectors(input, ICIMS_IDENTITY_SELECTORS.email, identity.email, 'iCIMS email', attemptedSelectors);
  await fillBySelectors(input, ICIMS_IDENTITY_SELECTORS.phone, identity.phone, 'iCIMS phone', attemptedSelectors);

  // Resume upload.
  for (const selector of ICIMS_IDENTITY_SELECTORS.resume) {
    const result = await call(
      input,
      'upload',
      { filePath: resumeFilePath, selector },
      'iCIMS resume upload',
    );
    if (result.ok) {
      attemptedSelectors.add(selector);
      break;
    }
  }

  // Multi-pass LLM fallback for everything else.
  if (request.resolveUnknownFieldAnswer) {
    for (let pass = 0; pass < 4; pass += 1) {
      const before = attemptedSelectors.size;
      await resolveRemainingFieldsWithLlm(
        input,
        request.resolveUnknownFieldAnswer,
        attemptedSelectors,
        request.aiProvider,
        request.lookupRecentVerificationCode,
      );
      if (attemptedSelectors.size === before) break;
      await sleep(300);
    }
  }

  if (request.mode !== 'submit') {
    return {
      message: 'Training run completed on iCIMS form (submit not clicked).',
      status: 'completed',
    };
  }

  const submitSnapshot = await call(input, 'dom_snapshot', {}, 'iCIMS submit lookup');
  if (!submitSnapshot.ok) return failed(submitSnapshot);
  const submitHtml = readDomSnapshotHtml(submitSnapshot.data);
  if (!submitHtml) {
    return { message: 'Empty DOM snapshot before iCIMS submit click.', status: 'failed' };
  }

  const submitRoot = parse(submitHtml);
  const submitClicked = await clickFirstMatching(input, ICIMS_SUBMIT_SELECTORS, submitRoot);
  if (!submitClicked) {
    return {
      message: 'iCIMS form filled but no submit/apply button was found.',
      status: 'validation_failed',
    };
  }

  const confirmation = await waitForSubmissionConfirmation(input);
  if (!confirmation.confirmed) {
    return {
      message: `iCIMS submit fired but no confirmation page within ${confirmation.timeoutMs}ms.${
        confirmation.diagnostic ? ` ${confirmation.diagnostic}` : ''
      }`,
      status: 'confirmation_timeout',
    };
  }
  return {
    message: 'iCIMS submission confirmed.',
    status: 'completed',
  };
}

async function fillBySelectors(
  input: DesktopAgentRuntimeInput,
  selectors: readonly string[],
  value: string,
  reason: string,
  attemptedSelectors: Set<string>,
): Promise<void> {
  for (const selector of selectors) {
    if (attemptedSelectors.has(selector)) return;
    const result = await call(input, 'fill', { selector, value }, reason);
    if (result.ok) {
      attemptedSelectors.add(selector);
      return;
    }
  }
}

async function clickFirstMatching(
  input: DesktopAgentRuntimeInput,
  selectors: readonly string[],
  root: ReturnType<typeof parse>,
): Promise<boolean> {
  for (const selector of selectors) {
    let exists: ReturnType<typeof root.querySelector> | null = null;
    try {
      exists = root.querySelector(selector);
    } catch {
      exists = null;
    }
    if (!exists) continue;
    const result = await call(
      input,
      'click',
      { selector },
      `iCIMS click ${selector}`,
    );
    if (result.ok) return true;
  }
  return false;
}
