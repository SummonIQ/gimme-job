import 'server-only';

import { Prisma } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';

let hasAssignmentSemanticsPromise: Promise<boolean> | null = null;

export async function planBoardHasAssignmentSemantics(): Promise<boolean> {
  if (!hasAssignmentSemanticsPromise) {
    hasAssignmentSemanticsPromise = db
      .$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'PlanBoardTask'
            AND column_name = 'claimedAt'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'PlanBoardTask'
            AND column_name = 'assignmentReason'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'PlanBoardEvent'
            AND column_name = 'assignmentReason'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'PlanBoardEvent'
            AND column_name = 'nextAgentHandle'
        ) AND EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'PlanBoardEvent'
            AND column_name = 'previousAgentHandle'
        ) AS "exists"
      `
      .then(rows => Boolean(rows[0]?.exists));
  }

  return hasAssignmentSemanticsPromise;
}

export function isMissingPlanBoardAssignmentSemanticsColumnError(
  error: unknown,
): boolean {
  const missingColumns = [
    'PlanBoardTask.claimedAt',
    'PlanBoardTask.assignmentReason',
    'PlanBoardEvent.assignmentReason',
    'PlanBoardEvent.nextAgentHandle',
    'PlanBoardEvent.previousAgentHandle',
  ];

  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2022' &&
    missingColumns.some(column => error.message.includes(column))
  );
}
