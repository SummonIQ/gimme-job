import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { IDENTITY_KEYS, IDENTITY_SCHEMA, assertIdentityKey, validateIdentityValue, } from './schema.js';
const execFileAsync = promisify(execFile);
export const IDENTITY_KEYCHAIN_SERVICE = 'com.gimme-job.desktop.identity';
export const IDENTITY_KEYCHAIN_ACCOUNT_PREFIX = 'identity:';
function isKeychainNotFoundError(error) {
    const maybeError = error;
    return (maybeError.code === 44 ||
        maybeError.stderr?.includes('could not be found') === true);
}
/**
 * Mac keychain-backed identity store. Follows the same pattern as the
 * auth keychain store (see `desktop/electron/auth/keychain-store.ts`).
 * Each identity key maps to a distinct keychain entry so rotating one
 * value does not disturb the others.
 */
export function createMacOSIdentityStore(opts = {}) {
    const service = opts.service ?? IDENTITY_KEYCHAIN_SERVICE;
    const accountPrefix = opts.accountPrefix ?? IDENTITY_KEYCHAIN_ACCOUNT_PREFIX;
    const accountFor = (key) => `${accountPrefix}${key}`;
    return {
        async clear(rawKey) {
            const key = assertIdentityKey(rawKey);
            try {
                await execFileAsync('security', [
                    'delete-generic-password',
                    '-a',
                    accountFor(key),
                    '-s',
                    service,
                ]);
            }
            catch (error) {
                if (!isKeychainNotFoundError(error))
                    throw error;
            }
        },
        async list() {
            const entries = [];
            for (const key of IDENTITY_KEYS) {
                try {
                    await execFileAsync('security', [
                        'find-generic-password',
                        '-a',
                        accountFor(key),
                        '-s',
                        service,
                    ]);
                    entries.push({ hasValue: true, key });
                }
                catch (error) {
                    if (isKeychainNotFoundError(error)) {
                        entries.push({ hasValue: false, key });
                    }
                    else {
                        throw error;
                    }
                }
            }
            return entries;
        },
        async read(rawKey) {
            const key = assertIdentityKey(rawKey);
            try {
                const { stdout } = await execFileAsync('security', [
                    'find-generic-password',
                    '-a',
                    accountFor(key),
                    '-s',
                    service,
                    '-w',
                ]);
                const trimmed = stdout.replace(/\s+$/, '');
                return trimmed.length === 0 ? null : trimmed;
            }
            catch (error) {
                if (isKeychainNotFoundError(error))
                    return null;
                throw error;
            }
        },
        async snapshot() {
            const out = {};
            for (const key of IDENTITY_KEYS) {
                try {
                    const { stdout } = await execFileAsync('security', [
                        'find-generic-password',
                        '-a',
                        accountFor(key),
                        '-s',
                        service,
                        '-w',
                    ]);
                    const value = stdout.replace(/\s+$/, '');
                    if (value.length > 0)
                        out[key] = value;
                }
                catch (error) {
                    if (!isKeychainNotFoundError(error))
                        throw error;
                }
            }
            return out;
        },
        async write(rawKey, value) {
            const key = assertIdentityKey(rawKey);
            const { ok, reason } = validateIdentityValue(key, value);
            if (!ok) {
                throw new Error(`identity: value for "${key}" failed validation: ${reason}`);
            }
            await execFileAsync('security', [
                'add-generic-password',
                '-U',
                '-a',
                accountFor(key),
                '-s',
                service,
                '-w',
                value,
            ]);
        },
    };
}
/**
 * In-memory store used by tests and by dev mode where the macOS keychain
 * is unavailable. Same surface as the keychain-backed impl; no
 * persistence across process restarts.
 */
export function createMemoryIdentityStore(initial = {}) {
    const values = new Map();
    for (const [key, value] of Object.entries(initial)) {
        if (value !== undefined) {
            const validated = assertIdentityKey(key);
            const result = validateIdentityValue(validated, value);
            if (!result.ok) {
                throw new Error(`identity: initial value for "${validated}" failed validation: ${result.reason}`);
            }
            values.set(validated, value);
        }
    }
    return {
        async clear(rawKey) {
            const key = assertIdentityKey(rawKey);
            values.delete(key);
        },
        async list() {
            return IDENTITY_KEYS.map(key => ({
                hasValue: values.has(key),
                key,
            }));
        },
        async read(rawKey) {
            const key = assertIdentityKey(rawKey);
            return values.get(key) ?? null;
        },
        async snapshot() {
            const out = {};
            for (const [key, value] of values.entries()) {
                out[key] = value;
            }
            return out;
        },
        async write(rawKey, value) {
            const key = assertIdentityKey(rawKey);
            const result = validateIdentityValue(key, value);
            if (!result.ok) {
                throw new Error(`identity: value for "${key}" failed validation: ${result.reason}`);
            }
            values.set(key, value);
        },
    };
}
/**
 * Default factory. Uses macOS keychain when available; falls back to
 * memory-only for tests and non-Darwin dev boxes. Callers that want to
 * force memory (e.g. unit tests) should call createMemoryIdentityStore
 * directly.
 */
export function createIdentityStore(opts = {}) {
    if (opts.forceMemory || process.platform !== 'darwin') {
        return createMemoryIdentityStore(opts.initial ?? {});
    }
    return createMacOSIdentityStore();
}
/**
 * Look up a value for the identity_load tool. Throws when the key is
 * unknown (bad schema) OR when the key is known but empty (requires
 * user setup). Returning null is NOT acceptable - the tool caller
 * expects a string or a loud failure.
 */
export async function loadIdentityValue(store, rawKey) {
    const key = assertIdentityKey(rawKey);
    const value = await store.read(key);
    if (value === null) {
        throw new Error(`identity: key "${key}" is known but not populated. Open the Identity admin UI to seed it.`);
    }
    return value;
}
export { IDENTITY_KEYCHAIN_ACCOUNT_PREFIX as __ACCOUNT_PREFIX };
export { IDENTITY_SCHEMA };
