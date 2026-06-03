import path from 'node:path';
import { fileURLToPath } from 'node:url';
let dbPromise = null;
export function getAdminDb() {
    if (!dbPromise) {
        dbPromise = (async () => {
            // After tsc this file lives at
            //   dist-electron/electron/admin/admin-db.js
            // and the bundle at
            //   dist-electron/scrape-bundle.mjs
            const here = path.dirname(fileURLToPath(import.meta.url));
            const bundlePath = path.resolve(here, '../../scrape-bundle.mjs');
            const mod = (await import(bundlePath));
            if (!mod.db) {
                throw new Error(`scrape-bundle.mjs did not export 'db' — did you run 'bun scripts/bundle-scrape.ts'?`);
            }
            return mod.db;
        })();
    }
    return dbPromise;
}
