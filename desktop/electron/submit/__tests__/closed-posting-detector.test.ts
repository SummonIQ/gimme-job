import { describe, expect, it } from 'vitest';

import { detectClosedPosting } from '../closed-posting-detector';

describe('detectClosedPosting', () => {
  it.each([
    [
      'lever',
      'https://jobs.lever.co/acme/abc123',
      'This job posting is no longer active.',
    ],
    [
      'ashby',
      'https://jobs.ashbyhq.com/acme/abc123',
      'This role is no longer accepting applications.',
    ],
    [
      'smartrecruiters',
      'https://jobs.smartrecruiters.com/acme/123',
      'This posting is no longer active.',
    ],
    [
      'workable',
      'https://apply.workable.com/acme/j/ABC123',
      'This job posting is no longer available.',
    ],
    [
      'recruitee',
      'https://apply.recruitee.com/o/backend-engineer',
      'This offer has been archived.',
    ],
    [
      'teamtailor',
      'https://example.teamtailor.com/jobs/123',
      'This job opening is no longer available.',
    ],
    [
      'jobvite',
      'https://jobs.jobvite.com/acme/job/abc',
      'This requisition is no longer accepting applications.',
    ],
    [
      'bamboohr',
      'https://example.bamboohr.com/careers/123',
      'This opening is no longer available.',
    ],
    [
      'personio',
      'https://jobs.personio.com/acme/job/123',
      'This job ad is no longer online.',
    ],
    [
      'breezy',
      'https://company.breezy.hr/p/abc',
      'This opening is no longer available.',
    ],
  ])('flags %s closed-posting copy', (_provider, url, phrase) => {
    const verdict = detectClosedPosting({
      html: `<main><h1>${phrase}</h1></main>`,
      title: 'Job unavailable',
      url,
    });

    expect(verdict.closed).toBe(true);
    expect(verdict.reason).toBe('closed_posting_copy');
    expect(verdict.detectedPhrase).toBe(
      phrase.toLowerCase().replace(/\.$/, ''),
    );
  });

  it.each([
    ['lever', 'https://jobs.lever.co/acme/abc123'],
    ['ashby', 'https://jobs.ashbyhq.com/acme/abc123'],
    ['smartrecruiters', 'https://jobs.smartrecruiters.com/acme/123'],
    ['workable', 'https://apply.workable.com/acme/j/ABC123'],
    ['recruitee', 'https://apply.recruitee.com/o/backend-engineer'],
    ['teamtailor', 'https://example.teamtailor.com/jobs/123'],
    ['jobvite', 'https://jobs.jobvite.com/acme/job/abc'],
    ['bamboohr', 'https://example.bamboohr.com/careers/123'],
    ['personio', 'https://jobs.personio.com/acme/job/123'],
    ['breezy', 'https://company.breezy.hr/p/abc'],
  ])('does not flag %s open application pages', (_provider, url) => {
    expect(
      detectClosedPosting({
        html: '<main><h1>Software Engineer</h1><form><button type="submit">Apply now</button></form></main>',
        title: 'Software Engineer',
        url,
      }),
    ).toEqual({ closed: false, detectedPhrase: null, reason: null });
  });

  it('returns closed=false on a normal application page', () => {
    expect(
      detectClosedPosting({
        html: '<html><body><form id="application_form">…</form></body></html>',
        title: 'Apply for Senior Engineer at Example Co — Greenhouse',
      }),
    ).toEqual({ closed: false, detectedPhrase: null, reason: null });
  });

  it('flags the canonical Greenhouse closed-posting phrase', () => {
    const verdict = detectClosedPosting({
      html: '<div>This position is no longer accepting applications.</div>',
      title: 'Greenhouse',
    });
    expect(verdict.closed).toBe(true);
    expect(verdict.reason).toBe('closed_posting_copy');
    expect(verdict.detectedPhrase).toBe(
      'this position is no longer accepting applications',
    );
  });

  it('flags filled-position copy', () => {
    const verdict = detectClosedPosting({
      html: '<p>This position has been filled. Thanks for your interest.</p>',
      title: 'Senior Engineer',
    });
    expect(verdict.closed).toBe(true);
    expect(verdict.reason).toBe('closed_posting_copy');
  });

  it('flags the Greenhouse no-longer-open page copy', () => {
    const verdict = detectClosedPosting({
      html: '<main>The job you are looking for is no longer open.</main>',
      title: 'Greenhouse',
    });
    expect(verdict.closed).toBe(true);
    expect(verdict.reason).toBe('closed_posting_copy');
    expect(verdict.detectedPhrase).toBe(
      'the job you are looking for is no longer open',
    );
  });

  it('flags 404 markers in the title', () => {
    const verdict = detectClosedPosting({
      html: '<h1>Sorry, we lost it.</h1>',
      title: '404 Not Found',
    });
    expect(verdict.closed).toBe(true);
    expect(verdict.reason).toBe('http_404');
  });

  it('is case-insensitive', () => {
    const verdict = detectClosedPosting({
      html: '<div>THIS JOB IS NO LONGER AVAILABLE</div>',
      title: 'Example Co',
    });
    expect(verdict.closed).toBe(true);
    expect(verdict.reason).toBe('closed_posting_copy');
  });

  it('does not false-positive when the phrase appears inside the JD body', () => {
    // Plausible JD copy that mentions accepting applications without being
    // the closed-posting banner. We only flag the canonical phrasings.
    const verdict = detectClosedPosting({
      html: '<div>We are accepting applications on a rolling basis.</div>',
      title: 'Apply',
    });
    expect(verdict.closed).toBe(false);
  });
});
