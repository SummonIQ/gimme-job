# p1 — MVP Polish & Error Handling

## Description

Remove “demo” gaps and make the core loop trustworthy: fix broken APIs, replace mock dashboards with real data, ensure automation performs real submissions with auditability, and present actionable errors/loading/empty states so users can reliably search, create leads, apply/automate, and view outcomes.

## Acceptance Criteria

- [x] Fix routes misusing `requireAuth(await request.json())` — Fixed contacts/route.ts
- [ ] ~~Re-enable LinkedIn approval APIs~~ — DELETED: Was for posting content, not job seeking
- [ ] Replace mock analytics — BLOCKED: UI components have mock data but no Interview/SkillGap models in DB schema
- [ ] Wire automation to real submissions — DELETED fake services; only Indeed Puppeteer remains (untested)
- [ ] Implement Indeed resume upload — Code exists but untested in production
- [x] Standardize API error responses — Refactored a few routes
- [x] Audit loading/empty/retry states — Files exist

## Validation

- [x] Listed APIs accept/return expected payloads — Fixed contacts route
- [ ] ~~Approval dashboard~~ — DELETED: Irrelevant feature
- [ ] Analytics pages render real data — UI still uses mock data
- [ ] Automation creates real submissions — Not working, fake services deleted
- [ ] Indeed automation tested — Untested
- [x] UI has error/loading states — Files exist
