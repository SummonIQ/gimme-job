import * as fs from 'node:fs';
import * as path from 'node:path';

import { app } from 'electron';

const SETTINGS_FILE = 'desktop-settings.json';

let cache: Record<string, unknown> | null = null;

function getSettingsPath(): string {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

function loadFromDisk(): Record<string, unknown> {
  if (cache !== null) return cache;
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      cache = parsed as Record<string, unknown>;
      return cache;
    }
  } catch {
    // file does not exist or is invalid; start fresh
  }
  cache = {};
  return cache;
}

function saveToDisk(data: Record<string, unknown>) {
  cache = data;
  try {
    fs.writeFileSync(
      getSettingsPath(),
      JSON.stringify(data, null, 2),
      'utf8',
    );
  } catch (error) {
    console.error('[settings-store] Failed to write settings:', error);
  }
}

export function getSetting(key: string): unknown {
  return loadFromDisk()[key];
}

export function setSetting(key: string, value: unknown): void {
  saveToDisk({ ...loadFromDisk(), [key]: value });
}
