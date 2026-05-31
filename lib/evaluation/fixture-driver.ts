import { JSDOM } from 'jsdom';

import type { FlowDriver } from '@/lib/applications/flow-executor';

export interface FixtureDriverOptions {
  /**
   * Starting document URL. Relative navigate() calls resolve against it.
   * Defaults to `http://fixture.local/`.
   */
  readonly initialUrl?: string;
  /**
   * Fetch implementation used to load pages when `navigate()` is called.
   * Default uses global fetch - tests can inject a fake to serve
   * in-memory HTML without spinning up a server.
   */
  readonly fetch?: typeof globalThis.fetch;
}

export interface StartedFixtureDriver {
  readonly driver: FlowDriver;
  /** Current document URL (updated by navigate()). */
  currentUrl(): string;
  /** Current document HTML (useful for assertions in tests). */
  html(): string;
  /**
   * Load HTML directly without a fetch - handy for contract tests that
   * don't want an HTTP round-trip.
   */
  setDocument(input: { html: string; url?: string }): void;
}

const DEFAULT_URL = 'http://fixture.local/';

/**
 * Fixture driver for the replay harness (P7.1). Implements the same
 * `FlowDriver` contract as the desktop CDP driver, but operates against
 * a jsdom-backed DOM instead of a live browser.
 *
 * Behaviors mirror the CDP driver where it matters for event parity:
 *   - click/fill/select dispatch `input`/`change` events on targets
 *   - upload records the chosen path on the input's dataset (matches
 *     the desktop stub behavior - real uploads still go through CDP)
 *   - waitFor is synchronous because the fixture DOM does not change
 *     asynchronously in the harness
 */
export function startFixtureDriver(
  options: FixtureDriverOptions = {},
): StartedFixtureDriver {
  const fetchImpl = options.fetch ?? globalThis.fetch;
  let dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', {
    url: options.initialUrl ?? DEFAULT_URL,
  });

  function document() {
    return dom.window.document;
  }

  function requireElement(selector: string): Element {
    const el = document().querySelector(selector);
    if (!el) {
      throw new Error(`Element not found: ${selector}`);
    }
    return el;
  }

  function dispatchInputAndChange(element: Element) {
    const Event = dom.window.Event;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const driver: FlowDriver = {
    async navigate({ url }) {
      const absolute = new URL(url, dom.window.location.href).toString();
      if (!fetchImpl) {
        throw new Error('navigate() requires a fetch implementation');
      }
      const response = await fetchImpl(absolute);
      const body = await response.text();
      dom = new JSDOM(body, { url: absolute });
      return { url: absolute };
    },
    async waitFor({ selector, text, timeoutMs: _timeoutMs }) {
      const selectorMatched = selector
        ? Boolean(document().querySelector(selector))
        : true;
      const textMatched = text
        ? (document().body?.textContent ?? '').includes(text)
        : true;
      if (!selectorMatched || !textMatched) {
        throw new Error(
          `wait_for did not match: selector=${selector ?? ''} text=${text ?? ''}`,
        );
      }
      return {
        matched: true,
        selector: selector ?? null,
        text: text ?? null,
      };
    },
    async click({ selector }) {
      const el = requireElement(selector);
      const MouseEvent = dom.window.MouseEvent;
      el.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      );
      return { clicked: true, selector };
    },
    async fill({ selector, value }) {
      const el = requireElement(selector);
      if (!('value' in el)) {
        throw new Error(`Fill target not found: ${selector}`);
      }
      (el as unknown as { value: string }).value = value;
      dispatchInputAndChange(el);
      return { selector, value };
    },
    async select({ selector, value }) {
      const el = requireElement(selector);
      const HTMLSelectElement = dom.window.HTMLSelectElement;
      if (!(el instanceof HTMLSelectElement)) {
        throw new Error(`Select target not found: ${selector}`);
      }
      el.value = value;
      dispatchInputAndChange(el);
      return { selector, value };
    },
    async upload({ selector, filePath }) {
      const el = requireElement(selector);
      const HTMLInputElement = dom.window.HTMLInputElement;
      if (!(el instanceof HTMLInputElement) || el.type !== 'file') {
        throw new Error(`Upload target not found: ${selector}`);
      }
      el.dataset.uploadPath = filePath;
      return { filePath, selector };
    },
    async scrollIntoView({ selector }) {
      requireElement(selector);
      return { selector };
    },
    async readElement({ selector }) {
      const el = requireElement(selector);
      const attributes: Record<string, string> = {};
      for (const attr of Array.from(el.attributes)) {
        attributes[attr.name] = attr.value;
      }
      const value =
        'value' in el
          ? String((el as unknown as { value: unknown }).value)
          : null;
      return {
        attributes,
        selector,
        tagName: el.tagName.toLowerCase(),
        text: (el.textContent ?? '').trim(),
        value,
      };
    },
    async pressKey({ key }) {
      return { key };
    },
  };

  return {
    currentUrl() {
      return dom.window.location.href;
    },
    driver,
    html() {
      return dom.serialize();
    },
    setDocument({ html, url }) {
      dom = new JSDOM(html, { url: url ?? dom.window.location.href });
    },
  };
}
