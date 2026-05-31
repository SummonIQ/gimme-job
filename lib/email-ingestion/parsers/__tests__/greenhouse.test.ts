import { describe, expect, it } from 'vitest';
import { parseGreenhouseConfirmation } from '../greenhouse';
import type { EmailMessage } from '../types';

function msg(partial: Partial<EmailMessage>): EmailMessage {
  return {
    body: 'default body',
    from: 'test@example.com',
    receivedAt: new Date('2026-04-22T12:00:00Z'),
    subject: 'default subject',
    to: 'applications@mydomain.com',
    uid: '1',
    ...partial,
  };
}

describe('parseGreenhouseConfirmation', () => {
  it('returns null for unrelated email', () => {
    const result = parseGreenhouseConfirmation(
      msg({
        body: 'Totally unrelated newsletter content.',
        from: 'newsletter@someblog.com',
        subject: 'Weekly digest',
      }),
    );
    expect(result).toBeNull();
  });

  it('parses a standard Greenhouse confirmation subject', () => {
    const result = parseGreenhouseConfirmation(
      msg({
        body:
          'Thanks for applying to Senior Software Engineer at Fixture Co. ' +
          'We will be in touch. Powered by Greenhouse.',
        from: 'no-reply@greenhouse.io',
        subject: 'Thank you for applying to Senior Software Engineer at Fixture Co',
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.family).toBe('greenhouse');
    expect(result?.role).toBe('Senior Software Engineer');
    expect(result?.company).toBe('Fixture Co');
  });

  it('falls back to body extraction when subject is non-standard', () => {
    const result = parseGreenhouseConfirmation(
      msg({
        body:
          'Hi, thanks for applying to the Staff Platform Engineer position at ' +
          'Fixture Co. Track your application on greenhouse.io.',
        from: 'team@greenhouse-mail.io',
        subject: 'Your application',
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.role).toBe('Staff Platform Engineer');
    expect(result?.company).toBe('Fixture Co');
  });

  it('captures a dashboard URL when present', () => {
    const result = parseGreenhouseConfirmation(
      msg({
        body:
          'Thanks for applying. Track it here: https://app.greenhouse.io/me/apps/abc123',
        from: 'no-reply@greenhouse.io',
        subject: 'Thanks for applying to Designer at Acme',
      }),
    );
    expect(result?.dashboardUrl).toBe(
      'https://app.greenhouse.io/me/apps/abc123',
    );
  });

  it('does not match a sales email that merely mentions Greenhouse', () => {
    const result = parseGreenhouseConfirmation(
      msg({
        body: 'Integrate with Greenhouse via our API.',
        from: 'sales@some-vendor.com',
        subject: 'Partnership opportunity',
      }),
    );
    expect(result).toBeNull();
  });

  it('does not match a job-description snippet that echoes "application submitted"', () => {
    const result = parseGreenhouseConfirmation(
      msg({
        body:
          'The role involves reviewing submissions. "Application submitted" ' +
          'events will flow through our pipeline.',
        from: 'recruiting@someco.com',
        subject: 'Engineering Manager role',
      }),
    );
    expect(result).toBeNull();
  });
});
