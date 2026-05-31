const jobQueryParameters = [
  { in: 'query', name: 'query', schema: { type: 'string' } },
  { in: 'query', name: 'title', schema: { type: 'string' } },
  { in: 'query', name: 'title_filter', schema: { type: 'string' } },
  { in: 'query', name: 'company', schema: { type: 'string' } },
  { in: 'query', name: 'organization_filter', schema: { type: 'string' } },
  { in: 'query', name: 'location', schema: { type: 'string' } },
  { in: 'query', name: 'location_filter', schema: { type: 'string' } },
  { in: 'query', name: 'description_filter', schema: { type: 'string' } },
  { in: 'query', name: 'remote', schema: { type: 'boolean' } },
  { in: 'query', name: 'provider', schema: { type: 'string' } },
  { in: 'query', name: 'job_type', schema: { type: 'string' } },
  { in: 'query', name: 'employment_type', schema: { type: 'string' } },
  { in: 'query', name: 'has_salary', schema: { type: 'boolean' } },
  { in: 'query', name: 'posted_after', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'posted_before', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'date_filter', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'created_after', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'indexed_after', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'updated_after', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'updated_before', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'include_description', schema: { type: 'boolean' } },
  { in: 'query', name: 'description_type', schema: { enum: ['text'], type: 'string' } },
  { in: 'query', name: 'limit', schema: { maximum: 500, minimum: 1, type: 'integer' } },
  { in: 'query', name: 'offset', schema: { minimum: 0, type: 'integer' } },
  { in: 'query', name: 'cursor', schema: { type: 'string' } },
] as const;

const syncParameters = [
  { in: 'query', name: 'updated_after', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'modified_after', schema: { format: 'date-time', type: 'string' } },
  { in: 'query', name: 'provider', schema: { type: 'string' } },
  { in: 'query', name: 'limit', schema: { maximum: 500, minimum: 1, type: 'integer' } },
  { in: 'query', name: 'offset', schema: { minimum: 0, type: 'integer' } },
  { in: 'query', name: 'cursor', schema: { type: 'string' } },
] as const;

export const openApiDocument = {
  info: {
    description:
      'Fast public API for active job listings, update feeds, expired listing IDs, backfill feeds, provider counts, facets, and dataset freshness backed by the Gimme Job production job database.',
    title: 'Gimme Job Listings API',
    version: '0.2.0',
  },
  openapi: '3.1.0',
  paths: {
    '/v1/jobs': {
      get: {
        operationId: 'listActiveJobs',
        parameters: jobQueryParameters,
        responses: {
          '200': { description: 'A page of active jobs ordered newest first.' },
        },
        tags: ['Jobs'],
      },
    },
    '/v1/jobs/{id}': {
      get: {
        operationId: 'getJobById',
        parameters: [
          { in: 'path', name: 'id', required: true, schema: { type: 'string' } },
          { in: 'query', name: 'include_description', schema: { type: 'boolean' } },
        ],
        responses: {
          '200': { description: 'A single active job.' },
          '404': { description: 'Job not found.' },
        },
        tags: ['Jobs'],
      },
    },
    '/v1/jobs/backfill': {
      get: {
        operationId: 'listBackfillJobs',
        parameters: jobQueryParameters,
        responses: {
          '200': { description: 'Active jobs from the last 6 months by posted/created time.' },
        },
        tags: ['Feeds'],
      },
    },
    '/v1/jobs/posted-7d': {
      get: {
        operationId: 'listJobsPosted7d',
        parameters: jobQueryParameters,
        responses: {
          '200': { description: 'Active jobs posted during the last 7 days.' },
        },
        tags: ['Feeds'],
      },
    },
    '/v1/jobs/indexed-24h': {
      get: {
        operationId: 'listJobsIndexed24h',
        parameters: jobQueryParameters,
        responses: {
          '200': { description: 'Active jobs discovered/indexed during the last 24 hours.' },
        },
        tags: ['Feeds'],
      },
    },
    '/v1/jobs/hourly': {
      get: {
        operationId: 'listHourlyJobs',
        parameters: jobQueryParameters,
        responses: {
          '200': { description: 'Active jobs discovered/indexed during the last hour.' },
        },
        tags: ['Feeds'],
      },
    },
    '/v1/jobs/updated': {
      get: {
        operationId: 'listUpdatedJobs',
        parameters: jobQueryParameters,
        responses: {
          '200': { description: 'Active jobs ordered by update time.' },
        },
        tags: ['Sync'],
      },
    },
    '/v1/jobs/modified-24h': {
      get: {
        operationId: 'listModifiedJobs24h',
        parameters: jobQueryParameters,
        responses: {
          '200': { description: 'Active jobs modified during the last 24 hours.' },
        },
        tags: ['Sync'],
      },
    },
    '/v1/jobs/expired': {
      get: {
        operationId: 'listExpiredJobIds',
        parameters: syncParameters,
        responses: {
          '200': { description: 'Expired job IDs ordered by update time.' },
        },
        tags: ['Sync'],
      },
    },
    '/v1/jobs/facets': {
      get: {
        operationId: 'listJobFacets',
        responses: {
          '200': { description: 'Top provider, remote, job type, and location facets.' },
        },
        tags: ['Metadata'],
      },
    },
    '/v1/jobs/providers': {
      get: {
        operationId: 'listProviderCounts',
        responses: {
          '200': { description: 'Active job counts by source provider.' },
        },
        tags: ['Metadata'],
      },
    },
    '/v1/jobs/stats': {
      get: {
        operationId: 'getDatasetStats',
        responses: {
          '200': { description: 'Dataset volume and freshness statistics.' },
        },
        tags: ['Metadata'],
      },
    },
  },
} as const;
