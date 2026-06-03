import { parse, type HTMLElement } from 'node-html-parser';

import {
  createClaudeAgentSdkRuntime,
  type LocalClaudeAgentSdkSession,
} from '../agent/claude-agent-sdk.js';
import { createDesktopAgentSession } from '../agent/session.js';
import { DesktopAgentCancelledError } from '../agent/types.js';
import type {
  DesktopAgentMode,
  DesktopAgentRuntimeInput,
  DesktopAgentRuntimeResult,
  DesktopAgentSessionStatus,
  DesktopValidationFailure,
} from '../agent/types.js';
import type { DesktopToolRegistry } from '../tools/registry.js';
import type { DesktopToolCallResult, DesktopToolName } from '../tools/types.js';

import { dismissCommonOverlays } from './dismiss-overlays.js';

export type DesktopAiProvider = 'openai' | 'ollama';

export interface DesktopSubmitLeadRequest {
  readonly aiProvider?: DesktopAiProvider;
  readonly applicationUrl: string;
  readonly applicantProfile?: {
    readonly canadaWorkPreference?: string | null;
    readonly city: string | null;
    readonly country: string | null;
    readonly citizenshipStatus?: string | null;
    readonly disabilityStatus: string | null;
    readonly gender: string | null;
    readonly githubUrl: string | null;
    readonly hispanicLatino: string | null;
    readonly linkedinUrl: string | null;
    readonly race: string | null;
    readonly referralSource: string | null;
    readonly salaryExpectation: string | null;
    readonly sponsorshipRequired: string | null;
    readonly state: string | null;
    readonly veteranStatus: string | null;
    readonly websiteUrl: string | null;
    readonly workAuthorization: string | null;
  };
  readonly jobLeadId?: string;
  readonly jobListingId?: string;
  readonly continueFromCurrentPage?: boolean;
  readonly mode: DesktopAgentMode;
  readonly onFormSnapshot?: FormSnapshotHandler;
  // Awaited right before the resume upload step so optimization can run in
  // parallel with the form-fill work. Returning null falls back to the
  // identity store's resume PDF path.
  readonly prepareTailoredResume?: () => Promise<string | null>;
  readonly resolveUnknownFieldAnswer?: ResolveUnknownFieldAnswer;
  readonly lookupRecentVerificationCode?: LookupRecentVerificationCode;
}

export type LookupRecentVerificationCode = (digits?: number) => Promise<{
  readonly code: string;
  readonly digits: number;
  readonly emailId: string;
  readonly fromEmail: string;
  readonly subject: string;
} | null>;

export type ResolveUnknownFieldAnswer = (query: {
  readonly aiProvider?: DesktopAiProvider;
  readonly fieldType?:
    | 'text'
    | 'textarea'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'unknown';
  readonly options?: readonly string[];
  readonly question: string;
  readonly siblingUrls?: readonly string[];
}) => Promise<{
  readonly answer: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly reasoning: string;
} | null>;

export interface FormSnapshotOption {
  readonly label: string;
  readonly value: string;
}

export interface FormSnapshotField {
  readonly fieldType: string;
  readonly label: string;
  readonly options: readonly FormSnapshotOption[];
  readonly placeholder: string | null;
  readonly required: boolean;
  readonly selector: string;
  readonly value: string;
}

export interface FormSnapshot {
  readonly applicationUrl: string;
  readonly fields: readonly FormSnapshotField[];
  readonly hostname: string;
  readonly html: string;
  readonly jobLeadId?: string;
}

export type FormSnapshotHandler = (snapshot: FormSnapshot) => Promise<void>;

export interface DesktopSubmitLeadResult {
  readonly applicationUrl: string;
  readonly executionEnvironment: 'DESKTOP_CDP';
  readonly jobLeadId?: string;
  readonly message: string;
  readonly mode: DesktopAgentMode;
  readonly status: DesktopAgentSessionStatus;
  readonly toolCalls: readonly {
    readonly errorMessage?: string;
    readonly input?: {
      readonly enabled?: boolean;
      readonly fileName?: string;
      readonly key?: string;
      readonly text?: string;
      readonly timeoutMs?: number;
      readonly url?: string;
      readonly value?: string;
    };
    readonly ok: boolean;
    readonly reason?: string;
    readonly selector?: string;
    readonly tool: DesktopToolName;
  }[];
  readonly validationFailures?: readonly DesktopValidationFailure[];
}

const GREENHOUSE_FIRST_NAME_SELECTOR =
  'input#first_name,input[name="first_name"]';
const GREENHOUSE_LAST_NAME_SELECTOR = 'input#last_name,input[name="last_name"]';
const GREENHOUSE_EMAIL_SELECTOR = 'input#email,input[name="email"]';
const GREENHOUSE_PHONE_SELECTOR = 'input#phone,input[name="phone"]';
const GREENHOUSE_CITY_SELECTOR =
  'input#city,input[name="city"],textarea#city,textarea[name="city"]';
const GREENHOUSE_COUNTRY_SELECTOR =
  'select#country,select[name="country"],select[name*="country" i],input#country,input[name="country"],input[name*="country" i],textarea#country,textarea[name="country"],textarea[name*="country" i]';
const GREENHOUSE_LOCATION_SELECTOR =
  'input#location,input[name="location"],textarea#location,textarea[name="location"]';
// Only resume-shaped file inputs. The previous trailing `input[type="file"]`
// catch-all was clobbering cover-letter slots when a board re-ordered the two
// inputs, so the resume PDF would land in the cover-letter field. We rely on
// loadGreenhouseFieldSelectors().resume to find the labelled resume input
// when these structural selectors miss; if both miss, we'd rather fail and
// log than blindly upload to the wrong slot.
const GREENHOUSE_RESUME_SELECTOR =
  'input[type="file"][name="resume"],input[type="file"]#resume,input[type="file"][name*="resume" i]:not([name*="cover" i]),input[type="file"][id*="resume" i]:not([id*="cover" i]),input[type="file"][aria-label*="resume" i]:not([aria-label*="cover" i])';
const GREENHOUSE_COVER_LETTER_SELECTOR =
  'input[type="file"][name*="cover" i],input[type="file"][id*="cover" i],input[type="file"][aria-label*="cover" i]';
const GREENHOUSE_STATE_SELECTOR =
  'input#state,input[name="state"],textarea#state,textarea[name="state"],select#state,select[name="state"]';
const GREENHOUSE_SUBMIT_SELECTOR =
  'button#submit_app,button#submit-application,button[type="submit"][data-qa="submit-application"],button.template-btn-submit,form#application-form button[type="submit"],form#application_form button[type="submit"],form[id*="application" i] button[type="submit"],input[type="submit"]';
const GREENHOUSE_QUESTION_AUTHORIZED_SELECTOR =
  'select#question_authorized,select[name="question_authorized"]';
const GREENHOUSE_QUESTION_SPONSORSHIP_SELECTOR =
  'select#question_sponsorship,select[name="question_sponsorship"]';
const PREFERRED_NAME_QUESTION_PATTERN =
  /\bpreferred[\s_-]+(?:first[\s_-]+)?name\b|\bnickname\b|\bchosen[\s_-]+name\b|what\s+should\s+we\s+call\s+you|\bgo\s+by\b/i;

// Tag patterns for "this is a select / dropdown / combobox of some kind".
// Greenhouse boards now ship every variant: native <select>, <button> with
// aria-haspopup, role="combobox" on a <div>, and div widgets that only carry
// aria-haspopup/aria-controls. Hitting all of these in label-resolution is
// what stops fields from silently going missing on newer Greenhouse layouts.
const GREENHOUSE_SELECT_TAGS = [
  'select',
  'button',
  '[role="combobox"]',
  '[aria-haspopup="listbox"]',
  '[aria-haspopup="menu"]',
  '[class*="select__control"]',
] as const;

const COUNTRY_LABELS: Record<string, string> = {
  US: 'United States',
};

const US_STATE_LABELS: Record<string, string> = {
  AK: 'Alaska',
  AL: 'Alabama',
  AR: 'Arkansas',
  AZ: 'Arizona',
  CA: 'California',
  CO: 'Colorado',
  CT: 'Connecticut',
  DE: 'Delaware',
  FL: 'Florida',
  GA: 'Georgia',
  HI: 'Hawaii',
  IA: 'Iowa',
  ID: 'Idaho',
  IL: 'Illinois',
  IN: 'Indiana',
  KS: 'Kansas',
  KY: 'Kentucky',
  LA: 'Louisiana',
  MA: 'Massachusetts',
  MD: 'Maryland',
  ME: 'Maine',
  MI: 'Michigan',
  MN: 'Minnesota',
  MO: 'Missouri',
  MS: 'Mississippi',
  MT: 'Montana',
  NC: 'North Carolina',
  ND: 'North Dakota',
  NE: 'Nebraska',
  NH: 'New Hampshire',
  NJ: 'New Jersey',
  NM: 'New Mexico',
  NV: 'Nevada',
  NY: 'New York',
  OH: 'Ohio',
  OK: 'Oklahoma',
  OR: 'Oregon',
  PA: 'Pennsylvania',
  RI: 'Rhode Island',
  SC: 'South Carolina',
  SD: 'South Dakota',
  TN: 'Tennessee',
  TX: 'Texas',
  UT: 'Utah',
  VA: 'Virginia',
  VT: 'Vermont',
  WA: 'Washington',
  WI: 'Wisconsin',
  WV: 'West Virginia',
  WY: 'Wyoming',
};

export async function runGreenhouseSubmitLead(
  registry: DesktopToolRegistry,
  request: DesktopSubmitLeadRequest,
  options: { readonly signal?: AbortSignal } = {},
): Promise<DesktopSubmitLeadResult> {
  const session = createDesktopAgentSession(registry, {
    mode: request.mode,
    runtime: createClaudeAgentSdkRuntime(createGreenhouseRuntime(request)),
  });
  const result = await session.run({
    objective: buildObjective(request),
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
      input: summarizeToolInput(event.input),
      ok: event.result.ok,
      reason: event.reason,
      selector: readToolSelector(event.input),
      tool: event.tool,
    })),
    validationFailures: result.validationFailures,
  };
}

function summarizeToolInput(
  input: unknown,
): DesktopSubmitLeadResult['toolCalls'][number]['input'] {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }

  const record = input as Record<string, unknown>;
  const filePath = readString(record.filePath);

  return {
    enabled: typeof record.enabled === 'boolean' ? record.enabled : undefined,
    fileName: filePath ? filePath.split(/[\\/]/).pop() : undefined,
    key: readString(record.key) ?? undefined,
    text: readString(record.text) ?? undefined,
    timeoutMs:
      typeof record.timeoutMs === 'number' && Number.isFinite(record.timeoutMs)
        ? record.timeoutMs
        : undefined,
    url: readString(record.url) ?? undefined,
    value: readString(record.value) ?? undefined,
  };
}

function readToolSelector(input: unknown): string | undefined {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return undefined;
  }

  return readString((input as Record<string, unknown>).selector) ?? undefined;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function createGreenhouseRuntime(
  request: DesktopSubmitLeadRequest,
): LocalClaudeAgentSdkSession {
  return {
    async run(input) {
      // Wire the runtime's abort signal into the module-scoped sleep so
      // every sleep() call below rejects immediately on Stop. Otherwise
      // the signal only fires on the next tool call and the user sees
      // 500-1500ms of "ghost" automation after clicking Stop.
      setCurrentRunSignal(input.signal);
      try {
        return await runGreenhouseRuntime(request, input);
      } finally {
        setCurrentRunSignal(undefined);
      }
    },
  };
}

async function runGreenhouseRuntime(
  request: DesktopSubmitLeadRequest,
  input: DesktopAgentRuntimeInput,
): Promise<DesktopAgentRuntimeResult> {
  if (!request.continueFromCurrentPage) {
    const navigateResult = await call(
      input,
      'navigate',
      { url: request.applicationUrl },
      'open Greenhouse application',
    );
    if (!navigateResult.ok) return failed(navigateResult);
  }

  const readyResult = await call(
    input,
    'wait_for',
    { selector: GREENHOUSE_FIRST_NAME_SELECTOR, timeoutMs: 15_000 },
    'wait for Greenhouse form',
  );
  if (!readyResult.ok) return failed(readyResult);

  // Some Greenhouse-embedded careers sites stack OneTrust / Cookiebot /
  // TrustArc banners on top of the application form. Click the standard
  // "Accept all" buttons up front so subsequent clicks don't land on a
  // consent overlay instead of the form.
  const overlaysDismissed = await dismissCommonOverlays(input, call);
  if (overlaysDismissed > 0) {
    console.log(
      `[greenhouse-submit] dismissed ${overlaysDismissed} consent overlay(s)`,
    );
  }

  const identity = await loadRequiredIdentity(input);
  if ('status' in identity) return identity;

  const resolvedSelectors = await loadGreenhouseFieldSelectors(input);

  // Trace the identity values being sent into the form so we can debug
  // mismatches (e.g. a phone digit getting mangled). Stays in stdout of
  // the desktop main process — not user-facing.
  console.log('[greenhouse-submit] identity values', {
    email: identity.email,
    firstName: identity.firstName,
    lastName: identity.lastName,
    phone: identity.phone,
  });

  // Resume-first ordering: upload the resume up-front so Greenhouse's parser
  // can pre-populate fields we don't track (education, employment timeline,
  // address) before we type anything. Our identity fills below then
  // overwrite the parsed values for the fields we do have, so net accuracy
  // is "resume parser wins for unknown fields, our profile wins for known
  // fields". Falls back gracefully — if upload fails we still try to type
  // every field manually.
  let uploadFailureReason: string | null = null;
  let resumeUploadDone = false;
  try {
    let earlyResumeFilePath = identity.resumePdfPath;
    if (request.prepareTailoredResume) {
      try {
        const tailoredPath = await request.prepareTailoredResume();
        if (tailoredPath) earlyResumeFilePath = tailoredPath;
      } catch (error) {
        console.warn(
          '[greenhouse-submit] tailored resume prep failed (early), falling back',
          error,
        );
      }
    }
    const earlyUpload = await attemptResumeUpload(
      input,
      earlyResumeFilePath,
      resolvedSelectors.resume ?? GREENHOUSE_RESUME_SELECTOR,
      'attach resume (early)',
    );
    if (earlyUpload.ok) {
      resumeUploadDone = true;
      // Brief pause so the resume parser kicks in before we start filling.
      await sleep(800);
    } else {
      uploadFailureReason = earlyUpload.error?.message ?? 'unknown';
    }
  } catch (error) {
    uploadFailureReason = error instanceof Error ? error.message : String(error);
  }
  if (uploadFailureReason) {
    console.warn(
      '[greenhouse-submit] early resume upload skipped:',
      uploadFailureReason,
    );
  }

  const fillResults = [
    await call(
      input,
      'fill',
      {
        selector: GREENHOUSE_FIRST_NAME_SELECTOR,
        value: identity.firstName,
      },
      'fill first name',
    ),
    await call(
      input,
      'fill',
      { selector: GREENHOUSE_LAST_NAME_SELECTOR, value: identity.lastName },
      'fill last name',
    ),
    await call(
      input,
      'fill',
      { selector: GREENHOUSE_EMAIL_SELECTOR, value: identity.email },
      'fill email',
    ),
    await call(
      input,
      'fill',
      { selector: GREENHOUSE_PHONE_SELECTOR, value: identity.phone },
      'fill phone',
    ),
  ];
  const failedFill = fillResults.find(result => !result.ok);
  if (failedFill) return failed(failedFill);

  // Verify the phone field actually received the typed value. Greenhouse
  // Boards mounts intl-tel-input which runs a debounced reformatter that
  // mutates the field ~200-500ms after the input event — long enough that
  // an immediate read sees the raw digits we wrote and a delayed read
  // sees a different value (we've seen the trailing digit get rewritten
  // from "...8044" to "...8041"). Sleep to let the formatter settle, then
  // compare digits and refill if they drifted. If repeated value-setter
  // refills can't keep the digits stable, fall back to typing each digit
  // through Chromium's input pipeline so the formatter sees real keystrokes
  // and can't replace digits behind our back.
  let phoneStable = false;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await sleep(attempt === 0 ? 700 : 500);
    const phoneValueResult = await call(
      input,
      'read_element',
      { selector: GREENHOUSE_PHONE_SELECTOR },
      'verify phone value',
    );
    if (!phoneValueResult.ok) break;
    const data = phoneValueResult.data as { value?: unknown } | null;
    const actualPhone =
      data && typeof data.value === 'string' ? data.value : null;
    if (
      !actualPhone ||
      stripPhoneDigits(actualPhone) === stripPhoneDigits(identity.phone)
    ) {
      phoneStable = true;
      break;
    }
    console.warn('[greenhouse-submit] phone value mismatch after fill', {
      actual: actualPhone,
      attempt,
      expected: identity.phone,
    });
    await call(
      input,
      'fill',
      { selector: GREENHOUSE_PHONE_SELECTOR, value: identity.phone },
      'refill phone after mismatch',
    );
  }
  if (!phoneStable) {
    const typed = await typePhoneDigitsByKeystroke(
      input,
      GREENHOUSE_PHONE_SELECTOR,
      identity.phone,
    );
    console.warn(
      `[greenhouse-submit] phone keystroke fallback ${typed ? 'succeeded' : 'still mismatched'}`,
    );
  }

  await fillPreferredNameFields(input, identity.firstName);

  // The caller may have kicked off resume tailoring in parallel with the
  // basic-info fill above. Await it now (right before the upload), so the
  // optimization runs concurrently with form work but the upload still
  // gets the tailored PDF when it's ready.
  if (!resumeUploadDone) {
    let resumeFilePath = identity.resumePdfPath;
    if (request.prepareTailoredResume) {
      try {
        const tailoredPath = await request.prepareTailoredResume();
        if (tailoredPath) resumeFilePath = tailoredPath;
      } catch (error) {
        console.warn(
          '[greenhouse-submit] tailored resume prep failed, falling back',
          error,
        );
      }
    }

    const uploadResult = await attemptResumeUpload(
      input,
      resumeFilePath,
      resolvedSelectors.resume ?? GREENHOUSE_RESUME_SELECTOR,
      'attach resume',
    );
    if (uploadResult.ok) {
      resumeUploadDone = true;
    } else {
      // Modern Greenhouse layouts hide the file input behind a "Dropbox /
      // Google Drive / Enter manually" widget that we couldn't unstick.
      // Don't kill the run — keep filling everything else. The pre-submit
      // required-field scan + submit-guard surface "resume missing" so the
      // user can attach it manually before submitting.
      console.warn(
        '[greenhouse-submit] resume upload skipped — continuing without it:',
        uploadResult.error?.message ?? 'unknown',
      );
    }
  }

  // Early submit: if the basic identity fields + resume are filled and no
  // other required fields are visibly empty, try submitting now and skip
  // the optional-field phase. If Greenhouse bounces the submit (validation
  // error, hidden required field, etc.), fall through to the full flow.
  if (request.mode === 'submit') {
    const remainingBeforeOptional = await detectUnansweredRequiredFields(input);
    if (remainingBeforeOptional.length === 0) {
      const guardResult = await call(
        input,
        'submit_guard',
        { enabled: false },
        'owner-approved submit mode (early)',
      );
      if (guardResult.ok) {
        const earlySubmit = await call(
          input,
          'click',
          { selector: GREENHOUSE_SUBMIT_SELECTOR },
          'submit application (early — required fields filled)',
        );
        if (earlySubmit.ok) {
          const confirmation = await waitForSubmissionConfirmation(input);
          if (confirmation.confirmed) {
            return {
              message:
                'Submit confirmed on first pass — required fields were sufficient.',
              status: 'completed',
            };
          }
          // Greenhouse didn't confirm. Proceed to the optional-fill flow
          // below; a second submit click will run after that.
        }
      }
    }
  }

  const profileSnapshot = request.applicantProfile ?? {
    canadaWorkPreference: null,
    city: null,
    country: null,
    citizenshipStatus: null,
    disabilityStatus: null,
    gender: null,
    githubUrl: null,
    hispanicLatino: null,
    linkedinUrl: null,
    race: null,
    referralSource: 'Gimme Job',
    salaryExpectation: null,
    sponsorshipRequired: null,
    state: null,
    veteranStatus: null,
    websiteUrl: null,
    workAuthorization: null,
  };
  // If the user hasn't set a gender preference, take a best guess from
  // their first name. Greenhouse's gender prompt accepts "Male" / "Female"
  // / "Non-binary" / "Decline to state" — we only commit a guess when the
  // name is unambiguously gendered, otherwise we leave gender null and let
  // the LLM resolver / "Decline to state" path handle it.
  const profileWithInferredGender = profileSnapshot.gender
    ? profileSnapshot
    : {
        ...profileSnapshot,
        gender: inferGenderFromFirstName(identity.firstName) ?? null,
      };

  const optionalFieldResult = await fillOptionalGreenhouseFields(
    input,
    request.aiProvider,
    profileWithInferredGender,
    resolvedSelectors,
    request.resolveUnknownFieldAnswer,
    request.lookupRecentVerificationCode,
  );
  // In submit mode the caller explicitly wants the form submitted as
  // soon as the required fields are filled. Optional fields (demographics,
  // extra Greenhouse questions, etc.) are best-effort — if filling them
  // hits a snag we still proceed to the submit click below. Same applies
  // in training mode: a single non-ignorable optional-fill failure (e.g.
  // a custom-select widget that didn't expose its options yet, a flaky
  // press_key on a typeahead) shouldn't end the autofill mid-form. Reach
  // the submit_guard click and surface the remaining-empty count from
  // there. The single exception in either mode is
  // `paused_for_manual_review` (anti-bot disclosure detection), which is
  // an explicit halt — submitting through one of those would lie to the
  // form about being human.
  if (optionalFieldResult?.status === 'paused_for_manual_review') {
    return optionalFieldResult;
  }

  if (request.onFormSnapshot) {
    await emitFormSnapshot(input, request);
  }

  if (request.mode === 'submit') {
    const guardResult = await call(
      input,
      'submit_guard',
      { enabled: false },
      'owner-approved submit mode',
    );
    if (!guardResult.ok) return failed(guardResult);
  }

  const submitResult = await call(
    input,
    'click',
    { selector: GREENHOUSE_SUBMIT_SELECTOR },
    request.mode === 'submit' ? 'submit application' : 'verify submit guard',
  );

  if (!submitResult.ok) {
    const message = submitResult.error?.message ?? 'Submit click failed.';
    if (
      request.mode === 'training' &&
      message.includes('submit_guard blocked')
    ) {
      // Sniff the live DOM for required-but-empty fields. Greenhouse runs
      // typically end with "blocked by submit guard" whether the planner
      // filled everything or skipped entire custom-question sections —
      // surfacing the count gives the user immediate feedback that the
      // run is incomplete vs. ready for an owner-approved submit.
      const remaining = await detectUnansweredRequiredFields(input);
      const message =
        remaining.length === 0
          ? 'Training run reached the Greenhouse submit control.'
          : `Training run stopped at submit guard with ${remaining.length} required field${
              remaining.length === 1 ? '' : 's'
            } still empty: ${remaining
              .slice(0, 3)
              .map(question => `"${question}"`)
              .join(', ')}${
              remaining.length > 3 ? ` (+${remaining.length - 3} more)` : ''
            }.`;
      return {
        message,
        status: 'blocked_by_submit_guard',
      };
    }
    return failed(submitResult);
  }

  if (request.mode === 'submit') {
    let confirmation = await waitForSubmissionConfirmation(input);
    if (!confirmation.confirmed && request.lookupRecentVerificationCode) {
      // Greenhouse often gates submission behind a 6-8 digit email
      // verification code that only appears AFTER the first submit click.
      // Wait for the email to arrive at the user's tracking inbox, fill the
      // code, then re-submit. The poll respects autofill pause / cancel so
      // the user can abort while we're waiting.
      const challenge = await detectVerificationCodeChallenge(input);
      if (challenge) {
        const handled = await resolveVerificationCodeChallenge(
          input,
          challenge,
          request.lookupRecentVerificationCode,
        );
        if (handled.ok) {
          const resubmit = await call(
            input,
            'click',
            { selector: GREENHOUSE_SUBMIT_SELECTOR },
            'submit application (after verification code)',
          );
          if (resubmit.ok) {
            confirmation = await waitForSubmissionConfirmation(input);
          }
        }
      }
    }
    if (!confirmation.confirmed) {
      const remaining = await detectUnansweredRequiredFields(input);
      const detail =
        remaining.length > 0
          ? ` Required field${remaining.length === 1 ? '' : 's'} still empty: ${remaining
              .slice(0, 3)
              .map(question => `"${question}"`)
              .join(', ')}${
              remaining.length > 3 ? ` (+${remaining.length - 3} more)` : ''
            }.`
          : '';
      const validationErrors = await detectValidationErrors(input);
      const validationDetail =
        validationErrors.length > 0
          ? ` Validation error${validationErrors.length === 1 ? '' : 's'}: ${validationErrors
              .slice(0, 3)
              .map(err => `${err.fieldLabel ? `"${err.fieldLabel}": ` : ''}${err.message}`)
              .join('; ')}${
              validationErrors.length > 3 ? ` (+${validationErrors.length - 3} more)` : ''
            }.`
          : '';
      return {
        message: `Submit click fired but Greenhouse did not show a confirmation page within ${confirmation.timeoutMs}ms.${detail}${validationDetail}${
          confirmation.diagnostic ? ` ${confirmation.diagnostic}` : ''
        }`,
        status: 'failed',
      };
    }
    return {
      message:
        'Submit confirmed — Greenhouse showed an application-received page.',
      status: 'completed',
    };
  }

  return {
    message: 'Training run completed without submit guard blocking.',
    status: 'completed',
  };
}

const SUBMISSION_CONFIRMATION_TEXT_PATTERNS: ReadonlyArray<RegExp> = [
  // Loosened from \bthank(?:s| you)\b so "thank-you", "thanks!" and
  // "thank you for applying" all match without requiring trailing boundary.
  /thank(?:s|\s*you|-you)/i,
  /application\s+(?:received|submitted|recorded|complete|sent|in)/i,
  /(?:we(?:['’]ve| have))\s+received/i,
  /(?:we(?:['’]ve| have))\s+got(?:ten)?\s+your/i,
  /successfully\s+(?:submitted|applied|sent)/i,
  /submission\s+(?:received|complete|successful)/i,
  /we['’]?ll\s+(?:be in touch|review|reach out|get back)/i,
  /we\s+will\s+(?:be in touch|review|reach out|get back)/i,
  /your\s+application\s+(?:has been |is )?(?:on its way|under review|received|submitted|in)/i,
  /you(?:r|['’]ve)\s+(?:applied|submitted)/i,
  /we\s+(?:appreciate|got)\s+your/i,
  /you['’]re\s+all\s+set/i,
  /next\s+steps?/i,
  /we['’]ll\s+(?:get|reach)\s+back/i,
  /received\s+your\s+(?:application|submission|info)/i,
  /applied\s+to\s+/i,
];

const SUBMISSION_CONFIRMATION_URL_PATTERNS: ReadonlyArray<RegExp> = [
  /\/(?:thanks?|thank-you|confirmation|submitted|success|application-(?:received|complete|submitted))/i,
  // Greenhouse + most ATS: navigates to /applications/<id> on success.
  /\/applications?\/(?:new\/)?[a-z0-9-]+/i,
];

const CONFIRMATION_CONTAINER_PATTERNS: ReadonlyArray<RegExp> = [
  /thank|received|submitted|success|confirm|appli/i,
];

export async function waitForSubmissionConfirmation(
  input: DesktopAgentRuntimeInput,
): Promise<{
  confirmed: boolean;
  timeoutMs: number;
  diagnostic?: string;
}> {
  const timeoutMs = 30_000;
  const pollMs = 600;
  const deadline = Date.now() + timeoutMs;
  // Fast-fail budget: if 2 polls in a row see the same body + form still
  // visible + no URL change, the submit didn't go through and waiting longer
  // won't change that. Cuts a typical failed-submit from 30s to ~1.5s.
  const STABLE_NEGATIVE_TICKS_TO_EXIT = 2;
  let stableNegativeTicks = 0;
  let prevBodyHead = ' UNSET';

  // Capture the URL right after the submit click so we can detect a navigation.
  const initialSnapshot = await call(
    input,
    'dom_snapshot',
    {},
    'capture pre-confirmation URL',
  );
  const initialUrl = readDomSnapshotUrl(
    initialSnapshot.ok ? initialSnapshot.data : null,
  );

  // Give Greenhouse a beat to start processing the click.
  await sleep(800);

  let lastTitle: string | null = null;
  let lastUrl: string | null = null;
  let lastBodyHead = '';
  let lastFormVisible = false;

  while (Date.now() < deadline) {
    const snapshot = await call(
      input,
      'dom_snapshot',
      {},
      'verify post-submit confirmation',
    );
    if (snapshot.ok) {
      const html = readDomSnapshotHtml(snapshot.data);
      const title = readDomSnapshotTitle(snapshot.data);
      const url = readDomSnapshotUrl(snapshot.data);
      lastTitle = title ?? lastTitle;
      lastUrl = url ?? lastUrl;

      if (html) {
        const root = parse(html);

        const submitStillVisible = root.querySelector(
          GREENHOUSE_SUBMIT_SELECTOR,
        );
        const formStillVisible = root.querySelector(
          'form#application_form, form#application-form, form[id*="application" i]',
        );
        lastFormVisible = !!(submitStillVisible || formStillVisible);

        const bodyText = root.querySelector('body')?.text ?? '';
        lastBodyHead = bodyText.slice(0, 240).replace(/\s+/g, ' ').trim();

        // Headlines (h1/h2/h3) carry the "Thanks for applying!" message on
        // most Greenhouse confirmation pages — checking them explicitly
        // catches sites where the body text is buried in a long footer.
        const headingText = root
          .querySelectorAll('h1, h2, h3, [role="heading"]')
          .map(node => (node.text ?? '').trim())
          .filter(Boolean)
          .join('\n');

        const haystack = `${title ?? ''}\n${headingText}\n${bodyText}`;
        const matchedConfirmationText =
          SUBMISSION_CONFIRMATION_TEXT_PATTERNS.some(pattern =>
            pattern.test(haystack),
          );

        const matchedConfirmationUrl = url
          ? SUBMISSION_CONFIRMATION_URL_PATTERNS.some(pattern =>
              pattern.test(url),
            )
          : false;

        // Confirmation container by class/id: many Greenhouse tenants render
        // a div with class containing "confirmation" / "thank" / "submitted"
        // even when the surrounding URL doesn't change.
        const matchedConfirmationContainer = root
          .querySelectorAll(
            '[class*="confirm" i], [class*="thank" i], [class*="submitted" i], [class*="success" i], [id*="confirm" i], [id*="thank" i]',
          )
          .some(node => {
            const text = (node.text ?? '').trim();
            return (
              text.length > 0 &&
              CONFIRMATION_CONTAINER_PATTERNS.some(pattern =>
                pattern.test(text),
              )
            );
          });

        const navigatedAway =
          !!initialUrl && !!url && stripQuery(url) !== stripQuery(initialUrl);

        if (
          matchedConfirmationText ||
          matchedConfirmationUrl ||
          matchedConfirmationContainer
        ) {
          return { confirmed: true, timeoutMs };
        }
        if (!submitStillVisible && !formStillVisible) {
          // Form is gone — Greenhouse navigated away from the application
          // page even though the confirmation text didn't match a known pattern.
          return { confirmed: true, timeoutMs };
        }
        if (navigatedAway && !formStillVisible) {
          return { confirmed: true, timeoutMs };
        }

        // Fast-fail: form still visible, no navigation, body unchanged from
        // the previous poll → no submit-in-progress signal. Bail out early
        // instead of polling for the full 30s. Real slow submits change the
        // body (validation message, spinner overlay, etc.) within a poll or
        // two, so this only short-circuits flat-line failures.
        if (lastFormVisible && !navigatedAway && lastBodyHead === prevBodyHead) {
          stableNegativeTicks += 1;
          if (stableNegativeTicks >= STABLE_NEGATIVE_TICKS_TO_EXIT) break;
        } else {
          stableNegativeTicks = 0;
        }
        prevBodyHead = lastBodyHead;
      }
    }
    await sleep(pollMs);
  }

  // Timeout — capture what we DID see so the failure log shows the actual
  // post-submit page state instead of an opaque "no confirmation" message.
  const diagnostic =
    `[at timeout] url=${lastUrl ?? 'unknown'}` +
    ` | title=${lastTitle ?? 'unknown'}` +
    ` | formVisible=${lastFormVisible}` +
    ` | body="${lastBodyHead}"`;
  return { confirmed: false, timeoutMs, diagnostic };
}

async function detectUnansweredRequiredFields(
  input: DesktopAgentRuntimeInput,
): Promise<string[]> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'final required-empty check',
  );
  if (!snapshot.ok) return [];
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return [];

  const root = parse(html);
  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="search"]):not([type="file"]), textarea, select, [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]',
  );

  const seen = new Set<string>();
  const unanswered: string[] = [];
  for (const candidate of candidates) {
    const selector = selectorForNode(candidate);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    const tagName = candidate.tagName.toLowerCase();
    const role = candidate.getAttribute('role') ?? '';
    const isCustomCombobox =
      role === 'combobox' || isInsideCustomSelectWidget(candidate);

    const label = readGreenhouseLabelText(root, candidate);
    if (!label) continue;
    if (!detectFieldRequired(root, candidate, label)) continue;

    const value = candidate.getAttribute('value') ?? '';
    const innerText = candidate.text?.trim() ?? '';
    if (isCustomCombobox && readCustomSelectSelectedText(candidate)) continue;
    if (
      tagName === 'select' &&
      value.trim() &&
      !isSelectPlaceholderText(value)
    ) {
      continue;
    }
    if (
      tagName === 'select' &&
      candidate.querySelector('option[selected]')?.getAttribute('value')
    ) {
      const selected = candidate
        .querySelector('option[selected]')
        ?.getAttribute('value');
      if (selected && !/^select/i.test(selected)) continue;
    }
    if (
      !isCustomCombobox &&
      tagName !== 'select' &&
      ((value && value.trim()) || innerText)
    ) {
      continue;
    }

    unanswered.push(label.replace(/\s*\*\s*$/, '').trim());
    if (unanswered.length >= 25) break;
  }
  return unanswered;
}

// Read visible inline validation messages emitted by the form after a failed
// submit. Greenhouse renders `.field-error`, `[role="alert"]`, `.errors li`,
// and `[aria-invalid="true"]` siblings; other ATS use similar conventions.
// Returned messages are short (~80 chars) and de-duped so we can include
// them in failure traces without flooding the run-log.
export async function detectValidationErrors(
  input: DesktopAgentRuntimeInput,
): Promise<readonly { readonly fieldLabel: string | null; readonly message: string }[]> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'detect validation errors',
  );
  if (!snapshot.ok) return [];
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return [];
  const root = parse(html);
  const errors: { fieldLabel: string | null; message: string }[] = [];
  const seen = new Set<string>();
  const errorSelectors = [
    '[role="alert"]',
    '.field-error',
    '.field_error',
    '.field--error',
    '.error-message',
    '.errors li',
    '.invalid-feedback',
    'p[class*="error" i]',
    'span[class*="error" i]',
    '[aria-invalid="true"] + .error',
    '[data-testid*="error" i]',
  ];
  for (const selector of errorSelectors) {
    const matches = root.querySelectorAll(selector);
    for (const node of matches) {
      const text = node.text?.trim().replace(/\s+/g, ' ') ?? '';
      if (!text || text.length > 200) continue;
      // Skip generic noise (footers, copyright, links to docs).
      if (/©|copyright|terms|privacy|cookie/i.test(text)) continue;
      const message = text.slice(0, 160);
      if (seen.has(message)) continue;
      seen.add(message);
      // Try to associate with the nearest labelled field.
      let fieldLabel: string | null = null;
      let walker = node.parentNode;
      for (let depth = 0; depth < 6 && walker; depth += 1) {
        const labelNode = walker.querySelector?.('label');
        const labelText = labelNode?.text?.trim().replace(/\s+/g, ' ');
        if (labelText && labelText.length < 120) {
          fieldLabel = labelText.replace(/\s*\*\s*$/, '');
          break;
        }
        walker = walker.parentNode;
      }
      errors.push({ fieldLabel, message });
      if (errors.length >= 12) return errors;
    }
  }
  return errors;
}

async function fillPreferredNameFields(
  input: DesktopAgentRuntimeInput,
  preferredName: string,
): Promise<void> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'scan preferred name fields',
  );
  if (!snapshot.ok) return;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return;

  const root = parse(html);
  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="search"]):not([type="file"]), textarea',
  );
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const selector = selectorForNode(candidate);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    const label = readGreenhouseLabelText(root, candidate);
    if (!PREFERRED_NAME_QUESTION_PATTERN.test(label)) continue;

    const value = candidate.getAttribute('value') ?? '';
    const innerText = candidate.text?.trim() ?? '';
    if ((value && value.trim()) || innerText) continue;

    const result = await call(
      input,
      'fill',
      { selector, value: preferredName },
      'fill preferred name',
    );
    if (result.ok) await sleep(60);
  }
}

// Best-effort lookup for the user's contact URLs. These are NOT required
// for a run to start (a profile without LinkedIn is fine) but when a form
// has an explicit LinkedIn / GitHub / Website field we always fill it,
// even if it's marked optional — they're high-signal for recruiters and
// the user already opted in by setting them in their profile.
export async function loadOptionalContactUrls(
  input: DesktopAgentRuntimeInput,
): Promise<{
  readonly linkedinUrl: string | null;
  readonly githubUrl: string | null;
  readonly websiteUrl: string | null;
}> {
  const linkedin = await loadIdentityValue(input, 'linkedin_url').catch(
    () => ({ ok: false as const }),
  );
  const github = await loadIdentityValue(input, 'github_url').catch(() => ({
    ok: false as const,
  }));
  const website = await loadIdentityValue(input, 'website_url').catch(
    () => ({ ok: false as const }),
  );
  return {
    linkedinUrl: linkedin.ok ? linkedin.value : null,
    githubUrl: github.ok ? github.value : null,
    websiteUrl: website.ok ? website.value : null,
  };
}

export async function loadRequiredIdentity(
  input: DesktopAgentRuntimeInput,
): Promise<
  | {
      readonly email: string;
      readonly firstName: string;
      readonly lastName: string;
      readonly phone: string;
      readonly resumePdfPath: string;
    }
  | { readonly message: string; readonly status: 'failed' }
> {
  const firstName = await loadIdentityValue(input, 'first_name');
  if (!firstName.ok) return failed(firstName);
  const lastName = await loadIdentityValue(input, 'last_name');
  if (!lastName.ok) return failed(lastName);
  const email = await loadIdentityValue(input, 'email');
  if (!email.ok) return failed(email);
  const phone = await loadIdentityValue(input, 'phone');
  if (!phone.ok) return failed(phone);
  const resumePdfPath = await loadIdentityValue(input, 'resume_pdf_path');
  if (!resumePdfPath.ok) return failed(resumePdfPath);

  return {
    email: email.value,
    firstName: firstName.value,
    lastName: lastName.value,
    phone: phone.value,
    resumePdfPath: resumePdfPath.value,
  };
}

interface GreenhouseFieldSelectors {
  readonly cityAndStateQuestion: string | null;
  readonly canadaLocationPreference: string | null;
  readonly country: string | null;
  readonly desiredSalary: string | null;
  readonly disabilityStatus: readonly string[];
  readonly gender: readonly string[];
  readonly github: string | null;
  readonly hispanicLatino: readonly string[];
  readonly linkedin: string | null;
  readonly locationCity: string | null;
  readonly locationRequirement: string | null;
  readonly exportComplianceCitizenship: string | null;
  readonly questionAuthorized: string | null;
  readonly questionSponsorship: string | null;
  readonly questionSponsorshipLabel: string | null;
  readonly race: readonly string[];
  readonly referralSource: string | null;
  readonly resume: string | null;
  readonly coverLetter: string | null;
  readonly residence: string | null;
  readonly state: string | null;
  readonly veteranStatus: readonly string[];
  readonly website: string | null;
}

async function loadGreenhouseFieldSelectors(
  input: DesktopAgentRuntimeInput,
): Promise<GreenhouseFieldSelectors> {
  const snapshotResult = await call(
    input,
    'dom_snapshot',
    {},
    'inspect Greenhouse form fields',
  );

  if (!snapshotResult.ok) {
    return emptyGreenhouseFieldSelectors();
  }

  const html = readDomSnapshotHtml(snapshotResult.data);
  if (!html) {
    return emptyGreenhouseFieldSelectors();
  }

  const root = parse(html);

  return {
    cityAndStateQuestion: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [/what city and state do you live in/i],
      tagNames: ['input', 'textarea'],
    }),
    canadaLocationPreference: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /currently located in or prefer to work in canada/i,
        /located.*prefer.*work.*canada/i,
      ],
      tagNames: [...GREENHOUSE_SELECT_TAGS, 'input'],
    }),
    country: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [/\bcountry\b/i],
      tagNames: ['input', 'select', 'textarea'],
    }),
    desiredSalary: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /\b(desired|expected)\s+salary\b/i,
        /\bsalary\s+expectations?\b/i,
        /\b(expected|target)\s+(annual\s+)?(compensation|pay)\b/i,
        /\bcompensation\s+expectations?\b/i,
        /\bcompensation\b/i,
        /\b(pay|salary)\s+range\b/i,
      ],
      tagNames: ['input', 'textarea'],
    }),
    disabilityStatus: findGreenhouseSelectorsByLabel(root, {
      labelPatterns: [/\bdisability\b/i, /\bdisabled\b/i],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    gender: findGreenhouseSelectorsByLabel(root, {
      labelPatterns: [
        /\bgender\b/i,
        /\bsex\b/i,
        /\bwhich gender do you most identify\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    hispanicLatino: findGreenhouseSelectorsByLabel(root, {
      labelPatterns: [
        /\bhispanic\b/i,
        /\blatino\b/i,
        /\blatina\b/i,
        /\blatinx\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    linkedin: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [/\blinkedin(\s+profile)?\b/i],
      tagNames: ['input', 'textarea'],
    }),
    github: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /\bgithub(\s+profile|\s+url)?\b/i,
        /\bgit\s*hub\b/i,
      ],
      tagNames: ['input', 'textarea'],
    }),
    locationCity: findGreenhouseSelectorByLabel(root, {
      // Match labels that *ask for* the user's location as the answer, not
      // labels that merely reference "your current location" inside another
      // question (e.g. "Do you require sponsorship in your current
      // location?" — that's a yes/no sponsorship question, NOT a location
      // text field). Old `/\blocation\b/i` was matching the sponsorship
      // label and the planner was dumping "Portland, Oregon" into the
      // sponsorship select. Tightened patterns below match real location
      // prompts only.
      labelPatterns: [
        /\blocation\s*\(city\)\b/i,
        /\bcity\b/i,
        /^\s*location\s*\*?\s*$/i,
        /\bwhere\s+(?:are|do)\s+you\s+(?:currently\s+)?(?:located|live|residing|reside|based)\b/i,
        /\bcurrent\s+(?:city|location|residence|residency|address)\s*\*?\s*$/i,
        /^\s*(?:your\s+)?(?:city|town)\b/i,
      ],
      tagNames: ['input', 'textarea'],
    }),
    locationRequirement: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /\blocation requirement\b/i,
        /\bcurrently reside and work from the us\b/i,
        /\bbased\s+in\s+the\s+(us|united\s+states)\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    exportComplianceCitizenship: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /export administration regulations/i,
        /\bexport compliance\b/i,
        /\bu\.?s\.? person\b/i,
        /\bcitizenship\b/i,
        /\bpermanent residency\b/i,
      ],
      tagNames: [...GREENHOUSE_SELECT_TAGS, 'input'],
    }),
    questionAuthorized: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /\bauthorized to work\b/i,
        /\blegally authorized\b/i,
        /\bable to work\b/i,
        /\bright\s+to\s+work\b/i,
        /\beligible\s+to\s+work\b/i,
        /\bauthori[sz]ation\s+to\s+work\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    questionSponsorship: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /\brequire sponsorship\b/i,
        /\bimmigration sponsorship\b/i,
        /\bvisa status\b/i,
        /\bemployment visa\b/i,
        /\bvisa\s+sponsorship\b/i,
        /\b(now|in\s+the\s+future)\s+require\b.*\bsponsorship\b/i,
        // Indirect phrasings — Pinterest et al ask "Will you require our
        // assistance with work authorization now or in the future?" which
        // is the same yes/no signal as sponsorship.
        /\b(?:require|need)\s+(?:our\s+)?(?:assistance|help|support)\b.*\bwork\s+author(?:ization|ized)\b/i,
        /\bassistance\s+(?:with|obtaining)\s+work\s+author(?:ization|ized)\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    questionSponsorshipLabel: findGreenhouseLabelTextByPatterns(root, {
      labelPatterns: [
        /\brequire sponsorship\b/i,
        /\bimmigration sponsorship\b/i,
        /\bvisa status\b/i,
        /\bemployment visa\b/i,
        /\bvisa\s+sponsorship\b/i,
        /\b(?:require|need)\s+(?:our\s+)?(?:assistance|help|support)\b.*\bwork\s+author(?:ization|ized)\b/i,
        /\bassistance\s+(?:with|obtaining)\s+work\s+author(?:ization|ized)\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    race: findGreenhouseSelectorsByLabel(root, {
      labelPatterns: [
        /\brace\b/i,
        /\bethnicity\b/i,
        /\bethnic\b/i,
        /\brace\s*\/\s*ethnicity\b/i,
        /\bracial\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    referralSource: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /\bhow did you hear about (this opportunity|this job|us|this position|the role|this role)\b/i,
        /\bhow\s+did\s+you\s+find\s+(this|out about)\b/i,
        /\bwhere\s+did\s+you\s+(hear|learn)\b/i,
        /\breferred by\b/i,
        /\b(application|referral|job)\s+source\b/i,
        /\bsource\s+(of|for)\s+(this\s+)?(application|referral)\b/i,
      ],
      tagNames: ['input', 'textarea'],
    }),
    resume: findGreenhouseSelectorByLabel(root, {
      // Require resume/cv/curriculum-vitae in the label AND explicitly reject
      // anything that says "cover letter" — Greenhouse and many embedders
      // render the cover-letter file input next to the resume one with a
      // shared "Attach" wrapper label, which used to make the resume PDF land
      // in the cover-letter slot.
      labelPatterns: [/\b(resume|cv|curriculum vitae)\b/i],
      negativeLabelPatterns: [/\bcover\s*letter\b/i],
      tagNames: ['input[type="file"]'],
    }),
    coverLetter: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [/\bcover\s*letter\b/i],
      tagNames: ['input[type="file"]'],
    }),
    residence: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [
        /\bwhere do you currently reside\b/i,
        /\bcurrent residence\b/i,
      ],
      tagNames: ['input', 'textarea'],
    }),
    state: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [/\bstate\b/i, /\bprovince\b/i],
      tagNames: ['input', 'textarea', 'select'],
    }),
    veteranStatus: findGreenhouseSelectorsByLabel(root, {
      labelPatterns: [
        /\bveteran\b/i,
        /\bmilitary\b/i,
        /\barmed\s+forces\b/i,
        /\bprotected\s+veteran\b/i,
      ],
      tagNames: GREENHOUSE_SELECT_TAGS,
    }),
    website: findGreenhouseSelectorByLabel(root, {
      labelPatterns: [/\bwebsite\b/i, /\bportfolio\b/i, /\bpersonal url\b/i],
      tagNames: ['input', 'textarea'],
    }),
  };
}

async function fillOptionalGreenhouseFields(
  input: DesktopAgentRuntimeInput,
  aiProvider: DesktopAiProvider | undefined,
  identity: {
    readonly canadaWorkPreference?: string | null;
    readonly city: string | null;
    readonly country: string | null;
    readonly citizenshipStatus?: string | null;
    readonly disabilityStatus: string | null;
    readonly gender: string | null;
    readonly githubUrl: string | null;
    readonly hispanicLatino: string | null;
    readonly linkedinUrl: string | null;
    readonly race: string | null;
    readonly referralSource: string | null;
    readonly salaryExpectation: string | null;
    readonly sponsorshipRequired: string | null;
    readonly state: string | null;
    readonly veteranStatus: string | null;
    readonly websiteUrl: string | null;
    readonly workAuthorization: string | null;
  },
  selectors: GreenhouseFieldSelectors,
  resolveUnknownFieldAnswer?: ResolveUnknownFieldAnswer,
  lookupRecentVerificationCode?: LookupRecentVerificationCode,
): Promise<{
  readonly message: string;
  readonly status: DesktopAgentSessionStatus;
} | null> {
  const normalizedStateCode = normalizeStateCode(identity.state);
  const normalizedStateText = normalizeStateTextValue(identity.state);
  const locationValue = buildLocationValue(identity.city, normalizedStateText);
  const locationRequirementValue = inferLocationRequirementValue(
    identity.country,
  );
  const canadaLocationPreferenceValue = inferCanadaLocationPreferenceValue(
    identity.canadaWorkPreference ?? null,
    identity.country,
  );
  const authorizationValue = inferAuthorizationValue(
    identity.workAuthorization,
    identity.country,
  );
  const sponsorshipValue = inferSponsorshipValue(
    identity.sponsorshipRequired,
    selectors.questionSponsorshipLabel,
    identity.country,
  );

  // Poll-and-fill loop. Some Greenhouse layouts (e.g., Zeta) lazy-render
  // EEO fields like "Please identify your race" only after prior fields
  // are filled. Re-snapshot each iteration, fill any newly visible fields
  // we haven't tried yet, and exit once the form goes quiet (no new fields
  // for STABLE_TICKS_TO_EXIT iterations). Hispanic/Latino is deferred for
  // the first few iterations when race is wanted but not yet visible —
  // selecting "No" on hispanic hides race on those layouts.
  const attempted = new Set<string>();
  // Parallel set keyed by the raw CSS selector. The post-loop LLM fallback
  // and anti-bot scan walk the live DOM and look up selectors directly, so
  // they need the selector form (the planner's `attempted` set holds the
  // logical dedupe key, e.g. "country", which wouldn't match a DOM selector).
  const attemptedSelectors = new Set<string>();
  // Count how many times we've tried a given dedupeKey and got a missing-field
  // error. We don't want to retry forever (the field genuinely isn't on the
  // page) but we also don't want to give up after one iteration when the form
  // is still lazy-mounting subsequent sections.
  const missCounts = new Map<string, number>();
  const MAX_ITERATIONS = 10;
  const STABLE_TICKS_TO_EXIT = 2;
  const MAX_RACE_WAIT_ITERATIONS = 3;
  const MAX_MISSES_PER_FIELD = 4;
  let stableTicks = 0;
  let currentSelectors = selectors;

  for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
    if (iteration > 0) {
      currentSelectors = await loadGreenhouseFieldSelectors(input);
    }

    const wantsRace = !!identity.race?.trim();
    const raceVisible = currentSelectors.race.length > 0;
    const shouldDeferHispanic =
      wantsRace && !raceVisible && iteration < MAX_RACE_WAIT_ITERATIONS;

    const plan: Array<OptionalFill | null> = [
      fillOptionalFieldBySelector(
        input,
        currentSelectors.country ?? GREENHOUSE_COUNTRY_SELECTOR,
        {
          selectValue: normalizeCountrySelectValue(identity.country),
          textValue: normalizeCountryTextValue(identity.country),
        },
        'fill country',
        'country',
      ),
      fillLocationTypeahead(
        input,
        currentSelectors.locationCity ?? GREENHOUSE_LOCATION_SELECTOR,
        locationValue ?? identity.city,
        'fill location city',
        'locationCity',
      ),
      fillOptionalFieldBySelector(
        input,
        currentSelectors.state ?? GREENHOUSE_STATE_SELECTOR,
        { selectValue: normalizedStateCode, textValue: normalizedStateText },
        'fill state',
        'state',
      ),
      fillOptional(
        input,
        currentSelectors.cityAndStateQuestion,
        locationValue,
        'fill city and state response',
        'cityAndStateQuestion',
      ),
      selectOptional(
        input,
        currentSelectors.canadaLocationPreference,
        canadaLocationPreferenceValue,
        'select Canada location preference',
        'canadaLocationPreference',
      ),
      fillOptional(
        input,
        currentSelectors.linkedin,
        identity.linkedinUrl,
        'fill linkedin profile',
        'linkedin',
      ),
      fillOptional(
        input,
        currentSelectors.github,
        identity.githubUrl,
        'fill github profile',
        'github',
      ),
      fillOptional(
        input,
        currentSelectors.website,
        identity.websiteUrl,
        'fill website',
        'website',
      ),
      selectOptionalWithFallback(
        input,
        currentSelectors.referralSource,
        [
          identity.referralSource,
          'Other',
          'Other source',
          'Other (please specify)',
          'Web search',
          'Job board',
        ],
        'select referral source',
        'referralSource',
      ),
      selectOptional(
        input,
        currentSelectors.questionAuthorized ??
          GREENHOUSE_QUESTION_AUTHORIZED_SELECTOR,
        authorizationValue,
        'select work authorization',
        'questionAuthorized',
      ),
      selectOptional(
        input,
        currentSelectors.questionSponsorship ??
          GREENHOUSE_QUESTION_SPONSORSHIP_SELECTOR,
        sponsorshipValue,
        'select sponsorship requirement',
        'questionSponsorship',
      ),
      selectOptional(
        input,
        currentSelectors.locationRequirement,
        locationRequirementValue,
        'select location requirement',
        'locationRequirement',
      ),
      selectOptional(
        input,
        currentSelectors.exportComplianceCitizenship,
        identity.citizenshipStatus ?? null,
        'select export compliance citizenship status',
        'exportComplianceCitizenship',
      ),
      ...selectOptionalAll(
        input,
        currentSelectors.gender,
        identity.gender,
        'select gender',
        'gender',
      ),
      // Race must come before hispanic — choosing "No" on hispanic hides
      // the race field on some Greenhouse layouts (Zeta).
      ...selectOptionalAll(
        input,
        currentSelectors.race,
        identity.race,
        'select race',
        'race',
      ),
      ...(shouldDeferHispanic
        ? []
        : selectOptionalAll(
            input,
            currentSelectors.hispanicLatino,
            identity.hispanicLatino,
            'select hispanic latino',
            'hispanicLatino',
          )),
      ...selectOptionalAll(
        input,
        currentSelectors.veteranStatus,
        identity.veteranStatus,
        'select veteran status',
        'veteranStatus',
      ),
      ...selectOptionalAll(
        input,
        currentSelectors.disabilityStatus,
        identity.disabilityStatus,
        'select disability status',
        'disabilityStatus',
      ),
      fillOptional(
        input,
        currentSelectors.desiredSalary,
        identity.salaryExpectation,
        'fill desired salary',
        'desiredSalary',
      ),
      fillOptional(
        input,
        currentSelectors.residence,
        locationValue,
        'fill current residence',
        'residence',
      ),
    ];

    // Dedupe within an iteration by both dedupeKey and selector — if two
    // builders produced the same logical key (e.g. two regex patterns matched
    // the same field) we still only want to fire once. We also dedupe by raw
    // selector so distinct keys aiming at the same DOM node don't double-fire.
    const seenPlanKeys = new Set<string>();
    const seenPlanSelectors = new Set<string>();
    // Snapshot live form state once per iteration so we can skip planner
    // fills whose target field is already populated. Without this, retries
    // (continueFromCurrentPage = true) blow away values that the previous
    // attempt successfully committed — the user's "it keeps re-entering
    // every field" complaint — and a flaky select that re-renders on a
    // second click can lose its committed value mid-loop. NULL on snapshot
    // failure means "fall back to old behaviour, don't skip anything".
    const alreadyFilled = await readAlreadyFilledSelectorSet(input);
    const remaining = plan.filter((item): item is OptionalFill => {
      if (item === null) return false;
      const key = item.dedupeKey ?? item.selector;
      // Skip if either the logical key or the raw selector has already been
      // attempted in a prior iteration. This prevents the planner from
      // re-filling a selector that a chat correction already handled (the
      // correction keys by selector, the planner keys by logical id, so
      // without this they look like distinct items).
      if (attempted.has(key)) return false;
      if (attemptedSelectors.has(item.selector)) return false;
      if (seenPlanKeys.has(key)) return false;
      if (seenPlanSelectors.has(item.selector)) return false;
      if (alreadyFilled && alreadyFilled.has(item.selector)) {
        // Pre-filled by a prior attempt (continueFromCurrentPage retry) or
        // by the user mid-run. Add to attempted so the loop converges
        // toward "remaining: 0" and the stable-ticks exit fires.
        attempted.add(key);
        attemptedSelectors.add(item.selector);
        return false;
      }
      seenPlanKeys.add(key);
      seenPlanSelectors.add(item.selector);
      return true;
    });

    if (remaining.length === 0) {
      // Don't count "stable" while we're still waiting for race to mount.
      if (!shouldDeferHispanic) {
        stableTicks++;
        if (stableTicks >= STABLE_TICKS_TO_EXIT) break;
      }
      await sleep(250);
      continue;
    }

    stableTicks = 0;
    for (const { dedupeKey, retryOnMissing, selector, run } of remaining) {
      const key = dedupeKey ?? selector;
      const result = await run();
      if (!result.ok && isIgnorableMissingFieldError(result.error?.message)) {
        // Field isn't in the DOM yet (or never will be). Bump the miss count
        // and only give up after several iterations — lazy-mounted EEO fields
        // appear later in the run, so eagerly marking attempted-on-first-miss
        // (the old behavior) made us silently skip them forever.
        const misses = (missCounts.get(key) ?? 0) + 1;
        missCounts.set(key, misses);
        if (!retryOnMissing && misses >= MAX_MISSES_PER_FIELD) {
          attempted.add(key);
          attemptedSelectors.add(selector);
        }
        continue;
      }

      attempted.add(key);
      attemptedSelectors.add(selector);
      if (!result.ok) {
        return failed(result);
      }
    }
    await sleep(180);
  }

  const automationDisclosureChallenge = await findAutomationDisclosureChallenge(
    input,
    attemptedSelectors,
  );
  if (automationDisclosureChallenge) {
    return {
      message: `Manual review required: anti-bot disclosure field "${automationDisclosureChallenge.question}" must be answered by the user.`,
      status: 'paused_for_manual_review',
    };
  }

  if (resolveUnknownFieldAnswer) {
    await resolveRemainingFieldsWithLlm(
      input,
      resolveUnknownFieldAnswer,
      attemptedSelectors,
      aiProvider,
      lookupRecentVerificationCode,
    );
  }

  return null;
}

async function findAutomationDisclosureChallenge(
  input: DesktopAgentRuntimeInput,
  attemptedByPlanner: ReadonlySet<string>,
): Promise<UnansweredQuestion | null> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'scan anti-bot disclosure fields',
  );
  if (!snapshot.ok) return null;

  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return null;

  const fields = collectUnansweredQuestions(html, attemptedByPlanner);
  for (const field of fields) {
    let options = field.options;
    if (field.fieldType === 'select' && options.length === 0) {
      options = await readLiveSelectOptions(input, field.selector);
    }

    if (isAutomationDisclosureChallenge({ ...field, options })) {
      return field;
    }
  }

  return null;
}

const AUTOMATION_DISCLOSURE_SELECTOR_PATTERNS: readonly RegExp[] = [
  /\bbot[_-]?check\b/i,
  /\banti[_-]?bot\b/i,
  /\bcaptcha\b/i,
  /\bhuman[_-]?check\b/i,
  /\bare[_-]?you[_-]?human\b/i,
  /\bautomation[_-]?disclosure\b/i,
];

const AUTOMATION_DISCLOSURE_TEXT_PATTERNS: readonly RegExp[] = [
  /which of the following best describes you/i,
  /i am an ai or automated program/i,
  /i am a human being/i,
  /are you a human/i,
  /are you an automated program/i,
  /are you an ai/i,
];

function isAutomationDisclosureChallenge(field: UnansweredQuestion): boolean {
  if (
    AUTOMATION_DISCLOSURE_SELECTOR_PATTERNS.some(pattern =>
      pattern.test(field.selector),
    )
  ) {
    return true;
  }

  const text = `${field.question} ${field.options.join(' ')}`.toLowerCase();
  if (AUTOMATION_DISCLOSURE_TEXT_PATTERNS.some(pattern => pattern.test(text))) {
    return true;
  }

  const asksIdentity = /best\s+describes\s+you|are\s+you|identify\s+as/.test(
    text,
  );
  const namesAutomation = /\b(ai|bot|automated|automation|program)\b/.test(
    text,
  );
  const namesHuman = /\bhuman\b/.test(text);

  return asksIdentity && namesAutomation && namesHuman;
}

const VERIFICATION_CODE_TEXT_PATTERNS: readonly RegExp[] = [
  /verification\s+code/i,
  /verify\s+(?:your\s+)?(?:identity|email|account|address|application)/i,
  /one[-\s]?time\s+(?:code|password|pin)/i,
  /\botp\b/i,
  /security\s+code/i,
  /confirmation\s+code/i,
  /enter\s+the\s+(?:\d+[-\s]?digit\s+)?code/i,
  /\d+[-\s]?digit\s+(?:code|pin|number)/i,
  /email\s+(?:verification|confirmation|code)/i,
  /code\s+(?:we\s+)?(?:sent|emailed|just\s+sent)/i,
  /code\s+(?:from|in)\s+your\s+(?:email|inbox)/i,
  /check\s+your\s+(?:email|inbox)\s+for\s+(?:a\s+)?code/i,
  /confirm\s+your\s+email/i,
  /enter\s+(?:the\s+)?code/i,
];

// "Other Links", "Where else can we find you?", "Personal websites" — fields
// whose ideal answer depends on what was already filled into adjacent URL
// fields, so they need siblingUrls re-read per iteration and are excluded
// from the parallel-prefetch path.
function isUrlListField(field: UnansweredQuestion): boolean {
  if (field.fieldType !== 'textarea' && field.fieldType !== 'text') return false;
  const text = field.question.toLowerCase();
  if (!text) return false;
  return /(other\s+(?:links|urls|websites)|additional\s+(?:links|urls|websites)|where\s+else|personal\s+websites?\s+\(?other|other\s+social\s+media|portfolio\s+links?|other\s+profiles)/i.test(
    text,
  );
}

function isVerificationCodeField(field: UnansweredQuestion): boolean {
  if (field.fieldType !== 'text' && field.fieldType !== 'unknown') return false;
  const text = field.question.toLowerCase();
  if (!text) return false;
  return VERIFICATION_CODE_TEXT_PATTERNS.some(pattern => pattern.test(text));
}

function inferVerificationCodeDigits(field: UnansweredQuestion): number | null {
  const match = field.question.match(/(\d+)\s*[-\s]?\s*digit/i);
  if (!match) return null;
  const digits = Number.parseInt(match[1] ?? '', 10);
  if (!Number.isFinite(digits) || digits < 4 || digits > 12) return null;
  return digits;
}

interface VerificationCodeChallenge {
  readonly selector: string;
  readonly question: string;
  readonly expectedDigits: number | null;
}

// Scan the live DOM for a verification-code input that appeared after the
// initial submit click. Greenhouse's email-verification challenge replaces
// the application form with a single short-text input + a "We sent a code
// to your email" prompt; we key off the visible label / question text to
// disambiguate it from a normal text field.
async function detectVerificationCodeChallenge(
  input: DesktopAgentRuntimeInput,
): Promise<VerificationCodeChallenge | null> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'detect verification-code challenge',
  );
  if (!snapshot.ok) return null;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return null;
  const fields = collectUnansweredQuestions(html, new Set<string>());
  for (const field of fields) {
    if (!isVerificationCodeField(field)) continue;
    return {
      selector: field.selector,
      question: field.question,
      expectedDigits: inferVerificationCodeDigits(field),
    };
  }
  // Fallback for forms where the challenge label doesn't contain enough
  // word-shape to look "required" — sniff the body text for the prompt
  // phrasing, then pick the first short visible text input.
  const root = parse(html);
  const bodyText = (root.querySelector('body')?.text ?? '').toLowerCase();
  const looksLikeChallenge = VERIFICATION_CODE_TEXT_PATTERNS.some(p =>
    p.test(bodyText),
  );
  if (!looksLikeChallenge) return null;
  const inputs = root.querySelectorAll(
    'input[type="text"]:not([disabled]), input[type="tel"]:not([disabled]), input:not([type]):not([disabled])',
  );
  for (const candidate of inputs) {
    const maxLen = Number.parseInt(
      candidate.getAttribute('maxlength') ?? '',
      10,
    );
    const looksShort = Number.isFinite(maxLen) && maxLen >= 4 && maxLen <= 12;
    if (!looksShort) continue;
    const selector = selectorForNode(candidate);
    if (!selector) continue;
    return {
      selector,
      question: 'verification code',
      expectedDigits: Number.isFinite(maxLen) ? maxLen : null,
    };
  }
  return null;
}

// Poll the tracking inbox indefinitely (up to ~10 minutes) for a fresh
// verification code, filling it as soon as it arrives. Respects the
// autofill-pause gate so the user can suspend the wait without losing the
// session.
async function resolveVerificationCodeChallenge(
  input: DesktopAgentRuntimeInput,
  challenge: VerificationCodeChallenge,
  lookupRecentVerificationCode: LookupRecentVerificationCode,
): Promise<{ readonly ok: boolean; readonly code?: string }> {
  // 10 minutes / 4s polls = 150 attempts. The 30s background poller in
  // main.ts is also refreshing the cache during this window so the typical
  // wait is just one or two iterations once the email lands.
  const MAX_ATTEMPTS = 150;
  const RETRY_MS = 4000;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const lookup = await lookupRecentVerificationCode(
      challenge.expectedDigits ?? undefined,
    );
    if (lookup && lookup.code) {
      const fillResult = await call(
        input,
        'fill',
        { selector: challenge.selector, value: lookup.code },
        `post-submit verification-code fill (${challenge.question.slice(0, 60)})`,
      );
      console.log(
        `[greenhouse-submit] post-submit verification-code → ${
          fillResult.ok
            ? `filled (${lookup.digits} digits from ${lookup.fromEmail || 'inbox'})`
            : 'FAILED: ' + (fillResult.error?.message ?? 'unknown')
        }`,
      );
      if (fillResult.ok) {
        await sleep(200);
        return { ok: true, code: lookup.code };
      }
      return { ok: false };
    }
    if (attempt === 0) {
      console.log(
        `[greenhouse-submit] verification-code challenge detected; waiting for inbox email (poll every ${RETRY_MS}ms, up to ${(MAX_ATTEMPTS * RETRY_MS) / 60000}min)…`,
      );
    } else if (attempt % 15 === 0) {
      console.log(
        `[greenhouse-submit] still waiting for verification-code email (${attempt * RETRY_MS / 1000}s elapsed)…`,
      );
    }
    await sleep(RETRY_MS);
  }
  return { ok: false };
}

// After all rule-based fills run, scan the live DOM for any visible required
// fields that are still empty and ask the backend LLM to produce a value.
// We deliberately use the live document (via dom_snapshot) rather than the
// pre-computed selector list because the form may have lazy-mounted custom
// questions during the iteration loop.
export async function resolveRemainingFieldsWithLlm(
  input: DesktopAgentRuntimeInput,
  resolveUnknownFieldAnswer: ResolveUnknownFieldAnswer,
  attemptedByPlanner: ReadonlySet<string>,
  aiProvider: DesktopAiProvider | undefined,
  lookupRecentVerificationCode?: LookupRecentVerificationCode,
): Promise<void> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'scan unanswered fields',
  );
  if (!snapshot.ok) return;

  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return;

  const positions = readDomSnapshotPositions(snapshot.data);
  const fields = sortFieldsByVisualPosition(
    collectUnansweredQuestions(html, attemptedByPlanner),
    positions,
  );
  console.log(
    `[greenhouse-submit] LLM fallback: ${fields.length} unanswered required field(s) detected`,
    fields.map(f => ({
      fieldType: f.fieldType,
      question: f.question.slice(0, 60),
      selector: f.selector.slice(0, 80),
    })),
  );

  // Concurrently prefetch LLM answers for fields whose resolution does not
  // depend on the form's mutating state (i.e. anything that isn't a URL-list
  // textarea or a verification-code field). The serial loop below still
  // applies fills in visual order — only the LLM round-trips run in
  // parallel. For a Greenhouse form with ~8 LLM-fallback questions this
  // turns ~16s of wall time into ~3s.
  const prefetched = new Map<
    string,
    Promise<{
      readonly answer: string;
      readonly confidence: 'high' | 'medium' | 'low';
      readonly reasoning: string;
    } | null>
  >();
  // Cap each LLM round-trip. Steven asked autopilot to feel "quick" —
  // 45s is enough for OpenAI (usually <30s) and for a snappy local
  // Ollama. Slower local rigs that consistently exceed this cap should
  // set GIMMEJOB_LLM_TIMEOUT_MS in their .env.local to override.
  const LLM_TIMEOUT_MS = (() => {
    const raw = Number.parseInt(process.env.GIMMEJOB_LLM_TIMEOUT_MS ?? '', 10);
    return Number.isFinite(raw) && raw > 0 ? raw : 45_000;
  })();
  const withTimeout = <T>(
    promise: Promise<T>,
    label: string,
  ): Promise<T | null> =>
    new Promise<T | null>(resolve => {
      let settled = false;
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        console.warn(
          `[greenhouse-submit] LLM timeout after ${LLM_TIMEOUT_MS}ms on "${label.slice(0, 80)}" — skipping`,
        );
        resolve(null);
      }, LLM_TIMEOUT_MS);
      promise
        .then(value => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(value);
        })
        .catch(() => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          resolve(null);
        });
    });
  for (const field of fields) {
    if (lookupRecentVerificationCode && isVerificationCodeField(field)) continue;
    if (isUrlListField(field)) continue;
    // Don't prefetch select fields whose options need a live DOM
    // mount-and-scrape — that's still sequential because it requires
    // actually clicking the dropdown open.
    if (field.fieldType === 'select' && field.options.length === 0) continue;
    const key = field.selector;
    if (prefetched.has(key)) continue;
    prefetched.set(
      key,
      withTimeout(
        resolveUnknownFieldAnswer({
          aiProvider,
          fieldType: field.fieldType,
          options: field.options,
          question: field.question,
        }),
        field.question,
      ),
    );
  }

  for (const field of fields) {
    if (lookupRecentVerificationCode && isVerificationCodeField(field)) {
      const expectedDigits = inferVerificationCodeDigits(field);
      // Greenhouse only emails the code AFTER we click submit — if the agent
      // reached this field within ~5s of submission, the email may not have
      // arrived yet. Poll up to 6 times (4 second intervals = 24s window)
      // before giving up. The 30s background poller in main.ts will also be
      // refreshing the cache during this window.
      const MAX_LOOKUP_ATTEMPTS = 6;
      const LOOKUP_RETRY_MS = 4000;
      let lookup: Awaited<ReturnType<LookupRecentVerificationCode>> | null = null;
      for (let attempt = 0; attempt < MAX_LOOKUP_ATTEMPTS; attempt += 1) {
        lookup = await lookupRecentVerificationCode(
          expectedDigits ?? undefined,
        );
        if (lookup && lookup.code) break;
        if (attempt < MAX_LOOKUP_ATTEMPTS - 1) {
          console.log(
            `[greenhouse-submit] verification-code attempt ${attempt + 1} empty, polling inbox in ${LOOKUP_RETRY_MS}ms…`,
          );
          await sleep(LOOKUP_RETRY_MS);
        }
      }
      if (lookup && lookup.code) {
        const fillResult = await call(
          input,
          'fill',
          { selector: field.selector, value: lookup.code },
          `verification-code fill (${field.question.slice(0, 80)})`,
        );
        console.log(
          `[greenhouse-submit] verification-code "${field.question.slice(0, 60)}" → ${
            fillResult.ok
              ? `filled (${lookup.digits} digits from ${lookup.fromEmail || 'inbox'})`
              : 'FAILED: ' + (fillResult.error?.message ?? 'unknown')
          }`,
        );
        if (fillResult.ok) {
          await sleep(150);
          continue;
        }
      } else {
        console.log(
          `[greenhouse-submit] verification-code "${field.question.slice(0, 60)}": no recent code in inbox after ${MAX_LOOKUP_ATTEMPTS} attempts${
            expectedDigits ? ` (expected ${expectedDigits} digits)` : ''
          }`,
        );
      }
    }

    let liveOptions = field.options;

    // For custom selects (react-select / Greenhouse) the options aren't in
    // the static HTML — they only mount when the dropdown is open. Click the
    // control, snapshot the live DOM, and read what's actually available.
    // Without this the LLM gets options=[] and produces free-form prose
    // that gets typed into the search input by mistake.
    if (field.fieldType === 'select' && liveOptions.length === 0) {
      liveOptions = await readLiveSelectOptions(input, field.selector);
    }

    // Re-read the form's URL inputs each iteration so URLs the LLM filled
    // earlier in this same loop count as "already used" and don't get
    // re-listed inside an "Other Links" textarea.
    const siblingUrls = await readCurrentSiblingUrls(input);

    // Use the prefetched answer if one was kicked off in parallel earlier;
    // URL-list / verification / live-options fields fall through to a
    // sequential resolve since they depend on per-iteration state.
    const prefetchedAnswer = prefetched.get(field.selector);
    const answer = prefetchedAnswer
      ? await prefetchedAnswer
      : await withTimeout(
          resolveUnknownFieldAnswer({
            aiProvider,
            fieldType: field.fieldType,
            options: liveOptions,
            question: field.question,
            siblingUrls,
          }),
          field.question,
        );
    console.log(
      `[greenhouse-submit] LLM answer for "${field.question.slice(0, 60)}"`,
      {
        answerLength: answer?.answer.length ?? 0,
        answerPreview: answer?.answer.slice(0, 80) ?? null,
        confidence: answer?.confidence ?? null,
        liveOptionsCount: liveOptions.length,
      },
    );
    if (!answer || !answer.answer.trim()) {
      console.log(
        `[greenhouse-submit] skip "${field.question.slice(0, 60)}": empty answer`,
      );
      continue;
    }
    // For strict-option fields (select/radio/checkbox) we keep the
    // low-confidence drop because typing free-form prose into a dropdown
    // breaks the form. Free-text fields (text/textarea) get filled even on
    // low confidence — a partial answer the user can edit beats blank, and
    // local ollama models tend to under-rate their own confidence.
    const isStrictOption =
      field.fieldType === 'select' ||
      field.fieldType === 'radio' ||
      field.fieldType === 'checkbox';
    if (isStrictOption && answer.confidence === 'low') {
      console.log(
        `[greenhouse-submit] skip "${field.question.slice(0, 60)}": low confidence on ${field.fieldType}`,
      );
      continue;
    }

    // For selects with known options, map the LLM's free-form answer to the
    // closest matching option text (handles weak local-model output like
    // "I'd say Java" against ["Java", "Kotlin"] — gets typed verbatim into
    // the dropdown search input otherwise).
    let valueToFill = answer.answer.trim();
    if (field.fieldType === 'select' && liveOptions.length > 0) {
      const matched = findMatchingOption(answer.answer, liveOptions);
      if (!matched) {
        console.log(
          `[greenhouse-submit] skip select "${field.question.slice(0, 60)}": answer "${answer.answer.slice(0, 60)}" doesn't match any of ${liveOptions.length} option(s): ${liveOptions.slice(0, 6).join(' | ')}`,
        );
        continue;
      }
      valueToFill = matched;
    }

    // For checkboxes (consent gates like "I agree…", "By checking this box,
    // I consent…") the LLM's answer text doesn't matter — the form just
    // wants the box checked. Skip if the LLM said no/decline, otherwise
    // click to toggle on.
    const isCheckbox = field.fieldType === 'checkbox';
    const tool = isCheckbox
      ? 'click'
      : field.fieldType === 'select'
        ? 'select'
        : 'fill';
    if (isCheckbox) {
      const declined = /\b(no|decline|skip|do not|don'?t|never)\b/i.test(
        answer.answer,
      );
      if (declined) {
        console.log(
          `[greenhouse-submit] skip checkbox "${field.question.slice(0, 60)}": LLM answered "${answer.answer.slice(0, 40)}"`,
        );
        continue;
      }
    }
    // Build a `reason` string the admin desktop-submissions page can render —
    // surfaces *why* the resolver chose this answer (rule / deterministic /
    // LLM with confidence). Truncate the resolver's reasoning so the
    // run-log payload stays under the 200-byte-per-call comfort zone.
    const trimmedReasoning = answer.reasoning
      ? answer.reasoning.slice(0, 120)
      : '';
    const reasonSuffix = trimmedReasoning
      ? ` [${answer.confidence} · ${trimmedReasoning}]`
      : ` [${answer.confidence}]`;
    const fillReason = `LLM fallback ${tool} (${field.question.slice(0, 80)})${reasonSuffix}`;
    const fillResult =
      tool === 'click'
        ? await call(
            input,
            'click',
            { selector: field.selector },
            fillReason,
          )
        : tool === 'fill'
          ? await fillWithVerification(
              input,
              field.selector,
              valueToFill,
              fillReason,
            )
          : await call(
              input,
              tool,
              { selector: field.selector, value: valueToFill },
              fillReason,
            );
    console.log(
      `[greenhouse-submit] LLM ${tool} "${field.question.slice(0, 60)}" → ${fillResult.ok ? 'ok' : 'FAILED: ' + (fillResult.error?.message ?? 'unknown')}`,
    );
    await sleep(70);
  }
}

async function emitFormSnapshot(
  input: DesktopAgentRuntimeInput,
  request: DesktopSubmitLeadRequest,
): Promise<void> {
  if (!request.onFormSnapshot) return;
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'capture form snapshot',
  );
  if (!snapshot.ok) return;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return;

  const root = parse(html);
  const detected: Array<Omit<FormSnapshotField, 'value'>> = [];
  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="search"]), textarea, select, [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]',
  );
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const selector = selectorForNode(candidate);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);
    const tagName = candidate.tagName.toLowerCase();
    const type = (candidate.getAttribute('type') ?? 'text').toLowerCase();
    const role = candidate.getAttribute('role') ?? '';
    const isCombobox =
      role === 'combobox' || isInsideCustomSelectWidget(candidate);
    const fieldType =
      tagName === 'select' || isCombobox
        ? 'select'
        : tagName === 'textarea'
          ? 'textarea'
          : type === 'radio'
            ? 'radio'
            : type === 'checkbox'
              ? 'checkbox'
              : 'text';
    const label = readGreenhouseLabelText(root, candidate);
    if (!label) continue;
    detected.push({
      fieldType,
      label,
      options: readSelectOptionDetails(root, candidate),
      placeholder: readFieldPlaceholder(candidate),
      required: detectFieldRequired(root, candidate, label),
      selector,
    });
  }

  const fields: FormSnapshotField[] = [];
  for (const field of detected) {
    let options = field.options;
    if (field.fieldType === 'select' && options.length === 0) {
      options = (await readLiveSelectOptions(input, field.selector)).map(
        option => ({ label: option, value: option }),
      );
    }
    const value = await readFieldValue(input, field);
    fields.push({ ...field, options, value });
  }

  let hostname = '';
  try {
    hostname = new URL(request.applicationUrl).hostname;
  } catch {
    hostname = 'unknown';
  }

  await request.onFormSnapshot({
    applicationUrl: request.applicationUrl,
    fields,
    hostname,
    html,
    jobLeadId: request.jobLeadId,
  });
}

function detectFieldRequired(
  root: ReturnType<typeof parse>,
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
  label: string,
): boolean {
  // Greenhouse sets `required` and `aria-required="true"` on every input
  // regardless of whether the field is actually required. The only reliable
  // signal is the visible asterisk (or "(required)" text) in the label.
  if (/\*|\(required\)/i.test(label)) return true;
  const id = candidate.getAttribute('id');
  if (id) {
    const labelEl = root.querySelector(
      `label[for="${escapeAttributeValue(id)}"]`,
    );
    if (labelEl) {
      const indicator = labelEl.querySelector(
        '[class*="required" i], [aria-label*="required" i]',
      );
      if (indicator) return true;
      if (/\*|\(required\)/i.test(labelEl.text ?? '')) return true;
    }
  }
  const parentLabel = candidate.closest('label');
  if (parentLabel) {
    const indicator = parentLabel.querySelector(
      '[class*="required" i], [aria-label*="required" i]',
    );
    if (indicator) return true;
    if (/\*|\(required\)/i.test(parentLabel.text ?? '')) return true;
  }
  return false;
}

async function readFieldValue(
  input: DesktopAgentRuntimeInput,
  field: Omit<FormSnapshotField, 'value'>,
): Promise<string> {
  try {
    const result = await call(
      input,
      'read_element',
      { selector: field.selector },
      `read filled value for ${field.label}`,
    );
    if (!result.ok) return '';
    const data = result.data as
      | {
          attributes?: Record<string, string>;
          text?: string;
          value?: string | null;
        }
      | undefined;
    if (!data) return '';
    if (field.fieldType === 'checkbox' || field.fieldType === 'radio') {
      const checked =
        data.attributes?.['checked'] ?? data.attributes?.['aria-checked'] ?? '';
      if (checked && checked !== 'false') return 'checked';
      return '';
    }
    if (typeof data.value === 'string' && data.value.trim()) {
      return data.value.trim();
    }
    if (typeof data.text === 'string' && data.text.trim()) {
      return data.text.trim();
    }
    return '';
  } catch {
    return '';
  }
}

export async function readLiveSelectOptionsShared(
  input: DesktopAgentRuntimeInput,
  selector: string,
): Promise<string[]> {
  return readLiveSelectOptions(input, selector);
}

async function readLiveSelectOptions(
  input: DesktopAgentRuntimeInput,
  selector: string,
): Promise<string[]> {
  // Greenhouse's phone-country picker keeps ~250 [role="option"] items
  // mounted at all times. Snapshot before opening the field so we can
  // diff out anything that was already there.
  const baseline = await call(
    input,
    'dom_snapshot',
    {},
    'snapshot baseline options before open',
  );
  const baselineTexts = new Set<string>();
  if (baseline.ok) {
    const baselineHtml = readDomSnapshotHtml(baseline.data);
    if (baselineHtml) {
      const baselineRoot = parse(baselineHtml);
      const baselineCandidates = baselineRoot.querySelectorAll(
        '[role="option"], [class*="select__option"], [class*="-option-"], li[id*="option"], [data-option-value]',
      );
      for (const candidate of baselineCandidates) {
        const text = (candidate.text ?? '').trim();
        if (text && text.length <= 200) baselineTexts.add(text);
      }
    }
  }

  const open = await call(
    input,
    'click',
    { selector },
    'open dropdown to read options',
  );
  if (!open.ok) return [];
  await sleep(220);

  const live = await call(
    input,
    'dom_snapshot',
    {},
    'snapshot live dropdown options',
  );
  if (!live.ok) return [];
  const liveHtml = readDomSnapshotHtml(live.data);
  if (!liveHtml) return [];

  const root = parse(liveHtml);

  // Scope to the listbox actually associated with the clicked field —
  // Greenhouse's phone country picker renders ~250 always-mounted
  // [role="option"] items and otherwise bleeds into every other
  // dropdown's option list (Yes/No questions get 60 country names).
  type HtmlNode = ReturnType<typeof root.querySelector>;
  const target = root.querySelector(selector);
  const scopes: HtmlNode[] = [];
  const seenScope = new WeakSet<object>();
  const pushScope = (node: HtmlNode) => {
    if (!node) return;
    if (seenScope.has(node as unknown as object)) return;
    seenScope.add(node as unknown as object);
    scopes.push(node);
  };
  const lookupById = (id: string): HtmlNode =>
    root.querySelector('[id="' + id.replace(/"/g, '\\"') + '"]');
  const pushIdsFrom = (attr: string | undefined | null) => {
    if (!attr) return;
    for (const id of attr.split(/\s+/).filter(Boolean)) {
      pushScope(lookupById(id));
    }
  };
  if (target) {
    pushIdsFrom(target.getAttribute('aria-controls'));
    pushIdsFrom(target.getAttribute('aria-owns'));
    let walker: HtmlNode = target;
    for (let depth = 0; depth < 8 && walker; depth += 1) {
      const role = walker.getAttribute('role');
      if (role === 'combobox' || role === 'listbox') {
        pushIdsFrom(walker.getAttribute('aria-controls'));
        pushIdsFrom(walker.getAttribute('aria-owns'));
        pushScope(walker);
        break;
      }
      walker = walker.parentNode as HtmlNode;
    }
    if (scopes.length === 0) {
      walker = target;
      for (let depth = 0; depth < 12 && walker; depth += 1) {
        if (walker.querySelectorAll('[role="option"]').length > 0) {
          pushScope(walker);
          break;
        }
        walker = walker.parentNode as HtmlNode;
      }
    }
  }

  const optionTexts = new Set<string>();
  const optionSelector =
    '[role="option"], [class*="select__option"], [class*="-option-"], li[id*="option"], [data-option-value]';
  const searchRoots = scopes.length > 0 ? scopes : [root];
  for (const scope of searchRoots) {
    if (!scope) continue;
    const candidates = scope.querySelectorAll(optionSelector);
    for (const candidate of candidates) {
      const text = (candidate.text ?? '').trim();
      if (!text || text.length > 200) continue;
      // Skip options that were in the DOM before we opened this field.
      if (baselineTexts.has(text)) continue;
      optionTexts.add(text);
      if (optionTexts.size >= 60) break;
    }
    if (optionTexts.size >= 60) break;
  }

  // Close the dropdown again by clicking the body / pressing Escape so the
  // subsequent select tool call starts from a clean state.
  await call(
    input,
    'press_key',
    { key: 'Escape' },
    'close opened dropdown after option read',
  );
  await sleep(80);

  return Array.from(optionTexts);
}

function answerMatchesAnyOption(
  answer: string,
  options: readonly string[],
): boolean {
  return findMatchingOption(answer, options) !== null;
}

// Pick the option that best matches the LLM's answer text.
// Falls through several strategies in order so weak local-model output
// ("Java (with Kotlin experience)" → "Java") still maps to a real option
// instead of getting typed verbatim into the dropdown's search input.
function findMatchingOption(
  answer: string,
  options: readonly string[],
): string | null {
  const normalized = answer.trim().toLowerCase();
  if (!normalized) return null;

  // 1. Exact match
  for (const option of options) {
    if (option.trim().toLowerCase() === normalized) return option;
  }

  // 2. Bidirectional substring match (option contained in answer or vice versa)
  for (const option of options) {
    const optionNormalized = option.trim().toLowerCase();
    if (!optionNormalized) continue;
    if (
      optionNormalized.includes(normalized) ||
      normalized.includes(optionNormalized)
    ) {
      return option;
    }
  }

  // 3. Token-overlap match — split answer into words and find the option
  // that shares the most significant tokens. Useful when the LLM returns
  // free-form prose like "I'd say Java" against ["Java", "Kotlin"] options.
  const stopwords = new Set([
    'i',
    'a',
    'an',
    'and',
    'or',
    'is',
    'am',
    'the',
    'with',
    'in',
    'on',
    'of',
    'for',
    'to',
    'my',
    'me',
    'would',
    'say',
    'd',
    'be',
    'have',
    'it',
    'this',
    'that',
    "i'd",
  ]);
  const answerTokens = new Set(
    normalized
      .split(/[^a-z0-9+#-]+/)
      .filter(token => token && !stopwords.has(token)),
  );
  if (answerTokens.size === 0) return null;

  let best: { option: string; score: number } | null = null;
  for (const option of options) {
    const optionTokens = option
      .trim()
      .toLowerCase()
      .split(/[^a-z0-9+#-]+/)
      .filter(token => token && !stopwords.has(token));
    if (optionTokens.length === 0) continue;
    const overlap = optionTokens.filter(token =>
      answerTokens.has(token),
    ).length;
    if (overlap === 0) continue;
    const score = overlap / optionTokens.length;
    if (!best || score > best.score) {
      best = { option, score };
    }
  }
  // Require at least 50% of the option's significant tokens to appear so
  // a stray word doesn't promote a random option.
  return best && best.score >= 0.5 ? best.option : null;
}

// Best-guess gender from first name. Returns 'Male' / 'Female' for common
// strongly-gendered names, null when ambiguous (Alex, Pat, Sam, Casey…) or
// unrecognized — let the LLM resolver / "Decline to state" handle those.
// Greenhouse's gender prompt accepts these as option labels exactly.
const STRONG_MALE_NAMES = new Set([
  'aaron', 'adam', 'adrian', 'alan', 'albert', 'alex', 'alexander',
  'andrew', 'andy', 'anthony', 'arthur', 'austin', 'benjamin', 'bill',
  'billy', 'bob', 'bobby', 'brad', 'bradley', 'brandon', 'brett', 'brian',
  'bruce', 'bryan', 'caleb', 'calvin', 'cameron', 'carl', 'carlos',
  'chad', 'charles', 'charlie', 'chase', 'chris', 'christian',
  'christopher', 'cody', 'colin', 'connor', 'craig', 'cody', 'curtis',
  'daniel', 'danny', 'darren', 'dave', 'david', 'dean', 'dennis',
  'derek', 'derrick', 'devin', 'dominic', 'donald', 'doug', 'douglas',
  'drew', 'dustin', 'dylan', 'edward', 'eric', 'erik', 'ethan', 'eugene',
  'evan', 'felix', 'frank', 'fred', 'gabriel', 'gary', 'george',
  'gerald', 'glen', 'glenn', 'gordon', 'grant', 'greg', 'gregory',
  'harold', 'harry', 'hector', 'henry', 'howard', 'hugh', 'ian', 'isaac',
  'ivan', 'jack', 'jackson', 'jacob', 'jake', 'james', 'jamie', 'jared',
  'jason', 'jay', 'jayden', 'jeff', 'jeffrey', 'jeremy', 'jerry',
  'jesse', 'jim', 'jimmy', 'joe', 'joel', 'john', 'johnny', 'jon',
  'jonathan', 'jordan', 'jorge', 'jose', 'joseph', 'josh', 'joshua',
  'juan', 'justin', 'keith', 'kelvin', 'ken', 'kenneth', 'kevin', 'kirk',
  'kyle', 'lance', 'larry', 'lawrence', 'lee', 'leo', 'leonard', 'levi',
  'liam', 'logan', 'louis', 'lucas', 'luke', 'manuel', 'marcus', 'mark',
  'marshall', 'martin', 'marvin', 'mason', 'matt', 'matthew', 'max',
  'michael', 'miguel', 'mike', 'nathan', 'neil', 'nicholas', 'nick',
  'noah', 'norman', 'oliver', 'oscar', 'owen', 'patrick', 'paul', 'pedro',
  'peter', 'philip', 'phillip', 'preston', 'rafael', 'ralph', 'randy',
  'ray', 'raymond', 'reese', 'richard', 'rick', 'ricky', 'robert',
  'roger', 'roman', 'ron', 'ronald', 'roy', 'russell', 'ryan', 'samuel',
  'scott', 'sean', 'sergio', 'seth', 'shane', 'shawn', 'sidney', 'simon',
  'stanley', 'stephen', 'steve', 'steven', 'stuart', 'terrence', 'terry',
  'theodore', 'thomas', 'tim', 'timothy', 'tobias', 'todd', 'tom', 'tony',
  'travis', 'trevor', 'tyler', 'victor', 'vincent', 'walter', 'warren',
  'wayne', 'wesley', 'william', 'willie', 'xavier', 'zachary',
]);
const STRONG_FEMALE_NAMES = new Set([
  'abigail', 'addison', 'alexandra', 'alexis', 'alice', 'alicia',
  'alison', 'allison', 'amanda', 'amber', 'amy', 'andrea', 'angela',
  'angelica', 'anita', 'ann', 'anna', 'anne', 'annie', 'april', 'ashley',
  'audrey', 'aurora', 'autumn', 'ava', 'barbara', 'beatrice', 'becky',
  'beth', 'bethany', 'betty', 'beverly', 'bonnie', 'brenda', 'brianna',
  'brittany', 'brooklyn', 'caitlin', 'camila', 'candace', 'caroline',
  'carolyn', 'catherine', 'cathy', 'charlotte', 'cheryl', 'chloe',
  'christina', 'christine', 'cindy', 'claire', 'clara', 'colleen',
  'connie', 'courtney', 'crystal', 'cynthia', 'daisy', 'dana', 'danielle',
  'deanna', 'deb', 'debbie', 'deborah', 'debra', 'denise', 'destiny',
  'diana', 'diane', 'dolores', 'donna', 'doris', 'dorothy', 'edith',
  'eileen', 'elaine', 'eleanor', 'elena', 'elisabeth', 'elise',
  'elizabeth', 'ella', 'ellen', 'emily', 'emma', 'erica', 'erin',
  'esther', 'eva', 'evelyn', 'faith', 'felicia', 'fiona', 'frances',
  'gabriela', 'gabriella', 'gabrielle', 'georgia', 'gianna', 'gloria',
  'grace', 'gwen', 'gwendolyn', 'hannah', 'hazel', 'heather', 'heidi',
  'helen', 'holly', 'irene', 'isabel', 'isabella', 'isabelle', 'jacqueline',
  'jane', 'janet', 'janice', 'jasmine', 'jean', 'jeanette', 'jenna',
  'jennifer', 'jenny', 'jessica', 'jill', 'joan', 'joanna', 'joanne',
  'jocelyn', 'jodi', 'josephine', 'joy', 'joyce', 'judith', 'judy',
  'julia', 'julianne', 'julie', 'june', 'kara', 'karen', 'karla',
  'katherine', 'kathleen', 'kathryn', 'kathy', 'katie', 'kaylee',
  'kayla', 'kelly', 'kelsey', 'kendra', 'kim', 'kimberly', 'kira',
  'kristen', 'kristin', 'kristina', 'lacey', 'laura', 'lauren', 'leah',
  'lela', 'lillian', 'lily', 'linda', 'lisa', 'liz', 'lori', 'louise',
  'lucy', 'lydia', 'lyla', 'mackenzie', 'madeline', 'madison', 'maggie',
  'margaret', 'maria', 'marie', 'marilyn', 'marissa', 'martha', 'mary',
  'maureen', 'mckayla', 'megan', 'melanie', 'melissa', 'melody',
  'meredith', 'mia', 'michelle', 'mila', 'molly', 'monica', 'morgan',
  'nancy', 'naomi', 'natalie', 'natasha', 'nicole', 'nina', 'nora',
  'norah', 'olivia', 'pamela', 'patricia', 'paula', 'peggy', 'penelope',
  'phyllis', 'rachel', 'rebecca', 'regina', 'renee', 'rhonda', 'rita',
  'roberta', 'rosa', 'rose', 'ruby', 'ruth', 'samantha', 'sandra',
  'sara', 'sarah', 'savannah', 'shannon', 'shari', 'sharon', 'sheila',
  'sherry', 'shirley', 'sierra', 'sofia', 'sonia', 'sophia', 'sophie',
  'stacey', 'stephanie', 'stella', 'sue', 'susan', 'suzanne', 'sydney',
  'tamara', 'tammy', 'tara', 'taylor', 'teresa', 'terri', 'theresa',
  'tiffany', 'tina', 'tracy', 'valerie', 'vanessa', 'vera', 'veronica',
  'vicki', 'victoria', 'violet', 'virginia', 'vivian', 'wendy', 'willow',
  'yvonne', 'zoe', 'zoey',
]);

export function inferGenderFromFirstName(firstName: string): 'Male' | 'Female' | null {
  const normalized = firstName.trim().toLowerCase().split(/[\s-]/)[0];
  if (!normalized) return null;
  if (STRONG_MALE_NAMES.has(normalized)) return 'Male';
  if (STRONG_FEMALE_NAMES.has(normalized)) return 'Female';
  return null;
}

// Prepend preceding-question context to a question that looks like a
// follow-up. Example: "If Yes, describe your experience…" → if the
// preceding sibling question was "Have you worked with Apache Spark?"
// answered "No", we send "Previous question: 'Have you worked with
// Apache Spark?' answer: 'No'. If Yes, describe your experience…" to
// the LLM so it can correctly say "N/A" or skip describing.
const FOLLOW_UP_PREFIX_PATTERN = /^\s*if\s+(yes|no|so|applicable|that's|this|either|any|either of)/i;

function augmentFollowUpQuestion(
  root: ReturnType<typeof parse>,
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
  question: string,
): string {
  if (!FOLLOW_UP_PREFIX_PATTERN.test(question)) return question;
  const preceding = findPrecedingAnsweredField(root, candidate);
  if (!preceding) return question;
  return `[Context: previous question "${preceding.question}" was answered "${preceding.answer}"] ${question}`;
}

function findPrecedingAnsweredField(
  root: ReturnType<typeof parse>,
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): { question: string; answer: string } | null {
  // Walk every answered form field in document order; return the last one
  // that appears BEFORE the candidate. Cheap on small forms (Greenhouse
  // tops out around ~30 fields). We rely on the same `selectorForNode` +
  // `readGreenhouseLabelText` helpers used for the unanswered scan.
  type Node = ReturnType<ReturnType<typeof parse>['querySelector']>;
  const targetSelector = selectorForNode(candidate);
  if (!targetSelector) return null;

  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]), textarea, select, [role="combobox"]',
  );
  let lastAnswered: { question: string; answer: string } | null = null;
  for (const node of candidates) {
    if (!node) continue;
    const sel = selectorForNode(node);
    if (!sel) continue;
    if (sel === targetSelector) break; // Reached the candidate; stop.

    const tagName = node.tagName?.toLowerCase() ?? '';
    const role = node.getAttribute('role') ?? '';
    const isCustomCombobox =
      role === 'combobox' || isInsideCustomSelectWidget(node);

    let answer = '';
    if (tagName === 'select') {
      const selectedOption = node.querySelector('option[selected]');
      const text = selectedOption?.text?.trim() ?? '';
      const value = selectedOption?.getAttribute('value') ?? '';
      answer = text || value;
      if (/^select/i.test(answer)) answer = '';
    } else if (isCustomCombobox) {
      answer = readCustomSelectSelectedText(node) ?? '';
    } else {
      const inputValue = node.getAttribute('value') ?? '';
      const innerText = node.text?.trim() ?? '';
      answer = (inputValue || innerText).trim();
    }
    if (!answer) continue;
    const label = readGreenhouseLabelText(root, node);
    if (!label) continue;
    lastAnswered = { answer, question: label };
  }
  return lastAnswered;
}

interface UnansweredQuestion {
  readonly fieldType:
    | 'text'
    | 'textarea'
    | 'select'
    | 'radio'
    | 'checkbox'
    | 'unknown';
  readonly options: readonly string[];
  readonly question: string;
  readonly selector: string;
}

function collectUnansweredQuestions(
  html: string,
  attemptedByPlanner: ReadonlySet<string>,
): UnansweredQuestion[] {
  const root = parse(html);
  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]), textarea, select, [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]',
  );

  const seen = new Set<string>();
  const unanswered: UnansweredQuestion[] = [];

  for (const candidate of candidates) {
    const tagName = candidate.tagName.toLowerCase();
    const type = (candidate.getAttribute('type') ?? 'text').toLowerCase();
    const role = candidate.getAttribute('role') ?? '';

    if (type === 'file') continue;

    const selector = selectorForNode(candidate);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    // Skip selectors the rule-based planner already attempted — we don't want
    // to fill on top of an already-typed value (e.g. country dropdowns where
    // the planner set "United States" and the LLM would otherwise append "US").
    if (attemptedByPlanner.has(selector)) continue;

    const value = candidate.getAttribute('value');
    const innerText = candidate.text?.trim() ?? '';
    const isCustomCombobox =
      role === 'combobox' || isInsideCustomSelectWidget(candidate);
    if (isCustomCombobox && readCustomSelectSelectedText(candidate)) continue;

    // For checkbox/radio, `value` is the form-submit value (e.g. "1" for
    // a consent checkbox); the user-input state is in `checked`. Treat the
    // box as filled only when actually checked, otherwise the LLM resolver
    // never sees required consent checkboxes ("I agree", "By checking this
    // box, I consent to…") and the form bails at submit-guard.
    const isToggleInput = type === 'checkbox' || type === 'radio';
    const isChecked =
      isToggleInput &&
      (candidate.hasAttribute('checked') ||
        candidate.getAttribute('aria-checked') === 'true');
    if (isToggleInput) {
      if (isChecked) continue;
    } else {
      const hasValue = Boolean((value && value.trim()) || innerText);
      if (hasValue && tagName !== 'select' && !isCustomCombobox) continue;
    }

    if (tagName === 'select') {
      const selectedOption = candidate.querySelector('option[selected]');
      const selectedValue = selectedOption?.getAttribute('value') ?? '';
      if (selectedValue && !/^select/i.test(selectedValue)) continue;
    }

    const rawQuestion = readGreenhouseLabelText(root, candidate);
    if (!rawQuestion || rawQuestion.length < 4) continue;

    // Only fall through to the LLM fallback for *required* fields. Optional
    // fields (Education, Cover letter prompts, "Anything else?", etc.) are
    // best-effort at most — and historically the agent would happily generate
    // an LLM answer for them even though Greenhouse is fine with them being
    // empty, which slows runs down and produces noisy answers the user
    // didn't want.
    if (!detectFieldRequired(root, candidate, rawQuestion)) continue;

    // If this is a follow-up question ("If Yes, …" / "If No, …" / "If
    // applicable …"), prepend the preceding answered question + answer as
    // context so the LLM doesn't generate prose for a topic the user said
    // No to. (Otherwise it confidently fills "If Yes, describe your
    // experience" with React/frontend boilerplate even though the parent
    // question was about Apache Spark.)
    const question = candidate
      ? augmentFollowUpQuestion(root, candidate, rawQuestion)
      : rawQuestion;

    // Skip the standard top-of-form basic fields whose selectors the
    // rule-based phase already targeted (input#first_name etc). Custom
    // questions like "What is your legal first name?" carry the same
    // word "name" in the text but live on a different selector — those
    // need to fall through to the LLM/profile fallback so they get
    // filled with the user's identity rather than left blank.
    const selectorIsStandardBasic =
      /input#(?:first_name|last_name|email|phone)\b/i.test(selector) ||
      /\binput\[name=("|')(?:first_name|last_name|email|phone)\1\]/i.test(
        selector,
      );
    const questionIsExactBasic =
      /^(?:email(?:\s+address)?|phone(?:\s+number)?|first\s+name|last\s+name|resume|linkedin(?:\s+url)?|linkedin\s+profile)$/i.test(
        question,
      );
    if (selectorIsStandardBasic || questionIsExactBasic) {
      continue;
    }

    const fieldType: UnansweredQuestion['fieldType'] =
      tagName === 'select' || isCustomCombobox
        ? 'select'
        : tagName === 'textarea'
          ? 'textarea'
          : type === 'radio'
            ? 'radio'
            : type === 'checkbox'
              ? 'checkbox'
              : 'text';

    const options =
      fieldType === 'select' ? readSelectOptionTexts(root, candidate) : [];

    unanswered.push({
      fieldType,
      options,
      question,
      selector,
    });

    if (unanswered.length >= 25) break;
  }

  return unanswered;
}

// react-select / Greenhouse custom combobox: the input itself doesn't always
// carry role="combobox", but the surrounding widget does. Walk up a few levels
// to detect that case so we route to the keyboard-fallback select tool.
function isInsideCustomSelectWidget(
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): boolean {
  type ParseNode = typeof candidate;
  let node: ParseNode | null = candidate.parentNode as ParseNode | null;
  for (let depth = 0; depth < 5 && node; depth++) {
    const hasAttr = typeof (node as ParseNode).getAttribute === 'function';
    if (hasAttr) {
      const cls = (node as ParseNode).getAttribute('class') ?? '';
      const role = (node as ParseNode).getAttribute('role') ?? '';
      const ariaHaspopup =
        (node as ParseNode).getAttribute('aria-haspopup') ?? '';
      if (
        role === 'combobox' ||
        role === 'listbox' ||
        ariaHaspopup === 'listbox' ||
        ariaHaspopup === 'menu' ||
        /select__control|select-control|combobox|dropdown|listbox/i.test(cls)
      ) {
        return true;
      }
    }
    node = (node as ParseNode).parentNode as ParseNode | null;
  }
  return false;
}

function readCustomSelectSelectedText(
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): string | null {
  type ParseNode = typeof candidate;
  let node: ParseNode | null = candidate.parentNode as ParseNode | null;
  for (let depth = 0; depth < 5 && node; depth++) {
    const selectedNodes = (node as ParseNode).querySelectorAll(
      '[class], [aria-selected="true"], [data-selected], [data-value]',
    );

    for (const selectedNode of selectedNodes) {
      const cls = selectedNode.getAttribute('class') ?? '';
      const isSelectedValue =
        /single.?value|multi.?value|selected.?value|select__value|selected/i.test(
          cls,
        ) || selectedNode.getAttribute('aria-selected') === 'true';
      if (!isSelectedValue) continue;

      const text = normalizeFieldLabelText(selectedNode.text ?? '');
      if (text && !isSelectPlaceholderText(text)) return text;
    }

    node = (node as ParseNode).parentNode as ParseNode | null;
  }

  return null;
}

function isSelectPlaceholderText(value: string): boolean {
  return /^(select|choose|please select|search|type to search|start typing|\.\.\.)/i.test(
    value.trim(),
  );
}

function readSelectOptionTexts(
  root: ReturnType<typeof parse>,
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): string[] {
  return readSelectOptionDetails(root, candidate).map(option => option.label);
}

function readSelectOptionDetails(
  root: ReturnType<typeof parse>,
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): Array<{ label: string; value: string }> {
  // Native <select>
  const nativeOptions = candidate.querySelectorAll('option');
  if (nativeOptions.length > 0) {
    return nativeOptions
      .map(option => {
        const label = (option.text ?? '').trim();
        const value = (option.getAttribute('value') ?? label).trim();
        return { label, value };
      })
      .filter(option => option.label && !/^select/i.test(option.label));
  }

  // Custom dropdown: scan adjacent menu by aria-controls
  const controls = candidate.getAttribute('aria-controls');
  if (controls) {
    const menu = root.querySelector(`#${controls}`);
    if (menu) {
      return menu
        .querySelectorAll('[role="option"], li, [class*="option"]')
        .map(option => {
          const label = (option.text ?? '').trim();
          const value = (
            option.getAttribute('data-value') ??
            option.getAttribute('value') ??
            option.getAttribute('id') ??
            label
          ).trim();
          return { label, value };
        })
        .filter(option => Boolean(option.label));
    }
  }

  return [];
}

function readFieldPlaceholder(
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): string | null {
  const placeholder = normalizeFieldLabelText(
    candidate.getAttribute('placeholder') ?? '',
  );
  return placeholder || null;
}

interface OptionalFill {
  readonly retryOnMissing?: boolean;
  readonly selector: string;
  readonly run: () => Promise<DesktopToolCallResult>;
  // Logical identity of the field (e.g. "country", "race[0]"). When two
  // resolution paths land on the same selector for different intents, the
  // dedupe key keeps them distinct. When omitted the selector is used.
  readonly dedupeKey?: string;
}

// Snapshot the live form once and return the set of selectors whose target
// field is already populated (non-empty text value, non-empty `value`
// attribute, or `checked` for toggle inputs / aria-checked for custom
// widgets). Used by the planner loop to skip re-firing fills on retry
// attempts so already-committed values don't get clobbered.
async function readAlreadyFilledSelectorSet(
  input: DesktopAgentRuntimeInput,
): Promise<Set<string> | null> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'snapshot pre-fill state',
  );
  if (!snapshot.ok) return null;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return null;
  let root: ReturnType<typeof parse>;
  try {
    root = parse(html);
  } catch {
    return null;
  }
  const filled = new Set<string>();
  const candidates = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="image"]):not([type="reset"]):not([type="file"]), textarea, select, [role="combobox"]',
  );
  for (const candidate of candidates) {
    const selector = selectorForNode(candidate);
    if (!selector) continue;
    const tagName = candidate.tagName.toLowerCase();
    const type = (candidate.getAttribute('type') ?? 'text').toLowerCase();
    if (type === 'checkbox' || type === 'radio') {
      const isChecked =
        candidate.hasAttribute('checked') ||
        candidate.getAttribute('aria-checked') === 'true';
      if (isChecked) filled.add(selector);
      continue;
    }
    if (tagName === 'select') {
      const selectedOption = candidate.querySelector('option[selected]');
      const selectedValue = selectedOption?.getAttribute('value') ?? '';
      if (selectedValue && !/^select/i.test(selectedValue)) {
        filled.add(selector);
      }
      continue;
    }
    const valueAttr = (candidate.getAttribute('value') ?? '').trim();
    if (valueAttr) {
      filled.add(selector);
      continue;
    }
    const role = candidate.getAttribute('role') ?? '';
    const isCustomCombobox =
      role === 'combobox' || isInsideCustomSelectWidget(candidate);
    if (isCustomCombobox) {
      const selectedText = readCustomSelectSelectedText(candidate);
      if (selectedText) filled.add(selector);
      continue;
    }
    if (tagName === 'textarea') {
      const text = (candidate.text ?? '').trim();
      if (text) filled.add(selector);
    }
  }
  return filled;
}

function fillOptional(
  input: DesktopAgentRuntimeInput,
  selector: string | null,
  value: string | null,
  reason: string,
  dedupeKey?: string,
): OptionalFill | null {
  if (!selector || !value?.trim()) return null;
  return {
    dedupeKey,
    selector,
    run: () => call(input, 'fill', { selector, value: value.trim() }, reason),
  };
}

// Greenhouse Location (City) is a typeahead input — programmatic value-set is
// not enough; the form needs an option clicked from the suggestion popup so
// the underlying lat/lng / place_id fields commit. We focus, fill, wait for
// the listbox to populate, then click a specific matching option by its
// unique id selector (the keyboard ArrowDown+Enter path silently no-ops on
// the modern Greenhouse layout).
function fillLocationTypeahead(
  input: DesktopAgentRuntimeInput,
  selector: string | null,
  value: string | null,
  reason: string,
  dedupeKey?: string,
): OptionalFill | null {
  if (!selector || !value?.trim()) return null;
  const trimmed = value.trim();
  // Greenhouse's "Locate me" widget renders options under several different
  // class/role combinations depending on which Greenhouse vintage is hosting
  // the form (job-boards.greenhouse.io's React rewrite vs the older
  // boards.greenhouse.io). Cover them all.
  const OPTION_SELECTOR =
    '[role="option"], .pac-item, .select__option, [class*="suggestion"]';
  return {
    dedupeKey,
    selector,
    run: async () => {
      // Focus the input so the subsequent press_key calls reach it.
      await call(input, 'click', { selector }, `${reason}: focus input`);

      const fillResult = await call(
        input,
        'fill',
        { selector, value: trimmed },
        reason,
      );
      if (!fillResult.ok) return fillResult;

      // Give the suggestion list a chance to populate from the API.
      const waitResult = await call(
        input,
        'wait_for',
        { selector: OPTION_SELECTOR, timeoutMs: 3500 },
        `${reason}: wait for typeahead options`,
      );
      if (!waitResult.ok) {
        // No options surfaced — fall back to the plain fill result and let
        // downstream validation handle it.
        return fillResult;
      }

      const committed = await commitTypeaheadOption(
        input,
        selector,
        trimmed,
        reason,
      );

      if (!committed) {
        // Keyboard fallback for older Greenhouse vintages where the
        // listbox isn't directly click-targetable.
        await call(
          input,
          'press_key',
          { key: 'ArrowDown' },
          `${reason}: highlight (keyboard fallback)`,
        );
        await call(
          input,
          'press_key',
          { key: 'Enter' },
          `${reason}: select (keyboard fallback)`,
        );
      }
      return fillResult;
    },
  };
}

// Poll the live DOM for typeahead options scoped to the input's listbox
// (via aria-controls / aria-owns or by walking ancestors looking for a
// container with [role=option] children), pick the best match for the
// typed value, and click that specific option by a unique selector. Click
// via `[role=option]` alone is ambiguous — Greenhouse pages frequently
// have multiple listboxes attached (countries, schools, etc.) and the
// first-match in document order is rarely the location dropdown's row.
async function commitTypeaheadOption(
  input: DesktopAgentRuntimeInput,
  inputSelector: string,
  expectedValue: string,
  reason: string,
): Promise<boolean> {
  const expectedLower = expectedValue.toLowerCase();
  const expectedFirstToken =
    expectedLower.split(/[,\s]+/).filter(Boolean)[0] ?? expectedLower;

  for (let attempt = 0; attempt < 8; attempt += 1) {
    if (attempt > 0) await sleep(250);
    const snapshot = await call(
      input,
      'dom_snapshot',
      {},
      `${reason}: locate typeahead option`,
    );
    if (!snapshot.ok) continue;
    const html = readDomSnapshotHtml(snapshot.data);
    if (!html) continue;
    let root;
    try {
      root = parse(html);
    } catch {
      continue;
    }
    const target = root.querySelector(inputSelector);
    if (!target) continue;

    const scopes: HTMLElement[] = [];
    const seen = new WeakSet<object>();
    const pushScope = (node: HTMLElement | null) => {
      if (!node) return;
      if (seen.has(node as unknown as object)) return;
      seen.add(node as unknown as object);
      scopes.push(node);
    };
    const lookupById = (id: string): HTMLElement | null =>
      root.querySelector(
        `[id="${cssEscapeAttr(id)}"]`,
      ) as HTMLElement | null;
    const pushIdsFrom = (attr: string | null | undefined) => {
      if (!attr) return;
      for (const id of attr.split(/\s+/).filter(Boolean)) {
        pushScope(lookupById(id));
      }
    };

    pushIdsFrom(target.getAttribute('aria-controls'));
    pushIdsFrom(target.getAttribute('aria-owns'));
    let walker: HTMLElement | null = target as HTMLElement;
    for (let depth = 0; depth < 10 && walker; depth += 1) {
      pushIdsFrom(walker.getAttribute?.('aria-controls'));
      pushIdsFrom(walker.getAttribute?.('aria-owns'));
      walker = walker.parentNode as HTMLElement | null;
    }
    if (scopes.length === 0) {
      walker = target as HTMLElement;
      for (let depth = 0; depth < 12 && walker; depth += 1) {
        if (walker.querySelectorAll?.('[role="option"]').length > 0) {
          pushScope(walker);
          break;
        }
        walker = walker.parentNode as HTMLElement | null;
      }
    }
    if (scopes.length === 0) pushScope(root as unknown as HTMLElement);

    const OPTION_SELECTOR =
      '[role="option"], .pac-item, .select__option, [class*="suggestion"]';

    for (const scope of scopes) {
      const options = scope.querySelectorAll(OPTION_SELECTOR);
      let prefixMatch: HTMLElement | null = null;
      let tokenMatch: HTMLElement | null = null;
      let firstReal: HTMLElement | null = null;
      for (const opt of options) {
        const text = (opt.text ?? '').trim();
        if (!text) continue;
        if (/^(loading|searching|please wait|no results)/i.test(text)) {
          continue;
        }
        const textLower = text.toLowerCase();
        if (!firstReal) firstReal = opt as HTMLElement;
        if (!prefixMatch && textLower.startsWith(expectedLower)) {
          prefixMatch = opt as HTMLElement;
          break;
        }
        if (!tokenMatch && textLower.includes(expectedFirstToken)) {
          tokenMatch = opt as HTMLElement;
        }
      }
      const pick = prefixMatch ?? tokenMatch ?? firstReal;
      if (!pick) continue;
      const optSelector = selectorForOptionElement(pick);
      if (!optSelector) continue;
      const optText = (pick.text ?? '').trim().slice(0, 60);
      const clickResult = await call(
        input,
        'click',
        { selector: optSelector },
        `${reason}: click typeahead option "${optText}"`,
      );
      if (!clickResult.ok) continue;
      await sleep(150);
      const after = await readFieldValueBySelector(input, inputSelector);
      if (after && after.trim().length > 0) return true;
    }
  }
  return false;
}

function selectorForOptionElement(element: HTMLElement): string | null {
  const id = element.getAttribute?.('id');
  if (id) return `[id="${cssEscapeAttr(id)}"]`;
  const dataAttrs = [
    'data-value',
    'data-option-value',
    'data-testid',
    'data-id',
  ];
  for (const attr of dataAttrs) {
    const value = element.getAttribute?.(attr);
    if (value) {
      return `${element.tagName.toLowerCase()}[${attr}="${cssEscapeAttr(value)}"]`;
    }
  }
  return null;
}

function selectOptional(
  input: DesktopAgentRuntimeInput,
  selector: string | null,
  value: string | null,
  reason: string,
  dedupeKey?: string,
): OptionalFill | null {
  if (!selector || !value?.trim()) return null;
  return {
    dedupeKey,
    selector,
    run: () => call(input, 'select', { selector, value: value.trim() }, reason),
  };
}

// Try a select with the user's preferred value first; if that option
// doesn't exist on this form, walk a fallback chain (e.g. "Other",
// "Other source"). Used for referral-source selects where the user's
// profile lists "Gimme Job" but the dropdown only contains a fixed set
// of options like LinkedIn / Indeed / Other.
function selectOptionalWithFallback(
  input: DesktopAgentRuntimeInput,
  selector: string | null,
  values: readonly (string | null)[],
  reason: string,
  dedupeKey?: string,
): OptionalFill | null {
  if (!selector) return null;
  const candidates = values
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(v => v.length > 0);
  if (candidates.length === 0) return null;
  return {
    dedupeKey,
    selector,
    run: async () => {
      let lastResult: DesktopToolCallResult | null = null;
      for (const value of candidates) {
        const result = await call(
          input,
          'select',
          { selector, value },
          `${reason} → "${value}"`,
        );
        if (result.ok) return result;
        lastResult = result;
      }
      // None of the candidates matched. Return the last result so the
      // caller can decide; downstream the LLM resolver picks up the slack.
      return (
        lastResult ?? {
          error: { code: 'select_failed', message: 'No matching option' },
          ok: false,
          tool: 'select',
        }
      );
    },
  };
}

function selectOptionalAll(
  input: DesktopAgentRuntimeInput,
  selectors: readonly string[],
  value: string | null,
  reason: string,
  dedupeKeyPrefix?: string,
): OptionalFill[] {
  if (!value?.trim() || selectors.length === 0) return [];
  return selectors.map((selector, index) => {
    const reasonForSelector =
      selectors.length > 1 ? `${reason} (#${index + 1})` : reason;
    return {
      dedupeKey: dedupeKeyPrefix ? `${dedupeKeyPrefix}[${index}]` : undefined,
      selector,
      run: () =>
        call(
          input,
          'select',
          { selector, value: value.trim() },
          reasonForSelector,
        ),
    };
  });
}

function emptyGreenhouseFieldSelectors(): GreenhouseFieldSelectors {
  return {
    cityAndStateQuestion: null,
    canadaLocationPreference: null,
    country: null,
    desiredSalary: null,
    disabilityStatus: [],
    gender: [],
    hispanicLatino: [],
    github: null,
    linkedin: null,
    locationCity: null,
    locationRequirement: null,
    exportComplianceCitizenship: null,
    questionAuthorized: null,
    questionSponsorship: null,
    questionSponsorshipLabel: null,
    race: [],
    referralSource: null,
    resume: null,
    coverLetter: null,
    residence: null,
    state: null,
    veteranStatus: [],
    website: null,
  };
}

function normalizeCountrySelectValue(country: string | null): string | null {
  if (!country) return null;
  const normalized = country.trim().toUpperCase();
  if (normalized in COUNTRY_LABELS) {
    return normalized;
  }
  if (country.trim().toLowerCase() === 'united states') {
    return 'US';
  }
  return country.trim();
}

function normalizeCountryTextValue(country: string | null): string | null {
  const normalizedCode = normalizeCountrySelectValue(country);
  if (!normalizedCode) return null;
  return COUNTRY_LABELS[normalizedCode] ?? country?.trim() ?? null;
}

function normalizeStateCode(state: string | null): string | null {
  if (!state) return null;
  const normalized = state.trim().toUpperCase();
  if (normalized in US_STATE_LABELS) {
    return normalized;
  }

  const matchingEntry = Object.entries(US_STATE_LABELS).find(
    ([, label]) => label.toLowerCase() === state.trim().toLowerCase(),
  );

  return matchingEntry?.[0] ?? state.trim();
}

function normalizeStateTextValue(state: string | null): string | null {
  const normalizedCode = normalizeStateCode(state);
  if (!normalizedCode) return null;
  return US_STATE_LABELS[normalizedCode] ?? state?.trim() ?? null;
}

function fillOptionalFieldBySelector(
  input: DesktopAgentRuntimeInput,
  selector: string | null,
  value: {
    readonly selectValue: string | null;
    readonly textValue: string | null;
  },
  reason: string,
  dedupeKey?: string,
): OptionalFill | null {
  if (!selector) return null;
  if (selector.trim().toLowerCase().startsWith('select')) {
    return selectOptional(
      input,
      selector,
      value.selectValue,
      reason,
      dedupeKey,
    );
  }
  // The target may be either a plain text input or an `<input>` inside a
  // custom combobox widget (e.g. Greenhouse's react-select country prefix).
  // Try the select tool first — for combobox widgets it routes through the
  // keyboard fallback (focus + type + Enter), which actually picks an
  // option. For plain text inputs the select tool's combobox detection
  // returns null and we fall through to fill.
  const preferredValue = value.textValue ?? value.selectValue;
  const fallbackValue = value.textValue ?? value.selectValue;
  if (!preferredValue?.trim()) return null;
  return {
    dedupeKey,
    selector,
    run: async () => {
      const selectResult = await call(
        input,
        'select',
        { selector, value: preferredValue.trim() },
        `${reason} (try select)`,
      );
      if (selectResult.ok) return selectResult;
      const message = selectResult.error?.message ?? '';
      // If the select tool genuinely couldn't find a combobox or option
      // for this selector, fall back to a plain fill against the text input.
      if (
        /not found|did not match|select option not found|select target not found/i.test(
          message,
        ) &&
        fallbackValue?.trim()
      ) {
        return call(
          input,
          'fill',
          { selector, value: fallbackValue.trim() },
          `${reason} (fill fallback)`,
        );
      }
      return selectResult;
    },
  };
}

function inferAuthorizationValue(
  workAuthorization: string | null,
  country: string | null,
): string | null {
  const normalized = workAuthorization?.trim().toLowerCase();
  if (normalized) {
    if (
      normalized === 'yes' ||
      normalized === 'y' ||
      normalized.includes('authorized')
    ) {
      return 'yes';
    }
    if (
      normalized === 'no' ||
      normalized === 'n' ||
      normalized.includes('not authorized')
    ) {
      return 'no';
    }
  }

  return inferLocationRequirementValue(country);
}

function inferLocationRequirementValue(country: string | null): string | null {
  if (!country) return null;
  return /^(us|usa|united states)$/i.test(country.trim()) ? 'yes' : 'no';
}

function inferCanadaLocationPreferenceValue(
  canadaWorkPreference: string | null,
  country: string | null,
): string | null {
  const normalizedPreference = canadaWorkPreference?.trim().toLowerCase();
  if (normalizedPreference) {
    if (['yes', 'y', 'true', '1'].includes(normalizedPreference)) return 'yes';
    if (['no', 'n', 'false', '0'].includes(normalizedPreference)) return 'no';
    return canadaWorkPreference;
  }

  if (!country) return null;
  return /^(ca|can|canada)$/i.test(country.trim()) ? 'yes' : 'no';
}

function inferSponsorshipValue(
  sponsorshipRequired: string | null,
  questionLabel: string | null,
  userCountry: string | null,
): string | null {
  // If the question targets a country other than the user's home country,
  // sponsorship is required regardless of the stored boolean — the user
  // doesn't have authorization to work in the foreign country.
  const targetCountry = extractCountryFromSponsorshipLabel(questionLabel);
  if (targetCountry && userCountry) {
    if (!countriesMatch(targetCountry, userCountry)) return 'yes';
  }

  const normalized = sponsorshipRequired?.trim().toLowerCase();
  if (!normalized) return null;
  if (['yes', 'y', 'true', '1'].includes(normalized)) return 'yes';
  if (['no', 'n', 'false', '0'].includes(normalized)) return 'no';
  return sponsorshipRequired;
}

function extractCountryFromSponsorshipLabel(
  label: string | null,
): string | null {
  if (!label) return null;
  // Match "...sponsorship to work for X in Canada?" / "...visa to work in the US?"
  const match = label.match(
    /\bin\s+(?:the\s+)?(united states|usa|us|america|canada|united kingdom|uk|england|britain|ireland|germany|france|spain|italy|netherlands|australia|new zealand|japan|china|india|mexico|brazil|singapore|hong kong|south korea|argentina|chile|colombia)\b/i,
  );
  return match?.[1]?.trim() ?? null;
}

function countriesMatch(a: string, b: string): boolean {
  const normalize = (value: string): string => {
    const lower = value.trim().toLowerCase();
    if (/^(us|usa|united states|america)$/.test(lower)) return 'us';
    if (/^(uk|united kingdom|england|britain)$/.test(lower)) return 'uk';
    if (/^(ca|can|canada)$/.test(lower)) return 'ca';
    return lower;
  };
  return normalize(a) === normalize(b);
}

function buildLocationValue(
  city: string | null,
  state: string | null,
): string | null {
  if (city && state) return `${city}, ${state}`;
  return city ?? state ?? null;
}

export function readDomSnapshotHtml(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const html = (data as Record<string, unknown>).html;
  return typeof html === 'string' && html.length > 0 ? html : null;
}

export function readDomSnapshotTitle(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const title = (data as Record<string, unknown>).title;
  return typeof title === 'string' && title.length > 0 ? title : null;
}

export function readDomSnapshotPositions(
  data: unknown,
): Record<string, { top: number; left: number }> {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return {};
  const positions = (data as Record<string, unknown>).positions;
  if (!positions || typeof positions !== 'object' || Array.isArray(positions)) {
    return {};
  }
  const out: Record<string, { top: number; left: number }> = {};
  for (const [key, value] of Object.entries(positions as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const top = (value as Record<string, unknown>).top;
    const left = (value as Record<string, unknown>).left;
    if (typeof top === 'number' && typeof left === 'number') {
      out[key] = { top, left };
    }
  }
  return out;
}

// Sort the fill queue by visual top-to-bottom position, falling back to
// DOM order when a field has no position entry. Greenhouse + most ATSes
// already render fields in DOM order, but pages with CSS grid/flex
// `order:` overrides or multi-column layouts can put a later DOM node
// above an earlier one. Filling visually top-to-bottom matches the way
// a human would tab through the form and avoids the agent looking like
// it's jumping around the page.
function sortFieldsByVisualPosition<
  T extends { readonly selector: string },
>(
  fields: readonly T[],
  positions: Record<string, { top: number; left: number }>,
): T[] {
  if (Object.keys(positions).length === 0) return [...fields];
  return [...fields]
    .map((field, index) => {
      const key = positionKeyForSelector(field.selector);
      const position = key ? positions[key] : null;
      return {
        field,
        index,
        top: position?.top ?? Number.POSITIVE_INFINITY,
        left: position?.left ?? Number.POSITIVE_INFINITY,
      };
    })
    .sort((a, b) => {
      if (a.top !== b.top) return a.top - b.top;
      if (a.left !== b.left) return a.left - b.left;
      return a.index - b.index;
    })
    .map(entry => entry.field);
}

function positionKeyForSelector(selector: string): string | null {
  // Match the keys the snapshot emits — `#id` for elements with an id,
  // `[name=name]` for elements with a name attribute. The runner's
  // selectorForNode emits selectors like `input[id="x"]` or
  // `input[name="x"]`; convert those to the snapshot's key shape.
  const idMatch = selector.match(/\[id=["']([^"']+)["']\]/);
  if (idMatch) return `#${idMatch[1]}`;
  const hashMatch = selector.match(/#([\w-]+)/);
  if (hashMatch) return `#${hashMatch[1]}`;
  const nameMatch = selector.match(/\[name=["']([^"']+)["']\]/);
  if (nameMatch) return `[name=${nameMatch[1]}]`;
  return null;
}

export function readDomSnapshotUrl(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const url = (data as Record<string, unknown>).url;
  return typeof url === 'string' && url.length > 0 ? url : null;
}

function stripQuery(url: string): string {
  return url.split('?')[0]!.split('#')[0]!;
}

function findGreenhouseSelectorByLabel(
  root: ReturnType<typeof parse>,
  input: {
    readonly labelPatterns: readonly RegExp[];
    readonly negativeLabelPatterns?: readonly RegExp[];
    readonly tagNames: readonly string[];
  },
): string | null {
  const matches = findGreenhouseSelectorsByLabel(root, input);
  return matches[0] ?? null;
}

function findGreenhouseSelectorsByLabel(
  root: ReturnType<typeof parse>,
  input: {
    readonly labelPatterns: readonly RegExp[];
    readonly negativeLabelPatterns?: readonly RegExp[];
    readonly tagNames: readonly string[];
  },
): readonly string[] {
  const candidates = root.querySelectorAll(input.tagNames.join(','));
  const matches: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    const labelText = readGreenhouseLabelText(root, candidate);
    if (
      !labelText ||
      !input.labelPatterns.some(pattern => pattern.test(labelText))
    ) {
      continue;
    }
    if (
      input.negativeLabelPatterns?.some(pattern => pattern.test(labelText))
    ) {
      continue;
    }

    const selector = selectorForNode(candidate);
    if (selector && !seen.has(selector)) {
      seen.add(selector);
      matches.push(selector);
    }
  }

  return matches;
}

async function readCurrentSiblingUrls(
  input: DesktopAgentRuntimeInput,
): Promise<readonly string[]> {
  const snapshot = await call(input, 'dom_snapshot', {}, 'rescan sibling URLs');
  if (!snapshot.ok) return [];
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return [];
  return collectSiblingFormUrls(html);
}

function collectSiblingFormUrls(html: string): readonly string[] {
  const root = parse(html);
  const urls = new Set<string>();
  const candidates = root.querySelectorAll('input, textarea');
  for (const candidate of candidates) {
    const value = candidate.getAttribute('value') ?? candidate.text ?? '';
    if (!value) continue;
    for (const match of value.matchAll(/https?:\/\/\S+/gi)) {
      const url = match[0].replace(/[),.;]+$/, '').trim();
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

function findGreenhouseLabelTextByPatterns(
  root: ReturnType<typeof parse>,
  input: {
    readonly labelPatterns: readonly RegExp[];
    readonly tagNames: readonly string[];
  },
): string | null {
  const candidates = root.querySelectorAll(input.tagNames.join(','));
  for (const candidate of candidates) {
    const labelText = readGreenhouseLabelText(root, candidate);
    if (
      labelText &&
      input.labelPatterns.some(pattern => pattern.test(labelText))
    ) {
      return labelText;
    }
  }
  return null;
}

function readGreenhouseLabelText(
  root: ReturnType<typeof parse>,
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): string {
  const id = candidate.getAttribute('id');
  if (id) {
    const label = root.querySelector(
      `label[for="${escapeAttributeValue(id)}"]`,
    );
    const labelText = normalizeFieldLabelText(label?.text ?? '');
    if (labelText) return labelText;
  }

  const ariaLabel = normalizeFieldLabelText(
    candidate.getAttribute('aria-label') ?? '',
  );
  if (ariaLabel) return ariaLabel;

  const placeholder = normalizeFieldLabelText(
    candidate.getAttribute('placeholder') ?? '',
  );
  if (placeholder) return placeholder;

  const parentLabel = candidate.closest('label');
  const parentLabelText = normalizeFieldLabelText(parentLabel?.text ?? '');
  if (parentLabelText) return parentLabelText;

  const previousLabel = candidate.previousElementSibling;
  const previousLabelText = normalizeFieldLabelText(previousLabel?.text ?? '');
  if (previousLabelText) return previousLabelText;

  let container = candidate.parentNode;
  for (let depth = 0; depth < 4 && container; depth++) {
    const containerText = normalizeFieldLabelText(container.text ?? '');
    if (containerText && containerText.length <= 220) {
      return containerText;
    }
    container = container.parentNode;
  }

  return normalizeFieldLabelText(
    `${candidate.getAttribute('name') ?? ''} ${candidate.getAttribute('id') ?? ''}`,
  );
}

function normalizeFieldLabelText(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function selectorForNode(
  candidate: ReturnType<ReturnType<typeof parse>['querySelectorAll']>[number],
): string | null {
  const tagName = candidate.tagName.toLowerCase();
  const id = candidate.getAttribute('id');
  if (id) {
    return `${tagName}[id="${escapeAttributeValue(id)}"]`;
  }

  const name = candidate.getAttribute('name');
  if (name) {
    return `${tagName}[name="${escapeAttributeValue(name)}"]`;
  }

  const ariaLabel = candidate.getAttribute('aria-label');
  if (ariaLabel) {
    return `${tagName}[aria-label="${escapeAttributeValue(ariaLabel)}"]`;
  }

  const dataTestId = candidate.getAttribute('data-testid');
  if (dataTestId) {
    return `${tagName}[data-testid="${escapeAttributeValue(dataTestId)}"]`;
  }

  const role = candidate.getAttribute('role');
  if (role) {
    return `${tagName}[role="${escapeAttributeValue(role)}"]`;
  }

  return null;
}

function escapeAttributeValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function isIgnorableMissingFieldError(message?: string): boolean {
  if (!message) return false;
  return /not found|did not match/i.test(message);
}

async function loadIdentityValue(
  input: DesktopAgentRuntimeInput,
  key: string,
): Promise<
  | { readonly ok: true; readonly value: string }
  | { readonly error?: { readonly message: string }; readonly ok: false }
> {
  const result = await call(input, 'identity_load', { key }, `load ${key}`);
  if (!result.ok) return { error: result.error, ok: false };
  const value = readStringValue(result.data);
  if (!value) {
    return {
      error: { message: `Identity key returned no value: ${key}` },
      ok: false,
    };
  }
  return { ok: true, value };
}

function readStringValue(data: unknown): string | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  const value = (data as Record<string, unknown>).value;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

// Modern Greenhouse forms on job-boards.greenhouse.io render the resume
// upload as a Dropbox / Google Drive / "Enter manually" picker — the real
// <input type="file"> isn't in the DOM until the user clicks the manual
// trigger. Try the upload first; if it misses, scan the DOM for a button
// or link whose text reads like an attach-file affordance ("Attach",
// "Upload", "Enter manually", "Choose file"), click it, and retry once.
async function attemptResumeUpload(
  input: DesktopAgentRuntimeInput,
  filePath: string,
  selector: string,
  reason: string,
): Promise<DesktopToolCallResult> {
  const first = await call(input, 'upload', { filePath, selector }, reason);
  if (first.ok) return first;
  if (!/Upload target not found/i.test(first.error?.message ?? '')) {
    return first;
  }

  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    `${reason} (scan for attach trigger)`,
  );
  const html = snapshot.ok ? readDomSnapshotHtml(snapshot.data) : null;
  const triggerSelector = html
    ? findResumeAttachTriggerSelector(html)
    : null;
  if (!triggerSelector) return first;

  const triggerClick = await call(
    input,
    'click',
    { selector: triggerSelector },
    `${reason} (click attach-file trigger)`,
  );
  if (!triggerClick.ok) return first;

  await sleep(300);
  return call(input, 'upload', { filePath, selector }, `${reason} (retry)`);
}

const RESUME_ATTACH_TRIGGER_PATTERN =
  /\b(attach\s+(?:a\s+)?file|attach\s+resume|attach\s+(?:cv|curriculum vitae)|upload\s+(?:a\s+)?(?:file|resume|cv)|enter\s+manually|choose\s+(?:a\s+)?file|browse\s+files?|select\s+file)\b/i;

function findResumeAttachTriggerSelector(html: string): string | null {
  const root = parse(html);
  // Prefer triggers inside a "Resume" / "CV" labelled fieldset so we don't
  // grab the cover-letter attach button. Fall back to any attach-file
  // trigger if no resume-scoped one is found.
  const candidates = root.querySelectorAll(
    'button, a[role="button"], [role="button"], label, span, div',
  );
  let resumeScoped: string | null = null;
  let anyScoped: string | null = null;
  for (const element of candidates) {
    const text = (element.text ?? '').trim();
    if (!text || text.length > 60) continue;
    if (!RESUME_ATTACH_TRIGGER_PATTERN.test(text)) continue;
    const selector = selectorForAttachTrigger(element);
    if (!selector) continue;
    const ancestorText = collectAncestorText(element, 4).toLowerCase();
    const isResumeScoped =
      /\b(resume|cv|curriculum vitae)\b/.test(ancestorText) &&
      !/\bcover\s*letter\b/.test(ancestorText);
    if (isResumeScoped) {
      if (!resumeScoped) resumeScoped = selector;
    } else if (!anyScoped) {
      anyScoped = selector;
    }
  }
  return resumeScoped ?? anyScoped;
}

function cssEscapeAttr(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function selectorForAttachTrigger(element: HTMLElement): string | null {
  const id = element.getAttribute('id');
  if (id) return `#${cssEscapeAttr(id)}`;
  const dataAttrs = ['data-source', 'data-testid', 'data-source-type'];
  for (const attr of dataAttrs) {
    const value = element.getAttribute(attr);
    if (value) {
      return `${element.tagName.toLowerCase()}[${attr}="${cssEscapeAttr(value)}"]`;
    }
  }
  const ariaLabel = element.getAttribute('aria-label');
  if (ariaLabel) {
    return `${element.tagName.toLowerCase()}[aria-label="${cssEscapeAttr(ariaLabel)}"]`;
  }
  return null;
}

function collectAncestorText(element: HTMLElement, depth: number): string {
  let current: HTMLElement | null = element;
  const parts: string[] = [];
  for (let i = 0; i < depth && current; i += 1) {
    const ariaLabel = current.getAttribute?.('aria-label');
    if (ariaLabel) parts.push(ariaLabel);
    parts.push(current.text ?? '');
    current = current.parentNode as HTMLElement | null;
  }
  return parts.join(' ');
}

export async function call(
  input: DesktopAgentRuntimeInput,
  tool: DesktopToolName,
  toolInput: unknown,
  reason: string,
): Promise<DesktopToolCallResult> {
  await waitIfAutofillPaused();
  const traceEnabled = process.env.GIMME_JOB_TRACE_TOOL_CALLS === '1';
  const startedAt = traceEnabled ? Date.now() : 0;
  const result = await input.callTool({ input: toolInput, reason, tool });
  if (traceEnabled) {
    const ms = Date.now() - startedAt;
    const status = result.ok ? 'ok' : `err: ${result.error?.message ?? 'unknown'}`;
    console.log(
      `[trace ${ms}ms] ${tool} ${summarizeTraceInput(toolInput)} (${reason}) → ${status}`,
    );
  }
  return result;
}

function summarizeTraceInput(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value !== 'object') {
    return String(value).slice(0, 80);
  }
  const parts: string[] = [];
  for (const [key, rawValue] of Object.entries(value as Record<string, unknown>)) {
    let formatted: string;
    if (typeof rawValue === 'string') {
      formatted = rawValue.length > 80 ? `${rawValue.slice(0, 80)}…` : rawValue;
    } else if (rawValue === null || rawValue === undefined) {
      formatted = String(rawValue);
    } else if (typeof rawValue === 'object') {
      formatted = '[object]';
    } else {
      formatted = String(rawValue);
    }
    parts.push(`${key}=${formatted}`);
  }
  return parts.join(' ');
}

// Fill a text/textarea field, then re-read the live DOM and verify the
// value actually stuck. React-controlled inputs (intl-tel-input,
// react-select search inputs, formik-controlled fields) silently drop
// programmatic value-set ~5-15% of the time — the fill tool reports
// success, but the form submit still fails the field as empty. On
// mismatch we retry once with a focus + clear + per-keystroke input,
// which routes around almost every controlled-input quirk.
export async function fillWithVerification(
  input: DesktopAgentRuntimeInput,
  selector: string,
  value: string,
  reason: string,
): Promise<DesktopToolCallResult> {
  const initial = await call(input, 'fill', { selector, value }, reason);
  if (!initial.ok) return initial;
  const stuck = await readFieldValueBySelector(input, selector);
  if (stuck !== null && valuesAreEquivalent(stuck, value)) {
    return initial;
  }
  // Mismatch — re-focus and retry with keystroke entry.
  console.warn(
    `[fill-verify] "${selector}" expected "${value.slice(0, 40)}" but read back "${(stuck ?? '').slice(0, 40)}" — retrying via keystrokes`,
  );
  await call(input, 'click', { selector }, `${reason} (focus for retry)`);
  await sleep(60);
  await call(
    input,
    'fill',
    { selector, value: '' },
    `${reason} (clear for retry)`,
  );
  await sleep(40);
  const retry = await call(
    input,
    'fill',
    { selector, value },
    `${reason} (retry)`,
  );
  return retry;
}

async function readFieldValueBySelector(
  input: DesktopAgentRuntimeInput,
  selector: string,
): Promise<string | null> {
  const snapshot = await call(
    input,
    'dom_snapshot',
    {},
    'verify post-fill value',
  );
  if (!snapshot.ok) return null;
  const html = readDomSnapshotHtml(snapshot.data);
  if (!html) return null;
  try {
    const root = parse(html);
    const node = root.querySelector(selector);
    if (!node) return null;
    const valueAttr = node.getAttribute('value');
    if (typeof valueAttr === 'string') return valueAttr;
    const innerText = node.text?.trim();
    return innerText ?? null;
  } catch {
    return null;
  }
}

function valuesAreEquivalent(actual: string, expected: string): boolean {
  const a = actual.trim().replace(/\s+/g, ' ').toLowerCase();
  const b = expected.trim().replace(/\s+/g, ' ').toLowerCase();
  if (a === b) return true;
  // Phone fields rewrite digits with spaces / dashes / parens — accept
  // any string whose digit-only projection matches.
  const digitsA = a.replace(/\D/g, '');
  const digitsB = b.replace(/\D/g, '');
  if (digitsA && digitsA === digitsB) return true;
  // Many forms truncate / reformat — accept the prefix as good enough.
  if (b.length >= 6 && a.startsWith(b.slice(0, Math.min(8, b.length)))) {
    return true;
  }
  return false;
}

// Autofill pause gate: when set, every call() through this module blocks
// until the user resumes autofill. Lets the user freeze the agent mid-run
// to inspect / edit the page without aborting the submit run.
let autofillPausedResolvers: Array<() => void> = [];
let autofillPaused = false;

export function setAutofillPaused(paused: boolean): void {
  autofillPaused = paused;
  if (!paused) {
    const pending = autofillPausedResolvers;
    autofillPausedResolvers = [];
    for (const resolve of pending) resolve();
  }
}

export function isAutofillPaused(): boolean {
  return autofillPaused;
}

async function waitIfAutofillPaused(): Promise<void> {
  if (!autofillPaused) return;
  // Honor the run's abort signal while paused so Stop still cancels.
  await new Promise<void>((resolve, reject) => {
    if (currentRunSignal?.aborted) {
      reject(new DesktopAgentCancelledError());
      return;
    }
    const onAbort = () => {
      autofillPausedResolvers = autofillPausedResolvers.filter(
        r => r !== resolve,
      );
      reject(new DesktopAgentCancelledError());
    };
    currentRunSignal?.addEventListener('abort', onAbort, { once: true });
    autofillPausedResolvers.push(() => {
      currentRunSignal?.removeEventListener('abort', onAbort);
      resolve();
    });
  });
}

export function failed(result: {
  readonly error?: { readonly message: string };
}): {
  readonly message: string;
  readonly status: 'failed';
} {
  return {
    message: result.error?.message ?? 'Desktop submit run failed.',
    status: 'failed',
  };
}

// Module-scoped signal that abortable sleep respects. Set at the start of
// each Greenhouse runtime run via `setCurrentRunSignal` and cleared on exit.
// Without this, every sleep below would silently wait out its full duration
// after the user clicks Stop, only honoring the abort on the *next* tool
// call — which routinely meant 500–1500 ms of "ghost" automation after the
// run was cancelled, often on a page the user had already navigated away
// from. Now sleep rejects immediately when the signal aborts.
let currentRunSignal: AbortSignal | undefined;

export function setCurrentRunSignal(signal: AbortSignal | undefined): void {
  currentRunSignal = signal;
}

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (currentRunSignal?.aborted) {
      reject(new DesktopAgentCancelledError());
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      cleanup();
      reject(new DesktopAgentCancelledError());
    };
    const cleanup = () => {
      currentRunSignal?.removeEventListener('abort', onAbort);
    };
    currentRunSignal?.addEventListener('abort', onAbort, { once: true });
  });
}

function stripPhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

// Last-resort phone fill: focus the field, clear it, then dispatch each digit
// through Chromium's keyboard pipeline so the input sees real keystrokes
// instead of a programmatic value-set. Greenhouse Boards' intl-tel-input mask
// has been observed silently rewriting the trailing digit (e.g. ...8044 →
// ...8041) when the value is set in one shot; per-keystroke entry routes
// around the buggy bulk reformatter.
async function typePhoneDigitsByKeystroke(
  input: DesktopAgentRuntimeInput,
  selector: string,
  phone: string,
): Promise<boolean> {
  const digits = stripPhoneDigits(phone);
  if (!digits) return false;

  const focusResult = await call(
    input,
    'click',
    { selector },
    'focus phone for keystroke fill',
  );
  if (!focusResult.ok) return false;

  await call(
    input,
    'fill',
    { selector, value: '' },
    'clear phone before keystroke fill',
  );
  await sleep(150);

  for (const digit of digits) {
    await call(input, 'press_key', { key: digit }, `type phone digit ${digit}`);
    await sleep(40);
  }
  await call(input, 'press_key', { key: 'Tab' }, 'commit phone keystrokes');
  await sleep(500);

  const verify = await call(
    input,
    'read_element',
    { selector },
    'verify phone after keystroke fill',
  );
  if (!verify.ok) return false;
  const data = verify.data as { value?: unknown } | null;
  const actual = data && typeof data.value === 'string' ? data.value : '';
  return stripPhoneDigits(actual) === digits;
}

function buildObjective(request: DesktopSubmitLeadRequest): string {
  const leadPart = request.jobLeadId ? ` for lead ${request.jobLeadId}` : '';
  return `Run ${request.mode} desktop Greenhouse submission${leadPart}: ${request.applicationUrl}`;
}
