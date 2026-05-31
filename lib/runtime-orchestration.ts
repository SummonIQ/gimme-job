interface RuntimeOrchestrationMetadataInput {
  readonly currentStepIndex?: number;
  readonly eventType: string;
  readonly existingMetadata?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly runtimeStatus?: string;
  readonly source: string;
  readonly stage?: string | null;
}

export function buildRuntimeOrchestrationMetadata({
  currentStepIndex,
  eventType,
  existingMetadata = {},
  metadata,
  runtimeStatus,
  source,
  stage,
}: RuntimeOrchestrationMetadataInput): Record<string, unknown> {
  return {
    ...existingMetadata,
    orchestration: {
      currentStepIndex: currentStepIndex ?? null,
      eventType,
      lastEventAt: new Date().toISOString(),
      runtimeStatus: runtimeStatus ?? null,
      source,
      stage: stage ?? null,
    },
    ...(metadata ? { lastEventMetadata: metadata } : {}),
  };
}
