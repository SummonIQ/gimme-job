# p3 — Core Performance Optimization

## Description: Improve perceived speed and resource usage for searches, dashboards, and automation by attacking the biggest slow paths.

## Acceptance Criteria:
- [ ] Profile slow routes/pages (timing logs) and DB queries (Prisma logs)
- [ ] Batch/cache AI calls where safe; dedupe repeated prompts
- [ ] Improve scraper reliability/speed (concurrency limits, backoff, avoid extra navigation)
- [ ] Audit heavy deps; lazy-load charts/analytics off critical paths
- [ ] Add basic perf telemetry for slow endpoints/pages

## Validation:
- [ ] Before/after perf metrics show improved response times on target routes/pages.
- [ ] Scraper runs complete within target latency/error thresholds under test.
- [ ] Bundle inspection shows reduced size for affected pages/components.
