import {
  ApplicationRuntimeExecutionEnvironment,
  ApplicationRuntimeSource,
  type Prisma,
} from '@/generated/prisma/client';
import { embedObservation } from '@/lib/ai/embeddings';
import { db } from '@/lib/db/client';

type RuntimeSourceCreateInput<T extends { source?: ApplicationRuntimeSource }> =
  Omit<T, 'source'> & {
    source: ApplicationRuntimeSource;
  };

type RuntimeEnvironmentCreateInput<
  T extends { executionEnvironment?: ApplicationRuntimeExecutionEnvironment },
> = Omit<T, 'executionEnvironment'> & {
  executionEnvironment: ApplicationRuntimeExecutionEnvironment;
};

export type CreateRuntimeEventInput =
  RuntimeSourceCreateInput<Prisma.ApplicationRuntimeEventUncheckedCreateInput>;

export type CreateATSFieldObservationInput =
  RuntimeSourceCreateInput<Prisma.ATSFieldObservationUncheckedCreateInput>;

export interface UpsertATSFieldObservationArgs {
  create: RuntimeSourceCreateInput<Prisma.ATSFieldObservationUncheckedCreateInput>;
  update: Prisma.ATSFieldObservationUncheckedUpdateInput;
  where: Prisma.ATSFieldObservationWhereUniqueInput;
}

export type CreateRuntimeSessionInput =
  RuntimeEnvironmentCreateInput<Prisma.ApplicationRuntimeSessionUncheckedCreateInput>;

const runtimeSources = new Set<string>(Object.values(ApplicationRuntimeSource));
const runtimeExecutionEnvironments = new Set<string>(
  Object.values(ApplicationRuntimeExecutionEnvironment),
);

function assertRuntimeSource(
  source: unknown,
): asserts source is ApplicationRuntimeSource {
  if (typeof source !== 'string' || !runtimeSources.has(source)) {
    throw new Error('ApplicationRuntimeSource source is required');
  }
}

function assertRuntimeExecutionEnvironment(
  executionEnvironment: unknown,
): asserts executionEnvironment is ApplicationRuntimeExecutionEnvironment {
  if (
    typeof executionEnvironment !== 'string' ||
    !runtimeExecutionEnvironments.has(executionEnvironment)
  ) {
    throw new Error(
      'ApplicationRuntimeExecutionEnvironment executionEnvironment is required',
    );
  }
}

export async function createRuntimeEvent(input: CreateRuntimeEventInput) {
  assertRuntimeSource(input.source);

  return db.applicationRuntimeEvent.create({
    data: input,
  });
}

export async function createATSFieldObservation(
  input: CreateATSFieldObservationInput,
) {
  assertRuntimeSource(input.source);

  const observation = await db.aTSFieldObservation.create({
    data: input,
  });
  void embedObservation(observation.id).catch(error => {
    console.warn('[runtime-provenance] embed observation failed', error);
  });
  return observation;
}

export async function upsertATSFieldObservation(
  args: UpsertATSFieldObservationArgs,
): Promise<{ observationCount: number }> {
  assertRuntimeSource(args.create.source);

  const observation = await db.aTSFieldObservation.upsert({
    create: args.create,
    select: { id: true, observationCount: true },
    update: args.update,
    where: args.where,
  });
  void embedObservation(observation.id).catch(error => {
    console.warn('[runtime-provenance] embed observation failed', error);
  });
  return { observationCount: observation.observationCount };
}

export async function createRuntimeSession(input: CreateRuntimeSessionInput) {
  assertRuntimeExecutionEnvironment(input.executionEnvironment);

  return db.applicationRuntimeSession.create({
    data: input,
  });
}
