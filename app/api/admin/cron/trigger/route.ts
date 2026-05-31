import { type NextRequest, NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { getCurrentUser } from '@/lib/user/query';

/**
 * Manually trigger any cron job by its path.
 * Only accessible by admin users.
 */
export async function POST(request: NextRequest) {
  const user = await getCurrentUser();

  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const body = (await request.json()) as { path?: string };
  const cronPath = body.path;

  if (!cronPath || typeof cronPath !== 'string') {
    return NextResponse.json(
      { error: 'Missing required field: path' },
      { status: 400 },
    );
  }

  // Allowlist of cron paths that can be triggered
  const allowedPrefixes = [
    '/api/admin/scrape/cron',
    '/api/admin/cron/fail-stuck-leads',
    '/api/notifications/digests/daily',
    '/api/notifications/digests/weekly',
  ];

  const parsedPath = (() => {
    try {
      return new URL(cronPath, 'https://internal.local');
    } catch {
      return null;
    }
  })();

  if (
    !parsedPath ||
    !allowedPrefixes.some(prefix => parsedPath.pathname.startsWith(prefix))
  ) {
    return NextResponse.json(
      { error: 'Path not in allowed cron paths' },
      { status: 400 },
    );
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}`
        : 'http://localhost:10100');

    const targetUrl = new URL(cronPath, baseUrl);

    // Determine method — scrape cron uses GET, digests use POST
    const isScrape = parsedPath.pathname.startsWith('/api/admin/scrape/cron');
    const method = isScrape ? 'GET' : 'POST';

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add CRON_SECRET if available
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      headers['authorization'] = `Bearer ${cronSecret}`;
    }

    const response = await fetch(targetUrl.toString(), { method, headers });
    const data = await response.json().catch(() => ({}));

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      path: cronPath,
      result: data,
      triggeredAt: new Date().toISOString(),
      triggeredBy: user.email,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Failed to trigger cron job',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
