import { ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db/client';
import { formatRelativeTime } from '@/lib/time/format';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';

interface SnapshotFieldRecord {
  fieldType?: string;
  label?: string;
  options?: ReadonlyArray<unknown>;
  required?: boolean;
  selector?: string;
  value?: string;
}

interface SnapshotMetrics {
  readonly filledCount: number;
  readonly hasCapturedValues: boolean;
  readonly requiredCount: number;
  readonly selectCount: number;
  readonly totalCount: number;
}

export default async function AdminFormSnapshotsPage() {
  const user = await requireAdminUser();

  const snapshots = await db.localFormSnapshot.findMany({
    orderBy: { capturedAt: 'desc' },
    select: {
      applicationUrl: true,
      capturedAt: true,
      fields: true,
      hostname: true,
      id: true,
      jobLeadId: true,
    },
    take: 100,
    where: { userId: user.id },
  });

  const feedbackCounts = await db.formFieldFeedback.groupBy({
    by: ['snapshotId'],
    _count: { _all: true },
    where: {
      userId: user.id,
      snapshotId: { in: snapshots.map(snapshot => snapshot.id) },
    },
  });
  const feedbackBySnapshot = new Map(
    feedbackCounts.map(row => [row.snapshotId, row._count._all]),
  );

  const totalSnapshots = snapshots.length;
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const recentSnapshots = snapshots.filter(
    snapshot => snapshot.capturedAt.getTime() >= sevenDaysAgo,
  ).length;
  const uniqueHostnames = new Set(snapshots.map(snapshot => snapshot.hostname))
    .size;
  const totalFeedback = Array.from(feedbackBySnapshot.values()).reduce(
    (sum, count) => sum + count,
    0,
  );

  return (
    <AdminPageShell
      title="Form Snapshots"
      description="Review every Greenhouse form the desktop assistant captured. Click a row to inspect each field, see how it was filled, and leave feedback so future runs adjust."
    >
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <AdminStatCard
          title="Snapshots"
          value={totalSnapshots.toLocaleString()}
        />
        <AdminStatCard
          title="Recent (7d)"
          value={recentSnapshots.toLocaleString()}
        />
        <AdminStatCard
          title="Hostnames"
          value={uniqueHostnames.toLocaleString()}
        />
        <AdminStatCard
          title="Feedback rules"
          value={totalFeedback.toLocaleString()}
        />
      </div>

      {snapshots.length === 0 ? (
        <div className="rounded-xl border border-border/60 bg-background/80 px-4 py-6 text-sm text-muted-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/65">
          No form snapshots have been captured yet. Submit an application
          through the desktop assistant first.
        </div>
      ) : (
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <div>
              <h4 className="text-lg font-semibold text-foreground/80">
                Captured forms
              </h4>
              <p className="text-sm text-muted-foreground/70">
                Open a snapshot to review field fills, dropdown choices, and
                feedback rules.
              </p>
            </div>
            <Badge variant="outline" className="text-xs">
              {snapshots.length} total
            </Badge>
          </div>
          <Separator className="my-3 bg-border/60" />

          <div className="overflow-hidden rounded-xl border border-border/60 bg-background/80 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/65">
            <Table>
              <TableHeader className="bg-muted/45">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[18%] px-4 py-3 text-xs uppercase tracking-wide">
                    Captured
                  </TableHead>
                  <TableHead className="w-[20%] px-4 py-3 text-xs uppercase tracking-wide">
                    Source
                  </TableHead>
                  <TableHead className="px-4 py-3 text-xs uppercase tracking-wide">
                    Application
                  </TableHead>
                  <TableHead className="w-[20%] px-4 py-3 text-xs uppercase tracking-wide">
                    Field state
                  </TableHead>
                  <TableHead className="w-[12%] px-4 py-3 text-right text-xs uppercase tracking-wide">
                    Review
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map(snapshot => {
                  const fields = (snapshot.fields ??
                    []) as readonly SnapshotFieldRecord[];
                  const metrics = readSnapshotMetrics(fields);
                  const feedbackCount =
                    feedbackBySnapshot.get(snapshot.id) ?? 0;
                  const urlPath = readUrlPath(snapshot.applicationUrl);
                  return (
                    <TableRow
                      className="bg-background/40 hover:bg-muted/35"
                      key={snapshot.id}
                    >
                      <TableCell className="px-4 py-4 align-top">
                        <Link
                          className="block underline-offset-2 hover:underline"
                          href={`/admin/form-snapshots/${snapshot.id}`}
                        >
                          <div className="text-sm font-medium">
                            {formatRelativeTime(snapshot.capturedAt)}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {snapshot.capturedAt.toLocaleString()}
                          </div>
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-top">
                        <div className="flex flex-col gap-2">
                          <Badge
                            variant="outline"
                            className="w-fit rounded-md border-border/50 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {snapshot.hostname}
                          </Badge>
                          {snapshot.jobLeadId ? (
                            <span className="break-all font-mono text-[11px] text-muted-foreground">
                              Lead {snapshot.jobLeadId.slice(0, 12)}
                            </span>
                          ) : (
                            <span className="text-[11px] text-muted-foreground">
                              No lead attached
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-top">
                        <div className="flex min-w-0 flex-col gap-2">
                          <Link
                            className="block max-w-[34rem] truncate font-mono text-xs underline-offset-2 hover:underline"
                            href={snapshot.applicationUrl}
                            rel="noreferrer"
                            target="_blank"
                            title={snapshot.applicationUrl}
                          >
                            {urlPath}
                          </Link>
                          <Button asChild size="xs" variant="outline">
                            <Link
                              href={snapshot.applicationUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              <ExternalLink data-icon="inline-start" />
                              Open form
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 align-top">
                        <div className="flex flex-wrap gap-1.5">
                          <Badge
                            variant="outline"
                            className="rounded-md border-border/50 bg-muted/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground"
                          >
                            {metrics.totalCount} fields
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-md border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-700"
                          >
                            {metrics.requiredCount} required
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-md border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {metrics.selectCount} selects
                          </Badge>
                          <Badge
                            variant="outline"
                            className="rounded-md border-border/50 bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground"
                          >
                            {metrics.hasCapturedValues
                              ? `${metrics.filledCount} filled`
                              : 'pre-value snapshot'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-right align-top">
                        <div className="flex flex-col items-end gap-2">
                          {feedbackCount > 0 ? (
                            <Badge
                              variant="secondary"
                              className="rounded-md px-2 py-0.5 text-[10px]"
                            >
                              {feedbackCount} rules
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              No feedback
                            </span>
                          )}
                          <Button asChild size="xs" variant="outline">
                            <Link href={`/admin/form-snapshots/${snapshot.id}`}>
                              Review
                              <ChevronRight data-icon="inline-end" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </AdminPageShell>
  );
}

function readSnapshotMetrics(
  fields: readonly SnapshotFieldRecord[],
): SnapshotMetrics {
  const hasCapturedValues = fields.some(field =>
    Object.prototype.hasOwnProperty.call(field, 'value'),
  );
  return {
    filledCount: fields.filter(field => (field.value ?? '').trim()).length,
    hasCapturedValues,
    requiredCount: fields.filter(field => field.required).length,
    selectCount: fields.filter(field =>
      (field.fieldType ?? '').toLowerCase().includes('select'),
    ).length,
    totalCount: fields.length,
  };
}

function readUrlPath(applicationUrl: string): string {
  try {
    const url = new URL(applicationUrl);
    return `${url.pathname}${url.search}` || applicationUrl;
  } catch {
    return applicationUrl;
  }
}
