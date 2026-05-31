import { unauthorized } from 'next/navigation';

import { getUserNotifications } from '@/lib/notifications';
import { getCurrentUser } from '@/lib/user/query';

import PageClient from './page-client';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const initialData = await getUserNotifications(user.id, {
    limit: 10,
    offset: 0,
    includeRead: true,
  });

  return <PageClient userId={user.id} initialData={initialData} />;
}
