/**
 * P5.7 - payload redaction.
 *
 * Desktop-side tools may handle PII (identity values: name, email, phone,
 * address, DOB, SSN, visa status, etc). The audit writer must not ship
 * those values to the web DB - only keys. This module is pure so the
 * desktop writer can reuse it AND the web-side ingestion endpoint can
 * double-check.
 */

const IDENTITY_KEYS: readonly string[] = [
  'firstName',
  'first_name',
  'lastName',
  'last_name',
  'fullName',
  'email',
  'phone',
  'phoneNumber',
  'address',
  'addressLine1',
  'addressLine2',
  'city',
  'state',
  'postalCode',
  'zipCode',
  'country',
  'dateOfBirth',
  'dob',
  'ssn',
  'socialSecurity',
  'taxId',
  'linkedin',
  'github',
  'website',
  'portfolio',
  'resumeUrl',
  'salary',
  'salaryExpectations',
  'workAuthorization',
  'visaStatus',
  'sponsorshipRequired',
  'gender',
  'race',
  'veteranStatus',
  'disabilityStatus',
  'password',
  'token',
  'authorization',
  'value',
];

/** Extensible set exposed so callers can add domain-specific keys. */
export const DEFAULT_SENSITIVE_KEYS: ReadonlySet<string> = new Set(
  IDENTITY_KEYS.map(k => k.toLowerCase()),
);

export interface RedactResult {
  readonly payload: unknown;
  readonly redactedKeys: readonly string[];
}

/**
 * Recursively walks the payload and replaces sensitive values with the
 * literal string `"[REDACTED]"`. Keys that were redacted are returned in
 * dot-path form so the admin UI can show WHAT was removed without leaking
 * the value.
 */
export function redactSensitivePayload(
  payload: unknown,
  sensitiveKeys: ReadonlySet<string> = DEFAULT_SENSITIVE_KEYS,
): RedactResult {
  const redactedKeys: string[] = [];
  const visit = (value: unknown, path: string): unknown => {
    if (value === null || typeof value !== 'object') return value;
    if (Array.isArray(value)) {
      return value.map((v, i) => visit(v, `${path}[${i}]`));
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const pathKey = path ? `${path}.${k}` : k;
      if (sensitiveKeys.has(k.toLowerCase())) {
        out[k] = '[REDACTED]';
        redactedKeys.push(pathKey);
      } else {
        out[k] = visit(v, pathKey);
      }
    }
    return out;
  };
  const redacted = visit(payload, '');
  return { payload: redacted, redactedKeys };
}

/**
 * Identity-read rows are special - the whole value is always redacted,
 * regardless of key name. The desktop writer sets
 * `action='identity_read'` and calls this instead of
 * `redactSensitivePayload`.
 */
export function redactIdentityReadPayload(
  payload: unknown,
): RedactResult {
  if (!payload || typeof payload !== 'object') {
    return { payload: { redactedValue: '[REDACTED]' }, redactedKeys: ['value'] };
  }
  const input = payload as Record<string, unknown>;
  const key = typeof input.key === 'string' ? input.key : null;
  return {
    payload: key ? { key, value: '[REDACTED]' } : { value: '[REDACTED]' },
    redactedKeys: key ? ['value'] : ['value'],
  };
}
