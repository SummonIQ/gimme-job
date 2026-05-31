// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ApplicationConfirmationState,
  ConfirmationInboxProvider,
} from '@/generated/prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  __TESTING__,
  encryptCredential,
} from '../auth';
import type { EmailMessage } from '../parsers';
import { pollInbox, type InboxClient } from '../worker';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const originalKey = process.env[__TESTING__.ENV_VAR];

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p10-2-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedFixture() {
  const suffix = nextSuffix();

  const user = await db.user.create({
    data: {
      email: `poll-worker-${suffix}@test.local`,
      firstName: 'Poll',
      lastName: 'Worker',
    },
  });
  createdUserIds.push(user.id);

  const inbox = await db.confirmationInbox.create({
    data: {
      emailAddress: `inbox-${suffix}@test.local`,
      encryptedSecret: encryptCredential('dummy-app-password'),
      imapHost: 'imap.example.com',
      imapPort: 993,
      imapUsername: `inbox-${suffix}@test.local`,
      label: 'Test inbox',
      provider: ConfirmationInboxProvider.IMAP,
      userId: user.id,
    },
  });

  async function createPendingSubmission(opts: {
    company: string;
    jobTitle: string;
    submittedAt: Date;
  }) {
    const listing = await db.jobListing.create({
      data: {
        company: opts.company,
        jobId: `jobid-${nextSuffix()}`,
        title: opts.jobTitle,
        userId: user.id,
      },
    });
    const lead = await db.jobLead.create({
      data: {
        jobListingId: listing.id,
        title: listing.title,
        userId: user.id,
      },
    });
    return db.applicationSubmission.create({
      data: {
        jobLeadId: lead.id,
        submittedAt: opts.submittedAt,
        userId: user.id,
      },
    });
  }

  return { createPendingSubmission, inbox, user };
}

function mockClient(messages: readonly EmailMessage[]): InboxClient {
  return {
    async fetchMessages({ sinceUid, limit }) {
      const filtered = sinceUid
        ? messages.filter(m => Number(m.uid) > Number(sinceUid))
        : messages;
      return filtered.slice(0, limit);
    },
  };
}

describe.skipIf(!HAS_DB)('pollInbox (integration)', () => {
  beforeAll(() => {
    process.env[__TESTING__.ENV_VAR] = 'p10-2-integration-test-key';
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

  it('matches a Greenhouse confirmation to its submission within one poll cycle', async () => {
    const { inbox, createPendingSubmission } = await seedFixture();

    const submission = await createPendingSubmission({
      company: 'Fixture Co',
      jobTitle: 'Senior Software Engineer',
      submittedAt: new Date('2026-04-20T10:00:00Z'),
    });

    const msg: EmailMessage = {
      body:
        'Thanks for applying to Senior Software Engineer at Fixture Co. ' +
        'Powered by Greenhouse.',
      from: 'no-reply@greenhouse.io',
      receivedAt: new Date('2026-04-20T10:05:00Z'),
      subject: 'Thank you for applying to Senior Software Engineer at Fixture Co',
      to: inbox.emailAddress,
      uid: '42',
    };

    const result = await pollInbox({
      clientFactory: async () => mockClient([msg]),
      inboxId: inbox.id,
      now: new Date('2026-04-20T10:06:00Z'),
    });

    expect(result.messagesFetched).toBe(1);
    expect(result.messagesParsed).toBe(1);
    expect(result.submissionsMatched).toBe(1);
    expect(result.matchedSubmissionIds).toEqual([submission.id]);
    expect(result.lastSeenUid).toBe('42');

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
    expect(after.verifiedAt?.toISOString()).toBe(msg.receivedAt.toISOString());

    const audit = await db.automationAuditLog.findFirst({
      where: {
        action: 'EMAIL_CONFIRMATION_MATCHED',
        applicationSubmissionId: submission.id,
      },
    });
    expect(audit).not.toBeNull();
    const meta = audit?.metadata as Record<string, unknown> | null;
    expect(meta?.family).toBe('greenhouse');
    expect(meta?.inboxId).toBe(inbox.id);

    const inboxAfter = await db.confirmationInbox.findUniqueOrThrow({
      where: { id: inbox.id },
    });
    expect(inboxAfter.lastSeenUid).toBe('42');
    expect(inboxAfter.lastPolledAt).not.toBeNull();
  });

  it('skips messages that do not match any submission (no false positives)', async () => {
    const { inbox, createPendingSubmission } = await seedFixture();

    const submission = await createPendingSubmission({
      company: 'Fixture Co',
      jobTitle: 'Senior Software Engineer',
      submittedAt: new Date('2026-04-20T10:00:00Z'),
    });

    const decoyMsg: EmailMessage = {
      body:
        'Thanks for applying to Product Manager at Totally Different Inc. ' +
        'Powered by Greenhouse.',
      from: 'no-reply@greenhouse.io',
      receivedAt: new Date('2026-04-20T10:05:00Z'),
      subject:
        'Thank you for applying to Product Manager at Totally Different Inc',
      to: inbox.emailAddress,
      uid: '100',
    };

    const result = await pollInbox({
      clientFactory: async () => mockClient([decoyMsg]),
      inboxId: inbox.id,
    });

    expect(result.submissionsMatched).toBe(0);
    expect(result.messagesParsed).toBe(1);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(after.confirmationState).toBe(ApplicationConfirmationState.PENDING);
  });

  it('persists lastSeenUid so a second poll only fetches newer messages', async () => {
    const { inbox } = await seedFixture();
    const makeMsg = (uid: string): EmailMessage => ({
      body: 'marketing',
      from: 'marketing@random.com',
      receivedAt: new Date(),
      subject: 'news',
      to: inbox.emailAddress,
      uid,
    });

    await pollInbox({
      clientFactory: async () =>
        mockClient([makeMsg('1'), makeMsg('2'), makeMsg('3')]),
      inboxId: inbox.id,
    });

    const inboxAfter1 = await db.confirmationInbox.findUniqueOrThrow({
      where: { id: inbox.id },
    });
    expect(inboxAfter1.lastSeenUid).toBe('3');

    const second = await pollInbox({
      clientFactory: async () =>
        mockClient([makeMsg('1'), makeMsg('2'), makeMsg('3'), makeMsg('4')]),
      inboxId: inbox.id,
    });
    // Only uid=4 is new.
    expect(second.messagesFetched).toBe(1);
    expect(second.lastSeenUid).toBe('4');
  });

  it('does not re-confirm a submission already matched on an earlier poll', async () => {
    const { inbox, createPendingSubmission } = await seedFixture();

    const submission = await createPendingSubmission({
      company: 'Fixture Co',
      jobTitle: 'Engineer',
      submittedAt: new Date('2026-04-20T10:00:00Z'),
    });

    const msg: EmailMessage = {
      body: 'Thanks for applying to Engineer at Fixture Co. Powered by Greenhouse.',
      from: 'no-reply@greenhouse.io',
      receivedAt: new Date('2026-04-20T10:05:00Z'),
      subject: 'Thank you for applying to Engineer at Fixture Co',
      to: inbox.emailAddress,
      uid: '10',
    };

    await pollInbox({
      clientFactory: async () => mockClient([msg]),
      inboxId: inbox.id,
    });

    const duplicateMsg: EmailMessage = { ...msg, uid: '11' };
    const second = await pollInbox({
      clientFactory: async () => mockClient([duplicateMsg]),
      inboxId: inbox.id,
    });

    expect(second.submissionsMatched).toBe(0);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    // Still EMAIL_CONFIRMED (transitioned on the first poll).
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );

    const audits = await db.automationAuditLog.findMany({
      where: {
        action: 'EMAIL_CONFIRMATION_MATCHED',
        applicationSubmissionId: submission.id,
      },
    });
    expect(audits.length).toBe(1);
  });

  it('updates lastSeenUid even when no messages matched (idempotent advance)', async () => {
    const { inbox } = await seedFixture();
    const noise: EmailMessage = {
      body: 'marketing',
      from: 'marketing@random.com',
      receivedAt: new Date(),
      subject: 'news',
      to: inbox.emailAddress,
      uid: '200',
    };

    const result = await pollInbox({
      clientFactory: async () => mockClient([noise]),
      inboxId: inbox.id,
    });
    expect(result.submissionsMatched).toBe(0);
    expect(result.lastSeenUid).toBe('200');

    const inboxAfter = await db.confirmationInbox.findUniqueOrThrow({
      where: { id: inbox.id },
    });
    expect(inboxAfter.lastSeenUid).toBe('200');
  });

  it('ignores submissions submitted older than 14 days', async () => {
    const { inbox, createPendingSubmission } = await seedFixture();

    const ancient = await createPendingSubmission({
      company: 'Fixture Co',
      jobTitle: 'Senior Software Engineer',
      submittedAt: new Date('2026-03-01T00:00:00Z'),
    });

    const msg: EmailMessage = {
      body: 'Thanks for applying. Powered by Greenhouse.',
      from: 'no-reply@greenhouse.io',
      receivedAt: new Date('2026-04-22T10:00:00Z'),
      subject: 'Thank you for applying to Senior Software Engineer at Fixture Co',
      to: inbox.emailAddress,
      uid: '300',
    };

    const result = await pollInbox({
      clientFactory: async () => mockClient([msg]),
      inboxId: inbox.id,
      now: new Date('2026-04-22T10:05:00Z'),
    });

    expect(result.submissionsMatched).toBe(0);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: ancient.id },
    });
    expect(after.confirmationState).toBe(ApplicationConfirmationState.PENDING);
  });
});
