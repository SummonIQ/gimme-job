// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationRuntimeSource } from '@/generated/prisma/client';

const mocks = vi.hoisted(() => ({
  embedFormFieldFeedback: vi.fn(),
  formFieldFeedbackCreate: vi.fn(),
  formFieldFeedbackFindFirst: vi.fn(),
  formFieldFeedbackUpdate: vi.fn(),
  generateText: vi.fn(),
  upsertRulePromotionCandidate: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('ai', () => ({
  generateText: mocks.generateText,
  stepCountIs: vi.fn((count: number) => ({ count })),
  tool: vi.fn(definition => definition),
}));

vi.mock('@/lib/ai/models', () => ({
  getModels: vi.fn(() => ({
    fast: 'test-model-fast',
    primary: 'test-model-primary',
    strong: 'test-model',
  })),
}));

vi.mock('@/lib/desktop-tokens', () => ({
  validateToken: mocks.validateToken,
}));

vi.mock('@/lib/ai/embeddings', () => ({
  embedFormFieldFeedback: mocks.embedFormFieldFeedback,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    formFieldFeedback: {
      create: mocks.formFieldFeedbackCreate,
      findFirst: mocks.formFieldFeedbackFindFirst,
      update: mocks.formFieldFeedbackUpdate,
    },
  },
}));

vi.mock('@/lib/runtime-learning', () => ({
  upsertRulePromotionCandidate: mocks.upsertRulePromotionCandidate,
}));

import { POST } from '@/app/api/desktop/agent-chat/route';

describe('desktop agent chat route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.validateToken.mockResolvedValue({
      ok: true,
      scopes: ['desktop:runtime'],
      token: { id: 'token-1', userId: 'user-1' },
    });
    mocks.generateText.mockResolvedValue({
      text: 'The required email field is empty.',
    });
    mocks.formFieldFeedbackFindFirst.mockResolvedValue(null);
    mocks.formFieldFeedbackCreate.mockResolvedValue({ id: 'feedback-1' });
    mocks.formFieldFeedbackUpdate.mockResolvedValue({ id: 'feedback-1' });
    mocks.embedFormFieldFeedback.mockResolvedValue(undefined);
  });

  it('requires a paired desktop bearer token', async () => {
    const response = await POST(createRequest({ token: null }));

    expect(response.status).toBe(401);
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it('passes current form context to the model', async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      content: 'The required email field is empty.',
      mutations: [],
    });
    expect(mocks.validateToken).toHaveBeenCalledWith('desktop-token', {
      requireScope: 'desktop:runtime',
    });
    expect(mocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'test-model-primary',
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('selector=input#email'),
            role: 'user',
          }),
        ]),
      }),
    );
  });

  it('falls back to text context when screenshot model input fails', async () => {
    mocks.generateText
      .mockRejectedValueOnce(new Error('vision input rejected'))
      .mockResolvedValueOnce({
        text: 'The email field is still empty.',
      });

    const response = await POST(
      createRequest({ screenshotDataUrl: 'data:image/png;base64,abc123' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      content: 'The email field is still empty.',
      mutations: [],
    });
    expect(mocks.generateText).toHaveBeenCalledTimes(2);
    expect(mocks.generateText).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                image: 'data:image/png;base64,abc123',
                type: 'image',
              }),
            ]),
            role: 'user',
          }),
        ]),
      }),
    );
    expect(mocks.generateText).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.stringContaining('selector=input#email'),
            role: 'user',
          }),
        ]),
      }),
    );
  });

  it('records a training correction when the model uses the gated tool', async () => {
    mocks.generateText.mockImplementation(async options => {
      await options.tools.recordTrainingCorrection.execute({
        expectedValue: 'steven@example.com',
        fieldLabel: 'Email',
        observedValue: '',
        reason: 'Email should use the profile email.',
        selector: 'input#email',
      });

      return { text: 'Recorded the email correction.' };
    });

    const response = await POST(createRequest({ allowTrainingWrite: true }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      content: 'Recorded the email correction.',
      mutations: [
        {
          message: 'Recorded correction for Email.',
          selector: 'input#email',
          type: 'training_correction',
        },
      ],
    });
    expect(mocks.upsertRulePromotionCandidate).toHaveBeenCalledWith({
      actionType: 'user_override',
      fieldLabel: 'Email',
      fieldName: null,
      hostname: 'job-boards.greenhouse.io',
      reason:
        'Desktop chat correction: Email should use the profile email. | Expected: steven@example.com',
      selector: 'input#email',
      source: ApplicationRuntimeSource.OWNER_OVERRIDE,
      success: false,
      userId: 'user-1',
    });
    expect(mocks.formFieldFeedbackCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fieldLabel: 'Email',
        filledValue: 'steven@example.com',
        hostname: 'job-boards.greenhouse.io',
        userId: 'user-1',
      }),
      select: { id: true },
    });
  });

  it('returns a 502 with provider+model context when the model call fails (P17.19)', async () => {
    mocks.generateText.mockRejectedValueOnce(new Error('Not Found'));

    const response = await POST(createRequest());

    expect(response.status).toBe(502);
    const body = (await response.json()) as { error?: string };
    // The opaque "Not Found" string is what was reaching users; the route
    // now prefixes it with [provider:model] so the next failure is
    // self-diagnosing.
    expect(body.error).toMatch(/openai:test-model-primary/);
    expect(body.error).toMatch(/Not Found/);
  });
});

function createRequest(
  input: {
    readonly allowTrainingWrite?: boolean;
    readonly screenshotDataUrl?: string | null;
    readonly token?: string | null;
  } = {},
) {
  const token = input.token === undefined ? 'desktop-token' : input.token;
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };

  if (token) {
    headers.authorization = `Bearer ${token}`;
  }

  return new Request('http://localhost:10100/api/desktop/agent-chat', {
    body: JSON.stringify({
      allowTrainingWrite: input.allowTrainingWrite ?? false,
      context: {
        capturedAt: '2026-04-28T00:00:00.000Z',
        fields: [
          {
            disabled: false,
            inputType: 'email',
            label: 'Email',
            required: true,
            selector: 'input#email',
            tagName: 'input',
            value: null,
            visible: true,
          },
        ],
        issues: [
          {
            fieldSelector: 'input#email',
            message: 'Email is required and currently empty.',
            severity: 'warning',
          },
        ],
        lastSubmitResult: null,
        screenshotDataUrl: input.screenshotDataUrl ?? null,
        title: 'Application',
        url: 'https://job-boards.greenhouse.io/example/jobs/123',
      },
      messages: [{ content: 'What went wrong?', role: 'user' }],
    }),
    headers,
    method: 'POST',
  });
}
