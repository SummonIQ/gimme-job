// @vitest-environment node
import { ApplicationRuntimeExecutionEnvironment } from '@/generated/prisma/client';
import { db } from '@/lib/db/client';
import { createRuntimeSession } from '@/lib/runtime-provenance';
import { afterAll, describe, expect, it } from 'vitest';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p6-1-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedSession() {
  const suffix = nextSuffix();

  const user = await db.user.create({
    data: {
      email: `replay-artifact-${suffix}@test.local`,
      firstName: 'Replay',
      lastName: 'Artifact',
    },
  });
  createdUserIds.push(user.id);

  const guidedApplication = await db.guidedApplication.create({
    data: {
      applicationUrl: `https://fixture.example/apply/${suffix}`,
      userId: user.id,
    },
  });

  const session = await createRuntimeSession({
    executionEnvironment: ApplicationRuntimeExecutionEnvironment.REPLAY,
    guidedApplicationId: guidedApplication.id,
    userId: user.id,
  });

  return { session, user };
}

describe.skipIf(!HAS_DB)('ReplayArtifact schema', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('creates an artifact with every field populated', async () => {
    const { session } = await seedSession();

    const gzippedDom = Buffer.from([
      0x1f, 0x8b, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);
    const eventBundle = {
      events: [
        { name: 'transition', ts: 1, to: 'review' },
        { name: 'field_fill', selector: '#email', ts: 2 },
      ],
    };
    const screenshotUrls = [
      'https://blob.vercel-storage.com/p6-1/a.png',
      'https://blob.vercel-storage.com/p6-1/b.png',
    ];

    const created = await db.replayArtifact.create({
      data: {
        domSnapshots: gzippedDom,
        eventBundle,
        screenshotUrls,
        sessionId: session.id,
        sizeBytes: gzippedDom.byteLength,
      },
    });

    expect(created.sessionId).toBe(session.id);
    expect(Buffer.from(created.domSnapshots!).toString('hex')).toBe(
      gzippedDom.toString('hex'),
    );
    expect(created.domSnapshotsMimeType).toBe('application/gzip');
    expect(created.screenshotUrls).toEqual(screenshotUrls);
    expect(created.eventBundle).toEqual(eventBundle);
    expect(created.sizeBytes).toBe(gzippedDom.byteLength);
  });

  it('fetches an artifact by id and by sessionId', async () => {
    const { session } = await seedSession();

    const first = await db.replayArtifact.create({
      data: {
        eventBundle: { events: [{ name: 'first' }] },
        screenshotUrls: [],
        sessionId: session.id,
      },
    });
    const second = await db.replayArtifact.create({
      data: {
        eventBundle: { events: [{ name: 'second' }] },
        screenshotUrls: ['https://blob.vercel-storage.com/two.png'],
        sessionId: session.id,
      },
    });

    const byId = await db.replayArtifact.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(byId.id).toBe(first.id);

    const bySession = await db.replayArtifact.findMany({
      orderBy: { createdAt: 'asc' },
      where: { sessionId: session.id },
    });
    const ids = bySession.map(r => r.id);
    expect(ids).toContain(first.id);
    expect(ids).toContain(second.id);
  });

  it('deletes an artifact and leaves the session intact', async () => {
    const { session } = await seedSession();

    const artifact = await db.replayArtifact.create({
      data: {
        eventBundle: { events: [] },
        screenshotUrls: [],
        sessionId: session.id,
      },
    });

    await db.replayArtifact.delete({ where: { id: artifact.id } });

    const gone = await db.replayArtifact.findUnique({
      where: { id: artifact.id },
    });
    expect(gone).toBeNull();

    const sessionStillThere = await db.applicationRuntimeSession.findUnique({
      where: { id: session.id },
    });
    expect(sessionStillThere).not.toBeNull();
  });

  it('cascade-deletes artifacts when the parent session is deleted', async () => {
    const { session } = await seedSession();

    const a = await db.replayArtifact.create({
      data: {
        eventBundle: { events: [] },
        screenshotUrls: [],
        sessionId: session.id,
      },
    });
    const b = await db.replayArtifact.create({
      data: {
        eventBundle: { events: [] },
        screenshotUrls: [],
        sessionId: session.id,
      },
    });

    await db.applicationRuntimeSession.delete({ where: { id: session.id } });

    const remaining = await db.replayArtifact.findMany({
      where: { id: { in: [a.id, b.id] } },
    });
    expect(remaining).toEqual([]);
  });
});
