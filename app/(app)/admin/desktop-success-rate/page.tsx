import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { Page } from '@/components/layout/page';
import { db } from '@/lib/db/client';
import {
  buildDesktopSubmissionSuccessRateReport,
  type DesktopSubmissionFailureGroup,
  type DesktopSubmissionProviderSummary,
  type DesktopSubmissionReadinessSummary,
} from '@/lib/admin/desktop-submission-success-rate';
import { getCurrentUser } from '@/lib/user/query';

export const metadata: Metadata = {
  description:
    'Desktop runtime submission success rate grouped by provider, run mode, and typed failure reason.',
  title: 'Desktop success rate | Gimme Job Admin',
};

interface PageProps {
  readonly searchParams: Promise<{ days?: string }>;
}

export default async function DesktopSuccessRatePage(props: PageProps) {
  const user = await getCurrentUser();
  if (!user?.id) redirect('/login');

  const searchParams = await props.searchParams;
  const windowDays = parseWindowDays(searchParams.days);
  const fromDate = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
  const submissions = await db.applicationSubmission.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      failureReason: true,
      id: true,
      metadata: true,
      status: true,
      submissionUrl: true,
    },
    where: {
      createdAt: { gte: fromDate },
      userId: user.id,
      wasAutomated: true,
    },
  });
  const report = buildDesktopSubmissionSuccessRateReport({
    rows: submissions,
    windowDays,
  });

  return (
    <Page name="admin_desktop_success_rate">
      <div className="space-y-4">
        <header>
          <h1 className="text-2xl font-semibold">Desktop success rate</h1>
          <p className="text-muted-foreground text-sm">
            Last {windowDays} days of automated desktop runs grouped by
            provider readiness, provider, run mode, and typed failure reason.
          </p>
        </header>

        <div className="grid gap-3 md:grid-cols-4">
          <MetricCard
            label="All runs"
            value={report.totals.runCount.toLocaleString()}
            detail={`${report.totals.successCount} submitted / ${report.totals.failureCount} failed`}
          />
          <MetricCard
            label="Overall success"
            value={formatPercent(report.totals.successRate)}
            detail="All readiness tiers"
          />
          <MetricCard
            label="Production success"
            value={formatPercent(
              findReadiness(report.readinessSummaries, 'production')
                ?.successRate ?? 0,
            )}
            detail={`${findReadiness(report.readinessSummaries, 'production')?.runCount ?? 0} production runs`}
          />
          <MetricCard
            label="Beta success"
            value={formatPercent(
              findReadiness(report.readinessSummaries, 'beta')?.successRate ??
                0,
            )}
            detail={`${findReadiness(report.readinessSummaries, 'beta')?.runCount ?? 0} beta runs`}
          />
        </div>

        <ReadinessTable rows={report.readinessSummaries} />
        <ProviderTable rows={report.providerSummaries} />
        <FailureGroupTable rows={report.failureGroups} />
      </div>
    </Page>
  );
}

function MetricCard({
  detail,
  label,
  value,
}: {
  readonly detail: string;
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="rounded border border-border bg-background p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
    </div>
  );
}

function ReadinessTable({
  rows,
}: {
  readonly rows: readonly DesktopSubmissionReadinessSummary[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Readiness tiers</h2>
      <div className="mt-2 overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Runs</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Failed</th>
              <th className="px-3 py-2">Success rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr className="border-t border-border" key={row.readiness}>
                <td className="px-3 py-2 font-medium">
                  {formatReadiness(row.readiness)}
                </td>
                <td className="px-3 py-2">{row.runCount}</td>
                <td className="px-3 py-2">{row.successCount}</td>
                <td className="px-3 py-2">{row.failureCount}</td>
                <td className="px-3 py-2">{formatPercent(row.successRate)}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProviderTable({
  rows,
}: {
  readonly rows: readonly DesktopSubmissionProviderSummary[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Providers</h2>
      <div className="mt-2 overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Runs</th>
              <th className="px-3 py-2">Submitted</th>
              <th className="px-3 py-2">Success rate</th>
              <th className="px-3 py-2">Top failure</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr className="border-t border-border" key={row.providerId}>
                <td className="px-3 py-2 font-medium">{row.providerLabel}</td>
                <td className="px-3 py-2">
                  {formatReadiness(row.readiness)}
                </td>
                <td className="px-3 py-2">{row.runCount}</td>
                <td className="px-3 py-2">{row.successCount}</td>
                <td className="px-3 py-2">{formatPercent(row.successRate)}</td>
                <td className="px-3 py-2">
                  {row.topFailureReason ?? 'none'}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={6} />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FailureGroupTable({
  rows,
}: {
  readonly rows: readonly DesktopSubmissionFailureGroup[];
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold">Failure reasons</h2>
      <div className="mt-2 overflow-x-auto rounded border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted text-left">
            <tr>
              <th className="px-3 py-2">Provider</th>
              <th className="px-3 py-2">Tier</th>
              <th className="px-3 py-2">Run mode</th>
              <th className="px-3 py-2">Failure reason</th>
              <th className="px-3 py-2">Runs</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr
                className="border-t border-border"
                key={`${row.providerId}:${row.runMode}:${row.failureReason}`}
              >
                <td className="px-3 py-2 font-medium">{row.providerLabel}</td>
                <td className="px-3 py-2">
                  {formatReadiness(row.readiness)}
                </td>
                <td className="px-3 py-2">{row.runMode}</td>
                <td className="px-3 py-2 font-mono text-xs">
                  {row.failureReason}
                </td>
                <td className="px-3 py-2">{row.runCount}</td>
              </tr>
            ))}
            {rows.length === 0 && <EmptyRow colSpan={5} />}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EmptyRow({ colSpan }: { readonly colSpan: number }) {
  return (
    <tr>
      <td
        className="px-3 py-6 text-center text-muted-foreground"
        colSpan={colSpan}
      >
        No desktop submissions in this window.
      </td>
    </tr>
  );
}

function parseWindowDays(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? '', 10);
  if (!Number.isFinite(parsed)) return 7;
  return Math.min(Math.max(parsed, 1), 90);
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function formatReadiness(value: string): string {
  return value.replaceAll('_', ' ');
}

function findReadiness(
  rows: readonly DesktopSubmissionReadinessSummary[],
  readiness: DesktopSubmissionReadinessSummary['readiness'],
) {
  return rows.find(row => row.readiness === readiness);
}
