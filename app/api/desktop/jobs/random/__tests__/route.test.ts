// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  jobLeadFindMany: vi.fn(),
  jobListingCount: vi.fn(),
  jobListingFindFirst: vi.fn(),
  validateToken: vi.fn(),
}));

vi.mock('@/lib/desktop-tokens', () => ({
  validateToken: mocks.validateToken,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    jobLead: {
      findMany: mocks.jobLeadFindMany,
    },
    jobListing: {
      count: mocks.jobListingCount,
      findFirst: mocks.jobListingFindFirst,
    },
  },
}));

import { GET } from '../route';

describe('desktop random job route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();

    mocks.validateToken.mockResolvedValue({
      ok: true,
      token: { id: 'token-1', userId: 'user-1' },
    });
    mocks.jobLeadFindMany.mockResolvedValue([]);
  });

  it('picks a uniform-random listing using count + skip', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    mocks.jobListingCount.mockResolvedValue(20);
    mocks.jobListingFindFirst.mockResolvedValue({
      company: 'Tiny Co',
      id: 'listing-1',
      jobProviderUrl: 'https://job-boards.greenhouse.io/tiny/jobs/1',
      lead: { id: 'lead-1' },
      location: 'Remote',
      source: 'Greenhouse',
      title: 'Software Engineer',
    });

    const response = await GET(
      createRequest('https://app.test/api/desktop/jobs/random'),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      applicationUrl: 'https://job-boards.greenhouse.io/tiny/jobs/1',
      company: 'Tiny Co',
    });
    expect(mocks.jobListingCount).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
    expect(mocks.jobListingFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        where: expect.objectContaining({ userId: 'user-1' }),
      }),
    );
  });

  it('returns 404 when no listings match', async () => {
    mocks.jobListingCount.mockResolvedValue(0);

    const response = await GET(
      createRequest('https://app.test/api/desktop/jobs/random'),
    );

    expect(response.status).toBe(404);
    expect(mocks.jobListingFindFirst).not.toHaveBeenCalled();
  });

  it('forwards excludeListingIds and excludeCompanies into the where clause', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mocks.jobListingCount.mockResolvedValue(1);
    mocks.jobListingFindFirst.mockResolvedValue({
      company: 'Other Co',
      id: 'listing-9',
      jobProviderUrl: 'https://job-boards.greenhouse.io/other/jobs/9',
      lead: null,
      location: 'Remote',
      source: 'Greenhouse',
      title: 'Software Engineer',
    });

    const response = await GET(
      createRequest(
        'https://app.test/api/desktop/jobs/random?excludeListingIds=a,b&excludeCompanies=Stripe,Coinbase',
      ),
    );

    expect(response.status).toBe(200);
    const countCall = mocks.jobListingCount.mock.calls[0]?.[0];
    expect(countCall?.where?.NOT).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: { in: ['a', 'b'] } }),
        expect.objectContaining({
          company: { in: ['Stripe', 'Coinbase'], mode: 'insensitive' },
        }),
      ]),
    );
  });

  it('honors provider=greenhouse on the default random route (canonical greenhouse.io URLs only)', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    mocks.jobListingCount.mockResolvedValue(1);
    mocks.jobListingFindFirst.mockResolvedValue({
      company: 'Greenhouse Co',
      id: 'listing-gh',
      jobProviderUrl: 'https://job-boards.greenhouse.io/example/jobs/123',
      lead: null,
      location: 'Remote',
      source: 'greenhouse',
      title: 'Staff Engineer',
    });

    const response = await GET(
      createRequest(
        'https://app.test/api/desktop/jobs/random?provider=greenhouse',
      ),
    );

    expect(response.status).toBe(200);
    const countCall = mocks.jobListingCount.mock.calls[0]?.[0];
    // The greenhouse filter must constrain to canonical greenhouse.io URLs
    // only — earlier behavior also accepted any URL containing `gh_jid=`,
    // which let company-domain wrappers like bishopfox.com/jobs?gh_jid=...
    // surface as Greenhouse picks even though those pages typically only
    // render the description (the actual form lives on greenhouse.io).
    expect(countCall?.where?.AND).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          jobProviderUrl: {
            contains: 'greenhouse.io',
            mode: 'insensitive',
          },
        }),
      ]),
    );
    // gh_jid substring matching must be gone — confirm the greenhouse
    // filter no longer includes it as an alternative.
    const greenhouseClause = (
      countCall?.where?.AND as Array<Record<string, unknown>>
    )?.find(
      condition =>
        typeof condition.jobProviderUrl === 'object' &&
        condition.jobProviderUrl !== null &&
        'contains' in (condition.jobProviderUrl as Record<string, unknown>) &&
        (condition.jobProviderUrl as { contains?: unknown }).contains ===
          'greenhouse.io',
    );
    expect(greenhouseClause).toBeDefined();
    expect(JSON.stringify(countCall?.where?.AND ?? {})).not.toContain('gh_jid');
    // Provider=greenhouse must NOT match on `source` or `jobProvider` —
    // those columns can be wrong (e.g. a dropbox.jobs row tagged
    // 'greenhouse' upstream) and the runtime gates on URL anyway.
    expect(JSON.stringify(countCall?.where ?? {})).not.toContain('"source"');
  });
});

function createRequest(url: string) {
  return new Request(url, {
    headers: {
      authorization: 'Bearer test-token',
    },
  });
}
