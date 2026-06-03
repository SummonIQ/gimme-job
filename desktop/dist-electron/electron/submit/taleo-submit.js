/**
 * Oracle Taleo submit runner. Taleo job apps live at hosts like
 * `<tenant>.taleo.net` and follow a multi-page wizard:
 *   1. Privacy Agreement
 *   2. Source Selection ("How did you hear about us?")
 *   3. Personal Information (name, email, phone)
 *   4. Resume Upload
 *   5. Job-Specific Questions
 *   6. eSignature
 *   7. Review and Submit
 *
 * Taleo's HTML uses `id` prefixes like `requisitionDescriptionInterface.`,
 * `taleoIdentityForm.`, etc. The runner clicks the page-bottom "Save and
 * Continue" button after each fill pass and watches for the final
 * "Application Complete" page.
 */
import { parse } from 'node-html-parser';
import { createClaudeAgentSdkRuntime, } from '../agent/claude-agent-sdk.js';
import { createDesktopAgentSession } from '../agent/session.js';
import { dismissCommonOverlays } from './dismiss-overlays.js';
import { call, failed, loadRequiredIdentity, readDomSnapshotHtml, readDomSnapshotTitle, resolveRemainingFieldsWithLlm, setCurrentRunSignal, sleep, waitForSubmissionConfirmation, } from './greenhouse-submit.js';
const TALEO_IDENTITY_SELECTORS = {
    firstName: [
        'input[id$=".givenName"]',
        'input[id*="givenName" i]',
        'input[name*="firstname" i]',
    ],
    lastName: [
        'input[id$=".lastName"]',
        'input[id*="lastName" i]',
        'input[name*="lastname" i]',
    ],
    email: [
        'input[id$=".emailAddress"]',
        'input[id*="email" i]',
        'input[type="email"]',
    ],
    phone: [
        'input[id$=".homePhone"]',
        'input[id$=".cellPhone"]',
        'input[id*="phone" i]',
        'input[type="tel"]',
    ],
    resume: [
        'input[id$=".file"][type="file"]',
        'input[id*="upload" i][type="file"]',
        'input[type="file"][accept*="pdf"]',
    ],
};
const TALEO_CONTINUE_SELECTORS = [
    'input[type="submit"][id*="save" i]',
    'input[type="submit"][value*="Save" i]',
    'input[type="submit"][value*="Continue" i]',
    'input[type="submit"][value*="Next" i]',
    'button[id*="save" i]',
    'button[id*="continue" i]',
    'button[type="submit"]',
    'input[type="submit"]',
];
const TALEO_SUBMIT_SELECTORS = [
    'input[type="submit"][value*="Submit" i]',
    'button[id*="submit" i]',
    'button[type="submit"]',
    'input[type="submit"]',
];
const TALEO_AGREE_SELECTORS = [
    'input[type="checkbox"][id*="agree" i]',
    'input[type="checkbox"][id*="privacy" i]',
];
const COMPLETE_PATTERNS = [
    /thank\s+you/i,
    /application\s+complete/i,
    /you\s+have\s+(?:successfully\s+)?(?:submitted|completed)/i,
    /your\s+application\s+has\s+been\s+received/i,
];
const MAX_PAGE_ITERATIONS = 12;
export async function runTaleoSubmitLead(registry, request, options = {}) {
    const session = createDesktopAgentSession(registry, {
        mode: request.mode,
        runtime: createClaudeAgentSdkRuntime(createTaleoRuntime(request)),
    });
    const result = await session.run({
        objective: `Run ${request.mode} desktop Taleo submission: ${request.applicationUrl}`,
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
export function isTaleoApplicationUrl(url) {
    return /\.taleo\.net|tbe\.taleo\.net|taleocloud\.com/i.test(url);
}
function createTaleoRuntime(request) {
    return {
        async run(input) {
            setCurrentRunSignal(input.signal);
            try {
                return await runTaleoRuntime(request, input);
            }
            finally {
                setCurrentRunSignal(undefined);
            }
        },
    };
}
async function runTaleoRuntime(request, input) {
    if (!request.continueFromCurrentPage) {
        const navigateResult = await call(input, 'navigate', { url: request.applicationUrl }, 'open Taleo application page');
        if (!navigateResult.ok)
            return failed(navigateResult);
    }
    const overlaysDismissed = await dismissCommonOverlays(input, call);
    if (overlaysDismissed > 0) {
        console.log(`[taleo-submit] dismissed ${overlaysDismissed} consent overlay(s)`);
    }
    const identity = await loadRequiredIdentity(input);
    if ('status' in identity)
        return identity;
    let resumeFilePath = identity.resumePdfPath;
    if (request.prepareTailoredResume) {
        try {
            const tailored = await request.prepareTailoredResume();
            if (tailored)
                resumeFilePath = tailored;
        }
        catch (error) {
            console.warn('[taleo-submit] tailored resume prep failed:', error);
        }
    }
    const attemptedSelectors = new Set();
    let resumeUploaded = false;
    let identityFilled = false;
    let lastTitle = null;
    for (let iteration = 0; iteration < MAX_PAGE_ITERATIONS; iteration += 1) {
        await sleep(1500);
        const snapshot = await call(input, 'dom_snapshot', {}, `Taleo step (${iteration + 1})`);
        if (!snapshot.ok)
            return failed(snapshot);
        const html = readDomSnapshotHtml(snapshot.data);
        const title = readDomSnapshotTitle(snapshot.data);
        if (!html) {
            return { message: 'Empty DOM snapshot during Taleo run.', status: 'failed' };
        }
        const root = parse(html);
        const text = (root.querySelector('body')?.text ?? '').slice(0, 4000);
        const haystack = `${title ?? ''}\n${text}`;
        if (COMPLETE_PATTERNS.some(pattern => pattern.test(haystack))) {
            return {
                message: 'Taleo submission confirmed (post-submit page detected).',
                status: 'completed',
            };
        }
        // Privacy / agree page detection — check + click any agreement boxes
        // before trying to advance.
        for (const selector of TALEO_AGREE_SELECTORS) {
            try {
                if (root.querySelector(selector)) {
                    await call(input, 'click', { selector }, `Taleo agree ${selector}`);
                }
            }
            catch {
                // Skip invalid selectors quietly.
            }
        }
        // Identity fields appear on the personal information page.
        if (!identityFilled) {
            const filledFirst = await tryFill(input, TALEO_IDENTITY_SELECTORS.firstName, identity.firstName, 'Taleo first name', attemptedSelectors, root);
            if (filledFirst)
                identityFilled = true;
            await tryFill(input, TALEO_IDENTITY_SELECTORS.lastName, identity.lastName, 'Taleo last name', attemptedSelectors, root);
            await tryFill(input, TALEO_IDENTITY_SELECTORS.email, identity.email, 'Taleo email', attemptedSelectors, root);
            await tryFill(input, TALEO_IDENTITY_SELECTORS.phone, identity.phone, 'Taleo phone', attemptedSelectors, root);
        }
        // Resume upload page detection.
        if (!resumeUploaded) {
            for (const selector of TALEO_IDENTITY_SELECTORS.resume) {
                try {
                    if (!root.querySelector(selector))
                        continue;
                }
                catch {
                    continue;
                }
                const result = await call(input, 'upload', { filePath: resumeFilePath, selector }, 'Taleo resume upload');
                if (result.ok) {
                    attemptedSelectors.add(selector);
                    resumeUploaded = true;
                    break;
                }
            }
        }
        // Per-page custom-question fallback via the LLM resolver.
        if (request.resolveUnknownFieldAnswer) {
            for (let pass = 0; pass < 3; pass += 1) {
                const before = attemptedSelectors.size;
                await resolveRemainingFieldsWithLlm(input, request.resolveUnknownFieldAnswer, attemptedSelectors, request.aiProvider, request.lookupRecentVerificationCode);
                if (attemptedSelectors.size === before)
                    break;
                await sleep(300);
            }
        }
        // Looks like the final review page — switch to Submit selectors.
        const reviewLikely = /review|signature|verify/i.test(haystack);
        const candidateSelectors = reviewLikely
            ? TALEO_SUBMIT_SELECTORS
            : TALEO_CONTINUE_SELECTORS;
        if (request.mode !== 'submit' && reviewLikely) {
            return {
                message: 'Training run reached Taleo review page (submit not clicked).',
                status: 'completed',
            };
        }
        const advanced = await clickFirstMatching(input, candidateSelectors, root);
        if (!advanced) {
            // Stalled — bail out so the user can intervene.
            if (title === lastTitle) {
                return {
                    message: `Taleo wizard stalled on "${title ?? 'unknown'}" — no Continue/Submit found.`,
                    status: 'failed',
                };
            }
        }
        lastTitle = title;
        if (reviewLikely && request.mode === 'submit') {
            const confirmation = await waitForSubmissionConfirmation(input);
            if (confirmation.confirmed) {
                return {
                    message: 'Taleo submit confirmed.',
                    status: 'completed',
                };
            }
        }
    }
    return {
        message: `Taleo wizard exceeded ${MAX_PAGE_ITERATIONS} pages without confirmation.`,
        status: 'confirmation_timeout',
    };
}
async function tryFill(input, selectors, value, reason, attemptedSelectors, root) {
    for (const selector of selectors) {
        if (attemptedSelectors.has(selector))
            continue;
        try {
            if (!root.querySelector(selector))
                continue;
        }
        catch {
            continue;
        }
        const result = await call(input, 'fill', { selector, value }, reason);
        if (result.ok) {
            attemptedSelectors.add(selector);
            return true;
        }
    }
    return false;
}
async function clickFirstMatching(input, selectors, root) {
    for (const selector of selectors) {
        try {
            if (!root.querySelector(selector))
                continue;
        }
        catch {
            continue;
        }
        const result = await call(input, 'click', { selector }, `Taleo click ${selector}`);
        if (result.ok)
            return true;
    }
    return false;
}
