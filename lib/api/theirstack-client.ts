'use server';

const THEIRSTACK_API_BASE = 'https://api.theirstack.com/v1';

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

export interface TheirStackSearchParams {
  jobTitle?: string;
  location?: string;
  countryCode?: string;
  remote?: boolean;
  postedWithinDays?: number | null;
  limit?: number;
  page?: number;
  discoveredAtGte?: string;
  excludeJobIds?: string[];
}

export interface TheirStackJob {
  id: string;
  job_id?: string;
  title?: string;
  company_name?: string;
  company_id?: string;
  company_logo_url?: string;
  company_url?: string;
  url?: string;
  apply_url?: string;
  location?: string;
  city?: string;
  region?: string;
  country?: string;
  country_code?: string;
  is_remote?: boolean;
  remote_type?: string;
  description?: string;
  salary_string?: string;
  salary_min?: number;
  salary_max?: number;
  salary_currency?: string;
  employment_type?: string;
  seniority?: string;
  date_posted?: string;
  discovered_at?: string;
  expired?: boolean;
  tags?: string[];
  source?: string;
}

export interface TheirStackSearchResponse {
  data: TheirStackJob[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

const getApiKey = (): string => {
  const apiKey = process.env.THEIRSTACK_API_KEY;
  if (!apiKey) {
    throw new Error('THEIRSTACK_API_KEY is not set');
  }
  return apiKey;
};

const buildSearchPayload = (
  params: TheirStackSearchParams,
): Record<string, unknown> => {
  const payload: Record<string, unknown> = {
    page: params.page ?? 0,
    limit: params.limit ?? 25,
    blur_company_data: false,
    include_total_results: false,
  };

  if (params.jobTitle?.trim()) {
    payload.job_title_or = [params.jobTitle.trim()];
  }

  if (params.remote === true) {
    payload.remote = true;
  }

  // Default to US if no country code specified
  if (params.countryCode?.trim()) {
    payload.job_country_code_or = [params.countryCode.trim().toUpperCase()];
  } else {
    payload.job_country_code_or = ['US'];
  }

  // Add location pattern if provided
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

    const patterns = new Set<string>();
    if (city) patterns.add(city);
    if (state) patterns.add(state);
    if (city && state) {
      patterns.add(`${city}, ${state}`);
      patterns.add(`${city} ${state}`);
    }

    payload.job_location_pattern_or = Array.from(patterns);
  }

  // Recency filter - required for performance per TheirStack best practices
  const postedDays =
    typeof params.postedWithinDays === 'number' && params.postedWithinDays > 0
      ? params.postedWithinDays
      : 15; // Default to 15 days
  payload.posted_at_max_age_days = postedDays;

  // Deduplication using discovered_at_gte
  if (params.discoveredAtGte) {
    payload.discovered_at_gte = params.discoveredAtGte;
  }

  // Exclude already-seen job IDs
  if (params.excludeJobIds && params.excludeJobIds.length > 0) {
    payload.job_id_not = params.excludeJobIds;
  }

  return payload;
};

export async function searchTheirStackJobs(
  params: TheirStackSearchParams,
): Promise<TheirStackSearchResponse> {
  const apiKey = getApiKey();
  const payload = buildSearchPayload(params);

  console.log(
    '[TheirStack] Searching jobs with payload:',
    JSON.stringify(payload, null, 2),
  );

  const response = await fetch(`${THEIRSTACK_API_BASE}/jobs/search`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[TheirStack] API error:', response.status, error);
    throw new Error(
      `TheirStack job search failed: ${response.status} - ${error}`,
    );
  }

  const data = await response.json();

  // Log rate limit headers for monitoring
  const rateLimitRemaining = response.headers.get('RateLimit-Remaining');
  const rateLimitReset = response.headers.get('RateLimit-Reset');
  if (rateLimitRemaining) {
    console.log(
      `[TheirStack] Rate limit remaining: ${rateLimitRemaining}, resets in: ${rateLimitReset}s`,
    );
  }

  return {
    data: data.data ?? [],
    total: data.total ?? 0,
    page: data.page ?? 0,
    limit: data.limit ?? params.limit ?? 25,
    has_more: data.has_more ?? false,
  };
}
