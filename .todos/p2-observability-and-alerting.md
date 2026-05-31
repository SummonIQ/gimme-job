# p2 — Observability & Alerting

## Description:
Standardize logging/metrics/tracing for core flows (search, automation, scraping, API) and add alerts for failures/slowdowns so issues are detected early and are diagnosable.

## Acceptance Criteria:
- [ ] Structured logging with request/user context for core APIs and automation/scraper paths.
- [ ] Metrics or traces for latency/error rates on key routes and automation jobs.
- [ ] Alerts configured for scraper/automation failures and API error spikes.
- [ ] Sentry (or equivalent) captures breadcrumbs and context for errors in app and automation.

## Validation:
- [ ] A forced error in a key route appears in logs/metrics/Sentry with context.
- [ ] An induced scraper/automation failure triggers an alert and is visible in dashboards.
- [ ] Latency metrics show up for sampled requests; slow routes are identifiable.

