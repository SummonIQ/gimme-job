import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

import { Page } from '@/components/layout/page';
import { queryDesktopAuditRows } from '@/lib/desktop-audit';
import { getCurrentUser } from '@/lib/user/query';

import { AuditTable, type AuditRow } from './_components/audit-table';

export const metadata: Metadata = {
  description: 'Every tool call, submit attempt, and identity read written by a paired desktop device.',
  title: 'Desktop audit | Gimme Job Admin',
};

interface PageProps {
  readonly searchParams: Promise<{
    toolName?: string;
    desktopSessionId?: string;
    jobLeadId?: string;
    action?: string;
  }>;
}

export default async function DesktopAuditPage(props: PageProps) {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');

  const params = await props.searchParams;
  const rows = await queryDesktopAuditRows({
    action: params.action as never,
    desktopSessionId: params.desktopSessionId,
    jobLeadId: params.jobLeadId,
    limit: 200,
    toolName: params.toolName,
    userId: user.id,
  });

  const vms: AuditRow[] = rows.map(row => ({
    action: row.action,
    createdAt: row.createdAt.toISOString(),
    desktopSessionId: row.desktopSessionId,
    durationMs: row.durationMs,
    errorMessage: row.errorMessage,
    id: row.id,
    jobLeadId: row.jobLeadId,
    outcome: row.outcome,
    payload: row.payload,
    redactedKeys: row.redactedKeys,
    runtimeSessionId: row.runtimeSessionId,
    toolName: row.toolName,
  }));

  return (
    <Page name="admin_desktop_audit">
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Desktop audit</h1>
          <p className="text-muted-foreground text-sm">
            Rows written by your desktop install via the P5.4 token.
            Identity-read rows redact the value; sensitive keys are swept
            recursively. Use the query filters via URL params (e.g.{' '}
            <code>?toolName=submit</code>).
          </p>
        </header>
        <AuditTable rows={vms} />
      </div>
    </Page>
  );
}
