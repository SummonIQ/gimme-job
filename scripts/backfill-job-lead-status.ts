/**
 * Backfill JobLead.status based on related models (JobFitAnalysis, JobLeadOptimization, ApplicationSubmission).
 *
 * Run with: bun --env-file=.env scripts/backfill-job-lead-status.ts
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function backfill() {
  const leads = await prisma.jobLead.findMany({
    include: {
      applicationSubmissions: { take: 1 },
      jobFitAnalysis: true,
      optimization: true,
    },
  });

  console.log(`Found ${leads.length} job leads to check`);

  let updated = 0;

  for (const lead of leads) {
    let newStatus = lead.status;

    // Derive status from related models (in priority order, lowest to highest)
    if (lead.jobFitAnalysis) {
      if (lead.jobFitAnalysis.status === 'ANALYZING') {
        if (statusRank(newStatus) < statusRank('ANALYZING')) {
          newStatus = 'ANALYZING';
        }
      } else if (lead.jobFitAnalysis.status === 'COMPLETED') {
        if (statusRank(newStatus) < statusRank('ANALYZED')) {
          newStatus = 'ANALYZED';
        }
      } else if (lead.jobFitAnalysis.status === 'FAILED') {
        if (statusRank(newStatus) < statusRank('ANALYSIS_FAILED')) {
          newStatus = 'ANALYSIS_FAILED';
        }
      }
    }

    if (lead.optimization) {
      if (lead.optimization.status === 'ANALYZING') {
        if (statusRank(newStatus) < statusRank('ANALYZING')) {
          newStatus = 'ANALYZING';
        }
      } else if (lead.optimization.status === 'OPTIMIZING') {
        if (statusRank(newStatus) < statusRank('OPTIMIZING')) {
          newStatus = 'OPTIMIZING';
        }
      } else if (lead.optimization.status === 'COMPLETED') {
        if (statusRank(newStatus) < statusRank('OPTIMIZED')) {
          newStatus = 'OPTIMIZED';
        }
      } else if (lead.optimization.status === 'FAILED') {
        if (statusRank(newStatus) < statusRank('OPTIMIZATION_FAILED')) {
          newStatus = 'OPTIMIZATION_FAILED';
        }
      }
    }

    if (lead.applicationSubmissions && lead.applicationSubmissions.length > 0) {
      if (statusRank(newStatus) < statusRank('APPLIED')) {
        newStatus = 'APPLIED';
      }
    }

    // Skip terminal statuses that represent user decisions
    const terminalStatuses = ['REMOVED', 'REJECTED', 'HIRED', 'OFFER_DECLINED', 'INTERVIEWED_NOT_SELECTED'];
    if (terminalStatuses.includes(lead.status)) continue;

    // Only update if status changed and the new status is "higher" than current
    if (newStatus !== lead.status && statusRank(newStatus) > statusRank(lead.status)) {
      console.log(`  ${lead.id}: ${lead.status} → ${newStatus} (${lead.title})`);
      await prisma.jobLead.update({
        where: { id: lead.id },
        data: { status: newStatus as any },
      });
      updated++;
    }
  }

  console.log(`\nBackfill complete: ${updated} leads updated out of ${leads.length}`);
}

function statusRank(status: string): number {
  const ranks: Record<string, number> = {
    REMOVED: -1,
    ADDED: 0,
    ANALYZING: 1,
    ANALYZED: 2,
    ANALYSIS_FAILED: 2,
    OPTIMIZING: 3,
    OPTIMIZED: 4,
    OPTIMIZATION_FAILED: 4,
    APPLYING: 5,
    APPLIED: 6,
    REJECTED: 6,
    ADVANCED: 7,
    INTERVIEW_SCHEDULED: 8,
    INTERVIEW_CANCELLED: 8,
    INTERVIEW_COMPLETED: 9,
    INTERVIEWED_NOT_SELECTED: 9,
    OFFER: 10,
    OFFER_DECLINED: 10,
    HIRED: 11,
  };
  return ranks[status] ?? 0;
}

backfill()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
