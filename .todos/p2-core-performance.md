# p2 — Core Performance

## Description:
Identify and fix the worst performance offenders across search, dashboards, and automation: measure slow routes/DB queries/AI calls, reduce scraper latency, and trim bundle weight so users see faster loads and responsive interactions.

## Acceptance Criteria:
- [ ] Profile and optimize AI calls (batching, caching, dedupe)
- [ ] Optimize puppeteer/scraping for speed and reliability
- [ ] Reduce bundle size by auditing and lazy-loading heavy deps
- [ ] Add basic perf telemetry for slow routes/pages

## Validation:
- [ ] Perf measurements before/after show improved latency on identified slow routes/pages.
- [ ] Scraper runs complete faster/stabler under test loads.
- [ ] Bundle analysis reflects reduced weight for target pages/components.
