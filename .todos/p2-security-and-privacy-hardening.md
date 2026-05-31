# p2 — Security & Privacy Hardening

## Description:
Protect user data by tightening access controls, reducing PII exposure, and providing retention/export controls that respect user ownership and privacy.

## Acceptance Criteria:
- [ ] Logs redact or avoid PII by default; sensitive fields are masked.
- [ ] Share/permissions flows enforce least privilege and expire correctly.
- [ ] Users can request/export their data and delete their account data (where applicable).
- [ ] Security-sensitive endpoints validate input strictly and audit access.

## Validation:
- [ ] Logs for sampled flows contain no raw PII (spot-check).
- [ ] Expired/unauthorized share links are denied access.
- [ ] Data export/delete flow runs for a test user and removes data from primary tables.

