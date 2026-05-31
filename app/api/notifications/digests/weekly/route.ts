import { NextRequest, NextResponse } from 'next/server';
import { processWeeklyDigests } from '@/lib/notifications/batching';

/**
 * Weekly digest cron job endpoint
 * Should be called weekly on Monday at 9 AM via a cron service (Vercel Cron, GitHub Actions, etc.)
 *
 * Example cron expression: "0 9 * * 1"
 */
export async function POST(request: NextRequest) {
  try {
    // Verify authorization token to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      console.error('[CRON] CRON_SECRET not configured');
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error('[CRON] Unauthorized digest processing attempt');
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    console.log('[CRON] Starting weekly digest processing...');
    await processWeeklyDigests();
    console.log('[CRON] Weekly digest processing completed');

    return NextResponse.json({
      success: true,
      message: 'Weekly digests processed successfully'
    });
  } catch (error) {
    console.error('[CRON] Error processing weekly digests:', error);
    return NextResponse.json(
      {
        error: 'Failed to process weekly digests',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Allow GET for testing in development
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'Method not allowed in production' },
      { status: 405 }
    );
  }

  return POST(request);
}
