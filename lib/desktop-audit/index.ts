import { db } from '@/lib/db/client';
import type { DesktopAuditLog, Prisma } from '@/generated/prisma/client';

import {
  redactIdentityReadPayload,
  redactSensitivePayload,
} from './redaction';

export type DesktopAuditAction =
  | 'tool_call'
  | 'submit_attempt'
  | 'submit_success'
  | 'submit_failure'
  | 'identity_read'
  | 'session_start'
  | 'session_end'
  | 'error';

export interface IngestAuditRow {
  readonly userId: string;
  readonly tokenId?: string | null;
  readonly desktopSessionId?: string | null;
  readonly runtimeSessionId?: string | null;
  readonly jobLeadId?: string | null;
  readonly toolName: string;
  readonly action: DesktopAuditAction;
  readonly outcome?: 'ok' | 'error' | null;
  readonly payload: unknown;
  readonly errorMessage?: string | null;
  readonly durationMs?: number | null;
}

/**
 * Persists a desktop audit row. Identity-read rows always redact the
 * value; all other actions are redaction-swept by key name.
 */
export async function ingestDesktopAuditRow(
  row: IngestAuditRow,
): Promise<DesktopAuditLog> {
  const redaction =
    row.action === 'identity_read'
      ? redactIdentityReadPayload(row.payload)
      : redactSensitivePayload(row.payload);

  return db.desktopAuditLog.create({
    data: {
      action: row.action,
      desktopSessionId: row.desktopSessionId ?? null,
      durationMs: row.durationMs ?? null,
      errorMessage: row.errorMessage ?? null,
      jobLeadId: row.jobLeadId ?? null,
      outcome: row.outcome ?? null,
      payload: redaction.payload as Prisma.InputJsonValue,
      redactedKeys: [...redaction.redactedKeys],
      runtimeSessionId: row.runtimeSessionId ?? null,
      tokenId: row.tokenId ?? null,
      toolName: row.toolName,
      userId: row.userId,
    },
  });
}

export async function ingestDesktopAuditBatch(
  rows: readonly IngestAuditRow[],
): Promise<{ created: number; ids: readonly string[] }> {
  const ids: string[] = [];
  for (const row of rows) {
    const created = await ingestDesktopAuditRow(row);
    ids.push(created.id);
  }
  return { created: ids.length, ids };
}

export interface DesktopAuditQuery {
  readonly userId: string;
  readonly desktopSessionId?: string;
  readonly toolName?: string;
  readonly jobLeadId?: string;
  readonly runtimeSessionId?: string;
  readonly action?: DesktopAuditAction;
  readonly limit?: number;
  readonly since?: Date;
}

export async function queryDesktopAuditRows(
  query: DesktopAuditQuery,
): Promise<readonly DesktopAuditLog[]> {
  return db.desktopAuditLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: Math.min(500, Math.max(1, query.limit ?? 100)),
    where: {
      ...(query.desktopSessionId
        ? { desktopSessionId: query.desktopSessionId }
        : {}),
      ...(query.toolName ? { toolName: query.toolName } : {}),
      ...(query.jobLeadId ? { jobLeadId: query.jobLeadId } : {}),
      ...(query.runtimeSessionId
        ? { runtimeSessionId: query.runtimeSessionId }
        : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.since ? { createdAt: { gte: query.since } } : {}),
      userId: query.userId,
    },
  });
}

export {
  redactIdentityReadPayload,
  redactSensitivePayload,
} from './redaction';
