import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/db/client';

import { AdminPageShell } from '../_components/admin-page-shell';
import { AdminStatCard } from '../_components/admin-stat-card';
import { requireAdminUser } from '../require-admin-user';

export default async function AdminUsersPage() {
  await requireAdminUser();

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    verifiedUsers,
    usersWithProfile,
    newUsers7d,
    activeSubscriptions,
    recentUsers,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { emailVerified: true } }),
    db.user.count({ where: { profile: { isNot: null } } }),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.subscription.count({
      where: {
        status: { in: ['active', 'trialing', 'past_due'] },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: {
        createdAt: true,
        email: true,
        emailVerified: true,
        firstName: true,
        id: true,
        lastName: true,
        subscription: {
          select: {
            plan: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const verifiedPercent =
    totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0;
  const profilePercent =
    totalUsers > 0 ? Math.round((usersWithProfile / totalUsers) * 100) : 0;

  return (
    <AdminPageShell
      title="Users"
      description="User growth, verification, and subscription health."
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <AdminStatCard
          title="Total Users"
          value={totalUsers.toLocaleString()}
        />
        <AdminStatCard
          title="New (7 Days)"
          value={newUsers7d.toLocaleString()}
        />
        <AdminStatCard
          title="Verified Emails"
          value={`${verifiedPercent}%`}
          helperText={`${verifiedUsers.toLocaleString()} verified`}
        />
        <AdminStatCard
          title="Profiles Completed"
          value={`${profilePercent}%`}
          helperText={`${usersWithProfile.toLocaleString()} users`}
        />
        <AdminStatCard
          title="Paid / Active"
          value={activeSubscriptions.toLocaleString()}
        />
      </div>

      <div>
        <h2 className="text-lg font-semibold">Recent Signups</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Newest 12 accounts on the platform.
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {recentUsers.map(user => (
            <div
              key={user.id}
              className="rounded-lg border border-border/60 p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">
                    {`${user.firstName} ${user.lastName}`.trim() || '—'}
                  </p>
                  <p className="truncate text-sm text-muted-foreground">
                    {user.email}
                  </p>
                </div>
                <Badge
                  variant={user.emailVerified ? 'default' : 'secondary'}
                  className="shrink-0"
                >
                  {user.emailVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {user.subscription
                    ? `${user.subscription.plan} · ${user.subscription.status}`
                    : 'Free'}
                </span>
                <span>{new Date(user.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AdminPageShell>
  );
}
