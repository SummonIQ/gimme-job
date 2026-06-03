import { describe, expect, it } from 'vitest';

import { isGreenhouseApplicationUrl } from '../greenhouse-url';

describe('isGreenhouseApplicationUrl', () => {
  describe('greenhouse.io-hosted URLs', () => {
    it('matches boards.greenhouse.io', () => {
      expect(
        isGreenhouseApplicationUrl(
          'https://boards.greenhouse.io/example/jobs/12345',
        ),
      ).toBe(true);
    });

    it('matches job-boards.greenhouse.io', () => {
      expect(
        isGreenhouseApplicationUrl(
          'https://job-boards.greenhouse.io/thetradedesk/jobs/5102422007',
        ),
      ).toBe(true);
    });

    it('is case-insensitive on hostname', () => {
      expect(
        isGreenhouseApplicationUrl('https://JOB-BOARDS.GREENHOUSE.IO/foo'),
      ).toBe(true);
    });
  });

  describe('gh_jid query / fragment params (P17.28)', () => {
    it('matches a coinbase.com posting with ?gh_jid=', () => {
      expect(
        isGreenhouseApplicationUrl(
          'https://www.coinbase.com/careers/positions/7670920?gh_jid=7670920',
        ),
      ).toBe(true);
    });

    it('matches a digitalocean.com posting with ?gh_jid=', () => {
      expect(
        isGreenhouseApplicationUrl(
          'https://www.digitalocean.com/careers/position/apply/?gh_jid=7307191',
        ),
      ).toBe(true);
    });

    it('matches when gh_jid is not the first query param', () => {
      expect(
        isGreenhouseApplicationUrl(
          'https://example.com/careers/123?utm_source=foo&gh_jid=999',
        ),
      ).toBe(true);
    });

    it('matches when gh_jid is in the fragment', () => {
      expect(
        isGreenhouseApplicationUrl('https://example.com/careers/123#gh_jid=999'),
      ).toBe(true);
    });

    it('is case-insensitive on the param name', () => {
      expect(
        isGreenhouseApplicationUrl('https://example.com/careers/123?GH_JID=42'),
      ).toBe(true);
    });
  });

  describe('rejects non-Greenhouse URLs', () => {
    it('does not match a generic apply URL', () => {
      expect(
        isGreenhouseApplicationUrl('https://example.com/jobs/apply'),
      ).toBe(false);
    });

    it('does not match an Ashby URL', () => {
      expect(
        isGreenhouseApplicationUrl(
          'https://jobs.ashbyhq.com/example/abcd-1234',
        ),
      ).toBe(false);
    });

    it('does not match a Lever URL', () => {
      expect(
        isGreenhouseApplicationUrl('https://jobs.lever.co/example/abc-123'),
      ).toBe(false);
    });

    it('does not match a path that contains the literal string gh_jid', () => {
      // Anchored on `?` `&` or `#` so a bare gh_jid in a path doesn't match.
      expect(
        isGreenhouseApplicationUrl('https://example.com/article/gh_jid-explained'),
      ).toBe(false);
    });

    it('does not match an empty string', () => {
      expect(isGreenhouseApplicationUrl('')).toBe(false);
    });

    it('does not match a non-string input', () => {
      // @ts-expect-error: intentional invalid input
      expect(isGreenhouseApplicationUrl(undefined)).toBe(false);
    });
  });
});
