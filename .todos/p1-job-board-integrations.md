# p1 — Job Board Integrations (complete)

## Description:
Maintain reliable job board integrations (LinkedIn/Indeed + fallback scraping) with up-to-date config and compliance.

## Acceptance Criteria:
- [x] Integrate LinkedIn API for job search and application
- [x] Integrate Indeed API for job search and application
- [x] Add fallback/scraping for boards without APIs (ensure compliance)
- [ ] Keep API credentials/config docs up to date

## Validation:
- [ ] LinkedIn and Indeed searches/applications succeed with valid credentials in a test env.
- [ ] Fallback scraping returns listings when APIs are absent, without breaking ToS checks.
- [ ] Setup docs accurately describe required env vars/keys and have been followed successfully on a fresh machine.
