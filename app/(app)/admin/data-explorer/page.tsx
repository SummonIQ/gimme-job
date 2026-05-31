import { AdminPageShell } from '../_components/admin-page-shell';
import { requireAdminUser } from '../require-admin-user';

import { DataExplorerClient } from './_components/data-explorer-client';

export default async function DataExplorerPage() {
  await requireAdminUser();

  return (
    <AdminPageShell
      title="Data Explorer"
      description="Browse all ATS observations, rules, systems, training sessions, and application data."
    >
      <DataExplorerClient />
    </AdminPageShell>
  );
}
