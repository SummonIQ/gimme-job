// Bundles lib/admin/scrape-service.ts (and its full @/* dependency chain)
// into a single CommonJS file the Electron main process can require()
// directly. Lets the desktop run scrapes locally instead of forwarding
// to the web /api/admin/scrape endpoint.
//
// Heavy native / generated modules stay external — they resolve at
// runtime from the repo's node_modules. Keeps the bundle to ~few-hundred
// KB instead of multiple MBs of inlined dependencies, and avoids
// duplicate Prisma client instances between this bundle and admin-db.ts.

import { build } from 'esbuild';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const desktopRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const repoRoot = path.resolve(desktopRoot, '..');

const outFile = path.join(
  desktopRoot,
  'dist-electron',
  'scrape-bundle.mjs',
);

await build({
  bundle: true,
  // Single entry that re-exports runAdminScrape, setScrapeCancellationHook,
  // and the shared `db` Prisma instance. admin-db.ts dynamically imports
  // the same bundle so the Electron main process talks to Postgres through
  // one PrismaClient (no second copy via createRequire).
  entryPoints: [
    path.join(
      repoRoot,
      'desktop',
      'electron',
      'admin',
      'bundle-entry.ts',
    ),
  ],
  external: [
    // Native / packaged modules — let Node resolve from node_modules at
    // runtime so we don't end up with duplicate copies in the bundle.
    'cheerio',
    'playwright',
    'playwright-core',
    'pusher',
    '@prisma/client',
    '@prisma/adapter-pg',
  ],
  format: 'esm',
  logLevel: 'info',
  outfile: outFile,
  platform: 'node',
  // Map @/foo → repoRoot/foo, same as tsconfig.json paths.
  plugins: [
    {
      name: 'gimme-job-alias',
      setup(b) {
        const exts = ['.ts', '.tsx', '.mjs', '.js'];
        b.onResolve({ filter: /^@\// }, args => {
          const subPath = args.path.slice(2); // strip "@/"
          if (subPath === 'app/api/admin/scrape/route') {
            return { external: true, path: args.path };
          }
          const absBase = path.resolve(repoRoot, subPath);
          // Try each extension + index.<ext> until we find something on
          // disk. esbuild doesn't apply resolveExtensions to plugin
          // outputs that already include a path.
          for (const ext of exts) {
            const candidate = absBase + ext;
            if (existsSync(candidate)) return { path: candidate };
          }
          if (existsSync(absBase) && statSync(absBase).isDirectory()) {
            for (const ext of exts) {
              const candidate = path.join(absBase, 'index' + ext);
              if (existsSync(candidate)) return { path: candidate };
            }
          }
          if (existsSync(absBase)) return { path: absBase };
          return { errors: [{ text: `@/ alias unresolved: ${args.path}` }] };
        });
      },
    },
  ],
  resolveExtensions: ['.ts', '.tsx', '.mjs', '.js'],
  target: 'node20',
  // Keep file/line info readable when debugging from main process logs.
  sourcemap: 'inline',
  // Preserve "use server" string literals — they're no-ops outside Next
  // but esbuild would otherwise drop the leading directive.
  legalComments: 'none',
  // The bundle is consumed by an Electron main process whose Node has
  // ESM enabled; CJS interop is fine, esbuild emits a `module.exports`
  // for the top-level exports.
});

// eslint-disable-next-line no-console
console.log(`[bundle-scrape] wrote ${path.relative(repoRoot, outFile)}`);
