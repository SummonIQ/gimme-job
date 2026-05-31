import { JobLeadStatus } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';

import { JobLeadProcessingFloat } from './job-lead-processing-float';

const ACTIVE_STATUSES = [
  JobLeadStatus.QUEUED,
  JobLeadStatus.ANALYZING,
  JobLeadStatus.OPTIMIZING,
];

interface JobLeadProcessingFloatServerProps {
  userId: string;
}

const JobLeadProcessingFloatServer = async ({
  userId,
}: JobLeadProcessingFloatServerProps) => {
  const activeLeads = await db.jobLead.findMany({
    select: { id: true, title: true, status: true },
    where: { userId, status: { in: ACTIVE_STATUSES } },
    orderBy: { createdAt: 'asc' },
  });

  return (
    <JobLeadProcessingFloat
      initialItems={activeLeads.map(lead => ({
        id: lead.id,
        title: lead.title,
        status: lead.status,
      }))}
    />
  );
};

JobLeadProcessingFloatServer.displayName = 'JobLeadProcessingFloatServer';

export { JobLeadProcessingFloatServer };
