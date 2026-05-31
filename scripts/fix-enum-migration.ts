/**
 * Script to migrate old JobLeadStatus enum values to new ones before running db:push.
 *
 * Old → New mapping:
 *   DISMISSED → REMOVED
 *   INTERVIEWED → INTERVIEW_COMPLETED
 *   OFFER_ACCEPTED → HIRED
 *   OFFER_MADE → OFFER
 *   OFFER_REJECTED → OFFER_DECLINED
 *
 * Usage: bun scripts/fix-enum-migration.ts
 */

import { PrismaClient } from '../generated/prisma';

const db = new PrismaClient();

const ENUM_MAPPING: Record<string, string> = {
  DISMISSED: 'REMOVED',
  INTERVIEWED: 'INTERVIEW_COMPLETED',
  OFFER_ACCEPTED: 'HIRED',
  OFFER_MADE: 'OFFER',
  OFFER_REJECTED: 'OFFER_DECLINED',
};

async function main() {
  console.log('🔍 Checking for rows with old JobLeadStatus values...\n');

  // Use raw SQL since Prisma client already has the new enum and won't accept old values
  for (const [oldValue, newValue] of Object.entries(ENUM_MAPPING)) {
    const count = await db.$queryRawUnsafe<{ count: bigint }[]>(
      `SELECT COUNT(*) as count FROM "job_lead" WHERE "status" = $1`,
      oldValue,
    );

    const rowCount = Number(count[0]?.count ?? 0);

    if (rowCount > 0) {
      console.log(`  Updating ${rowCount} rows: ${oldValue} → ${newValue}`);
      await db.$executeRawUnsafe(
        `UPDATE "job_lead" SET "status" = $1 WHERE "status" = $2`,
        newValue,
        oldValue,
      );
    } else {
      console.log(`  No rows with status ${oldValue} — skipping`);
    }
  }

  // Also check the default value on the column
  const defaultInfo = await db.$queryRawUnsafe<{ column_default: string | null }[]>(
    `SELECT column_default FROM information_schema.columns 
     WHERE table_name = 'job_lead' AND column_name = 'status'`,
  );

  if (defaultInfo[0]?.column_default) {
    const currentDefault = defaultInfo[0].column_default;
    console.log(`\n  Current column default: ${currentDefault}`);

    for (const oldValue of Object.keys(ENUM_MAPPING)) {
      if (currentDefault.includes(oldValue)) {
        console.log(`  ⚠️  Default uses old value "${oldValue}" — db:push will handle this`);
      }
    }
  }

  console.log('\n✅ Data migration complete. You can now run: bun db:push\n');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
