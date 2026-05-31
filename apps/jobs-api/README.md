# Gimme Job Listings API

Standalone Hono API server for selling normalized job listing data through RapidAPI.

## Why This Shape

The main app stores normalized rows in `JobListing`. This API exposes consumer-facing job search and sync surfaces from our own database:

- `GET /v1/jobs` - active jobs, newest first.
- `GET /v1/jobs/backfill` - active jobs from the last 6 months.
- `GET /v1/jobs/posted-7d` - active jobs posted during the last 7 days.
- `GET /v1/jobs/indexed-24h` - active jobs discovered/indexed during the last 24 hours.
- `GET /v1/jobs/hourly` - active jobs discovered/indexed during the last hour.
- `GET /v1/jobs/updated` - active jobs ordered by `updatedAt`, for sync consumers.
- `GET /v1/jobs/modified-24h` - active jobs modified during the last 24 hours.
- `GET /v1/jobs/expired` - dismissed/expired job IDs for sync consumers.
- `GET /v1/jobs/providers` - active job counts by provider.
- `GET /v1/jobs/facets` - top providers, locations, job types, and remote counts.
- `GET /v1/jobs/stats` - dataset volume and freshness for marketplace listings.
- `GET /health` - returns `200` only when Postgres is reachable.

Responses are scoped to normalized public job listing fields, source URLs, metadata, and lifecycle timestamps.

## Environment

```sh
DATABASE_URL=postgresql://...neon.../...?sslmode=require
PORT=3000
RAPIDAPI_PROXY_SECRET=optional-secret-configured-in-rapidapi
DEFAULT_LIMIT=25
HARD_MAX_LIMIT=500
DATABASE_POOL_MAX=10
```

If `RAPIDAPI_PROXY_SECRET` is set, `/v1/*` requires `x-rapidapi-proxy-secret`.

## RapidAPI Setup

- Name: `Gimme Job Listings API`
- Short description: `Search, filter, and sync normalized job listings with provider metadata, facets, and fresh update feeds.`
- Long description: `Gimme Job Listings API provides normalized job listing data for job boards, enrichment products, labor-market tools, AI matching workflows, and internal analytics. Use search and filter endpoints for user-facing discovery, metadata endpoints for coverage checks, and sync feeds for backfills, changed records, expired IDs, and hourly or incremental updates.`
- Category: use `Data` if available; otherwise use the closest jobs/careers category.
- Gateway DNS: `rapidapi.com`
- Firewall: set Railway `RAPIDAPI_PROXY_SECRET` to RapidAPI's `X-RapidAPI-Proxy-Secret`.
- Small logo: `public/brand/rapidapi/gimme-job-rapidapi-logo-square.png`
- Spotlight images:
  - `public/brand/rapidapi/spotlight-search-filters.png`
  - `public/brand/rapidapi/spotlight-sync-feeds.png`
  - `public/brand/rapidapi/spotlight-metadata-coverage.png`

The Postman collection lives at `postman/gimme-job-listings-api.postman_collection.json`.

Current Railway origin: `https://gimme-job-listings-api-production.up.railway.app`.

For RapidAPI endpoint setup, import either the Postman collection or `/openapi.json`, not both. The collection intentionally excludes `/health` and `/openapi.json` because they are operational routes, not customer-facing API products.

## Local

```sh
bun run dev
bun run typecheck
```

## Railway

Deploy this directory as the Railway service root:

```sh
railway up apps/jobs-api --path-as-root --service gimme-job-listings-api
```

Set `DATABASE_URL` to the same Neon connection string used by production. Railway uses `railway.json` for the health check and start command.

RapidAPI can proxy directly to a Railway-generated domain. A custom origin such as `api.gimmejob.com` is not required for RapidAPI buyers, but it is useful for origin health checks, direct enterprise customers, and avoiding a future origin URL migration.
