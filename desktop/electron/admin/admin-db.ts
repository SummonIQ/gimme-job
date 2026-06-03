import path from 'node:path';
import { fileURLToPath } from 'node:url';

// admin-db delegates to the esbuild-bundled `db` export in
// dist-electron/scrape-bundle.mjs (see scripts/bundle-scrape.ts). That
// bundle includes the full @/generated/prisma client inline, so we
// don't need to createRequire a compiled .js file the Prisma generator
// never emitted.
//
// The bundle is loaded lazily on the first getAdminDb() call. Callers
// must `await getAdminDb()` and then run queries against the returned
// client just like a normal PrismaClient instance.

type Loose = (...args: unknown[]) => Promise<unknown>;

interface AdminDb {
  jobListing: {
    count: (args?: unknown) => Promise<number>;
    findMany: Loose;
    groupBy: Loose;
  };
  jobSearch: {
    findMany: Loose;
    findFirst: Loose;
    update: Loose;
    create: Loose;
  };
  scrapeSession: { findUnique: Loose };
  scrapeSessionEvent: { findMany: Loose };
  automationAuditLog: {
    count: (args?: unknown) => Promise<number>;
    findMany: Loose;
  };
  $queryRawUnsafe: <T = unknown>(
    query: string,
    ...values: unknown[]
  ) => Promise<T>;
}

let dbPromise: Promise<AdminDb> | null = null;

export function getAdminDb(): Promise<AdminDb> {
  if (!dbPromise) {
    dbPromise = (async () => {
      // After tsc this file lives at
      //   dist-electron/electron/admin/admin-db.js
      // and the bundle at
      //   dist-electron/scrape-bundle.mjs
      const here = path.dirname(fileURLToPath(import.meta.url));
      const bundlePath = path.resolve(here, '../../scrape-bundle.mjs');
      const mod = (await import(bundlePath)) as { db: AdminDb };
      if (!mod.db) {
        throw new Error(
          `scrape-bundle.mjs did not export 'db' — did you run 'bun scripts/bundle-scrape.ts'?`,
        );
      }
      return mod.db;
    })();
  }
  return dbPromise;
}
