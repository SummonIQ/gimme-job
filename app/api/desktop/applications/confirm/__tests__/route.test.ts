// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applicationSubmissionFindUnique: vi.fn(),
  applyConfirmationToSubmission: vi.fn(),
  revalidateTag: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock('@/lib/desktop-tokens', () => ({
  validateToken: mocks.validateToken,
}));

vi.mock('@/lib/applications/confirmation-detector', () => ({
  applyConfirmationToSubmission: mocks.applyConfirmationToSubmission,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    applicationSubmission: {
      findUnique: mocks.applicationSubmissionFindUnique,
    },
  },
}));

import { POST } from '../route';

describe('desktop submission confirm route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.validateToken.mockResolvedValue({
      ok: true,
      token: { id: 'token-1', userId: 'user-1' },
    });
    mocks.applicationSubmissionFindUnique.mockResolvedValue({
      jobLeadId: 'lead-1',
      userId: 'user-1',
    });
  });

  function createRequest(body: Record<string, unknown>) {
    return new Request('https://app.test/api/desktop/applications/confirm', {
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
      new Request('https://app.test/api/desktop/applications/confirm', {
        body: JSON.stringify({}),
        method: 'POST',
      }),
    );
    expect(response.status).toBe(401);
  });

  it('returns 404 when the submission belongs to a different user', async () => {
    mocks.applicationSubmissionFindUnique.mockResolvedValue({
      jobLeadId: 'lead-1',
      userId: 'someone-else',
    });

    const response = await POST(
      createRequest({
        pageHtml: '<html>Application submitted</html>',
        submissionId: 'submission-1',
      }),
    );
    expect(response.status).toBe(404);
  });

  it('records confirmation when detection fires and revalidates lead tag', async () => {
    mocks.applyConfirmationToSubmission.mockResolvedValue({
      detected: {
        confidence: 0.95,
        family: 'greenhouse',
        matchedPhrase: 'application has been submitted',
        reason: 'greenhouse-canonical',
        variant: 'canonical-banner',
      },
      previousState: 'PENDING',
      transitioned: true,
    });

    const response = await POST(
      createRequest({
        hostname: 'job-boards.greenhouse.io',
        pageHtml:
          '<html><body>Your application has been submitted to Fixture Co.</body></html>',
        submissionId: 'submission-1',
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.transitioned).toBe(true);
    expect((payload.detected as Record<string, unknown>).family).toBe(
      'greenhouse',
    );
    expect(mocks.applyConfirmationToSubmission).toHaveBeenCalledWith(
      expect.objectContaining({
        family: 'greenhouse',
        hostname: 'job-boards.greenhouse.io',
        submissionId: 'submission-1',
      }),
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      'job-lead:lead-1',
      'max',
    );
  });

  it('returns transitioned=false without revalidating when nothing matches', async () => {
    mocks.applyConfirmationToSubmission.mockResolvedValue({
      detected: null,
      previousState: 'PENDING',
      transitioned: false,
    });

    const response = await POST(
      createRequest({
        pageHtml: '<html>Loading…</html>',
        submissionId: 'submission-1',
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.transitioned).toBe(false);
    expect(payload.detected).toBeNull();
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });
});
