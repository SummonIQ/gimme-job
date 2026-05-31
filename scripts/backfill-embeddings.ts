/**
 * Backfill the new `embedding` columns added in
 * 20260508100000_add_pgvector_embeddings for rows that pre-date the
 * write-time embedding hooks.
 *
 *   bun --env-file=.env scripts/backfill-embeddings.ts
 *
 * Optional flags:
 *   --table=FormFieldFeedback   only embed one table
 *   --batch=50                  embed N rows then sleep (default 50)
 *   --sleep-ms=500              ms between batches (default 500)
 *   --dry-run                   count work without spending tokens
 *
 * The embedding helpers in lib/ai/embeddings.ts already write through
 * `db.$executeRaw` with a vector literal; we just enumerate rows whose
 * `embedding IS NULL` and call them.
 */
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import {
  embedFormFieldFeedback,
  embedObservation,
  embedRule,
  embedUserFieldRule,
} from '@/lib/ai/embeddings';

const TABLES = [
  'FormFieldFeedback',
  'UserFieldRule',
  'ATSFieldObservation',
  'ATSRule',
] as const;
type Table = (typeof TABLES)[number];

interface CliOptions {
  readonly table: Table | null;
  readonly batch: number;
  readonly sleepMs: number;
  readonly dryRun: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  let table: Table | null = null;
  let batch = 50;
  let sleepMs = 500;
  let dryRun = false;
  for (const arg of args) {
    if (arg.startsWith('--table=')) {
      const value = arg.slice('--table='.length);
      if (!TABLES.includes(value as Table)) {
        throw new Error(
          `Invalid --table=${value}. Allowed: ${TABLES.join(', ')}`,
        );
      }
      table = value as Table;
    } else if (arg.startsWith('--batch=')) {
      batch = Math.max(1, Number.parseInt(arg.slice('--batch='.length), 10));
    } else if (arg.startsWith('--sleep-ms=')) {
      sleepMs = Math.max(
        0,
        Number.parseInt(arg.slice('--sleep-ms='.length), 10),
      );
    } else if (arg === '--dry-run') {
      dryRun = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return { table, batch, sleepMs, dryRun };
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise(resolve => setTimeout(resolve, ms));
}

async function* idsMissingEmbedding(
  table: Table,
  batchSize: number,
): AsyncGenerator<readonly string[]> {
  // We page by id (cuid, lexicographic). After each batch we filter using
  // id > lastId to avoid scanning the same rows again — important once
  // embeddings start landing and shrinking the result set on each pass.
  let lastId = '';
  while (true) {
    const rows = await prisma.$queryRawUnsafe<Array<{ id: string }>>(
      `SELECT id FROM "${table}"
       WHERE "embedding" IS NULL AND id > $1
       ORDER BY id ASC
       LIMIT $2`,
      lastId,
      batchSize,
    );
    if (rows.length === 0) break;
    yield rows.map(r => r.id);
    lastId = rows[rows.length - 1].id;
    if (rows.length < batchSize) break;
  }
}

const EMBED_FUNCTIONS: Record<Table, (id: string) => Promise<void>> = {
  FormFieldFeedback: embedFormFieldFeedback,
  UserFieldRule: embedUserFieldRule,
  ATSFieldObservation: embedObservation,
  ATSRule: embedRule,
};

async function backfillTable(
  table: Table,
  options: CliOptions,
): Promise<{ embedded: number; failed: number }> {
  const total = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
    `SELECT COUNT(*)::bigint AS count FROM "${table}" WHERE "embedding" IS NULL`,
  );
  const remaining = Number(total[0]?.count ?? 0n);
  console.log(`[${table}] ${remaining} rows missing embedding`);
  if (options.dryRun || remaining === 0) {
    return { embedded: 0, failed: 0 };
  }

  const embedFn = EMBED_FUNCTIONS[table];
  let embedded = 0;
  let failed = 0;
  for await (const ids of idsMissingEmbedding(table, options.batch)) {
    for (const id of ids) {
      try {
        await embedFn(id);
        embedded += 1;
      } catch (error) {
        failed += 1;
        console.warn(`[${table}] embed failed for ${id}:`, error);
      }
    }
    console.log(
      `[${table}] embedded ${embedded}/${remaining} (failed ${failed})`,
    );
    await sleep(options.sleepMs);
  }
  return { embedded, failed };
}

async function main(): Promise<void> {
  const options = parseArgs();
  const targets = options.table ? [options.table] : TABLES;
  let totalEmbedded = 0;
  let totalFailed = 0;
  for (const table of targets) {
    const { embedded, failed } = await backfillTable(table, options);
    totalEmbedded += embedded;
    totalFailed += failed;
  }
  console.log(
    `\nDone. Embedded ${totalEmbedded} rows across ${targets.length} table(s) (${totalFailed} failures).`,
  );
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
