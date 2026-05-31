// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  jobLeadFindUnique: vi.fn(),
  tailorResumeForLead: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('@/lib/desktop-tokens', () => ({
  validateToken: mocks.validateToken,
}));

vi.mock('@/lib/resumes/tailor-for-lead', () => ({
  tailorResumeForLead: mocks.tailorResumeForLead,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    jobLead: {
      findUnique: mocks.jobLeadFindUnique,
    },
  },
}));

import { POST } from '../route';

describe('desktop resume tailor route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.validateToken.mockResolvedValue({
      ok: true,
      token: { id: 'token-1', userId: 'user-1' },
    });
    mocks.jobLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      userId: 'user-1',
    });
  });

  function createRequest(body: Record<string, unknown>) {
    return new Request('https://app.test/api/desktop/resumes/tailor', {
      body: JSON.stringify(body),
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      method: 'POST',
    });
  }

  it('returns 401 when the bearer token is missing', async () => {
    const response = await POST(
      new Request('https://app.test/api/desktop/resumes/tailor', {
        body: JSON.stringify({ leadId: 'lead-1' }),
        method: 'POST',
      }),
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when leadId is missing', async () => {
    const response = await POST(createRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 404 when the lead belongs to a different user', async () => {
    mocks.jobLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      userId: 'someone-else',
    });

    const response = await POST(createRequest({ leadId: 'lead-1' }));
    expect(response.status).toBe(404);
  });

  it('returns the tailored revision summary on success', async () => {
    mocks.tailorResumeForLead.mockResolvedValue({
      diffSummary: { added: 3, removed: 1 },
      emphasizedKeywords: ['typescript', 'aws'],
      formats: {
        docx: 'https://blob/docx',
        html: 'https://blob/html',
        pdf: 'https://blob/pdf',
        txt: 'https://blob/txt',
      },
      revisionId: 'rev-1',
      summary: 'Tailored for the role',
    });

    const response = await POST(createRequest({ leadId: 'lead-1' }));
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.revisionId).toBe('rev-1');
    expect(payload.summary).toBe('Tailored for the role');
    expect((payload.formats as Record<string, string>).pdf).toBe(
      'https://blob/pdf',
    );
    expect(mocks.tailorResumeForLead).toHaveBeenCalledWith('lead-1');
  });

  it('returns 500 when tailoring throws', async () => {
    mocks.tailorResumeForLead.mockRejectedValue(new Error('LLM down'));

    const response = await POST(createRequest({ leadId: 'lead-1' }));
    expect(response.status).toBe(500);
  });
});
