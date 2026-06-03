const REDACTED = '[REDACTED]';
const SENSITIVE_KEYS = new Set([
    'address',
    'addressLine1',
    'addressLine2',
    'authorization',
    'city',
    'country',
    'dateOfBirth',
    'disabilityStatus',
    'dob',
    'email',
    'firstName',
    'first_name',
    'fullName',
    'gender',
    'github',
    'lastName',
    'last_name',
    'linkedin',
    'password',
    'phone',
    'phoneNumber',
    'portfolio',
    'postalCode',
    'race',
    'resumeUrl',
    'salary',
    'salaryExpectations',
    'socialSecurity',
    'sponsorshipRequired',
    'ssn',
    'state',
    'taxId',
    'token',
    'value',
    'veteranStatus',
    'visaStatus',
    'website',
    'workAuthorization',
    'zipCode',
].map(key => key.toLowerCase()));
export function createDesktopAuditWriter({ appUrl, desktopSessionId = crypto.randomUUID(), fetchImpl = fetch, tokenStore, }) {
    const endpoint = `${appUrl.replace(/\/$/, '')}/api/desktop-audit/ingest`;
    return {
        async write(row) {
            return this.writeBatch([row]);
        },
        async writeBatch(rows) {
            if (rows.length === 0)
                return { created: 0, ids: [] };
            const token = await tokenStore.readToken();
            if (!token) {
                throw new Error('desktop-audit: paired desktop token is required.');
            }
            const response = await fetchImpl(endpoint, {
                body: JSON.stringify({
                    rows: rows.map(row => serializeAuditRow(row, {
                        desktopSessionId,
                    })),
                }),
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                method: 'POST',
            });
            const payload = (await response.json().catch(() => ({})));
            if (!response.ok) {
                throw new Error(`desktop-audit: ingest failed with HTTP ${response.status}: ${getError(payload)}`);
            }
            return parseWriteResult(payload);
        },
    };
}
function serializeAuditRow(row, defaults) {
    return {
        action: row.action,
        desktopSessionId: row.desktopSessionId ?? defaults.desktopSessionId,
        durationMs: row.durationMs ?? undefined,
        errorMessage: row.errorMessage ?? undefined,
        jobLeadId: row.jobLeadId ?? undefined,
        outcome: row.outcome ?? undefined,
        payload: row.action === 'identity_read'
            ? redactIdentityReadPayload(row.payload)
            : redactSensitivePayload(row.payload),
        runtimeSessionId: row.runtimeSessionId ?? undefined,
        toolName: row.toolName,
    };
}
function redactIdentityReadPayload(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { redactedValue: REDACTED };
    }
    const input = payload;
    const key = typeof input.key === 'string' ? input.key : null;
    return key ? { key, value: REDACTED } : { value: REDACTED };
}
function redactSensitivePayload(payload) {
    if (payload === null || typeof payload !== 'object')
        return payload;
    if (Array.isArray(payload)) {
        return payload.map(item => redactSensitivePayload(item));
    }
    const output = {};
    for (const [key, value] of Object.entries(payload)) {
        output[key] = SENSITIVE_KEYS.has(key.toLowerCase())
            ? REDACTED
            : redactSensitivePayload(value);
    }
    return output;
}
function parseWriteResult(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('desktop-audit: invalid ingest response.');
    }
    const record = payload;
    const created = record.created;
    const ids = record.ids;
    if (typeof created !== 'number' ||
        !Array.isArray(ids) ||
        !ids.every(id => typeof id === 'string')) {
        throw new Error('desktop-audit: invalid ingest response.');
    }
    return { created, ids };
}
function getError(payload) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return 'unknown error';
    }
    const error = payload.error;
    return typeof error === 'string' ? error : 'unknown error';
}
