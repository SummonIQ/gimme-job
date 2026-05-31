/**
 * P3.1 — CLI entry point for the Greenhouse rule-pack bootstrap.
 *
 * Run with:
 *   bun run scripts/bootstrap-greenhouse-rules.ts
 * or limit hostnames:
 *   bun run scripts/bootstrap-greenhouse-rules.ts job-boards.greenhouse.io
 *
 * Script is idempotent — running it twice leaves the DB in the same
 * state (created counts 0 on the second run).
 */
import {
  GREENHOUSE_HOSTNAMES,
} from '@/lib/seed/greenhouse-rule-pack';
import { applyGreenhouseRulePack } from '@/prisma/seed/greenhouse-rule-pack';

async function main() {
  const args = process.argv.slice(2).filter(Boolean);
  const hostnames = args.length > 0 ? args : [...GREENHOUSE_HOSTNAMES];

  const started = Date.now();
  const result = await applyGreenhouseRulePack(hostnames);
  const durationMs = Date.now() - started;

  console.log(
    JSON.stringify(
      {
        durationMs,
        hostnames,
        ...result,
      },
      null,
      2,
    ),
  );
}

main().catch(err => {
  console.error('bootstrap-greenhouse-rules failed:', err);
  process.exit(1);
});
