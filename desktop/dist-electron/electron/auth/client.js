export const DESKTOP_RUNTIME_SCOPE = 'desktop:runtime';
export function createDesktopTokenClient(input) {
    const appUrl = input.appUrl.replace(/\/$/, '');
    const fetchImpl = input.fetchImpl ?? fetch;
    return {
        async exchangePairingCode(body) {
            const response = await fetchImpl(`${appUrl}/api/desktop-tokens/exchange`, {
                body: JSON.stringify(body),
                headers: { 'content-type': 'application/json' },
                method: 'POST',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                return {
                    ok: false,
                    reason: getString(payload, 'error') ?? `HTTP_${response.status}`,
                };
            }
            const token = getString(payload, 'token');
            const tokenId = getString(payload, 'tokenId');
            const userId = getString(payload, 'userId');
            if (!token || !tokenId || !userId) {
                return { ok: false, reason: 'INVALID_EXCHANGE_RESPONSE' };
            }
            return { ok: true, token, tokenId, userId };
        },
        async validateToken(token) {
            const response = await fetchImpl(`${appUrl}/api/desktop-tokens/validate?scope=${encodeURIComponent(DESKTOP_RUNTIME_SCOPE)}`, {
                headers: { authorization: `Bearer ${token}` },
                method: 'POST',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                return {
                    ok: false,
                    reason: getString(payload, 'error') ?? `HTTP_${response.status}`,
                };
            }
            const tokenId = getString(payload, 'tokenId');
            const userId = getString(payload, 'userId');
            const scopes = getStringArray(payload, 'scopes');
            if (!tokenId || !userId || !scopes) {
                return { ok: false, reason: 'INVALID_VALIDATE_RESPONSE' };
            }
            return { ok: true, scopes, tokenId, userId };
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
function getString(payload, key) {
    const value = payload[key];
    return typeof value === 'string' ? value : null;
}
function getStringArray(payload, key) {
    const value = payload[key];
    if (!Array.isArray(value) || !value.every(item => typeof item === 'string')) {
        return null;
    }
    return value;
}
