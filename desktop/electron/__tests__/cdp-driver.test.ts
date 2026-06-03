import { describe, expect, it, vi } from 'vitest';

import {
  type CdpFlowDriver,
  createCdpFlowDriver,
} from '../runtime/cdp-driver.js';
import type { DesktopCdpToolDriver } from '../tools/types.js';

function fakeDesktopDriver(): DesktopCdpToolDriver {
  return {
    click: vi.fn(async ({ selector }) => ({ clicked: true, selector })),
    cookiesGet: vi.fn(async () => ({ cookies: [] })),
    cookiesSet: vi.fn(async () => ({ count: 0 })),
    domSnapshot: vi.fn(async () => ({ html: '', title: '', url: '' })),
    fill: vi.fn(async ({ selector, value }) => ({ selector, value })),
    identityLoad: vi.fn(async ({ key }) => ({ key, value: '' })),
    navigate: vi.fn(async ({ url }) => ({ url })),
    networkObserve: vi.fn(async ({ enabled }) => ({ enabled })),
    networkReplay: vi.fn(async ({ url }) => ({
      body: '',
      headers: {},
      status: 200,
      url,
    })),
    pressKey: vi.fn(async ({ key }) => ({ key })),
    readElement: vi.fn(async ({ selector }) => ({
      attributes: {},
      selector,
      tagName: 'div',
      text: '',
      value: null,
    })),
    screenshotRegion: vi.fn(async ({ height, width }) => ({
      dataUrl: '',
      height,
      width,
    })),
    scrollIntoView: vi.fn(async ({ selector }) => ({ selector })),
    select: vi.fn(async ({ selector, value }) => ({ selector, value })),
    submitGuard: vi.fn(async () => ({ enabled: true })),
    upload: vi.fn(async ({ filePath, selector }) => ({
      filePath,
      selector,
    })),
    waitFor: vi.fn(async ({ selector, text }) => ({
      matched: true,
      selector: selector ?? null,
      text: text ?? null,
    })),
  };
}

describe('createCdpFlowDriver', () => {
  it('exposes only the flow-executor subset and delegates each call', async () => {
    const desktop = fakeDesktopDriver();
    const flow = createCdpFlowDriver(desktop);

    await flow.navigate({ url: 'https://example.com' });
    await flow.waitFor({ selector: '#x', timeoutMs: 1000 });
    await flow.click({ selector: '#submit' });
    await flow.fill({ selector: '#name', value: 'Steven' });
    await flow.select({ selector: '#role', value: 'eng' });
    await flow.upload({ filePath: '/r.pdf', selector: '#resume' });
    await flow.scrollIntoView({ selector: '#bottom' });
    await flow.readElement({ selector: '#field' });
    await flow.pressKey({ key: 'Enter' });

    expect(desktop.navigate).toHaveBeenCalledOnce();
    expect(desktop.waitFor).toHaveBeenCalledOnce();
    expect(desktop.click).toHaveBeenCalledOnce();
    expect(desktop.fill).toHaveBeenCalledOnce();
    expect(desktop.select).toHaveBeenCalledOnce();
    expect(desktop.upload).toHaveBeenCalledOnce();
    expect(desktop.scrollIntoView).toHaveBeenCalledOnce();
    expect(desktop.readElement).toHaveBeenCalledOnce();
    expect(desktop.pressKey).toHaveBeenCalledOnce();
    // Larger-driver concerns stay off the flow surface.
    expect(desktop.cookiesGet).not.toHaveBeenCalled();
    expect(desktop.networkObserve).not.toHaveBeenCalled();
    expect(desktop.screenshotRegion).not.toHaveBeenCalled();
    expect(desktop.submitGuard).not.toHaveBeenCalled();
    expect(desktop.identityLoad).not.toHaveBeenCalled();
  });

  it('returns a CdpFlowDriver with exactly the flow-executor methods', () => {
    const flow: CdpFlowDriver = createCdpFlowDriver(fakeDesktopDriver());
    const keys = Object.keys(flow).sort();
    expect(keys).toEqual(
      [
        'click',
        'fill',
        'navigate',
        'pressKey',
        'readElement',
        'scrollIntoView',
        'select',
        'upload',
        'waitFor',
      ].sort(),
    );
  });
});
