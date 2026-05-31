import type { Rectangle, WebContents } from 'electron';

import type {
  ClickInput,
  ClickResult,
  CookiesGetInput,
  CookiesGetResult,
  CookiesSetInput,
  CookiesSetResult,
  DesktopCdpToolDriver,
  DomSnapshotInput,
  DomSnapshotResult,
  FillInput,
  FillResult,
  IdentityLoadInput,
  IdentityLoadResult,
  NavigateInput,
  NavigateResult,
  NetworkObserveInput,
  NetworkObserveResult,
  NetworkReplayInput,
  NetworkReplayResult,
  PressKeyInput,
  PressKeyResult,
  ReadElementInput,
  ReadElementResult,
  ScreenshotRegionInput,
  ScreenshotRegionResult,
  ScrollIntoViewInput,
  ScrollIntoViewResult,
  SelectInput,
  SelectResult,
  SubmitGuardInput,
  SubmitGuardResult,
  UploadInput,
  UploadResult,
  WaitForInput,
  WaitForResult,
} from './types.js';

export interface ElectronCdpToolDriverOptions {
  getWebContents: () => WebContents;
  identityValues?: Record<string, string>;
}

export function createElectronCdpToolDriver({
  getWebContents,
  identityValues = {},
}: ElectronCdpToolDriverOptions): DesktopCdpToolDriver {
  let isNetworkObservationEnabled = false;
  let isSubmitGuardEnabled = true;

  return {
    async click(input) {
      const result = await executeInPage<{
        clicked: boolean;
        isSubmitIntent: boolean;
      }>(
        getWebContents(),
        `
          const element = document.querySelector(${toJson(input.selector)});
          if (!element) throw new Error('Element not found: ${escapeForError(input.selector)}');
          const isSubmitIntent =
            (element instanceof HTMLButtonElement && element.type === 'submit') ||
            (element instanceof HTMLInputElement && element.type === 'submit');
          if (!isSubmitIntent) {
            element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
          ({ clicked: true, isSubmitIntent });
        `,
      );

      if (result.isSubmitIntent && isSubmitGuardEnabled) {
        throw new Error('submit_guard blocked a submit-intent click.');
      }

      if (result.isSubmitIntent) {
        await executeInPage(
          getWebContents(),
          `
            const element = document.querySelector(${toJson(input.selector)});
            element?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          `,
        );
      }

      return { clicked: result.clicked, selector: input.selector };
    },
    async cookiesGet(input) {
      const cookies = await getWebContents().session.cookies.get(
        input.url ? { url: input.url } : {},
      );

      return { cookies };
    },
    async cookiesSet(input) {
      for (const cookie of input.cookies) {
        await getWebContents().session.cookies.set({
          ...cookie,
          url: getCookieUrl(cookie),
        });
      }

      return { count: input.cookies.length };
    },
    async domSnapshot(_input) {
      return executeInPage<DomSnapshotResult>(
        getWebContents(),
        `
          ({
            html: document.documentElement.outerHTML,
            title: document.title,
            url: window.location.href,
          });
        `,
      );
    },
    async fill(input) {
      await executeInPage(
        getWebContents(),
        `
          const element = document.querySelector(${toJson(input.selector)});
          if (!element || !('value' in element)) throw new Error('Fill target not found: ${escapeForError(input.selector)}');
          element.value = ${toJson(input.value)};
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        `,
      );

      return { selector: input.selector, value: input.value };
    },
    async identityLoad(input) {
      const value = identityValues[input.key];

      if (!value) {
        throw new Error(`Identity key is not available: ${input.key}`);
      }

      return { key: input.key, value };
    },
    async navigate(input) {
      await getWebContents().loadURL(input.url);
      return { url: input.url };
    },
    async networkObserve(input) {
      const webContents = getWebContents();

      if (!webContents.debugger.isAttached()) {
        webContents.debugger.attach('1.3');
      }

      await webContents.debugger.sendCommand(
        input.enabled ? 'Network.enable' : 'Network.disable',
      );
      isNetworkObservationEnabled = input.enabled;

      return { enabled: isNetworkObservationEnabled };
    },
    async networkReplay(input) {
      const response = await fetch(input.url, {
        body: input.body,
        headers: input.headers,
        method: input.method,
      });
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      return {
        body: await response.text(),
        headers,
        status: response.status,
        url: response.url,
      };
    },
    async pressKey(input) {
      getWebContents().sendInputEvent({
        keyCode: input.key,
        type: 'keyDown',
      });
      getWebContents().sendInputEvent({
        keyCode: input.key,
        type: 'keyUp',
      });

      return { key: input.key };
    },
    async readElement(input) {
      return executeInPage<ReadElementResult>(
        getWebContents(),
        `
          const element = document.querySelector(${toJson(input.selector)});
          if (!element) throw new Error('Element not found: ${escapeForError(input.selector)}');
          ({
            attributes: Object.fromEntries([...element.attributes].map(attribute => [attribute.name, attribute.value])),
            selector: ${toJson(input.selector)},
            tagName: element.tagName.toLowerCase(),
            text: (element.textContent ?? '').trim(),
            value: 'value' in element ? String(element.value) : null,
          });
        `,
      );
    },
    async screenshotRegion(input) {
      const rectangle: Rectangle = {
        height: input.height,
        width: input.width,
        x: input.x,
        y: input.y,
      };
      const image = await getWebContents().capturePage(rectangle);

      return {
        dataUrl: image.toDataURL(),
        height: input.height,
        width: input.width,
      };
    },
    async scrollIntoView(input) {
      await executeInPage(
        getWebContents(),
        `
          const element = document.querySelector(${toJson(input.selector)});
          if (!element) throw new Error('Element not found: ${escapeForError(input.selector)}');
          element.scrollIntoView({ block: 'center', inline: 'nearest' });
        `,
      );

      return { selector: input.selector };
    },
    async select(input) {
      await executeInPage(
        getWebContents(),
        `
          const element = document.querySelector(${toJson(input.selector)});
          if (!(element instanceof HTMLSelectElement)) throw new Error('Select target not found: ${escapeForError(input.selector)}');
          element.value = ${toJson(input.value)};
          element.dispatchEvent(new Event('input', { bubbles: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        `,
      );

      return { selector: input.selector, value: input.value };
    },
    async submitGuard(input) {
      if (input.enabled !== undefined) {
        isSubmitGuardEnabled = input.enabled;
      }

      return { enabled: isSubmitGuardEnabled };
    },
    async upload(input) {
      await executeInPage(
        getWebContents(),
        `
          const element = document.querySelector(${toJson(input.selector)});
          if (!(element instanceof HTMLInputElement) || element.type !== 'file') {
            throw new Error('Upload target not found: ${escapeForError(input.selector)}');
          }
          element.dataset.uploadPath = ${toJson(input.filePath)};
        `,
      );

      return { filePath: input.filePath, selector: input.selector };
    },
    async waitFor(input) {
      const deadline = Date.now() + input.timeoutMs;

      while (Date.now() < deadline) {
        const matched = await isWaitMatch(getWebContents(), input);

        if (matched) {
          return {
            matched: true,
            selector: input.selector ?? null,
            text: input.text ?? null,
          };
        }

        await sleep(100);
      }

      throw new Error('wait_for timed out.');
    },
  };
}

async function isWaitMatch(
  webContents: WebContents,
  input: WaitForInput,
): Promise<boolean> {
  return executeInPage<boolean>(
    webContents,
    `
      const selectorMatched = ${input.selector ? `Boolean(document.querySelector(${toJson(input.selector)}))` : 'true'};
      const textMatched = ${input.text ? `document.body.innerText.includes(${toJson(input.text)})` : 'true'};
      selectorMatched && textMatched;
    `,
  );
}

function executeInPage<T>(
  webContents: WebContents,
  script: string,
): Promise<T> {
  return webContents.executeJavaScript(script, true) as Promise<T>;
}

function getCookieUrl(cookie: {
  domain?: string;
  path?: string;
  url?: string;
}) {
  if (cookie.url) {
    return cookie.url;
  }

  if (!cookie.domain) {
    throw new Error('Cookie url or domain is required.');
  }

  const hostname = cookie.domain.replace(/^\./, '');
  return `https://${hostname}${cookie.path ?? '/'}`;
}

function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms);
  });
}

function toJson(value: unknown): string {
  return JSON.stringify(value);
}

function escapeForError(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}
