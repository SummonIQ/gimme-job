import { describe, expect, it, vi } from 'vitest';

import {
  type FlowContext,
  type FlowDriver,
  type FlowStep,
  runFlow,
} from '../index.js';

function makeRecordingDriver(overrides: Partial<FlowDriver> = {}): {
  driver: FlowDriver;
  calls: Array<{ method: string; input: unknown }>;
} {
  const calls: Array<{ method: string; input: unknown }> = [];
  const recordAndReturn =
    <T>(method: string, result: T) =>
    async (input: unknown): Promise<T> => {
      calls.push({ input, method });
      return result;
    };

  const driver: FlowDriver = {
    navigate: recordAndReturn('navigate', { url: 'about:blank' }),
    waitFor: recordAndReturn('waitFor', {
      matched: true,
      selector: null,
      text: null,
    }),
    click: recordAndReturn('click', { clicked: true, selector: '' }),
    fill: recordAndReturn('fill', { selector: '', value: '' }),
    select: recordAndReturn('select', { selector: '', value: '' }),
    upload: recordAndReturn('upload', { filePath: '', selector: '' }),
    scrollIntoView: recordAndReturn('scrollIntoView', { selector: '' }),
    readElement: recordAndReturn('readElement', {
      attributes: {},
      selector: '',
      tagName: '',
      text: '',
      value: null,
    }),
    pressKey: recordAndReturn('pressKey', { key: '' }),
    ...overrides,
  };
  return { calls, driver };
}

const CONTEXT: FlowContext = { mode: 'replay', sessionId: 's' };

describe('runFlow', () => {
  it('dispatches each step type to the matching driver method', async () => {
    const { calls, driver } = makeRecordingDriver();
    const steps: FlowStep[] = [
      { type: 'navigate', url: 'https://example.com/apply' },
      { selector: '#first_name', type: 'wait_for' },
      { selector: '#first_name', type: 'fill', value: 'Steven' },
      { selector: '#authorized', type: 'select', value: 'yes' },
      { filePath: '/tmp/resume.pdf', selector: '#resume', type: 'upload' },
      { selector: '#submit_app', type: 'scroll_into_view' },
      { selector: '#submit_app', type: 'read_element' },
      { key: 'Enter', type: 'press_key' },
      { selector: '#submit_app', type: 'click' },
    ];

    const result = await runFlow(steps, driver, CONTEXT);

    expect(result.failed).toBe(false);
    expect(result.completedSteps).toBe(steps.length);
    expect(calls.map(c => c.method)).toEqual([
      'navigate',
      'waitFor',
      'fill',
      'select',
      'upload',
      'scrollIntoView',
      'readElement',
      'pressKey',
      'click',
    ]);
    expect(result.events.map(e => e.action)).toEqual([
      'navigate',
      'wait_for',
      'fill',
      'select',
      'upload',
      'scroll_into_view',
      'read_element',
      'press_key',
      'click',
    ]);
    for (const event of result.events) {
      expect(event.status).toBe('ok');
      expect(event.errorMessage).toBeNull();
    }
  });

  it('stops on first error by default', async () => {
    const { driver } = makeRecordingDriver({
      fill: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const steps: FlowStep[] = [
      { type: 'navigate', url: 'https://example.com' },
      { selector: '#x', type: 'fill', value: 'y' },
      { selector: '#next', type: 'click' },
    ];
    const result = await runFlow(steps, driver, CONTEXT);

    expect(result.failed).toBe(true);
    expect(result.completedSteps).toBe(1);
    expect(result.events).toHaveLength(2);
    expect(result.events[1]).toMatchObject({
      action: 'fill',
      errorMessage: 'boom',
      status: 'error',
    });
  });

  it('continues past errors when stopOnError=false', async () => {
    const { driver } = makeRecordingDriver({
      fill: vi.fn().mockRejectedValue(new Error('boom')),
    });
    const steps: FlowStep[] = [
      { selector: '#x', type: 'fill', value: 'y' },
      { selector: '#next', type: 'click' },
    ];
    const result = await runFlow(steps, driver, CONTEXT, {
      stopOnError: false,
    });

    expect(result.failed).toBe(true);
    expect(result.events).toHaveLength(2);
    expect(result.events[0].status).toBe('error');
    expect(result.events[1].status).toBe('ok');
  });

  it('passes timeoutMs through to waitFor with a default', async () => {
    const waitFor = vi.fn().mockResolvedValue({
      matched: true,
      selector: null,
      text: null,
    });
    const { driver } = makeRecordingDriver({ waitFor });
    await runFlow([{ selector: '#x', type: 'wait_for' }], driver, CONTEXT);
    expect(waitFor).toHaveBeenCalledWith({
      selector: '#x',
      text: undefined,
      timeoutMs: 5_000,
    });
  });
});
