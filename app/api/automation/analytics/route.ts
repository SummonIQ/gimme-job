import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { getAutomationMetrics, getHistoricalData } from '@/lib/automation/analytics';

export async function GET(request: Request) {
  try {
    const session = await auth.api.getSession({
    headers: await headers(),
  });
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateRange = searchParams.get('range') as 'day' | 'week' | 'month' || 'week';

    const metrics = await getAutomationMetrics(session.user.id, dateRange);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error('Error fetching automation metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch automation metrics' },
      { status: 500 }
    );
  }
}