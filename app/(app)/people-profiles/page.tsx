import { unauthorized } from 'next/navigation';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

import PageClient from './page-client';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const profiles = await db.peopleProfile.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50,
  });

  return <PageClient initialProfiles={profiles} />;
}
