import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { db } from '@/lib/db/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    console.log('API: User authenticated:', !!user?.id);
    
    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    console.log('API: Looking for job with ID:', id, 'for user:', user.id);

    const job = await db.jobListing.findFirst({
      where: {
        id,
        userId: user.id,
      },
    });

    console.log('API: Job found:', !!job);

    if (!job) {
      // Let's also try to find the job without user filter to see if it exists at all
      const jobExists = await db.jobListing.findFirst({
        where: { id },
        select: { id: true, userId: true }
      });
      console.log('API: Job exists in DB:', !!jobExists, jobExists ? `but belongs to user ${jobExists.userId}` : '');
      
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (error) {
    console.error('Error fetching job:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
