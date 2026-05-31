// @vitest-environment node
import { db } from '@/lib/db/client';
import { ApplicationConfirmationState } from '@/generated/prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

import { applyConfirmationToSubmission } from '../confirmation-detector';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const NOW = new Date('2026-04-23T12:00:00Z');

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p3-4-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedSubmission(initialState?: ApplicationConfirmationState) {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `p3-4-${suffix}@test.local`,
      firstName: 'Confirmation',
      lastName: 'Apply',
    },
  });
  createdUserIds.push(user.id);

  const listing = await db.jobListing.create({
    data: {
      company: 'Fixture Co',
      jobId: `jobid-${suffix}`,
      jobProviderUrl: 'https://job-boards.greenhouse.io/fixture/jobs/1',
      title: 'Senior Engineer',
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
      confirmationState: initialState ?? ApplicationConfirmationState.PENDING,
      jobLeadId: lead.id,
      submittedAt: new Date(NOW.getTime() - 30 * 60 * 1000),
      userId: user.id,
    },
  });
}

describe.skipIf(!HAS_DB)('applyConfirmationToSubmission (integration)', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.automationAuditLog
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('transitions PENDING -> ATS_CONFIRMED on canonical Greenhouse banner and writes an audit row', async () => {
    const submission = await seedSubmission();
    const result = await applyConfirmationToSubmission({
      family: 'greenhouse',
      hostname: 'job-boards.greenhouse.io',
      html: '<html><body><h1>Application submitted!</h1></body></html>',
      now: NOW,
      submissionId: submission.id,
    });

    expect(result.transitioned).toBe(true);
    expect(result.detected?.family).toBe('greenhouse');
    expect(result.detected?.variant).toBe('canonical');

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.ATS_CONFIRMED,
    );
    expect(after.verifiedAt?.toISOString()).toBe(NOW.toISOString());

    const audit = await db.automationAuditLog.findFirst({
      where: {
        action: 'ATS_CONFIRMATION_DETECTED',
        applicationSubmissionId: submission.id,
      },
    });
    expect(audit).not.toBeNull();
    const meta = audit?.metadata as Record<string, unknown> | null;
    expect(meta?.family).toBe('greenhouse');
    expect(meta?.matchedPhrase).toMatch(/Application submitted/i);
    expect(meta?.hostname).toBe('job-boards.greenhouse.io');
  });

  it('no-op when the page has no confirmation phrase', async () => {
    const submission = await seedSubmission();
    const result = await applyConfirmationToSubmission({
      html: '<html><body><h1>Login</h1></body></html>',
      submissionId: submission.id,
    });
    expect(result.transitioned).toBe(false);
    expect(result.detected).toBeNull();

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(after.confirmationState).toBe(ApplicationConfirmationState.PENDING);
  });

  it('does not downgrade an already EMAIL_CONFIRMED submission', async () => {
    const submission = await seedSubmission(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
    const result = await applyConfirmationToSubmission({
      family: 'greenhouse',
      html: '<html><body><h1>Application submitted!</h1></body></html>',
      submissionId: submission.id,
    });
    expect(result.transitioned).toBe(false);
    expect(result.detected).not.toBeNull();

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
  });

  it('preserves an earlier verifiedAt on transition', async () => {
    const submission = await seedSubmission();
    const earlier = new Date(NOW.getTime() - 60 * 60 * 1000);
    await db.applicationSubmission.update({
      data: { verifiedAt: earlier },
      where: { id: submission.id },
    });

    await applyConfirmationToSubmission({
      family: 'greenhouse',
      html: '<html><body><h1>Application submitted!</h1></body></html>',
      now: NOW,
      submissionId: submission.id,
    });

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(after.verifiedAt?.toISOString()).toBe(earlier.toISOString());
  });

  it('returns { transitioned: false } when submission does not exist', async () => {
    const result = await applyConfirmationToSubmission({
      html: '<html><body><h1>Application submitted!</h1></body></html>',
      submissionId: 'does-not-exist',
    });
    expect(result.transitioned).toBe(false);
    expect(result.previousState).toBeNull();
  });
});
