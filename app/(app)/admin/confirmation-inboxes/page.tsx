import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

import { InboxForm } from './_components/inbox-form';
import { InboxList, toListRow } from './_components/inbox-list';

export const metadata: Metadata = {
  description: 'Manage IMAP / OAuth inboxes that the reconciliation worker polls for application confirmations.',
  title: 'Confirmation inboxes | Gimme Job',
};

export default async function ConfirmationInboxesPage() {
  const user = await getCurrentUser();
  if (!user?.id) {
    redirect('/login');
  }

  const inboxes = await db.confirmationInbox.findMany({
    orderBy: { createdAt: 'desc' },
    where: { userId: user.id },
  });

  return (
    <Page name="admin_confirmation_inboxes">
      <div className="space-y-8">
        <header>
          <h1 className="text-2xl font-semibold">Confirmation inboxes</h1>
          <p className="text-muted-foreground text-sm">
            Add the inboxes the reconciliation worker should poll. Secrets are
            encrypted at rest using{' '}
            <code>CONFIRMATION_INBOX_ENCRYPTION_KEY</code>.
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <h2 className="text-lg font-medium">Add inbox</h2>
            <div className="mt-4">
              <InboxForm />
            </div>
          </div>
          <div>
            <h2 className="text-lg font-medium">Configured inboxes</h2>
            <div className="mt-4">
              <InboxList inboxes={inboxes.map(toListRow)} />
            </div>
          </div>
        </section>
      </div>
    </Page>
  );
}
