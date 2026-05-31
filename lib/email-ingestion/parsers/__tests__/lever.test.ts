import { describe, expect, it } from 'vitest';
import { parseLeverConfirmation } from '../lever';
import type { EmailMessage } from '../types';

function msg(partial: Partial<EmailMessage>): EmailMessage {
  return {
    body: 'default',
    from: 'test@example.com',
    receivedAt: new Date('2026-04-22T12:00:00Z'),
    subject: 'default',
    to: 'me@mydomain.com',
    uid: '1',
    ...partial,
  };
}

describe('parseLeverConfirmation', () => {
  it('returns null when the sender is unrelated', () => {
    const result = parseLeverConfirmation(
      msg({
        body: 'marketing blast',
        from: 'news@unrelated.com',
        subject: 'update',
      }),
    );
    expect(result).toBeNull();
  });

  it('parses a typical Lever "Application received" subject', () => {
    const result = parseLeverConfirmation(
      msg({
        body:
          "We've received your application. Thanks for applying! " +
          'https://jobs.lever.co/company/12345',
        from: 'no-reply@hire.lever.co',
        subject: 'Application received: Senior Backend Engineer at Fixture Co',
      }),
    );
    expect(result?.family).toBe('lever');
    expect(result?.role).toBe('Senior Backend Engineer');
    expect(result?.company).toBe('Fixture Co');
    expect(result?.dashboardUrl).toBe('https://jobs.lever.co/company/12345');
  });

  it('falls back to body pattern when subject is generic', () => {
    const result = parseLeverConfirmation(
      msg({
        body:
          'Your application for the Staff Engineer role at Fixture Co has been received. ' +
          'Thanks for applying!',
        from: 'noreply@hire.lever.co',
        subject: 'Thanks for applying',
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.role).toMatch(/Staff Engineer/);
    expect(result?.company).toBe('Fixture Co');
  });

  it('does not match when body has no confirmation phrase', () => {
    const result = parseLeverConfirmation(
      msg({
        body:
          'Just checking in about a future role, no application status here.',
        from: 'no-reply@hire.lever.co',
        subject: 'Application received',
      }),
    );
    expect(result).toBeNull();
  });

  it('captures the Lever job-board URL when present', () => {
    const result = parseLeverConfirmation(
      msg({
        body:
          "We've received your application. https://jobs.lever.co/fixture/abc-123/apply",
        from: 'no-reply@hire.lever.co',
        subject: 'Application received: Designer at Fixture Co',
      }),
    );
    expect(result?.dashboardUrl).toBe(
      'https://jobs.lever.co/fixture/abc-123/apply',
    );
  });
});
