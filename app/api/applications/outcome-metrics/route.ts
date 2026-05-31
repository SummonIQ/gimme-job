import { NextRequest } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth/server';
import { calculateApplicationMetrics } from '@/lib/applications/outcomes';
import { subDays } from 'date-fns';

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session?.user?.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const searchParams = req.nextUrl.searchParams;
  const timeframe = searchParams.get('timeframe') || '30d';
  const startDate = searchParams.get('startDate');
  const endDate = searchParams.get('endDate');

  try {
    let dateRange: { startDate?: Date; endDate?: Date } = {};

    if (startDate && endDate) {
      dateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate),
      };
    } else {
      const now = new Date();
      switch (timeframe) {
        case '7d':
          dateRange = { startDate: subDays(now, 7), endDate: now };
          break;
        case '30d':
          dateRange = { startDate: subDays(now, 30), endDate: now };
          break;
        case '90d':
          dateRange = { startDate: subDays(now, 90), endDate: now };
          break;
        case 'all':
          dateRange = {};
          break;
        default:
          dateRange = { startDate: subDays(now, 30), endDate: now };
      }
    }

    const metrics = await calculateApplicationMetrics(
      session.user.id,
      dateRange,
    );

    return Response.json(metrics);
  } catch (error) {
    console.error('Error calculating outcome metrics:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
