// @vitest-environment node
import { db } from '@/lib/db/client';
import { SubmissionTier } from '@/generated/prisma/client';
import { afterAll, describe, expect, it } from 'vitest';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p11-1-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `submission-tier-${suffix}@test.local`,
      firstName: 'Submission',
      lastName: 'Tier',
    },
  });
  createdUserIds.push(user.id);
  return { user, suffix };
}

async function seedLead(tier?: SubmissionTier) {
  const { user, suffix } = await seedUser();
  const listing = await db.jobListing.create({
    data: { jobId: `jobid-${suffix}`, title: 'Engineer', userId: user.id },
  });
  const lead = await db.jobLead.create({
    data: {
      jobListingId: listing.id,
      title: listing.title,
      userId: user.id,
      ...(tier ? { submissionTier: tier } : {}),
    },
  });
  return { lead, user };
}

describe.skipIf(!HAS_DB)('JobLead.submissionTier', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('defaults new leads to TARGETED', async () => {
    const { lead } = await seedLead();
    expect(lead.submissionTier).toBe(SubmissionTier.TARGETED);
  });

  it('accepts TARGETED / GENERIC / FIRE_AND_FORGET on create and update', async () => {
    for (const tier of [
      SubmissionTier.TARGETED,
      SubmissionTier.GENERIC,
      SubmissionTier.FIRE_AND_FORGET,
    ]) {
      const { lead } = await seedLead(tier);
      expect(lead.submissionTier).toBe(tier);
    }

    const { lead } = await seedLead();
    const updated = await db.jobLead.update({
      data: { submissionTier: SubmissionTier.FIRE_AND_FORGET },
      where: { id: lead.id },
    });
    expect(updated.submissionTier).toBe(SubmissionTier.FIRE_AND_FORGET);
  });

  it('routes leads by tier in findMany (tier-to-mode routing)', async () => {
    const { user, suffix } = await seedUser();

    async function makeLead(tier: SubmissionTier, idx: number) {
      const listing = await db.jobListing.create({
        data: {
          jobId: `jobid-${suffix}-${idx}`,
          title: 'Engineer',
          userId: user.id,
        },
      });
      return db.jobLead.create({
        data: {
          jobListingId: listing.id,
          submissionTier: tier,
          title: listing.title,
          userId: user.id,
        },
      });
    }

    const targetedA = await makeLead(SubmissionTier.TARGETED, 1);
    const targetedB = await makeLead(SubmissionTier.TARGETED, 2);
    const generic = await makeLead(SubmissionTier.GENERIC, 3);
    const fireForget = await makeLead(SubmissionTier.FIRE_AND_FORGET, 4);

    const targetedIds = (
      await db.jobLead.findMany({
        select: { id: true },
        where: { submissionTier: SubmissionTier.TARGETED, userId: user.id },
      })
    ).map(l => l.id);
    expect(targetedIds.sort()).toEqual([targetedA.id, targetedB.id].sort());

    const genericIds = (
      await db.jobLead.findMany({
        select: { id: true },
        where: { submissionTier: SubmissionTier.GENERIC, userId: user.id },
      })
    ).map(l => l.id);
    expect(genericIds).toEqual([generic.id]);

    const fireIds = (
      await db.jobLead.findMany({
        select: { id: true },
        where: {
          submissionTier: SubmissionTier.FIRE_AND_FORGET,
          userId: user.id,
        },
      })
    ).map(l => l.id);
    expect(fireIds).toEqual([fireForget.id]);
  });
});
