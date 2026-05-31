'use server';

const FANTASTIC_API_BASE = 'https://active-jobs-db.p.rapidapi.com';
const FANTASTIC_HOST = 'active-jobs-db.p.rapidapi.com';
const FANTASTIC_US_LOCATION = 'United States';

const STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
};
const STATE_ABBREV_TO_NAME = Object.fromEntries(
  Object.entries(STATE_ABBREVIATIONS).map(([name, abbrev]) => [abbrev, name]),
);

export interface FantasticJobsSearchParams {
  limit?: number;
  location?: string;
  offset?: number;
  postedWithinDays?: number;
  remote?: boolean;
  searchTerm?: string;
}

export interface FantasticJobLocationRaw {
  address?: {
    addressCountry?: string;
    addressLocality?: string;
    addressRegion?: string;
    postalCode?: string;
    streetAddress?: string;
  };
}

export interface FantasticJob {
  id: string;
  description_text?: string | null;
  date_created?: string;
  date_posted?: string;
  employment_type?: string | string[] | null;
  locations_alt_raw?: string[] | null;
  locations_raw?: FantasticJobLocationRaw[] | null;
  locations_derived?: string[] | null;
  organization?: string | null;
  organization_logo?: string | null;
  organization_url?: string | null;
  remote_derived?: boolean | null;
  ai_work_arrangement?: string | null;
  salary_raw?: string | null;
  source?: string | null;
  source_domain?: string | null;
  source_type?: string | null;
  title?: string | null;
  url?: string | null;
}

const getApiKey = (): string => {
  const apiKey = process.env.RAPID_API_KEY;
  if (!apiKey) {
    throw new Error('RAPID_API_KEY is not set');
  }
  return apiKey;
};

const buildSearchParams = (
  params: FantasticJobsSearchParams,
  options?: { locationFilterMode?: 'strict' | 'city-only' },
): URLSearchParams => {
  const query = new URLSearchParams();
  query.set('description_type', 'text');
  query.set('include_ai', 'true');

  if (typeof params.limit === 'number') {
    query.set('limit', String(params.limit));
  }

  if (typeof params.offset === 'number') {
    query.set('offset', String(params.offset));
  }

  if (params.searchTerm?.trim()) {
    query.set('title_filter', params.searchTerm.trim());
  }

  if (params.location?.trim()) {
    const rawParts = params.location
      .split(',')
      .map(part => part.trim())
      .filter(Boolean);
    const city = rawParts[0];
    const stateRaw = rawParts[1];
    const stateUpper = stateRaw?.toUpperCase();
    const stateName = stateUpper ? STATE_ABBREV_TO_NAME[stateUpper] : undefined;
    const state = stateName || stateRaw;
    const mode = options?.locationFilterMode ?? 'strict';
    const locationFilter =
      mode === 'city-only' || !state ? city : `${city}, ${state}`;

    query.set('location_filter', locationFilter);
  }

  if (params.remote === true) {
    query.set('ai_work_arrangement_filter', 'Remote Solely,Remote OK');
  }

  return query;
};

export async function searchFantasticJobs(
  params: FantasticJobsSearchParams,
): Promise<FantasticJob[]> {
  const apiKey = getApiKey();
  const postedWithinDays =
    typeof params.postedWithinDays === 'number' && params.postedWithinDays > 0
      ? params.postedWithinDays
      : null;
  const preferredEndpoint =
    postedWithinDays && postedWithinDays <= 7 ? 'active-ats-7d' : 'active-ats';
  const endpointsToTry =
    preferredEndpoint === 'active-ats'
      ? ['active-ats', 'active-ats-7d']
      : ['active-ats-7d'];

  const fetchWithQuery = async (query: URLSearchParams) => {
    for (const endpoint of endpointsToTry) {
      const response = await fetch(
        `${FANTASTIC_API_BASE}/${endpoint}?${query.toString()}`,
        {
          method: 'GET',
          headers: {
            'x-rapidapi-key': apiKey,
            'x-rapidapi-host': FANTASTIC_HOST,
          },
        },
      );

      if (!response.ok) {
        const error = await response.text();
        const isMissingEndpoint =
          response.status === 404 ||
          error.includes(`Endpoint '/${endpoint}' does not exist`);
        if (isMissingEndpoint) {
          console.warn(
            `[Fantastic.jobs] Endpoint ${endpoint} not available, falling back`,
          );
          continue;
        }
        throw new Error(`Fantastic.jobs search failed: ${error}`);
      }

      const data = (await response.json()) as FantasticJob[];
      return Array.isArray(data) ? data : [];
    }

    throw new Error(
      'Fantastic.jobs search failed: No supported endpoints available.',
    );
  };

  const normalizedParams: FantasticJobsSearchParams = {
    ...params,
    location: FANTASTIC_US_LOCATION,
  };

  const strictQuery = buildSearchParams(normalizedParams, {
    locationFilterMode: 'strict',
  });
  const strictResults = await fetchWithQuery(strictQuery);

  const hasLocation = Boolean(normalizedParams.location?.trim());
  const hasState =
    Boolean(normalizedParams.location?.split(',')[1]?.trim()) &&
    Boolean(normalizedParams.location?.split(',')[0]?.trim());
  const limit =
    typeof normalizedParams.limit === 'number' && normalizedParams.limit > 0
      ? normalizedParams.limit
      : null;

  if (!hasLocation || !hasState || !limit || strictResults.length >= limit) {
    return strictResults;
  }

  const cityOnlyQuery = buildSearchParams(normalizedParams, {
    locationFilterMode: 'city-only',
  });
  const relaxedResults = await fetchWithQuery(cityOnlyQuery);

  const deduped = new Map<string, FantasticJob>();
  for (const job of strictResults) {
    deduped.set(job.id, job);
  }
  for (const job of relaxedResults) {
    if (!deduped.has(job.id)) {
      deduped.set(job.id, job);
    }
  }

  return Array.from(deduped.values());
}
