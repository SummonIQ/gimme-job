import { NextResponse } from 'next/server';
import { processScheduledApplications } from '@/lib/automation/scheduling';

export async function POST(request: Request) {
  try {
    // This endpoint is typically called by cron jobs or internal processes
    // In production, you'd want to add authentication/authorization for this endpoint

    const { searchParams } = new URL(request.url);
    const force = searchParams.get('force') === 'true';

    // Process scheduled applications that are due
    await processScheduledApplications();

    return NextResponse.json({
      message: 'Scheduled applications processed successfully',
      processed: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to process scheduled applications:', error);
    return NextResponse.json(
      { error: 'Failed to process scheduled applications' },
      { status: 500 }
    );
  }
}