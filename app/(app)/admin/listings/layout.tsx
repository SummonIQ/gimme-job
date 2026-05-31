import { type ReactNode } from 'react';

import { AdminPageShell } from '../_components/admin-page-shell';
import { ListingsPageTabs } from './listings-page-tabs';

export default function AdminListingsLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  return (
    <AdminPageShell
      title="Job Listings"
      description="Analytics, ingestion schedules, and manual scrape controls."
    >
      <ListingsPageTabs />
      {children}
    </AdminPageShell>
  );
}
