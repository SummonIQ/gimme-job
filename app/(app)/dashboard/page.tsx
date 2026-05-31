import { getCurrentUser } from '@/lib/user/query';
import { redirect } from 'next/navigation';

import { DashboardClient } from './dashboard-client';

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user?.id) {
    redirect('/login');
  }

  return <DashboardClient />;
}
