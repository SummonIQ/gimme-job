import { describe, expect, it, vi } from 'vitest';

import { createMemoryTokenStore } from '../../auth/keychain-store';
import { createDesktopAgentChatClient } from '../client';

describe('createDesktopAgentChatClient', () => {
  it('posts messages with captured page context and bearer auth', async () => {
    const fetchImpl = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      Response.json({
        content: 'Phone was autofilled as expected.',
        mutations: [],
      }),
    );
    const client = createDesktopAgentChatClient({
      appUrl: 'http://localhost:10100/',
      collectContext: async () => ({
        capturedAt: '2026-04-28T00:00:00.000Z',
        fields: [
          {
            ariaLabel: null,
            autocomplete: null,
            checked: null,
            disabled: false,
            id: 'phone',
            inputType: 'tel',
            label: 'Phone',
            name: 'phone',
            options: [],
            placeholder: null,
            required: true,
            selector: 'input#phone',
            tagName: 'input',
            value: '555-0100',
            visible: true,
          },
        ],
        issues: [],
        lastSubmitResult: null,
        screenshotDataUrl: null,
        title: 'Application',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      }),
      fetchImpl,
      tokenStore: createMemoryTokenStore('desktop-token'),
    });

    await expect(
      client.sendMessage({
        allowTrainingWrite: false,
        messages: [{ content: 'Check phone', role: 'user' }],
      }),
    ).resolves.toMatchObject({ content: 'Phone was autofilled as expected.' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://localhost:10100/api/desktop/agent-chat',
      expect.objectContaining({
        headers: expect.objectContaining({
          authorization: 'Bearer desktop-token',
        }),
      }),
    );

    const [, init] = fetchImpl.mock.calls[0]!;
    expect(JSON.parse(String(init?.body))).toMatchObject({
      context: {
        fields: [{ selector: 'input#phone', value: '555-0100' }],
      },
      messages: [{ content: 'Check phone', role: 'user' }],
    });
  });

  it('fills and saves yes/no field corrections without calling the remote chat route', async () => {
    const fetchImpl = vi.fn();
    const addFieldRule = vi.fn();
    const fillAssistField = vi.fn(async () => ({ ok: true }));
    const client = createDesktopAgentChatClient({
      addFieldRule,
      appUrl: 'http://localhost:10100/',
      collectContext: async () => ({
        capturedAt: '2026-04-28T00:00:00.000Z',
        fields: [
          {
            ariaLabel: null,
            autocomplete: null,
            checked: null,
            disabled: false,
            id: 'question_5838113009',
            inputType: 'select',
            label: 'Are you over the age of 18?*',
            name: 'question_5838113009',
            options: [],
            placeholder: null,
            required: true,
            selector: 'input#question_5838113009',
            tagName: 'select',
            value: null,
            visible: true,
          },
        ],
        issues: [],
        lastSubmitResult: null,
        screenshotDataUrl: null,
        title: 'Application',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      }),
      fetchImpl,
      fillAssistField,
      tokenStore: createMemoryTokenStore('desktop-token'),
    });

    await expect(
      client.sendMessage({
        allowTrainingWrite: true,
        messages: [
          {
            content: 'are you over the age of 18 is yes',
            role: 'user',
          },
        ],
      }),
    ).resolves.toMatchObject({
      mutations: [
        {
          selector: 'input#question_5838113009',
          type: 'training_correction',
        },
      ],
    });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(fillAssistField).toHaveBeenCalledWith({
      kind: 'select',
      selector: 'input#question_5838113009',
      value: 'yes',
    });
    expect(addFieldRule).toHaveBeenCalledWith({
      answer: 'yes',
      hostname: 'job-boards.greenhouse.io',
      question: 'Are you over the age of 18?*',
    });
  });
});
