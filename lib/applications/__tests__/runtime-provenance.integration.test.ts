// @vitest-environment node
import { db } from '@/lib/db/client';
import {
  ApplicationRuntimeExecutionEnvironment,
  ApplicationRuntimeSource,
} from '@/generated/prisma/client';
import { afterAll, describe, expect, it } from 'vitest';
import {
  createATSFieldObservation,
  createRuntimeEvent,
  createRuntimeSession,
} from '@/lib/runtime-provenance';

const HAS_DB = Boolean(process.env.DATABASE_URL);

let fixtureCounter = 0;
function nextSuffix() {
  fixtureCounter += 1;
  return `p1-1-${Date.now()}-${fixtureCounter}-${Math.random().toString(36).slice(2, 8)}`;
}

const createdUserIds: string[] = [];

async function seedFixture() {
  const suffix = nextSuffix();

  const user = await db.user.create({
    data: {
      email: `runtime-provenance-${suffix}@test.local`,
      firstName: 'Runtime',
      lastName: 'Provenance',
    },
  });
  createdUserIds.push(user.id);

  const guidedApplication = await db.guidedApplication.create({
    data: {
      applicationUrl: `https://jobs.example.test/${suffix}`,
      company: 'Example',
      jobTitle: 'Engineer',
      userId: user.id,
    },
  });

  return { guidedApplication, suffix, user };
}

async function createRuntimeSessionFixture(
  executionEnvironment: ApplicationRuntimeExecutionEnvironment,
) {
  const { guidedApplication, user } = await seedFixture();

  return createRuntimeSession({
    executionEnvironment,
    guidedApplicationId: guidedApplication.id,
    userId: user.id,
  });
}

describe.skipIf(!HAS_DB)('runtime provenance persistence helpers', () => {
  afterAll(async () => {
    for (const userId of createdUserIds) {
      await db.user.delete({ where: { id: userId } }).catch(() => undefined);
    }
  });

  it('persists every source value on runtime events', async () => {
    const session = await createRuntimeSessionFixture(
      ApplicationRuntimeExecutionEnvironment.WEB_RECONSTRUCTION,
    );
    const sources = Object.values(ApplicationRuntimeSource);

    for (const source of sources) {
      const event = await createRuntimeEvent({
        eventType: `TEST_${source}`,
        sessionId: session.id,
        source,
        userId: session.userId,
      });

      expect(event.source).toBe(source);
    }
  });

  it('persists every source value on field observations', async () => {
    const { suffix, user } = await seedFixture();
    const sources = Object.values(ApplicationRuntimeSource);

    for (const [index, source] of sources.entries()) {
      const observation = await createATSFieldObservation({
        action: 'continue',
        actionType: 'fill',
        hostname: `${suffix}.example.test`,
        selector: `#field-${index}`,
        source,
        stableSelector: `label-field-${index}-${suffix}`,
        tagName: 'input',
        userId: user.id,
      });

      expect(observation.source).toBe(source);
    }
  });

  it('persists every runtime execution environment on sessions', async () => {
    const environments = Object.values(ApplicationRuntimeExecutionEnvironment);

    for (const executionEnvironment of environments) {
      const session = await createRuntimeSessionFixture(executionEnvironment);
      expect(session.executionEnvironment).toBe(executionEnvironment);
    }
  });
});
