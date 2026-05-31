import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { config } from './config.js';
import { pingDatabase } from './db.js';
import {
  getStats,
  getJobById,
  listActiveJobs,
  listExpiredJobs,
  listFacets,
  listProviders,
  listUpdatedJobs,
  type JobSearchParams,
} from './jobs.js';
import { openApiDocument } from './openapi.js';
import { getConsumer, rapidApiGuard, resolveLimit } from './rapidapi.js';

const app = new Hono();

const readBoolean = (value: string | null): boolean | undefined => {
  if (value === null) return undefined;
  if (['1', 'true', 'yes'].includes(value.toLowerCase())) return true;
  if (['0', 'false', 'no'].includes(value.toLowerCase())) return false;
  return undefined;
};

const readOptional = (searchParams: URLSearchParams, ...names: string[]): string | undefined => {
  for (const name of names) {
    const value = searchParams.get(name)?.trim();
    if (value) return value;
  }

  return undefined;
};

const readPositiveInteger = (value: string | null): number | undefined => {
  if (value === null) return undefined;

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};

const readSearchParams = (requestUrl: string, limit: number): JobSearchParams => {
  const searchParams = new URL(requestUrl).searchParams;
  const descriptionType = readOptional(searchParams, 'description_type');

  return {
    company: readOptional(searchParams, 'company', 'company_filter', 'organization_filter'),
    createdAfter: readOptional(searchParams, 'created_after', 'indexed_after'),
    cursor: readOptional(searchParams, 'cursor'),
    description: readOptional(searchParams, 'description', 'description_filter'),
    hasSalary: readBoolean(searchParams.get('has_salary') ?? searchParams.get('ai_has_salary')),
    includeDescription:
      searchParams.get('include_description') === 'true' || descriptionType === 'text',
    jobType: readOptional(searchParams, 'job_type', 'employment_type', 'ai_employment_type_filter'),
    limit,
    location: readOptional(searchParams, 'location', 'location_filter'),
    offset: readPositiveInteger(searchParams.get('offset')),
    postedAfter: readOptional(searchParams, 'posted_after', 'date_filter'),
    postedBefore: readOptional(searchParams, 'posted_before'),
    provider: readOptional(searchParams, 'provider'),
    query: readOptional(searchParams, 'q', 'query'),
    remote: readBoolean(searchParams.get('remote')),
    source: readOptional(searchParams, 'raw_source'),
    title: readOptional(searchParams, 'title', 'title_filter'),
    updatedAfter: readOptional(searchParams, 'updated_after', 'modified_after'),
    updatedBefore: readOptional(searchParams, 'updated_before'),
  };
};

const hoursAgo = (hours: number): string =>
  new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

const daysAgo = (days: number): string =>
  new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

const monthsAgo = (months: number): string => {
  const date = new Date();
  date.setMonth(date.getMonth() - months);
  return date.toISOString();
};

const withDefaultWindow = (
  params: JobSearchParams,
  defaults: Pick<JobSearchParams, 'createdAfter' | 'postedAfter' | 'updatedAfter'>,
): JobSearchParams => ({
  ...params,
  createdAfter: params.createdAfter ?? defaults.createdAfter,
  postedAfter: params.postedAfter ?? defaults.postedAfter,
  updatedAfter: params.updatedAfter ?? defaults.updatedAfter,
});

app.use(logger());
app.use(prettyJSON());

app.get('/', context =>
  context.json({
    docs: '/openapi.json',
    health: '/health',
    name: config.serviceName,
    version: '0.1.0',
  }),
);

app.get('/health', async context => {
  try {
    const databaseMs = await pingDatabase();
    return context.json({
      database: 'ok',
      databaseMs,
      status: 'ok',
    });
  } catch {
    return context.json(
      {
        database: 'error',
        status: 'error',
      },
      503,
    );
  }
});

app.get('/openapi.json', context => context.json(openApiDocument));

app.use('/v1/*', rapidApiGuard);

app.get('/v1/jobs', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const response = await listActiveJobs(readSearchParams(context.req.url, limit));
  context.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
    },
  });
});

app.get('/v1/jobs/backfill', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const response = await listActiveJobs(
    withDefaultWindow(readSearchParams(context.req.url, limit), {
      postedAfter: monthsAgo(6),
    }),
  );
  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
      window: '6m',
      windowField: 'postedAt',
    },
  });
});

app.get('/v1/jobs/posted-7d', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const response = await listActiveJobs(
    withDefaultWindow(readSearchParams(context.req.url, limit), {
      postedAfter: daysAgo(7),
    }),
  );
  context.header('Cache-Control', 'public, max-age=120, stale-while-revalidate=600');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
      window: '7d',
      windowField: 'postedAt',
    },
  });
});

app.get('/v1/jobs/indexed-24h', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const response = await listActiveJobs(
    withDefaultWindow(readSearchParams(context.req.url, limit), {
      createdAfter: hoursAgo(24),
    }),
  );
  context.header('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
      window: '24h',
      windowField: 'createdAt',
    },
  });
});

app.get('/v1/jobs/hourly', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const response = await listActiveJobs(
    withDefaultWindow(readSearchParams(context.req.url, limit), {
      createdAfter: hoursAgo(1),
    }),
  );
  context.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
      window: '1h',
      windowField: 'createdAt',
    },
  });
});

app.get('/v1/jobs/updated', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const response = await listUpdatedJobs(readSearchParams(context.req.url, limit));
  context.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
    },
  });
});

app.get('/v1/jobs/modified-24h', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const response = await listUpdatedJobs(
    withDefaultWindow(readSearchParams(context.req.url, limit), {
      updatedAfter: hoursAgo(24),
    }),
  );
  context.header('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
      window: '24h',
      windowField: 'updatedAt',
    },
  });
});

app.get('/v1/jobs/expired', async context => {
  const consumer = getConsumer(context);
  const limit = resolveLimit(context.req.query('limit') ?? null, consumer.limitCap);
  const params = readSearchParams(context.req.url, limit);
  const response = await listExpiredJobs({
    cursor: params.cursor,
    limit,
    offset: params.offset,
    provider: params.provider,
    updatedAfter: params.updatedAfter,
  });
  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));

  return context.json({
    ...response,
    meta: {
      ...response.meta,
      plan: consumer.plan,
    },
  });
});

app.get('/v1/jobs/providers', async context => {
  const response = await listProviders();
  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));
  return context.json(response);
});

app.get('/v1/jobs/facets', async context => {
  const response = await listFacets();
  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));
  return context.json(response);
});

app.get('/v1/jobs/stats', async context => {
  const response = await getStats();
  context.header('Cache-Control', 'public, max-age=300, stale-while-revalidate=900');
  context.header('X-Query-Time-Ms', String(response.meta.queryMs));
  return context.json(response);
});

app.get('/v1/jobs/:id', async context => {
  const includeDescription = context.req.query('include_description') === 'true';
  const job = await getJobById(context.req.param('id'), includeDescription);

  if (!job) {
    return context.json(
      {
        error: {
          code: 'not_found',
          message: 'Job not found.',
        },
      },
      404,
    );
  }

  return context.json({ data: job });
});

app.notFound(context =>
  context.json(
    {
      error: {
        code: 'not_found',
        message: 'Endpoint not found.',
      },
    },
    404,
  ),
);

app.onError((error, context) => {
  console.error('[jobs-api] request failed', error);

  return context.json(
    {
      error: {
        code: 'internal_error',
        message: 'Internal server error.',
      },
    },
    500,
  );
});

serve(
  {
    fetch: app.fetch,
    port: config.port,
  },
  info => {
    console.log(`[jobs-api] listening on http://0.0.0.0:${info.port}`);
  },
);
