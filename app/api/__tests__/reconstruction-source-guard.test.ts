// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApplicationRuntimeSource } from '@/generated/prisma/client';

const mocks = vi.hoisted(() => ({
  analyzePageWithVision: vi.fn(),
  assistTrainingSessionFindFirst: vi.fn(),
  assistTrainingSessionUpdate: vi.fn(),
  atsFieldObservationFindFirst: vi.fn(),
  atsFieldObservationFindMany: vi.fn(),
  atsFieldObservationUpdate: vi.fn(),
  atsRuleFindFirst: vi.fn(),
  atsRuleUpdate: vi.fn(),
  atsRuleUpsert: vi.fn(),
  atsSystemFindFirst: vi.fn(),
  atsSystemUpdate: vi.fn(),
  createATSFieldObservation: vi.fn(),
  getCurrentUser: vi.fn(),
  upsertATSFieldObservation: vi.fn(),
  upsertFlowNode: vi.fn(),
}));

vi.mock('@/lib/user/query', () => ({
  getCurrentUser: mocks.getCurrentUser,
}));

vi.mock('@/lib/admin/scrape-service', () => ({
  isAdminUser: vi.fn(),
}));

vi.mock('@/lib/runtime-provenance', () => ({
  createATSFieldObservation: mocks.createATSFieldObservation,
  upsertATSFieldObservation: mocks.upsertATSFieldObservation,
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    aTSFieldObservation: {
      findFirst: mocks.atsFieldObservationFindFirst,
      findMany: mocks.atsFieldObservationFindMany,
      update: mocks.atsFieldObservationUpdate,
    },
    aTSRule: {
      findFirst: mocks.atsRuleFindFirst,
      update: mocks.atsRuleUpdate,
      upsert: mocks.atsRuleUpsert,
    },
    aTSSystem: {
      findFirst: mocks.atsSystemFindFirst,
      update: mocks.atsSystemUpdate,
    },
    assistTrainingSession: {
      findFirst: mocks.assistTrainingSessionFindFirst,
      update: mocks.assistTrainingSessionUpdate,
    },
  },
}));

vi.mock('@/lib/assist-training/vision-analyzer', () => ({
  analyzePageWithVision: mocks.analyzePageWithVision,
}));

vi.mock('@/lib/flow-state/upsert-node', () => ({
  upsertFlowNode: mocks.upsertFlowNode,
}));

import { POST as postFieldObservation } from '@/app/api/assist-mode/field-observation/route';
import { POST as postAnalyzeStep } from '@/app/api/assist-training/[id]/analyze-step/route';

const runtimeSources = Object.values(ApplicationRuntimeSource);
const rejectedRuntimeSources = runtimeSources.filter(
  source => source !== ApplicationRuntimeSource.RECONSTRUCTION,
);

const user = {
  email: 'agent@example.test',
  id: 'user-123',
};

function createJsonRequest(url: string, body: Record<string, unknown>) {
  return new NextRequest(url, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST',
  });
}

function createFieldObservationRequest(source: ApplicationRuntimeSource) {
  return createJsonRequest(
    'http://localhost:10100/api/assist-mode/field-observation',
    {
      action: 'continue',
      actionType: 'fill',
      fieldName: 'email',
      hostname: 'jobs.example.test',
      selector: 'input[name="email"]',
      source,
      tagName: 'input',
    },
  );
}

function createAnalyzeStepRequest(source: ApplicationRuntimeSource) {
  return createJsonRequest(
    'http://localhost:10100/api/assist-training/session-123/analyze-step',
    {
      html: '<html><body><label for="email">Email</label><input id="email" name="email"></body></html>',
      source,
      stepIndex: 0,
      url: 'https://jobs.example.test/apply',
    },
  );
}

function createAnalyzeStepContext() {
  return {
    params: Promise.resolve({ id: 'session-123' }),
  } satisfies Parameters<typeof postAnalyzeStep>[1];
}

describe('reconstruction source route guards', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.getCurrentUser.mockResolvedValue(user);
    mocks.atsSystemFindFirst.mockResolvedValue(null);
    mocks.atsRuleFindFirst.mockResolvedValue(null);
    mocks.upsertATSFieldObservation.mockResolvedValue({ observationCount: 1 });
    mocks.createATSFieldObservation.mockResolvedValue({ observationCount: 1 });
    mocks.assistTrainingSessionFindFirst.mockResolvedValue({
      atsSystemId: null,
      completedSteps: 0,
      hostname: 'jobs.example.test',
      id: 'session-123',
      observationsCreated: 0,
      rulesPromoted: 0,
      stepLogs: [],
      totalSteps: 3,
    });
    mocks.analyzePageWithVision.mockResolvedValue({
      fields: [],
      pageType: 'application_form',
    });
    mocks.upsertFlowNode.mockResolvedValue({ id: 'flow-node-123' });
    mocks.assistTrainingSessionUpdate.mockResolvedValue({});
  });

  it('field observation accepts only source=RECONSTRUCTION', async () => {
    for (const source of rejectedRuntimeSources) {
      const response = await postFieldObservation(
        createFieldObservationRequest(source),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'Reconstruction endpoints can only emit source=RECONSTRUCTION',
      });
      expect(mocks.atsSystemFindFirst).not.toHaveBeenCalled();
      expect(mocks.upsertATSFieldObservation).not.toHaveBeenCalled();
      expect(mocks.createATSFieldObservation).not.toHaveBeenCalled();
    }

    const response = await postFieldObservation(
      createFieldObservationRequest(ApplicationRuntimeSource.RECONSTRUCTION),
    );
    expect(response.status).toBe(200);
    expect(mocks.upsertATSFieldObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: ApplicationRuntimeSource.RECONSTRUCTION,
        }),
      }),
    );
  });

  it('analyze-step accepts only source=RECONSTRUCTION', async () => {
    for (const source of rejectedRuntimeSources) {
      const response = await postAnalyzeStep(
        createAnalyzeStepRequest(source),
        createAnalyzeStepContext(),
      );

      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({
        error: 'Reconstruction endpoints can only emit source=RECONSTRUCTION',
      });
      expect(mocks.assistTrainingSessionFindFirst).not.toHaveBeenCalled();
      expect(mocks.upsertATSFieldObservation).not.toHaveBeenCalled();
      expect(mocks.createATSFieldObservation).not.toHaveBeenCalled();
    }

    const response = await postAnalyzeStep(
      createAnalyzeStepRequest(ApplicationRuntimeSource.RECONSTRUCTION),
      createAnalyzeStepContext(),
    );
    expect(response.status).toBe(200);
    expect(mocks.upsertATSFieldObservation).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          source: ApplicationRuntimeSource.RECONSTRUCTION,
        }),
      }),
    );
  });
});
