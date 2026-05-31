// @vitest-environment node
import {
  ApplicationRuntimeExecutionEnvironment,
  ApplicationRuntimeSource,
} from '@/generated/prisma/client';
import {
  createATSFieldObservation,
  type CreateATSFieldObservationInput,
  createRuntimeEvent,
  type CreateRuntimeEventInput,
  createRuntimeSession,
  type CreateRuntimeSessionInput,
  upsertATSFieldObservation,
  type UpsertATSFieldObservationArgs,
} from '@/lib/runtime-provenance';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  fieldObservationCreate: vi.fn(),
  fieldObservationUpsert: vi.fn(),
  runtimeEventCreate: vi.fn(),
  runtimeSessionCreate: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    aTSFieldObservation: {
      create: mocks.fieldObservationCreate,
      upsert: mocks.fieldObservationUpsert,
    },
    applicationRuntimeEvent: {
      create: mocks.runtimeEventCreate,
    },
    applicationRuntimeSession: {
      create: mocks.runtimeSessionCreate,
    },
  },
}));

describe('runtime provenance helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.fieldObservationCreate.mockResolvedValue({ id: 'observation' });
    mocks.fieldObservationUpsert.mockResolvedValue({ observationCount: 1 });
    mocks.runtimeEventCreate.mockResolvedValue({ id: 'event' });
    mocks.runtimeSessionCreate.mockResolvedValue({ id: 'session' });
  });

  it('createRuntimeEvent rejects a missing source', async () => {
    const input = {
      eventType: 'STEP_COMPLETED',
      sessionId: 'session-id',
      userId: 'user-id',
    } as unknown as CreateRuntimeEventInput;

    await expect(createRuntimeEvent(input)).rejects.toThrow(
      'ApplicationRuntimeSource source is required',
    );
    expect(mocks.runtimeEventCreate).not.toHaveBeenCalled();
  });

  it('createRuntimeEvent accepts every runtime source', async () => {
    for (const source of Object.values(ApplicationRuntimeSource)) {
      await createRuntimeEvent({
        eventType: `TEST_${source}`,
        sessionId: 'session-id',
        source,
        userId: 'user-id',
      });

      expect(mocks.runtimeEventCreate).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ source }),
      });
    }
  });

  it('createATSFieldObservation rejects a missing source', async () => {
    const input = {
      action: 'continue',
      actionType: 'fill',
      hostname: 'jobs.example.test',
      selector: '#email',
      tagName: 'input',
      userId: 'user-id',
    } as unknown as CreateATSFieldObservationInput;

    await expect(createATSFieldObservation(input)).rejects.toThrow(
      'ApplicationRuntimeSource source is required',
    );
    expect(mocks.fieldObservationCreate).not.toHaveBeenCalled();
  });

  it('createATSFieldObservation accepts every runtime source', async () => {
    for (const source of Object.values(ApplicationRuntimeSource)) {
      await createATSFieldObservation({
        action: 'continue',
        actionType: 'fill',
        hostname: 'jobs.example.test',
        selector: `#field-${source}`,
        source,
        tagName: 'input',
        userId: 'user-id',
      });

      expect(mocks.fieldObservationCreate).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ source }),
      });
    }
  });

  it('upsertATSFieldObservation rejects a missing source', async () => {
    const args = {
      create: {
        action: 'continue',
        actionType: 'fill',
        hostname: 'jobs.example.test',
        selector: '#email',
        tagName: 'input',
        userId: 'user-id',
      },
      update: { observationCount: { increment: 1 } },
      where: {
        unique_observation: {
          action: 'continue',
          actionType: 'fill',
          hostname: 'jobs.example.test',
          stableSelector: '#email',
        },
      },
    } as unknown as UpsertATSFieldObservationArgs;

    await expect(upsertATSFieldObservation(args)).rejects.toThrow(
      'ApplicationRuntimeSource source is required',
    );
    expect(mocks.fieldObservationUpsert).not.toHaveBeenCalled();
  });

  it('upsertATSFieldObservation accepts every runtime source', async () => {
    for (const source of Object.values(ApplicationRuntimeSource)) {
      await upsertATSFieldObservation({
        create: {
          action: 'continue',
          actionType: 'fill',
          hostname: 'jobs.example.test',
          selector: `#field-${source}`,
          source,
          stableSelector: `#field-${source}`,
          tagName: 'input',
          userId: 'user-id',
        },
        update: { observationCount: { increment: 1 } },
        where: {
          unique_observation: {
            action: 'continue',
            actionType: 'fill',
            hostname: 'jobs.example.test',
            stableSelector: `#field-${source}`,
          },
        },
      });

      expect(mocks.fieldObservationUpsert).toHaveBeenLastCalledWith({
        create: expect.objectContaining({ source }),
        select: { observationCount: true },
        update: { observationCount: { increment: 1 } },
        where: {
          unique_observation: {
            action: 'continue',
            actionType: 'fill',
            hostname: 'jobs.example.test',
            stableSelector: `#field-${source}`,
          },
        },
      });
    }
  });

  it('createRuntimeSession rejects a missing execution environment', async () => {
    const input = {
      guidedApplicationId: 'guided-application-id',
      userId: 'user-id',
    } as unknown as CreateRuntimeSessionInput;

    await expect(createRuntimeSession(input)).rejects.toThrow(
      'ApplicationRuntimeExecutionEnvironment executionEnvironment is required',
    );
    expect(mocks.runtimeSessionCreate).not.toHaveBeenCalled();
  });

  it('createRuntimeSession accepts every execution environment', async () => {
    for (const executionEnvironment of Object.values(
      ApplicationRuntimeExecutionEnvironment,
    )) {
      await createRuntimeSession({
        executionEnvironment,
        guidedApplicationId: 'guided-application-id',
        userId: 'user-id',
      });

      expect(mocks.runtimeSessionCreate).toHaveBeenLastCalledWith({
        data: expect.objectContaining({ executionEnvironment }),
      });
    }
  });
});
