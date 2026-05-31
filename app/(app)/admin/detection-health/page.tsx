import type { Metadata } from 'next';

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
import {
  DETECTION_HEALTH_EVENT,
  getDetectionHealthRealtimeConfig,
} from '@/lib/admin/summonflow';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';
import { DetectionHealthRealtimeRefresh } from './_components/realtime-refresh';

export const metadata: Metadata = {
  description: 'Auto-demotions and posture flips the detection-health monitor has applied.',
  title: 'Detection health | Gimme Job Admin',
};

export const dynamic = 'force-dynamic';

function formatMetadata(metadata: unknown): string {
  if (!metadata || typeof metadata !== 'object') return '';
  const m = metadata as Record<string, unknown>;
  const triggered = Array.isArray(m.triggered)
    ? (m.triggered as Array<{ type: string }>).map(t => t.type).join(', ')
    : '';
  const hostname = typeof m.hostname === 'string' ? m.hostname : '';
  return [hostname, triggered].filter(Boolean).join(' · ');
}

export default async function DetectionHealthPage() {
  await requireAdminUser();

  const [auditRows, activeOverrides, recentFlips] = await Promise.all([
    db.automationAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
      where: { action: 'AUTO_DETECTION_HEALTH_DEMOTE' },
    }),
    db.runtimeTrustOverride.count({
      where: { clearedAt: null, reason: { contains: 'detection-health' } },
    }),
    db.aTSAutomationPosture.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 20,
      where: { notes: { contains: 'detection-health' } },
    }),
  ]);

  const realtimeConfig = getDetectionHealthRealtimeConfig();

  return (
    <AdminPageShell
      description="Every auto-demotion the detection-health monitor has applied. Manual demotes appear on the trust dashboard."
      title="Detection health"
    >
      <div className="flex justify-end">
        <DetectionHealthRealtimeRefresh
          config={realtimeConfig}
          event={DETECTION_HEALTH_EVENT}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <AdminStatCard
          helperText="within the last 100 cron runs"
          title="Auto-demotions"
          value={auditRows.length.toLocaleString()}
        />
        <AdminStatCard
          helperText="still capping a scope"
          title="Active overrides"
          value={activeOverrides.toLocaleString()}
        />
        <AdminStatCard
          helperText="ATSAutomationPosture flipped to GRAY"
          title="Posture flips"
          value={recentFlips.length.toLocaleString()}
        />
      </div>

      <div className="rounded-lg border border-white/[0.06] bg-white/[0.03]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Host / Signals</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {auditRows.map(row => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground whitespace-nowrap">
                  {row.createdAt.toLocaleString()}
                </TableCell>
                <TableCell>{formatMetadata(row.metadata)}</TableCell>
                <TableCell className="font-mono text-xs">{row.userId}</TableCell>
                <TableCell>
                  <Badge variant="destructive">{row.action}</Badge>
                </TableCell>
              </TableRow>
            ))}
            {auditRows.length === 0 ? (
              <TableRow>
                <TableCell className="text-muted-foreground" colSpan={4}>
                  No detection-health actions yet. The cron runs every 15
                  minutes (register in vercel.json once merged).
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </AdminPageShell>
  );
}
