// @vitest-environment node
import { db } from '@/lib/db/client';
import { ApplicationConfirmationState } from '@/generated/prisma/client';
import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { POST as reconcilePendingPOST } from '@/app/api/cron/reconcile-pending/route';
import {
  PENDING_TIMEOUT_HOURS,
  reconcilePendingSubmissions,
} from '../reconcile';

const HAS_DB = Boolean(process.env.DATABASE_URL);
const HOUR = 60 * 60 * 1000;
const NOW = new Date('2026-04-22T12:00:00.000Z');

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p10-4-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedSubmission(opts: {
  confirmationState?: ApplicationConfirmationState;
  hoursSinceSubmit: number | null;
}) {
  const suffix = nextSuffix();

  const user = await db.user.create({
    data: {
      email: `reconcile-${suffix}@test.local`,
      firstName: 'Reconcile',
      lastName: 'Test',
    },
  });
  createdUserIds.push(user.id);

  const listing = await db.jobListing.create({
    data: { jobId: `jobid-${suffix}`, title: 'Engineer', userId: user.id },
  });
  const lead = await db.jobLead.create({
    data: {
      jobListingId: listing.id,
      title: listing.title,
      userId: user.id,
    },
  });

  const submittedAt =
    opts.hoursSinceSubmit === null
      ? null
      : new Date(NOW.getTime() - opts.hoursSinceSubmit * HOUR);

  return db.applicationSubmission.create({
    data: {
      confirmationState:
        opts.confirmationState ?? ApplicationConfirmationState.PENDING,
      jobLeadId: lead.id,
      submittedAt,
      userId: user.id,
    },
  });
}

describe.skipIf(!HAS_DB)('reconcilePendingSubmissions (integration)', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('transitions a stale PENDING submission and writes an audit log', async () => {
    const stale = await seedSubmission({ hoursSinceSubmit: 73 });

    const result = await reconcilePendingSubmissions(NOW);
    expect(result.transitionedIds).toContain(stale.id);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: stale.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.PRESUMED_FAILED,
    );

    const audits = await db.automationAuditLog.findMany({
      where: {
        action: 'AUTO_FAIL_STALE_PENDING',
        applicationSubmissionId: stale.id,
      },
    });
    expect(audits.length).toBe(1);
    expect(audits[0].actionType).toBe('RECONCILE');
  });

  it('leaves fresh (<72h) PENDING submissions alone', async () => {
    const fresh = await seedSubmission({ hoursSinceSubmit: 24 });

    await reconcilePendingSubmissions(NOW);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: fresh.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.PENDING,
    );
  });

  it('leaves non-PENDING submissions alone even if older than the cutoff', async () => {
    const confirmed = await seedSubmission({
      confirmationState: ApplicationConfirmationState.EMAIL_CONFIRMED,
      hoursSinceSubmit: 1000,
    });

    await reconcilePendingSubmissions(NOW);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: confirmed.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.EMAIL_CONFIRMED,
    );
  });

  it('leaves PENDING submissions with null submittedAt alone', async () => {
    const neverSubmitted = await seedSubmission({ hoursSinceSubmit: null });

    await reconcilePendingSubmissions(NOW);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: neverSubmitted.id },
    });
    expect(after.confirmationState).toBe(ApplicationConfirmationState.PENDING);
  });

  it(`PENDING_TIMEOUT_HOURS is 72`, () => {
    expect(PENDING_TIMEOUT_HOURS).toBe(72);
  });
});

describe.skipIf(!HAS_DB)('POST /api/cron/reconcile-pending', () => {
  const originalSecret = process.env.CRON_SECRET;
  const TEST_SECRET = 'p10-4-test-secret';

  afterEach(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it('rejects requests without the Bearer token', async () => {
    process.env.CRON_SECRET = TEST_SECRET;

    const res = await reconcilePendingPOST(
      new Request('http://localhost/api/cron/reconcile-pending', {
        method: 'POST',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('rejects requests with the wrong token', async () => {
    process.env.CRON_SECRET = TEST_SECRET;

    const res = await reconcilePendingPOST(
      new Request('http://localhost/api/cron/reconcile-pending', {
        headers: { authorization: 'Bearer wrong' },
        method: 'POST',
      }),
    );
    expect(res.status).toBe(401);
  });

  it('reconciles on an authorized call and returns the transitioned ids', async () => {
    process.env.CRON_SECRET = TEST_SECRET;

    const stale = await seedSubmission({ hoursSinceSubmit: 200 });

    const res = await reconcilePendingPOST(
      new Request('http://localhost/api/cron/reconcile-pending', {
        headers: { authorization: `Bearer ${TEST_SECRET}` },
        method: 'POST',
      }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      cutoff: string;
      success: boolean;
      transitioned: number;
      transitionedIds: string[];
    };
    expect(body.success).toBe(true);
    expect(body.transitionedIds).toContain(stale.id);

    const after = await db.applicationSubmission.findUniqueOrThrow({
      where: { id: stale.id },
    });
    expect(after.confirmationState).toBe(
      ApplicationConfirmationState.PRESUMED_FAILED,
    );
  });
});
