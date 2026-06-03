/**
 * Workday submit runner. Workday job applications live at
 * `<tenant>.myworkdayjobs.com/<region>/<careerSite>/job/<id>` and require
 * navigating a multi-step wizard. Unlike Greenhouse / Ashby / Lever where
 * the entire form is on a single page, Workday gates progress behind
 * "Save and Continue" buttons that move the user through:
 *
 *   1. Account: sign in or create account (some tenants allow Apply as
 *      Anonymous which we prefer when available).
 *   2. My Information: legal name, contact, address, source.
 *   3. My Experience: resume upload, work history, education.
 *   4. Application Questions: per-tenant custom questions.
 *   5. Voluntary Disclosures: gender / race / veteran status.
 *   6. Self Identify (Disability): often a separate page from #5.
 *   7. Review: confirmation page.
 *   8. Submit.
 *
 * The runner detects which step is currently rendered (Workday's heading
 * text + button labels are stable across tenants), fills what it can on
 * that step using the LLM resolver, clicks the appropriate "next" button,
 * and repeats. Account creation is intentionally not auto-completed —
 * Workday uses the user's email as a handle and we don't want to silently
 * register without a clear gesture from the user.
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
  readDomSnapshotUrl,
  resolveRemainingFieldsWithLlm,
  setCurrentRunSignal,
  sleep,
  waitForSubmissionConfirmation,
  type DesktopSubmitLeadRequest,
  type DesktopSubmitLeadResult,
} from './greenhouse-submit.js';

type WorkdayStep =
  | 'sign_in_choice'
  | 'create_account'
  | 'sign_in'
  | 'my_information'
  | 'my_experience'
  | 'application_questions'
  | 'voluntary_disclosures'
  | 'self_identify_disability'
  | 'review'
  | 'submitted'
  | 'unknown';

const STEP_PATTERNS: ReadonlyArray<{ readonly step: WorkdayStep; readonly patterns: readonly RegExp[] }> = [
  {
    step: 'submitted',
    patterns: [
      /you['’]ve\s+successfully\s+submitted/i,
      /thank\s+you\s+for\s+(?:your\s+)?(?:interest|applying)/i,
      /your\s+application\s+(?:has\s+been\s+|is\s+)?submitted/i,
    ],
  },
  {
    step: 'review',
    patterns: [/^review[\s,].*/i, /please\s+review/i],
  },
  {
    step: 'self_identify_disability',
    patterns: [/voluntary\s+self[-\s]?identification\s+of\s+disability/i, /self[-\s]?identify/i],
  },
  {
    step: 'voluntary_disclosures',
    patterns: [/voluntary\s+disclosures/i, /equal\s+employment\s+opportunity/i],
  },
  {
    step: 'application_questions',
    patterns: [/application\s+questions/i, /additional\s+(?:questions|information)/i],
  },
  {
    step: 'my_experience',
    patterns: [/^my\s+experience/i, /work\s+experience/i, /resume\s*\/\s*cv/i],
  },
  {
    step: 'my_information',
    patterns: [/^my\s+information/i, /contact\s+information/i, /personal\s+information/i],
  },
  {
    step: 'create_account',
    patterns: [/create\s+account/i, /create\s+a\s+password/i, /verify\s+new\s+email/i],
  },
  {
    step: 'sign_in',
    patterns: [/sign\s+in/i, /returning\s+candidate/i],
  },
  {
    step: 'sign_in_choice',
    patterns: [/apply\s+manually/i, /apply\s+with\s+linkedin/i, /autofill\s+with\s+resume/i],
  },
];

const CONTINUE_BUTTON_SELECTORS: readonly string[] = [
  'button[data-automation-id="bottom-navigation-next-button"]',
  'button[data-automation-id*="next" i]',
  'button[data-automation-id*="continue" i]',
  'button[data-automation-id*="saveContinue" i]',
  'button[type="submit"]',
];

const SUBMIT_BUTTON_SELECTORS: readonly string[] = [
  'button[data-automation-id="bottom-navigation-submit-button"]',
  'button[data-automation-id*="submit" i]',
  'button[type="submit"]',
];

const APPLY_MANUALLY_SELECTORS: readonly string[] = [
  'button[data-automation-id="applyManually"]',
  'a[data-automation-id="applyManually"]',
];

const MAX_STEP_ITERATIONS = 14;
const STEP_SETTLE_MS = 1500;

export async function runWorkdaySubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  const session = createDesktopAgentSession(registry, {
    mode: request.mode,
    runtime: createClaudeAgentSdkRuntime(createWorkdayRuntime(request)),
  });
  const result = await session.run({
    objective: `Run ${request.mode} desktop Workday submission: ${request.applicationUrl}`,
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

export function isWorkdayApplicationUrl(url: string): boolean {
  return /\.myworkdayjobs\.com/i.test(url);
}

function createWorkdayRuntime(
  request: DesktopSubmitLeadRequest,
): LocalClaudeAgentSdkSession {
  return {
    async run(input) {
      setCurrentRunSignal(input.signal);
      try {
        return await runWorkdayRuntime(request, input);
      } finally {
        setCurrentRunSignal(undefined);
      }
    },
  };
}

async function runWorkdayRuntime(
  request: DesktopSubmitLeadRequest,
  input: DesktopAgentRuntimeInput,
): Promise<DesktopAgentRuntimeResult> {
  if (!request.continueFromCurrentPage) {
    const navigateResult = await call(
      input,
      'navigate',
      { url: request.applicationUrl },
      'open Workday application page',
    );
    if (!navigateResult.ok) return failed(navigateResult);
  }

  const overlaysDismissed = await dismissCommonOverlays(input, call);
  if (overlaysDismissed > 0) {
    console.log(
      `[workday-submit] dismissed ${overlaysDismissed} consent overlay(s)`,
    );
  }

  const identity = await loadRequiredIdentity(input);
  if ('status' in identity) return identity;

  // Workday's job description page often has an "Apply" CTA that opens the
  // wizard. Click through if we can find it on the current page before
  // entering the step loop.
  await tryClickApply(input);

  let resumeFilePath = identity.resumePdfPath;
  if (request.prepareTailoredResume) {
    try {
      const tailored = await request.prepareTailoredResume();
      if (tailored) resumeFilePath = tailored;
    } catch (error) {
      console.warn('[workday-submit] tailored resume prep failed:', error);
    }
  }

  const visitedSteps = new Set<WorkdayStep>();
  let lastStep: WorkdayStep = 'unknown';
  const attemptedSelectors = new Set<string>();

  for (let iteration = 0; iteration < MAX_STEP_ITERATIONS; iteration += 1) {
    await sleep(STEP_SETTLE_MS);
    const snapshot = await call(
      input,
      'dom_snapshot',
      {},
      `Workday step detection (iter ${iteration + 1})`,
    );
    if (!snapshot.ok) return failed(snapshot);
    const html = readDomSnapshotHtml(snapshot.data);
    const title = readDomSnapshotTitle(snapshot.data);
    const url = readDomSnapshotUrl(snapshot.data);
    if (!html) {
      return {
        message: 'Empty DOM snapshot during Workday wizard.',
        status: 'failed',
      };
    }

    const step = detectWorkdayStep(html, title, url);
    console.log(
      `[workday-submit] iteration ${iteration + 1}: detected step ${step}`,
    );

    if (step === 'submitted') {
      return {
        message:
          'Workday submission confirmed (post-submit summary page detected).',
        status: 'completed',
      };
    }

    if (step === 'sign_in' || step === 'create_account') {
      // We deliberately don't auto-create accounts — Workday uses the
      // email as the handle and a silent registration would surprise the
      // user. Surface the state so they can finish the auth step manually.
      return {
        message:
          step === 'sign_in'
            ? 'Workday is asking the candidate to sign in. Sign in manually then resume the run.'
            : 'Workday is asking the candidate to create an account. Finish account creation manually then resume the run.',
        status: 'paused_for_manual_review',
      };
    }

    // Detect repeated stalls — same step + no new fields filled twice in a
    // row means we can't make further progress without help.
    const filledBefore = attemptedSelectors.size;

    if (step === 'sign_in_choice') {
      const clicked = await clickFirstMatching(input, APPLY_MANUALLY_SELECTORS);
      if (!clicked) {
        return {
          message:
            'Workday landed on the apply-method choice page but no "Apply Manually" control was found.',
          status: 'manual_auth_required',
        };
      }
      lastStep = step;
      continue;
    }

    if (step === 'my_experience') {
      // Resume upload first — Workday's autofill-from-resume populates a
      // bunch of fields, saves us doing them by hand.
      await tryResumeUpload(input, resumeFilePath, attemptedSelectors);
    }

    if (request.resolveUnknownFieldAnswer) {
      // Multi-pass LLM fallback to catch lazy-mounted follow-ups.
      for (let pass = 0; pass < 3; pass += 1) {
        const before = attemptedSelectors.size;
        await resolveRemainingFieldsWithLlm(
          input,
          request.resolveUnknownFieldAnswer,
          attemptedSelectors,
          request.aiProvider,
          request.lookupRecentVerificationCode,
        );
        if (attemptedSelectors.size === before) break;
        await sleep(400);
      }
    }

    visitedSteps.add(step);

    if (step === 'review') {
      if (request.mode !== 'submit') {
        return {
          message:
            'Training run reached Workday review page (submit not clicked).',
          status: 'completed',
        };
      }
      const submitClicked = await clickFirstMatching(
        input,
        SUBMIT_BUTTON_SELECTORS,
      );
      if (!submitClicked) {
        return {
          message:
            'Workday review page reached but the Submit button was not found.',
          status: 'validation_failed',
        };
      }
      const confirmation = await waitForSubmissionConfirmation(input);
      if (!confirmation.confirmed) {
        return {
          message: `Workday Submit fired but no confirmation page within ${confirmation.timeoutMs}ms.${
            confirmation.diagnostic ? ` ${confirmation.diagnostic}` : ''
          }`,
          status: 'confirmation_timeout',
        };
      }
      return {
        message: 'Workday submit confirmed.',
        status: 'completed',
      };
    }

    const advanced = await clickFirstMatching(input, CONTINUE_BUTTON_SELECTORS);
    if (!advanced) {
      return {
        message: `Workday wizard stalled on step ${step} — no Continue/Submit button found.`,
        status: 'failed',
      };
    }

    if (step === lastStep && attemptedSelectors.size === filledBefore) {
      return {
        message: `Workday wizard stalled on step ${step} (no new fields filled across two iterations).`,
        status: 'failed',
      };
    }
    lastStep = step;
  }

  return {
    message: `Workday wizard exceeded ${MAX_STEP_ITERATIONS} step iterations without reaching submit confirmation.`,
    status: 'failed',
  };
}

async function tryClickApply(input: DesktopAgentRuntimeInput): Promise<void> {
  const snapshot = await call(input, 'dom_snapshot', {}, 'pre-wizard apply check');
  if (!snapshot.ok) return;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return;
  const root = parse(html);
  const applyButton =
    root.querySelector('a[data-automation-id="adventureButton"]') ??
    root.querySelector('button[data-automation-id="adventureButton"]') ??
    null;
  if (!applyButton) return;
  await call(
    input,
    'click',
    { selector: 'a[data-automation-id="adventureButton"], button[data-automation-id="adventureButton"]' },
    'open Workday apply wizard',
  );
}

async function tryResumeUpload(
  input: DesktopAgentRuntimeInput,
  filePath: string,
  attemptedSelectors: Set<string>,
): Promise<void> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'Workday resume input lookup',
  );
  if (!snapshot.ok) return;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return;
  const root = parse(html);
  const resumeInput =
    root.querySelector('input[data-automation-id="file-upload-input-ref"]') ??
    root.querySelector('input[type="file"][accept*="pdf"]') ??
    root.querySelector('input[type="file"]');
  if (!resumeInput) return;
  const automationId = resumeInput.getAttribute('data-automation-id');
  const selector = automationId
    ? `input[data-automation-id="${automationId}"]`
    : 'input[type="file"]';
  await call(
    input,
    'upload',
    { filePath, selector },
    'attach Workday resume',
  );
  attemptedSelectors.add(selector);
}

async function clickFirstMatching(
  input: DesktopAgentRuntimeInput,
  selectors: readonly string[],
): Promise<boolean> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'Workday CTA discovery',
  );
  if (!snapshot.ok) return false;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return false;
  const root = parse(html);
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
      `Workday click ${selector}`,
    );
    if (result.ok) return true;
  }
  return false;
}

function detectWorkdayStep(
  html: string,
  title: string | null,
  url: string | null,
): WorkdayStep {
  const root = parse(html);
  const headings = root
    .querySelectorAll(
      'h1, h2, h3, [data-automation-id*="pageHeader" i], [data-automation-id*="title" i]',
    )
    .map(node => (node.text ?? '').trim())
    .filter(Boolean);
  const haystack = `${title ?? ''}\n${url ?? ''}\n${headings.join('\n')}`;
  for (const { step, patterns } of STEP_PATTERNS) {
    if (patterns.some(pattern => pattern.test(haystack))) {
      return step;
    }
  }
  return 'unknown';
}
