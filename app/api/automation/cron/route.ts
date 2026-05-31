import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { processScheduledApplications } from '@/lib/automation/scheduling';

// This endpoint should be secured with a secret token in production
const CRON_SECRET = process.env.CRON_SECRET;

export async function POST(request: Request) {
  try {
    // Verify cron secret if configured
    if (CRON_SECRET) {
      const headersList = await headers();
      const authHeader = headersList.get('authorization');
      
      if (!authHeader || authHeader !== `Bearer ${CRON_SECRET}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Process scheduled applications
    await processScheduledApplications();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron job error:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled applications' },
      { status: 500 }
    );
  }
}

// GET endpoint for monitoring/health checks
export async function GET(request: Request) {
  return NextResponse.json({
    status: 'ok',
    message: 'Scheduler cron endpoint is running',
    timestamp: new Date().toISOString(),
  });
}