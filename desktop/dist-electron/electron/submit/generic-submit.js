/**
 * Generic-ATS submit runner. Handles non-Greenhouse application forms by
 * label-matching identity fields and falling through to the LLM-driven
 * resolver for everything else. Designed for the 80% case (Lever, Ashby,
 * Workable, SmartRecruiters, Workable, custom job-board pages); does NOT
 * handle multi-page wizards (Workday) or non-PDF resume formats.
 */
import { parse } from 'node-html-parser';
import { createClaudeAgentSdkRuntime, } from '../agent/claude-agent-sdk.js';
import { createDesktopAgentSession } from '../agent/session.js';
import { dismissCommonOverlays } from './dismiss-overlays.js';
import { call, failed, loadOptionalContactUrls, loadRequiredIdentity, readDomSnapshotHtml, resolveRemainingFieldsWithLlm, setCurrentRunSignal, sleep, waitForSubmissionConfirmation, } from './greenhouse-submit.js';
import { extractValidationFailures } from './validation-extract.js';
const SUBMIT_BUTTON_SELECTOR = 'button[type="submit"], input[type="submit"], button[data-test*="submit" i], button[data-qa*="submit" i], button[aria-label*="submit" i]';
const SUBMIT_BUTTON_TEXT_PATTERN = /^(submit|submit application|apply|apply now|send application|continue|next)$/i;
const ANY_INPUT_SELECTOR = 'input[type="text"], input[type="email"], input[type="tel"], input:not([type]), textarea';
export async function runGenericSubmitLead(registry, request, options = {}) {
    const session = createDesktopAgentSession(registry, {
        mode: request.mode,
        runtime: createClaudeAgentSdkRuntime(createGenericRuntime(request, options.providerOverrides)),
    });
    const result = await session.run({
        objective: buildObjective(request, options.providerOverrides),
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
        validationFailures: result.validationFailures,
    };
}
function buildObjective(request, overrides) {
    const leadPart = request.jobLeadId ? ` for lead ${request.jobLeadId}` : '';
    const providerLabel = overrides?.providerLabel ?? 'generic-ATS';
    return `Run ${request.mode} desktop ${providerLabel} submission${leadPart}: ${request.applicationUrl}`;
}
function createGenericRuntime(request, overrides) {
    return {
        async run(input) {
            setCurrentRunSignal(input.signal);
            try {
                return await runGenericRuntime(request, input, overrides);
            }
            finally {
                setCurrentRunSignal(undefined);
            }
        },
    };
}
async function runGenericRuntime(request, input, overrides) {
    if (!request.continueFromCurrentPage) {
        const navigateResult = await call(input, 'navigate', { url: request.applicationUrl }, 'open application page');
        if (!navigateResult.ok)
            return failed(navigateResult);
    }
    const readyResult = await call(input, 'wait_for', { selector: ANY_INPUT_SELECTOR, timeoutMs: 15_000 }, 'wait for application form to render');
    if (!readyResult.ok)
        return failed(readyResult);
    // Give SPA frameworks a beat to mount any lazy-loaded fields.
    await sleep(400);
    const overlaysDismissed = await dismissCommonOverlays(input, call);
    if (overlaysDismissed > 0) {
        console.log(`[generic-submit] dismissed ${overlaysDismissed} consent overlay(s)`);
    }
    const identity = await loadRequiredIdentity(input);
    if ('status' in identity)
        return identity;
    const snapshot = await call(input, 'dom_snapshot', {}, 'snapshot generic form');
    if (!snapshot.ok)
        return failed(snapshot);
    const html = readDomSnapshotHtml(snapshot.data);
    if (!html) {
        return {
            message: 'Empty DOM snapshot when scanning generic form.',
            status: 'failed',
        };
    }
    const fields = collectGenericFieldCandidates(html);
    const attemptedSelectors = new Set();
    // Resume tailoring runs in parallel with form-fill (when enabled).
    let resumeFilePath = identity.resumePdfPath;
    if (request.prepareTailoredResume) {
        try {
            const tailored = await request.prepareTailoredResume();
            if (tailored)
                resumeFilePath = tailored;
        }
        catch (error) {
            console.warn('[generic-submit] tailored resume prep failed:', error);
        }
    }
    // 1. Identity fills — first try provider-specific selectors (Ashby /
    //    Lever / Workable expose stable system-field names), then fall
    //    through to label/name/id heuristics. Some providers use a single
    //    "full name" field instead of separate first/last; handle that
    //    when no first/last selectors exist on the page.
    const fullNameOverrides = overrides?.identitySelectors?.fullName ?? [];
    const filledFullName = await fillBySelectorOverrides(input, fields, attemptedSelectors, fullNameOverrides, `${identity.firstName} ${identity.lastName}`.trim(), 'fill full name');
    if (!filledFullName) {
        await fillBySelectorOverrides(input, fields, attemptedSelectors, overrides?.identitySelectors?.firstName ?? [], identity.firstName, 'fill first name');
        await fillIfMatch(input, fields, attemptedSelectors, IDENTITY_PATTERNS.firstName, identity.firstName, 'fill first name');
        await fillIfMatch(input, fields, attemptedSelectors, IDENTITY_PATTERNS.preferredName, identity.firstName, 'fill preferred name');
        await fillBySelectorOverrides(input, fields, attemptedSelectors, overrides?.identitySelectors?.lastName ?? [], identity.lastName, 'fill last name');
        await fillIfMatch(input, fields, attemptedSelectors, IDENTITY_PATTERNS.lastName, identity.lastName, 'fill last name');
    }
    await fillBySelectorOverrides(input, fields, attemptedSelectors, overrides?.identitySelectors?.email ?? [], identity.email, 'fill email');
    await fillIfMatch(input, fields, attemptedSelectors, IDENTITY_PATTERNS.email, identity.email, 'fill email');
    await fillBySelectorOverrides(input, fields, attemptedSelectors, overrides?.identitySelectors?.phone ?? [], identity.phone, 'fill phone');
    await fillIfMatch(input, fields, attemptedSelectors, IDENTITY_PATTERNS.phone, identity.phone, 'fill phone');
    // 1b. Always-fill contact URLs (LinkedIn, GitHub, personal website).
    //    These bypass the required-only filter that custom Q&A obeys —
    //    high-signal-for-recruiters fields the user already opted into by
    //    setting them in their profile. If the field doesn't exist on the
    //    form, the match returns nothing and we move on.
    const contactUrls = await loadOptionalContactUrls(input);
    if (contactUrls.linkedinUrl) {
        await fillIfMatch(input, fields, attemptedSelectors, URL_FIELD_PATTERNS.linkedin, contactUrls.linkedinUrl, 'fill linkedin url');
    }
    if (contactUrls.githubUrl) {
        await fillIfMatch(input, fields, attemptedSelectors, URL_FIELD_PATTERNS.github, contactUrls.githubUrl, 'fill github url');
    }
    if (contactUrls.websiteUrl) {
        await fillIfMatch(input, fields, attemptedSelectors, URL_FIELD_PATTERNS.website, contactUrls.websiteUrl, 'fill personal website');
    }
    // 2. Resume upload — find a file input that mentions resume/cv. Some
    //    forms have several file inputs (cover letter, portfolio); we
    //    prefer the one whose label/name/id matches resume keywords.
    const resumeSelector = findFirstMatchingSelector(html, overrides?.resumeFileSelectors) ??
        findResumeFileInputSelector(html);
    if (resumeSelector) {
        const uploadResult = await call(input, 'upload', { filePath: resumeFilePath, selector: resumeSelector }, 'attach resume');
        if (uploadResult.ok) {
            attemptedSelectors.add(resumeSelector);
        }
    }
    // 3. Multi-pass LLM fallback for everything else (custom questions,
    //    dropdowns, radios, demographic fields). Many ATSes lazy-mount
    //    follow-up questions after a field is filled (e.g. "If yes, please
    //    explain…"), so we re-scan up to MAX_LLM_FALLBACK_PASSES times,
    //    bailing as soon as a pass fills no new fields. Mirrors the
    //    iterative planner the Greenhouse runner uses for the same reason.
    if (request.resolveUnknownFieldAnswer) {
        const MAX_LLM_FALLBACK_PASSES = 4;
        for (let pass = 0; pass < MAX_LLM_FALLBACK_PASSES; pass += 1) {
            const before = attemptedSelectors.size;
            await resolveRemainingFieldsWithLlm(input, request.resolveUnknownFieldAnswer, attemptedSelectors, request.aiProvider, request.lookupRecentVerificationCode);
            const filledThisPass = attemptedSelectors.size - before;
            if (filledThisPass === 0)
                break;
            // Brief settle so any newly-mounted fields hydrate before next scan.
            await sleep(250);
        }
    }
    // 4. Find and click the submit button (only in submit mode — training
    //    mode stops here so the agent doesn't actually send anything).
    if (request.mode !== 'submit') {
        return {
            message: 'Training run completed on generic form (submit not clicked).',
            status: 'completed',
        };
    }
    // Re-snapshot before locating the submit button — a provider's submit
    // CTA may only mount after the user/agent fills in required fields
    // (Lever's "Submit Application" stays disabled+hidden until the form
    // validates, Ashby renders it inside a different container after first
    // interaction, etc.).
    const finalSnapshot = await call(input, 'dom_snapshot', {}, 'snapshot before submit click');
    const finalHtml = finalSnapshot.ok
        ? readDomSnapshotHtml(finalSnapshot.data)
        : null;
    const submitSearchHtml = finalHtml ?? html;
    const submitSelector = findFirstMatchingSelector(submitSearchHtml, overrides?.submitButtonSelectors) ?? findSubmitButtonSelector(submitSearchHtml);
    if (!submitSelector) {
        return {
            message: 'Could not locate a submit button on this generic form (no [type="submit"], no button text matching submit/apply/send).',
            status: 'validation_failed',
        };
    }
    const unavailableReason = getSubmitButtonUnavailableReason(submitSearchHtml, submitSelector);
    if (unavailableReason) {
        return {
            message: `Submit button is disabled or hidden; reason=${unavailableReason}.`,
            status: 'validation_failed',
        };
    }
    const guardResult = await call(input, 'submit_guard', { enabled: false }, 'owner-approved submit mode (generic)');
    if (!guardResult.ok)
        return failed(guardResult);
    const submitResult = await call(input, 'click', { selector: submitSelector }, 'submit application (generic)');
    if (!submitResult.ok)
        return failed(submitResult);
    // 5. Verify confirmation page.
    const confirmation = await waitForSubmissionConfirmation(input);
    if (!confirmation.confirmed) {
        const validationFailures = await extractCurrentValidationFailures(input);
        return {
            message: `Submit click fired but no confirmation page appeared within ${confirmation.timeoutMs}ms.${confirmation.diagnostic ? ` ${confirmation.diagnostic}` : ''}`,
            status: 'confirmation_timeout',
            validationFailures,
        };
    }
    return {
        message: 'Generic submit confirmed — application-received page detected.',
        status: 'completed',
    };
}
async function extractCurrentValidationFailures(input) {
    const snapshot = await call(input, 'dom_snapshot', {}, 'snapshot validation errors');
    if (!snapshot.ok)
        return [];
    const html = readDomSnapshotHtml(snapshot.data);
    if (!html)
        return [];
    return extractValidationFailures(html);
}
const URL_FIELD_PATTERNS = {
    linkedin: [/linked\s*in/i, /\blnkdn\b/i],
    github: [/git\s*hub/i],
    website: [
        /personal\s+(?:website|site|page|portfolio)/i,
        /\bportfolio\b/i,
        /\bwebsite\b/i,
        /\bweb\s+page\b/i,
    ],
};
const IDENTITY_PATTERNS = {
    firstName: [
        /^first[\s_-]?name$/i,
        /given[\s_-]?name/i,
        /\bfname\b/i,
        /first[\s_-]?name/i,
    ],
    preferredName: [
        /preferred[\s_-]?(?:first[\s_-]?)?name/i,
        /\bnickname\b/i,
        /chosen[\s_-]?name/i,
        /what\s+should\s+we\s+call\s+you/i,
        /\bgo\s+by\b/i,
    ],
    lastName: [
        /^last[\s_-]?name$/i,
        /\bsurname\b/i,
        /family[\s_-]?name/i,
        /\blname\b/i,
        /last[\s_-]?name/i,
    ],
    email: [/email/i, /e[-\s]?mail/i],
    phone: [
        /^phone$/i,
        /phone[\s_-]?number/i,
        /\bmobile\b/i,
        /\bcell\b/i,
        /\btel\b/i,
    ],
};
// Try each provider-specific selector in order; fill the first one that
// currently exists in the DOM (verified by re-snapshotting). Returns true
// if any selector was filled, so the caller can skip the fallback regex
// match for that field.
async function fillBySelectorOverrides(input, fields, attempted, selectors, value, reason) {
    if (selectors.length === 0)
        return false;
    for (const candidate of selectors) {
        if (attempted.has(candidate))
            return true;
        // Cheap existence check: did the initial snapshot's field collector
        // find this exact selector? If so, fill it directly.
        const known = fields.find(field => field.selector === candidate);
        if (known) {
            attempted.add(candidate);
            await call(input, 'fill', { selector: candidate, value }, reason);
            return true;
        }
    }
    // Fall back to attempting the first selector blindly — the field may be
    // a non-text input (select, textarea) that the candidate collector
    // skipped. The fill tool will surface its own error if the selector
    // doesn't resolve.
    const first = selectors[0];
    if (attempted.has(first))
        return true;
    attempted.add(first);
    const result = await call(input, 'fill', { selector: first, value }, reason);
    return result.ok;
}
// Return the first selector from the list that resolves to an element in
// the given HTML. Used for resume-upload + submit-button overrides where
// we want a deterministic match before falling back to fuzzy heuristics.
function findFirstMatchingSelector(html, selectors) {
    if (!selectors || selectors.length === 0)
        return null;
    const root = parse(html);
    for (const selector of selectors) {
        try {
            if (root.querySelector(selector))
                return selector;
        }
        catch {
            // Invalid CSS for node-html-parser — skip and try next.
        }
    }
    return null;
}
async function fillIfMatch(input, fields, attempted, patterns, value, reason) {
    const match = fields.find(field => {
        if (attempted.has(field.selector))
            return false;
        const haystack = `${field.labelText} ${field.name} ${field.id} ${field.placeholder}`.toLowerCase();
        return patterns.some(pattern => pattern.test(haystack));
    });
    if (!match)
        return;
    attempted.add(match.selector);
    await call(input, 'fill', { selector: match.selector, value }, reason);
}
function findResumeFileInputSelector(html) {
    const root = parse(html);
    const inputs = root.querySelectorAll('input[type="file"]');
    for (const input of inputs) {
        const id = input.getAttribute('id') ?? '';
        const name = input.getAttribute('name') ?? '';
        const aria = input.getAttribute('aria-label') ?? '';
        const haystack = `${id} ${name} ${aria}`.toLowerCase();
        if (/resume|cv\b/i.test(haystack)) {
            return selectorForFileInput(id, name);
        }
    }
    // Fallback: first file input on the page.
    if (inputs.length > 0) {
        const first = inputs[0];
        return selectorForFileInput(first.getAttribute('id') ?? '', first.getAttribute('name') ?? '');
    }
    return null;
}
function selectorForFileInput(id, name) {
    if (id)
        return `input#${cssEscape(id)}[type="file"]`;
    if (name)
        return `input[name="${cssEscapeAttr(name)}"][type="file"]`;
    return 'input[type="file"]';
}
function findSubmitButtonSelector(html) {
    const root = parse(html);
    // 1. Strict: button[type="submit"] / input[type="submit"].
    const strict = root.querySelector(SUBMIT_BUTTON_SELECTOR);
    if (strict) {
        const id = strict.getAttribute('id');
        if (id)
            return `${strict.tagName.toLowerCase()}#${cssEscape(id)}`;
        const name = strict.getAttribute('name');
        if (name) {
            return `${strict.tagName.toLowerCase()}[name="${cssEscapeAttr(name)}"]`;
        }
        return SUBMIT_BUTTON_SELECTOR.split(',')[0].trim();
    }
    // 2. Fuzzy: any button whose visible text matches submit/apply/send.
    const buttons = root.querySelectorAll('button');
    for (const button of buttons) {
        const text = (button.text ?? '').trim();
        if (!text)
            continue;
        if (SUBMIT_BUTTON_TEXT_PATTERN.test(text)) {
            const id = button.getAttribute('id');
            if (id)
                return `button#${cssEscape(id)}`;
            // Last-ditch: a text-match selector via :has() isn't supported in
            // node-html-parser, but Chromium can find buttons by text content
            // when given an XPath-ish selector — for safety, return a generic
            // fallback that picks the first <button>.
            return 'button';
        }
    }
    return null;
}
function getSubmitButtonUnavailableReason(html, selector) {
    const root = parse(html);
    let element;
    try {
        element = root.querySelector(selector);
    }
    catch {
        return null;
    }
    if (!element)
        return null;
    if (element.hasAttribute('disabled'))
        return 'submit_button_disabled';
    if (element.getAttribute('aria-disabled')?.toLowerCase() === 'true') {
        return 'submit_button_disabled';
    }
    if (element.hasAttribute('hidden'))
        return 'submit_button_disabled';
    const style = element.getAttribute('style')?.toLowerCase() ?? '';
    if (/display\s*:\s*none/.test(style))
        return 'submit_button_disabled';
    if (/visibility\s*:\s*hidden/.test(style))
        return 'submit_button_disabled';
    return null;
}
function collectGenericFieldCandidates(html) {
    const root = parse(html);
    const candidates = root.querySelectorAll(ANY_INPUT_SELECTOR);
    const seen = new Set();
    const out = [];
    for (const candidate of candidates) {
        const id = candidate.getAttribute('id') ?? '';
        const name = candidate.getAttribute('name') ?? '';
        const inputType = candidate.getAttribute('type') ?? '';
        const placeholder = candidate.getAttribute('placeholder') ?? '';
        const aria = candidate.getAttribute('aria-label') ?? '';
        let selector;
        if (id)
            selector = `${candidate.tagName.toLowerCase()}#${cssEscape(id)}`;
        else if (name)
            selector = `${candidate.tagName.toLowerCase()}[name="${cssEscapeAttr(name)}"]`;
        else
            continue;
        if (seen.has(selector))
            continue;
        seen.add(selector);
        let labelText = aria;
        if (id) {
            const label = root.querySelector(`label[for="${cssEscapeAttr(id)}"]`);
            if (label?.text)
                labelText = label.text.trim();
        }
        out.push({
            id,
            inputType,
            labelText: labelText.trim(),
            name,
            placeholder,
            selector,
            tagName: candidate.tagName.toLowerCase(),
        });
    }
    return out;
}
function cssEscape(value) {
    return value.replace(/([!"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
function cssEscapeAttr(value) {
    return value.replace(/(["\\])/g, '\\$1');
}
