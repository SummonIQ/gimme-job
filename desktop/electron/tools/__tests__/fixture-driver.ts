import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

import type {
  ClickInput,
  ClickResult,
  CookiesGetInput,
  CookiesGetResult,
  CookiesSetInput,
  CookiesSetResult,
  DesktopCdpToolDriver,
  DesktopCookie,
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
} from '../types';

export function createFixtureCdpToolDriver(
  fixturePath: string,
): DesktopCdpToolDriver {
  let dom = createDom(fixturePath, 'https://jobs.ashbyhq.com/example');
  let isNetworkObservationEnabled = false;
  let isSubmitGuardEnabled = true;
  const cookies = new Map<string, DesktopCookie>();
  const identities = new Map([['first_name', 'Steven']]);

  return {
    async click(input: ClickInput): Promise<ClickResult> {
      const element = requireElement(dom, input.selector);
      const isSubmitIntent =
        element instanceof dom.window.HTMLButtonElement &&
        element.type === 'submit';

      if (isSubmitIntent && isSubmitGuardEnabled) {
        throw new Error('submit_guard blocked a submit-intent click.');
      }

      element.dispatchEvent(
        new dom.window.MouseEvent('click', {
          bubbles: true,
          cancelable: true,
        }),
      );

      return { clicked: true, selector: input.selector };
    },
    async cookiesGet(_input: CookiesGetInput): Promise<CookiesGetResult> {
      return { cookies: [...cookies.values()] };
    },
    async cookiesSet(input: CookiesSetInput): Promise<CookiesSetResult> {
      for (const cookie of input.cookies) {
        cookies.set(cookie.name, cookie);
      }

      return { count: input.cookies.length };
    },
    async domSnapshot(_input: DomSnapshotInput): Promise<DomSnapshotResult> {
      return {
        html: dom.window.document.documentElement.outerHTML,
        title: dom.window.document.title,
        url: dom.window.location.href,
      };
    },
    async fill(input: FillInput): Promise<FillResult> {
      const element = requireElement(dom, input.selector);

      if (!('value' in element)) {
        throw new Error(`Fill target not found: ${input.selector}`);
      }

      element.value = input.value;
      element.dispatchEvent(new dom.window.Event('input', { bubbles: true }));

      return { selector: input.selector, value: input.value };
    },
    async identityLoad(input: IdentityLoadInput): Promise<IdentityLoadResult> {
      const value = identities.get(input.key);

      if (!value) {
        throw new Error(`Identity key is not available: ${input.key}`);
      }

      return { key: input.key, value };
    },
    async navigate(input: NavigateInput): Promise<NavigateResult> {
      dom = createDom(fixturePath, input.url);
      return { url: input.url };
    },
    async networkObserve(
      input: NetworkObserveInput,
    ): Promise<NetworkObserveResult> {
      isNetworkObservationEnabled = input.enabled;
      return { enabled: isNetworkObservationEnabled };
    },
    async networkReplay(
      input: NetworkReplayInput,
    ): Promise<NetworkReplayResult> {
      return {
        body: 'fixture replay',
        headers: { 'content-type': 'text/plain' },
        status: 200,
        url: input.url,
      };
    },
    async pressKey(input: PressKeyInput): Promise<PressKeyResult> {
      dom.window.document.body.dataset.lastKey = input.key;
      return { key: input.key };
    },
    async readElement(input: ReadElementInput): Promise<ReadElementResult> {
      const element = requireElement(dom, input.selector);

      return {
        attributes: Object.fromEntries(
          [...element.attributes].map(attribute => [
            attribute.name,
            attribute.value,
          ]),
        ),
        selector: input.selector,
        tagName: element.tagName.toLowerCase(),
        text: (element.textContent ?? '').trim(),
        value: 'value' in element ? String(element.value) : null,
      };
    },
    async screenshotRegion(
      input: ScreenshotRegionInput,
    ): Promise<ScreenshotRegionResult> {
      return {
        dataUrl:
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=',
        height: input.height,
        width: input.width,
      };
    },
    async scrollIntoView(
      input: ScrollIntoViewInput,
    ): Promise<ScrollIntoViewResult> {
      requireElement(dom, input.selector).setAttribute('data-scrolled', 'true');
      return { selector: input.selector };
    },
    async select(input: SelectInput): Promise<SelectResult> {
      const element = requireElement(dom, input.selector);

      if (!(element instanceof dom.window.HTMLSelectElement)) {
        throw new Error(`Select target not found: ${input.selector}`);
      }

      element.value = input.value;
      element.dispatchEvent(new dom.window.Event('change', { bubbles: true }));

      return { selector: input.selector, value: input.value };
    },
    async submitGuard(input: SubmitGuardInput): Promise<SubmitGuardResult> {
      if (input.enabled !== undefined) {
        isSubmitGuardEnabled = input.enabled;
      }

      return { enabled: isSubmitGuardEnabled };
    },
    async upload(input: UploadInput): Promise<UploadResult> {
      requireElement(dom, input.selector).setAttribute(
        'data-upload-path',
        input.filePath,
      );
      return { filePath: input.filePath, selector: input.selector };
    },
    async waitFor(input: WaitForInput): Promise<WaitForResult> {
      const selectorMatched = input.selector
        ? Boolean(dom.window.document.querySelector(input.selector))
        : true;
      const textMatched = input.text
        ? dom.window.document.body.textContent?.includes(input.text)
        : true;

      if (!selectorMatched || !textMatched) {
        throw new Error('wait_for timed out.');
      }

      return {
        matched: true,
        selector: input.selector ?? null,
        text: input.text ?? null,
      };
    },
  };
}

function createDom(fixturePath: string, url: string): JSDOM {
  return new JSDOM(readFileSync(fixturePath, 'utf8'), { url });
}

function requireElement(dom: JSDOM, selector: string): Element {
  const element = dom.window.document.querySelector(selector);

  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }

  return element;
}
