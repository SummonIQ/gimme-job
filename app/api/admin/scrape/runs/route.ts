import { type NextRequest, NextResponse } from 'next/server';

import { isAdminUser } from '@/lib/admin/scrape-service';
import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';

interface RunMetadata {
  apiRequests?: number;
  created?: number;
  error?: string;
  fetched?: number;
  location?: string | null;
  maxPages?: number;
  mode?: string;
  provider?: string;
  scrapeId?: string;
  searchTerm?: string | null;
  skipped?: number;
  startedAt?: string;
  trigger?: string;
  updated?: number;
}

interface RequestLogMetadata {
  page?: number;
  provider?: string;
  requestUrl?: string;
  responseBodyPreview?: string;
  responseStatus?: number;
  scrapeId?: string;
  timestamp?: string;
}

interface ProviderRequestLog {
  createdAt: string;
  page: number;
  requestUrl: string;
  responseBodyPreview: string;
  responseStatus: number;
}

interface ProviderRun {
  action: string;
  apiRequests: number;
  createdAt: string;
  error: string | null;
  jobsCreated: number;
  jobsFetched: number;
  jobsSkipped: number;
  jobsUpdated: number;
  location: string | null;
  logs: ProviderRequestLog[];
  maxPages: number | null;
  mode: string | null;
  scrapeId: string | null;
  searchTerm: string | null;
  startedAt: string | null;
  status: 'error' | 'success' | 'unknown';
  trigger: string | null;
}

const toFiniteNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const toNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !(await isAdminUser(user.email))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const provider = searchParams.get('provider')?.trim().toLowerCase();
  const limit = Math.min(
    Math.max(Number.parseInt(searchParams.get('limit') ?? '25', 10) || 25, 1),
    100,
  );

  if (!provider) {
    return NextResponse.json(
      { error: 'provider query param required' },
      { status: 400 },
    );
  }

  const logs = await db.automationAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      action: true,
      actionType: true,
      createdAt: true,
      metadata: true,
    },
    take: limit,
    where: {
      action: {
        in: ['ingestion_provider_run', 'ingestion_script_provider_run'],
      },
      metadata: {
        equals: provider,
        path: ['provider'],
      },
    },
  });

  const runs = logs.map(log => {
    const metadata: RunMetadata =
      log.metadata && typeof log.metadata === 'object' && !Array.isArray(log.metadata)
        ? (log.metadata as RunMetadata)
        : {};

    return {
      action: log.action,
      apiRequests: toFiniteNumber(metadata.apiRequests),
      createdAt: log.createdAt.toISOString(),
      error: toNullableString(metadata.error),
      jobsCreated: toFiniteNumber(metadata.created),
      jobsFetched: toFiniteNumber(metadata.fetched),
      jobsSkipped: toFiniteNumber(metadata.skipped),
      jobsUpdated: toFiniteNumber(metadata.updated),
      location: toNullableString(metadata.location),
      maxPages:
        typeof metadata.maxPages === 'number' ? metadata.maxPages : null,
      mode: toNullableString(metadata.mode),
      scrapeId: toNullableString(metadata.scrapeId),
      searchTerm: toNullableString(metadata.searchTerm),
      startedAt: toNullableString(metadata.startedAt),
      status:
        log.actionType === 'success' || log.actionType === 'error'
          ? log.actionType
          : 'unknown',
      trigger: toNullableString(metadata.trigger),
    };
  });

  const requestLogRows = await db.automationAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      createdAt: true,
      metadata: true,
    },
    take: Math.min(limit * 40, 1000),
    where: {
      action: 'ingestion_provider_request_log',
      metadata: {
        equals: provider,
        path: ['provider'],
      },
    },
  });

  const requestLogsByScrapeId = new Map<string, ProviderRequestLog[]>();

  for (const row of requestLogRows) {
    const metadata: RequestLogMetadata =
      row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
        ? (row.metadata as RequestLogMetadata)
        : {};

    const scrapeId = toNullableString(metadata.scrapeId);
    if (!scrapeId) continue;

    const entries = requestLogsByScrapeId.get(scrapeId) ?? [];
    entries.push({
      createdAt:
        toNullableString(metadata.timestamp) ?? row.createdAt.toISOString(),
      page: toFiniteNumber(metadata.page),
      requestUrl: toNullableString(metadata.requestUrl) ?? '',
      responseBodyPreview: toNullableString(metadata.responseBodyPreview) ?? '',
      responseStatus: toFiniteNumber(metadata.responseStatus),
    });
    requestLogsByScrapeId.set(scrapeId, entries);
  }

  const runsWithLogs: ProviderRun[] = runs.map(run => ({
    ...run,
    logs: run.scrapeId
      ? (requestLogsByScrapeId.get(run.scrapeId) ?? []).sort((a, b) =>
          a.createdAt.localeCompare(b.createdAt),
        )
      : [],
  }));

  return NextResponse.json({ provider, runs: runsWithLogs });
}
