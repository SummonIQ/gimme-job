import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

import { ApplicationRuntimeSource } from '@/generated/prisma/client';
import { type Prisma } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import {
  requireAuth,
  validateRequestBody,
  withApiErrorHandling,
} from '@/lib/errors/api';
import {
  recordRuntimeRuleOutcome,
  recordSubmissionConfirmedOutcome,
  recordSubmitBlockedOutcome,
  upsertRulePromotionCandidate,
} from '@/lib/runtime-learning';
import {
  getRuntimeLearningUnavailableMessage,
  hasRuntimeLearningModels,
} from '@/lib/runtime-model-support';
import { buildRuntimeOrchestrationMetadata } from '@/lib/runtime-orchestration';
import { createRuntimeEvent } from '@/lib/runtime-provenance';
import { emitRuntimeSessionUpdate } from '@/lib/runtime-session-events';
import {
  applyRuntimeTrustPolicyGuards,
  evaluateRuntimeTrustPolicy,
} from '@/lib/runtime-trust-policy';
import { getCurrentUser } from '@/lib/user/query';

const optionalTrimmedString = z.preprocess(
  value => {
    if (typeof value !== 'string') {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  },
  z.string().min(1).optional(),
);

const runtimeEventSchema = z.object({
  actionType: optionalTrimmedString,
  errorCode: optionalTrimmedString,
  errorMessage: optionalTrimmedString,
  eventType: z.string().trim().min(1),
  fieldLabel: optionalTrimmedString,
  fieldName: optionalTrimmedString,
  metadata: z.record(z.string(), z.unknown()).optional(),
  selector: optionalTrimmedString,
  stepIndex: z.number().int().min(0).optional(),
  success: z.boolean().optional(),
  url: z.preprocess(
    value => {
      if (typeof value !== 'string') {
        return value;
      }

      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    },
    z.string().url().optional(),
  ),
  valueRedacted: z.string().optional(),
});

const CANDIDATE_EVENT_TYPES = new Set([
  'ACTION_EXECUTED',
  'ACTION_CONFIRMED',
  'STEP_COMPLETED',
  'USER_OVERRIDE',
]);

const handlePOST = async (
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  if (!hasRuntimeLearningModels()) {
    return NextResponse.json(
      {
        error: getRuntimeLearningUnavailableMessage(),
        isAvailable: false,
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const body = validateRequestBody<z.infer<typeof runtimeEventSchema>>(
    await request.json(),
    runtimeEventSchema,
  );

  const session = await db.applicationRuntimeSession.findFirst({
    select: {
      currentUrl: true,
      guidedApplicationId: true,
      id: true,
      mode: true,
      runtimeMetadata: true,
    },
    where: {
      id,
      userId: user!.id,
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const event = await createRuntimeEvent({
    actionType: body.actionType,
    errorCode: body.errorCode,
    errorMessage: body.errorMessage,
    eventType: body.eventType,
    fieldLabel: body.fieldLabel,
    fieldName: body.fieldName,
    metadata: body.metadata as Prisma.InputJsonValue | undefined,
    selector: body.selector,
    sessionId: session.id,
    source: ApplicationRuntimeSource.RECONSTRUCTION,
    stepIndex: body.stepIndex,
    success: body.success,
    url: body.url ?? session.currentUrl ?? undefined,
    userId: user!.id,
    valueRedacted: body.valueRedacted,
  });

  const nextSessionStatus =
    body.eventType === 'SESSION_ABORTED'
      ? 'ABORTED'
      : body.eventType === 'SUBMISSION_CONFIRMED'
        ? 'COMPLETED'
      : body.eventType === 'VALIDATION_ERROR'
        ? 'WAITING_FOR_USER'
      : body.eventType === 'SUBMIT_DETECTED'
        ? 'SUBMITTING'
        : body.eventType === 'STEP_COMPLETED'
          ? 'RUNNING'
          : undefined;

  const isFailureLikeEvent =
    body.success === false ||
    body.eventType === 'USER_OVERRIDE' ||
    body.eventType === 'SESSION_ABORTED';
  const isSuccessLikeEvent =
    body.success === true &&
    ['ACTION_EXECUTED', 'ACTION_CONFIRMED', 'STEP_COMPLETED'].includes(
      body.eventType,
    );

  const existingRuntimeMetadata =
    (session.runtimeMetadata as Record<string, unknown> | null) ?? {};
  const currentRecovery =
    typeof existingRuntimeMetadata.recovery === 'object' &&
    existingRuntimeMetadata.recovery !== null
      ? (existingRuntimeMetadata.recovery as Record<string, unknown>)
      : {};
  const currentAttempts =
    typeof existingRuntimeMetadata.attempts === 'object' &&
    existingRuntimeMetadata.attempts !== null
      ? (existingRuntimeMetadata.attempts as Record<string, unknown>)
      : {};

  const eventUrl = body.url ?? session.currentUrl;
  const hostname = eventUrl ? new URL(eventUrl).hostname : null;
  const heuristicSignal =
    typeof body.metadata?.signal === 'string' ? body.metadata.signal : null;
  const sourceMetadata =
    typeof body.metadata?.source === 'object' && body.metadata.source !== null
      ? (body.metadata.source as Record<string, unknown>)
      : {};
  const isSubmitBlockedEvent =
    body.eventType === 'VALIDATION_ERROR' &&
    (body.errorCode === 'SUBMIT_BLOCKED' ||
      body.metadata?.stage === 'submit-blocked');
  const totalAttemptCount =
    typeof currentAttempts.totalAttemptCount === 'number'
      ? currentAttempts.totalAttemptCount
      : 1;
  const lostTrustedSubmitPath =
    sourceMetadata.submitAwareStep === true &&
    sourceMetadata.trustedSubmitPath !== true;

  let nextMode: string | undefined;
  let nextRuntimeMetadata:
    | Record<string, unknown>
    | Prisma.JsonObject
    | undefined;

  if (isFailureLikeEvent && session.mode) {
    const recentFailureEvents = await db.applicationRuntimeEvent.count({
      where: {
        OR: [{ success: false }, { eventType: 'USER_OVERRIDE' }],
        sessionId: session.id,
      },
    });

    if (isSubmitBlockedEvent) {
      const trustPolicy = hostname
        ? applyRuntimeTrustPolicyGuards(
            await evaluateRuntimeTrustPolicy({ hostname }),
            existingRuntimeMetadata,
          )
        : undefined;
      const shouldEscalateToManualRecovery =
        totalAttemptCount >= 3 ||
        (totalAttemptCount >= 2 && lostTrustedSubmitPath);

      nextMode =
        shouldEscalateToManualRecovery
          ? 'SUGGEST_ONLY'
          : session.mode === 'AUTO_STEP_GUARDED'
            ? 'ACTION_WITH_CONFIRMATION'
            : 'SUGGEST_ONLY';
      nextRuntimeMetadata = {
        ...existingRuntimeMetadata,
        backoff: {
          failureCount: recentFailureEvents,
          triggeredAt: new Date().toISOString(),
          triggeredBy: body.errorCode ?? body.eventType,
        },
        ...(shouldEscalateToManualRecovery
          ? {
              manualRecovery: {
                active: true,
                attemptCount: totalAttemptCount,
                reason: lostTrustedSubmitPath
                  ? 'Repeated attempts lost the trusted submit path and now require manual recovery.'
                  : 'Repeated blocked-submit failures escalated this run into manual recovery.',
                triggeredAt: new Date().toISOString(),
                triggeredBy: body.errorCode ?? body.eventType,
              },
            }
          : {}),
        recovery: {
          ...currentRecovery,
          stableSuccessCount: 0,
        },
        ...(trustPolicy ? { trustPolicy } : {}),
      };
    } else if (
      session.mode === 'AUTO_STEP_GUARDED' &&
      recentFailureEvents >= 2
    ) {
      const shouldEscalateToManualRecovery = totalAttemptCount >= 3;
      nextMode = 'ACTION_WITH_CONFIRMATION';
      nextRuntimeMetadata = {
        ...existingRuntimeMetadata,
        backoff: {
          failureCount: recentFailureEvents,
          triggeredAt: new Date().toISOString(),
          triggeredBy: body.eventType,
        },
        ...(shouldEscalateToManualRecovery
          ? {
              manualRecovery: {
                active: true,
                attemptCount: totalAttemptCount,
                reason:
                  'Repeated failure pressure across multiple attempts escalated this run into manual recovery.',
                triggeredAt: new Date().toISOString(),
                triggeredBy: body.eventType,
              },
            }
          : {}),
        recovery: {
          ...currentRecovery,
          stableSuccessCount: 0,
        },
      };
    } else if (
      session.mode === 'ACTION_WITH_CONFIRMATION' &&
      recentFailureEvents >= 4
    ) {
      const shouldEscalateToManualRecovery = totalAttemptCount >= 3;
      nextMode = 'SUGGEST_ONLY';
      nextRuntimeMetadata = {
        ...existingRuntimeMetadata,
        backoff: {
          failureCount: recentFailureEvents,
          triggeredAt: new Date().toISOString(),
          triggeredBy: body.eventType,
        },
        ...(shouldEscalateToManualRecovery
          ? {
              manualRecovery: {
                active: true,
                attemptCount: totalAttemptCount,
                reason:
                  'Repeated confirmation-mode failures escalated this run into manual recovery.',
                triggeredAt: new Date().toISOString(),
                triggeredBy: body.eventType,
              },
            }
          : {}),
        recovery: {
          ...currentRecovery,
          stableSuccessCount: 0,
        },
      };
    }
  } else if (isSuccessLikeEvent && session.mode && hostname) {
    const stableSuccessCount =
      typeof currentRecovery.stableSuccessCount === 'number'
        ? currentRecovery.stableSuccessCount + 1
        : 1;
    const trustPolicy = applyRuntimeTrustPolicyGuards(
      await evaluateRuntimeTrustPolicy({ hostname }),
      existingRuntimeMetadata,
    );

    const canReescalateToConfirmation =
      session.mode === 'SUGGEST_ONLY' &&
      trustPolicy.recommendedMode !== 'SUGGEST_ONLY' &&
      stableSuccessCount >= 3;

    const canReescalateToGuarded =
      session.mode === 'ACTION_WITH_CONFIRMATION' &&
      trustPolicy.recommendedMode === 'AUTO_STEP_GUARDED' &&
      stableSuccessCount >= 5;

    nextRuntimeMetadata = {
      ...buildRuntimeOrchestrationMetadata({
        currentStepIndex: body.stepIndex,
        eventType: body.eventType,
        existingMetadata: existingRuntimeMetadata,
        metadata: body.metadata as Record<string, unknown> | undefined,
        runtimeStatus: nextMode ? 'WAITING_FOR_USER' : nextSessionStatus,
        source: 'runtime-session-event',
        stage:
          typeof body.metadata?.stage === 'string' ? body.metadata.stage : null,
      }),
      recovery: {
        reescalatedAt:
          canReescalateToConfirmation || canReescalateToGuarded
            ? new Date().toISOString()
            : currentRecovery.reescalatedAt,
        stableSuccessCount,
      },
      trustPolicy,
    };

    if (canReescalateToConfirmation) {
      nextMode = 'ACTION_WITH_CONFIRMATION';
    } else if (canReescalateToGuarded) {
      nextMode = 'AUTO_STEP_GUARDED';
    }
  }

  const updatedSession = await db.applicationRuntimeSession.update({
    data: {
      currentStepIndex:
        body.stepIndex !== undefined ? body.stepIndex : undefined,
      currentUrl: body.url ?? undefined,
      lastActionAt: new Date(),
      lastUserInterventionAt:
        body.eventType === 'USER_OVERRIDE' ? new Date() : undefined,
      mode: nextMode,
      runtimeMetadata:
        (nextRuntimeMetadata as Prisma.InputJsonValue | undefined) ??
        buildRuntimeOrchestrationMetadata({
          currentStepIndex: body.stepIndex,
          eventType: body.eventType,
          existingMetadata: existingRuntimeMetadata,
          metadata: body.metadata as Record<string, unknown> | undefined,
          runtimeStatus: nextSessionStatus,
          source: 'runtime-session-event',
          stage:
            typeof body.metadata?.stage === 'string'
              ? body.metadata.stage
              : null,
        }),
      status: nextMode ? 'WAITING_FOR_USER' : nextSessionStatus,
    },
    where: { id: session.id },
  });

  await emitRuntimeSessionUpdate(updatedSession.id);

  if (hostname && isSubmitBlockedEvent) {
    await recordSubmitBlockedOutcome({
      errorMessage: body.errorMessage,
      hostname,
      signal: heuristicSignal,
      stepIndex: body.stepIndex,
    });
  }

  if (hostname && body.eventType === 'SUBMISSION_CONFIRMED') {
    await recordSubmissionConfirmedOutcome({
      hostname,
      signal: heuristicSignal,
    });
  }

  if (CANDIDATE_EVENT_TYPES.has(body.eventType) && hostname) {
      if (
        body.selector &&
        (body.success === false || body.eventType === 'USER_OVERRIDE')
      ) {
        await recordRuntimeRuleOutcome({
          hostname,
          selector: body.selector,
          success: body.eventType === 'USER_OVERRIDE' ? false : body.success,
        });
      }

      await upsertRulePromotionCandidate({
        actionType:
          body.eventType === 'USER_OVERRIDE'
            ? 'user_override'
            : body.actionType ?? body.eventType.toLowerCase(),
        errorMessage: body.errorMessage,
        fieldLabel: body.fieldLabel,
        fieldName: body.fieldName,
        hostname,
        metadata: body.metadata as Prisma.InputJsonValue | undefined,
        reason:
          typeof body.metadata?.reason === 'string'
            ? body.metadata.reason
            : undefined,
        selector: body.selector,
        source:
          body.eventType === 'USER_OVERRIDE'
            ? ApplicationRuntimeSource.OWNER_OVERRIDE
            : event.source,
        stepIndex: body.stepIndex,
        success: body.success,
        userId: user!.id,
      });
  }

  return NextResponse.json({ event, session: updatedSession }, { status: 201 });
};

const handleGET = async (
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> => {
  const user = await getCurrentUser();
  requireAuth(user);

  if (!hasRuntimeLearningModels()) {
    return NextResponse.json(
      {
        error: getRuntimeLearningUnavailableMessage(),
        events: [],
        isAvailable: false,
      },
      { status: 503 },
    );
  }

  const { id } = await context.params;
  const session = await db.applicationRuntimeSession.findFirst({
    select: { id: true },
    where: {
      id,
      userId: user!.id,
    },
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const events = await db.applicationRuntimeEvent.findMany({
    orderBy: { createdAt: 'asc' },
    take: 500,
    where: { sessionId: session.id },
  });

  return NextResponse.json({ events });
};

export const GET = withApiErrorHandling(handleGET);
export const POST = withApiErrorHandling(handlePOST);
