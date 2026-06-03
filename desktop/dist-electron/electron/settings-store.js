import * as fs from 'node:fs';
import * as path from 'node:path';
import { app } from 'electron';
const SETTINGS_FILE = 'desktop-settings.json';
let cache = null;
function getSettingsPath() {
    return path.join(app.getPath('userData'), SETTINGS_FILE);
}
function loadFromDisk() {
    if (cache !== null)
        return cache;
    try {
        const raw = fs.readFileSync(getSettingsPath(), 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            cache = parsed;
            return cache;
        }
    }
    catch {
        // file does not exist or is invalid; start fresh
    }
    cache = {};
    return cache;
}
function saveToDisk(data) {
    cache = data;
    try {
        fs.writeFileSync(getSettingsPath(), JSON.stringify(data, null, 2), 'utf8');
    }
    catch (error) {
        console.error('[settings-store] Failed to write settings:', error);
    }
}
export function getSetting(key) {
    return loadFromDisk()[key];
}
export function setSetting(key, value) {
    saveToDisk({ ...loadFromDisk(), [key]: value });
}
