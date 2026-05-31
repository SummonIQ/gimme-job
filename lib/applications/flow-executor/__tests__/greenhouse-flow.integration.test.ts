import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startFixtureDriver } from '@/lib/evaluation/fixture-driver';
import {
  startFixtureServer,
  type StartedFixtureServer,
} from '@/lib/evaluation/fixture-server';

import {
  type FlowContext,
  type FlowDriver,
  type FlowEvent,
  type FlowStep,
  runFlow,
} from '../index.js';

/**
 * Integration test for P7.5: the same Greenhouse flow is executed
 * against two drivers - (1) a fixture driver backed by jsdom fetching
 * against the P7.2 fixture server, and (2) a stub "CDP-like" driver
 * that mimics the Electron tool driver's return shapes. Both must
 * produce identical event traces. The Electron-backed driver itself is
 * exercised in desktop/electron/__tests__ - we cannot spin up a real
 * `WebContents` from this package, so here we use a minimal stand-in
 * that matches the contract.
 */

const FIXTURES_ROOT = path.resolve(process.cwd(), 'fixtures/ats');

function greenhouseSteps(baseUrl: string): FlowStep[] {
  const appUrl = `${baseUrl}/fixtures/greenhouse/application`;
  return [
    { type: 'navigate', url: appUrl },
    { selector: '#first_name', timeoutMs: 1_000, type: 'wait_for' },
    { selector: '#first_name', type: 'fill', value: 'Steven' },
    { selector: '#last_name', type: 'fill', value: 'Bennett' },
    { selector: '#email', type: 'fill', value: 'steven@example.com' },
    { selector: '#phone', type: 'fill', value: '4155550137' },
    { filePath: '/tmp/resume.pdf', selector: '#resume', type: 'upload' },
    { selector: '#question_authorized', type: 'select', value: 'yes' },
    { selector: '#question_years', type: 'fill', value: '8' },
    { selector: '#submit_app', type: 'scroll_into_view' },
    { selector: '#submit_app', type: 'read_element' },
  ];
}

const CONTEXT: FlowContext = { mode: 'replay', sessionId: 'gh-parity' };

function cdpStubDriver(htmlLoader: () => string): FlowDriver {
  // A minimal driver that mirrors DesktopCdpToolDriver *return shapes*
  // (not semantics). The goal is: runFlow emits the same FlowEvent[]
  // regardless of which driver is attached. Return values on the event
  // trace are not persisted, only action+selector+status, so we do not
  // need DOM parity here - we only need each method to resolve without
  // throwing for selectors that exist in the loaded HTML.
  const lookup = (selector: string) => {
    const html = htmlLoader();
    if (!html.includes(selector.replace('#', 'id="').concat('"'))) {
      throw new Error(`Element not found: ${selector}`);
    }
  };

  return {
    async navigate({ url }) {
      return { url };
    },
    async waitFor({ selector, text, timeoutMs: _timeoutMs }) {
      if (selector) lookup(selector);
      return { matched: true, selector: selector ?? null, text: text ?? null };
    },
    async click({ selector }) {
      lookup(selector);
      return { clicked: true, selector };
    },
    async fill({ selector, value }) {
      lookup(selector);
      return { selector, value };
    },
    async select({ selector, value }) {
      lookup(selector);
      return { selector, value };
    },
    async upload({ selector, filePath }) {
      lookup(selector);
      return { filePath, selector };
    },
    async scrollIntoView({ selector }) {
      lookup(selector);
      return { selector };
    },
    async readElement({ selector }) {
      lookup(selector);
      return {
        attributes: {},
        selector,
        tagName: '',
        text: '',
        value: null,
      };
    },
    async pressKey({ key }) {
      return { key };
    },
  };
}

describe('runFlow against Greenhouse fixture - driver parity', () => {
  let server: StartedFixtureServer;

  beforeAll(async () => {
    server = await startFixtureServer({ fixturesRoot: FIXTURES_ROOT });
  });
  afterAll(async () => {
    await server.stop();
  });

  it('produces identical event traces on the fixture driver and a CDP-shaped stub', async () => {
    const steps = greenhouseSteps(server.baseUrl);

    // 1) Fixture driver (jsdom) - hits the P7.2 fixture server.
    const fixtureHarness = startFixtureDriver();
    const fixtureResult = await runFlow(steps, fixtureHarness.driver, CONTEXT);

    // 2) CDP-shaped stub - independent implementation, same contract.
    const applicationHtml = await readFile(
      path.resolve(FIXTURES_ROOT, 'greenhouse/application.html'),
      'utf8',
    );
    const cdpResult = await runFlow(
      steps,
      cdpStubDriver(() => applicationHtml),
      CONTEXT,
    );

    expect(fixtureResult.failed).toBe(false);
    expect(cdpResult.failed).toBe(false);

    const strip = (event: FlowEvent) => ({
      action: event.action,
      selector: event.selector,
      status: event.status,
      stepIndex: event.stepIndex,
    });

    expect(fixtureResult.events.map(strip)).toEqual(
      cdpResult.events.map(strip),
    );
    expect(fixtureResult.events).toHaveLength(steps.length);
  });

  it('fixture driver actually mutates the DOM (fill is observable)', async () => {
    const steps: FlowStep[] = [
      {
        type: 'navigate',
        url: `${server.baseUrl}/fixtures/greenhouse/application`,
      },
      { selector: '#first_name', type: 'fill', value: 'Parity' },
    ];
    const fixtureHarness = startFixtureDriver();
    await runFlow(steps, fixtureHarness.driver, CONTEXT);
    const readback = await fixtureHarness.driver.readElement({
      selector: '#first_name',
    });
    expect(readback.value).toBe('Parity');
  });
});
