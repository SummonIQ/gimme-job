# Gimme Job Listings API

Fresh, normalized job listing data for job boards, career sites, recruiting products, labor-market tools, AI search apps, and lead generation workflows.

The API is designed for two common use cases:

- Search: query active job listings directly from your product.
- Sync: keep your own database up to date with active, updated, and expired job records.

All customer-facing endpoints are versioned under `/v1`. Responses are JSON, pagination is cursor-based, and each response includes lightweight metadata so you can track page size, query time, and next-page state.

## What This API Provides

- Active public job listings with title, company, location, remote flags, salary text, job type, source URL, provider, and timestamps.
- Structured arrays for requirements, responsibilities, qualifications, and benefits when available.
- Optional full descriptions using `include_description=true`.
- Cursor pagination for stable paging through large result sets.
- Backfill, recent-posted, indexed, hourly, and modified feeds for ingestion and sync workflows.
- Incremental update feeds ordered by `updatedAt`.
- Expired job IDs so downstream systems can remove stale listings.
- Provider counts, filter facets, and dataset freshness stats.
- Plan-aware page-size caps for predictable performance.

Responses are limited to normalized job listing fields, source metadata, lifecycle timestamps, and endpoint metadata.

## Authentication

Subscribe through RapidAPI and call the endpoints from the RapidAPI gateway. RapidAPI will provide the required request headers in its code examples.

Typical RapidAPI requests include:

```http
x-rapidapi-key: YOUR_RAPIDAPI_KEY
x-rapidapi-host: YOUR_RAPIDAPI_HOST
```

Do not call the Railway origin directly from production client apps. Use the RapidAPI gateway so billing, quotas, analytics, and gateway authorization are applied.

## Base Path

```text
/v1
```

Only `/v1/*` endpoints are intended for subscribers. Infrastructure routes such as `/health` and `/openapi.json` are not marketplace product endpoints.

## Quick Start

Fetch the newest active jobs:

```http
GET /v1/jobs?limit=25
```

Search remote engineering jobs:

```http
GET /v1/jobs?query=engineer&remote=true&limit=25
```

Fetch updated jobs for a sync job:

```http
GET /v1/jobs/updated?updated_after=2026-04-01T00:00:00.000Z&limit=100
```

Fetch the last 6 months of active jobs for a new database:

```http
GET /v1/jobs/backfill?limit=100
```

Fetch jobs discovered in the last hour:

```http
GET /v1/jobs/hourly?limit=100
```

Fetch expired IDs for cleanup:

```http
GET /v1/jobs/expired?updated_after=2026-04-01T00:00:00.000Z&limit=100
```

## JavaScript Example

```javascript
const url = new URL('https://YOUR-RAPIDAPI-HOST/v1/jobs');
url.searchParams.set('query', 'software engineer');
url.searchParams.set('remote', 'true');
url.searchParams.set('limit', '25');

const response = await fetch(url, {
  headers: {
    'x-rapidapi-host': 'YOUR-RAPIDAPI-HOST',
    'x-rapidapi-key': 'YOUR_RAPIDAPI_KEY',
  },
});

if (!response.ok) {
  throw new Error(`Gimme Job API failed: ${response.status}`);
}

const page = await response.json();
console.log(page.data);
console.log(page.meta.nextCursor);
```

## Python Example

```python
import requests

response = requests.get(
    "https://YOUR-RAPIDAPI-HOST/v1/jobs",
    headers={
        "x-rapidapi-host": "YOUR-RAPIDAPI-HOST",
        "x-rapidapi-key": "YOUR_RAPIDAPI_KEY",
    },
    params={
        "query": "software engineer",
        "remote": "true",
        "limit": "25",
    },
    timeout=30,
)

response.raise_for_status()
page = response.json()

print(page["data"])
print(page["meta"].get("nextCursor"))
```

## cURL Example

```sh
curl --request GET \
  --url 'https://YOUR-RAPIDAPI-HOST/v1/jobs?query=software+engineer&remote=true&limit=25' \
  --header 'x-rapidapi-host: YOUR-RAPIDAPI-HOST' \
  --header 'x-rapidapi-key: YOUR_RAPIDAPI_KEY'
```

## Plans And Page Size

The `limit` query parameter controls how many records are returned per request. The API caps `limit` by subscription plan:

| Plan | Max `limit` |
|---|---:|
| Free | 10 |
| Basic | 25 |
| Pro | 100 |
| Ultra | 250 |
| Mega | 500 |
| Enterprise | 500 |

If `limit` is omitted, the default is 25. If `limit` is higher than your plan allows, the API automatically lowers it to your plan cap.

## Endpoint Overview

| Endpoint | Purpose | Pagination |
|---|---|---|
| `GET /v1/jobs` | Search and browse active jobs, newest first. | Cursor |
| `GET /v1/jobs/{id}` | Fetch one active job by `id` or provider `jobId`. | None |
| `GET /v1/jobs/backfill` | Active jobs from the last 6 months. | Cursor or offset |
| `GET /v1/jobs/posted-7d` | Active jobs posted during the last 7 days. | Cursor or offset |
| `GET /v1/jobs/indexed-24h` | Active jobs discovered/indexed during the last 24 hours. | Cursor or offset |
| `GET /v1/jobs/hourly` | Active jobs discovered/indexed during the last hour. | Cursor or offset |
| `GET /v1/jobs/updated` | Sync active jobs ordered by `updatedAt` ascending. | Cursor |
| `GET /v1/jobs/modified-24h` | Active jobs modified during the last 24 hours. | Cursor or offset |
| `GET /v1/jobs/expired` | Sync expired job IDs ordered by `updatedAt` ascending. | Cursor |
| `GET /v1/jobs/providers` | Active job counts by provider. | None |
| `GET /v1/jobs/facets` | Top filter values for providers, remote, job types, and locations. | None |
| `GET /v1/jobs/stats` | Dataset volume and freshness. | None |

## Job Object

Active job endpoints return job objects with this shape:

| Field | Type | Description |
|---|---|---|
| `id` | string | Stable Gimme Job listing ID. |
| `jobId` | string | Upstream/provider job identifier when available. |
| `title` | string or null | Job title. |
| `company` | string or null | Hiring company name. |
| `companyLogoUrl` | string or null | Company logo URL when available. |
| `location` | string or null | Job location text. |
| `remote` | boolean or null | Whether the source marked the role remote. |
| `workFromHome` | boolean or null | Additional work-from-home signal when available. |
| `jobType` | string or null | Normalized job type when available. |
| `salary` | string or null | Salary text from the source or parsed listing. |
| `description` | string or null | Full description, only included when `include_description=true`. |
| `requirements` | string[] | Parsed requirements when available. |
| `responsibilities` | string[] | Parsed responsibilities when available. |
| `qualifications` | string[] | Parsed qualifications when available. |
| `benefits` | string[] | Parsed benefits when available. |
| `healthInsurance` | boolean or null | Health insurance signal when available. |
| `dentalCoverage` | boolean or null | Dental coverage signal when available. |
| `paidTimeOff` | boolean or null | Paid time off signal when available. |
| `provider` | string or null | Source/provider bucket. Use `/v1/jobs/providers` to discover current values. |
| `providerUrl` | string or null | URL to the original job listing. |
| `source` | string or null | Additional source text when available. |
| `postedAt` | string or null | ISO timestamp for posted time when available. |
| `updatedAt` | string | ISO timestamp for the latest update in Gimme Job. |

Example:

```json
{
  "id": "job_123",
  "jobId": "provider-job-456",
  "title": "Software Engineer",
  "company": "Example Co",
  "companyLogoUrl": "https://example.com/logo.png",
  "location": "Remote",
  "remote": true,
  "workFromHome": true,
  "jobType": "full_time",
  "salary": "$120,000 - $160,000",
  "requirements": ["TypeScript", "PostgreSQL"],
  "responsibilities": ["Build APIs", "Improve search quality"],
  "qualifications": [],
  "benefits": ["Health insurance", "Paid time off"],
  "healthInsurance": true,
  "dentalCoverage": true,
  "paidTimeOff": true,
  "provider": "ats_feed",
  "providerUrl": "https://example.com/jobs/456",
  "source": "career_site",
  "postedAt": "2026-04-28T18:30:00.000Z",
  "updatedAt": "2026-04-29T05:10:00.000Z"
}
```

## Response Envelope

List endpoints return:

```json
{
  "data": [],
  "meta": {
    "count": 0,
    "limit": 25,
    "nextCursor": null,
    "offset": 0,
    "queryMs": 12,
    "plan": "pro"
  }
}
```

| Field | Description |
|---|---|
| `data` | Array of records for the current page. |
| `meta.count` | Number of records returned in this response. |
| `meta.limit` | Effective page size after plan caps are applied. |
| `meta.nextCursor` | Opaque cursor for the next page, or `null` when there is no next page. |
| `meta.offset` | Offset used when offset paging is requested. Cursor paging is preferred for production sync. |
| `meta.queryMs` | Database query time in milliseconds. |
| `meta.plan` | RapidAPI plan detected from gateway headers. |

## Pagination

Use `meta.nextCursor` to fetch the next page:

```http
GET /v1/jobs?limit=25&cursor=NEXT_CURSOR
```

Rules:

- Treat cursors as opaque strings.
- Do not edit, decode, or store assumptions about cursor internals.
- Preserve the same filters while paging.
- Stop paging when `nextCursor` is `null`.
- Offset pagination is also accepted for compatibility, but cursor pagination is safer for large or changing datasets.

## GET /v1/jobs

Returns active jobs ordered by newest posted or created time.

```http
GET /v1/jobs?query=designer&location=New+York&remote=false&limit=25
```

Query parameters:

| Parameter | Type | Description |
|---|---|---|
| `query` | string | Searches title and company. |
| `title` / `title_filter` | string | Filters by job title text. Use `OR` between terms for simple multi-term matching. |
| `company` / `organization_filter` | string | Filters by company text. Use `OR` between terms for simple multi-company matching. |
| `location` / `location_filter` | string | Filters by location text. Use `OR` between terms for simple multi-location matching. |
| `description_filter` | string | Filters by description text. Use specific terms for best performance. |
| `remote` | boolean | `true` for remote/work-from-home listings, `false` for non-remote listings. |
| `provider` | string | Filter by provider value. Discover values with `/v1/jobs/providers`. Comma-separated values are supported. |
| `raw_source` | string | Filters by raw source text when available. |
| `job_type` / `employment_type` | string | Filters by normalized job type. Comma-separated values are supported. |
| `has_salary` | boolean | `true` returns only jobs with salary text. |
| `posted_after` | ISO date-time | Returns jobs posted or created after this timestamp. |
| `posted_before` | ISO date-time | Returns jobs posted or created before this timestamp. |
| `date_filter` | ISO date-time | Alias for `posted_after`. |
| `created_after` / `indexed_after` | ISO date-time | Returns jobs discovered/indexed after this timestamp. |
| `updated_after` | ISO date-time | Returns jobs updated after this timestamp. |
| `updated_before` | ISO date-time | Returns jobs updated before this timestamp. |
| `limit` | integer | Page size, capped by plan. |
| `offset` | integer | Offset pagination for compatibility. Ignored when `cursor` is provided. |
| `cursor` | string | Cursor from the previous response. |

Request options:

| Option | Type | Description |
|---|---|---|
| `include_description` | boolean | Set to `true` to include full descriptions. Defaults to `false`. |
| `description_type` | string | Set to `text` to include descriptions. HTML descriptions are not currently returned. |

Use this endpoint for search pages, category pages, and initial backfills where newest active jobs are preferred first.

## GET /v1/jobs/{id}

Fetches one active job by Gimme Job `id` or provider `jobId`.

```http
GET /v1/jobs/job_123
```

Optional query parameters:

| Parameter | Type | Description |
|---|---|---|
| `include_description` | boolean | Set to `true` to include full description text. |

Response:

```json
{
  "data": {
    "id": "job_123",
    "jobId": "provider-job-456",
    "title": "Software Engineer",
    "company": "Example Co",
    "updatedAt": "2026-04-29T05:10:00.000Z"
  }
}
```

If the job is not active or cannot be found, the endpoint returns `404`.

## Feed Endpoints

These endpoints are convenience feeds for common ingestion workflows. They accept the same filters as `/v1/jobs` unless noted otherwise.

| Endpoint | Default Window | Window Field | Best For |
|---|---|---|---|
| `GET /v1/jobs/backfill` | Last 6 months | `postedAt` or `createdAt` | Initial database population and gap filling. |
| `GET /v1/jobs/posted-7d` | Last 7 days | `postedAt` or `createdAt` | Weekly ingestion and recent-posted pages. |
| `GET /v1/jobs/indexed-24h` | Last 24 hours | `createdAt` | Jobs discovered by Gimme Job in the last day, even if the source posted date is older. |
| `GET /v1/jobs/hourly` | Last 1 hour | `createdAt` | Frequent sync jobs and near-real-time ingestion. |
| `GET /v1/jobs/modified-24h` | Last 24 hours | `updatedAt` | Recently changed active records. |

Examples:

```http
GET /v1/jobs/backfill?provider=ats_feed&limit=500
GET /v1/jobs/posted-7d?location=United+States&remote=true&limit=100
GET /v1/jobs/indexed-24h?has_salary=true&limit=100
GET /v1/jobs/hourly?description_type=text&limit=100
GET /v1/jobs/modified-24h?updated_after=2026-04-29T00:00:00.000Z&limit=100
```

You can override a default window by passing the corresponding explicit timestamp filter. For example, `/v1/jobs/backfill?posted_after=2026-01-01T00:00:00.000Z` uses your `posted_after` value instead of the default 6-month window.

## GET /v1/jobs/updated

Returns active jobs ordered by `updatedAt` ascending. This endpoint is built for incremental sync jobs.

```http
GET /v1/jobs/updated?updated_after=2026-04-01T00:00:00.000Z&limit=100
```

Supported filters:

| Parameter | Type | Description |
|---|---|---|
| `updated_after` | ISO date-time | Return jobs updated after this timestamp. |
| `provider` | string | Filter by provider. Comma-separated values are supported. |
| `remote` | boolean | Filter remote or non-remote jobs. |
| `location` | string | Filter by location text. |
| `title` | string | Filter by title text. |
| `company` | string | Filter by company text. |
| `job_type` | string | Filter by normalized job type. |
| `limit` | integer | Page size, capped by plan. |
| `cursor` | string | Cursor from the previous response. |

Request options:

| Option | Type | Description |
|---|---|---|
| `include_description` | boolean | Include full descriptions when `true`. |

Recommended sync pattern:

1. Store the highest `updatedAt` value you have processed.
2. Call `/v1/jobs/updated?updated_after=LAST_SYNC_TIME`.
3. Page until `nextCursor` is `null`.
4. Upsert each returned job by `id`.
5. Save the newest processed `updatedAt` for your next run.

## GET /v1/jobs/expired

Returns expired or dismissed job identifiers ordered by `updatedAt` ascending. Use this to remove stale records from your own database.

```http
GET /v1/jobs/expired?updated_after=2026-04-01T00:00:00.000Z&limit=100
```

Supported filters:

| Parameter | Type | Description |
|---|---|---|
| `updated_after` | ISO date-time | Return expired records updated after this timestamp. |
| `provider` | string | Filter by provider. Comma-separated values are supported. |
| `limit` | integer | Page size, capped by plan. |
| `cursor` | string | Cursor from the previous response. |

Response:

```json
{
  "data": [
    {
      "id": "job_123",
      "jobId": "provider-job-456",
      "provider": "ats_feed",
      "updatedAt": "2026-04-29T05:10:00.000Z"
    }
  ],
  "meta": {
    "count": 1,
    "limit": 100,
    "nextCursor": null,
    "offset": 0,
    "queryMs": 12,
    "plan": "pro"
  }
}
```

Recommended cleanup pattern:

1. Run your active-job update sync.
2. Run `/v1/jobs/expired` with your last expired-sync timestamp.
3. Delete, hide, or mark matching `id` or `jobId` records as expired in your database.
4. Continue paging until `nextCursor` is `null`.

## GET /v1/jobs/providers

Returns active job counts grouped by provider.

```http
GET /v1/jobs/providers
```

Response:

```json
{
  "data": [
    {
      "provider": "ats_feed",
      "count": 32500
    }
  ],
  "meta": {
    "queryMs": 8
  }
}
```

Use this endpoint to discover valid provider filters before calling `/v1/jobs`, `/v1/jobs/updated`, or `/v1/jobs/expired`.

## GET /v1/jobs/facets

Returns the top values for common search filters.

```http
GET /v1/jobs/facets
```

Response:

```json
{
  "data": {
    "provider": [
      { "value": "ats_feed", "count": 32500 }
    ],
    "remote": [
      { "value": "true", "count": 12000 },
      { "value": "false", "count": 20500 }
    ],
    "jobType": [
      { "value": "full_time", "count": 28000 }
    ],
    "location": [
      { "value": "Remote", "count": 9500 }
    ]
  },
  "meta": {
    "queryMs": 14
  }
}
```

Use this endpoint to populate filter dropdowns, dashboards, category pages, and search analytics.

## GET /v1/jobs/stats

Returns dataset volume and freshness.

```http
GET /v1/jobs/stats
```

Response:

```json
{
  "data": {
    "activeCount": 125000,
    "expiredCount": 48000,
    "latestPostedAt": "2026-04-29T04:30:00.000Z",
    "latestUpdatedAt": "2026-04-29T05:10:00.000Z",
    "providerCount": 12
  },
  "meta": {
    "queryMs": 9
  }
}
```

Use this endpoint for status pages, admin dashboards, freshness checks, and monitoring your sync process.

## Common Workflows

### Build A Job Search Page

1. Call `/v1/jobs/facets` to populate filters.
2. Call `/v1/jobs` with `query`, `location`, `remote`, `provider`, or `job_type`.
3. Render `title`, `company`, `location`, `salary`, `remote`, `providerUrl`, and `postedAt`.
4. Use `nextCursor` for "Load more" pagination.
5. Fetch full descriptions only on detail pages with `include_description=true`.

### Mirror Jobs Into Your Database

1. Run an initial import from `/v1/jobs/backfill`.
2. Store each job by `id`.
3. Run `/v1/jobs/updated` on a schedule for upserts.
4. Run `/v1/jobs/expired` on the same schedule for deletes or soft-expiration.
5. Track the latest processed `updatedAt` value for both active and expired feeds.

### Keep Responses Fast

- Leave `include_description=false` for search and list pages.
- Request descriptions only when a user opens a specific job.
- Use `limit` values that match your UI page size.
- Cache provider and facet responses for a few minutes.
- Use incremental sync endpoints instead of repeatedly pulling all jobs.

## Filtering Notes

- Text filters are case-insensitive.
- `provider` accepts comma-separated values.
- `remote=true` matches remote and work-from-home signals.
- `posted_after` and `updated_after` should be ISO date-time strings.
- Location values are text-matched because upstream job boards format locations differently.
- Use `/v1/jobs/providers` and `/v1/jobs/facets` to discover current data values rather than hard-coding assumptions.

## Error Format

Errors use a consistent JSON shape:

```json
{
  "error": {
    "code": "not_found",
    "message": "Job not found."
  }
}
```

Common HTTP statuses:

| Status | Meaning |
|---|---|
| `200` | Successful request. |
| `401` | Request did not come through the authorized RapidAPI gateway. |
| `404` | Job or endpoint not found. |
| `500` | Temporary server error. Retry with backoff. |

## Reliability And Retry Guidance

- Treat `429` responses from RapidAPI as quota or rate-limit events and retry according to your RapidAPI plan.
- Retry `500` responses with exponential backoff.
- Use `queryMs` for API-side query timing; total network latency also depends on the RapidAPI gateway and your client location.
- Prefer scheduled sync for production databases, then serve your own users from your local copy.

## Data Freshness

Use `/v1/jobs/stats` to inspect `latestPostedAt` and `latestUpdatedAt`. Use `/v1/jobs/updated` and `/v1/jobs/expired` to keep a downstream database current without repeatedly scanning the full active dataset.

## Recommended Production Setup

- For search apps: cache list responses briefly and fetch descriptions lazily.
- For job boards: mirror the data locally, update incrementally, and expire stale jobs using `/v1/jobs/expired`.
- For analytics: use `/v1/jobs/stats`, `/v1/jobs/providers`, and `/v1/jobs/facets` before running broad listing pulls.
- For AI workflows: use list endpoints to retrieve candidates, then fetch detailed descriptions only for shortlisted jobs.

## FAQ

### Should I use `/v1/jobs` or `/v1/jobs/updated`?

Use `/v1/jobs` for user-facing search and initial browsing. Use `/v1/jobs/updated` for background sync jobs that need every changed record in update order.

### How do I remove jobs that are no longer active?

Call `/v1/jobs/expired`, page through the results, and mark matching `id` or `jobId` records as expired in your database.

### How do I know which providers exist?

Call `/v1/jobs/providers`. Provider values can change as the dataset changes.

### Why are descriptions optional?

Descriptions can be large. Keeping them off list pages makes responses smaller and faster. Use `include_description=true` for detail pages, exports, or AI analysis.

### Can I page through all jobs?

Yes. Start with `/v1/jobs?limit=YOUR_LIMIT`, then keep passing `meta.nextCursor` until it returns `null`.

### Can I filter multiple providers?

Yes. Pass comma-separated provider values:

```http
GET /v1/jobs?provider=ats_feed,greenhouse&limit=100
```

### Are timestamps UTC?

Yes. Timestamps are returned as ISO strings in UTC.

## Best Practices

- Use RapidAPI's generated code examples for the correct host and authentication headers.
- Store `id`, `jobId`, `updatedAt`, and `providerUrl` in your database.
- Preserve `nextCursor` only while paging a single query.
- Store sync progress using timestamps, not cursors.
- Monitor `/v1/jobs/stats` for freshness and volume changes.
- Keep full descriptions out of high-volume list calls unless you need them.
