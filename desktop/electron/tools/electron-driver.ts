import type { Rectangle, WebContents } from 'electron';

import { withAssistEyeSaverDisabled } from '../eye-saver.js';
import { loadIdentityValue } from '../identity/store.js';
import type { IdentityStore } from '../identity/types.js';
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
  /**
   * Legacy map of identity values. Retained for tests that pre-date
   * the P5.6 IdentityStore. Prefer `identityStore` for any new caller
   * - it carries schema validation, missing-key errors, and feeds the
   * prompt-trace redaction helper.
   */
  identityValues?: Record<string, string>;
  /**
   * P5.6 identity store. When present, `identity_load` routes through
   * it (schema-validated, loud on missing-key). Falls back to
   * `identityValues` only if this is not supplied.
   */
  identityStore?: IdentityStore;
}

export function createElectronCdpToolDriver({
  getWebContents,
  identityValues = {},
  identityStore,
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
          ${RESOLVE_SELECT_CONTROL_SCRIPT}
          const element = document.querySelector(${toJson(input.selector)});
          if (!element) throw new Error('Element not found: ${escapeForError(input.selector)}');
          const isSubmitIntent =
            (element instanceof HTMLButtonElement && element.type === 'submit') ||
            (element instanceof HTMLInputElement && element.type === 'submit');
          if (!isSubmitIntent) {
            const target =
              element instanceof HTMLElement
                ? (resolveSelectControl(element) ?? element.closest('.select__control') ?? element)
                : element;
            target.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            target.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            if (element instanceof HTMLElement) {
              element.focus?.();
            }
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
      // The snapshot includes a per-field bounding-rect map keyed by a
      // stable selector-derived key. Used by the runner to sort the fill
      // queue by visual position so we go top-to-bottom on layouts where
      // DOM order doesn't match (CSS grid order, multi-column forms).
      //
      // Before serializing we copy each input/textarea's live `.value`
      // property to its `value` attribute, and each toggle's `.checked`
      // to a `checked` attribute. React-controlled inputs and Google
      // Places autocomplete fields keep their state in JS only, so a
      // raw outerHTML serialization would show the location field as
      // "empty" even when the user (or a previous runner pass) has
      // typed "Portland, Oregon" into it. This serialization step makes
      // "already filled" detection actually see those values.
      return executeInPage<DomSnapshotResult>(
        getWebContents(),
        `
          (function () {
            try {
              var inputs = document.querySelectorAll('input, textarea');
              for (var i = 0; i < inputs.length; i += 1) {
                var el = inputs[i];
                var tag = String(el.tagName).toLowerCase();
                var type = (el.getAttribute('type') || '').toLowerCase();
                if (type === 'checkbox' || type === 'radio') {
                  if (el.checked) el.setAttribute('checked', '');
                  else el.removeAttribute('checked');
                } else if (tag === 'input') {
                  var v = el.value;
                  if (v) el.setAttribute('value', v);
                } else if (tag === 'textarea') {
                  var tv = el.value;
                  if (tv) {
                    // <textarea> serializes its child text — set both the
                    // attribute (for parsers that read it) and innerHTML
                    // (which is what outerHTML emits).
                    el.setAttribute('value', tv);
                  }
                }
              }
            } catch (_) {}
            var positions = {};
            try {
              var nodes = document.querySelectorAll(
                'input, textarea, select, [role="combobox"], [aria-haspopup="listbox"], [aria-haspopup="menu"]'
              );
              for (var i = 0; i < nodes.length; i += 1) {
                var node = nodes[i];
                var rect = null;
                try { rect = node.getBoundingClientRect(); } catch (_) {}
                if (!rect) continue;
                var key = '';
                if (node.id) key = '#' + node.id;
                else if (node.name) key = '[name=' + node.name + ']';
                else continue;
                positions[key] = {
                  top: Math.round(rect.top + (window.scrollY || 0)),
                  left: Math.round(rect.left + (window.scrollX || 0)),
                };
              }
            } catch (_) {}
            return {
              html: document.documentElement.outerHTML,
              title: document.title,
              url: window.location.href,
              positions: positions,
            };
          })();
        `,
      );
    },
    async fill(input) {
      await executeInPage(
        getWebContents(),
        `
          const candidates = Array.from(document.querySelectorAll(${toJson(input.selector)}));
          const fillableCandidates = candidates.filter(
            candidate =>
              typeof candidate === 'object' &&
              candidate !== null &&
              'tagName' in candidate &&
              'value' in candidate &&
              ['input', 'textarea'].includes(String(candidate.tagName).toLowerCase()),
          );
          const isInteractiveCandidate = candidate => {
            if (!('getAttribute' in candidate) || typeof candidate.getAttribute !== 'function') {
              return true;
            }
            if (candidate.hasAttribute('hidden')) return false;
            if (candidate.getAttribute('aria-hidden') === 'true') return false;
            if ('disabled' in candidate && candidate.disabled) return false;
            if (
              String(candidate.tagName).toLowerCase() === 'input' &&
              'type' in candidate &&
              candidate.type === 'hidden'
            ) {
              return false;
            }
            const style = window.getComputedStyle(candidate);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return false;
            }
            return candidate.getClientRects().length > 0;
          };
          const element =
            fillableCandidates.find(isInteractiveCandidate) ??
            fillableCandidates.find(
              candidate =>
                !(
                  String(candidate.tagName).toLowerCase() === 'input' &&
                  'type' in candidate &&
                  candidate.type === 'hidden'
                ) &&
                !('disabled' in candidate && candidate.disabled),
            );
          if (!element) throw new Error('Fill target not found: ${escapeForError(input.selector)}');
          const tagName = String(element.tagName).toLowerCase();
          const prototype =
            tagName === 'textarea'
              ? window.HTMLTextAreaElement?.prototype ?? null
              : tagName === 'input'
                ? window.HTMLInputElement?.prototype ?? null
                : null;
          const descriptor = prototype
            ? Object.getOwnPropertyDescriptor(prototype, 'value')
            : null;
          if (descriptor?.set) {
            descriptor.set.call(element, ${toJson(input.value)});
          } else {
            element.value = ${toJson(input.value)};
          }
          element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
          element.dispatchEvent(new Event('change', { bubbles: true }));
        `,
      );

      return { selector: input.selector, value: input.value };
    },
    async identityLoad(input) {
      if (identityStore) {
        const value = await loadIdentityValue(identityStore, input.key);
        return { key: input.key, value };
      }
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
      const webContents = getWebContents();
      webContents.sendInputEvent({
        keyCode: input.key,
        type: 'keyDown',
      });
      // For printable single characters (digits/letters/punctuation) emit a
      // 'char' event between keyDown and keyUp so the focused input actually
      // receives the character. Without this, keyDown alone triggers
      // listeners but no character lands in the value — fine for named
      // keys like Tab/Enter/ArrowDown, broken for typing.
      if (input.key.length === 1 && /^[\x20-\x7E]$/.test(input.key)) {
        webContents.sendInputEvent({
          keyCode: input.key,
          type: 'char',
        });
      }
      webContents.sendInputEvent({
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
      const webContents = getWebContents();
      const image = await withAssistEyeSaverDisabled(webContents, () =>
        webContents.capturePage(rectangle),
      );

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
      const nativeSelectResult = await executeInPage<{ handled: boolean }>(
        getWebContents(),
        `
          ${SELECT_MATCHER_SCRIPT}
          const element = document.querySelector(${toJson(input.selector)});
          const requestedValue = ${toJson(input.value)};

          if (!(element instanceof HTMLSelectElement)) {
            ({ handled: false });
          } else {
            const options = Array.from(element.options);
            const candidates = options.map(option => ({
              text: option.text,
              value: option.value,
              ref: option,
            }));
            const matchedOption = pickBestSelectMatch(candidates, requestedValue);
            if (!matchedOption) {
              throw new Error('Select option not found: ${escapeForError(input.value)}');
            }
            element.value = matchedOption.ref.value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
            element.dispatchEvent(new Event('change', { bubbles: true }));
            ({ handled: true });
          }
        `,
      );

      if (!nativeSelectResult.handled) {
        const trustedMouseHandled = await selectCustomOptionWithTrustedMouse(
          getWebContents(),
          input.selector,
          input.value,
        );
        if (!trustedMouseHandled) {
          await openCustomSelect(getWebContents(), input.selector);
          await waitForCustomSelectOption(
            getWebContents(),
            input.selector,
            input.value,
            2_000,
          );
          await clickCustomSelectOption(
            getWebContents(),
            input.selector,
            input.value,
          );
        }
      }

      return { selector: input.selector, value: input.value };
    },
    async submitGuard(input) {
      if (input.enabled !== undefined) {
        isSubmitGuardEnabled = input.enabled;
      }

      return { enabled: isSubmitGuardEnabled };
    },
    async upload(input) {
      const webContents = getWebContents();
      const currentUrl = webContents.getURL?.() ?? '';
      const isAshbyPage = currentUrl.includes('ashbyhq.com');
      const isGreenhouseBoardsPage = currentUrl.includes(
        'job-boards.greenhouse.io',
      );

      // Greenhouse new boards: their React onChange handler reads
      // `state.uploader.uploadFile` which is only initialized by a real
      // user click on the visible "Attach" button. We dispatch a trusted
      // click via CDP `Input.dispatchMouseEvent`, intercept the OS file
      // picker via `Page.setInterceptFileChooserDialog`, and resolve the
      // intercepted chooser with our file. This goes through Greenhouse's
      // real click → state-init → upload code path.
      if (isGreenhouseBoardsPage) {
        const handled = await uploadViaInterceptedFileChooser(
          webContents,
          input.selector,
          input.filePath,
        );
        if (handled) {
          return { filePath: input.filePath, selector: input.selector };
        }
        // Fall through to the generic path if the Attach button could not
        // be located or the chooser did not open.
      }

      await setFileInputFiles(webContents, input.selector, input.filePath);
      const result = await executeInPage<{ fileCount: number }>(
        webContents,
        `
          const shouldDispatchUploadEvents = ${toJson(!isAshbyPage && !isGreenhouseBoardsPage)};
          const element = document.querySelector(${toJson(input.selector)});
          if (!(element instanceof HTMLInputElement) || element.type !== 'file') {
            throw new Error('Upload target not found: ${escapeForError(input.selector)}');
          }
          element.dataset.uploadPath = ${toJson(input.filePath)};
          const dispatchUploadEvent = eventName => {
            try {
              element.dispatchEvent(new Event(eventName, { bubbles: true, composed: true }));
            } catch (error) {
              console.warn('Upload listener failed after file attach:', error);
            }
          };
          if (shouldDispatchUploadEvents) {
            dispatchUploadEvent('input');
            dispatchUploadEvent('change');
          }
          ({ fileCount: element.files?.length ?? 0 });
        `,
      );
      // Greenhouse's React handler may swap or reset the file input after
      // capturing files, so element.files.length is not a reliable check.
      // setFileInputFiles via CDP is what attaches the file at the browser
      // level; if that succeeded, the upload is in flight regardless.
      if (result.fileCount < 1 && !isGreenhouseBoardsPage) {
        throw new Error(`Upload did not attach a file: ${input.selector}`);
      }

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

async function uploadViaInterceptedFileChooser(
  webContents: WebContents,
  selector: string,
  filePath: string,
): Promise<boolean> {
  const debuggerApi = webContents.debugger;
  if (!debuggerApi) return false;

  const buttonRect = await executeInPage<{
    found: boolean;
    x: number;
    y: number;
  }>(
    webContents,
    `
      const fileInput = document.querySelector(${toJson(selector)});
      let found = false;
      let x = 0;
      let y = 0;
      if (fileInput instanceof HTMLInputElement && fileInput.type === 'file') {
        let scope = fileInput.parentElement;
        let attachButton = null;
        for (let depth = 0; scope && depth < 4 && !attachButton; depth++) {
          attachButton = Array.from(scope.querySelectorAll('button[type="button"]'))
            .find(b => (b.textContent ?? '').trim().toLowerCase() === 'attach') ?? null;
          if (!attachButton) scope = scope.parentElement;
        }
        if (attachButton) {
          attachButton.scrollIntoView?.({ block: 'center', inline: 'nearest' });
          const rect = attachButton.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            found = true;
            x = rect.left + rect.width / 2;
            y = rect.top + rect.height / 2;
          }
        }
      }
      ({ found, x, y });
    `,
  );

  if (!buttonRect.found) {
    return false;
  }

  let didAttach = false;
  if (!debuggerApi.isAttached()) {
    debuggerApi.attach('1.3');
    didAttach = true;
  }

  try {
    const documentResult = (await debuggerApi.sendCommand(
      'DOM.getDocument',
      {},
    )) as { root?: { nodeId?: number } };
    const rootNodeId = documentResult.root?.nodeId;
    if (!rootNodeId) return false;

    const queryResult = (await debuggerApi.sendCommand('DOM.querySelector', {
      nodeId: rootNodeId,
      selector,
    })) as { nodeId?: number };
    const inputNodeId = queryResult.nodeId;
    if (!inputNodeId) return false;

    await debuggerApi.sendCommand('Page.enable', {});
    await debuggerApi.sendCommand('Page.setInterceptFileChooserDialog', {
      enabled: true,
    });

    try {
      // Trusted click on the Attach button. Greenhouse's React onClick
      // initializes its uploader state, then calls input.click() which
      // would normally open the OS file picker — interception suppresses
      // that.
      await debuggerApi.sendCommand('Input.dispatchMouseEvent', {
        type: 'mousePressed',
        x: buttonRect.x,
        y: buttonRect.y,
        button: 'left',
        clickCount: 1,
      });
      await debuggerApi.sendCommand('Input.dispatchMouseEvent', {
        type: 'mouseReleased',
        x: buttonRect.x,
        y: buttonRect.y,
        button: 'left',
        clickCount: 1,
      });

      // Give React time to flush its onClick state update.
      await sleep(200);

      // Set the file via CDP. This fires a native `change` event on the
      // input — Greenhouse's onChange handler now finds its uploader state
      // initialized and processes the file successfully.
      await debuggerApi.sendCommand('DOM.setFileInputFiles', {
        nodeId: inputNodeId,
        files: [filePath],
      });

      return await verifyGreenhouseResumeUpload(webContents, selector, filePath);
    } finally {
      try {
        await debuggerApi.sendCommand('Page.setInterceptFileChooserDialog', {
          enabled: false,
        });
      } catch {
        /* ignore */
      }
    }
  } catch {
    return false;
  } finally {
    if (didAttach && debuggerApi.isAttached()) {
      debuggerApi.detach();
    }
  }
}

async function verifyGreenhouseResumeUpload(
  webContents: WebContents,
  selector: string,
  filePath: string,
): Promise<boolean> {
  return executeInPage<boolean>(
    webContents,
    `
      const selector = ${toJson(selector)};
      const fileName = String(${toJson(filePath)}).split(/[\\\\/]/).pop()?.toLowerCase() ?? '';
      const hasAttachedFile = node =>
        node instanceof HTMLInputElement &&
        node.type === 'file' &&
        ((node.files?.length ?? 0) > 0);
      const query = candidate => {
        try {
          return document.querySelector(candidate);
        } catch {
          return null;
        }
      };
      const original = query(selector);
      if (hasAttachedFile(original)) {
        true;
      } else {
        const isVisible = node => {
          if (!(node instanceof HTMLElement)) return false;
          const style = getComputedStyle(node);
          if (style.display === 'none' || style.visibility === 'hidden') return false;
          const rect = node.getBoundingClientRect();
          return rect.width > 0 && rect.height > 0;
        };
        const isResumeInput = input => {
          const escapeCss = value => {
            if (globalThis.CSS?.escape) return CSS.escape(value);
            return String(value).replace(/["\\\\]/g, '\\\\$&');
          };
          const labelledBy = input.getAttribute('aria-labelledby');
          const labelledText = labelledBy
            ? Array.from(document.querySelectorAll(labelledBy.split(/\\s+/).map(id => '#' + escapeCss(id)).join(',')))
                .map(node => node.textContent ?? '')
                .join(' ')
            : '';
          const label = input.id
            ? (document.querySelector('label[for="' + escapeCss(input.id) + '"]')?.textContent ?? '')
            : '';
          const context = input.closest('[role="group"], .field-wrapper, .file-upload, fieldset')?.textContent ?? '';
          const haystack = [
            input.id,
            input.name,
            input.getAttribute('aria-label'),
            input.getAttribute('data-testid'),
            labelledText,
            label,
            context,
          ].join(' ').toLowerCase();
          return /resume|\\bcv\\b/.test(haystack) && !/cover\\s+letter/.test(haystack);
        };
        const remountedInput = Array.from(document.querySelectorAll('input[type="file"]'))
          .find(input => hasAttachedFile(input) && isVisible(input) && isResumeInput(input));
        if (remountedInput) {
          true;
        } else {
          const indicatorText = Array.from(document.querySelectorAll('[data-source="resume"], [role="status"]'))
            .map(node => node.textContent ?? '')
            .join(' ')
            .toLowerCase();
          Boolean(fileName && indicatorText.includes(fileName));
        }
      }
    `,
  ).catch(() => false);
}

async function setFileInputFiles(
  webContents: WebContents,
  selector: string,
  filePath: string,
): Promise<void> {
  const debuggerApi = webContents.debugger;

  if (!debuggerApi) {
    return;
  }

  let didAttach = false;
  try {
    if (!debuggerApi.isAttached()) {
      debuggerApi.attach('1.3');
      didAttach = true;
    }

    const documentResult = (await debuggerApi.sendCommand(
      'DOM.getDocument',
      {},
    )) as { root?: { nodeId?: number } };
    const rootNodeId = documentResult.root?.nodeId;
    if (!rootNodeId) {
      throw new Error('Unable to inspect document for upload target.');
    }

    const queryResult = (await debuggerApi.sendCommand('DOM.querySelector', {
      nodeId: rootNodeId,
      selector,
    })) as { nodeId?: number };
    const nodeId = queryResult.nodeId;
    if (!nodeId) {
      throw new Error(`Upload target not found: ${selector}`);
    }

    // CDP throws an opaque "Node is not a file input element" if the matched
    // node isn't <input type="file">. Validate up front so the error message
    // points at the misconfigured selector instead of CDP internals.
    const describeResult = (await debuggerApi.sendCommand('DOM.describeNode', {
      nodeId,
    })) as {
      node?: { attributes?: string[]; nodeName?: string };
    };
    const node = describeResult.node;
    const tagName = node?.nodeName?.toLowerCase() ?? '';
    const attributes = node?.attributes ?? [];
    let typeAttr = '';
    for (let i = 0; i < attributes.length - 1; i += 2) {
      if (attributes[i]?.toLowerCase() === 'type') {
        typeAttr = (attributes[i + 1] ?? '').toLowerCase();
        break;
      }
    }
    if (tagName !== 'input' || typeAttr !== 'file') {
      throw new Error(
        `Upload selector matched <${tagName || 'unknown'}${
          typeAttr ? ` type="${typeAttr}"` : ''
        }>, expected <input type="file">: ${selector}`,
      );
    }

    await debuggerApi.sendCommand('DOM.setFileInputFiles', {
      files: [filePath],
      nodeId,
    });
  } finally {
    if (didAttach && debuggerApi.isAttached()) {
      debuggerApi.detach();
    }
  }
}

const SELECT_MATCHER_SCRIPT = `
  const inferBooleanValue = value => {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!normalized) return null;
    if (/^(no|n|false|0)$/.test(normalized) || /\\bnot\\b/.test(normalized) || /\\bdo not\\b/.test(normalized) || /\\bdon't\\b/.test(normalized)) return 'no';
    if (/^(yes|y|true|1)$/.test(normalized) || /\\bauthorized\\b/.test(normalized) || /\\bi am\\b/.test(normalized)) return 'yes';
    return null;
  };
  const escapeRegex = value => value.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\$&');
  const scoreOptionMatch = (optionText, optionValue, requestedValue, requestedBoolean) => {
    const text = String(optionText ?? '').trim().toLowerCase();
    const value = String(optionValue ?? '').trim().toLowerCase();
    const requested = requestedValue.trim().toLowerCase();
    if (!requested || (!text && !value)) return -1;
    if (text && text === requested) return 100;
    if (value && value === requested) return 95;
    if (text && requested.length >= 2) {
      const wordBoundary = new RegExp('(^|[^a-z0-9])' + escapeRegex(requested) + '($|[^a-z0-9])');
      if (wordBoundary.test(text)) return 80;
    }
    if (value && requested.length >= 2) {
      const wordBoundary = new RegExp('(^|[^a-z0-9])' + escapeRegex(requested) + '($|[^a-z0-9])');
      if (wordBoundary.test(value)) return 75;
    }
    if (text && requested.length >= 5 && text.includes(requested)) return 60;
    if (text && text.length >= 5 && requested.includes(text)) return 55;
    if (requestedBoolean !== null) {
      const optionBoolean = inferBooleanValue(value + ' ' + text);
      if (optionBoolean !== null && optionBoolean === requestedBoolean) return 40;
    }
    return -1;
  };
  const pickBestSelectMatch = (candidates, requestedValue) => {
    const requestedBoolean = inferBooleanValue(requestedValue);
    let best = null;
    let bestScore = -1;
    for (const candidate of candidates) {
      const score = scoreOptionMatch(candidate.text, candidate.value, requestedValue, requestedBoolean);
      if (score > bestScore) {
        bestScore = score;
        best = candidate;
      }
    }
    return bestScore >= 0 ? best : null;
  };
`;

const CUSTOM_SELECT_OPTION_QUERY = [
  '[role="option"]',
  '[role="menuitem"]',
  '[data-value]',
  '[data-option-value]',
  '[id*="-option-"]',
  '[class*="option"]',
  'li',
  'button',
].join(', ');

// Resolve a hidden <input> (or any select-like element) to the visible
// interactive control we should mouse-click. Greenhouse, Workday and many
// react-select variants render the form value into a hidden input that sits
// next to (not inside) the visible combobox. We look up, then sideways, then
// inside the nearest container to find a clickable control.
const RESOLVE_SELECT_CONTROL_SCRIPT = `
  const visibleRect = node => {
    if (!(node instanceof HTMLElement)) return null;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? rect : null;
  };
  const isUsefulControl = node => {
    if (!(node instanceof HTMLElement)) return false;
    if (!visibleRect(node)) return false;
    return true;
  };
  const findControlInScope = scope => {
    if (!(scope instanceof Element)) return null;
    const queries = [
      '.select__control',
      '[role="combobox"]',
      '[role="button"]',
      'button[aria-haspopup]',
      'button',
      '[class*="Select__control"]',
      '[class*="select-control"]',
      '[class*="dropdown"]',
    ];
    for (const query of queries) {
      const candidates = scope.querySelectorAll(query);
      for (const candidate of candidates) {
        if (isUsefulControl(candidate)) return candidate;
      }
    }
    return null;
  };
  const looksLikeComboboxAncestor = node => {
    if (!(node instanceof Element)) return false;
    const cls = node.getAttribute('class') ?? '';
    const role = node.getAttribute('role') ?? '';
    if (role === 'combobox' || role === 'listbox') return true;
    return /select__control|select-control|combobox|dropdown/i.test(cls);
  };
  const resolveSelectControl = element => {
    if (!(element instanceof HTMLElement)) return null;
    const direct = element.closest('.select__control');
    if (direct && isUsefulControl(direct)) return direct;
    let inComboboxWidget = false;
    let walker = element.parentElement;
    for (let depth = 0; depth < 6 && walker; depth++) {
      if (looksLikeComboboxAncestor(walker)) {
        inComboboxWidget = true;
        break;
      }
      walker = walker.parentElement;
    }
    if (!inComboboxWidget) {
      // The target is just a plain input/element with no surrounding
      // combobox widget — let the caller treat it as a non-select control
      // so keyboard fallback doesn't accidentally type into a text field.
      return null;
    }
    if (isUsefulControl(element)) return element;
    let container = element.parentElement;
    for (let depth = 0; depth < 5 && container; depth++) {
      const found = findControlInScope(container);
      if (found) return found;
      container = container.parentElement;
    }
    return null;
  };
`;

async function selectCustomOptionWithTrustedMouse(
  webContents: WebContents,
  selector: string,
  value: string,
): Promise<boolean> {
  const debuggerApi = webContents.debugger;
  if (!debuggerApi) return false;

  const controlPoint = await readCustomSelectControlClickPoint(
    webContents,
    selector,
  );
  if (!controlPoint.found) return false;

  let didAttach = false;
  if (!debuggerApi.isAttached()) {
    debuggerApi.attach('1.3');
    didAttach = true;
  }

  try {
    await dispatchTrustedMouseClick(
      debuggerApi,
      controlPoint.x,
      controlPoint.y,
    );

    let matchedOptionVisible = true;
    try {
      await waitForCustomSelectOption(webContents, selector, value, 2_000);
    } catch {
      matchedOptionVisible = false;
    }

    // The DOM check above returns as soon as the option element exists, but
    // react-select / radix portals typically animate the menu into position
    // over ~150ms. Reading bounding rects mid-animation produces stale click
    // coordinates that land outside the option as it slides in, so the click
    // closes the menu instead of selecting. Let the menu settle before we
    // read coordinates and click.
    await sleep(180);

    const optionPoint = matchedOptionVisible
      ? await readCustomSelectOptionClickPoint(webContents, selector, value)
      : { found: false, x: 0, y: 0 };
    if (optionPoint.found) {
      await dispatchTrustedMouseClick(
        debuggerApi,
        optionPoint.x,
        optionPoint.y,
      );
      await sleep(160);
      const confirmed = await isSelectValueApplied(webContents, selector, value);
      if (confirmed) return true;
    }

    // Only fall back to keyboard typing when an option matching the value
    // is actually present in the open menu. Otherwise keyboard typing would
    // dump the LLM's free-form answer ("Not at all influenced my decision")
    // into the search input of a dropdown that has no such option.
    if (!matchedOptionVisible) {
      // Close the menu we opened so a subsequent attempt starts clean.
      await dispatchTrustedMouseClick(
        debuggerApi,
        controlPoint.x,
        controlPoint.y,
      );
      return false;
    }

    // Mouse click on react-select portal options sometimes fails silently
    // because the option listens for pointer events that don't fire from a
    // single mousePressed/mouseReleased. Keyboard navigation: focus the
    // control, type the value (filters react-select's options), press Enter.
    const keyboardConfirmed = await selectCustomOptionWithKeyboard(
      webContents,
      debuggerApi,
      selector,
      value,
    );
    return keyboardConfirmed;
  } catch {
    return false;
  } finally {
    if (didAttach && debuggerApi.isAttached()) {
      debuggerApi.detach();
    }
  }
}

async function selectCustomOptionWithKeyboard(
  webContents: WebContents,
  debuggerApi: WebContents['debugger'],
  selector: string,
  value: string,
): Promise<boolean> {
  await focusCustomSelectInput(webContents, selector);
  await sleep(60);

  // Clear any prior text the control may have so our search starts fresh.
  await dispatchKey(debuggerApi, 'Backspace');
  await sleep(20);

  for (const char of value) {
    await dispatchKey(debuggerApi, char);
  }
  await sleep(160);
  await dispatchKey(debuggerApi, 'Enter');
  await sleep(120);

  return isSelectValueApplied(webContents, selector, value);
}

async function focusCustomSelectInput(
  webContents: WebContents,
  selector: string,
): Promise<void> {
  await executeInPage(
    webContents,
    `
      ${RESOLVE_SELECT_CONTROL_SCRIPT}
      const element = document.querySelector(${toJson(selector)});
      const control = resolveSelectControl(element);
      const focusable =
        control?.querySelector?.('input, [contenteditable="true"]') ??
        (element instanceof HTMLElement ? element : null);
      focusable?.focus?.();
      if (focusable && 'value' in focusable) {
        try { focusable.value = ''; } catch {}
      }
      true;
    `,
  );
}

async function dispatchKey(
  debuggerApi: WebContents['debugger'],
  key: string,
): Promise<void> {
  const isPrintable = key.length === 1;
  const code = keyCodeForKey(key);
  await debuggerApi.sendCommand('Input.dispatchKeyEvent', {
    code,
    key,
    text: isPrintable ? key : undefined,
    type: 'keyDown',
    unmodifiedText: isPrintable ? key : undefined,
    windowsVirtualKeyCode: virtualKeyCode(key),
  });
  await debuggerApi.sendCommand('Input.dispatchKeyEvent', {
    code,
    key,
    type: 'keyUp',
    windowsVirtualKeyCode: virtualKeyCode(key),
  });
}

function keyCodeForKey(key: string): string {
  if (key === 'Enter') return 'Enter';
  if (key === 'Backspace') return 'Backspace';
  if (key === 'Tab') return 'Tab';
  if (key.length === 1) {
    const upper = key.toUpperCase();
    if (/[A-Z]/.test(upper)) return `Key${upper}`;
    if (/[0-9]/.test(key)) return `Digit${key}`;
    if (key === ' ') return 'Space';
  }
  return key;
}

function virtualKeyCode(key: string): number {
  if (key === 'Enter') return 13;
  if (key === 'Backspace') return 8;
  if (key === 'Tab') return 9;
  if (key === ' ') return 32;
  if (key.length === 1) return key.toUpperCase().charCodeAt(0);
  return 0;
}

async function isSelectValueApplied(
  webContents: WebContents,
  selector: string,
  value: string,
): Promise<boolean> {
  return executeInPage<boolean>(
    webContents,
    `
      ${RESOLVE_SELECT_CONTROL_SCRIPT}
      const target = document.querySelector(${toJson(selector)});
      const requested = ${toJson(value)}.trim().toLowerCase();
      if (!requested) {
        true;
      } else {
        // For react-select, the actually-selected value lives in
        // .select__single-value (or .select__multi-value). Reading the
        // whole control's innerText is unreliable while the menu is open —
        // the dropdown's options are inside the control's subtree and
        // text.includes() returns true for any open option, falsely
        // confirming a click that never actually committed.
        const control = resolveSelectControl(target) ?? target;
        let selectedText = '';
        if (control && 'querySelector' in control) {
          const single = control.querySelector('.select__single-value, [class*="singleValue"]');
          const multi = Array.from(control.querySelectorAll('.select__multi-value__label, [class*="multiValue"] [class*="label"]'));
          const parts = [];
          if (single && 'textContent' in single) parts.push(String(single.textContent || ''));
          for (const node of multi) {
            if (node && 'textContent' in node) parts.push(String(node.textContent || ''));
          }
          selectedText = parts.join(' ').trim().toLowerCase();
        }
        const inputValue = (target && 'value' in target ? String(target.value ?? '') : '')
          .trim()
          .toLowerCase();
        // Fall back to the control's innerText only when no react-select
        // value node was found AND the menu appears closed (no open menu
        // sibling) — covers non-react-select custom widgets without
        // resurrecting the false-positive bug.
        let fallbackText = '';
        if (!selectedText && control && 'querySelector' in control) {
          const menuOpen = control.querySelector('.select__menu, [class*="menu"][class*="open"], [aria-expanded="true"] + *');
          if (!menuOpen) {
            fallbackText = ((control && 'innerText' in control)
              ? String(control.innerText ?? '')
              : ''
            ).trim().toLowerCase();
          }
        }
        const hay = selectedText || fallbackText;
        (hay && hay.includes(requested)) || (inputValue && inputValue.includes(requested));
      }
    `,
  );
}

async function readCustomSelectControlClickPoint(
  webContents: WebContents,
  selector: string,
): Promise<{
  readonly found: boolean;
  readonly x: number;
  readonly y: number;
}> {
  return executeInPage(
    webContents,
    `
    ${RESOLVE_SELECT_CONTROL_SCRIPT}
    const element = document.querySelector(${toJson(selector)});
    const control = resolveSelectControl(element);
    if (!control) {
      ({ found: false, x: 0, y: 0 });
    } else {
      control.scrollIntoView?.({ block: 'center', inline: 'nearest' });
      const rect = control.getBoundingClientRect();
      ({
        found: rect.width > 0 && rect.height > 0,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  `,
  );
}

async function readCustomSelectOptionClickPoint(
  webContents: WebContents,
  selector: string,
  value: string,
): Promise<{
  readonly found: boolean;
  readonly x: number;
  readonly y: number;
}> {
  return executeInPage(
    webContents,
    `
    ${SELECT_MATCHER_SCRIPT}
    const target = document.querySelector(${toJson(selector)});
    const requestedValue = ${toJson(value)};
    const isVisibleOption = candidate => {
      if (!(candidate instanceof HTMLElement) || candidate === target) return false;
      const style = window.getComputedStyle(candidate);
      if (style.display === 'none' || style.visibility === 'hidden') return false;
      const rect = candidate.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const optionElements = Array.from(document.querySelectorAll('${CUSTOM_SELECT_OPTION_QUERY}'))
      .filter(isVisibleOption);
    const candidates = optionElements.map(element => ({
      text: element.textContent ?? '',
      value: element.getAttribute('data-value') ?? element.getAttribute('data-option-value') ?? element.getAttribute('value') ?? '',
      element,
    }));
    const matchedOption = pickBestSelectMatch(candidates, requestedValue);
    if (!matchedOption) {
      ({ found: false, x: 0, y: 0 });
    } else {
      matchedOption.element.scrollIntoView?.({ block: 'center', inline: 'nearest' });
      const rect = matchedOption.element.getBoundingClientRect();
      ({
        found: rect.width > 0 && rect.height > 0,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }
  `,
  );
}

async function dispatchTrustedMouseClick(
  debuggerApi: WebContents['debugger'],
  x: number,
  y: number,
): Promise<void> {
  await debuggerApi.sendCommand('Input.dispatchMouseEvent', {
    button: 'left',
    clickCount: 1,
    type: 'mousePressed',
    x,
    y,
  });
  // Real human clicks have ~50-100ms between press and release. Some React
  // handlers (react-select option lists) miss the click when press+release
  // fire back-to-back because their pointer-event reconciler hasn't processed
  // the press yet.
  await sleep(60);
  await debuggerApi.sendCommand('Input.dispatchMouseEvent', {
    button: 'left',
    clickCount: 1,
    type: 'mouseReleased',
    x,
    y,
  });
}

async function openCustomSelect(
  webContents: WebContents,
  selector: string,
): Promise<void> {
  await executeInPage(
    webContents,
    `
      ${RESOLVE_SELECT_CONTROL_SCRIPT}
      const element = document.querySelector(${toJson(selector)});
      if (!(element instanceof HTMLElement)) {
        throw new Error('Select target not found: ${escapeForError(selector)}');
      }
      const control = resolveSelectControl(element) ?? element;
      control.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      control.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      element.focus?.();
    `,
  );
}

async function waitForCustomSelectOption(
  webContents: WebContents,
  selector: string,
  value: string,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const ready = await executeInPage<boolean>(
      webContents,
      `
        ${SELECT_MATCHER_SCRIPT}
        const target = document.querySelector(${toJson(selector)});
        const requestedValue = ${toJson(value)};
        const candidates = Array.from(document.querySelectorAll('${CUSTOM_SELECT_OPTION_QUERY}'))
          .filter(candidate => candidate instanceof HTMLElement && candidate !== target)
          .map(candidate => ({
            text: candidate.textContent ?? '',
            value: candidate.getAttribute('data-value') ?? candidate.getAttribute('data-option-value') ?? candidate.getAttribute('value') ?? '',
          }));
        Boolean(pickBestSelectMatch(candidates, requestedValue));
      `,
    );
    if (ready) return;
    await sleep(60);
  }
}

async function clickCustomSelectOption(
  webContents: WebContents,
  selector: string,
  value: string,
): Promise<void> {
  await executeInPage(
    webContents,
    `
      ${SELECT_MATCHER_SCRIPT}
      const target = document.querySelector(${toJson(selector)});
      const requestedValue = ${toJson(value)};
      const optionElements = Array.from(document.querySelectorAll('${CUSTOM_SELECT_OPTION_QUERY}'))
        .filter(candidate => candidate instanceof HTMLElement && candidate !== target);
      const candidates = optionElements.map(element => ({
        text: element.textContent ?? '',
        value: element.getAttribute('data-value') ?? element.getAttribute('data-option-value') ?? element.getAttribute('value') ?? '',
        element,
      }));
      const matchedOption = pickBestSelectMatch(candidates, requestedValue);
      if (!matchedOption) {
        throw new Error('Select option not found: ${escapeForError(value)}');
      }
      matchedOption.element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      matchedOption.element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
      matchedOption.element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    `,
  );
}

async function isWaitMatch(
  webContents: WebContents,
  input: WaitForInput,
): Promise<boolean> {
  return executeInPage<boolean>(
    webContents,
    `
      const selectorMatched = ${input.selector ? `Boolean(document.querySelector(${toJson(input.selector)}))` : 'true'};
      const bodyText = document.body?.innerText ?? '';
      const textMatched = ${input.text ? `bodyText.includes(${toJson(input.text)})` : 'true'};
      selectorMatched && textMatched;
    `,
  );
}

function executeInPage<T>(
  webContents: WebContents,
  script: string,
): Promise<T> {
  const wrappedScript = `
    (() => {
      try {
        const value = eval(${toJson(script)});
        return { ok: true, value };
      } catch (error) {
        return {
          ok: false,
          error: {
            message: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? (error.stack ?? null) : null,
          },
        };
      }
    })();
  `;

  return webContents
    .executeJavaScript(wrappedScript, true)
    .then(result => {
      if (
        result &&
        typeof result === 'object' &&
        !Array.isArray(result) &&
        'ok' in result
      ) {
        const parsedResult = result as
          | { ok: true; value: T }
          | { ok: false; error?: { message?: string; stack?: string | null } };

        if (!parsedResult.ok) {
          const message =
            parsedResult.error?.message ?? 'Desktop page evaluation failed.';
          const stack = parsedResult.error?.stack;
          throw new Error(stack ? `${message}\n${stack}` : message);
        }

        return parsedResult.value;
      }

      return result as T;
    })
    .catch(error => {
      if (
        error instanceof Error &&
        error.message !== 'Script failed to execute'
      ) {
        throw error;
      }

      const currentUrl = webContents.getURL?.() ?? 'unknown';
      throw new Error(
        `Script failed to execute in desktop webview at ${currentUrl}.`,
      );
    });
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
