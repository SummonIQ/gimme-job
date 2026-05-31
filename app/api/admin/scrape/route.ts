import { guardRouteAction } from '@summoniq/nextjs-dev-api-guard';
import { after, type NextRequest, NextResponse } from 'next/server';

import { Prisma } from '@/generated/prisma/browser';
import {
  isAdminUser,
  registerScrapeSession,
  runAdminScrape,
  type ScrapeMode,
  type ScrapeProvider,
} from '@/lib/admin/scrape-service';
import {
  getFantasticUsageBudget,
  getProviderUsageBudgets,
  getSerpApiUsageBudget,
} from '@/lib/admin/usage-budget';
import { playwrightEnabled } from '@/lib/browser/playwright-runtime';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

const VALID_PROVIDERS: ScrapeProvider[] = [
  'careerbuilder',
  'builtin',
  'fantastic',
  'serpapi',
  'themuse',
  'usajobs',
  'welcometothejungle',
  'workatastartup',
  'weworkremotely',
  'remoteok',
  'jobicy',
  'remotive',
  'himalayas',
  'arbeitnow',
  'remotefirstjobs',
  'remotejobs-org',
  'clawjobs',
  'comeet-boards',
  'theirstack',
  'jobdataapi',
  'findwork',
  'adzuna',
  'jooble',
  'devitjobs',
  'workingnomads',
  'hackernews',
  'openjobs',
  'nodesk',
  'jobspresso',
  'python-org',
  'django-job-board',
  'greenhouse-boards',
  'lever-boards',
  'ashby-boards',
  'smartrecruiters-boards',
  'recruitee-boards',
  'workable-boards',
  'teamtailor-boards',
  'bamboohr-boards',
  'personio-boards',
  'pallet-boards',
  'pinpoint-boards',
  'workday-boards',
  'breezy-boards',
  'jobvite-boards',
  'jazzhr-boards',
  'crunchboard',
  'linkedin-guest',
  'indeed-scraper',
];
const VALID_MODES: ScrapeMode[] = ['sync', 'weekly', 'backfill'];

const PROVIDER_REQUIRED_ENV: Partial<Record<ScrapeProvider, string>> = {
  findwork: 'FINDWORK_API_KEY',
  jobdataapi: 'JOBDATAAPI_KEY',
  theirstack: 'THEIRSTACK_API_KEY',
};

const getProviderMaxPagesLimit = (provider: ScrapeProvider): number => {
  if (provider === 'jobicy') {
    return 100;
  }

  if (provider === 'theirstack') {
    return 5;
  }

  return 50;
};

const getProviderUnavailableReason = (
  provider: ScrapeProvider,
): string | null => {
  if (provider === 'indeed-scraper' && !playwrightEnabled) {
    return 'Indeed scraper requires a Chromium runtime. Run a worker with ENABLE_PLAYWRIGHT_RENDER=1 (Railway/Fly/DO/VPS) or point the app at a remote browser service.';
  }

  const requiredEnv = PROVIDER_REQUIRED_ENV[provider];
  if (requiredEnv && !process.env[requiredEnv]) {
    return `Set ${requiredEnv} to run this provider.`;
  }

  return null;
};
interface LastAttemptGetterInput {
  actorId: string;
}

interface LastAttemptSetterInput {
  actorId: string;
  attemptMs: number;
}

const lastScrapeStartByUser = new Map<string, number>();
const cancelledScrapeIds = new Set<string>();

export function isScrapeIdCancelled(scrapeId: string): boolean {
  return cancelledScrapeIds.has(scrapeId);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdminUser(user.email))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const guarded = await guardRouteAction({
      actionName: 'admin_scrape_start',
      actorId: user.id,
      devEnabledEnvVar: 'ALLOW_DEV_SCRAPE',
      cooldownEnvVar: 'ADMIN_SCRAPE_COOLDOWN_SECONDS',
      defaultCooldownSeconds: 45,
      getLastAttemptMs: async ({ actorId }: LastAttemptGetterInput) => {
        const lastInMemoryStart = lastScrapeStartByUser.get(actorId) ?? null;

        const latestRun = await db.automationAuditLog.findFirst({
          where: {
            action: 'ingestion_run_started',
            userId: actorId,
          },
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            createdAt: true,
          },
        });

        const latestRunMs = latestRun?.createdAt.getTime() ?? null;

        if (lastInMemoryStart === null) {
          return latestRunMs;
        }

        if (latestRunMs === null) {
          return lastInMemoryStart;
        }

        return Math.max(lastInMemoryStart, latestRunMs);
      },
      setLastAttemptMs: async ({
        actorId,
        attemptMs,
      }: LastAttemptSetterInput) => {
        lastScrapeStartByUser.set(actorId, attemptMs);
      },
    });

    if (!guarded.ok) {
      return guarded.response;
    }

    const body = (await request.json()) as {
      providerOverrides?: Record<
        string,
        {
          insertAnyway?: boolean;
          location?: string;
          maxPages?: number;
          postedWithin?: string;
          remote?: boolean;
          searchTerm?: string;
        }
      >;
      mode?: string;
      providers?: string[];
      searchTerm?: string;
      location?: string;
      postedWithin?: string;
      insertAnyway?: boolean;
      remote?: boolean;
      maxPages?: number;
      city?: string;
      stateCode?: string;
      country?: string;
      globalDateRange?: string;
    };

    const mode = VALID_MODES.includes(body.mode as ScrapeMode)
      ? (body.mode as ScrapeMode)
      : 'sync';

    let providers = (body.providers ?? ['fantastic']).filter(
      (p): p is ScrapeProvider => VALID_PROVIDERS.includes(p as ScrapeProvider),
    );

    if (providers.length === 0) {
      return NextResponse.json(
        {
          error: `At least one valid provider required (${VALID_PROVIDERS.join(', ')})`,
        },
        { status: 400 },
      );
    }

    const unavailableProviders = providers
      .map(provider => ({
        provider,
        reason: getProviderUnavailableReason(provider),
      }))
      .filter(
        (entry): entry is { provider: ScrapeProvider; reason: string } =>
          entry.reason !== null,
      );

    if (unavailableProviders.length > 0) {
      if (providers.length > 1) {
        const unavailableProviderSet = new Set(
          unavailableProviders.map(entry => entry.provider),
        );
        providers = providers.filter(
          provider => !unavailableProviderSet.has(provider),
        );
      } else {
        return NextResponse.json(
          {
            error: unavailableProviders[0]?.reason,
          },
          { status: 400 },
        );
      }
    }

    if (providers.length === 0) {
      return NextResponse.json(
        {
          error: 'No runnable providers available for this environment.',
        },
        { status: 400 },
      );
    }

    const maxPagesLimit =
      providers.length === 1 ? getProviderMaxPagesLimit(providers[0]) : 50;
    const maxPages = Math.min(Math.max(body.maxPages ?? 10, 1), maxPagesLimit);
    const location = body.location?.trim() || undefined;
    const postedWithin = body.postedWithin?.trim() || undefined;
    const providerOverrides = Object.fromEntries(
      Object.entries(body.providerOverrides ?? {})
        .filter(([provider]) =>
          VALID_PROVIDERS.includes(provider as ScrapeProvider),
        )
        .map(([provider, override]) => {
          const typedProvider = provider as ScrapeProvider;

          return [
            typedProvider,
            {
              insertAnyway:
                typeof override.insertAnyway === 'boolean'
                  ? override.insertAnyway
                  : undefined,
              location: override.location?.trim() || undefined,
              maxPages:
                typeof override.maxPages === 'number'
                  ? Math.min(
                      Math.max(override.maxPages, 1),
                      getProviderMaxPagesLimit(typedProvider),
                    )
                  : undefined,
              postedWithin: override.postedWithin?.trim() || undefined,
              remote:
                typeof override.remote === 'boolean'
                  ? override.remote
                  : undefined,
              searchTerm: override.searchTerm?.trim() || undefined,
            },
          ];
        }),
    ) as Partial<
      Record<
        ScrapeProvider,
        {
          insertAnyway?: boolean;
          location?: string;
          maxPages?: number;
          postedWithin?: string;
          remote?: boolean;
          searchTerm?: string;
        }
      >
    >;

    const scrapeId = `scrape-${Date.now()}`;
    const trimmedSearchTerm = body.searchTerm?.trim() || undefined;
    const city = body.city?.trim() || undefined;
    const stateCode = body.stateCode?.trim() || undefined;
    const country = body.country?.trim() || undefined;
    const globalDateRange = body.globalDateRange?.trim() || undefined;

    // Pre-create the ScrapeSession so the UI can subscribe to its events as
    // soon as it has the sessionId, and so the manual form snapshot is saved
    // even if the run errors out before the orchestrator gets a chance.
    let sessionId: string | null = null;
    try {
      const session = await db.scrapeSession.create({
        data: {
          city: city ?? null,
          country: country ?? null,
          globalDateRange: globalDateRange ?? null,
          globalMaxPages: maxPages,
          mode,
          providerOverrides:
            Object.keys(providerOverrides).length > 0
              ? (providerOverrides as Prisma.InputJsonValue)
              : Prisma.DbNull,
          providersRequested: providers,
          remote: Boolean(body.remote),
          scrapeId,
          searchTerm: trimmedSearchTerm ?? null,
          stateCode: stateCode ?? null,
          trigger: 'manual',
          userId: user.id,
        },
        select: { id: true },
      });
      sessionId = session.id;
      await registerScrapeSession(scrapeId, sessionId);
    } catch (sessionError) {
      console.error('Failed to pre-create ScrapeSession:', sessionError);
    }

    // Run the scrape in the background using after() so we can return immediately
    after(async () => {
      await runAdminScrape({
        mode,
        providers,
        searchTerm: trimmedSearchTerm,
        location,
        postedWithin,
        insertAnyway: body.insertAnyway,
        remote: body.remote,
        maxPages,
        providerOverrides,
        scrapeId,
        userId: user.id,
      });
    });

    return NextResponse.json({
      message: 'Scrape started',
      mode,
      providers,
      maxPages,
      postedWithin,
      providerOverrides,
      scrapeId,
      sessionId,
    });
  } catch (error) {
    console.error('Admin scrape error:', error);
    return NextResponse.json(
      { error: 'Failed to start scrape' },
      { status: 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdminUser(user.email))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await request.json();
    const scrapeId = body.scrapeId as string | undefined;
    if (!scrapeId) {
      return NextResponse.json(
        { error: 'scrapeId is required' },
        { status: 400 },
      );
    }

    cancelledScrapeIds.add(scrapeId);
    // Auto-clean after 10 minutes
    setTimeout(() => cancelledScrapeIds.delete(scrapeId), 10 * 60 * 1000);

    return NextResponse.json({ cancelled: true, scrapeId });
  } catch (error) {
    console.error('Admin scrape cancel error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel scrape' },
      { status: 500 },
    );
  }
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || !(await isAdminUser(user.email))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Return basic stats about the job listings database
    const [
      totalListings,
      careerBuilderCount,
      builtInCount,
      fantasticCount,
      serpApiCount,
      theMuseCount,
      usaJobsCount,
      welcomeToTheJungleCount,
      workAtStartupCount,
      recentListings,
      usageBudget,
      serpApiUsageBudget,
      providerUsageBudgets,
    ] = await Promise.all([
      db.jobListing.count(),
      db.jobListing.count({ where: { source: 'CareerBuilder' } }),
      db.jobListing.count({ where: { source: 'Built In' } }),
      db.jobListing.count({ where: { jobProvider: 'FANTASTIC_JOBS' } }),
      db.jobListing.count({ where: { jobProvider: 'SERPAPI' } }),
      db.jobListing.count({ where: { source: 'The Muse' } }),
      db.jobListing.count({ where: { jobProvider: 'USAJOBS' } }),
      db.jobListing.count({ where: { source: 'Welcome to the Jungle' } }),
      db.jobListing.count({ where: { source: 'Work at a Startup' } }),
      db.jobListing.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      getFantasticUsageBudget(),
      getSerpApiUsageBudget(),
      getProviderUsageBudgets(),
    ]);

    return NextResponse.json({
      totalListings,
      careerBuilderCount,
      builtInCount,
      fantasticCount,
      serpApiCount,
      theMuseCount,
      usaJobsCount,
      welcomeToTheJungleCount,
      workAtStartupCount,
      recentListings,
      usageBudget,
      serpApiUsageBudget,
      providerUsageBudgets,
    });
  } catch (error) {
    console.error('Admin scrape status error:', error);
    return NextResponse.json(
      { error: 'Failed to get status' },
      { status: 500 },
    );
  }
}
