import { describe, expect, it } from 'vitest';

import { detectConfirmation } from '../confirmation-detector';

describe('detectConfirmation', () => {
  it.each([
    [
      'lever',
      'https://jobs.lever.co/acme/abc123/apply',
      '<main><h1>Thanks for applying!</h1></main>',
    ],
    [
      'ashby',
      'https://jobs.ashbyhq.com/acme/abc123',
      '<main><h1>Application Received</h1></main>',
    ],
    [
      'smartrecruiters',
      'https://jobs.smartrecruiters.com/acme/123',
      '<main><h1>Successfully applied</h1></main>',
    ],
    [
      'workable',
      'https://apply.workable.com/acme/j/ABC123',
      '<main><h1>Application sent successfully</h1></main>',
    ],
  ])('confirms %s post-submit pages', (_provider, url, html) => {
    expect(detectConfirmation(url, html)).toMatchObject({
      confirmed: true,
    });
  });

  it.each([
    [
      'lever',
      'https://jobs.lever.co/acme/abc123/apply',
      '<main><h1>Software Engineer</h1><form><button>Submit application</button></form></main>',
    ],
    [
      'ashby',
      'https://jobs.ashbyhq.com/acme/abc123',
      '<main><h1>Software Engineer</h1><form><button>Submit Application</button></form></main>',
    ],
    [
      'smartrecruiters',
      'https://jobs.smartrecruiters.com/acme/123',
      '<main><h1>Software Engineer</h1><form><button>Apply now</button></form></main>',
    ],
    [
      'workable',
      'https://apply.workable.com/acme/j/ABC123',
      '<main><h1>Software Engineer</h1><form><button>Apply</button></form></main>',
    ],
  ])('does not confirm %s open application pages', (_provider, url, html) => {
    expect(detectConfirmation(url, html)).toEqual({ confirmed: false });
  });
});
