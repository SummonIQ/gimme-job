import { unauthorized } from 'next/navigation';

import { getUserNotificationPreferences } from '@/lib/notifications';
import { getCurrentUser } from '@/lib/user/query';

import PageClient from './page-client';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const preferences = await getUserNotificationPreferences(user.id);

  return <PageClient userId={user.id} initialPreferences={preferences} />;
}
