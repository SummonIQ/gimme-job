import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  buildForwardingDestination,
  generateAliasSlug,
  getWebhookUrl,
  sanitizeTrackingAlias,
  validateTrackingAlias,
} from '@/lib/email/improvmx';

const originalEnv = { ...process.env };

describe('ImprovMX helpers', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllEnvs();
  });

  it('sanitizes a user-provided alias candidate', () => {
    expect(sanitizeTrackingAlias(' Steven Jobs+ATS  ')).toBe('steven-jobs-ats');
    expect(sanitizeTrackingAlias('..dev__mail--')).toBe('dev-mail');
  });

  it('validates supported alias formats', () => {
    expect(validateTrackingAlias('job.search_01')).toBeNull();
    expect(validateTrackingAlias('ab')).toBe('Use at least 3 characters.');
    expect(validateTrackingAlias('Not Allowed')).toBe(
      'Use lowercase letters, numbers, dots, dashes, or underscores.',
    );
  });

  it('returns just the webhook URL even when a user email is provided', () => {
    expect(
      buildForwardingDestination({
        webhookUrl: 'https://app.example.com/api/webhooks/improvmx',
      }),
    ).toBe('https://app.example.com/api/webhooks/improvmx');

    expect(
      buildForwardingDestination({
        webhookUrl: 'https://app.example.com/api/webhooks/improvmx',
        userEmail: 'person@example.com',
        forwardingEnabled: true,
      }),
    ).toBe('https://app.example.com/api/webhooks/improvmx');
  });

  it('uses the public production webhook when local app URLs are configured', () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:10100');
    vi.stubEnv('APPLICATION_TRACKING_BASE_URL', '');
    vi.stubEnv('APPLICATION_TRACKING_WEBHOOK_URL', '');
    vi.stubEnv('IMPROVMX_WEBHOOK_URL', '');
    vi.stubEnv('VERCEL_URL', '');

    expect(getWebhookUrl()).toBe(
      'https://www.gimmejob.com/api/webhooks/improvmx',
    );
  });

  it('allows an explicit public ImprovMX webhook URL', () => {
    vi.stubEnv(
      'IMPROVMX_WEBHOOK_URL',
      'https://hooks.example.com/improvmx#ignored',
    );

    expect(getWebhookUrl()).toBe('https://hooks.example.com/improvmx');
  });

  it('rejects an explicit local ImprovMX webhook URL', () => {
    vi.stubEnv(
      'IMPROVMX_WEBHOOK_URL',
      'http://localhost:10100/api/webhooks/improvmx',
    );

    expect(() => getWebhookUrl()).toThrow(
      'IMPROVMX_WEBHOOK_URL must be a public http(s) URL',
    );
  });

  it('falls back safely when generating a default alias suggestion', () => {
    expect(generateAliasSlug('Steven', 'user_123456')).toBe('steven-123456');
    expect(generateAliasSlug('Steven', 'user_iHH1E5')).toBe('steven-ihh1e5');
    expect(generateAliasSlug('', 'user_123456', 'jobs.user')).toBe(
      'jobsuser-123456',
    );
  });
});
