'use server';

const CORESIGNAL_API_BASE = 'https://api.coresignal.com/cdapi';

export interface CoreSignalSearchParams {
  after?: string;
  jobType?: string | null;
  limit?: number;
  location?: string;
  postedWithinDays?: number | null;
  remote?: boolean;
  searchTerm?: string;
}

interface CoreSignalSearchResponse {
  jobIds: string[];
  nextAfter?: string;
  totalResults?: number;
}

interface CoreSignalJobSource {
  source?: string;
  source_id?: string;
  status?: string;
  updated_at?: string;
  url?: string;
}

export interface CoreSignalJobRecord {
  accepts_remote?: boolean;
  applicants_count?: string;
  benefits?: string[];
  company_logo_url?: string;
  company_name?: string;
  created_at?: string;
  date_posted?: string;
  description?: string;
  employment_type?: string;
  external_url?: string;
  id: number | string;
  job_sources?: CoreSignalJobSource[];
  location?: string;
  salary?: Array<{
    currency?: string;
    max_value?: number;
    min_value?: number;
    text?: string;
    type?: string;
  }>;
  shift_schedule?: string[];
  title?: string;
  updated_at?: string;
}

const buildSearchQuery = ({
  jobType,
  location,
  postedWithinDays,
  remote,
  searchTerm,
}: CoreSignalSearchParams): Record<string, unknown> => {
  const mustClauses: Array<Record<string, unknown>> = [];
  const filterClauses: Array<Record<string, unknown>> = [];
  const resolvedPostedWithinDays =
    typeof postedWithinDays === 'number' ? postedWithinDays : null;

  if (searchTerm?.trim()) {
    mustClauses.push({ match: { title: searchTerm.trim() } });
  }

  if (location?.trim()) {
    const normalizedLocation = location.trim();
    const [cityRaw, stateRaw] = normalizedLocation.split(',');
    const cityCandidate = cityRaw?.trim() || normalizedLocation;
    const stateCandidate = stateRaw?.trim()
      ? stateRaw.trim()
      : normalizedLocation.split(/\s+/).pop()?.trim();

    const locationShould: Array<Record<string, unknown>> = [
      { match: { location: normalizedLocation } },
    ];
    if (cityCandidate) {
      locationShould.push({ match: { city: cityCandidate } });
    }
    if (stateCandidate && stateCandidate !== cityCandidate) {
      locationShould.push({ match: { state: stateCandidate } });
    }

    filterClauses.push({
      bool: {
        should: locationShould,
        minimum_should_match: 1,
      },
    });
  }

  if (jobType?.trim()) {
    mustClauses.push({ match: { employment_type: jobType.trim() } });
  }

  if (remote) {
    filterClauses.push({ term: { accepts_remote: true } });
  }

  filterClauses.push({ term: { status: 1 } });
  filterClauses.push({ term: { job_id_expired: 0 } });

  if (resolvedPostedWithinDays && resolvedPostedWithinDays > 0) {
    const cutoff = new Date(
      Date.now() - resolvedPostedWithinDays * 24 * 60 * 60 * 1000,
    ).toISOString();
    filterClauses.push({
      bool: {
        should: [
          { range: { date_posted: { gte: cutoff } } },
          { range: { created_at: { gte: cutoff } } },
        ],
        minimum_should_match: 1,
      },
    });
  }

  if (mustClauses.length === 0) {
    if (filterClauses.length > 0) {
      return { query: { bool: { filter: filterClauses } } };
    }
    return { query: { match_all: {} } };
  }

  const boolQuery: Record<string, unknown> = { must: mustClauses };
  if (filterClauses.length > 0) {
    boolQuery.filter = filterClauses;
  }

  return { query: { bool: boolQuery } };
};

const getApiKey = (): string => {
  const apiKey = process.env.CORESIGNAL_API_KEY;
  if (!apiKey) {
    throw new Error('CORESIGNAL_API_KEY is not set');
  }
  return apiKey;
};

const normalizeJobIds = (payload: unknown): string[] => {
  if (Array.isArray(payload)) {
    return payload.map(id => String(id));
  }

  if (
    payload &&
    typeof payload === 'object' &&
    Array.isArray((payload as { data?: unknown[] }).data)
  ) {
    return (payload as { data: unknown[] }).data.map(id => String(id));
  }

  if (payload && typeof payload === 'object') {
    const hitsContainer = (payload as { hits?: unknown }).hits;
    if (hitsContainer && typeof hitsContainer === 'object') {
      const hits = (hitsContainer as { hits?: unknown }).hits;
      if (Array.isArray(hits)) {
        return hits
          .map(hit => {
            if (!hit || typeof hit !== 'object') {
              return null;
            }
            const record = hit as Record<string, unknown>;
            if (typeof record._id !== 'undefined') {
              return String(record._id);
            }
            const source = record._source as
              | Record<string, unknown>
              | undefined;
            if (source?.id) {
              return String(source.id);
            }
            if (record.id) {
              return String(record.id);
            }
            return null;
          })
          .filter((id): id is string => Boolean(id));
      }
    }
  }

  throw new Error('Unexpected CoreSignal search response format');
};

export async function searchCoreSignalJobIds(
  params: CoreSignalSearchParams,
): Promise<CoreSignalSearchResponse> {
  const apiKey = getApiKey();
  const limit = params.limit ?? 25;

  const query = new URLSearchParams({
    items_per_page: limit.toString(),
  });

  if (params.after) {
    query.append('after', params.after);
  }

  const response = await fetch(
    `${CORESIGNAL_API_BASE}/v2/job_multi_source/search/es_dsl?${query.toString()}`,
    {
      method: 'POST',
      headers: {
        accept: 'application/json',
        apikey: apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...buildSearchQuery(params),
        sort: ['last_updated'],
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CoreSignal job search failed: ${error}`);
  }

  const data = await response.json();
  const jobIds = normalizeJobIds(data);

  return {
    jobIds,
    nextAfter: response.headers.get('x-next-page-after') ?? undefined,
    totalResults: response.headers.get('x-total-results')
      ? Number(response.headers.get('x-total-results'))
      : undefined,
  };
}

export async function collectCoreSignalJob(
  jobId: string,
): Promise<CoreSignalJobRecord> {
  const apiKey = getApiKey();
  const response = await fetch(
    `${CORESIGNAL_API_BASE}/v2/job_multi_source/collect/${jobId}`,
    {
      headers: {
        accept: 'application/json',
        apikey: apiKey,
      },
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`CoreSignal job collect failed: ${error}`);
  }

  return (await response.json()) as CoreSignalJobRecord;
}
