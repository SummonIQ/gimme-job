import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import { FollowUpDraftStatus } from '@/generated/prisma/browser';
import { getCurrentUser } from '@/lib/user/query';

import {
  DraftsClient,
  type FollowUpDraftRow,
} from './_components/drafts-client';

export const metadata: Metadata = {
  description: 'Review and edit auto-generated follow-up drafts before sending.',
  title: 'Follow-ups | Gimme Job',
};

export default async function FollowUpsPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');

  const drafts = await db.followUpDraft.findMany({
    include: {
      applicationSubmission: {
        include: {
          jobLead: {
            include: { jobListing: { select: { company: true, title: true } } },
          },
        },
      },
    },
    orderBy: { generatedAt: 'desc' },
    where: {
      status: { in: [FollowUpDraftStatus.DRAFT, FollowUpDraftStatus.SENT] },
      userId: user.id,
    },
  });

  const rows: FollowUpDraftRow[] = drafts.map(d => ({
    bodyMarkdown: d.bodyMarkdown,
    company: d.applicationSubmission.jobLead.jobListing.company,
    daysSinceSubmission: d.daysSinceSubmission,
    generatedAt: d.generatedAt.toISOString(),
    id: d.id,
    jobTitle: d.applicationSubmission.jobLead.jobListing.title,
    status: d.status,
    subject: d.subject,
  }));

  return (
    <Page name="follow_ups_review">
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Follow-up drafts</h1>
          <p className="text-muted-foreground text-sm">
            Drafts are generated automatically for submissions with no reply
            after 7 days. Edit, mark sent when you actually send, or dismiss.
          </p>
        </header>
        <DraftsClient drafts={rows} />
      </div>
    </Page>
  );
}
