import { subDays } from 'date-fns';
import { unauthorized } from 'next/navigation';

import { calculateApplicationMetrics } from '@/lib/applications/outcomes';
import { getCurrentUser } from '@/lib/user/query';

import PageClient from './page-client';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const now = new Date();
  const rawMetrics = await calculateApplicationMetrics(user.id, {
    startDate: subDays(now, 30),
    endDate: now,
  });

  // Serialize Date objects for the client boundary
  const initialMetrics = {
    ...rawMetrics,
    timeSeriesData: rawMetrics.timeSeriesData.map(d => ({
      ...d,
      date: d.date.toISOString(),
    })),
  };

  return <PageClient initialMetrics={initialMetrics} />;
}
