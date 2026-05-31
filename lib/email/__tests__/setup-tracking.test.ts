// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  buildForwardingDestination: vi.fn(() => 'forward-chain'),
  createAlias: vi.fn(),
  createCredential: vi.fn(),
  deleteAlias: vi.fn(),
  generateAliasSlug: vi.fn(() => 'steven-123456'),
  getAlias: vi.fn(),
  getCredential: vi.fn(),
  getCurrentUser: vi.fn(),
  getTrackingEmail: vi.fn((alias: string) => `${alias}@gimmejob.com`),
  getWebhookUrl: vi.fn(() => 'https://www.gimmejob.com/api/webhooks/improvmx'),
  sanitizeTrackingAlias: vi.fn((alias: string) =>
    alias
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/[._-]{2,}/g, '-')
      .replace(/^[._-]+|[._-]+$/g, ''),
  ),
  updateAlias: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
  validateTrackingAlias: vi.fn((alias: string) =>
    alias ? null : 'Choose one',
  ),
}));

vi.mock('@/lib/user/query', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    user: {
      findFirst: mocks.userFindFirst,
      update: mocks.userUpdate,
    },
  },
}));

vi.mock('../improvmx', () => ({
  buildForwardingDestination: mocks.buildForwardingDestination,
  createAlias: mocks.createAlias,
  createCredential: mocks.createCredential,
  deleteAlias: mocks.deleteAlias,
  generateAliasSlug: mocks.generateAliasSlug,
  getAlias: mocks.getAlias,
  getCredential: mocks.getCredential,
  getTrackingEmail: mocks.getTrackingEmail,
  getWebhookUrl: mocks.getWebhookUrl,
  sanitizeTrackingAlias: mocks.sanitizeTrackingAlias,
  updateAlias: mocks.updateAlias,
  validateTrackingAlias: mocks.validateTrackingAlias,
}));

import { setupApplicationTracking } from '../setup-tracking';

describe('setupApplicationTracking', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('IMPROVMX_API_KEY', '');

    mocks.getCurrentUser.mockResolvedValue({
      email: 'person@example.com',
      firstName: 'Steven',
      id: 'user-1',
      trackingEmailAlias: 'old-alias',
      trackingEmailForwardingEnabled: true,
    });
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.getAlias.mockResolvedValue(null);
    mocks.createAlias.mockResolvedValue({ alias: 'new-alias', id: 1 });
    mocks.userUpdate.mockResolvedValue({});
    mocks.deleteAlias.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('changes an existing tracking alias when the new alias is available', async () => {
    const result = await setupApplicationTracking({ alias: 'new-alias' });

    expect(result).toEqual({
      alias: 'new-alias',
      canManageMailbox: false,
      success: true,
      trackingEmail: 'new-alias@gimmejob.com',
    });
    expect(mocks.userFindFirst).toHaveBeenCalledWith({
      select: { id: true },
      where: {
        id: { not: 'user-1' },
        trackingEmailAlias: 'new-alias',
      },
    });
    expect(mocks.getAlias).toHaveBeenCalledWith('new-alias');
    expect(mocks.createAlias).toHaveBeenCalledWith(
      'new-alias',
      'forward-chain',
    );
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      data: {
        trackingEmailAlias: 'new-alias',
        trackingEmailForwardingEnabled: true,
      },
      where: { id: 'user-1' },
    });
    expect(mocks.deleteAlias).toHaveBeenCalledWith('old-alias');
  });

  it('rejects a tracking alias already stored on another user', async () => {
    mocks.userFindFirst.mockResolvedValue({ id: 'other-user' });

    const result = await setupApplicationTracking({ alias: 'taken-alias' });

    expect(result).toEqual({
      error: 'That application email is already in use. Try another one.',
      success: false,
    });
    expect(mocks.createAlias).not.toHaveBeenCalled();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
  });
});
