import type { Metadata } from 'next';

import { loadTrustDashboardRows } from '@/lib/admin/trust-dashboard';

import { AdminPageShell } from '../_components/admin-page-shell';
import { requireAdminUser } from '../require-admin-user';

import {
  TrustTable,
  type TrustRowVM,
} from './_components/trust-table';

export const metadata: Metadata = {
  description:
    'Active runtime-trust scopes with current effective level and manual demote controls.',
  title: 'Trust dashboard | Gimme Job Admin',
};

function rowKey(row: {
  scope: {
    atsFamily: string;
    hostname: string;
    node: string | null;
    transition: string | null;
    actionType: string;
  };
}): string {
  return [
    row.scope.atsFamily,
    row.scope.hostname,
    row.scope.node ?? '_',
    row.scope.transition ?? '_',
    row.scope.actionType,
  ].join('|');
}

export default async function TrustDashboardPage() {
  const user = await requireAdminUser();
  const rows = await loadTrustDashboardRows(user.id);

  const vms: TrustRowVM[] = rows.map(row => ({
    computedLevel: row.computedLevel,
    effectiveLevel: row.effectiveLevel,
    key: rowKey(row),
    lastChangeAt: row.lastChangeAt?.toISOString() ?? null,
    lastChangeReason: row.lastChangeReason,
    overriddenTo: row.overriddenTo,
    overrideId: row.overrideId,
    scope: row.scope,
  }));

  return (
    <AdminPageShell
      description="Per (ATS, hostname, node, transition, action) trust state. Manual demote writes an audit entry. Promotions flow through ladder signals only."
      title="Trust dashboard"
    >
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <TrustTable rows={vms} />
      </div>
    </AdminPageShell>
  );
}
