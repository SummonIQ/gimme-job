// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  applicationSubmissionCreate: vi.fn(),
  applicationSubmissionFindFirst: vi.fn(),
  applicationSubmissionUpdate: vi.fn(),
  blobPut: vi.fn(),
  jobLeadCreate: vi.fn(),
  jobLeadFindFirst: vi.fn(),
  jobLeadUpdate: vi.fn(),
  jobListingFindFirst: vi.fn(),
  jobListingUpdate: vi.fn(),
  jobListingUpsert: vi.fn(),
  revalidateTag: vi.fn(),
  userFindUnique: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidateTag: mocks.revalidateTag,
}));

vi.mock('@vercel/blob', () => ({
  put: mocks.blobPut,
}));

vi.mock('@/lib/desktop-tokens', () => ({
  validateToken: mocks.validateToken,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    applicationSubmission: {
      create: mocks.applicationSubmissionCreate,
      findFirst: mocks.applicationSubmissionFindFirst,
      update: mocks.applicationSubmissionUpdate,
    },
    jobLead: {
      create: mocks.jobLeadCreate,
      findFirst: mocks.jobLeadFindFirst,
      update: mocks.jobLeadUpdate,
    },
    jobListing: {
      findFirst: mocks.jobListingFindFirst,
      update: mocks.jobListingUpdate,
      upsert: mocks.jobListingUpsert,
    },
    user: {
      findUnique: mocks.userFindUnique,
    },
  },
}));

import { GET, POST } from '../route';

describe('desktop submitted application route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.validateToken.mockResolvedValue({
      ok: true,
      token: { id: 'token-1', userId: 'user-1' },
    });
    mocks.userFindUnique.mockResolvedValue({ defaultResumeId: 'resume-1' });
    mocks.jobLeadFindFirst.mockResolvedValue(null);
    mocks.jobListingFindFirst.mockResolvedValue(null);
    mocks.jobListingUpsert.mockResolvedValue({
      id: 'listing-1',
      lead: null,
      title: 'Fixture Co application',
    });
    mocks.jobLeadCreate.mockResolvedValue({
      id: 'lead-1',
      jobListingId: 'listing-1',
    });
    mocks.applicationSubmissionFindFirst.mockResolvedValue(null);
    mocks.applicationSubmissionCreate.mockResolvedValue({ id: 'submission-1' });
    mocks.applicationSubmissionUpdate.mockResolvedValue({ id: 'submission-1' });
    mocks.blobPut.mockImplementation(async (pathname: string) => ({
      contentDisposition: 'inline',
      contentType: pathname.endsWith('.png') ? 'image/png' : 'text/html',
      downloadUrl: `https://blob.test/${pathname}?download=1`,
      etag: 'etag-1',
      pathname,
      url: `https://blob.test/${pathname}`,
    }));
    mocks.jobLeadUpdate.mockResolvedValue({});
    mocks.jobListingUpdate.mockResolvedValue({});
  });

  it('creates an applied lead when a desktop submission has no existing lead', async () => {
    const response = await POST(
      createRequest({
        applicationUrl: 'https://job-boards.greenhouse.io/fixtureco/jobs/123',
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobLeadId: 'lead-1',
      outcome: 'applied',
      submissionId: 'submission-1',
    });

    expect(mocks.jobListingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          company: 'Fixtureco',
          jobProvider: 'GREENHOUSE',
          jobProviderUrl:
            'https://job-boards.greenhouse.io/fixtureco/jobs/123',
          source: 'Desktop App',
          status: 'ADDED_TO_LEADS',
          title: 'Fixtureco application',
          userId: 'user-1',
        }),
      }),
    );
    expect(mocks.jobLeadCreate).toHaveBeenCalledWith({
      data: {
        jobListingId: 'listing-1',
        status: 'ADDED',
        title: 'Fixture Co application',
        userId: 'user-1',
      },
      select: { id: true, jobListingId: true },
    });
    expect(mocks.jobLeadUpdate).toHaveBeenCalledWith({
      data: { status: 'APPLIED' },
      where: { id: 'lead-1' },
    });
    expect(mocks.applicationSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          jobLeadId: 'lead-1',
          resumeId: 'resume-1',
          status: 'SUBMITTED',
          submissionUrl: 'https://job-boards.greenhouse.io/fixtureco/jobs/123',
          userId: 'user-1',
          wasAutomated: true,
        }),
      }),
    );
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      'user:user-1:report:job-leads:applied',
      'max',
    );
  });

  it('reports an existing submission before the desktop clicks submit again', async () => {
    mocks.jobLeadFindFirst.mockResolvedValueOnce({
      applicationSubmissions: [
        {
          id: 'submission-1',
          status: 'SUBMITTED',
          submittedAt: new Date('2026-05-05T12:00:00.000Z'),
        },
      ],
      id: 'lead-1',
      status: 'APPLIED',
    });

    const response = await GET(
      new Request(
        'https://app.test/api/desktop/applications/submitted?applicationUrl=https%3A%2F%2Fjob-boards.greenhouse.io%2Ffixtureco%2Fjobs%2F123&jobLeadId=lead-1',
        {
          headers: { authorization: 'Bearer desktop-token' },
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      alreadySubmitted: true,
      jobLeadId: 'lead-1',
      reason: 'existing_submission',
      status: 'SUBMITTED',
      submissionId: 'submission-1',
      submittedAt: '2026-05-05T12:00:00.000Z',
    });
    expect(mocks.applicationSubmissionCreate).not.toHaveBeenCalled();
    expect(mocks.jobLeadCreate).not.toHaveBeenCalled();
  });

  it('tracks a training run as a lead without creating a submission', async () => {
    const response = await POST(
      createRequest(
        {
          applicationUrl: 'https://job-boards.greenhouse.io/fixtureco/jobs/123',
        },
        { mode: 'training', status: 'completed' },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobLeadId: 'lead-1',
      outcome: 'tracked',
      submissionId: null,
    });

    expect(mocks.jobLeadCreate).toHaveBeenCalledWith({
      data: {
        jobListingId: 'listing-1',
        status: 'ADDED',
        title: 'Fixture Co application',
        userId: 'user-1',
      },
      select: { id: true, jobListingId: true },
    });
    expect(mocks.jobLeadUpdate).not.toHaveBeenCalled();
    expect(mocks.applicationSubmissionCreate).not.toHaveBeenCalled();
  });

  it('tracks a paused submit run as a lead without creating a submission', async () => {
    const response = await POST(
      createRequest(
        {
          applicationUrl: 'https://job-boards.greenhouse.io/fixtureco/jobs/123',
        },
        { mode: 'submit', status: 'paused_for_manual_review' },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobLeadId: 'lead-1',
      outcome: 'tracked',
      submissionId: null,
    });

    expect(mocks.applicationSubmissionCreate).not.toHaveBeenCalled();
    expect(mocks.jobLeadUpdate).not.toHaveBeenCalled();
  });

  it('persists structured validation failures on tracked failed submissions', async () => {
    const response = await POST(
      createRequest(
        {
          applicationUrl: 'https://jobs.lever.co/fixtureco/123/apply',
          validationFailures: [
            {
              fieldLabel: 'Email',
              fieldSelector: 'input[name="email"]',
              message: 'Email is required.',
            },
          ],
        },
        { mode: 'submit', status: 'validation_failed' },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobLeadId: 'lead-1',
      outcome: 'tracked',
      submissionId: 'submission-1',
    });
    expect(mocks.applicationSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failureReason: 'validation_failed',
          metadata: expect.objectContaining({
            desktop: expect.objectContaining({
              validationFailures: [
                {
                  fieldLabel: 'Email',
                  fieldSelector: 'input[name="email"]',
                  message: 'Email is required.',
                },
              ],
            }),
          }),
          status: 'FAILED',
        }),
      }),
    );
  });

  it('skips a failed run without touching the database', async () => {
    const response = await POST(
      createRequest(
        {
          applicationUrl: 'https://job-boards.greenhouse.io/fixtureco/jobs/123',
        },
        { mode: 'submit', status: 'failed' },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobLeadId: null,
      outcome: 'skipped',
      submissionId: null,
    });

    expect(mocks.jobListingUpsert).not.toHaveBeenCalled();
    expect(mocks.jobLeadCreate).not.toHaveBeenCalled();
    expect(mocks.applicationSubmissionCreate).not.toHaveBeenCalled();
    expect(mocks.jobLeadUpdate).not.toHaveBeenCalled();
  });

  it('creates a failed submission and stores artifacts for a failed run with a snapshot', async () => {
    const response = await POST(
      createRequest(
        {
          applicationUrl: 'https://job-boards.greenhouse.io/fixtureco/jobs/123',
          failureSnapshot: {
            capturedAt: '2026-05-08T15:01:00.000Z',
            domHtml:
              '<html><body><input name="email" value="steven@example.com"><input type="hidden" name="csrf" value="secret"></body></html>',
            screenshotPngBase64: Buffer.from('png-bytes').toString('base64'),
          },
        },
        { mode: 'submit', status: 'failed' },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      jobLeadId: 'lead-1',
      outcome: 'tracked',
      submissionId: 'submission-1',
    });
    expect(mocks.applicationSubmissionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          failureReason: 'failed',
          status: 'FAILED',
        }),
      }),
    );
    expect(mocks.blobPut).toHaveBeenCalledWith(
      'desktop-failure-snapshots/submission-1/screenshot.png',
      expect.any(Buffer),
      expect.objectContaining({ access: 'private', contentType: 'image/png' }),
    );
    expect(mocks.blobPut).toHaveBeenCalledWith(
      'desktop-failure-snapshots/submission-1/dom.html',
      expect.stringContaining('[EMAIL]'),
      expect.objectContaining({
        access: 'private',
        contentType: 'text/html; charset=utf-8',
      }),
    );
    const domUpload = mocks.blobPut.mock.calls.find(
      call => call[0] === 'desktop-failure-snapshots/submission-1/dom.html',
    );
    expect(domUpload?.[1]).not.toContain('steven@example.com');
    expect(domUpload?.[1]).not.toContain('value="secret"');
    expect(mocks.applicationSubmissionUpdate).toHaveBeenCalledWith({
      data: {
        metadata: expect.objectContaining({
          desktop: expect.objectContaining({
            failureArtifacts: expect.objectContaining({
              domUrl:
                'https://blob.test/desktop-failure-snapshots/submission-1/dom.html',
              screenshotUrl:
                'https://blob.test/desktop-failure-snapshots/submission-1/screenshot.png',
            }),
          }),
        }),
      },
      where: { id: 'submission-1' },
    });
  });
});

function createRequest(
  body: {
    readonly applicationUrl: string;
    readonly failureSnapshot?: {
      readonly capturedAt?: string;
      readonly domHtml: string;
      readonly screenshotPngBase64: string;
    };
    readonly jobLeadId?: string;
    readonly validationFailures?: ReadonlyArray<{
      readonly fieldLabel: string;
      readonly fieldSelector: string;
      readonly message: string;
    }>;
  },
  options: {
    readonly mode?: 'submit' | 'training';
    readonly status?:
      | 'completed'
      | 'paused_for_manual_review'
      | 'blocked_by_submit_guard'
      | 'failed'
      | 'validation_failed';
  } = {},
) {
  return new Request(
    'http://localhost:10100/api/desktop/applications/submitted',
    {
      body: JSON.stringify({
        ...body,
        mode: options.mode ?? 'submit',
        status: options.status ?? 'completed',
      }),
      headers: {
        authorization: 'Bearer desktop-token',
        'content-type': 'application/json',
      },
      method: 'POST',
    },
  );
}
