const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[\d\s().+-]{7,}$/;
const SSN_PATTERN = /^\d{3}-?\d{2}-?\d{4}$/;

const NAME_FIELD_PATTERNS =
  /first.?name|last.?name|full.?name|given.?name|family.?name|middle.?name/i;
const ADDRESS_FIELD_PATTERNS =
  /address|street|city|state|zip|postal|country/i;
const PHONE_FIELD_PATTERNS = /phone|mobile|cell|tel/i;
const EMAIL_FIELD_PATTERNS = /email|e-mail/i;

export function redactPiiValue(
  value: string | null | undefined,
  fieldLabel?: string | null,
  fieldName?: string | null,
): string | null {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  // Check by value pattern
  if (EMAIL_PATTERN.test(trimmed)) return '[EMAIL]';
  if (SSN_PATTERN.test(trimmed)) return '[SSN]';
  if (PHONE_PATTERN.test(trimmed)) return '[PHONE]';

  // Check by field name/label
  const fieldContext = `${fieldLabel ?? ''} ${fieldName ?? ''}`;
  if (NAME_FIELD_PATTERNS.test(fieldContext)) return '[NAME]';
  if (ADDRESS_FIELD_PATTERNS.test(fieldContext)) return '[ADDRESS]';
  if (PHONE_FIELD_PATTERNS.test(fieldContext)) return '[PHONE]';
  if (EMAIL_FIELD_PATTERNS.test(fieldContext)) return '[EMAIL]';

  // Non-PII values (dropdowns, checkboxes, etc.)
  return trimmed;
}
