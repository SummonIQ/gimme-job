import type { chromium as ChromiumNamespace } from 'playwright';

/**
 * Single source of truth for whether Playwright/Chromium can run in this
 * environment. On Vercel serverless the runtime cannot launch a Chromium
 * binary, so every module that tries to spawn a browser must check this
 * flag first and return a graceful 503 instead of crashing the function.
 *
 * Enabling Playwright:
 *   - Local dev: set `ENABLE_PLAYWRIGHT_RENDER=1` in `.env.local`
 *   - Self-hosted worker (Railway/Fly/DO/VPS): set the env var there
 *   - Vercel: leave unset — the automation features that need a browser
 *     will return a structured unavailable response
 *
 * This module never imports `playwright` at module load time. All access
 * goes through `loadChromium()` which dynamically imports on demand. That
 * keeps `playwright` out of the cold-start path on Vercel entirely.
 */
export const playwrightEnabled =
  process.env.ENABLE_PLAYWRIGHT_RENDER === '1' && !process.env.VERCEL;

export class PlaywrightUnavailableError extends Error {
  code = 'PLAYWRIGHT_UNAVAILABLE';
  constructor(feature: string) {
    super(
      `${feature} requires a Chromium runtime, which is not available on this host. ` +
        `Run a worker with ENABLE_PLAYWRIGHT_RENDER=1 (Railway/Fly/DO/VPS) or ` +
        `point the app at a remote browser service.`,
    );
    this.name = 'PlaywrightUnavailableError';
  }
}

/**
 * Dynamically import the Playwright `chromium` namespace. Returns null when
 * the environment has opted out, or if the import itself fails (e.g. the
 * package or Chromium binary isn't installed).
 */
export async function loadChromium(): Promise<typeof ChromiumNamespace | null> {
  if (!playwrightEnabled) return null;
  try {
    const mod = await import('playwright');
    return mod.chromium;
  } catch (error) {
    console.warn(
      '[Playwright] Dynamic import failed; treating as unavailable:',
      error,
    );
    return null;
  }
}

/**
 * Same as `loadChromium` but throws `PlaywrightUnavailableError` instead of
 * returning null. Use this in code paths where there is no reasonable
 * fallback and you want a structured error to bubble up.
 */
export async function requireChromium(
  feature: string,
): Promise<typeof ChromiumNamespace> {
  const chromium = await loadChromium();
  if (!chromium) {
    throw new PlaywrightUnavailableError(feature);
  }
  return chromium;
}
