import { type NextRequest, NextResponse } from 'next/server';

import {
  getAdminUserId,
  runAdminScrape,
  type ScrapeProvider,
} from '@/lib/admin/scrape-service';

/**
 * Cron endpoint for automated job scraping.
 *
 * Fantastic Jobs API strategy (from docs):
 * - 24h endpoint: call at the same time every day → no duplicates
 * - 7d endpoint: call at the same day+time every week → no duplicates
 *
 * This cron runs daily. The scrape-service uses the 24h endpoint for sync.
 *
 * SerpAPI (Developer plan, 5,000 searches/month):
 * - Each page = 1 credit, ~10 results/page
 * - Daily sync: 130 pages = 130 credits/day (~3,900/month, ~1,000 reserved for manual)
 *
 * Protected by CRON_SECRET to prevent unauthorized access.
 */

const getDailyExpandedProviders = (): ScrapeProvider[] => {
  const providers: ScrapeProvider[] = [
    'greenhouse-boards',
    'lever-boards',
    'ashby-boards',
    'smartrecruiters-boards',
    'workday-boards',
    'comeet-boards',
    'breezy-boards',
    'jobvite-boards',
    'jazzhr-boards',
    'remotejobs-org',
    'clawjobs',
    'remoteok',
    'jobicy',
    'remotive',
    'arbeitnow',
    'remotefirstjobs',
    'himalayas',
    'weworkremotely',
    'devitjobs',
    'workingnomads',
    'usajobs',
  ];

  if (process.env.THEIRSTACK_API_KEY) providers.push('theirstack');
  if (process.env.JOBDATAAPI_KEY) providers.push('jobdataapi');
  if (process.env.FINDWORK_API_KEY) providers.push('findwork');

  return providers;
};

const getCronScrapeConfig = (
  provider: string | null,
): { maxPages: number; providers: ScrapeProvider[] } => {
  if (provider === 'serpapi') {
    return { providers: ['serpapi'], maxPages: 130 };
  }

  if (provider === 'fantastic') {
    return { providers: ['fantastic'], maxPages: 5 };
  }

  if (provider === 'usajobs') {
    return { providers: ['usajobs'], maxPages: 5 };
  }

  if (provider === 'daily-expanded') {
    return { providers: getDailyExpandedProviders(), maxPages: 3 };
  }

  return { providers: ['fantastic', 'serpapi'], maxPages: 130 };
};

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sends this header for cron jobs)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userId = await getAdminUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Admin user not found' },
        { status: 404 },
      );
    }

    // Determine which providers to run based on query param
    const provider = request.nextUrl.searchParams.get('provider');
    const { providers, maxPages } = getCronScrapeConfig(provider);

    await runAdminScrape({
      mode: 'sync',
      providers: [...providers],
      maxPages,
      trigger: 'cron',
      userId,
    });

    return NextResponse.json({
      message: 'Cron scrape completed',
      maxPages,
      providers,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron scrape error:', error);
    return NextResponse.json(
      {
        error: 'Cron scrape failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
