import { HTMLElement, parse } from 'node-html-parser';
const ERROR_SELECTOR = '[role="alert"], .field-error, .error, .errors, .jv-error, [data-testid*="error" i], [aria-live="assertive"]';
const FIELD_SELECTOR = 'input, select, textarea';
export function extractValidationFailures(html) {
    const root = parse(html);
    const failures = new Map();
    const errorMessages = collectErrorMessages(root);
    for (const field of root.querySelectorAll(`${FIELD_SELECTOR}[aria-invalid="true"]`)) {
        if (!isUserFacingField(field))
            continue;
        const fieldLabel = getFieldLabel(root, field);
        const message = findMessageForField(errorMessages, fieldLabel) ??
            `${fieldLabel || 'Field'} is invalid.`;
        addFailure(failures, {
            fieldLabel: fieldLabel || inferFieldLabelFromMessage(message) || 'Field',
            fieldSelector: getFieldSelector(field),
            message,
        });
    }
    for (const error of errorMessages) {
        addFailure(failures, {
            fieldLabel: inferFieldLabelFromMessage(error.message) || 'Unknown field',
            fieldSelector: '',
            message: error.message,
        });
    }
    return [...failures.values()];
}
function collectErrorMessages(root) {
    const seen = new Set();
    const messages = [];
    for (const element of root.querySelectorAll(ERROR_SELECTOR)) {
        const message = cleanText(element.text);
        if (!message || seen.has(message))
            continue;
        seen.add(message);
        messages.push({ message });
    }
    return messages;
}
function findMessageForField(messages, fieldLabel) {
    if (messages.length === 0)
        return null;
    if (messages.length === 1)
        return messages[0].message;
    const normalizedLabel = normalizeText(fieldLabel);
    if (!normalizedLabel)
        return messages[0].message;
    return (messages.find(({ message }) => normalizeText(message).includes(normalizedLabel))?.message ?? messages[0].message);
}
function addFailure(failures, failure) {
    const message = cleanText(failure.message);
    if (!message)
        return;
    const fieldLabel = cleanText(failure.fieldLabel) || 'Unknown field';
    const key = `${normalizeText(fieldLabel)}:${normalizeText(message)}`;
    if (failures.has(key))
        return;
    failures.set(key, {
        fieldLabel,
        fieldSelector: failure.fieldSelector,
        message,
    });
}
function getFieldLabel(root, field) {
    const ariaLabel = cleanText(field.getAttribute('aria-label') ?? '');
    if (ariaLabel)
        return ariaLabel;
    const id = field.getAttribute('id');
    if (id) {
        const label = root.querySelector(`label[for="${cssEscapeAttr(id)}"]`);
        const text = cleanText(label?.text ?? '');
        if (text)
            return text;
    }
    const wrappingLabel = findAncestorLabel(field);
    if (wrappingLabel) {
        const text = cleanText(wrappingLabel.text);
        if (text)
            return text;
    }
    return cleanText(field.getAttribute('name') ??
        field.getAttribute('placeholder') ??
        field.getAttribute('id') ??
        '');
}
function findAncestorLabel(field) {
    let current = field.parentNode;
    while (current) {
        if (current instanceof HTMLElement &&
            current.tagName.toLowerCase() === 'label') {
            return current;
        }
        current = current.parentNode;
    }
    return null;
}
function isUserFacingField(field) {
    const type = (field.getAttribute('type') ?? '').toLowerCase();
    return type !== 'hidden' && type !== 'submit' && type !== 'button';
}
function getFieldSelector(field) {
    const tag = field.tagName.toLowerCase();
    const id = field.getAttribute('id');
    if (id)
        return `${tag}#${cssEscape(id)}`;
    const name = field.getAttribute('name');
    if (name)
        return `${tag}[name="${cssEscapeAttr(name)}"]`;
    return tag;
}
function inferFieldLabelFromMessage(message) {
    const match = cleanText(message).match(/^(.+?)\s+(?:is|are|must be|can't be|cannot be)\s+(?:required|empty|blank|missing|invalid|selected|filled)/i);
    return cleanText(match?.[1] ?? '') || null;
}
function normalizeText(value) {
    return cleanText(value).toLowerCase();
}
function cleanText(value) {
    return value.replace(/\s+/g, ' ').trim();
}
function cssEscape(value) {
    return value.replace(/([ !"#$%&'()*+,./:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}
function cssEscapeAttr(value) {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
