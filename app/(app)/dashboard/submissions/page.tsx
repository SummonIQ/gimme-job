import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { db } from '@/lib/db/client';
import { ApplicationConfirmationState } from '@/generated/prisma/browser';
import { Page } from '@/components/layout/page';
import { getCurrentUser } from '@/lib/user/query';
import {
  SubmissionsClient,
  type GroupedSubmissions,
  type SubmissionRow,
} from './_components/submissions-client';

export const metadata: Metadata = {
  description: 'Reconcile application submissions with confirmed outcomes.',
  title: 'Submission reconciliation | Gimme Job',
};

const MAX_ROWS = 100;

const STATE_ORDER: readonly ApplicationConfirmationState[] = [
  ApplicationConfirmationState.PENDING,
  ApplicationConfirmationState.ATS_CONFIRMED,
  ApplicationConfirmationState.EMAIL_CONFIRMED,
  ApplicationConfirmationState.DASHBOARD_CONFIRMED,
  ApplicationConfirmationState.PRESUMED_FAILED,
  ApplicationConfirmationState.VERIFIED_FAILED,
];

export default async function SubmissionsReconciliationPage() {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect('/login');
  }

  const rows = await db.applicationSubmission.findMany({
    include: {
      jobLead: {
        include: {
          jobListing: { select: { company: true, title: true } },
        },
      },
    },
    orderBy: { updatedAt: 'desc' },
    take: MAX_ROWS,
    where: { userId: user.id },
  });

  const mapped: SubmissionRow[] = rows.map(row => ({
    company: row.jobLead.jobListing.company,
    confirmationState: row.confirmationState,
    id: row.id,
    jobTitle: row.jobLead.jobListing.title,
    status: row.status,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
  }));

  const groups: GroupedSubmissions[] = STATE_ORDER.map(state => ({
    rows: mapped.filter(r => r.confirmationState === state),
    state,
  }));

  return (
    <Page name="dashboard_submissions_reconciliation">
      <SubmissionsClient groups={groups} totalCount={mapped.length} />
    </Page>
  );
}
