// @vitest-environment node
import { describe, expect, it } from 'vitest';

import { detectClosedPosting } from '../closed-posting';

describe('detectClosedPosting (shared P17.5 detector)', () => {
  describe('cross-ATS phrasing', () => {
    it('flags Ashby "this job is no longer open"', () => {
      const verdict = detectClosedPosting({
        html: '<div>This job is no longer open.</div>',
        title: 'Ashby',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_copy');
      expect(verdict.detectedPhrase).toBe('this job is no longer open');
    });

    it('flags Lever "this posting has been filled"', () => {
      const verdict = detectClosedPosting({
        html: '<main>This posting has been filled.</main>',
        title: 'Lever',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_copy');
    });

    it('flags Workable "this job posting is no longer active"', () => {
      const verdict = detectClosedPosting({
        html: '<p>This job posting is no longer active.</p>',
        title: 'Workable',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_copy');
    });

    it('flags SmartRecruiters "this position is closed"', () => {
      const verdict = detectClosedPosting({
        html: '<section>This position is closed.</section>',
        title: 'SmartRecruiters',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_copy');
    });

    it('flags SmartRecruiters expired job banner copy', () => {
      const verdict = detectClosedPosting({
        html: '<main><button>Sorry, this job has expired</button></main>',
        title: 'Senior Backend Software Engineer | SmartRecruiters',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_copy');
      expect(verdict.detectedPhrase).toBe('sorry, this job has expired');
    });

    it.each([
      ['This opportunity has closed.', 'this opportunity has closed'],
      ['That vacancy was archived.', 'that vacancy was archived'],
      [
        'Applications are no longer being accepted.',
        'applications are no longer being accepted',
      ],
      ['The application window has ended.', 'application window has ended'],
    ])('classifies terminal posting copy: %s', (copy, expectedPhrase) => {
      const verdict = detectClosedPosting({
        html: `<main><h1>${copy}</h1></main>`,
        title: 'Job unavailable',
      });

      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_copy');
      expect(verdict.detectedPhrase).toBe(expectedPhrase);
    });

    it('flags Workday "requisition not found"', () => {
      const verdict = detectClosedPosting({
        html: '<h1>Requisition not found</h1>',
        title: 'Workday',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_copy');
    });
  });

  describe('http reason codes', () => {
    it('flags 404 markers in the title', () => {
      const verdict = detectClosedPosting({
        html: '<h1>Sorry.</h1>',
        title: '404 Not Found',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('http_404');
    });

    it('flags 410 gone phrasing', () => {
      const verdict = detectClosedPosting({
        html: '<h1>410 Gone</h1>',
        title: 'Gone',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('http_410');
    });
  });

  describe('DOM markers', () => {
    it('honors a [data-closed-posting] attribute', () => {
      const verdict = detectClosedPosting({
        html: '<div data-closed-posting>Sorry, this is gone.</div>',
        title: 'Example',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_marker');
    });

    it('honors data-state="closed"', () => {
      const verdict = detectClosedPosting({
        html: '<div data-state="closed">Closed.</div>',
        title: 'Example',
      });
      expect(verdict.closed).toBe(true);
      expect(verdict.reason).toBe('closed_posting_marker');
    });
  });

  describe('negative cases', () => {
    it('returns closed=false on a normal application page', () => {
      expect(
        detectClosedPosting({
          html: '<html><body><form id="application_form">…</form></body></html>',
          title: 'Apply for Senior Engineer at Example Co',
        }),
      ).toEqual({ closed: false, detectedPhrase: null, reason: null });
    });

    it('does not false-positive on JD copy that mentions accepting applications', () => {
      const verdict = detectClosedPosting({
        html: '<div>We are accepting applications on a rolling basis.</div>',
        title: 'Apply',
      });
      expect(verdict.closed).toBe(false);
    });

    it('does not false-positive on nearby non-terminal wording', () => {
      const verdict = detectClosedPosting({
        html: '<main><p>This role is closed-source adjacent and works on archived datasets.</p><form><button>Apply now</button></form></main>',
        title: 'Software Engineer',
      });
      expect(verdict.closed).toBe(false);
    });
  });
});
