// Entry point for desktop/scripts/bundle-scrape.ts. Re-exports both
// the scrape orchestrator surface (runAdminScrape +
// setScrapeCancellationHook) AND the shared `db` Prisma instance from
// lib/db/client. Lets desktop/electron/admin/admin-db.ts dynamically
// import a single bundle to talk to Postgres without doing its own
// createRequire to a non-existent compiled Prisma client.
export {
  runAdminScrape,
  setScrapeCancellationHook,
  setScrapePauseHook,
} from '@/lib/admin/scrape-service';
export { db } from '@/lib/db/client';
