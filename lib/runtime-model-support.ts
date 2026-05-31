import { db } from '@/lib/db/client';

interface RuntimeModelRegistry {
  applicationFlowDefinition?: {
    count: (...args: unknown[]) => Promise<number>;
    create: (...args: unknown[]) => Promise<unknown>;
    findFirst: (...args: unknown[]) => Promise<unknown>;
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    findUnique: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
    upsert: (...args: unknown[]) => Promise<unknown>;
  };
  applicationFlowStepDefinition?: {
    createMany: (...args: unknown[]) => Promise<unknown>;
    deleteMany: (...args: unknown[]) => Promise<unknown>;
  };
  applicationRuntimeEvent?: {
    count: (...args: unknown[]) => Promise<number>;
    create: (...args: unknown[]) => Promise<unknown>;
    findMany: (...args: unknown[]) => Promise<unknown[]>;
  };
  applicationRuntimeSession?: {
    count: (...args: unknown[]) => Promise<number>;
    create: (...args: unknown[]) => Promise<unknown>;
    findFirst: (...args: unknown[]) => Promise<unknown>;
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    findUnique: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
  };
  rulePromotionCandidate?: {
    count: (...args: unknown[]) => Promise<number>;
    create: (...args: unknown[]) => Promise<unknown>;
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    findUnique: (...args: unknown[]) => Promise<unknown>;
    update: (...args: unknown[]) => Promise<unknown>;
  };
  runtimeTrainingReview?: {
    count: (...args: unknown[]) => Promise<number>;
    create: (...args: unknown[]) => Promise<unknown>;
    findMany: (...args: unknown[]) => Promise<unknown[]>;
    findUnique: (...args: unknown[]) => Promise<unknown>;
  };
}

function getRuntimeModelRegistry(): RuntimeModelRegistry {
  return db as RuntimeModelRegistry;
}

export function hasRuntimeLearningModels(): boolean {
  const runtimeModels = getRuntimeModelRegistry();

  return Boolean(
    runtimeModels.applicationRuntimeSession &&
    runtimeModels.applicationRuntimeEvent &&
    runtimeModels.rulePromotionCandidate &&
    runtimeModels.runtimeTrainingReview,
  );
}

export function hasRuntimeFlowModels(): boolean {
  const runtimeModels = getRuntimeModelRegistry();

  return Boolean(
    runtimeModels.applicationFlowDefinition &&
    runtimeModels.applicationFlowStepDefinition,
  );
}

export function getRuntimeLearningUnavailableMessage(): string {
  return 'Runtime learning models are not available in the active Prisma client yet. Run `bun db:generate`, apply the schema changes to the database, and restart the dev server.';
}
