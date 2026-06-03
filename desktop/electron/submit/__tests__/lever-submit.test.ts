import { describe, expect, it } from 'vitest';

import type { DesktopToolRegistry } from '../../tools/registry';
import type {
  DesktopToolCallRequest,
  DesktopToolCallResult,
  DesktopToolName,
} from '../../tools/types';
import { getLeverApplyUrl, runLeverSubmitLead } from '../lever-submit';

const LEVER_FORM_HTML = `
  <form>
    <label for="name">Full name</label>
    <input id="name" name="name" type="text" />
    <label for="email">Email</label>
    <input id="email" name="email" type="email" />
    <label for="phone">Phone</label>
    <input id="phone" name="phone" type="tel" />
    <label for="resume">Resume</label>
    <input id="resume" name="resume" type="file" accept="application/pdf" />
    <button id="btn-submit" type="submit">Submit application</button>
  </form>
`;

function createRegistry() {
  const calls: DesktopToolCallRequest[] = [];
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
        return ok(request.tool, {
          html: LEVER_FORM_HTML,
          title: 'Lever Apply Fixture',
          url: 'https://jobs.lever.co/example/abc123/apply',
        });
      }
      if (request.tool === 'identity_load') {
        const input = request.input as { readonly key?: unknown } | undefined;
        const key = typeof input?.key === 'string' ? input.key : '';
        const value = identities[key];
        if (!value) return error(request.tool, `missing identity ${key}`);
        return ok(request.tool, { key, value });
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

describe('runLeverSubmitLead', () => {
  it('routes a Lever job description URL to /apply before autofill starts', async () => {
    const { calls, registry } = createRegistry();

    const result = await runLeverSubmitLead(registry, {
      applicationUrl: 'https://jobs.lever.co/example/abc123',
      mode: 'training',
    });

    expect(result.status).toBe('completed');
    const navigate = calls.find(call => call.tool === 'navigate');
    expect(navigate?.input).toEqual({
      url: 'https://jobs.lever.co/example/abc123/apply',
    });
  });

  it('does not rewrite a Lever URL that already points at /apply', async () => {
    const { calls, registry } = createRegistry();

    await runLeverSubmitLead(registry, {
      applicationUrl: 'https://jobs.lever.co/example/abc123/apply',
      mode: 'training',
    });

    const navigate = calls.find(call => call.tool === 'navigate');
    expect(navigate?.input).toEqual({
      url: 'https://jobs.lever.co/example/abc123/apply',
    });
  });
});

describe('getLeverApplyUrl', () => {
  it('leaves non-Lever URLs unchanged', () => {
    expect(getLeverApplyUrl('https://jobs.example.com/example/abc123')).toBe(
      'https://jobs.example.com/example/abc123',
    );
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
