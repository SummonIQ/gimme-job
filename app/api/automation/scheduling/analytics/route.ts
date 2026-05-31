import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/user/query';
import { getSchedulingAnalytics } from '@/lib/automation/intelligent-scheduler';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const analytics = await getSchedulingAnalytics(user.id);
    
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Error fetching scheduling analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scheduling analytics' },
      { status: 500 }
    );
  }
}