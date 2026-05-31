// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ApplicationConfirmationState,
} from '@/generated/prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p10-1-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedFixture() {
  const suffix = nextSuffix();

  const user = await db.user.create({
    data: {
      email: `confirmation-state-${suffix}@test.local`,
      firstName: 'Confirmation',
      lastName: 'State',
    },
  });
  createdUserIds.push(user.id);

  const jobListing = await db.jobListing.create({
    data: {
      jobId: `jobid-${suffix}`,
      title: 'Engineer',
      userId: user.id,
    },
  });

  const jobLead = await db.jobLead.create({
    data: {
      jobListingId: jobListing.id,
      title: jobListing.title,
      userId: user.id,
    },
  });

  const submission = await db.applicationSubmission.create({
    data: {
      jobLeadId: jobLead.id,
      userId: user.id,
    },
  });

  return { submission, user };
}

describe.skipIf(!HAS_DB)('ApplicationSubmission.confirmationState', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('defaults new rows to PENDING with verifiedAt null', async () => {
    const { submission } = await seedFixture();
    expect(submission.confirmationState).toBe(
      ApplicationConfirmationState.PENDING,
    );
    expect(submission.verifiedAt).toBeNull();
  });

  it('accepts every valid confirmationState value', async () => {
    const { submission } = await seedFixture();

    const states: ApplicationConfirmationState[] = [
      ApplicationConfirmationState.ATS_CONFIRMED,
      ApplicationConfirmationState.EMAIL_CONFIRMED,
      ApplicationConfirmationState.DASHBOARD_CONFIRMED,
      ApplicationConfirmationState.PRESUMED_FAILED,
      ApplicationConfirmationState.VERIFIED_FAILED,
      ApplicationConfirmationState.PENDING,
    ];

    for (const state of states) {
      const updated = await db.applicationSubmission.update({
        data: { confirmationState: state },
        where: { id: submission.id },
      });
      expect(updated.confirmationState).toBe(state);
    }
  });

  it('persists verifiedAt alongside a confirmation transition', async () => {
    const { submission } = await seedFixture();

    const verifiedAt = new Date('2026-04-22T12:00:00.000Z');
    const updated = await db.applicationSubmission.update({
      data: {
        confirmationState: ApplicationConfirmationState.EMAIL_CONFIRMED,
        verifiedAt,
      },
      where: { id: submission.id },
    });

    expect(updated.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
    expect(updated.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());

    const fetched = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(fetched.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
    expect(fetched.verifiedAt?.toISOString()).toBe(verifiedAt.toISOString());
  });

  it('supports the happy-path transition PENDING -> ATS_CONFIRMED -> EMAIL_CONFIRMED', async () => {
    const { submission } = await seedFixture();

    expect(submission.confirmationState).toBe(
      ApplicationConfirmationState.PENDING,
    );

    const atsConfirmed = await db.applicationSubmission.update({
      data: { confirmationState: ApplicationConfirmationState.ATS_CONFIRMED },
      where: { id: submission.id },
    });
    expect(atsConfirmed.confirmationState).toBe(
      ApplicationConfirmationState.ATS_CONFIRMED,
    );

    const emailConfirmed = await db.applicationSubmission.update({
      data: {
        confirmationState: ApplicationConfirmationState.EMAIL_CONFIRMED,
        verifiedAt: new Date(),
      },
      where: { id: submission.id },
    });
    expect(emailConfirmed.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
    expect(emailConfirmed.verifiedAt).toBeInstanceOf(Date);
  });

  it('supports the failure transition PENDING -> PRESUMED_FAILED', async () => {
    const { submission } = await seedFixture();

    const failed = await db.applicationSubmission.update({
      data: { confirmationState: ApplicationConfirmationState.PRESUMED_FAILED },
      where: { id: submission.id },
    });
    expect(failed.confirmationState).toBe(
      ApplicationConfirmationState.PRESUMED_FAILED,
    );
  });
});
