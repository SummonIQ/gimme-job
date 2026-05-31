import { notFound } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../../_components/admin-page-shell';
import { requireAdminUser } from '../../require-admin-user';

interface PageProps {
  readonly params: Promise<{ readonly userId: string }>;
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

function truncate(value: string | null, length = 80): string {
  if (!value) return '—';
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1)}…`;
}

export default async function AdminUserActivityDetailPage({ params }: PageProps) {
  await requireAdminUser();
  const { userId } = await params;

  const user = await db.user.findUnique({
    select: {
      createdAt: true,
      email: true,
      emailVerified: true,
      firstName: true,
      id: true,
      lastName: true,
      subscription: { select: { plan: true, status: true } },
    },
    where: { id: userId },
  });
  if (!user) notFound();

  const now = new Date();

  const [
    sessions,
    desktopLogs,
    runtimeSessions,
    feedback,
    rules,
  ] = await Promise.all([
    db.session.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        createdAt: true,
        expiresAt: true,
        id: true,
        ipAddress: true,
        updatedAt: true,
        userAgent: true,
      },
      take: 20,
      where: { userId },
    }),
    db.desktopAuditLog.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        action: true,
        createdAt: true,
        durationMs: true,
        errorMessage: true,
        id: true,
        outcome: true,
        toolName: true,
      },
      take: 25,
      where: { userId },
    }),
    db.applicationRuntimeSession.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        currentUrl: true,
        guidedApplication: {
          select: { company: true, jobTitle: true },
        },
        id: true,
        mode: true,
        startedAt: true,
        status: true,
        updatedAt: true,
      },
      take: 15,
      where: { userId },
    }),
    db.formFieldFeedback.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        createdAt: true,
        feedback: true,
        fieldLabel: true,
        hostname: true,
        id: true,
        status: true,
      },
      take: 25,
      where: { userId },
    }),
    db.userFieldRule.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        answer: true,
        hostname: true,
        id: true,
        question: true,
        source: true,
        updatedAt: true,
      },
      take: 25,
      where: { userId },
    }),
  ]);

  const activeSessionCount = sessions.filter(
    s => s.expiresAt.getTime() > now.getTime(),
  ).length;
  const displayName =
    `${user.firstName ?? ''} ${user.lastName ?? ''}`.trim() || user.email;

  return (
    <AdminPageShell
      title={displayName}
      description={`${user.email} · joined ${user.createdAt.toLocaleDateString()}${
        user.subscription
          ? ` · ${user.subscription.plan} (${user.subscription.status})`
          : ' · Free'
      }`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={user.emailVerified ? 'default' : 'secondary'}>
          {user.emailVerified ? 'Verified email' : 'Unverified'}
        </Badge>
        <Badge variant={activeSessionCount > 0 ? 'default' : 'outline'}>
          {activeSessionCount} active web session
          {activeSessionCount === 1 ? '' : 's'}
        </Badge>
        <Badge variant="outline">
          {feedback.length + rules.length} training contribution
          {feedback.length + rules.length === 1 ? '' : 's'}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Web sessions</CardTitle>
        </CardHeader>
        <CardContent>
          {sessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No web sessions yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Last seen</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>User agent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map(s => {
                  const active = s.expiresAt.getTime() > now.getTime();
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <Badge variant={active ? 'default' : 'outline'}>
                          {active ? 'Active' : 'Expired'}
                        </Badge>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {formatRelative(s.updatedAt)}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {s.ipAddress ?? '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {truncate(s.userAgent, 60)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Desktop activity</CardTitle>
        </CardHeader>
        <CardContent>
          {desktopLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No desktop activity recorded.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Tool</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Outcome</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {desktopLogs.map(log => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatRelative(log.createdAt)}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {log.toolName}
                    </TableCell>
                    <TableCell className="text-sm">{log.action}</TableCell>
                    <TableCell>
                      {log.outcome ? (
                        <Badge
                          variant={
                            log.outcome === 'ok' ? 'default' : 'destructive'
                          }
                        >
                          {log.outcome}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm tabular-nums">
                      {log.durationMs != null ? `${log.durationMs}ms` : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Runtime sessions (guided applications)</CardTitle>
        </CardHeader>
        <CardContent>
          {runtimeSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No runtime sessions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Job</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runtimeSessions.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatRelative(s.updatedAt)}
                    </TableCell>
                    <TableCell className="text-xs">{s.mode}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{s.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {s.guidedApplication.company} ·{' '}
                      <span className="text-muted-foreground">
                        {s.guidedApplication.jobTitle}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Training contributions</CardTitle>
        </CardHeader>
        <CardContent>
          {feedback.length === 0 && rules.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No training data submitted.
            </p>
          ) : (
            <div className="space-y-6">
              {feedback.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    Field feedback ({feedback.length})
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Feedback</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {feedback.map(f => (
                        <TableRow key={f.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatRelative(f.createdAt)}
                          </TableCell>
                          <TableCell className="text-xs">{f.hostname}</TableCell>
                          <TableCell className="text-sm">
                            {truncate(f.fieldLabel, 40)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {truncate(f.feedback, 60)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              {rules.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-medium">
                    Saved field rules ({rules.length})
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Updated</TableHead>
                        <TableHead>Host</TableHead>
                        <TableHead>Question</TableHead>
                        <TableHead>Source</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rules.map(r => (
                        <TableRow key={r.id}>
                          <TableCell className="whitespace-nowrap text-sm">
                            {formatRelative(r.updatedAt)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {r.hostname ?? 'global'}
                          </TableCell>
                          <TableCell className="text-sm">
                            {truncate(r.question, 50)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {r.source}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </AdminPageShell>
  );
}
