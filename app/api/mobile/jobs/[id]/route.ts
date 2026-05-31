import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const job = await db.jobListing.findUnique({
      where: { id, userId: user.id },
    });

    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Failed to get job:', error);
    return NextResponse.json(
      { error: 'Failed to get job' },
      { status: 500 },
    );
  }
}
