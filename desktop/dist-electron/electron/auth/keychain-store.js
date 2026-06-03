import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execFileAsync = promisify(execFile);
export const DESKTOP_TOKEN_ACCOUNT = 'desktop-runtime';
export const DESKTOP_TOKEN_SERVICE = 'com.gimme-job.desktop';
export function createDesktopTokenStore() {
    if (process.platform !== 'darwin') {
        throw new Error('Desktop token keychain storage requires macOS keychain.');
    }
    return createMacOSKeychainTokenStore();
}
export function createMacOSKeychainTokenStore(opts = {}) {
    const account = opts.account ?? DESKTOP_TOKEN_ACCOUNT;
    const service = opts.service ?? DESKTOP_TOKEN_SERVICE;
    return {
        async clearToken() {
            try {
                await execFileAsync('security', [
                    'delete-generic-password',
                    '-a',
                    account,
                    '-s',
                    service,
                ]);
            }
            catch (error) {
                if (!isNotFoundError(error)) {
                    throw error;
                }
            }
        },
        async readToken() {
            try {
                const { stdout } = await execFileAsync('security', [
                    'find-generic-password',
                    '-a',
                    account,
                    '-s',
                    service,
                    '-w',
                ]);
                return stdout.trim() || null;
            }
            catch (error) {
                if (isNotFoundError(error)) {
                    return null;
                }
                throw error;
            }
        },
        async writeToken(token) {
            await execFileAsync('security', [
                'add-generic-password',
                '-U',
                '-a',
                account,
                '-s',
                service,
                '-w',
                token,
            ]);
        },
    };
}
export function createMemoryTokenStore(initialToken = null) {
    let token = initialToken;
    return {
        async clearToken() {
            token = null;
        },
        async readToken() {
            return token;
        },
        async writeToken(nextToken) {
            token = nextToken;
        },
    };
}
function isNotFoundError(error) {
    const maybeError = error;
    return (maybeError.code === 44 ||
        maybeError.stderr?.includes('could not be found') === true);
}
