import { describe, expect, it } from 'vitest';
import { parseAshbyConfirmation } from '../ashby';
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

describe('parseAshbyConfirmation', () => {
  it('parses the Ashby "Application received" subject', () => {
    const result = parseAshbyConfirmation(
      msg({
        body:
          'Application received. Thanks for applying to Fixture Co. ' +
          'https://jobs.ashbyhq.com/fixture/abc-123',
        from: 'no-reply@ashbyhq.com',
        subject: 'Application received: Frontend Engineer at Fixture Co',
      }),
    );
    expect(result?.family).toBe('ashby');
    expect(result?.role).toBe('Frontend Engineer');
    expect(result?.company).toBe('Fixture Co');
    expect(result?.dashboardUrl).toBe(
      'https://jobs.ashbyhq.com/fixture/abc-123',
    );
  });

  it('falls back to body pattern when subject is generic', () => {
    const result = parseAshbyConfirmation(
      msg({
        body:
          'You applied to the Staff Platform Engineer role at Fixture Co. ' +
          'Your application has been received.',
        from: 'no-reply@mail.ashbyhq.com',
        subject: 'Thanks for your interest',
      }),
    );
    expect(result).not.toBeNull();
    expect(result?.role).toMatch(/Staff Platform Engineer/);
    expect(result?.company).toBe('Fixture Co');
  });

  it('returns null when from-address is unrelated and body lacks ashbyhq', () => {
    const result = parseAshbyConfirmation(
      msg({
        body: 'No confirmation phrase here.',
        from: 'unrelated@example.com',
        subject: 'Hello',
      }),
    );
    expect(result).toBeNull();
  });

  it('returns null when confirmation phrase is missing', () => {
    const result = parseAshbyConfirmation(
      msg({
        body: 'This is a marketing email about ashbyhq.',
        from: 'marketing@ashbyhq.com',
        subject: 'Feature announcement',
      }),
    );
    expect(result).toBeNull();
  });
});
