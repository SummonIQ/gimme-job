import Link from 'next/link';

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

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

interface UserActivityRow {
  readonly desktopActions30d: number;
  readonly displayName: string;
  readonly email: string;
  readonly id: string;
  readonly lastDesktopAt: Date | null;
  readonly lastWebAt: Date | null;
  readonly trainingContributions: number;
  readonly webSessionsActive: number;
}

function formatRelative(date: Date | null): string {
  if (!date) return '—';
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

function pickLatest(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() > b.getTime() ? a : b;
}

export default async function AdminUserActivityPage() {
  await requireAdminUser();

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - THIRTY_DAYS_MS);

  const [
    users,
    activeSessionGroups,
    webLastSeenGroups,
    desktopActivityGroups,
    runtimeSessionGroups,
    feedbackGroups,
    fieldRuleGroups,
  ] = await Promise.all([
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        email: true,
        firstName: true,
        id: true,
        lastName: true,
      },
    }),
    db.session.groupBy({
      _count: { _all: true },
      by: ['userId'],
      where: { expiresAt: { gt: now } },
    }),
    db.session.groupBy({
      _max: { updatedAt: true },
      by: ['userId'],
    }),
    db.desktopAuditLog.groupBy({
      _count: { _all: true },
      _max: { createdAt: true },
      by: ['userId'],
      where: { createdAt: { gte: thirtyDaysAgo } },
    }),
    db.applicationRuntimeSession.groupBy({
      _max: { updatedAt: true },
      by: ['userId'],
    }),
    db.formFieldFeedback.groupBy({
      _count: { _all: true },
      by: ['userId'],
    }),
    db.userFieldRule.groupBy({
      _count: { _all: true },
      by: ['userId'],
    }),
  ]);

  const sessionsByUser = new Map(
    activeSessionGroups.map(g => [g.userId, g._count._all]),
  );
  const webLastByUser = new Map(
    webLastSeenGroups.map(g => [g.userId, g._max.updatedAt]),
  );
  const desktopCountByUser = new Map(
    desktopActivityGroups.map(g => [g.userId, g._count._all]),
  );
  const desktopLastByUser = new Map(
    desktopActivityGroups.map(g => [g.userId, g._max.createdAt]),
  );
  const runtimeLastByUser = new Map(
    runtimeSessionGroups.map(g => [g.userId, g._max.updatedAt]),
  );
  const feedbackByUser = new Map(
    feedbackGroups.map(g => [g.userId, g._count._all]),
  );
  const rulesByUser = new Map(fieldRuleGroups.map(g => [g.userId, g._count._all]));

  const rows: readonly UserActivityRow[] = users.map(user => {
    const lastDesktop = pickLatest(
      desktopLastByUser.get(user.id) ?? null,
      runtimeLastByUser.get(user.id) ?? null,
    );
    return {
      desktopActions30d: desktopCountByUser.get(user.id) ?? 0,
      displayName:
        `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email,
      email: user.email,
      id: user.id,
      lastDesktopAt: lastDesktop,
      lastWebAt: webLastByUser.get(user.id) ?? null,
      trainingContributions:
        (feedbackByUser.get(user.id) ?? 0) + (rulesByUser.get(user.id) ?? 0),
      webSessionsActive: sessionsByUser.get(user.id) ?? 0,
    };
  });

  const ordered = [...rows].sort((left, right) => {
    const lLast = pickLatest(left.lastWebAt, left.lastDesktopAt)?.getTime() ?? 0;
    const rLast = pickLatest(right.lastWebAt, right.lastDesktopAt)?.getTime() ?? 0;
    return rLast - lLast;
  });

  const totalUsers = users.length;
  const signedInNow = activeSessionGroups.length;
  const activeOnDesktop30d = desktopActivityGroups.length;
  const trainers = new Set([
    ...feedbackGroups.map(g => g.userId),
    ...fieldRuleGroups.map(g => g.userId),
  ]).size;

  return (
    <AdminPageShell
      title="User Activity"
      description="Web sessions, desktop activity, and training contributions per user."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard title="Total Users" value={totalUsers.toLocaleString()} />
        <AdminStatCard
          title="Signed In Now"
          value={signedInNow.toLocaleString()}
          helperText="users with an unexpired web session"
        />
        <AdminStatCard
          title="Desktop Active (30d)"
          value={activeOnDesktop30d.toLocaleString()}
        />
        <AdminStatCard
          title="Trainers"
          value={trainers.toLocaleString()}
          helperText="users who corrected fields or saved rules"
        />
      </div>

      <div className="rounded-lg border border-border/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Last web</TableHead>
              <TableHead>Last desktop</TableHead>
              <TableHead className="text-right">Web sessions</TableHead>
              <TableHead className="text-right">Desktop (30d)</TableHead>
              <TableHead className="text-right">Training</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ordered.map(row => (
              <TableRow key={row.id}>
                <TableCell>
                  <Link
                    href={`/admin/user-activity/${row.id}`}
                    className="font-medium hover:underline"
                  >
                    {row.displayName}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {row.email}
                  </div>
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatRelative(row.lastWebAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-sm">
                  {formatRelative(row.lastDesktopAt)}
                </TableCell>
                <TableCell className="text-right">
                  {row.webSessionsActive > 0 ? (
                    <Badge variant="default">{row.webSessionsActive}</Badge>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.desktopActions30d.toLocaleString()}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.trainingContributions > 0 ? (
                    <span className="font-medium">
                      {row.trainingContributions.toLocaleString()}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AdminPageShell>
  );
}
