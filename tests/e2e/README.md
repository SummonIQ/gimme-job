# Playwright E2E Layout

All end-to-end tests live under `tests/e2e`.

- `auth/`: global setup/auth state tests.
- `pages/`: page-by-page coverage grouped by route domain.
- `artifacts/screenshots/`: visual debugging captures.

Run tests with:

- `bun run test:e2e` (starts a dedicated Playwright dev server on `http://localhost:10110`)
- Override with `PLAYWRIGHT_PORT` or `PLAYWRIGHT_BASE_URL` when needed (for CI matrix or custom ports).
- Playwright uses `NEXT_DIST_DIR=.next-e2e` so it can run alongside a regular `bun dev` server without `.next` lock conflicts.

Current route-focused suites:

- `pages/auth`
- `pages/analytics`
- `pages/app`
- `pages/dashboard`
- `pages/jobs`
- `pages/job-searches`
- `pages/layout`
- `pages/leads`
- `pages/marketing`
- `pages/resumes`
- `pages/notifications`
- `pages/settings`
- `pages/tools`
