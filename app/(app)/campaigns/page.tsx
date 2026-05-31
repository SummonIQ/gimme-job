import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

import {
  ConfirmBurstClient,
  type CampaignLeadRow,
} from './_components/confirm-burst-client';

export const metadata: Metadata = {
  description: 'Pick leads for a confirmation burst.',
  title: 'Campaigns | Gimme Job',
};

function hostnameFrom(url: string | null | undefined): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

export default async function CampaignsPage() {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');

  const leads = await db.jobLead.findMany({
    include: {
      jobListing: {
        select: { company: true, jobProviderUrl: true, title: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 200,
    where: { userId: user.id },
  });

  const rows: CampaignLeadRow[] = leads.map(lead => ({
    company: lead.jobListing.company,
    hostname: hostnameFrom(lead.jobListing.jobProviderUrl),
    id: lead.id,
    jobTitle: lead.jobListing.title,
    tier: lead.submissionTier,
  }));

  return (
    <Page name="campaigns_confirm_burst">
      <ConfirmBurstClient leads={rows} />
    </Page>
  );
}
