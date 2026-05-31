import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

import { InboxView } from './inbox-view';

export const metadata: Metadata = {
  description: 'Emails received in response to your job applications.',
  title: 'Inbox | gimmejob',
};

const PAGE_SIZE = 50;

export default async function InboxPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect('/login');
  }

  const [emails, totalCount, unreadCount, inboxes] = await Promise.all([
    db.applicationEmail.findMany({
      where: {
        userId: user.id,
        isJobRelated: true,
      },
      orderBy: { receivedAt: 'desc' },
      take: PAGE_SIZE,
      include: {
        jobLead: {
          select: {
            id: true,
            jobListing: { select: { title: true, company: true } },
          },
        },
        applicationSubmission: {
          select: { id: true, status: true },
        },
      },
    }),
    db.applicationEmail.count({
      where: { userId: user.id, isJobRelated: true },
    }),
    db.applicationEmail.count({
      where: {
        userId: user.id,
        isJobRelated: true,
        status: { in: ['PENDING', 'ANALYZING'] },
      },
    }),
    db.confirmationInbox.findMany({
      where: { userId: user.id },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'asc' }],
      select: {
        id: true,
        emailAddress: true,
        provider: true,
        isActive: true,
        label: true,
      },
    }),
  ]);

  const initialEmails = emails.map(email => ({
    id: email.id,
    fromEmail: email.fromEmail,
    fromName: email.fromName,
    subject: email.subject,
    receivedAt: email.receivedAt.toISOString(),
    status: email.status,
    detectedStatus: email.detectedStatus,
    detectedCompany: email.detectedCompany,
    detectedJobTitle: email.detectedJobTitle,
    textBody: email.textBody,
    jobLeadId: email.jobLeadId,
    jobLeadTitle: email.jobLead?.jobListing?.title ?? null,
    jobLeadCompany: email.jobLead?.jobListing?.company ?? null,
    submissionId: email.applicationSubmissionId,
    submissionStatus: email.applicationSubmission?.status ?? null,
  }));

  const trackingEmail = user.trackingEmailAlias
    ? `${user.trackingEmailAlias}@gimmejob.com`
    : null;

  return (
    <Page name="inbox">
      <InboxView
        initialEmails={initialEmails}
        inboxes={inboxes.map(inbox => ({
          id: inbox.id,
          emailAddress: inbox.emailAddress,
          provider: inbox.provider,
          isActive: inbox.isActive,
          label: inbox.label,
        }))}
        trackingEmail={trackingEmail}
        trackingForwardingEnabled={Boolean(user.trackingEmailForwardingEnabled)}
        totalCount={totalCount}
        unreadCount={unreadCount}
      />
    </Page>
  );
}
