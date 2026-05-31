<!-- markdownlint-disable MD013 MD034 -->

# Runbook — manual Greenhouse submission (RETIRED)

**Status:** Retired — see "Replacement" below
**Retired:** 2026-05-02 (P3.5)

The CLI-driven CDP path described by this runbook (`scripts/submit-greenhouse.ts`,
`lib/applications/runtime-executor.ts`, `lib/applications/cdp/*`) has been
removed. The desktop runtime is now the sole authoritative submission surface.

## Replacement

Use the desktop app for manual Greenhouse submissions:

1. Open the desktop app and pair it (`/desktop/pair`).
2. Navigate the assist BrowserView to the application URL.
3. Run "Autofill" (training) to dry-fill, or "Submit" to send.
4. Inspect the State sidebar tab to verify field values and selectors.
5. Field corrections are persisted via the corrections API and reused on the
   next run for that hostname.

The corresponding code lives under `desktop/electron/submit/` and
`desktop/renderer/`.

## Things this runbook used to cover

| Topic | New home |
|---|---|
| Pre-submission safety gate | `lib/runtime-safety/checks.ts` (still in use) |
| Greenhouse rule pack seed | `bun run scripts/bootstrap-greenhouse-rules.ts` (still in use) |
| Confirmation phrase registry | `lib/applications/confirmation-detector.ts` + `submission-confirmation.ts` (still in use) |
| Confirmation inbox polling | `/admin/confirmation-inboxes`, `lib/email-ingestion/` |
| Per-host rate limiter | `lib/runtime-safety/checks.ts` |
| Auto-fail cron | `POST /api/cron/reconcile-pending` (P10.4) |
| Detection health | `/admin/detection-health` (P16.6) |

If you're tempted to revive the CLI path: don't. Add the missing capability
to the desktop runtime instead.
