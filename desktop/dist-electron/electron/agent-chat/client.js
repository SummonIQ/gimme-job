export function createDesktopAgentChatClient({ appUrl, collectContext, fetchImpl = fetch, tokenStore, addFieldRule, fillAssistField, }) {
    const normalizedAppUrl = appUrl.replace(/\/$/, '');
    return {
        async sendMessage(request) {
            const token = await tokenStore.readToken();
            if (!token) {
                throw new Error('Pair this desktop before using chat.');
            }
            const context = await collectContext();
            // Intercept teaching / ad-hoc fill intents before round-tripping to
            // the LLM endpoint. Both produce a synthetic chat reply and skip the
            // network call entirely — saves a token, gives instant feedback.
            const lastUserMessage = readLastUserMessage(request.messages);
            if (lastUserMessage) {
                const teach = parseTeachIntent(lastUserMessage);
                if (teach && addFieldRule) {
                    addFieldRule({
                        question: teach.question,
                        answer: teach.answer,
                        hostname: deriveHostname(context.url),
                    });
                    return {
                        content: `Saved: when I see "${teach.question}", I'll answer "${teach.answer}".`,
                        context,
                        mutations: [],
                    };
                }
                const fill = parseFillIntent(lastUserMessage);
                if (fill && fillAssistField) {
                    const target = matchFieldByQuestion(context.fields, fill.question);
                    if (!target) {
                        return {
                            content: `I couldn't find a field matching "${fill.question}" on this page. Try wording it like the form's label.`,
                            context,
                            mutations: [],
                        };
                    }
                    const kind = pickFillKind(target);
                    const result = await fillAssistField({
                        selector: target.selector,
                        value: fill.answer,
                        kind,
                    });
                    if (!result.ok) {
                        return {
                            content: `Tried to fill "${target.label ?? target.selector}" but it failed: ${result.error ?? 'unknown error'}.`,
                            context,
                            mutations: [],
                        };
                    }
                    // Auto-save the answer as a rule so future runs reuse it.
                    if (addFieldRule && target.label) {
                        addFieldRule({
                            question: target.label,
                            answer: fill.answer,
                            hostname: deriveHostname(context.url),
                        });
                    }
                    return {
                        content: `Filled "${target.label ?? target.selector}" with "${fill.answer}". Saved as a rule for next time.`,
                        context,
                        mutations: [
                            {
                                message: 'Filled via chat',
                                selector: target.selector,
                                type: 'training_correction',
                            },
                        ],
                    };
                }
            }
            const response = await fetchImpl(`${normalizedAppUrl}/api/desktop/agent-chat`, {
                body: JSON.stringify({
                    aiProvider: request.aiProvider,
                    allowTrainingWrite: request.allowTrainingWrite,
                    context,
                    messages: request.messages,
                }),
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                method: 'POST',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                throw new Error(getString(payload, 'error') ?? `Chat failed: HTTP_${response.status}`);
            }
            return readChatResult(payload, context);
        },
    };
}
async function readJsonObject(response) {
    const payload = (await response.json().catch(() => ({})));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {};
    }
    return payload;
}
function readChatResult(payload, context) {
    const content = getString(payload, 'content');
    if (!content) {
        throw new Error('INVALID_DESKTOP_AGENT_CHAT_RESPONSE');
    }
    const mutationsPayload = payload.mutations;
    const mutations = Array.isArray(mutationsPayload)
        ? mutationsPayload
            .filter((mutation) => mutation !== null &&
            typeof mutation === 'object' &&
            !Array.isArray(mutation))
            .map(mutation => ({
            message: getString(mutation, 'message') ?? 'Correction recorded.',
            selector: getString(mutation, 'selector') ?? undefined,
            type: 'training_correction',
        }))
        : [];
    return {
        content,
        context,
        mutations,
    };
}
function getString(payload, key) {
    const value = payload[key];
    return typeof value === 'string' ? value : null;
}
function readLastUserMessage(messages) {
    for (let i = messages.length - 1; i >= 0; i -= 1) {
        const message = messages[i];
        if (message?.role === 'user') {
            return message.content.trim();
        }
    }
    return null;
}
function deriveHostname(url) {
    try {
        return new URL(url).hostname.toLowerCase() || null;
    }
    catch {
        return null;
    }
}
// Recognize teaching intent — "always answer X with Y", "always say Y for X",
// "if you see X answer Y" — and return the extracted (question, answer) pair.
function parseTeachIntent(message) {
    const patterns = [
        /^always\s+answer\s+(.+?)\s+(?:with|as|=)\s+(.+)$/i,
        /^always\s+say\s+(.+?)\s+(?:for|to|when asked)\s+(.+)$/i,
        /^if\s+you\s+see\s+(.+?)[,;]?\s+(?:answer|say|reply|respond(?:\s+with)?)\s+(.+)$/i,
        /^when(?:\s+you\s+see)?\s+(.+?)[,;]?\s+(?:answer|say|reply|use)\s+(.+)$/i,
        /^remember\s*[:,]?\s*(.+?)\s+(?:=>?|→|=)\s+(.+)$/i,
    ];
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (!match)
            continue;
        const question = (match[1] ?? '').trim().replace(/^["'`]|["'`]$/g, '');
        const answer = (match[2] ?? '').trim().replace(/^["'`]|["'`]$/g, '');
        if (question.length >= 3 && answer.length > 0) {
            // For the "if you see" / "when you see" variants the order is the
            // same (question first, answer second) so no swap needed.
            return { question, answer };
        }
    }
    // "always say Y for X" — answer is first, question is second.
    const swapped = message.match(/^always\s+say\s+(.+?)\s+(?:for|when\s+(?:asked|i\s+see))\s+(.+)$/i);
    if (swapped) {
        const answer = (swapped[1] ?? '').trim().replace(/^["'`]|["'`]$/g, '');
        const question = (swapped[2] ?? '').trim().replace(/^["'`]|["'`]$/g, '');
        if (question.length >= 3 && answer.length > 0) {
            return { question, answer };
        }
    }
    return null;
}
// Recognize ad-hoc fill intent — "fill the X with Y", "set X to Y",
// "answer X with Y" — return the extracted (question, answer) pair.
function parseFillIntent(message) {
    const patterns = [
        /^fill\s+(?:the\s+|in\s+)?["'`]?(.+?)["'`]?\s+(?:question\s+)?(?:with|using|as|to)\s+["'`]?(.+?)["'`]?$/i,
        /^set\s+(?:the\s+)?["'`]?(.+?)["'`]?\s+(?:field\s+|question\s+)?(?:to|=)\s+["'`]?(.+?)["'`]?$/i,
        /^answer\s+(?:the\s+)?["'`]?(.+?)["'`]?\s+(?:with|using|as|=)\s+["'`]?(.+?)["'`]?$/i,
        /^reply\s+(?:to\s+)?["'`]?(.+?)["'`]?\s+(?:with|as)\s+["'`]?(.+?)["'`]?$/i,
        /^["'`]?(.+?)["'`]?\s+(?:is|should\s+be)\s+["'`]?(yes|no|true|false|n\/a|na)["'`]?$/i,
    ];
    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (!match)
            continue;
        const question = (match[1] ?? '').trim();
        const answer = (match[2] ?? '').trim();
        if (question.length >= 3 && answer.length > 0) {
            return { question, answer };
        }
    }
    return null;
}
function matchFieldByQuestion(fields, question) {
    const normalized = question.trim().toLowerCase();
    if (!normalized)
        return null;
    // Try exact label match, then substring, then fuzzy (word overlap).
    const exact = fields.find(field => field.visible !== false &&
        !field.disabled &&
        field.label &&
        field.label.trim().toLowerCase() === normalized);
    if (exact)
        return exact;
    const substring = fields.find(field => field.visible !== false &&
        !field.disabled &&
        field.label &&
        field.label.toLowerCase().includes(normalized));
    if (substring)
        return substring;
    const reverseSubstring = fields.find(field => field.visible !== false &&
        !field.disabled &&
        field.label &&
        normalized.includes(field.label.toLowerCase()));
    if (reverseSubstring)
        return reverseSubstring;
    // Word-overlap scoring: pick the field whose label shares the most
    // unique meaningful tokens with the question.
    const queryTokens = new Set(extractMeaningfulTokens(normalized));
    if (queryTokens.size === 0)
        return null;
    let best = null;
    for (const field of fields) {
        if (field.visible === false || field.disabled || !field.label)
            continue;
        const labelTokens = extractMeaningfulTokens(field.label.toLowerCase());
        let score = 0;
        for (const token of labelTokens) {
            if (queryTokens.has(token))
                score += 1;
        }
        if (score >= 2 && (!best || score > best.score)) {
            best = { field, score };
        }
    }
    return best?.field ?? null;
}
function extractMeaningfulTokens(text) {
    return text
        .split(/[^a-z0-9]+/)
        .filter(token => token.length >= 3 && !STOP_WORDS.has(token));
}
const STOP_WORDS = new Set([
    'the', 'and', 'for', 'are', 'you', 'with', 'from', 'this', 'that',
    'have', 'will', 'your', 'what', 'which', 'who', 'how', 'why', 'when',
    'about', 'into', 'their', 'they', 'them', 'has', 'had', 'was', 'were',
    'been', 'being', 'where', 'there', 'these', 'those',
]);
function pickFillKind(field) {
    const tag = field.tagName.toLowerCase();
    if (tag === 'select' || field.inputType === 'select')
        return 'select';
    if (field.inputType === 'typeahead')
        return 'typeahead';
    return 'fill';
}
