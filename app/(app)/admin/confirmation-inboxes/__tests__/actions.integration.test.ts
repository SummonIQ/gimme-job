// @vitest-environment node
import { db } from '@/lib/db/client';
import { ConfirmationInboxProvider } from '@/generated/prisma/client';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('@/lib/user/query', () => ({ getCurrentUser: vi.fn() }));

import { __TESTING__, decryptCredential } from '@/lib/email-ingestion/auth';
import { getCurrentUser } from '@/lib/user/query';

import {
  createConfirmationInbox,
  deleteConfirmationInbox,
  toggleConfirmationInboxActive,
} from '../actions';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const originalKey = process.env[__TESTING__.ENV_VAR];

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p10-5-act-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `confirmation-inbox-action-${suffix}@test.local`,
      firstName: 'Inbox',
      lastName: 'Actions',
    },
  });
  createdUserIds.push(user.id);
  return { user, suffix };
}

describe.skipIf(!HAS_DB)(
  'confirmation-inbox server actions (integration)',
  () => {
    beforeAll(() => {
      process.env[__TESTING__.ENV_VAR] =
        'test-key-DO-NOT-USE-IN-PROD-p10-5-actions';
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

    beforeEach(() => {
      vi.mocked(getCurrentUser).mockReset();
    });

    afterEach(async () => {
      await db.confirmationInbox.deleteMany({
        where: { userId: { in: createdUserIds } },
      });
    });

    it('rejects unauthenticated create', async () => {
      vi.mocked(getCurrentUser).mockResolvedValue(null as never);
      await expect(
        createConfirmationInbox({
          emailAddress: 'x@example.com',
          imapHost: 'imap.example.com',
          imapPort: 993,
          imapUsername: 'x@example.com',
          label: 'x',
          provider: ConfirmationInboxProvider.IMAP,
          secret: 'p',
        }),
      ).rejects.toThrow('Unauthorized');
    });

    it('creates an IMAP inbox and encrypts the app password at rest', async () => {
      const { user, suffix } = await seedUser();
      vi.mocked(getCurrentUser).mockResolvedValue(user as never);

      const email = `create-${suffix}@test.local`;
      const password = 'super-secret-app-password';
      const result = await createConfirmationInbox({
        emailAddress: email,
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapSecure: true,
        imapUsername: email,
        label: 'Primary',
        provider: ConfirmationInboxProvider.IMAP,
        secret: password,
      });

      const stored = await db.confirmationInbox.findUniqueOrThrow({
        where: { id: result.id },
      });
      expect(stored.emailAddress).toBe(email);
      expect(stored.encryptedSecret).not.toContain(password);
      expect(decryptCredential(stored.encryptedSecret)).toBe(password);
    });

    it('validates IMAP fields', async () => {
      const { user } = await seedUser();
      vi.mocked(getCurrentUser).mockResolvedValue(user as never);

      await expect(
        createConfirmationInbox({
          emailAddress: 'imap-bad@test.local',
          imapPort: 993,
          imapUsername: 'imap-bad@test.local',
          label: 'Bad',
          provider: ConfirmationInboxProvider.IMAP,
          secret: 'p',
          // missing imapHost
        }),
      ).rejects.toThrow(/imapHost is required/);

      await expect(
        createConfirmationInbox({
          emailAddress: 'imap-bad2@test.local',
          imapHost: 'imap.example.com',
          imapPort: 0,
          imapUsername: 'imap-bad2@test.local',
          label: 'Bad',
          provider: ConfirmationInboxProvider.IMAP,
          secret: 'p',
        }),
      ).rejects.toThrow(/imapPort must be a positive integer/);
    });

    it('refuses to delete another user\'s inbox', async () => {
      const owner = await seedUser();
      vi.mocked(getCurrentUser).mockResolvedValue(owner.user as never);
      const result = await createConfirmationInbox({
        emailAddress: `owner-${owner.suffix}@test.local`,
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: `owner-${owner.suffix}@test.local`,
        label: 'Owner',
        provider: ConfirmationInboxProvider.IMAP,
        secret: 'p',
      });

      const intruder = await seedUser();
      vi.mocked(getCurrentUser).mockResolvedValue(intruder.user as never);
      await expect(deleteConfirmationInbox(result.id)).rejects.toThrow(
        'Inbox not found',
      );

      // Owner can still delete.
      vi.mocked(getCurrentUser).mockResolvedValue(owner.user as never);
      await deleteConfirmationInbox(result.id);
      const gone = await db.confirmationInbox.findUnique({
        where: { id: result.id },
      });
      expect(gone).toBeNull();
    });

    it('toggle flips isActive between true and false', async () => {
      const { user, suffix } = await seedUser();
      vi.mocked(getCurrentUser).mockResolvedValue(user as never);
      const { id } = await createConfirmationInbox({
        emailAddress: `toggle-${suffix}@test.local`,
        imapHost: 'imap.example.com',
        imapPort: 993,
        imapUsername: `toggle-${suffix}@test.local`,
        label: 'Toggle',
        provider: ConfirmationInboxProvider.IMAP,
        secret: 'p',
      });

      const before = await db.confirmationInbox.findUniqueOrThrow({
        where: { id },
      });
      expect(before.isActive).toBe(true);

      await toggleConfirmationInboxActive(id);
      const paused = await db.confirmationInbox.findUniqueOrThrow({
        where: { id },
      });
      expect(paused.isActive).toBe(false);

      await toggleConfirmationInboxActive(id);
      const resumed = await db.confirmationInbox.findUniqueOrThrow({
        where: { id },
      });
      expect(resumed.isActive).toBe(true);
    });
  },
);
