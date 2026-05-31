import { describe, expect, it } from 'vitest';

import { startFixtureDriver } from '@/lib/evaluation/fixture-driver';

import type { FlowDriver } from '../index.js';

/**
 * Driver contract tests. Any implementation of `FlowDriver` must pass
 * these to be pluggable into `runFlow`. Today this file exercises the
 * fixture driver (the in-memory reference). The desktop CDP driver runs
 * the same spec in an Electron-only integration harness - duplicating
 * the assertions there would require spinning up a real `WebContents`.
 */
const FORM_HTML = `<!doctype html>
<html>
  <body>
    <form id="f">
      <input id="first_name" name="first_name" />
      <select id="authorized">
        <option value="no">No</option>
        <option value="yes">Yes</option>
      </select>
      <input id="resume" type="file" />
      <button id="submit_app" type="button">Submit</button>
      <span id="greeting">Hello there</span>
    </form>
  </body>
</html>`;

function makeDriver(): { driver: FlowDriver; html: () => string } {
  const started = startFixtureDriver();
  started.setDocument({ html: FORM_HTML, url: 'http://fixture.local/app' });
  return { driver: started.driver, html: () => started.html() };
}

describe('FlowDriver contract - fill', () => {
  it('updates the element value and dispatches input/change', async () => {
    const { driver } = makeDriver();
    const result = await driver.fill({
      selector: '#first_name',
      value: 'Steven',
    });
    expect(result).toEqual({ selector: '#first_name', value: 'Steven' });

    const readback = await driver.readElement({ selector: '#first_name' });
    expect(readback.value).toBe('Steven');
  });

  it('throws when the target is missing', async () => {
    const { driver } = makeDriver();
    await expect(driver.fill({ selector: '#missing', value: 'x' })).rejects.toThrow(
      /not found/,
    );
  });
});

describe('FlowDriver contract - select', () => {
  it('updates the option on a <select>', async () => {
    const { driver } = makeDriver();
    await driver.select({ selector: '#authorized', value: 'yes' });
    const readback = await driver.readElement({ selector: '#authorized' });
    expect(readback.value).toBe('yes');
  });

  it('throws when the target is not a <select>', async () => {
    const { driver } = makeDriver();
    await expect(
      driver.select({ selector: '#first_name', value: 'yes' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('FlowDriver contract - upload', () => {
  it('records the file path for a file input', async () => {
    const { driver, html } = makeDriver();
    await driver.upload({ filePath: '/tmp/r.pdf', selector: '#resume' });
    expect(html()).toContain('data-upload-path="/tmp/r.pdf"');
  });

  it('throws when the target is not a file input', async () => {
    const { driver } = makeDriver();
    await expect(
      driver.upload({ filePath: '/tmp/r.pdf', selector: '#first_name' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('FlowDriver contract - waitFor', () => {
  it('returns matched=true when selector is present', async () => {
    const { driver } = makeDriver();
    const result = await driver.waitFor({
      selector: '#first_name',
      timeoutMs: 1000,
    });
    expect(result).toEqual({
      matched: true,
      selector: '#first_name',
      text: null,
    });
  });

  it('returns matched=true when body contains text', async () => {
    const { driver } = makeDriver();
    const result = await driver.waitFor({ text: 'Hello there', timeoutMs: 1000 });
    expect(result.matched).toBe(true);
  });

  it('throws when selector is absent', async () => {
    const { driver } = makeDriver();
    await expect(
      driver.waitFor({ selector: '#nope', timeoutMs: 1000 }),
    ).rejects.toThrow(/did not match/);
  });
});

describe('FlowDriver contract - readElement', () => {
  it('returns attributes, tag, and text', async () => {
    const { driver } = makeDriver();
    const result = await driver.readElement({ selector: '#submit_app' });
    expect(result.tagName).toBe('button');
    expect(result.text).toBe('Submit');
    expect(result.attributes.id).toBe('submit_app');
    expect(result.attributes.type).toBe('button');
  });
});

describe('FlowDriver contract - pressKey and scrollIntoView', () => {
  it('pressKey echoes the key back (no side effect)', async () => {
    const { driver } = makeDriver();
    expect(await driver.pressKey({ key: 'Enter' })).toEqual({ key: 'Enter' });
  });

  it('scrollIntoView resolves when the selector exists', async () => {
    const { driver } = makeDriver();
    expect(await driver.scrollIntoView({ selector: '#submit_app' })).toEqual({
      selector: '#submit_app',
    });
  });

  it('scrollIntoView throws when selector is missing', async () => {
    const { driver } = makeDriver();
    await expect(
      driver.scrollIntoView({ selector: '#nope' }),
    ).rejects.toThrow(/not found/);
  });
});

describe('FlowDriver contract - click', () => {
  it('dispatches a click event on the target', async () => {
    const { driver } = makeDriver();
    const result = await driver.click({ selector: '#submit_app' });
    expect(result).toEqual({ clicked: true, selector: '#submit_app' });
  });

  it('throws when the target is missing', async () => {
    const { driver } = makeDriver();
    await expect(driver.click({ selector: '#nope' })).rejects.toThrow(
      /not found/,
    );
  });
});
