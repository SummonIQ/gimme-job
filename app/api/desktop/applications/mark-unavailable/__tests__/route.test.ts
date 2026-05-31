// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  automationAuditLogCreate: vi.fn(),
  jobLeadFindUnique: vi.fn(),
  jobLeadUpdate: vi.fn(),
  jobListingFindUnique: vi.fn(),
  jobListingUpdate: vi.fn(),
  revalidateTag: vi.fn(),
  transaction: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock('@/lib/desktop-tokens', () => ({
  validateToken: mocks.validateToken,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    $transaction: (handler: (tx: unknown) => unknown) =>
      mocks.transaction(handler),
    automationAuditLog: { create: mocks.automationAuditLogCreate },
    jobLead: {
      findUnique: mocks.jobLeadFindUnique,
      update: mocks.jobLeadUpdate,
    },
    jobListing: {
      findUnique: mocks.jobListingFindUnique,
      update: mocks.jobListingUpdate,
    },
  },
}));

import { POST } from '../route';

describe('desktop mark-unavailable route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.validateToken.mockResolvedValue({
      ok: true,
      token: { id: 'token-1', userId: 'user-1' },
    });
    mocks.transaction.mockImplementation(
      async (handler: (tx: unknown) => unknown) =>
        handler({
          automationAuditLog: { create: mocks.automationAuditLogCreate },
          jobLead: { update: mocks.jobLeadUpdate },
          jobListing: { update: mocks.jobListingUpdate },
        }),
    );
  });

  function createRequest(body: Record<string, unknown>) {
    return new Request(
      'https://app.test/api/desktop/applications/mark-unavailable',
      {
        body: JSON.stringify(body),
        headers: {
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    );
  }

  it('returns 401 when the bearer token is missing', async () => {
    const response = await POST(
      new Request(
        'https://app.test/api/desktop/applications/mark-unavailable',
        {
          body: JSON.stringify({ jobLeadId: 'lead-1', reason: 'http_404' }),
          method: 'POST',
        },
      ),
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 on a malformed body', async () => {
    const response = await POST(createRequest({}));
    expect(response.status).toBe(400);
  });

  it('returns 404 when the lead belongs to a different user', async () => {
    mocks.jobLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      status: 'ADDED',
      userId: 'someone-else',
    });
    const response = await POST(
      createRequest({ jobLeadId: 'lead-1', reason: 'closed_posting_copy' }),
    );
    expect(response.status).toBe(404);
    expect(mocks.jobLeadUpdate).not.toHaveBeenCalled();
  });

  it('is idempotent when the lead is already UNAVAILABLE', async () => {
    mocks.jobLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      status: 'UNAVAILABLE',
      userId: 'user-1',
    });
    const response = await POST(
      createRequest({ jobLeadId: 'lead-1', reason: 'closed_posting_copy' }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.transitioned).toBe(false);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it('dismisses a listing when only jobListingId is provided', async () => {
    mocks.jobListingFindUnique.mockResolvedValue({
      id: 'listing-1',
      status: 'UNREVIEWED',
      userId: 'user-1',
    });
    const response = await POST(
      createRequest({
        applicationUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
        detectedPhrase: 'the job you are looking for is no longer open',
        jobListingId: 'listing-1',
        reason: 'closed_posting_copy',
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.transitioned).toBe(true);
    expect(payload.previousListingStatus).toBe('UNREVIEWED');
    expect(payload.previousStatus).toBe('UNREVIEWED');
    expect(mocks.jobLeadFindUnique).not.toHaveBeenCalled();
    expect(mocks.jobListingUpdate).toHaveBeenCalledWith({
      data: { status: 'DISMISSED' },
      where: { id: 'listing-1' },
    });
    expect(mocks.automationAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'desktop_lead_marked_unavailable',
        actionType: 'success',
        metadata: expect.objectContaining({
          detectedPhrase: 'the job you are looking for is no longer open',
          jobLeadId: null,
          jobListingId: 'listing-1',
          previousListingStatus: 'UNREVIEWED',
          reason: 'closed_posting_copy',
        }),
        userId: 'user-1',
      }),
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      'user:user-1:job-listings:listing-1',
      'max',
    );
  });

  it('writes status + audit row + revalidates tags on a real transition', async () => {
    mocks.jobLeadFindUnique.mockResolvedValue({
      id: 'lead-1',
      status: 'ADDED',
      userId: 'user-1',
    });
    const response = await POST(
      createRequest({
        applicationUrl: 'https://boards.greenhouse.io/example/jobs/123',
        detectedPhrase: 'this position is no longer accepting applications',
        jobLeadId: 'lead-1',
        reason: 'closed_posting_copy',
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as Record<string, unknown>;
    expect(payload.transitioned).toBe(true);
    expect(payload.previousStatus).toBe('ADDED');
    expect(mocks.jobLeadUpdate).toHaveBeenCalledWith({
      data: { status: 'UNAVAILABLE' },
      where: { id: 'lead-1' },
    });
    expect(mocks.automationAuditLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'desktop_lead_marked_unavailable',
        actionType: 'success',
        metadata: expect.objectContaining({
          detectedPhrase: 'this position is no longer accepting applications',
          jobLeadId: 'lead-1',
          previousStatus: 'ADDED',
          reason: 'closed_posting_copy',
        }),
        userId: 'user-1',
      }),
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith('user-1:job-leads', 'max');
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      'user-1:job-leads:lead-1',
      'max',
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith('job-lead:lead-1', 'max');
  });
});
