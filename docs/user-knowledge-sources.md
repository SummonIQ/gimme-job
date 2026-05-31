# User Knowledge Sources

P9.5 seeds the minimum cover-letter context needed before P9.3 can generate
letters without asking Steven for the same baseline inputs on every lead.

## Seeded Keys

- `coverLetterStyle`: a concise senior-engineer voice guide. It favors direct,
  evidence-backed writing, concrete technical context, and short cover letters
  over generic enthusiasm.
- `whyThisCompany`: a JSON template library with four starting templates:
  product analytics/workflow platforms, developer infrastructure/platform teams,
  mission-critical systems, and consumer-scale product teams.

## Source Basis

- `lib/resumes/resume.json` supplied the baseline technical themes: React,
  Next.js, TypeScript, GraphQL, cloud infrastructure, accessibility, automation,
  CI/CD, and engineering leadership.
- `FINAL_PLAN.md` Phase 9 supplied the operational need: pre-generate assets
  before bursts so cover letters are not created in the hot submission path.
- The templates intentionally do not claim company-specific facts. P9.3 should
  still inject facts from the job description and company research when those
  facts are available.

## Running The Seed

Use a target user explicitly when possible:

```bash
USER_KNOWLEDGE_SEED_EMAIL=<user-email> bun prisma/seed/user-knowledge.ts
```

The seed is idempotent. It updates prior `seed:p9.5` rows, creates missing rows,
and does not overwrite a `manual` row with equal or higher confidence.

## Review Notes

These are starter defaults, not a substitute for Steven-approved writing
samples. Once real cover letters are reviewed, update `coverLetterStyle` and add
more `whyThisCompany` templates through the knowledge UI or by revising the seed.
