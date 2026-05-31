<!-- markdownlint-disable MD013 MD034 -->

# Phase 4 — Network-replay decision

**DECISION: SHELVE**

**Decided:** 2026-05-02
**Author:** claude-code (drafted), pending Steven sign-off

## What Phase 4 was

A 2–3 day timeboxed spike to prove (or kill) the thesis that we could submit
applications to Ashby by replaying the GraphQL submit mutation directly,
bypassing the rendered ATS page entirely. The hope was that this would be
faster, cheaper, and harder to fingerprint than driving a browser.

Tracked in `FINAL_PLAN.md` §"Phase 4 — Ashby network-replay spike" (P4.1–P4.5).

## What actually shipped

| Ticket | State | Artifact |
|---|---|---|
| P4.1 | Not done | No `docs/ashby-waterfall-*.har` exists |
| P4.2 | Partial | `NetworkSubmissionRecipe` model + `prisma/seed/ashby-recipe.ts` exist, but the row is SHADOW, never promoted to OWNER_CONFIRMED |
| P4.3 | Partial | `lib/applications/network-runner/recipe-schema.ts` and tests exist; no `NetworkRecipeRunner`, no `curl-impersonate` integration, no template/cookie/rate plumbing |
| P4.4 | Not done | No real Ashby submission ever attempted via this path |
| P4.5 | This doc | — |

The spike never got past schema scaffolding because Phase 5 (the Electron
desktop runtime) overtook it. The desktop CDP path now drives Greenhouse,
Workable, etc. uniformly — including Ashby pages when they need to be filled
manually.

## Why we're shelving (not proceeding, not revisiting)

1. **The CDP runtime won.** Phase 5's desktop runtime handles every ATS we care
   about with one code path. A second runtime surface (per the §0.4 subnote)
   was always a maintenance hazard. We just retired the *previous* second
   runtime in P3.5 — adding another via Phase 4 would re-create the same problem.

2. **Per-vendor recipe maintenance is brittle.** GraphQL schemas, auth flows,
   and CSRF patterns change without notice. Each change breaks one vendor's
   recipe in a way that's hard to detect until the next submission silently
   fails. The CDP runtime is robust against most of those because it sees
   what the user sees.

3. **`curl-impersonate` is an ops dependency we don't want.** It pulls in a
   forked Chromium TLS stack as a sidecar binary. Maintaining it across macOS
   build targets, CI, and developer machines is non-trivial for a benefit
   that only applies to one vendor.

4. **Anti-bot detection is escalating, not de-escalating.** Even if TLS parity
   works today, the cat-and-mouse game continues. Investing in network-replay
   means budgeting for an indefinite escalation. CDP-driven submission stays
   below most detection thresholds because it *is* a real browser.

5. **Single-vendor coverage doesn't justify a parallel runtime.** Even if
   P4.1–P4.4 had completed for Ashby, Phase 4b would have needed
   SmartRecruiters, Greenhouse, and Lever recipes built from scratch. None of
   those are simple ports — Greenhouse in particular uses a non-uniform mix
   of multipart forms and JSON depending on tenant configuration.

## What stays, what goes

**Stays (no removal action required):**
- `prisma/schema.prisma` — `NetworkSubmissionRecipe` model. The row count is
  ~1 (the seeded SHADOW Ashby recipe). It's harmless and the migration is in
  history; removing it would cost more than it would save.
- `lib/applications/network-runner/recipe-schema.ts` + tests — small, isolated,
  works as documentation of the intended shape if anyone wants to reread the
  thesis later.

**Should not be revived without re-opening this decision:**
- Any work on `lib/applications/network-runner/index.ts`,
  `token-extractor.ts`, `template.ts`, `cookie-jar.ts`.
- Any `curl-impersonate` integration.
- Any `scripts/submit-ashby-replay.ts`.
- Any new `NetworkSubmissionRecipe` rows for additional vendors.

If a future change in the landscape (e.g., the desktop runtime becomes
unviable for a specific vendor) makes network-replay attractive again, open
this doc, mark `DECISION: REVISIT`, and link the new context.

## Plan-board cleanup

P4.1, P4.3, P4.4 should move from `[ ]` to `[!]` with reason
`Shelved per docs/network-replay-decision.md`. P4.2 stays `[>]` — the schema
landed and is harmless. P4.5 (this doc) is now `[x]`.

`FINAL_PLAN.md` §"Phase 4b" (if it exists in any future revision) should not
be scheduled.

---

APPROVED_BY:
