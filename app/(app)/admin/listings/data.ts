import { JobListingStatus } from '@/generated/prisma/browser';

import { getFantasticUsageBudget } from '@/lib/admin/usage-budget';
import { db } from '@/lib/db/client';

import { requireAdminUser } from '../require-admin-user';

async function getAdminListingsPageData() {
  const user = await requireAdminUser();

  const now = Date.now();
  const day1 = new Date(now - 24 * 60 * 60 * 1000);
  const day7 = new Date(now - 7 * 24 * 60 * 60 * 1000);

  const [
    totalListings,
    unreviewedListings,
    dismissedListings,
    leadsConverted,
    created24h,
    created7d,
    providerBreakdown,
    recentListings,
    usageBudget,
  ] = await Promise.all([
    db.jobListing.count(),
    db.jobListing.count({ where: { status: JobListingStatus.UNREVIEWED } }),
    db.jobListing.count({ where: { status: JobListingStatus.DISMISSED } }),
    db.jobListing.count({ where: { status: JobListingStatus.ADDED_TO_LEADS } }),
    db.jobListing.count({ where: { createdAt: { gte: day1 } } }),
    db.jobListing.count({ where: { createdAt: { gte: day7 } } }),
    db.$queryRaw<Array<{ provider: string | null; count: bigint }>>`
      select "jobBoard"::text as provider, count(*)::bigint as count
      from "JobListing"
      group by 1
      order by 2 desc
    `,
    db.$queryRaw<
      Array<{
        id: string;
        title: string;
        company: string | null;
        provider: string | null;
        status: string;
        createdAt: Date;
      }>
    >`
      select
        id,
        title,
        company,
        "jobBoard"::text as provider,
        status::text as status,
        "createdAt"
      from "JobListing"
      order by "createdAt" desc
      limit 15
    `,
    getFantasticUsageBudget(),
  ]);

  const conversionRate =
    totalListings > 0 ? Math.round((leadsConverted / totalListings) * 100) : 0;

  return {
    analytics: {
      conversionRate,
      created24h,
      created7d,
      dismissedListings,
      leadsConverted,
      providerBreakdown: providerBreakdown.map(row => ({
        count: Number(row.count),
        percentage:
          totalListings > 0
            ? Math.round((Number(row.count) / totalListings) * 100)
            : 0,
        provider: row.provider ?? 'UNKNOWN',
      })),
      recentListings: recentListings.map(listing => ({
        company: listing.company,
        createdAt: listing.createdAt.toISOString(),
        id: listing.id,
        provider: listing.provider,
        status: listing.status,
        title: listing.title,
      })),
      totalListings,
      unreviewedListings,
    },
    usageBudget: {
      jobsLimit: usageBudget.jobsLimit,
      jobsRemaining: usageBudget.jobsRemaining,
      jobsUsed: usageBudget.jobsUsed,
      requestsLimit: usageBudget.requestsLimit,
      requestsRemaining: usageBudget.requestsRemaining,
      requestsUsed: usageBudget.requestsUsed,
    },
    userId: user.id,
  };
}

export { getAdminListingsPageData };
