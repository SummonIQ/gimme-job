import { buildDesktopAgentSystemPrompt } from './prompt.js';
import { DesktopAgentCancelledError, } from './types.js';
const TOOL_DESCRIPTIONS = {
    click: 'Click an element selected from the active ATS page.',
    cookies_get: 'Read cookies from the active desktop session.',
    cookies_set: 'Write cookies into the active desktop session.',
    dom_snapshot: 'Read the current ATS page title, URL, and HTML.',
    fill: 'Set an input value and emit input/change events.',
    identity_load: 'Read one approved identity value by key.',
    navigate: 'Navigate the ATS assist view to an http(s) URL.',
    network_observe: 'Enable or disable CDP network observation.',
    network_replay: 'Replay a recorded HTTP request.',
    press_key: 'Send a keyboard key to the ATS assist view.',
    read_element: 'Read attributes, text, tag, and value for one element.',
    screenshot_region: 'Capture a region of the ATS assist view.',
    scroll_into_view: 'Scroll one element into view.',
    select: 'Choose a value from a select element.',
    submit_guard: 'Enable or read the guard that blocks submit-intent clicks.',
    upload: 'Attach a local file path to a file input.',
    wait_for: 'Wait for a selector or text to appear on the active ATS page.',
};
export function createDesktopAgentSession(registry, { mode = 'training', runtime }) {
    return {
        async run({ objective, signal }) {
            const events = [];
            const systemPrompt = buildDesktopAgentSystemPrompt({ mode });
            const callTool = createToolCaller(registry, events, signal);
            try {
                if (mode === 'training') {
                    const guardResult = await callTool({
                        input: { enabled: true },
                        reason: 'training-mode-default',
                        tool: 'submit_guard',
                    });
                    if (!guardResult.ok) {
                        return createRunResult({
                            events,
                            message: guardResult.error?.message ?? 'submit_guard failed.',
                            mode,
                            status: 'failed',
                            systemPrompt,
                        });
                    }
                }
                const runtimeResult = await runtime.run({
                    callTool,
                    mode,
                    objective,
                    signal,
                    systemPrompt,
                    tools: createToolDefinitions(registry.listTools()),
                });
                return createRunResult({
                    events,
                    message: runtimeResult.message,
                    mode,
                    status: resolveStatus(events, runtimeResult.status),
                    systemPrompt,
                    validationFailures: runtimeResult.validationFailures,
                });
            }
            catch (error) {
                if (error instanceof DesktopAgentCancelledError) {
                    return createRunResult({
                        events,
                        message: error.message,
                        mode,
                        status: 'cancelled',
                        systemPrompt,
                    });
                }
                throw error;
            }
        },
    };
}
function createToolCaller(registry, events, signal) {
    return async (request) => {
        if (signal?.aborted) {
            throw new DesktopAgentCancelledError();
        }
        const result = await registry.call(request);
        events.push({ ...request, result });
        if (signal?.aborted) {
            throw new DesktopAgentCancelledError();
        }
        return result;
    };
}
function createToolDefinitions(toolNames) {
    return toolNames.map(name => ({
        description: TOOL_DESCRIPTIONS[name],
        name,
    }));
}
function createRunResult(input) {
    return input;
}
function resolveStatus(events, runtimeStatus) {
    if (events.some(event => isSubmitGuardBlock(event.result))) {
        return 'blocked_by_submit_guard';
    }
    // The runtime is the authority on whether the run succeeded. Individual
    // failed tool calls during a run are common and benign (e.g. a `select`
    // attempt against a `#state` field that this particular form doesn't
    // expose) and must NOT force the whole run to `failed`. The runner sets
    // its own `runtimeStatus` when it concludes — `'failed'` for real
    // submission failures (no confirmation, validation rejection), or
    // `'completed'` for clean training runs and verified submits. Trust it.
    return runtimeStatus ?? 'completed';
}
function isSubmitGuardBlock(result) {
    return (!result.ok &&
        result.error?.message.includes('submit_guard blocked a submit-intent click.') === true);
}
