import { createAnalyticsPeriod, getUserAnalytics } from '@/lib/analytics';

import PageClient from './page-client';

export default async function Page() {
  const initialData = await getUserAnalytics(createAnalyticsPeriod(90));

  return <PageClient initialData={initialData} />;
}
