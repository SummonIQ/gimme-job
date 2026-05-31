import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scheduled = await db.automationScheduledApplication.findMany({
      where: {
        userId: user.id,
        status: { in: ['scheduled', 'processing'] },
        scheduledFor: {
          gte: new Date(),
        },
      },
      include: {
        jobLead: {
          select: {
            jobListing: {
              select: {
                title: true,
                company: true,
                source: true,
              },
            },
          },
        },
      },
      orderBy: [{ scheduledFor: 'asc' }, { priority: 'desc' }],
      take: 50,
    });

    const applications = scheduled.map(app => ({
      id: app.id,
      jobLeadId: app.jobLeadId,
      jobTitle: app.jobLead.jobListing.title,
      companyName: app.jobLead.jobListing.company,
      platform: app.jobLead.jobListing.source,
      scheduledFor: app.scheduledFor.toISOString(),
      priority: app.priority,
      status: app.status,
      optimalityScore: (app.metadata as any)?.optimalityScore,
      metadata: app.metadata as any,
    }));

    return NextResponse.json({ applications });
  } catch (error) {
    console.error('Error fetching scheduled applications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduled applications' },
      { status: 500 },
    );
  }
}
