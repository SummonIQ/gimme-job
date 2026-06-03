// Copies the Playwright Chromium binary out of the system cache and into
// desktop/playwright-browsers/ so electron-builder can bundle it inside
// the .app's Resources/ directory. Run this once before `bun run dist`.
//
// On the user's machine after `bunx playwright install chromium`, the
// binary lands at:
//   ~/Library/Caches/ms-playwright/chromium-<revision>/...
// In the packaged app we re-home it at:
//   Contents/Resources/playwright-browsers/chromium-<revision>/...
// and main.ts sets PLAYWRIGHT_BROWSERS_PATH to point there at runtime.
import { cp, mkdir, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const desktopRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const destRoot = path.join(desktopRoot, 'playwright-browsers');
const cacheRoot = process.env.PLAYWRIGHT_BROWSERS_PATH
    ?? path.join(os.homedir(), 'Library', 'Caches', 'ms-playwright');
// Read the exact Chromium revision the installed Playwright pins. Avoids
// picking a stale build that happens to also be in the cache.
async function readPinnedChromiumDir() {
    const manifestPath = path.join(desktopRoot, 'node_modules', 'playwright-core', 'browsers.json');
    const raw = await readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(raw);
    const chromium = manifest.browsers.find(b => b.name === 'chromium');
    if (!chromium) {
        throw new Error(`No 'chromium' entry in ${manifestPath}`);
    }
    return `chromium-${chromium.revision}`;
}
async function main() {
    const chromiumDirName = await readPinnedChromiumDir();
    const srcDir = path.join(cacheRoot, chromiumDirName);
    const destDir = path.join(destRoot, chromiumDirName);
    const srcStat = await stat(srcDir);
    if (!srcStat.isDirectory()) {
        throw new Error(`${srcDir} is not a directory.`);
    }
    await rm(destRoot, { recursive: true, force: true });
    await mkdir(destRoot, { recursive: true });
    // eslint-disable-next-line no-console
    console.log(`[prepare-playwright-browsers] Copying ${chromiumDirName}…`);
    await cp(srcDir, destDir, { recursive: true });
    // eslint-disable-next-line no-console
    console.log(`[prepare-playwright-browsers] Done → ${destDir}`);
}
await main();
