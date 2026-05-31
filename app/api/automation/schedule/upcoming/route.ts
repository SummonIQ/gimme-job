import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { getUpcomingScheduledApplications } from '@/lib/automation/scheduling';

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const status = searchParams.get('status') || 'scheduled';

    const upcomingApplications = await getUpcomingScheduledApplications(user.id, limit);

    // Filter by status if specified
    const filteredApplications = status === 'all'
      ? upcomingApplications
      : upcomingApplications.filter(app => app.status === status);

    return NextResponse.json({
      applications: filteredApplications,
      count: filteredApplications.length,
      totalUpcoming: upcomingApplications.filter(app => app.status === 'scheduled').length,
    });
  } catch (error) {
    console.error('Failed to get upcoming scheduled applications:', error);
    return NextResponse.json(
      { error: 'Failed to get upcoming applications' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { applicationIds } = await request.json();

    if (!applicationIds || !Array.isArray(applicationIds)) {
      return NextResponse.json(
        { error: 'Application IDs are required' },
        { status: 400 }
      );
    }

    const { db } = await import('@/lib/db/client');

    // Cancel scheduled applications
    const result = await db.automationScheduledApplication.updateMany({
      where: {
        id: { in: applicationIds },
        userId: user.id,
        status: 'scheduled',
      },
      data: {
        status: 'cancelled',
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({
      message: `Successfully cancelled ${result.count} scheduled applications`,
      cancelled: result.count,
    });
  } catch (error) {
    console.error('Failed to cancel scheduled applications:', error);
    return NextResponse.json(
      { error: 'Failed to cancel applications' },
      { status: 500 }
    );
  }
}