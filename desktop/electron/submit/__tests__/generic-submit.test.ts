import { describe, expect, it } from 'vitest';

import type { DesktopToolRegistry } from '../../tools/registry';
import type {
  DesktopToolCallRequest,
  DesktopToolCallResult,
  DesktopToolName,
} from '../../tools/types';
import { runGenericSubmitLead } from '../generic-submit';

const FORM_FIELDS = `
  <label for="first_name">First name</label>
  <input id="first_name" name="first_name" type="text" />
  <label for="last_name">Last name</label>
  <input id="last_name" name="last_name" type="text" />
  <label for="email">Email</label>
  <input id="email" name="email" type="email" />
  <label for="phone">Phone</label>
  <input id="phone" name="phone" type="tel" />
  <label for="resume">Resume</label>
  <input id="resume" name="resume" type="file" />
`;

function createRegistry(
  submitHtml: string,
  options: {
    readonly afterSubmitHtml?: string;
    readonly afterSubmitTitle?: string;
    readonly afterSubmitUrl?: string;
  } = {},
) {
  const calls: DesktopToolCallRequest[] = [];
  let submitted = false;
  const identities: Record<string, string> = {
    email: 'steven@example.com',
    first_name: 'Steven',
    last_name: 'Bennett',
    phone: '+15555550123',
    resume_pdf_path: '/tmp/resume.pdf',
  };
  const registry: DesktopToolRegistry = {
    async call(request) {
      calls.push(request);
      if (request.tool === 'dom_snapshot') {
        if (submitted) {
          return ok(request.tool, {
            html:
              options.afterSubmitHtml ??
              '<main><h1>Thanks for applying</h1></main>',
            title: options.afterSubmitTitle ?? 'Application received',
            url: options.afterSubmitUrl ?? 'https://jobs.example.com/apply/thanks',
          });
        }
        return ok(request.tool, {
          html: `<form>${FORM_FIELDS}${submitHtml}</form>`,
          title: 'Generic Apply Fixture',
          url: 'https://jobs.example.com/apply',
        });
      }
      if (request.tool === 'identity_load') {
        const input = request.input as { readonly key?: unknown } | undefined;
        const key = typeof input?.key === 'string' ? input.key : '';
        const value = identities[key];
        if (!value) return error(request.tool, `missing identity ${key}`);
        return ok(request.tool, { key, value });
      }
      if (request.tool === 'click') {
        const input = request.input as
          | { readonly selector?: unknown }
          | undefined;
        if (String(input?.selector ?? '').includes('submit')) {
          submitted = true;
        }
      }
      return ok(request.tool);
    },
    listTools() {
      return [
        'navigate',
        'wait_for',
        'dom_snapshot',
        'identity_load',
        'fill',
        'select',
        'upload',
        'submit_guard',
        'click',
      ];
    },
  };
  return { calls, registry };
}

describe('runGenericSubmitLead submit button state', () => {
  it('returns validation_failed with submit_button_disabled for disabled submit buttons', async () => {
    const { calls, registry } = createRegistry(
      '<button id="submit" type="submit" disabled>Submit application</button>',
    );

    const result = await runGenericSubmitLead(registry, {
      applicationUrl: 'https://jobs.example.com/apply',
      mode: 'submit',
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toContain('reason=submit_button_disabled');
    expect(calls.some(call => call.tool === 'click')).toBe(false);
  });

  it('returns validation_failed with submit_button_disabled for aria-disabled submit buttons', async () => {
    const { calls, registry } = createRegistry(
      '<button id="submit" type="submit" aria-disabled="true">Submit application</button>',
    );

    const result = await runGenericSubmitLead(registry, {
      applicationUrl: 'https://jobs.example.com/apply',
      mode: 'submit',
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toContain('reason=submit_button_disabled');
    expect(calls.some(call => call.tool === 'click')).toBe(false);
  });

  it('returns validation_failed with submit_button_disabled for hidden submit buttons', async () => {
    const { calls, registry } = createRegistry(
      '<button id="submit" type="submit" style="display: none">Submit application</button>',
    );

    const result = await runGenericSubmitLead(registry, {
      applicationUrl: 'https://jobs.example.com/apply',
      mode: 'submit',
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toContain('reason=submit_button_disabled');
    expect(calls.some(call => call.tool === 'click')).toBe(false);
  });

  it('returns validation_failed when no submit button exists', async () => {
    const { registry } = createRegistry('');

    const result = await runGenericSubmitLead(registry, {
      applicationUrl: 'https://jobs.example.com/apply',
      mode: 'submit',
    });

    expect(result.status).toBe('validation_failed');
    expect(result.message).toContain('Could not locate a submit button');
  });

  it('clicks an enabled submit button and confirms the submission', async () => {
    const { calls, registry } = createRegistry(
      '<button id="submit" type="submit">Submit application</button>',
    );

    const result = await runGenericSubmitLead(registry, {
      applicationUrl: 'https://jobs.example.com/apply',
      mode: 'submit',
    });

    expect(result.status).toBe('completed');
    expect(
      calls.some(call => call.tool === 'click' && call.input),
    ).toBe(true);
  });

  it('returns validation failures when submit leaves native errors visible', async () => {
    const { registry } = createRegistry(
      '<button id="submit" type="submit">Submit application</button>',
      {
        afterSubmitUrl: 'https://jobs.example.com/apply',
        afterSubmitTitle: 'Application form',
        afterSubmitHtml: `
          <form id="application-form">
            <label>Email <input name="email" aria-invalid="true" required></label>
            <p role="alert">Email is required.</p>
            <button type="submit">Submit application</button>
          </form>
        `,
      },
    );

    const result = await runGenericSubmitLead(registry, {
      applicationUrl: 'https://jobs.example.com/apply',
      mode: 'submit',
    });

    expect(result.status).toBe('confirmation_timeout');
    expect(result.validationFailures).toEqual([
      {
        fieldLabel: 'Email',
        fieldSelector: 'input[name="email"]',
        message: 'Email is required.',
      },
    ]);
  });
});

function ok(
  tool: DesktopToolName,
  data: unknown = {},
): DesktopToolCallResult {
  return { data, ok: true, tool };
}

function error(
  tool: DesktopToolName,
  message: string,
): DesktopToolCallResult {
  return {
    error: { code: 'TEST_ERROR', message },
    ok: false,
    tool,
  };
}
