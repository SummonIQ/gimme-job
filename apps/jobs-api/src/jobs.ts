import type { QueryResultRow } from 'pg';
import { decodeCursor, encodeCursor, type CursorSort } from './cursor.js';
import { runQuery } from './db.js';

export interface JobSearchParams {
  company?: string | undefined;
  createdAfter?: string | undefined;
  cursor?: string | undefined;
  description?: string | undefined;
  hasSalary?: boolean | undefined;
  includeDescription: boolean;
  jobType?: string | undefined;
  limit: number;
  location?: string | undefined;
  offset?: number | undefined;
  postedAfter?: string | undefined;
  postedBefore?: string | undefined;
  provider?: string | undefined;
  query?: string | undefined;
  remote?: boolean | undefined;
  source?: string | undefined;
  title?: string | undefined;
  updatedAfter?: string | undefined;
  updatedBefore?: string | undefined;
}

export interface PublicJob {
  benefits: string[];
  company: string | null;
  companyLogoUrl: string | null;
  description?: string | null;
  healthInsurance: boolean | null;
  dentalCoverage: boolean | null;
  id: string;
  jobId: string;
  jobType: string | null;
  location: string | null;
  paidTimeOff: boolean | null;
  postedAt: string | null;
  provider: string | null;
  providerUrl: string | null;
  qualifications: string[];
  remote: boolean | null;
  requirements: string[];
  responsibilities: string[];
  salary: string | null;
  source: string | null;
  title: string | null;
  updatedAt: string;
  workFromHome: boolean | null;
}

interface JobRow extends QueryResultRow {
  benefits: string[] | null;
  company: string | null;
  companyLogoUrl: string | null;
  createdAt: Date | string;
  dentalCoverage: boolean | null;
  description: string | null;
  healthInsurance: boolean | null;
  id: string;
  jobId: string;
  jobType: string | null;
  location: string | null;
  paidTimeOff: boolean | null;
  postedAt: Date | string | null;
  provider: string | null;
  providerUrl: string | null;
  qualifications: string[] | null;
  remote: boolean | null;
  requirements: string[] | null;
  responsibilities: string[] | null;
  salary: string | null;
  source: string | null;
  title: string | null;
  updatedAt: Date | string;
  workFromHome: boolean | null;
}

interface ProviderRow extends QueryResultRow {
  count: string;
  provider: string | null;
}

interface FacetRow extends QueryResultRow {
  count: string;
  field: string;
  value: string | null;
}

interface StatsRow extends QueryResultRow {
  activeCount: string;
  expiredCount: string;
  latestPostedAt: Date | string | null;
  latestUpdatedAt: Date | string | null;
  providerCount: string;
}

interface SqlParts {
  values: unknown[];
  where: string[];
}

const PROVIDER_ALIASES: Record<string, string> = {
  arbeitnow: 'ARBEITNOW',
  applicant_tracking_systems: 'FANTASTIC_JOBS',
  ats: 'FANTASTIC_JOBS',
  ats_feed: 'FANTASTIC_JOBS',
  builtin: 'BUILTIN',
  careerbuilder: 'CAREER_BUILDER',
  greenhouse: 'GREENHOUSE',
  himalayas: 'HIMALAYAS',
  jobicy: 'JOBICY',
  lever: 'LEVER',
  remote_ok: 'REMOTE_OK',
  remoteok: 'REMOTE_OK',
  remotive: 'REMOTIVE',
  serpapi: 'SERPAPI',
  themuse: 'THE_MUSE',
  the_muse: 'THE_MUSE',
  usajobs: 'USAJOBS',
  we_work_remotely: 'WE_WORK_REMOTELY',
  weworkremotely: 'WE_WORK_REMOTELY',
  welcometothejungle: 'WELCOME_TO_THE_JUNGLE',
  work_at_a_startup: 'WORK_AT_A_STARTUP',
  workatastartup: 'WORK_AT_A_STARTUP',
};

const JOB_TYPE_ALIASES: Record<string, string> = {
  contract: 'CONTRACT',
  contractor: 'CONTRACT',
  full_time: 'FULL_TIME',
  fulltime: 'FULL_TIME',
  full_time_and_part_time: 'FULL_TIME_AND_PART_TIME',
  fulltime_and_parttime: 'FULL_TIME_AND_PART_TIME',
  fulltime_parttime: 'FULL_TIME_AND_PART_TIME',
  intern: 'INTERNSHIP',
  internship: 'INTERNSHIP',
  part_time: 'PART_TIME',
  parttime: 'PART_TIME',
  temporary: 'UNKNOWN',
  unknown: 'UNKNOWN',
};

const PUBLIC_PROVIDER_SQL = `
  CASE
    WHEN jl."jobBoard"::text = 'FANTASTIC_JOBS' THEN NULL
    ELSE jl."jobBoard"::text
  END
`;

const PUBLIC_PROVIDER_URL_SQL = `
  CASE
    WHEN jl."jobBoard"::text = 'FANTASTIC_JOBS' THEN NULL
    ELSE jl."jobBoardUrl"
  END
`;

const PUBLIC_SOURCE_SQL = `
  CASE
    WHEN jl."jobBoard"::text = 'FANTASTIC_JOBS' THEN NULL
    WHEN jl.source ILIKE '%fantastic%' THEN NULL
    ELSE jl.source
  END
`;

const PUBLIC_JOB_COLUMNS = `
  jl.id,
  jl."jobId" AS "jobId",
  jl.title,
  jl.company,
  jl."companyLogoUrl" AS "companyLogoUrl",
  jl.location,
  jl.remote,
  jl."workFromHome" AS "workFromHome",
  jl."jobType"::text AS "jobType",
  jl.salary,
  jl.description,
  jl.requirements,
  jl.responsibilities,
  jl.qualifications,
  jl.benefits,
  jl."healthInsurance" AS "healthInsurance",
  jl."dentalCoverage" AS "dentalCoverage",
  jl."paidTimeOff" AS "paidTimeOff",
  ${PUBLIC_PROVIDER_SQL} AS provider,
  ${PUBLIC_PROVIDER_URL_SQL} AS "providerUrl",
  ${PUBLIC_SOURCE_SQL} AS source,
  jl."postedAt" AS "postedAt",
  jl."createdAt" AS "createdAt",
  jl."updatedAt" AS "updatedAt"
`;

const pushValue = (parts: SqlParts, value: unknown): string => {
  parts.values.push(value);
  return `$${parts.values.length}`;
};

const sanitizeLike = (value: string): string =>
  `%${value.trim().replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;

const splitOrTerms = (value: string): string[] =>
  value
    .split(/\s+OR\s+/i)
    .map(term => term.trim())
    .filter(Boolean);

const parseDate = (value?: string): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const addTextFilter = (parts: SqlParts, expression: string, rawValue?: string): void => {
  if (!rawValue?.trim()) return;

  const terms = splitOrTerms(rawValue);
  if (terms.length === 0) return;

  const predicates = terms.map(
    term => `${expression} ILIKE ${pushValue(parts, sanitizeLike(term))} ESCAPE '\\'`,
  );
  parts.where.push(`(${predicates.join(' OR ')})`);
};

const parseProviderList = (rawProvider?: string): string[] => {
  if (!rawProvider) return [];

  const providers = rawProvider
    .split(',')
    .map(provider => provider.trim().toLowerCase().replaceAll('-', '_'))
    .filter(Boolean)
    .filter(provider => !provider.includes('fantastic'));

  if (providers.length === 0) {
    return ['__INVALID_PROVIDER__'];
  }

  const publicProviders = providers
    .map(provider => PROVIDER_ALIASES[provider] ?? provider.toUpperCase())
    .filter(provider => provider !== 'FANTASTIC_JOBS')
    .filter(provider => !provider.toLowerCase().includes('fantastic'))
    .filter((provider, index, all) => all.indexOf(provider) === index);

  return publicProviders.length > 0 ? publicProviders : ['__INVALID_PROVIDER__'];
};

const parseJobTypeList = (rawJobType?: string): string[] => {
  if (!rawJobType) return [];

  return rawJobType
    .split(',')
    .map(jobType => jobType.trim().toLowerCase().replaceAll('-', '_').replaceAll(' ', '_'))
    .filter(Boolean)
    .map(jobType => JOB_TYPE_ALIASES[jobType] ?? jobType.toUpperCase())
    .filter((jobType, index, all) => all.indexOf(jobType) === index);
};

const addPublicActiveFilters = (parts: SqlParts): void => {
  parts.where.push(`jl."jobBoardUrl" IS NOT NULL`);
  parts.where.push(`jl.title IS NOT NULL`);
  parts.where.push(`jl.company IS NOT NULL`);
  parts.where.push(`jl.status IS DISTINCT FROM 'DISMISSED'`);
};

const addCommonFilters = (parts: SqlParts, params: JobSearchParams): void => {
  const providers = parseProviderList(params.provider);
  if (providers.length > 0) {
    parts.where.push(
      `jl."jobBoard"::text = ANY(${pushValue(parts, providers)}::text[])`,
    );
  }

  if (params.query?.trim()) {
    const value = pushValue(parts, sanitizeLike(params.query));
    parts.where.push(
      `(jl.title ILIKE ${value} ESCAPE '\\' OR jl.company ILIKE ${value} ESCAPE '\\')`,
    );
  }

  addTextFilter(parts, 'jl.title', params.title);
  addTextFilter(parts, 'jl.company', params.company);
  addTextFilter(parts, 'jl.location', params.location);
  if (params.source?.toLowerCase().includes('fantastic')) {
    parts.where.push('FALSE');
  } else {
    addTextFilter(parts, 'jl.source', params.source);
  }
  addTextFilter(parts, 'jl.description', params.description);

  if (typeof params.remote === 'boolean') {
    parts.where.push(
      params.remote
        ? `(jl.remote = true OR jl."workFromHome" = true OR jl.location ILIKE '%remote%')`
        : `COALESCE(jl.remote, false) = false AND COALESCE(jl."workFromHome", false) = false`,
    );
  }

  const jobTypes = parseJobTypeList(params.jobType);
  if (jobTypes.length > 0) {
    parts.where.push(
      `jl."jobType"::text = ANY(${pushValue(parts, jobTypes)}::text[])`,
    );
  }

  if (params.hasSalary) {
    parts.where.push(`NULLIF(BTRIM(COALESCE(jl.salary, '')), '') IS NOT NULL`);
  }

  const createdAfter = parseDate(params.createdAfter);
  if (createdAfter) {
    parts.where.push(`jl."createdAt" >= ${pushValue(parts, createdAfter)}`);
  }

  const postedAfter = parseDate(params.postedAfter);
  if (postedAfter) {
    parts.where.push(
      `COALESCE(jl."postedAt", jl."createdAt") >= ${pushValue(parts, postedAfter)}`,
    );
  }

  const postedBefore = parseDate(params.postedBefore);
  if (postedBefore) {
    parts.where.push(
      `COALESCE(jl."postedAt", jl."createdAt") <= ${pushValue(parts, postedBefore)}`,
    );
  }

  const updatedAfter = parseDate(params.updatedAfter);
  if (updatedAfter) {
    parts.where.push(`jl."updatedAt" >= ${pushValue(parts, updatedAfter)}`);
  }

  const updatedBefore = parseDate(params.updatedBefore);
  if (updatedBefore) {
    parts.where.push(`jl."updatedAt" <= ${pushValue(parts, updatedBefore)}`);
  }
};

const offsetSql = (parts: SqlParts, params: Pick<JobSearchParams, 'cursor' | 'offset'>): string => {
  if (params.cursor || !params.offset || params.offset <= 0) return '';
  return `OFFSET ${pushValue(parts, params.offset)}`;
};

const whereSql = (parts: SqlParts): string =>
  parts.where.length > 0 ? `WHERE ${parts.where.join(' AND ')}` : '';

const normalizeDate = (value: Date | string | null): string | null => {
  if (!value) return null;
  return new Date(value).toISOString();
};

const normalizeList = (value: string[] | null): string[] =>
  Array.isArray(value) ? value : [];

const normalizePublicToken = (value: string | null): string | null =>
  value ? value.toLowerCase() : null;

const toPublicJob = (row: JobRow, includeDescription: boolean): PublicJob => {
  const job: PublicJob = {
    benefits: normalizeList(row.benefits),
    company: row.company,
    companyLogoUrl: row.companyLogoUrl,
    dentalCoverage: row.dentalCoverage,
    healthInsurance: row.healthInsurance,
    id: row.id,
    jobId: row.jobId,
    jobType: normalizePublicToken(row.jobType),
    location: row.location,
    paidTimeOff: row.paidTimeOff,
    postedAt: normalizeDate(row.postedAt),
    provider: normalizePublicToken(row.provider),
    providerUrl: row.providerUrl,
    qualifications: normalizeList(row.qualifications),
    remote: row.remote,
    requirements: normalizeList(row.requirements),
    responsibilities: normalizeList(row.responsibilities),
    salary: row.salary,
    source: row.source,
    title: row.title,
    updatedAt: normalizeDate(row.updatedAt) ?? new Date(0).toISOString(),
    workFromHome: row.workFromHome,
  };

  if (includeDescription) {
    job.description = row.description;
  }

  return job;
};

const nextCursor = (
  rows: JobRow[],
  limit: number,
  sort: CursorSort,
): string | null => {
  if (rows.length < limit) return null;

  const last = rows.at(-1);
  if (!last) return null;

  const timestamp =
    sort === 'recent-desc'
      ? normalizeDate(last.postedAt) ?? normalizeDate(last.createdAt)
      : normalizeDate(last.updatedAt);

  if (!timestamp) return null;

  return encodeCursor({
    id: last.id,
    sort,
    timestamp,
  });
};

export const listActiveJobs = async (
  params: JobSearchParams,
): Promise<{
  data: PublicJob[];
  meta: { count: number; limit: number; nextCursor: string | null; offset: number; queryMs: number };
}> => {
  const parts: SqlParts = { values: [], where: [] };
  addPublicActiveFilters(parts);
  addCommonFilters(parts, params);

  const cursor = decodeCursor(params.cursor ?? null, 'recent-desc');
  if (cursor) {
    parts.where.push(
      `(COALESCE(jl."postedAt", jl."createdAt"), jl.id) < (${pushValue(
        parts,
        new Date(cursor.timestamp),
      )}, ${pushValue(parts, cursor.id)})`,
    );
  }

  const limitRef = pushValue(parts, params.limit);
  const sql = `
    SELECT ${PUBLIC_JOB_COLUMNS}
    FROM "JobListing" jl
    ${whereSql(parts)}
    ORDER BY COALESCE(jl."postedAt", jl."createdAt") DESC, jl.id DESC
    LIMIT ${limitRef}
    ${offsetSql(parts, params)}
  `;
  const result = await runQuery<JobRow>(sql, parts.values);
  const data = result.rows.map(row => toPublicJob(row, params.includeDescription));

  return {
    data,
    meta: {
      count: data.length,
      limit: params.limit,
      nextCursor: nextCursor(result.rows, params.limit, 'recent-desc'),
      offset: params.cursor ? 0 : params.offset ?? 0,
      queryMs: result.durationMs,
    },
  };
};

export const listUpdatedJobs = async (
  params: JobSearchParams,
): Promise<{
  data: PublicJob[];
  meta: { count: number; limit: number; nextCursor: string | null; offset: number; queryMs: number };
}> => {
  const parts: SqlParts = { values: [], where: [] };
  addPublicActiveFilters(parts);
  addCommonFilters(parts, params);

  const cursor = decodeCursor(params.cursor ?? null, 'updated-asc');
  if (cursor) {
    parts.where.push(
      `(jl."updatedAt", jl.id) > (${pushValue(parts, new Date(cursor.timestamp))}, ${pushValue(
        parts,
        cursor.id,
      )})`,
    );
  }

  const limitRef = pushValue(parts, params.limit);
  const sql = `
    SELECT ${PUBLIC_JOB_COLUMNS}
    FROM "JobListing" jl
    ${whereSql(parts)}
    ORDER BY jl."updatedAt" ASC, jl.id ASC
    LIMIT ${limitRef}
    ${offsetSql(parts, params)}
  `;
  const result = await runQuery<JobRow>(sql, parts.values);
  const data = result.rows.map(row => toPublicJob(row, params.includeDescription));

  return {
    data,
    meta: {
      count: data.length,
      limit: params.limit,
      nextCursor: nextCursor(result.rows, params.limit, 'updated-asc'),
      offset: params.cursor ? 0 : params.offset ?? 0,
      queryMs: result.durationMs,
    },
  };
};

export const getJobById = async (
  id: string,
  includeDescription: boolean,
): Promise<PublicJob | null> => {
  const sql = `
    SELECT ${PUBLIC_JOB_COLUMNS}
    FROM "JobListing" jl
    WHERE
      jl."jobBoardUrl" IS NOT NULL
      AND jl.status IS DISTINCT FROM 'DISMISSED'
      AND (jl.id = $1 OR jl."jobId" = $1)
    LIMIT 1
  `;
  const result = await runQuery<JobRow>(sql, [id]);
  const row = result.rows[0];
  return row ? toPublicJob(row, includeDescription) : null;
};

export const listExpiredJobs = async (
  params: Pick<JobSearchParams, 'cursor' | 'limit' | 'offset' | 'provider' | 'updatedAfter'>,
): Promise<{
  data: Array<{ id: string; jobId: string; provider: string | null; updatedAt: string }>;
  meta: { count: number; limit: number; nextCursor: string | null; offset: number; queryMs: number };
}> => {
  const parts: SqlParts = {
    values: [],
    where: [`jl.status = 'DISMISSED'`],
  };
  addCommonFilters(
    parts,
    {
      includeDescription: false,
      limit: params.limit,
      offset: params.offset,
      provider: params.provider,
      updatedAfter: params.updatedAfter,
    },
  );

  const cursor = decodeCursor(params.cursor ?? null, 'updated-asc');
  if (cursor) {
    parts.where.push(
      `(jl."updatedAt", jl.id) > (${pushValue(parts, new Date(cursor.timestamp))}, ${pushValue(
        parts,
        cursor.id,
      )})`,
    );
  }

  const limitRef = pushValue(parts, params.limit);
  const sql = `
    SELECT
      jl.id,
      jl."jobId" AS "jobId",
      ${PUBLIC_PROVIDER_SQL} AS provider,
      jl."updatedAt" AS "updatedAt"
    FROM "JobListing" jl
    ${whereSql(parts)}
    ORDER BY jl."updatedAt" ASC, jl.id ASC
    LIMIT ${limitRef}
    ${offsetSql(parts, params)}
  `;
  const result = await runQuery<
    QueryResultRow & {
      id: string;
      jobId: string;
      provider: string | null;
      updatedAt: Date | string;
    }
  >(sql, parts.values);

  return {
    data: result.rows.map(row => ({
      id: row.id,
      jobId: row.jobId,
      provider: normalizePublicToken(row.provider),
      updatedAt: normalizeDate(row.updatedAt) ?? new Date(0).toISOString(),
    })),
    meta: {
      count: result.rows.length,
      limit: params.limit,
      nextCursor:
        result.rows.length < params.limit
          ? null
          : encodeCursor({
              id: result.rows.at(-1)?.id ?? '',
              sort: 'updated-asc',
              timestamp:
                normalizeDate(result.rows.at(-1)?.updatedAt ?? null) ??
                new Date(0).toISOString(),
            }),
      offset: params.cursor ? 0 : params.offset ?? 0,
      queryMs: result.durationMs,
    },
  };
};

export const listProviders = async (): Promise<{
  data: Array<{ count: number; provider: string | null }>;
  meta: { queryMs: number };
}> => {
  const sql = `
    SELECT ${PUBLIC_PROVIDER_SQL} AS provider, COUNT(*) AS count
    FROM "JobListing" jl
    WHERE
      jl."jobBoardUrl" IS NOT NULL
      AND jl.status IS DISTINCT FROM 'DISMISSED'
      AND jl.title IS NOT NULL
      AND jl.company IS NOT NULL
      AND ${PUBLIC_PROVIDER_SQL} IS NOT NULL
    GROUP BY ${PUBLIC_PROVIDER_SQL}
    ORDER BY COUNT(*) DESC, provider ASC
  `;
  const result = await runQuery<ProviderRow>(sql);

  return {
    data: result.rows.map(row => ({
      count: Number.parseInt(row.count, 10),
      provider: normalizePublicToken(row.provider),
    })),
    meta: {
      queryMs: result.durationMs,
    },
  };
};

export const listFacets = async (): Promise<{
  data: Record<string, Array<{ count: number; value: string | null }>>;
  meta: { queryMs: number };
}> => {
  const sql = `
    WITH public_jobs AS (
      SELECT
        ${PUBLIC_PROVIDER_SQL} AS provider,
        jl.location,
        CASE
          WHEN jl.remote = true OR jl."workFromHome" = true THEN 'true'
          ELSE 'false'
        END AS remote,
        jl."jobType"::text AS job_type
      FROM "JobListing" jl
      WHERE
        jl."jobBoardUrl" IS NOT NULL
        AND jl.status IS DISTINCT FROM 'DISMISSED'
        AND jl.title IS NOT NULL
        AND jl.company IS NOT NULL
    )
    SELECT 'provider' AS field, provider AS value, COUNT(*) AS count
    FROM public_jobs
    WHERE provider IS NOT NULL
    GROUP BY provider
    UNION ALL
    SELECT 'remote' AS field, remote AS value, COUNT(*) AS count
    FROM public_jobs
    GROUP BY remote
    UNION ALL
    SELECT 'jobType' AS field, job_type AS value, COUNT(*) AS count
    FROM public_jobs
    WHERE job_type IS NOT NULL
    GROUP BY job_type
    UNION ALL
    SELECT 'location' AS field, location AS value, COUNT(*) AS count
    FROM public_jobs
    WHERE location IS NOT NULL
    GROUP BY location
    ORDER BY field ASC, count DESC
  `;
  const result = await runQuery<FacetRow>(sql);
  const data: Record<string, Array<{ count: number; value: string | null }>> = {};

  for (const row of result.rows) {
    const bucket = data[row.field] ?? [];
    if (bucket.length < 50) {
      bucket.push({
        count: Number.parseInt(row.count, 10),
        value:
          row.field === 'provider' || row.field === 'jobType'
            ? normalizePublicToken(row.value)
            : row.value,
      });
      data[row.field] = bucket;
    }
  }

  return {
    data,
    meta: {
      queryMs: result.durationMs,
    },
  };
};

export const getStats = async (): Promise<{
  data: {
    activeCount: number;
    expiredCount: number;
    latestPostedAt: string | null;
    latestUpdatedAt: string | null;
    providerCount: number;
  };
  meta: { queryMs: number };
}> => {
  const sql = `
    SELECT
      COUNT(*) FILTER (
        WHERE
          jl."jobBoardUrl" IS NOT NULL
          AND jl.status IS DISTINCT FROM 'DISMISSED'
          AND jl.title IS NOT NULL
          AND jl.company IS NOT NULL
      ) AS "activeCount",
      COUNT(*) FILTER (WHERE jl.status = 'DISMISSED') AS "expiredCount",
      COUNT(DISTINCT jl."jobBoard") FILTER (
        WHERE
          jl."jobBoardUrl" IS NOT NULL
          AND jl.status IS DISTINCT FROM 'DISMISSED'
          AND jl."jobBoard"::text <> 'FANTASTIC_JOBS'
      ) AS "providerCount",
      MAX(COALESCE(jl."postedAt", jl."createdAt")) FILTER (
        WHERE
          jl."jobBoardUrl" IS NOT NULL
          AND jl.status IS DISTINCT FROM 'DISMISSED'
      ) AS "latestPostedAt",
      MAX(jl."updatedAt") FILTER (
        WHERE
          jl."jobBoardUrl" IS NOT NULL
          AND jl.status IS DISTINCT FROM 'DISMISSED'
      ) AS "latestUpdatedAt"
    FROM "JobListing" jl
  `;
  const result = await runQuery<StatsRow>(sql);
  const row = result.rows[0];

  return {
    data: {
      activeCount: Number.parseInt(row?.activeCount ?? '0', 10),
      expiredCount: Number.parseInt(row?.expiredCount ?? '0', 10),
      latestPostedAt: normalizeDate(row?.latestPostedAt ?? null),
      latestUpdatedAt: normalizeDate(row?.latestUpdatedAt ?? null),
      providerCount: Number.parseInt(row?.providerCount ?? '0', 10),
    },
    meta: {
      queryMs: result.durationMs,
    },
  };
};
