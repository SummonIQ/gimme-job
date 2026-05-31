import {
  ArrowRight,
  ChevronDown,
  Check,
  Clock3,
  Database,
  KeyRound,
  Layers3,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Zap,
} from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { PageTracker } from '@/components/analytics/page-tracker';
import { Button } from '@/components/ui/button';

import { RapidApiAnalyticsTracker } from './rapidapi-analytics-tracker';
import { RapidApiPreviewCard } from './rapidapi-preview-card';

export const metadata: Metadata = {
  description:
    'Fresh normalized job listings data on RapidAPI with search filters, sync feeds, expired job IDs, provider counts, facets, and dataset freshness metadata.',
  title: 'Job Listings API - Gimme Job',
};

type PlanName = 'Basic' | 'Pro' | 'Ultra' | 'Mega';

interface EndpointFilterDoc {
  detail: string;
  example?: string;
  name: string;
  values?: readonly string[];
}

type EndpointOptionDoc = EndpointFilterDoc;

const planTagClasses = {
  Basic:
    'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-300/15 dark:bg-slate-300/10 dark:text-slate-200',
  Pro: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-300/15 dark:bg-sky-300/10 dark:text-sky-200',
  Ultra:
    'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-300/15 dark:bg-violet-300/10 dark:text-violet-200',
  Mega: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-300/15 dark:bg-rose-300/10 dark:text-rose-200',
} satisfies Record<PlanName, string>;

const commonListFilters = [
  {
    detail: 'Single broad search term matched against title and company.',
    example: 'query=engineer',
    name: 'query',
  },
  {
    detail: 'Role/title text filter. Use `OR` between terms for multiple alternatives.',
    example: 'title=software+OR+backend',
    name: 'title',
  },
  {
    detail:
      'Company name filter. `organization_filter` also works. Use `OR` between terms for multiple alternatives.',
    example: 'company=stripe+OR+figma',
    name: 'company',
  },
  {
    detail:
      'City, state, country, or region text filter. Use `OR` between terms for multiple alternatives.',
    example: 'location=United+States+OR+Canada',
    name: 'location',
  },
  {
    detail: 'Job description text filter. Use `OR` between terms for multiple alternatives.',
    example: 'description=typescript+OR+postgres',
    name: 'description',
  },
  {
    detail: 'Remote role selector.',
    example: 'remote=true',
    name: 'remote',
    values: ['true', 'false'],
  },
  {
    detail: 'Provider/source bucket. Multiple comma-separated values are supported.',
    example: 'provider=ats_feed,greenhouse',
    name: 'provider',
    values: ['ats_feed', 'greenhouse', 'lever', 'remote_ok', 'usajobs', 'google'],
  },
  {
    detail: 'Normalized employment type. Multiple comma-separated values are supported.',
    example: 'job_type=full_time,contract',
    name: 'job_type',
    values: ['full_time', 'part_time', 'contract', 'internship', 'full_time_and_part_time', 'unknown'],
  },
  {
    detail: 'Only return jobs with compensation text.',
    example: 'has_salary=true',
    name: 'has_salary',
    values: ['true', 'false'],
  },
  {
    detail: 'Page size, capped by plan.',
    example: 'limit=25',
    name: 'limit',
    values: ['Basic 25', 'Pro 100', 'Ultra 250', 'Mega 500'],
  },
  {
    detail: 'Cursor returned by `meta.nextCursor` for the next page.',
    example: 'cursor=eyJzb3J0Ijoi...',
    name: 'cursor',
  },
] satisfies EndpointFilterDoc[];

const includeDescriptionOption = {
  detail: 'Set to `true` when the response should include the full description field.',
  example: 'include_description=true',
  name: 'include_description',
  values: ['true', 'false'],
} satisfies EndpointOptionDoc;

const commonListOptions = [includeDescriptionOption] satisfies EndpointOptionDoc[];

const postedDateFilters = [
  {
    detail: 'Return jobs posted or first seen after an ISO timestamp.',
    example: 'posted_after=2026-04-01T00%3A00%3A00.000Z',
    name: 'posted_after',
    values: ['ISO 8601 timestamp'],
  },
  {
    detail: 'Return jobs posted or first seen before an ISO timestamp.',
    example: 'posted_before=2026-04-30T00%3A00%3A00.000Z',
    name: 'posted_before',
    values: ['ISO 8601 timestamp'],
  },
] satisfies EndpointFilterDoc[];

const indexedDateFilters = [
  {
    detail: 'Return jobs indexed after an ISO timestamp.',
    example: 'indexed_after=2026-04-29T00%3A00%3A00.000Z',
    name: 'indexed_after',
    values: ['ISO 8601 timestamp'],
  },
] satisfies EndpointFilterDoc[];

const updatedDateFilters = [
  {
    detail: 'Return jobs updated after an ISO timestamp.',
    example: 'updated_after=2026-04-29T00%3A00%3A00.000Z',
    name: 'updated_after',
    values: ['ISO 8601 timestamp'],
  },
  {
    detail: 'Return jobs updated before an ISO timestamp.',
    example: 'updated_before=2026-04-30T00%3A00%3A00.000Z',
    name: 'updated_before',
    values: ['ISO 8601 timestamp'],
  },
] satisfies EndpointFilterDoc[];

const jobListResponseShape = `{
  "data": [
    {
      "benefits": [],
      "company": "Okta",
      "companyLogoUrl": null,
      "dentalCoverage": null,
      "healthInsurance": null,
      "id": "cmo6kpzgd008v3evps4z6y05j",
      "jobId": "gh-okta-7613453",
      "jobType": "unknown",
      "location": "Bengaluru, India",
      "paidTimeOff": null,
      "postedAt": "2026-04-22T03:36:59.000Z",
      "provider": "greenhouse",
      "providerUrl": "https://www.okta.com/company/careers/opportunity/7613453?gh_jid=7613453",
      "qualifications": [],
      "remote": false,
      "requirements": [],
      "responsibilities": [],
      "salary": null,
      "source": "Greenhouse",
      "title": "Staff UI Software Engineer",
      "updatedAt": "2026-04-22T07:42:45.986Z",
      "workFromHome": false
    }
  ],
  "meta": {
    "count": 1,
    "limit": 1,
    "nextCursor": "eyJpZCI6ImNtbzZrcHpnZDAwOHYzZXZwczR6NnkwNWoiLCJzb3J0IjoicmVjZW50LWRlc2MiLCJ0aW1lc3RhbXAiOiIyMDI2LTA0LTIyVDAzOjM2OjU5LjAwMFoifQ",
    "offset": 0,
    "queryMs": 182,
    "plan": "pro"
  }
}`;

const endpointGroups = [
  {
    name: 'Search & job details',
    description:
      'Query active job listings with filters and retrieve a single normalized job record by ID.',
    endpoints: [
      {
        path: '/v1/jobs',
        description: 'List active jobs with pagination, sorting, and filter parameters.',
        filters: [
          ...commonListFilters,
          ...postedDateFilters,
          ...indexedDateFilters,
          ...updatedDateFilters,
        ],
        options: commonListOptions,
        responseShape: jobListResponseShape,
        urlExample:
          '/v1/jobs?query=engineer&location=United+States&remote=true&provider=ats_feed&limit=25',
      },
      {
        path: '/v1/jobs/{id}',
        description: 'Return one normalized job record by ID.',
        filters: [],
        options: [includeDescriptionOption],
        responseShape: `{
  "data": {
    "benefits": [],
    "company": "Okta",
    "companyLogoUrl": null,
    "dentalCoverage": null,
    "description": "Staff UI Software Engineer role details...",
    "healthInsurance": null,
    "id": "cmo6kpzgd008v3evps4z6y05j",
    "jobId": "gh-okta-7613453",
    "jobType": "unknown",
    "location": "Bengaluru, India",
    "paidTimeOff": null,
    "postedAt": "2026-04-22T03:36:59.000Z",
    "provider": "greenhouse",
    "providerUrl": "https://www.okta.com/company/careers/opportunity/7613453?gh_jid=7613453",
    "qualifications": [],
    "remote": false,
    "requirements": [],
    "responsibilities": [],
    "salary": null,
    "source": "Greenhouse",
    "title": "Staff UI Software Engineer",
    "updatedAt": "2026-04-22T07:42:45.986Z",
    "workFromHome": false
  }
}`,
        urlExample: '/v1/jobs/clv_job_123?include_description=true',
      },
    ],
    icon: Search,
    plans: ['Basic', 'Pro', 'Ultra', 'Mega'],
  },
  {
    name: 'Dataset metadata & filters',
    description:
      'Return dataset counts, freshness timestamps, provider totals, and facet values.',
    endpoints: [
      {
        path: '/v1/jobs/stats',
        description: 'Return active count, expired count, and latest update timestamps.',
        filters: [],
        responseShape: `{
  "data": {
    "activeCount": 86222,
    "expiredCount": 3,
    "providerCount": 17,
    "latestPostedAt": "2026-04-30T07:01:19.569Z",
    "latestUpdatedAt": "2026-04-30T07:01:19.569Z"
  },
  "meta": { "queryMs": 101 }
}`,
        urlExample: '/v1/jobs/stats',
      },
      {
        path: '/v1/jobs/providers',
        description: 'Return provider names and listing counts.',
        filters: [],
        responseShape: `{
  "data": [
    { "provider": "ats_feed", "count": 68637 },
    { "provider": "usajobs", "count": 9491 },
    { "provider": "google", "count": 4740 }
  ],
  "meta": { "queryMs": 113 }
}`,
        urlExample: '/v1/jobs/providers',
      },
      {
        path: '/v1/jobs/facets',
        description: 'Return filter values for locations, companies, providers, and job types.',
        filters: [],
        responseShape: `{
  "data": {
    "provider": [{ "value": "ats_feed", "count": 68637 }],
    "remote": [{ "value": "false", "count": 74293 }],
    "jobType": [{ "value": "full_time", "count": 40497 }],
    "location": [{ "value": "United States", "count": 4634 }]
  },
  "meta": { "queryMs": 650 }
}`,
        urlExample: '/v1/jobs/facets',
      },
    ],
    icon: Layers3,
    plans: ['Basic', 'Pro', 'Ultra', 'Mega'],
  },
  {
    name: 'Recent posted jobs',
    description:
      'Return active jobs whose source posted date is within the last 7 days.',
    endpoints: [
      {
        path: '/v1/jobs/posted-7d',
        description: 'List active jobs with a source posted date in the last 7 days.',
        filters: [...commonListFilters, ...postedDateFilters],
        options: commonListOptions,
        responseShape: `${jobListResponseShape.replace(
          '"plan": "pro"',
          '"plan": "pro",\n    "window": "7d",\n    "windowField": "postedAt"',
        )}`,
        urlExample: '/v1/jobs/posted-7d?location=United+States&remote=true&limit=25',
      },
    ],
    icon: Clock3,
    plans: ['Pro', 'Ultra', 'Mega'],
  },
  {
    name: 'New indexed jobs',
    description:
      'Return active jobs first indexed by Gimme Job during the last 24 hours.',
    endpoints: [
      {
        path: '/v1/jobs/indexed-24h',
        description: 'List active jobs discovered by the indexer in the last 24 hours.',
        filters: [...commonListFilters, ...indexedDateFilters],
        options: commonListOptions,
        responseShape: `${jobListResponseShape.replace(
          '"plan": "pro"',
          '"plan": "ultra",\n    "window": "24h",\n    "windowField": "createdAt"',
        )}`,
        urlExample: '/v1/jobs/indexed-24h?has_salary=true&provider=greenhouse&limit=25',
      },
    ],
    icon: Database,
    plans: ['Ultra', 'Mega'],
  },
  {
    name: 'Changed jobs - last 24 hours',
    description:
      'Return active jobs whose normalized record changed during the last 24 hours.',
    endpoints: [
      {
        path: '/v1/jobs/modified-24h',
        description: 'List active jobs with normalized field changes in the last 24 hours.',
        filters: [...commonListFilters, ...updatedDateFilters],
        options: commonListOptions,
        responseShape: `${jobListResponseShape.replace(
          '"plan": "pro"',
          '"plan": "ultra",\n    "window": "24h",\n    "windowField": "updatedAt"',
        )}`,
        urlExample:
          '/v1/jobs/modified-24h?updated_after=2026-04-29T00%3A00%3A00.000Z&limit=25',
      },
    ],
    icon: Zap,
    plans: ['Ultra', 'Mega'],
  },
  {
    name: 'Expired jobs sync',
    description:
      'Return job IDs marked expired, removed, or no longer active.',
    endpoints: [
      {
        path: '/v1/jobs/expired',
        description: 'List expired or removed job IDs for downstream sync.',
        filters: [
          {
            detail: 'Only return expired IDs updated after this timestamp.',
            example: 'updated_after=2026-04-29T00%3A00%3A00.000Z',
            name: 'updated_after',
            values: ['ISO 8601 timestamp'],
          },
          {
            detail: 'Provider/source bucket. Multiple comma-separated values are supported.',
            example: 'provider=ats_feed,greenhouse',
            name: 'provider',
            values: ['ats_feed', 'greenhouse', 'lever', 'remote_ok', 'usajobs', 'google'],
          },
          {
            detail: 'Page size, capped by plan.',
            example: 'limit=100',
            name: 'limit',
            values: ['Ultra 250', 'Mega 500'],
          },
          {
            detail: 'Cursor returned by `meta.nextCursor` for the next page.',
            example: 'cursor=eyJzb3J0Ijoi...',
            name: 'cursor',
          },
        ],
        responseShape: `{
  "data": [
    {
      "id": "clv_job_123",
      "jobId": "source-job-id",
      "provider": "ats_feed",
      "updatedAt": "2026-04-29T05:10:00.000Z"
    }
  ],
  "meta": {
    "count": 100,
    "limit": 100,
    "nextCursor": "eyJzb3J0Ijoi...",
    "offset": 0,
    "queryMs": 12,
    "plan": "ultra"
  }
}`,
        urlExample:
          '/v1/jobs/expired?updated_after=2026-04-29T00%3A00%3A00.000Z&provider=ats_feed&limit=100',
      },
    ],
    icon: ShieldCheck,
    plans: ['Ultra', 'Mega'],
  },
  {
    name: 'Backfill feed',
    description:
      'Return active job listings from the last 6 months for initial import windows.',
    endpoints: [
      {
        path: '/v1/jobs/backfill',
        description: 'List active jobs from the last 6 months for initial imports.',
        filters: [...commonListFilters, ...postedDateFilters],
        options: commonListOptions,
        responseShape: `${jobListResponseShape.replace(
          '"plan": "pro"',
          '"plan": "ultra",\n    "window": "6m",\n    "windowField": "postedAt"',
        )}`,
        urlExample: '/v1/jobs/backfill?provider=ats_feed&limit=100',
      },
    ],
    icon: Database,
    plans: ['Ultra', 'Mega'],
  },
  {
    name: 'Incremental sync & hourly feed',
    description:
      'Return timestamp-ordered updated jobs and hourly discovered job records.',
    endpoints: [
      {
        path: '/v1/jobs/updated',
        description: 'List jobs updated after a timestamp for incremental sync.',
        filters: [
          ...updatedDateFilters,
          commonListFilters[5],
          commonListFilters[6],
          commonListFilters[7],
          commonListFilters[9],
          commonListFilters[10],
        ],
        options: commonListOptions,
        responseShape: `${jobListResponseShape.replace(
          '"plan": "pro"',
          '"plan": "mega"',
        )}`,
        urlExample:
          '/v1/jobs/updated?updated_after=2026-04-01T00%3A00%3A00.000Z&limit=100',
      },
      {
        path: '/v1/jobs/hourly',
        description: 'List jobs discovered in the latest hourly ingestion window.',
        filters: [
          commonListFilters[5],
          commonListFilters[6],
          commonListFilters[7],
          commonListFilters[9],
          commonListFilters[10],
        ],
        options: commonListOptions,
        responseShape: `${jobListResponseShape.replace(
          '"plan": "pro"',
          '"plan": "mega",\n    "window": "1h",\n    "windowField": "createdAt"',
        )}`,
        urlExample: '/v1/jobs/hourly?provider=ats_feed&limit=100',
      },
    ],
    icon: SlidersHorizontal,
    plans: ['Mega'],
  },
] as const;

const endpointGroupGradients = [
  'from-violet-100/80 via-white to-white dark:from-violet-500/10 dark:via-white/[0.025] dark:to-transparent',
  'from-rose-100/80 via-white to-white dark:from-rose-500/10 dark:via-white/[0.025] dark:to-transparent',
  'from-violet-100/80 via-white to-white dark:from-violet-500/10 dark:via-white/[0.025] dark:to-transparent',
  'from-emerald-100/80 via-white to-white dark:from-emerald-500/10 dark:via-white/[0.025] dark:to-transparent',
  'from-fuchsia-100/80 via-white to-white dark:from-fuchsia-500/10 dark:via-white/[0.025] dark:to-transparent',
] as const;

const heroHighlightCardClasses = [
  'from-violet-50 via-white to-white dark:from-violet-500/10 dark:via-white/[0.035] dark:to-transparent',
  'from-rose-50 via-white to-white dark:from-rose-500/10 dark:via-white/[0.035] dark:to-transparent',
  'from-violet-50 via-white to-white dark:from-violet-500/10 dark:via-white/[0.035] dark:to-transparent',
] as const;

const heroHighlightIconClasses = [
  'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-300/15 dark:border-t-violet-100/45 dark:bg-violet-300/10 dark:text-violet-200',
  'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-300/15 dark:border-t-rose-100/45 dark:bg-rose-300/10 dark:text-rose-200',
  'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-300/15 dark:border-t-violet-100/45 dark:bg-violet-300/10 dark:text-violet-200',
] as const;

const filterParameters = [
  { label: 'Search term', detail: 'General text matching' },
  { label: 'Title filter', detail: 'Role and title targeting' },
  { label: 'Organization filter', detail: 'Company-level matching' },
  { label: 'Location filter', detail: 'City, state, or region' },
  { label: 'Description filter', detail: 'Text inside job details' },
  { label: 'Remote status', detail: 'Remote or on-site roles' },
  { label: 'Provider', detail: 'Source-specific results' },
  { label: 'Job type', detail: 'Employment type matching' },
  { label: 'Salary presence', detail: 'Compensation visibility' },
  { label: 'Posted date window', detail: 'Source posted-date range' },
  { label: 'Indexed date window', detail: 'First-seen date range' },
  { label: 'Updated date window', detail: 'Record update range' },
] as const;

const filters = filterParameters.map(filter => filter.label);

const filterCardClasses = [
  'border-violet-200 bg-white text-slate-900 shadow-violet-950/10 dark:border-violet-300/15 dark:bg-violet-300/[0.055] dark:text-violet-100 dark:shadow-violet-950/20',
  'border-rose-200 bg-white text-slate-900 shadow-rose-950/10 dark:border-rose-300/15 dark:bg-rose-300/[0.055] dark:text-rose-100 dark:shadow-rose-950/20',
  'border-emerald-200 bg-white text-slate-900 shadow-emerald-950/10 dark:border-emerald-300/15 dark:bg-emerald-300/[0.055] dark:text-emerald-100 dark:shadow-emerald-950/20',
  'border-fuchsia-200 bg-white text-slate-900 shadow-fuchsia-950/10 dark:border-fuchsia-300/15 dark:bg-fuchsia-300/[0.055] dark:text-fuchsia-100 dark:shadow-fuchsia-950/20',
] as const;

const jsonTokenPattern = /"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?\b|\b(?:true|false|null)\b|[{}\[\],:]/g;

function getJsonTokenClassName(token: string, line: string, index: number): string {
  if (token.startsWith('"')) {
    const rest = line.slice(index + token.length).trimStart();
    return rest.startsWith(':')
      ? 'text-violet-700 dark:text-violet-200'
      : 'text-rose-700 dark:text-rose-200';
  }

  if (/^-?\d/.test(token)) {
    return 'text-sky-700 dark:text-sky-200';
  }

  if (token === 'true' || token === 'false' || token === 'null') {
    return 'text-emerald-700 dark:text-emerald-200';
  }

  return 'text-slate-400 dark:text-slate-500';
}

function renderJsonLine(line: string, lineIndex: number): ReactNode[] {
  const nodes: ReactNode[] = [];
  let cursor = 0;

  for (const match of line.matchAll(jsonTokenPattern)) {
    const token = match[0];
    const index = match.index ?? 0;

    if (index > cursor) {
      nodes.push(line.slice(cursor, index));
    }

    nodes.push(
      <span className={getJsonTokenClassName(token, line, index)} key={`${lineIndex}-${index}`}>
        {token}
      </span>,
    );
    cursor = index + token.length;
  }

  if (cursor < line.length) {
    nodes.push(line.slice(cursor));
  }

  return nodes;
}

function renderJsonCode(source: string): ReactNode {
  return source.split('\n').map((line, index) => (
    <span className="block min-h-5" key={`${index}-${line}`}>
      {renderJsonLine(line, index)}
    </span>
  ));
}

function renderQueryParts(query: string): ReactNode {
  const params = query.split('&').filter(Boolean);

  return params.map((param, index) => {
    const [name, ...valueParts] = param.split('=');
    const value = valueParts.join('=');

    return (
      <span key={`${name}-${index}`}>
        {index > 0 ? <span className="text-slate-400 dark:text-slate-500">&amp;</span> : null}
        <span className="text-rose-700 dark:text-rose-200">{name}</span>
        {value ? (
          <>
            <span className="text-slate-400 dark:text-slate-500">=</span>
            <span className="text-sky-700 dark:text-sky-200">{value}</span>
          </>
        ) : null}
      </span>
    );
  });
}

function renderUrlExample(url: string): ReactNode {
  const [path, query] = url.split('?');

  return (
    <code className="block whitespace-nowrap px-3 py-2.5 font-mono text-xs leading-6">
      <span className="text-emerald-700 dark:text-emerald-200">GET</span>{' '}
      <span className="text-violet-700 dark:text-violet-200">{path}</span>
      {query ? (
        <>
          <span className="text-slate-400 dark:text-slate-500">?</span>
          {renderQueryParts(query)}
        </>
      ) : null}
    </code>
  );
}

function renderQueryExample(example: string): ReactNode {
  const query = example.startsWith('?') ? example.slice(1) : example;

  return (
    <code className="block whitespace-nowrap px-2.5 py-2 font-mono text-[11px] leading-5">
      <span className="text-slate-400 dark:text-slate-500">?</span>
      {renderQueryParts(query)}
    </code>
  );
}

const fields = [
  'title',
  'company',
  'location',
  'remote',
  'salary',
  'jobType',
  'requirements',
  'responsibilities',
  'benefits',
  'providerUrl',
  'postedAt',
  'updatedAt',
] as const;

const RAPIDAPI_HUB_URL =
  'https://rapidapi.com/summon-iq-summon-iq-default/api/gimme-job-listings-api2';

const plans = [
  {
    name: 'Basic',
    price: '$0',
    jobs: '500 jobs / month',
    requests: '100 requests / month',
    rateLimit: '1 request / second',
    features: ['Search & job details', 'Dataset metadata & filters'],
  },
  {
    name: 'Pro',
    price: '$45',
    jobs: '5,000 jobs / month',
    requests: '2,500 requests / month',
    rateLimit: '2 requests / second',
    features: ['Everything in Basic', 'Recent posted jobs'],
  },
  {
    name: 'Ultra',
    price: '$95',
    jobs: '20,000 jobs / month',
    requests: '20,000 requests / month',
    rateLimit: '5 requests / second',
    recommended: true,
    features: [
      'Everything in Pro',
      'New indexed jobs',
      'Changed jobs - last 24 hours',
      'Expired jobs sync',
      'Backfill feed',
    ],
  },
  {
    name: 'Mega',
    price: '$175',
    jobs: '50,000 jobs / month',
    requests: '50,000 requests / month',
    rateLimit: '10 requests / second',
    features: ['Everything in Ultra', 'Incremental sync & hourly feed'],
  },
] as const;

const planCardClasses = [
  'from-slate-50 via-white to-white shadow-slate-950/10 dark:from-slate-400/[0.08] dark:via-white/[0.035] dark:to-transparent dark:shadow-black/35',
  'from-sky-50 via-white to-white shadow-sky-950/10 dark:from-sky-400/[0.10] dark:via-white/[0.035] dark:to-transparent dark:shadow-sky-950/25',
  'from-violet-50 via-white to-white shadow-violet-950/12 dark:from-violet-400/[0.13] dark:via-white/[0.04] dark:to-transparent dark:shadow-violet-950/30',
  'from-rose-50 via-white to-white shadow-rose-950/12 dark:from-rose-400/[0.12] dark:via-white/[0.04] dark:to-transparent dark:shadow-rose-950/30',
] as const;

const workflowCardClasses = [
  'from-violet-50/90 via-white to-white dark:from-violet-400/[0.10] dark:via-white/[0.035] dark:to-transparent',
  'from-rose-50/90 via-white to-white dark:from-rose-400/[0.10] dark:via-white/[0.035] dark:to-transparent',
  'from-sky-50/90 via-white to-white dark:from-sky-400/[0.10] dark:via-white/[0.035] dark:to-transparent',
  'from-emerald-50/90 via-white to-white dark:from-emerald-400/[0.10] dark:via-white/[0.035] dark:to-transparent',
] as const;

const workflowIconClasses = [
  'border-violet-200 bg-violet-50 text-violet-600 dark:border-violet-200/20 dark:border-t-violet-100/45 dark:bg-violet-300/10 dark:text-violet-200',
  'border-rose-200 bg-rose-50 text-rose-600 dark:border-rose-200/20 dark:border-t-rose-100/45 dark:bg-rose-300/10 dark:text-rose-200',
  'border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-200/20 dark:border-t-sky-100/45 dark:bg-sky-300/10 dark:text-sky-200',
  'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-200/20 dark:border-t-emerald-100/45 dark:bg-emerald-300/10 dark:text-emerald-200',
] as const;

const featureMatrix = [
  ['Search & job details', true, true, true, true],
  ['Dataset metadata & filters', true, true, true, true],
  ['Recent posted jobs', false, true, true, true],
  ['New indexed jobs', false, false, true, true],
  ['Changed jobs - last 24 hours', false, false, true, true],
  ['Expired jobs sync', false, false, true, true],
  ['Backfill feed', false, false, true, true],
  ['Incremental sync & hourly feed', false, false, false, true],
] as const;

const workflowSteps = [
  'Use /v1/jobs and /v1/jobs/{id} for search products and detail pages.',
  'Use /v1/jobs/facets, /providers, and /stats to build filters and monitor coverage.',
  'Use Ultra feeds for backfills, changed records, expired IDs, and daily ingestion.',
  'Use Mega for timestamp-ordered incremental sync and hourly production pipelines.',
] as const;

export default function RapidApiPage() {
  return (
    <div className="bg-white pt-28 text-slate-950 dark:bg-slate-950 dark:text-slate-50 sm:pt-32">
      <PageTracker
        pageName="rapidapi"
        properties={{ page_type: 'marketing', product: 'job_listings_api' }}
      />
      <RapidApiAnalyticsTracker />
      <section className="mx-auto grid max-w-7xl gap-10 px-6 pb-14 pt-3 lg:grid-cols-[minmax(0,1fr)_31rem] lg:px-8">
        <div className="relative flex max-w-3xl flex-col justify-center">
          <div className="relative -top-12 mb-[-1rem] inline-flex w-fit items-center gap-2 rounded-full border border-violet-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.94),rgba(248,250,252,0.86))] px-3.5 py-1.5 text-xs font-semibold text-violet-700 shadow-[0_16px_38px_-24px_rgba(139,92,246,0.85),0_0_24px_rgba(232,116,170,0.18)] ring-1 ring-rose-200/45 backdrop-blur-md dark:border-violet-200/25 dark:border-t-violet-100/35 dark:bg-[linear-gradient(135deg,rgba(139,92,246,0.20),rgba(232,116,170,0.12))] dark:text-violet-50 dark:shadow-[0_0_28px_rgba(139,92,246,0.24),0_0_34px_rgba(232,116,170,0.14)] dark:ring-rose-200/15">
            <span className="size-1.5 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.8)]" />
            Available on RapidAPI
          </div>
          <h1 className="text-balance text-4xl font-semibold leading-[1.04] tracking-normal text-slate-950 dark:text-slate-50 sm:text-5xl lg:text-6xl">
            Job listings data for products that need fresh hiring signals
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-slate-600 dark:text-slate-300">
            Gimme Job exposes normalized job listings through RapidAPI with
            search filters, backfill feeds, update feeds, expired job IDs,
            provider counts, facets, and freshness metadata.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link
                data-rapidapi-event="rapidapi_get_started_clicked"
                data-rapidapi-label="hero"
                href="https://rapidapi.com/"
                target="_blank"
                rel="noreferrer"
              >
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#endpoints">View endpoints</Link>
            </Button>
          </div>
          <dl className="mt-10 grid w-full grid-cols-1 gap-4 border-y border-slate-200 py-5 dark:border-white/10 sm:grid-cols-3">
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Features</dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">8</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Plans</dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">4</dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Auth</dt>
              <dd className="mt-2 text-2xl font-semibold text-slate-950 dark:text-white">RapidAPI</dd>
            </div>
          </dl>
        </div>

        <RapidApiPreviewCard filters={filters.slice(0, 8)} />
      </section>

      <section className="border-y border-slate-200 bg-white py-16 dark:border-white/10 dark:bg-slate-900/60">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-3 lg:px-8">
          {[
            {
              icon: SlidersHorizontal,
              title: 'Search term plus real filters',
              text: 'Use general search text with field filters for title, company, location, description, remote status, provider, job type, salary presence, and date windows.',
            },
            {
              icon: Zap,
              title: 'Backfill and sync routes',
              text: 'Separate endpoints cover 6-month backfills, 7-day posted jobs, 24-hour indexed jobs, hourly ingestion, modified jobs, and expired IDs.',
            },
            {
              icon: ShieldCheck,
              title: 'RapidAPI gateway protection',
              text: 'The API expects RapidAPI proxy authorization on /v1 routes, so customers use RapidAPI keys while the origin stays protected.',
            },
          ].map((item, index) => (
            <div
              className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br p-6 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.55)] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/50 hover:shadow-[0_26px_46px_-28px_rgba(15,23,42,0.62)] dark:border-white/[0.08] dark:border-t-white/25 dark:shadow-[0_22px_42px_-22px_rgba(0,0,0,0.7)] ${heroHighlightCardClasses[index]}`}
              key={item.title}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/25" />
              <div
                className={`flex size-11 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] ${heroHighlightIconClasses[index]}`}
              >
                <item.icon className="size-5" />
              </div>
              <h2 className="mt-5 text-lg font-semibold text-slate-950 dark:text-white">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8" id="endpoints">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-4xl">
            Endpoint groups
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
            The API is organized around search, detail retrieval, metadata,
            recent listings, changed records, expired IDs, backfills, and
            incremental sync feeds.
          </p>
        </div>
        <div className="mt-10 grid gap-5">
          {endpointGroups.map((group, index) => (
            <div
              className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white/90 p-5 shadow-[0_10px_24px_-18px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 hover:border-indigo-300/50 hover:shadow-[0_18px_36px_-20px_rgba(15,23,42,0.55)] dark:border-white/[0.08] dark:border-t-white/25 dark:bg-white/[0.035] dark:shadow-[0_20px_38px_-16px_rgba(0,0,0,0.56)] dark:hover:border-white/[0.16] dark:hover:bg-white/[0.055]"
              key={group.name}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${endpointGroupGradients[index % endpointGroupGradients.length]}`}
              />
              <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent opacity-70 dark:via-white/25" />
              <div className="relative flex items-start gap-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-indigo-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] dark:border-[#282942] dark:border-t-[#171926] dark:bg-black/25 dark:text-indigo-200 dark:shadow-[inset_0_1px_0_#171926]">
                  <group.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-slate-950 dark:text-white">{group.name}</h3>
                    {group.plans.map(plan => (
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${planTagClasses[plan]}`}
                        key={`${group.name}-${plan}`}
                      >
                        {plan}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">{group.description}</p>
                </div>
              </div>
              <div className="relative mt-5 space-y-3">
                {group.endpoints.map(endpoint => {
                  const endpointOptions = 'options' in endpoint ? endpoint.options : [];

                  return (
                  <details
                    className="group/endpoint rounded-xl border border-slate-200/90 bg-white/75 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_10px_24px_-20px_rgba(15,23,42,0.45)] transition-colors open:bg-white dark:border-white/[0.07] dark:bg-black/25 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] dark:open:bg-black/35 [&[open]_.endpoint-chevron]:rotate-180"
                    data-rapidapi-endpoint={endpoint.path}
                    key={endpoint.path}
                  >
                    <summary className="list-none cursor-pointer [&::-webkit-details-marker]:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 font-mono text-[10px] font-semibold text-emerald-700 dark:border-emerald-300/15 dark:bg-emerald-300/10 dark:text-emerald-200">
                              GET
                            </span>
                            <code className="font-mono text-[13px] text-slate-800 dark:text-slate-100">
                              {endpoint.path}
                            </code>
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                            {endpoint.description}
                          </p>
                        </div>
                        <ChevronDown className="endpoint-chevron mt-1 size-4 shrink-0 text-slate-400 transition-transform duration-200" />
                      </div>
                    </summary>

                    <div className="mt-4 space-y-3 border-t border-slate-200 pt-4 dark:border-white/10">
                      <div className="rounded-lg border border-indigo-200/70 bg-indigo-50/60 p-3 dark:border-[#282942] dark:border-t-[#171926] dark:bg-indigo-300/[0.06]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-200">
                          URL example
                        </div>
                        <div className="mt-2 overflow-x-auto rounded-md border border-indigo-100 bg-white shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] dark:border-[#222433] dark:border-t-[#171926] dark:bg-[#070911] dark:shadow-none">
                          {renderUrlExample(endpoint.urlExample)}
                        </div>
                      </div>
                      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-[#252738] dark:border-t-[#171926] dark:bg-white/[0.04]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Query filters
                        </div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          {endpoint.filters.length > 0 ? (
                            endpoint.filters.map(filter => (
                              <div
                                className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-black/20"
                                key={`${endpoint.path}-${filter.name}`}
                              >
                                <div className="font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                                  {filter.name}
                                </div>
                                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                                  {filter.detail}
                                </p>
                                {filter.values ? (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {filter.values.map(value => (
                                      <span
                                        className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                                        key={`${endpoint.path}-${filter.name}-${value}`}
                                      >
                                        {value}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {filter.example ? (
                                  <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 dark:border-[#222433] dark:border-t-[#171926] dark:bg-[#070911]">
                                    {renderQueryExample(filter.example)}
                                  </div>
                                ) : null}
                              </div>
                            ))
                          ) : (
                            <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
                              No query filters.
                            </p>
                          )}
                        </div>
                      </div>
                      {endpointOptions.length > 0 ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-[#252738] dark:border-t-[#171926] dark:bg-white/[0.04]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Request options
                          </div>
                          <div className="mt-3 grid gap-2 md:grid-cols-2">
                            {endpointOptions.map(option => (
                              <div
                                className="rounded-lg border border-slate-200 bg-white p-2.5 dark:border-white/10 dark:bg-black/20"
                                key={`${endpoint.path}-${option.name}`}
                              >
                                <div className="font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100">
                                  {option.name}
                                </div>
                                <p className="mt-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                                  {option.detail}
                                </p>
                                {option.values ? (
                                  <div className="mt-2 flex flex-wrap gap-1">
                                    {option.values.map(value => (
                                      <span
                                        className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[10px] text-slate-600 dark:border-white/10 dark:bg-white/[0.04] dark:text-slate-300"
                                        key={`${endpoint.path}-${option.name}-${value}`}
                                      >
                                        {value}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {option.example ? (
                                  <div className="mt-2 overflow-x-auto rounded-md border border-slate-200 bg-slate-50 dark:border-[#222433] dark:border-t-[#171926] dark:bg-[#070911]">
                                    {renderQueryExample(option.example)}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {'requestBody' in endpoint && endpoint.requestBody ? (
                        <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-[#252738] dark:border-t-[#171926] dark:bg-white/[0.04]">
                          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                            Request body
                          </div>
                          <p className="mt-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                            {endpoint.requestBody}
                          </p>
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-[#252738] dark:border-t-[#171926] dark:bg-white/[0.04]">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                          Response body
                        </div>
                        <pre className="mt-2 max-h-80 overflow-auto rounded-lg border border-slate-200 bg-white p-3 font-mono text-xs leading-5 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_12px_24px_-20px_rgba(15,23,42,0.35)] dark:border-[#222433] dark:border-t-[#171926] dark:bg-[#070911] dark:text-slate-200 dark:shadow-none">
                          <code>{renderJsonCode(endpoint.responseShape)}</code>
                        </pre>
                      </div>
                    </div>
                  </details>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-20 text-slate-950 dark:border-white/10 dark:bg-slate-950 dark:text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[24rem_minmax(0,1fr)] lg:px-8">
          <div>
            <h2 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-4xl">
              Search and filter parameters
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Combine broad search text with explicit filters for role,
              organization, location, remote status, provider, employment type,
              salary visibility, and date windows.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filterParameters.map((filter, index) => (
              <div
                className={`group relative overflow-hidden rounded-2xl border p-4 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:bg-white/[0.09] ${filterCardClasses[index % filterCardClasses.length]}`}
                key={filter.label}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/35" />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                    Filter
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500 dark:border-white/10 dark:bg-black/20 dark:text-slate-300">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                </div>
                <div className="mt-4 text-sm font-semibold text-slate-950 dark:text-white">{filter.label}</div>
                <div className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">{filter.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-2 lg:px-8">
        <div>
          <h2 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-4xl">
            Useful fields for search and sync
          </h2>
          <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
            Responses include the fields customers need to build search
            experiences, import pipelines, detail pages, and analytics views.
            Records include normalized job metadata, source URLs, and lifecycle
            timestamps.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3">
            {fields.map(field => (
              <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300" key={field}>
                <Check className="size-4 text-emerald-600" />
                {field}
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-white/10 dark:bg-white/[0.04]">
          <pre className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-5 font-mono text-sm leading-7 text-slate-700 shadow-sm dark:border-[#222433] dark:border-t-[#171926] dark:bg-[#070911] dark:text-slate-200 dark:shadow-none">
            <code>{renderJsonCode(`{
  "data": [{
    "title": "Staff UI Software Engineer",
    "company": "Okta",
    "location": "Bengaluru, India",
    "remote": false,
    "salary": null,
    "jobType": "unknown",
    "provider": "greenhouse",
    "providerUrl": "https://www.okta.com/company/careers/opportunity/7613453?gh_jid=7613453",
    "postedAt": "2026-04-22T03:36:59.000Z",
    "updatedAt": "2026-04-22T07:42:45.986Z"
  }],
  "meta": {
    "limit": 1,
    "nextCursor": "eyJpZCI6ImNtbzZrcHpnZDAwOHYzZXZwczR6NnkwNWoi...",
    "queryMs": 182
  }
}`)}</code>
          </pre>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white py-20 dark:border-white/10 dark:bg-slate-900/60">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="max-w-3xl">
            <h2 className="text-3xl font-semibold tracking-normal text-slate-950 dark:text-white sm:text-4xl">
              Pricing and endpoint access
            </h2>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
              Plans are structured around jobs returned, request volume, and
              ingestion workflow depth. Basic is for testing, Pro is for small
              products, Ultra is the recommended serious data plan, and Mega is
              for production sync pipelines.
            </p>
          </div>

          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan, index) => (
              <div
                className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br p-6 shadow-[0_22px_50px_-34px_var(--tw-shadow-color)] transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300/50 hover:shadow-[0_30px_62px_-38px_var(--tw-shadow-color)] dark:border-white/[0.09] dark:border-t-white/25 dark:bg-white/[0.04] ${planCardClasses[index]}`}
                key={plan.name}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/80 to-transparent dark:via-white/35" />
                <div className="pointer-events-none absolute -right-10 -top-12 size-28 rounded-full bg-violet-400/10 blur-2xl dark:bg-violet-300/10" />
                {plan.recommended ? (
                  <div className="absolute right-4 top-4 rounded-full border border-rose-300/50 bg-rose-300/15 px-2.5 py-1 text-xs font-semibold text-rose-700 shadow-[0_0_18px_rgba(232,116,170,0.18)] dark:border-rose-200/25 dark:bg-rose-300/10 dark:text-rose-100">
                    Recommended
                  </div>
                ) : null}
                <h3 className="relative text-lg font-semibold text-slate-950 dark:text-white">{plan.name}</h3>
                <div className="relative mt-5 flex items-end gap-1 text-slate-950 dark:text-white">
                  <span className="text-4xl font-semibold">{plan.price}</span>
                  <span className="pb-1 text-sm text-slate-500 dark:text-slate-400">/mo</span>
                </div>
                <div className="relative mt-6 space-y-3 text-sm">
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Jobs</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{plan.jobs}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Requests</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{plan.requests}</div>
                  </div>
                  <div>
                    <div className="text-slate-500 dark:text-slate-400">Rate limit</div>
                    <div className="font-semibold text-slate-800 dark:text-slate-100">{plan.rateLimit}</div>
                  </div>
                </div>
                <div className="relative mt-6 space-y-2 border-t border-slate-200 pt-5 dark:border-white/10">
                  {plan.features.map(feature => (
                    <div className="flex gap-2 text-sm text-slate-700 dark:text-slate-300" key={feature}>
                      <Check className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
                <a
                  className="relative mt-6 inline-flex w-full items-center justify-center rounded-xl border border-violet-200/80 bg-white/90 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-[0_12px_28px_-22px_rgba(139,92,246,0.65)] transition-all duration-200 hover:-translate-y-0.5 hover:border-violet-300 hover:bg-violet-50 dark:border-violet-200/20 dark:bg-violet-200/90 dark:text-slate-950 dark:shadow-[0_14px_30px_-20px_rgba(139,92,246,0.75)] dark:hover:border-violet-100/50 dark:hover:bg-violet-100"
                  href={RAPIDAPI_HUB_URL}
                  rel="noreferrer"
                  target="_blank"
                >
                  Get started
                </a>
              </div>
            ))}
          </div>

          <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-slate-50/70 to-white shadow-[0_24px_52px_-38px_rgba(15,23,42,0.55)] dark:border-white/[0.09] dark:border-t-white/25 dark:bg-[linear-gradient(145deg,rgba(255,255,255,0.055),rgba(139,92,246,0.045),rgba(2,6,23,0.08))] dark:shadow-[0_28px_62px_-34px_rgba(0,0,0,0.75)]">
            <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-white">
                <KeyRound className="size-4 text-indigo-600 dark:text-indigo-300" />
                Feature access by tier
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[42rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-500 dark:bg-black/20 dark:text-slate-400">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Feature</th>
                    <th className="px-5 py-3 font-semibold">Basic</th>
                    <th className="px-5 py-3 font-semibold">Pro</th>
                    <th className="px-5 py-3 font-semibold">Ultra</th>
                    <th className="px-5 py-3 font-semibold">Mega</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-white/10">
                  {featureMatrix.map(([feature, basic, pro, ultra, mega]) => (
                    <tr key={feature}>
                      <td className="px-5 py-3 font-medium text-slate-900 dark:text-slate-100">{feature}</td>
                      {[basic, pro, ultra, mega].map((enabled, index) => (
                        <td className="px-5 py-3" key={`${feature}-${index}`}>
                          {enabled ? (
                            <span className="font-semibold text-emerald-700 dark:text-emerald-300">Yes</span>
                          ) : (
                            <span className="text-slate-400 dark:text-slate-600">No</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {workflowSteps.map((step, index) => (
              <div
                className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.45)] transition-all duration-200 hover:-translate-y-0.5 dark:border-white/[0.08] dark:border-t-white/22 dark:shadow-[0_20px_42px_-28px_rgba(0,0,0,0.75)] ${workflowCardClasses[index]}`}
                key={step}
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/75 to-transparent dark:via-white/25" />
                <div className="relative flex gap-3">
                  <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] ${workflowIconClasses[index]}`}>
                    <Sparkles className="size-4" />
                  </span>
                  <p className="text-sm leading-6 text-slate-700 dark:text-slate-300">{step}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-20 lg:px-8">
        <div className="rounded-[1.75rem] border-x-0 border-b border-t border-b-violet-300/75 border-t-violet-200/45 bg-[radial-gradient(circle_at_top_left,rgba(232,116,170,0.16),transparent_34%),linear-gradient(135deg,#ffffff,#f8fafc)] p-8 text-slate-950 shadow-[0_28px_70px_-44px_rgba(139,92,246,0.65)] dark:border-x-0 dark:border-b-white/28 dark:border-t-white/14 dark:bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.22),transparent_34%),linear-gradient(135deg,#0f172a,#020617)] dark:text-white sm:p-10 lg:flex lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-normal">
              Build on fresh job data without running the ingestion stack
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-600 dark:text-slate-300">
              Use RapidAPI for access control and billing, then plug the job
              listing feeds into search products, job boards, CRM enrichment,
              market maps, or AI workflows.
            </p>
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row lg:mt-0">
            <Button asChild size="lg">
              <Link
                data-rapidapi-event="rapidapi_get_started_clicked"
                data-rapidapi-label="final_cta"
                href="https://rapidapi.com/"
                target="_blank"
                rel="noreferrer"
              >
                Get started
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link
                data-rapidapi-event="rapidapi_contact_clicked"
                data-rapidapi-label="final_cta"
                href="mailto:support@gimmejob.com?subject=Gimme%20Job%20Listings%20API"
              >
                Contact us
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
