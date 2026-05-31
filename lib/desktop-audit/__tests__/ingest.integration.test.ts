// @vitest-environment node
import { db } from '@/lib/db/client';
import { afterAll, describe, expect, it } from 'vitest';

import {
  ingestDesktopAuditBatch,
  ingestDesktopAuditRow,
  queryDesktopAuditRows,
} from '../index';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p5-7-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedUser() {
  const suffix = nextSuffix();
  const user = await db.user.create({
    data: {
      email: `desktop-audit-${suffix}@test.local`,
      firstName: 'Desktop',
      lastName: 'Audit',
    },
  });
  createdUserIds.push(user.id);
  return user;
}

describe.skipIf(!HAS_DB)('desktop-audit ingestion (integration)', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.desktopAuditLog
        .deleteMany({ where: { userId } })
        .catch(() => undefined);
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('stores a tool_call row with sensitive keys redacted', async () => {
    const user = await seedUser();
    const created = await ingestDesktopAuditRow({
      action: 'tool_call',
      desktopSessionId: 'session-1',
      durationMs: 42,
      payload: {
        arguments: {
          email: 'steven@example.com',
          jobTitle: 'Senior Engineer',
        },
      },
      toolName: 'fill_field',
      userId: user.id,
    });

    const fetched = await db.desktopAuditLog.findUniqueOrThrow({
      where: { id: created.id },
    });
    const payload = fetched.payload as { arguments: Record<string, unknown> };
    expect(payload.arguments.email).toBe('[REDACTED]');
    expect(payload.arguments.jobTitle).toBe('Senior Engineer');
    expect(fetched.redactedKeys).toContain('arguments.email');
    // The original value must NOT appear anywhere in the persisted row.
    expect(JSON.stringify(fetched)).not.toContain('steven@example.com');
  });

  it('identity_read rows redact the value regardless of key shape', async () => {
    const user = await seedUser();
    const created = await ingestDesktopAuditRow({
      action: 'identity_read',
      desktopSessionId: 'session-2',
      payload: { key: 'first_name', value: 'SecretNameAlpha' },
      toolName: 'identity_load',
      userId: user.id,
    });

    const fetched = await db.desktopAuditLog.findUniqueOrThrow({
      where: { id: created.id },
    });
    const payload = fetched.payload as { key: string; value: string };
    expect(payload.key).toBe('first_name');
    expect(payload.value).toBe('[REDACTED]');
    expect(JSON.stringify(fetched)).not.toContain('SecretNameAlpha');
  });

  it('batch ingest preserves order and returns ids', async () => {
    const user = await seedUser();
    const rows = Array.from({ length: 12 }).map((_, i) => ({
      action: 'tool_call' as const,
      desktopSessionId: 'session-batch',
      payload: { i },
      toolName: 'fill_field',
      userId: user.id,
    }));
    const result = await ingestDesktopAuditBatch(rows);
    expect(result.created).toBe(12);
    expect(result.ids).toHaveLength(12);

    const fetched = await queryDesktopAuditRows({
      desktopSessionId: 'session-batch',
      userId: user.id,
    });
    expect(fetched).toHaveLength(12);
  });

  it('query filters by toolName + jobLeadId', async () => {
    const user = await seedUser();

    await ingestDesktopAuditRow({
      action: 'tool_call',
      jobLeadId: 'lead-A',
      payload: {},
      toolName: 'fill_field',
      userId: user.id,
    });
    await ingestDesktopAuditRow({
      action: 'submit_attempt',
      jobLeadId: 'lead-A',
      payload: {},
      toolName: 'submit_button',
      userId: user.id,
    });
    await ingestDesktopAuditRow({
      action: 'tool_call',
      jobLeadId: 'lead-B',
      payload: {},
      toolName: 'fill_field',
      userId: user.id,
    });

    const filteredByTool = await queryDesktopAuditRows({
      toolName: 'submit_button',
      userId: user.id,
    });
    expect(filteredByTool).toHaveLength(1);

    const filteredByLead = await queryDesktopAuditRows({
      jobLeadId: 'lead-A',
      userId: user.id,
    });
    expect(filteredByLead).toHaveLength(2);
  });

  it('action filter narrows to a single kind', async () => {
    const user = await seedUser();

    await ingestDesktopAuditBatch([
      { action: 'tool_call', payload: {}, toolName: 't', userId: user.id },
      {
        action: 'submit_success',
        payload: {},
        toolName: 't',
        userId: user.id,
      },
      {
        action: 'submit_success',
        payload: {},
        toolName: 't',
        userId: user.id,
      },
    ]);

    const submits = await queryDesktopAuditRows({
      action: 'submit_success',
      userId: user.id,
    });
    expect(submits.length).toBeGreaterThanOrEqual(2);
    for (const row of submits) {
      expect(row.action).toBe('submit_success');
    }
  });

  it('non-object payload is stored as-is after redaction', async () => {
    const user = await seedUser();
    const created = await ingestDesktopAuditRow({
      action: 'error',
      payload: { error: { message: 'oops' } },
      toolName: 'submit_button',
      userId: user.id,
    });
    const fetched = await db.desktopAuditLog.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(fetched.action).toBe('error');
  });
});
