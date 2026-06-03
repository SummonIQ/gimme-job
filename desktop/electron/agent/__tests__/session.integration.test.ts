import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { createClaudeAgentSdkRuntime } from '../claude-agent-sdk';
import { createDesktopAgentSession } from '../session';
import type { LocalClaudeAgentSdkSession } from '../claude-agent-sdk';
import { createFixtureCdpToolDriver } from '../../tools/__tests__/fixture-driver';
import { createDesktopToolRegistry } from '../../tools/registry';

const fixturePath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../tools/__fixtures__/greenhouse-form.html',
);

describe('desktop agent session', () => {
  it('walks a Greenhouse fixture and stops before submit in training mode', async () => {
    const sdkInputs: string[] = [];
    const sdkSession: LocalClaudeAgentSdkSession = {
      async run(input) {
        sdkInputs.push(input.systemPrompt);

        await input.callTool({
          input: { url: 'https://job-boards.greenhouse.io/example/jobs/123' },
          reason: 'open job page',
          tool: 'navigate',
        });
        await input.callTool({
          input: { selector: '#first-name', timeoutMs: 50 },
          reason: 'wait for application form',
          tool: 'wait_for',
        });
        await input.callTool({
          input: { selector: '#first-name', value: 'Steven' },
          reason: 'fill first name',
          tool: 'fill',
        });
        await input.callTool({
          input: { selector: '#email', value: 'steven@example.com' },
          reason: 'fill email',
          tool: 'fill',
        });
        await input.callTool({
          input: { filePath: '/tmp/resume.pdf', selector: '#resume' },
          reason: 'attach resume',
          tool: 'upload',
        });
        await input.callTool({
          input: { selector: '#work-auth', value: 'yes' },
          reason: 'answer work authorization',
          tool: 'select',
        });
        const submitResult = await input.callTool({
          input: { selector: '#submit-application' },
          reason: 'verify submit guard',
          tool: 'click',
        });

        return {
          message:
            submitResult.error?.message ?? 'Fixture reached submit button.',
        };
      },
    };
    const registry = createDesktopToolRegistry(
      createFixtureCdpToolDriver(fixturePath),
    );
    const session = createDesktopAgentSession(registry, {
      runtime: createClaudeAgentSdkRuntime(sdkSession),
    });

    const result = await session.run({
      objective: 'Complete the Greenhouse fixture until submit.',
    });

    expect(sdkInputs[0]).toContain('training mode has submit_guard=true');
    expect(result.status).toBe('blocked_by_submit_guard');
    expect(result.events.map(event => event.tool)).toEqual([
      'submit_guard',
      'navigate',
      'wait_for',
      'fill',
      'fill',
      'upload',
      'select',
      'click',
    ]);
    expect(result.events[0]).toMatchObject({
      input: { enabled: true },
      result: { data: { enabled: true }, ok: true, tool: 'submit_guard' },
      tool: 'submit_guard',
    });
    expect(result.events.at(-1)).toMatchObject({
      result: {
        error: {
          message: 'submit_guard blocked a submit-intent click.',
        },
        ok: false,
        tool: 'click',
      },
      tool: 'click',
    });
  });

  it('benign tool-call failures during a training run do not flip the run to failed', async () => {
    // Regression: prior to this fix, a single failed `select` (e.g. for a
    // `#state` field a particular Greenhouse form doesn't expose) would
    // override the runtime's `'completed'` status to `'failed'`, even
    // though the autofill itself ran cleanly. The runtime is the
    // authority on the run's verdict.
    const sdkSession: LocalClaudeAgentSdkSession = {
      async run(input) {
        await input.callTool({
          input: { selector: '#first-name', value: 'Steven' },
          reason: 'fill first name',
          tool: 'fill',
        });
        // Simulate a benign select failure — the field isn't on the form.
        // The fixture driver returns ok:false for unknown selectors.
        await input.callTool({
          input: { selector: '#nonexistent-state-field', value: 'CA' },
          reason: 'attempt state field that this form lacks',
          tool: 'select',
        });
        return {
          message: 'Training run completed without submit guard blocking.',
          status: 'completed' as const,
        };
      },
    };
    const registry = createDesktopToolRegistry(
      createFixtureCdpToolDriver(fixturePath),
    );
    const session = createDesktopAgentSession(registry, {
      runtime: createClaudeAgentSdkRuntime(sdkSession),
    });

    const result = await session.run({
      objective: 'Training run with a benign tool-call failure mid-flight.',
    });

    // The select for the missing field should have failed (ok:false)…
    expect(
      result.events.some(event => event.tool === 'select' && !event.result.ok),
    ).toBe(true);
    // …but the run as a whole is `'completed'`, not `'failed'`.
    expect(result.status).toBe('completed');
  });
});
