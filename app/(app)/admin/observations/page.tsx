import { db } from '@/lib/db/client';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';

import { ObservationsClient } from './_components/observations-client';

async function safeQuery<T>(
  fn: () => Promise<T>,
  fallback: T | (() => Promise<T>),
): Promise<T> {
  try {
    return await fn();
  } catch {
    return typeof fallback === 'function'
      ? await (fallback as () => Promise<T>)()
      : fallback;
  }
}

export default async function AdminObservationsPage() {
  await requireAdminUser();

  const now = Date.now();
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalObservations,
    continueCount,
    skipCount,
    observations7d,
    uniqueHostnames,
    totalRules,
    degradedRules,
    hostnameBreakdown,
    observations,
    rules,
  ] = await Promise.all([
    db.aTSFieldObservation.count(),
    db.aTSFieldObservation.count({ where: { action: 'continue' } }),
    db.aTSFieldObservation.count({ where: { action: 'ignore' } }),
    db.aTSFieldObservation.count({ where: { createdAt: { gte: day7 } } }),
    db.aTSFieldObservation.groupBy({ by: ['hostname'] }).then(r => r.length),
    safeQuery(() => db.aTSRule.count({ where: { enabled: true } }), 0),
    safeQuery(() => db.aTSRule.count({ where: { enabled: true, consecutiveFailures: { gt: 0 } } }), 0),
    db.aTSFieldObservation.groupBy({
      by: ['hostname'],
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 10,
    }),
    safeQuery(
      () =>
        db.aTSFieldObservation.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            hostname: true,
            pathname: true,
            selector: true,
            stableSelector: true,
            tagName: true,
            inputType: true,
            fieldName: true,
            fieldId: true,
            fieldLabel: true,
            ariaLabel: true,
            role: true,
            action: true,
            actionType: true,
            aiReason: true,
            valueFilled: true,
            success: true,
            observationCount: true,
            stepIndex: true,
            createdAt: true,
            updatedAt: true,
            atsSystem: { select: { name: true } },
          },
        }),
      // Fallback: query with only columns that exist pre-migration
      () =>
        db.aTSFieldObservation
          .findMany({
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
              id: true,
              hostname: true,
              pathname: true,
              selector: true,
              tagName: true,
              inputType: true,
              fieldName: true,
              fieldId: true,
              fieldLabel: true,
              ariaLabel: true,
              action: true,
              actionType: true,
              aiReason: true,
              valueFilled: true,
              success: true,
              createdAt: true,
              atsSystem: { select: { name: true } },
            },
          })
          .then(rows =>
            rows.map(r => ({
              ...r,
              stableSelector: null as string | null,
              role: null as string | null,
              observationCount: 1,
              stepIndex: 0,
              updatedAt: r.createdAt,
            })),
          ),
    ),
    safeQuery(
      () =>
        db.aTSRule.findMany({
          where: { enabled: true },
          orderBy: [{ hostname: 'asc' }, { stepIndex: 'asc' }],
          take: 100,
          select: {
            id: true,
            hostname: true,
            stableSelector: true,
            action: true,
            actionType: true,
            tagName: true,
            fieldName: true,
            fieldLabel: true,
            ariaLabel: true,
            role: true,
            stepIndex: true,
            reason: true,
            observationCount: true,
            confidence: true,
            consecutiveFailures: true,
            enabled: true,
            atsSystem: { select: { name: true } },
          },
        }),
      [],
    ),
  ]);

  const continueRate =
    totalObservations > 0
      ? Math.round((continueCount / totalObservations) * 100)
      : 0;

  return (
    <AdminPageShell
      title="ATS Field Observations"
      description="Recorded field interactions from assist mode. Observations are deduplicated and auto-promoted to rules after repeated confirmation."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <AdminStatCard
          title="Unique Observations"
          value={totalObservations.toLocaleString()}
        />
        <AdminStatCard
          title="Continue Actions"
          value={continueCount.toLocaleString()}
        />
        <AdminStatCard
          title="Ignore Actions"
          value={skipCount.toLocaleString()}
        />
        <AdminStatCard
          title="Continue Rate"
          value={`${continueRate}%`}
          helperText={`${observations7d.toLocaleString()} in last 7d`}
        />
        <AdminStatCard
          title="Unique Hostnames"
          value={uniqueHostnames.toLocaleString()}
        />
        <AdminStatCard
          title="Active Rules"
          value={totalRules.toLocaleString()}
          helperText={degradedRules > 0 ? `${degradedRules} degraded` : 'Auto-promoted from observations'}
        />
      </div>

      <ObservationsClient
        observations={observations.map(obs => ({
          ...obs,
          createdAt: obs.createdAt.toISOString(),
          updatedAt: obs.updatedAt.toISOString(),
        }))}
        rules={rules}
        hostnameBreakdown={hostnameBreakdown}
      />
    </AdminPageShell>
  );
}
