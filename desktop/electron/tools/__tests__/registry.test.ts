import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createDesktopToolRegistry } from '../registry';
import { DESKTOP_TOOL_NAMES, type DesktopToolName } from '../types';
import { createFixtureCdpToolDriver } from './fixture-driver';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../__fixtures__/greenhouse-form.html',
);

describe('desktop tool registry', () => {
  it('lists every required P5.2 tool', () => {
    const registry = createDesktopToolRegistry(
      createFixtureCdpToolDriver(fixturePath),
    );

    expect(registry.listTools()).toEqual([...DESKTOP_TOOL_NAMES]);
  });

  it.each([
    [
      'navigate',
      { url: 'https://jobs.ashbyhq.com/example/apply' },
      { url: 'https://jobs.ashbyhq.com/example/apply' },
    ],
    ['wait_for', { selector: '#first-name', timeoutMs: 50 }, { matched: true }],
    ['dom_snapshot', {}, { title: 'Fixture Greenhouse Application' }],
    [
      'read_element',
      { selector: '#first-name' },
      { tagName: 'input', value: '' },
    ],
    ['click', { selector: '#continue' }, { clicked: true }],
    ['fill', { selector: '#first-name', value: 'Steven' }, { value: 'Steven' }],
    ['select', { selector: '#work-auth', value: 'yes' }, { value: 'yes' }],
    [
      'upload',
      { filePath: '/tmp/resume.pdf', selector: '#resume' },
      { filePath: '/tmp/resume.pdf' },
    ],
    ['press_key', { key: 'Tab' }, { key: 'Tab' }],
    [
      'scroll_into_view',
      { selector: '#submit-application' },
      { selector: '#submit-application' },
    ],
    ['network_observe', { enabled: true }, { enabled: true }],
    [
      'network_replay',
      {
        headers: { accept: 'text/plain' },
        method: 'POST',
        url: 'https://jobs.ashbyhq.com/example/apply',
      },
      { status: 200 },
    ],
    ['cookies_get', {}, { cookies: [] }],
    [
      'cookies_set',
      {
        cookies: [
          {
            name: 'session',
            url: 'https://jobs.ashbyhq.com',
            value: 'fixture',
          },
        ],
      },
      { count: 1 },
    ],
    [
      'screenshot_region',
      { height: 20, width: 20, x: 0, y: 0 },
      { height: 20, width: 20 },
    ],
    ['identity_load', { key: 'first_name' }, { value: 'Steven' }],
    ['submit_guard', { enabled: false }, { enabled: false }],
  ] satisfies Array<[DesktopToolName, unknown, Record<string, unknown>]>)(
    'calls %s and returns structured data',
    async (tool, input, expectedData) => {
      const registry = createDesktopToolRegistry(
        createFixtureCdpToolDriver(fixturePath),
      );

      await expect(registry.call({ input, tool })).resolves.toMatchObject({
        data: expectedData,
        ok: true,
        tool,
      });
    },
  );

  it('returns structured failures when validation fails', async () => {
    const registry = createDesktopToolRegistry(
      createFixtureCdpToolDriver(fixturePath),
    );

    await expect(
      registry.call({
        input: { url: 'file:///tmp/form.html' },
        tool: 'navigate',
      }),
    ).resolves.toMatchObject({
      error: {
        code: 'TOOL_ERROR',
      },
      ok: false,
      tool: 'navigate',
    });
  });
});
