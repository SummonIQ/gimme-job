import { db } from '@/lib/db/client';
import { ATSAutomationPostureLevel } from '@/generated/prisma/client';

interface PostureSeed {
  readonly family: string;
  readonly notes: string;
  readonly posture: ATSAutomationPostureLevel;
  readonly tosUrl: string;
}

const REVIEWED_AT = new Date('2026-04-22T00:00:00.000Z');

export const ATS_AUTOMATION_POSTURE_SEEDS: readonly PostureSeed[] = [
  {
    family: 'greenhouse',
    notes:
      'Top SWE volume in the P0.3 inventory (1394 recent SWE jobs, 16 hostnames). Conservative default until explicit ToS sign-off.',
    posture: 'GRAY',
    tosUrl: 'https://www.greenhouse.com/terms-of-service',
  },
  {
    family: 'smartrecruiters',
    notes:
      'Second by volume (458 recent SWE jobs, 2 hostnames). Default GRAY until ToS review confirms automation posture.',
    posture: 'GRAY',
    tosUrl: 'https://www.smartrecruiters.com/legal/terms-of-service/',
  },
  {
    family: 'icims',
    notes:
      '228 distinct hostnames in the inventory; per-tenant posture may need refinement later.',
    posture: 'GRAY',
    tosUrl: 'https://www.icims.com/gc/terms-of-use/',
  },
  {
    family: 'ashby',
    notes: 'Single hostname (jobs.ashbyhq.com), 356 recent SWE jobs.',
    posture: 'GRAY',
    tosUrl: 'https://www.ashbyhq.com/terms',
  },
  {
    family: 'workday',
    notes:
      'High SWE volume (355) across 87 tenant hostnames on *.myworkdayjobs.com.',
    posture: 'GRAY',
    tosUrl: 'https://www.workday.com/en-us/legal/candidate-privacy.html',
  },
  {
    family: 'taleo',
    notes: 'Oracle-owned. Oracle legal terms apply at the platform level.',
    posture: 'GRAY',
    tosUrl: 'https://www.oracle.com/legal/terms.html',
  },
  {
    family: 'jobvite',
    notes: 'Single hostname (jobs.jobvite.com). 23 recent SWE jobs.',
    posture: 'GRAY',
    tosUrl: 'https://www.jobvite.com/terms-of-use/',
  },
  {
    family: 'lever',
    notes: 'Single hostname (jobs.lever.co). 23 recent SWE jobs.',
    posture: 'GRAY',
    tosUrl: 'https://www.lever.co/legal/terms-of-service/',
  },
  {
    family: 'successfactors',
    notes:
      'SAP-owned. Per-tenant deployments across 20 hostnames in inventory.',
    posture: 'GRAY',
    tosUrl: 'https://www.sap.com/about/legal/terms-of-use.html',
  },
  {
    family: 'bamboohr',
    notes:
      'Not in the top of the P0.3 inventory but included in the runtime ATS classifier and expected in long-tail leads.',
    posture: 'GRAY',
    tosUrl: 'https://www.bamboohr.com/legal/terms-of-service/',
  },
  {
    family: 'cornerstone',
    notes:
      'Long-tail ATS classifier match (csod.com). Low volume but present in detection patterns.',
    posture: 'GRAY',
    tosUrl: 'https://www.cornerstoneondemand.com/legal/terms-of-service/',
  },
];

export async function seedAtsAutomationPostures() {
  const results: { created: number; updated: number; unchanged: number } = {
    created: 0,
    updated: 0,
    unchanged: 0,
  };

  for (const seed of ATS_AUTOMATION_POSTURE_SEEDS) {
    const existing = await db.aTSAutomationPosture.findUnique({
      where: { family: seed.family },
    });

    if (!existing) {
      await db.aTSAutomationPosture.create({
        data: {
          family: seed.family,
          notes: seed.notes,
          posture: seed.posture,
          reviewedAt: REVIEWED_AT,
          tosUrl: seed.tosUrl,
        },
      });
      results.created += 1;
      continue;
    }

    const drift =
      existing.posture !== seed.posture ||
      existing.tosUrl !== seed.tosUrl ||
      existing.notes !== seed.notes;

    if (!drift) {
      results.unchanged += 1;
      continue;
    }

    await db.aTSAutomationPosture.update({
      data: {
        notes: seed.notes,
        posture: seed.posture,
        tosUrl: seed.tosUrl,
      },
      where: { family: seed.family },
    });
    results.updated += 1;
  }

  return results;
}

if (import.meta.main) {
  seedAtsAutomationPostures()
    .then(result => {
      console.log('ATSAutomationPosture seed result:', result);
      process.exit(0);
    })
    .catch(error => {
      console.error('ATSAutomationPosture seed failed:', error);
      process.exit(1);
    });
}
