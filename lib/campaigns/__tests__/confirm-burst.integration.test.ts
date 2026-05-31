// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ATSAutomationPostureLevel,
  SubmissionTier,
} from '@/generated/prisma/client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { confirmBurst } from '../confirm-burst';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p11-2-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];
const createdPostureIds: string[] = [];
const RATE_TEST_HOST = 'job-boards.greenhouse.io';
const RATE_TEST_ACTION = 'submit';

async function seedPosture(
  family: string,
  posture: ATSAutomationPostureLevel,
) {
  const existing = await db.aTSAutomationPosture.findUnique({
    where: { family },
  });
  if (existing) {
    if (existing.posture !== posture) {
      await db.aTSAutomationPosture.update({
        data: { posture },
        where: { family },
      });
    }
    return existing;
  }
  const created = await db.aTSAutomationPosture.create({
    data: {
      family,
      notes: 'P11.2 integration test',
      posture,
      reviewedAt: new Date(),
      tosUrl: 'https://example.com/tos',
    },
  });
  createdPostureIds.push(created.id);
  return created;
}

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `confirm-burst-${suffix}@test.local`,
      firstName: 'Burst',
      lastName: 'User',
    },
  });
  createdUserIds.push(user.id);
  return { suffix, user };
}

async function seedLead(
  userId: string,
  opts: {
    suffix: string;
    idx: number;
    tier: SubmissionTier;
    hostname: string;
  },
) {
  const listing = await db.jobListing.create({
    data: {
      company: 'Fixture Co',
      jobId: `jobid-${opts.suffix}-${opts.idx}`,
      jobProviderUrl: `https://${opts.hostname}/jobs/${opts.idx}`,
      title: `Engineer ${opts.idx}`,
      userId,
    },
  });
  return db.jobLead.create({
    data: {
      jobListingId: listing.id,
      submissionTier: opts.tier,
      title: listing.title,
      userId,
    },
  });
}

describe.skipIf(!HAS_DB)('confirmBurst (integration)', () => {
  beforeAll(async () => {
    await seedPosture('greenhouse', ATSAutomationPostureLevel.ALLOWED);
    await db.hostRateLimitState
      .deleteMany({
        where: { actionType: RATE_TEST_ACTION, hostname: RATE_TEST_HOST },
      })
      .catch(() => undefined);
  });

  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.jobQueueItem
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
    await db.hostRateLimitState
      .deleteMany({
        where: { actionType: RATE_TEST_ACTION, hostname: RATE_TEST_HOST },
      })
      .catch(() => undefined);
  });

  it('creates queue items for 20 mixed-tier leads under TARGETED burst', async () => {
    const { suffix, user } = await seedUser();

    const tiers: SubmissionTier[] = [
      ...Array.from({ length: 10 }).map(() => SubmissionTier.TARGETED),
      ...Array.from({ length: 7 }).map(() => SubmissionTier.GENERIC),
      ...Array.from({ length: 3 }).map(() => SubmissionTier.FIRE_AND_FORGET),
    ];

    const leads = await Promise.all(
      tiers.map((tier, idx) =>
        seedLead(user.id, {
          hostname: RATE_TEST_HOST,
          idx,
          suffix,
          tier,
        }),
      ),
    );

    const result = await confirmBurst({
      leadIds: leads.map(l => l.id),
      mode: SubmissionTier.TARGETED,
      userId: user.id,
    });

    expect(result.enqueued).toHaveLength(20);
    expect(result.skipped).toHaveLength(0);

    // All effective modes must be TARGETED because the burst mode is
    // TARGETED (stricter than every lead's tier).
    for (const item of result.enqueued) {
      expect(item.effectiveMode).toBe(SubmissionTier.TARGETED);
    }

    // Verify DB rows exist.
    const queueItems = await db.jobQueueItem.findMany({
      where: { userId: user.id },
    });
    expect(queueItems.length).toBeGreaterThanOrEqual(20);

    const desktopItems = queueItems.filter(
      q => q.type === 'DESKTOP_SUBMIT_REQUEST',
    );
    expect(desktopItems.length).toBe(20);
  });

  it('skips a lead whose tier is stricter than the burst mode', async () => {
    const { suffix, user } = await seedUser();

    const targeted = await seedLead(user.id, {
      hostname: RATE_TEST_HOST,
      idx: 100,
      suffix,
      tier: SubmissionTier.TARGETED,
    });

    const result = await confirmBurst({
      leadIds: [targeted.id],
      mode: SubmissionTier.GENERIC,
      userId: user.id,
    });

    expect(result.skipped.map(s => s.leadId)).toContain(targeted.id);

    const skip = result.skipped.find(s => s.leadId === targeted.id);
    expect(skip?.reason).toBe('TIER_BLOCKS_MODE');
  });

  it('skips a GENERIC-tier lead when no trust signals are wired yet (TRUST_BELOW_MINIMUM)', async () => {
    // Scope note: trust-signal loading from ApplicationRuntimeEvent is a
    // follow-up. Today confirmBurst always sees an empty signal set per
    // scope, so only TARGETED mode can escalate through the trust gate.
    // This test pins that behavior so callers understand the gating.
    const { suffix, user } = await seedUser();
    const generic = await seedLead(user.id, {
      hostname: 'job-boards.greenhouse.io',
      idx: 120,
      suffix,
      tier: SubmissionTier.GENERIC,
    });

    const result = await confirmBurst({
      leadIds: [generic.id],
      mode: SubmissionTier.GENERIC,
      userId: user.id,
    });

    expect(result.skipped[0]?.reason).toBe('TRUST_BELOW_MINIMUM');
  });

  it('returns LEAD_NOT_FOUND for unknown or cross-user ids', async () => {
    const { user } = await seedUser();
    const result = await confirmBurst({
      leadIds: ['does-not-exist'],
      mode: SubmissionTier.TARGETED,
      userId: user.id,
    });
    expect(result.enqueued).toHaveLength(0);
    expect(result.skipped).toHaveLength(1);
    expect(result.skipped[0].reason).toBe('LEAD_NOT_FOUND');
  });

  it('deduplicates repeated lead ids in the input', async () => {
    const { suffix, user } = await seedUser();
    const lead = await seedLead(user.id, {
      hostname: 'job-boards.greenhouse.io',
      idx: 200,
      suffix,
      tier: SubmissionTier.TARGETED,
    });

    const result = await confirmBurst({
      leadIds: [lead.id, lead.id, lead.id],
      mode: SubmissionTier.TARGETED,
      userId: user.id,
    });
    expect(result.enqueued.length + result.skipped.length).toBe(1);
  });

  it('respects posture: FORBIDDEN blocks GENERIC burst', async () => {
    // Use a family that isn't in the pre-seeded ALLOWED table. 'taleo' was
    // seeded GRAY in P0.4; force it to FORBIDDEN for this test.
    await seedPosture('taleo', ATSAutomationPostureLevel.FORBIDDEN);

    const { suffix, user } = await seedUser();
    const lead = await seedLead(user.id, {
      hostname: 'kp.taleo.net',
      idx: 300,
      suffix,
      tier: SubmissionTier.GENERIC,
    });

    const result = await confirmBurst({
      leadIds: [lead.id],
      mode: SubmissionTier.GENERIC,
      userId: user.id,
    });

    expect(result.skipped[0]?.reason).toBe('POSTURE_BLOCKS_MODE');
  });

  it('respects per-day host rate limits when the bucket has tokens', async () => {
    const { suffix, user } = await seedUser();
    const lead = await seedLead(user.id, {
      hostname: 'job-boards.greenhouse.io',
      idx: 400,
      suffix,
      tier: SubmissionTier.TARGETED,
    });

    await db.hostRateLimitState.upsert({
      create: {
        actionType: 'submit',
        capacity: 5,
        dayCount: 1,
        dayLimit: 1,
        dayResetAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        hostname: 'job-boards.greenhouse.io',
        lastRefilledAt: new Date(),
        refillRatePerSec: 1,
        tokens: 5,
      },
      update: {
        dayCount: 1,
        dayLimit: 1,
        tokens: 5,
      },
      where: {
        hostname_actionType: {
          actionType: 'submit',
          hostname: RATE_TEST_HOST,
        },
      },
    });

    const result = await confirmBurst({
      leadIds: [lead.id],
      mode: SubmissionTier.TARGETED,
      userId: user.id,
    });

    expect(result.enqueued).toHaveLength(0);
    expect(result.skipped[0]?.reason).toBe('RATE_BUDGET_EMPTY');
  });
});
