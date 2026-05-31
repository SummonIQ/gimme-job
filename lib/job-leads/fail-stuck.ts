import { db } from '@/lib/db/client';
import { JobLeadStatus } from '@/generated/prisma/browser';
import { logger } from '@/lib/logger';
import { processNextQueuedLeads } from './process-optimization';

const STUCK_THRESHOLD_MINUTES = 15;

/**
 * Find and fail job leads that have been stuck in ANALYZING or OPTIMIZING
 * for longer than the threshold. This prevents leads from being permanently
 * stuck due to crashed workers or timeout errors.
 */
export async function failStuckLeads(): Promise<{
  analyzingFailed: number;
  optimizingFailed: number;
}> {
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MINUTES * 60 * 1000);

  const [analyzingResult, optimizingResult] = await Promise.all([
    db.jobLead.updateMany({
      where: {
        status: JobLeadStatus.ANALYZING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: JobLeadStatus.ANALYSIS_FAILED,
      },
    }),
    db.jobLead.updateMany({
      where: {
        status: JobLeadStatus.OPTIMIZING,
        updatedAt: { lt: cutoff },
      },
      data: {
        status: JobLeadStatus.OPTIMIZATION_FAILED,
      },
    }),
  ]);

  // If any leads were failed, process queued leads for affected users
  if (analyzingResult.count > 0 || optimizingResult.count > 0) {
    const usersWithQueued = await db.jobLead.findMany({
      where: { status: JobLeadStatus.ADDED },
      select: { userId: true },
      distinct: ['userId'],
    });

    for (const { userId } of usersWithQueued) {
      try {
        await processNextQueuedLeads(userId);
      } catch (error) {
        logger.error('[FAIL_STUCK] Error processing queued leads', {
          error,
          userId,
        });
      }
    }
  }

  return {
    analyzingFailed: analyzingResult.count,
    optimizingFailed: optimizingResult.count,
  };
}
