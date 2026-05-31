import { NextResponse } from 'next/server';

import { getPlanBoardSnapshot } from '@/lib/admin/plan-board';
import { isAdminUser } from '@/lib/admin/scrape-service';
import { getCurrentUser } from '@/lib/user/query';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const snapshot = await getPlanBoardSnapshot();
  return NextResponse.json(snapshot, {
    headers: {
      'Cache-Control': 'no-store, max-age=0',
    },
  });
}
