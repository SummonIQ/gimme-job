# p2 — TypeScript Strict Mode

## Description: Reduce runtime bugs by removing `any`/unsafe casts in core layers while keeping strict compilation practical.

## Acceptance Criteria:
- [ ] Ensure `bunx tsc --noEmit` is part of CI/dev workflow
- [ ] Tighten API helpers (`lib/errors/api.ts`) to use `unknown` + safe narrowing; type Zod schemas
- [ ] Replace `any` in `types/reporting/query.d.ts` (filters/where) with safer types
- [ ] Type onboarding/reporting state (remove `Record<string, any>`, `(row as any).id`)
- [ ] Remove `as any` in API routes; validate with Zod instead
- [ ] Add lint guardrails to prevent new `any` in app/lib/components

## Validation:
- [ ] `bunx tsc --noEmit` passes after changes.
- [ ] Lint run flags no new `any` usage in app/lib/components.
- [ ] Updated files no longer contain unsafe casts for the targeted areas.
