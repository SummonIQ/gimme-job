import { db } from '@/lib/db/client';
import { JobLeadStatus } from '@/generated/prisma/browser';
import { revalidateTag } from 'next/cache';
import { unauthorized } from 'next/navigation';
import { getCurrentUser } from '@/lib/user/query';
import { triggerJobLeadStatusNotification } from '@/lib/notifications/triggers';

export async function updateJobLeadStatus({
  jobLeadId,
  status,
}: {
  jobLeadId: string;
  status: JobLeadStatus;
}) {
  const user = await getCurrentUser();
  if (!user) {
    unauthorized();
  }

  // Get current status before update to compare for notification
  const currentLead = await db.jobLead.findUnique({
    where: { id: jobLeadId },
    select: { status: true },
  });

  if (!currentLead) {
    throw new Error(`Job lead not found: ${jobLeadId}`);
  }

  const previousStatus = currentLead.status;

  // Update the job lead status
  const jobLead = await db.jobLead.update({
    where: { id: jobLeadId },
    data: { status },
  });

  // Trigger notification if status changed
  if (previousStatus !== status) {
    // Use a non-blocking call to avoid delaying the status update response
    triggerJobLeadStatusNotification(jobLeadId, previousStatus, status).catch(
      error => console.error('Error triggering notification:', error),
    );
  }

  revalidateTag(`${user.id}:job-leads`);
  revalidateTag(`${user.id}:job-leads:${jobLeadId}`);
  revalidateTag(`${user.id}:report:job-leads`);
  revalidateTag(`${user.id}:report:job-leads:applied`);

  return jobLead;
}
