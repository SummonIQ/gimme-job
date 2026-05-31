import { NextResponse, type NextRequest } from 'next/server';
import type {
  Browser,
  BrowserContext,
  Locator,
  Page,
} from 'playwright';

import { buildAssistModeSnapshot } from '@/app/api/assist-mode/_lib/build-assist-mode-snapshot';
import {
  PlaywrightUnavailableError,
  requireChromium,
} from '@/lib/browser/playwright-runtime';
import { getCurrentUser } from '@/lib/user/query';

const requestHeaders = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

interface AssistModeLiveSession {
  browser: Browser;
  context: BrowserContext;
  lastUsedAt: number;
  page: Page;
}

const SESSION_TTL_MS = 10 * 60 * 1000;

function getLiveSessionStore(): Map<string, AssistModeLiveSession> {
  const globalStore = globalThis as typeof globalThis & {
    __assistModeLiveSessions?: Map<string, AssistModeLiveSession>;
  };

  if (!globalStore.__assistModeLiveSessions) {
    globalStore.__assistModeLiveSessions = new Map();
  }

  return globalStore.__assistModeLiveSessions;
}

async function cleanupExpiredSessions(): Promise<void> {
  const now = Date.now();
  const store = getLiveSessionStore();

  for (const [key, session] of store.entries()) {
    if (now - session.lastUsedAt <= SESSION_TTL_MS) {
      continue;
    }

    try {
      await session.context.close();
      await session.browser.close();
    } catch {
      // Ignore cleanup failures.
    }

    store.delete(key);
  }
}

async function createLiveSession(): Promise<AssistModeLiveSession> {
  const chromium = await requireChromium('Assist-mode live actions');
  const browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--window-size=1280,900',
      '--disable-extensions',
      '--disable-dev-shm-usage',
    ],
    headless: true,
  });

  const context = await browser.newContext({
    colorScheme: 'dark',
    javaScriptEnabled: true,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    userAgent: requestHeaders['User-Agent'],
    viewport: { height: 900, width: 1280 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => false });
  });

  const page = await context.newPage();
  return {
    browser,
    context,
    lastUsedAt: Date.now(),
    page,
  };
}

async function getOrCreateLiveSession(sessionId: string) {
  await cleanupExpiredSessions();

  const store = getLiveSessionStore();
  const existingSession = store.get(sessionId);
  if (existingSession) {
    existingSession.lastUsedAt = Date.now();
    return existingSession;
  }

  const nextSession = await createLiveSession();
  store.set(sessionId, nextSession);
  return nextSession;
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function isBotChallengePage(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const title = document.title.toLowerCase();
    const body = document.body?.textContent?.toLowerCase() ?? '';

    if (title === 'just a moment...' || title.includes('attention required')) {
      return true;
    }

    if (
      document.getElementById('challenge-running') ||
      document.getElementById('challenge-form')
    ) {
      return true;
    }

    if (
      body.includes('performing security verification') ||
      body.includes('verify you are human') ||
      body.includes('please verify you are a human') ||
      body.includes('access to this page has been denied')
    ) {
      return true;
    }

    const formCount = document.querySelectorAll('form').length;
    const inputCount = document.querySelectorAll(
      'input:not([type="hidden"])',
    ).length;
    if (
      formCount <= 1 &&
      inputCount === 0 &&
      (document.querySelector('iframe[src*="hcaptcha"]') ||
        document.querySelector('iframe[src*="recaptcha"]'))
    ) {
      return true;
    }

    return false;
  });
}

async function navigateToAssistModePage({
  page,
  url,
}: {
  page: Page;
  url: string;
}): Promise<void> {
  try {
    await page.goto(url, {
      timeout: 30000,
      waitUntil: 'domcontentloaded',
    });
  } catch {
    await page.goto(url, {
      timeout: 15000,
      waitUntil: 'commit',
    });
  }

  await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);

  if (await isBotChallengePage(page)) {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline && (await isBotChallengePage(page))) {
      await page.waitForTimeout(1000);
    }
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => null);
  }
}

async function findActionLocator({
  label,
  page,
  selector,
}: {
  label?: string;
  page: Page;
  selector?: string;
}): Promise<Locator | null> {
  if (selector?.trim()) {
    try {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0) {
        return locator;
      }
    } catch {
      // Fall through to label-based matching.
    }
  }

  const trimmedLabel = label?.trim();
  if (!trimmedLabel) {
    return null;
  }

  const name = new RegExp(escapeRegex(trimmedLabel), 'i');
  const roleLocators = [
    page.getByRole('button', { name }).first(),
    page.getByRole('link', { name }).first(),
  ];

  for (const locator of roleLocators) {
    if ((await locator.count()) > 0) {
      return locator;
    }
  }

  const textLocator = page.getByText(name).first();
  if ((await textLocator.count()) > 0) {
    return textLocator;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as {
      label?: string;
      sessionId?: string;
      selector?: string;
      url?: string;
    };

    if (!body.sessionId?.trim() || !body.url) {
      return NextResponse.json(
        { error: 'Session ID and URL are required' },
        { status: 400 },
      );
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(body.url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    const session = await getOrCreateLiveSession(body.sessionId.trim());
    let page = session.page;
    try {
      if (page.isClosed()) {
        page = await session.context.newPage();
        session.page = page;
      }

      const currentPageUrl = page.url();
      if (!currentPageUrl || currentPageUrl === 'about:blank') {
        await navigateToAssistModePage({ page, url: parsedUrl.toString() });
      }

      const locator = await findActionLocator({
        label: body.label,
        page,
        selector: body.selector,
      });
      if (!locator) {
        return NextResponse.json(
          { error: 'Could not find the requested control on the live page.' },
          { status: 404 },
        );
      }

      const popupPromise = page.waitForEvent('popup', { timeout: 5000 }).catch(
        () => null,
      );

      await locator.click({ timeout: 5000 });

      const popup = await popupPromise;
      const targetPage = popup ?? page;
      session.page = targetPage;
      session.lastUsedAt = Date.now();

      await targetPage.waitForLoadState('domcontentloaded', { timeout: 10000 }).catch(
        () => null,
      );
      await targetPage.waitForLoadState('networkidle', { timeout: 5000 }).catch(
        () => null,
      );
      await targetPage.waitForTimeout(1000);

      const actionUrl = targetPage.url();
      const rawHtml = await targetPage.content();
      const snapshot = await buildAssistModeSnapshot({
        baseUrl: new URL(actionUrl),
        rawHtml,
      });

      return NextResponse.json({
        html: snapshot.html,
        styles: snapshot.styles,
        url: actionUrl,
      });
    } catch (error) {
      throw error;
    }
  } catch (error) {
    if (error instanceof PlaywrightUnavailableError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 503 },
      );
    }
    console.error('[AssistMode] live-action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute the requested action on the live page.' },
      { status: 500 },
    );
  }
}
