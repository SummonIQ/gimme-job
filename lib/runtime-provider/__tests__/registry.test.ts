import { describe, expect, it } from 'vitest';

import { getRuntimeProviderForUrl } from '../registry';

describe('getRuntimeProviderForUrl', () => {
  it.each([
    ['https://job-boards.greenhouse.io/example/jobs/123', 'greenhouse', 'production'],
    ['https://www.coinbase.com/careers/positions/123?gh_jid=123', 'greenhouse', 'production'],
    ['https://jobs.ashbyhq.com/example/application', 'ashby', 'production'],
    ['https://jobs.lever.co/example/abc123/apply', 'lever', 'production'],
    ['https://apply.workable.com/example/j/ABC123', 'workable', 'production'],
    [
      'https://jobs.smartrecruiters.com/example/123',
      'smartrecruiters',
      'production',
    ],
    [
      'https://apply.recruitee.com/o/backend-engineer',
      'recruitee',
      'production',
    ],
    ['https://example.teamtailor.com/jobs/123', 'teamtailor', 'production'],
    ['https://jobs.jobvite.com/example/job/abc', 'jobvite', 'production'],
    ['https://example.bamboohr.com/careers/123', 'bamboohr', 'production'],
    ['https://jobs.personio.com/company/job/123', 'personio', 'production'],
    ['https://company.breezy.hr/p/abc', 'breezy', 'production'],
    ['https://company.wd5.myworkdayjobs.com/jobs/job/123', 'workday', 'manual_review'],
    ['https://jobs.example.icims.com/jobs/123', 'icims', 'beta'],
    ['https://example.taleo.net/careersection/jobdetail.ftl', 'taleo', 'beta'],
  ])('maps %s to %s readiness %s', (url, id, readiness) => {
    expect(getRuntimeProviderForUrl(url)).toMatchObject({ id, readiness });
  });

  it('returns unsupported for unknown hosts', () => {
    expect(getRuntimeProviderForUrl('https://example.com/jobs/123')).toMatchObject({
      id: 'unsupported',
      readiness: 'unsupported',
      runner: null,
    });
  });
});
