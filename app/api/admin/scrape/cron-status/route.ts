import { type Prisma } from '@/generated/prisma/browser';
import { Vercel } from '@vercel/sdk';
import { NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

interface VercelCronConfig {
  path?: string;
  schedule?: string;
}

interface CronRunMetadata {
  apiRequests?: number;
  created?: number;
  error?: string;
  fetched?: number;
  maxPages?: number;
  mode?: string;
  provider?: string;
  startedAt?: string;
  trigger?: string;
  updated?: number;
}

interface ProviderCronStatus {
  lastError: string | null;
  lastRunAt: string | null;
  lastStatus: 'error' | 'success' | 'unknown';
  schedule: string | null;
  provider: 'fantastic' | 'serpapi';
  recentApiRequests: number;
  recentCreated: number;
  recentFetched: number;
  recentUpdated: number;
}

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
};

const readVercelCloudCronConfig = async (): Promise<
  VercelCronConfig[] | null
> => {
  const token = process.env.VERCEL_API_TOKEN || process.env.VERCEL_TOKEN;
  const teamId = process.env.VERCEL_TEAM_ID || process.env.VERCEL_ORG_ID;

  if (!token) return null;

  const vercel = new Vercel({ bearerToken: token });

  try {
    const projectId = process.env.VERCEL_PROJECT_ID ?? undefined;

    // Get latest production deployment
    const { deployments } = await vercel.deployments.getDeployments({
      projectId,
      target: 'production',
      limit: 1,
      state: 'READY',
      ...(teamId ? { teamId } : {}),
    });

    const latestUid = deployments?.[0]?.uid;
    if (!latestUid) return null;

    // Get deployment details which include crons
    const deployment = await vercel.deployments.getDeployment({
      idOrUrl: latestUid,
      ...(teamId ? { teamId } : {}),
    });

    if (
      'crons' in deployment &&
      Array.isArray(deployment.crons) &&
      deployment.crons.length > 0
    ) {
      return deployment.crons.map((c: { path: string; schedule: string }) => ({
        path: c.path,
        schedule: c.schedule,
      }));
    }

    return null;
  } catch {
    return null;
  }
};

const getScheduleByProvider = ({
  crons,
  provider,
}: {
  crons: VercelCronConfig[];
  provider: 'fantastic' | 'serpapi';
}): string | null => {
  const cron = crons.find(entry => {
    if (!entry.path) {
      return false;
    }

    try {
      const parsedPath = new URL(entry.path, 'https://internal.local');
      return (
        parsedPath.pathname === '/api/admin/scrape/cron' &&
        parsedPath.searchParams.get('provider') === provider
      );
    } catch {
      return false;
    }
  });

  return cron?.schedule ?? null;
};

const parseCronMetadata = (
  metadata: Prisma.JsonValue,
): CronRunMetadata | null => {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  return metadata as CronRunMetadata;
};

export async function GET() {
  const user = await getCurrentUser();

  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const [cloudCrons, cronRuns, allRuns] = await Promise.all([
    readVercelCloudCronConfig(),
    db.automationAuditLog.findMany({
      where: {
        action: 'ingestion_provider_run',
        metadata: {
          path: ['trigger'],
          equals: 'cron',
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        actionType: true,
        createdAt: true,
        metadata: true,
      },
    }),
    // Fallback: also fetch recent runs without trigger filter
    db.automationAuditLog.findMany({
      where: {
        action: 'ingestion_provider_run',
      },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: {
        actionType: true,
        createdAt: true,
        metadata: true,
      },
    }),
  ]);

  const crons = cloudCrons ?? [];

  // Prefer cron-tagged runs; fall back to all runs if none found
  const recentRuns = cronRuns.length > 0 ? cronRuns : allRuns;

  const providers: Array<'fantastic' | 'serpapi'> = ['fantastic', 'serpapi'];

  const statuses: ProviderCronStatus[] = providers.map(provider => {
    const latestRun = recentRuns.find(run => {
      const metadata = parseCronMetadata(run.metadata);
      return metadata?.provider === provider;
    });

    const metadata = latestRun ? parseCronMetadata(latestRun.metadata) : null;

    return {
      provider,
      schedule: getScheduleByProvider({ crons, provider }),
      lastRunAt: latestRun?.createdAt.toISOString() ?? null,
      lastStatus:
        latestRun?.actionType === 'success' || latestRun?.actionType === 'error'
          ? latestRun.actionType
          : 'unknown',
      lastError:
        latestRun?.actionType === 'error' && typeof metadata?.error === 'string'
          ? metadata.error
          : null,
      recentApiRequests: toFiniteNumber(metadata?.apiRequests),
      recentFetched: toFiniteNumber(metadata?.fetched),
      recentCreated: toFiniteNumber(metadata?.created),
      recentUpdated: toFiniteNumber(metadata?.updated),
    };
  });

  return NextResponse.json({
    statuses,
    scheduleSource: cloudCrons ? 'vercel-cloud' : 'not-deployed',
    timezone: 'UTC',
  });
}
