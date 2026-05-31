import { redirect } from 'next/navigation';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { getCurrentUser } from '@/lib/user/query';

export const requireAdminUser = async () => {
  const user = await getCurrentUser();

  if (!user || !(await isAdminUser(user.email))) {
    redirect('/dashboard');
  }

  return user;
};
