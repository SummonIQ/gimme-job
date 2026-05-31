// @vitest-environment node
import { db } from '@/lib/db/client';
import { ConfirmationInboxProvider } from '@/generated/prisma/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import {
  __TESTING__,
  encryptCredential,
  loadAuthenticatedInbox,
  recordPoll,
  resolveInboxAuth,
} from '../auth';

const HAS_DB = Boolean(process.env.DATABASE_URL);

const originalKey = process.env[__TESTING__.ENV_VAR];

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p10-5-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `confirmation-inbox-${suffix}@test.local`,
      firstName: 'Inbox',
      lastName: 'User',
    },
  });
  createdUserIds.push(user.id);
  return { user, suffix };
}

describe.skipIf(!HAS_DB)('ConfirmationInbox auth (integration)', () => {
  beforeAll(() => {
    process.env[__TESTING__.ENV_VAR] =
      'test-key-DO-NOT-USE-IN-PROD-p10-5-integration';
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    if (originalKey === undefined) {
      delete process.env[__TESTING__.ENV_VAR];
    } else {
      process.env[__TESTING__.ENV_VAR] = originalKey;
    }
  });

  afterEach(async () => {
    await db.confirmationInbox.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
  });

  it('resolves IMAP credentials from a stored inbox', async () => {
    const { user, suffix } = await seedUser();
    const password = 'app-password-abc';
    const inbox = await db.confirmationInbox.create({
      data: {
        emailAddress: `imap-${suffix}@test.local`,
        encryptedSecret: encryptCredential(password),
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapSecure: true,
        imapUsername: `imap-${suffix}@test.local`,
        label: 'Primary IMAP',
        provider: ConfirmationInboxProvider.IMAP,
        userId: user.id,
      },
    });

    const auth = await loadAuthenticatedInbox(inbox.id);
    expect(auth.provider).toBe(ConfirmationInboxProvider.IMAP);
    if (auth.provider === ConfirmationInboxProvider.IMAP) {
      expect(auth.imap.host).toBe('imap.example.com');
      expect(auth.imap.port).toBe(993);
      expect(auth.imap.secure).toBe(true);
      expect(auth.imap.password).toBe(password);
      expect(auth.imap.username).toBe(`imap-${suffix}@test.local`);
    }
  });

  it('refuses to resolve an inactive inbox', async () => {
    const { user, suffix } = await seedUser();
    const inbox = await db.confirmationInbox.create({
      data: {
        emailAddress: `inactive-${suffix}@test.local`,
        encryptedSecret: encryptCredential('p'),
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: `inactive-${suffix}@test.local`,
        isActive: false,
        label: 'Inactive',
        provider: ConfirmationInboxProvider.IMAP,
        userId: user.id,
      },
    });
    await expect(loadAuthenticatedInbox(inbox.id)).rejects.toThrow(
      /is inactive/,
    );
  });

  it('resolves OAuth refresh-token stub for GMAIL', async () => {
    const { user, suffix } = await seedUser();
    const refreshToken = '1//test-refresh-token';
    const accessToken = 'ya29.test-access-token';
    const inbox = await db.confirmationInbox.create({
      data: {
        emailAddress: `gmail-${suffix}@test.local`,
        encryptedSecret: encryptCredential(`${accessToken}\n${refreshToken}`),
        label: 'Gmail',
        provider: ConfirmationInboxProvider.GMAIL,
        scope: 'https://mail.google.com/',
        userId: user.id,
      },
    });

    const auth = resolveInboxAuth(
      await db.confirmationInbox.findUniqueOrThrow({ where: { id: inbox.id } }),
    );
    expect(auth.provider).toBe(ConfirmationInboxProvider.GMAIL);
    if (auth.provider !== ConfirmationInboxProvider.IMAP) {
      expect(auth.oauth.accessToken).toBe(accessToken);
      expect(auth.oauth.refreshToken).toBe(refreshToken);
      expect(auth.oauth.scope).toBe('https://mail.google.com/');
    }
  });

  it('recordPoll updates lastPolledAt and lastSeenUid', async () => {
    const { user, suffix } = await seedUser();
    const inbox = await db.confirmationInbox.create({
      data: {
        emailAddress: `poll-${suffix}@test.local`,
        encryptedSecret: encryptCredential('p'),
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: `poll-${suffix}@test.local`,
        label: 'Poll',
        provider: ConfirmationInboxProvider.IMAP,
        userId: user.id,
      },
    });
    expect(inbox.lastPolledAt).toBeNull();
    expect(inbox.lastSeenUid).toBeNull();

    const at = new Date('2026-04-22T13:00:00Z');
    await recordPoll(inbox.id, 'uid-42', at);

    const after = await db.confirmationInbox.findUniqueOrThrow({
      where: { id: inbox.id },
    });
    expect(after.lastPolledAt?.toISOString()).toBe(at.toISOString());
    expect(after.lastSeenUid).toBe('uid-42');
  });

  it('recordPoll with a null uid preserves the previous lastSeenUid', async () => {
    const { user, suffix } = await seedUser();
    const inbox = await db.confirmationInbox.create({
      data: {
        emailAddress: `poll2-${suffix}@test.local`,
        encryptedSecret: encryptCredential('p'),
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: `poll2-${suffix}@test.local`,
        label: 'Poll 2',
        lastSeenUid: 'uid-5',
        provider: ConfirmationInboxProvider.IMAP,
        userId: user.id,
      },
    });

    await recordPoll(inbox.id, null);
    const after = await db.confirmationInbox.findUniqueOrThrow({
      where: { id: inbox.id },
    });
    expect(after.lastSeenUid).toBe('uid-5');
    expect(after.lastPolledAt).not.toBeNull();
  });

  it('enforces unique (userId, emailAddress)', async () => {
    const { user, suffix } = await seedUser();
    const shared = `dup-${suffix}@test.local`;
    await db.confirmationInbox.create({
      data: {
        emailAddress: shared,
        encryptedSecret: encryptCredential('p'),
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: shared,
        label: 'First',
        provider: ConfirmationInboxProvider.IMAP,
        userId: user.id,
      },
    });
    await expect(
      db.confirmationInbox.create({
        data: {
          emailAddress: shared,
          encryptedSecret: encryptCredential('p'),
          imapHost: 'imap.example.com',
          imapPort: 993,
          imapUsername: shared,
          label: 'Second',
          provider: ConfirmationInboxProvider.IMAP,
          userId: user.id,
        },
      }),
    ).rejects.toThrow();
  });
});
