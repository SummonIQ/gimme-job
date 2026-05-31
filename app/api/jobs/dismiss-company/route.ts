import { JobListingStatus } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { company } = await request.json();
    if (!company || typeof company !== 'string') {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 },
      );
    }

    const result = await db.jobListing.updateMany({
      where: {
        userId: user.id,
        company: { equals: company, mode: 'insensitive' },
        status: { not: JobListingStatus.DISMISSED },
      },
      data: {
        status: JobListingStatus.DISMISSED,
      },
    });

    return NextResponse.json({
      dismissed: result.count,
      company,
    });
  } catch (error) {
    console.error('Error dismissing company jobs:', error);
    return NextResponse.json(
      { error: 'Failed to dismiss jobs' },
      { status: 500 },
    );
  }
}
