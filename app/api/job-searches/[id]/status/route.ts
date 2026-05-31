import { NextRequest, NextResponse } from 'next/server';

import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  const jobSearch = await db.jobSearch.findUnique({
    where: { id, userId: user.id },
    select: { status: true },
  });

  if (!jobSearch) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({ status: jobSearch.status });
}
