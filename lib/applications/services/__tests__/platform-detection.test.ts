import { JobProvider } from '@/generated/prisma/browser';
import { classifyAtsFamily } from '@/lib/applications/services/platform-detection';

describe('classifyAtsFamily', () => {
  it('detects ATS families from direct apply URLs', () => {
    expect(
      classifyAtsFamily({
        url: 'https://boards.greenhouse.io/acme/jobs/123',
      }).family,
    ).toBe('greenhouse');
    expect(
      classifyAtsFamily({
        url: 'https://jobs.lever.co/acme/123',
      }).family,
    ).toBe('lever');
    expect(
      classifyAtsFamily({
        url: 'https://jobs.ashbyhq.com/acme/123',
      }).family,
    ).toBe('ashby');
  });

  it('uses first-party provider metadata when URLs are missing', () => {
    expect(
      classifyAtsFamily({
        jobProvider: JobProvider.SMART_RECRUITERS,
      }),
    ).toMatchObject({
      confidence: 100,
      family: 'smartrecruiters',
      posture: 'GRAY',
    });
  });

  it('returns a null family when no ATS signal is present', () => {
    expect(
      classifyAtsFamily({
        url: 'https://example.com/careers/software-engineer',
      }),
    ).toMatchObject({
      confidence: 0,
      family: null,
      posture: null,
    });
  });
});
