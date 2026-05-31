import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db/client';
import { JobQueueStatus, JobType } from '@/lib/pipeline/durable-queue';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';
import { RestoreArchivedButton } from './_components/restore-archived-button';

function getPayloadValue(payload: unknown, key: string): string {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return '';
  }

  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : '';
}

export default async function AdminQueuePage() {
  await requireAdminUser();

  const [
    pendingDesktopCount,
    processingDesktopCount,
    failedDesktopCount,
    archivedDesktopCount,
    items,
    archivedItems,
  ] = await Promise.all([
    db.jobQueueItem.count({
      where: {
        status: JobQueueStatus.PENDING,
        type: JobType.DESKTOP_SUBMIT_REQUEST,
      },
    }),
    db.jobQueueItem.count({
      where: {
        status: JobQueueStatus.PROCESSING,
        type: JobType.DESKTOP_SUBMIT_REQUEST,
      },
    }),
    db.jobQueueItem.count({
      where: {
        status: {
          in: [JobQueueStatus.FAILED, JobQueueStatus.DEAD],
        },
        type: JobType.DESKTOP_SUBMIT_REQUEST,
      },
    }),
    db.jobQueueItem.count({
      where: {
        status: JobQueueStatus.ARCHIVED,
        type: JobType.DESKTOP_SUBMIT_REQUEST,
      },
    }),
    db.jobQueueItem.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        attempts: true,
        createdAt: true,
        id: true,
        maxRetries: true,
        payload: true,
        status: true,
        userId: true,
      },
      take: 50,
      where: {
        status: { not: JobQueueStatus.ARCHIVED },
        type: JobType.DESKTOP_SUBMIT_REQUEST,
      },
    }),
    db.jobQueueItem.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        createdAt: true,
        id: true,
        lastError: true,
        payload: true,
        updatedAt: true,
        userId: true,
      },
      take: 50,
      where: {
        status: JobQueueStatus.ARCHIVED,
        type: JobType.DESKTOP_SUBMIT_REQUEST,
      },
    }),
  ]);

  return (
    <AdminPageShell
      title="Desktop Queue"
      description="Submission requests waiting for the desktop runtime."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <AdminStatCard
          title="Pending"
          value={pendingDesktopCount.toLocaleString()}
          helperText="waiting for desktop"
        />
        <AdminStatCard
          title="Processing"
          value={processingDesktopCount.toLocaleString()}
          helperText="claimed by a worker"
        />
        <AdminStatCard
          title="Failed"
          value={failedDesktopCount.toLocaleString()}
          helperText="needs attention"
        />
        <AdminStatCard
          title="Archived"
          value={archivedDesktopCount.toLocaleString()}
          helperText="auto-archived after 14 days"
        />
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Queued</TableHead>
              <TableHead>Lead</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Attempts</TableHead>
              <TableHead>User</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map(item => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {item.createdAt.toLocaleString()}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {getPayloadValue(item.payload, 'jobLeadId') || 'n/a'}
                </TableCell>
                <TableCell>
                  <div className="font-medium">
                    {getPayloadValue(item.payload, 'company') || 'Unknown'}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {getPayloadValue(item.payload, 'jobTitle') ||
                      getPayloadValue(item.payload, 'applicationUrl')}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{item.status}</Badge>
                </TableCell>
                <TableCell>
                  {item.attempts}/{item.maxRetries}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {item.userId ?? 'n/a'}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="h-24 text-center text-muted-foreground"
                >
                  No desktop submission requests queued.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-base font-semibold">Archived</h2>
          <p className="text-sm text-muted-foreground">
            Items unconsumed for more than 14 days are auto-archived. Restore
            to put them back in the pending queue.
          </p>
        </div>
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.03]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Lead</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {archivedItems.map(item => (
                <TableRow key={item.id}>
                  <TableCell className="whitespace-nowrap text-muted-foreground">
                    {item.createdAt.toLocaleString()}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {getPayloadValue(item.payload, 'jobLeadId') || 'n/a'}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      {getPayloadValue(item.payload, 'company') || 'Unknown'}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {getPayloadValue(item.payload, 'jobTitle') ||
                        getPayloadValue(item.payload, 'applicationUrl')}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.lastError ?? 'Unknown'}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {item.userId ?? 'n/a'}
                  </TableCell>
                  <TableCell className="text-right">
                    <RestoreArchivedButton jobId={item.id} />
                  </TableCell>
                </TableRow>
              ))}
              {archivedItems.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No archived requests.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminPageShell>
  );
}
