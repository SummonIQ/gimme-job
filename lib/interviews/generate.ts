import type { Prisma } from '@/generated/prisma/client';
import { generateAIObject } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { db } from '@/lib/db/client';
import { AppError, ErrorCode } from '@/lib/errors';
import { getCurrentUser } from '@/lib/user/query';
import { nanoid } from 'nanoid';
import { z } from 'zod';

import {
  DifficultyLevel,
  type InterviewQuestion,
  type InterviewQuestionGenerationOptions,
  InterviewType,
} from './types';

const aiQuestionSchema = z.object({
  description: z.string().optional(),
  difficulty: z.string().optional(),
  question: z.string().min(1),
  type: z.string().optional(),
});

const aiQuestionResponseSchema = z.object({
  questions: z.array(aiQuestionSchema),
});

interface GenerationContext {
  readonly jobDescription?: string;
  readonly jobLeadId?: string;
  readonly jobTitle?: string;
  readonly resumeContext?: string;
}

interface GeneratedInterviewQuestion {
  readonly description: string;
  readonly difficulty: DifficultyLevel;
  readonly question: string;
  readonly type: InterviewType;
}

interface CreateInterviewSessionForUserOptions extends InterviewQuestionGenerationOptions {
  readonly metadata?: Prisma.InputJsonValue;
  readonly sessionName?: string;
  readonly source?: string;
  readonly sourceEmailId?: string;
}

interface ResumeContextSource {
  readonly json: Prisma.JsonValue | null;
  readonly markdown: string | null;
  readonly name: string;
}

function isInterviewType(value: string | undefined): value is InterviewType {
  return Boolean(
    value &&
    Object.values(InterviewType).includes(value.toUpperCase() as InterviewType),
  );
}

function normalizeInterviewType(
  value: string | undefined,
  fallback: InterviewType,
): InterviewType {
  return isInterviewType(value)
    ? (value.toUpperCase() as InterviewType)
    : fallback;
}

function isDifficultyLevel(
  value: string | undefined,
): value is DifficultyLevel {
  return Boolean(
    value &&
    Object.values(DifficultyLevel).includes(
      value.toUpperCase() as DifficultyLevel,
    ),
  );
}

function normalizeDifficulty(
  value: string | undefined,
  fallback: DifficultyLevel,
): DifficultyLevel {
  return isDifficultyLevel(value)
    ? (value.toUpperCase() as DifficultyLevel)
    : fallback;
}

function formatResumeContext(
  revision: ResumeContextSource | null,
): string | undefined {
  if (!revision) return undefined;

  const body =
    revision.markdown?.trim() ||
    (revision.json ? JSON.stringify(revision.json) : '');

  if (!body.trim()) return undefined;

  return [`Resume: ${revision.name}`, body].join('\n').slice(0, 6000);
}

async function loadFallbackResumeContext(
  userId: string,
): Promise<string | undefined> {
  const user = await db.user.findUnique({
    select: {
      defaultResumeId: true,
      defaultRevisionId: true,
    },
    where: { id: userId },
  });

  const revision = await db.resumeRevision.findFirst({
    orderBy: { updatedAt: 'desc' },
    select: {
      json: true,
      markdown: true,
      name: true,
    },
    where: {
      userId,
      ...(user?.defaultRevisionId
        ? { id: user.defaultRevisionId }
        : user?.defaultResumeId
          ? { resumeId: user.defaultResumeId }
          : {}),
    },
  });

  return formatResumeContext(revision);
}

async function resolveGenerationContext(
  userId: string,
  options: InterviewQuestionGenerationOptions,
): Promise<GenerationContext> {
  let jobTitle = options.jobTitle;
  let jobDescription = options.jobDescription;
  let resumeContext = options.resumeContext;

  if (!options.jobLeadId) {
    return {
      jobDescription,
      jobTitle,
      resumeContext,
    };
  }

  const jobLead = await db.jobLead.findFirst({
    include: {
      jobListing: true,
      tailoredResumeRevision: {
        select: {
          json: true,
          markdown: true,
          name: true,
        },
      },
    },
    where: {
      id: options.jobLeadId,
      userId,
    },
  });

  if (!jobLead) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Job lead with ID ${options.jobLeadId} not found`,
    });
  }

  jobTitle = jobLead.jobListing.title;
  jobDescription = jobLead.jobListing.description || '';
  resumeContext =
    resumeContext ??
    formatResumeContext(jobLead.tailoredResumeRevision) ??
    (await loadFallbackResumeContext(userId));

  return {
    jobDescription,
    jobLeadId: options.jobLeadId,
    jobTitle,
    resumeContext,
  };
}

function toInterviewQuestion(
  row: Awaited<ReturnType<typeof db.interviewQuestion.create>>,
): InterviewQuestion {
  return {
    ...row,
    description: row.description ?? undefined,
    difficulty: normalizeDifficulty(row.difficulty, DifficultyLevel.MEDIUM),
    jobLeadId: row.jobLeadId ?? undefined,
    type: normalizeInterviewType(row.type, InterviewType.MIXED),
  };
}

async function getRequiredCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();

  if (!user) {
    throw new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message: 'Authentication is required to generate interview prep',
    });
  }

  return user.id;
}

export async function generateInterviewQuestions(
  options: InterviewQuestionGenerationOptions,
): Promise<InterviewQuestion[]> {
  const userId = await getRequiredCurrentUserId();

  return generateInterviewQuestionsForUser(userId, options);
}

export async function generateInterviewQuestionsForUser(
  userId: string,
  options: InterviewQuestionGenerationOptions,
): Promise<InterviewQuestion[]> {
  const context = await resolveGenerationContext(userId, options);

  if (!context.jobTitle && !options.specificTopic) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Either jobLeadId, jobTitle, or specificTopic must be provided',
    });
  }

  const count = options.count || 5;
  const type = options.type || InterviewType.MIXED;
  const difficulty = options.difficulty || DifficultyLevel.MEDIUM;

  const questions = await generateQuestionsWithAI({
    aiProvider: options.aiProvider,
    count,
    difficulty,
    jobDescription: context.jobDescription,
    jobTitle: context.jobTitle,
    resumeContext: context.resumeContext,
    specificTopic: options.specificTopic,
    type,
  });

  const savedQuestions = await Promise.all(
    questions.map(question =>
      db.interviewQuestion.create({
        data: {
          description: question.description,
          difficulty: question.difficulty,
          id: nanoid(),
          jobLeadId: context.jobLeadId,
          question: question.question,
          type: question.type,
          userId,
        },
      }),
    ),
  );

  return savedQuestions.map(toInterviewQuestion);
}

async function generateQuestionsWithAI({
  aiProvider,
  count,
  difficulty,
  jobDescription,
  jobTitle,
  resumeContext,
  specificTopic,
  type,
}: {
  readonly aiProvider?: AiProvider;
  readonly count: number;
  readonly difficulty: DifficultyLevel;
  readonly jobDescription?: string;
  readonly jobTitle?: string;
  readonly resumeContext?: string;
  readonly specificTopic?: string;
  readonly type: InterviewType;
}): Promise<GeneratedInterviewQuestion[]> {
  const prompt = createQuestionGenerationPrompt({
    count,
    difficulty,
    jobDescription,
    jobTitle,
    resumeContext,
    specificTopic,
    type,
  });

  try {
    const response = await generateAIObject(prompt, aiQuestionResponseSchema, {
      aiProvider,
      temperature: 0.7,
    });

    return response.questions.map(question => ({
      description: question.description || '',
      difficulty: normalizeDifficulty(question.difficulty, difficulty),
      question: question.question,
      type: normalizeInterviewType(question.type, type),
    }));
  } catch (error) {
    console.error('Error generating interview questions:', error);
    throw new AppError({
      cause: error,
      code: ErrorCode.AI_SERVICE_ERROR,
      message: 'Failed to generate interview questions',
    });
  }
}

function createQuestionGenerationPrompt({
  count,
  difficulty,
  jobDescription,
  jobTitle,
  resumeContext,
  specificTopic,
  type,
}: {
  readonly count: number;
  readonly difficulty: DifficultyLevel;
  readonly jobDescription?: string;
  readonly jobTitle?: string;
  readonly resumeContext?: string;
  readonly specificTopic?: string;
  readonly type: InterviewType;
}): string {
  let prompt = `Generate ${count} realistic interview questions`;

  if (jobTitle) {
    prompt += ` for a ${jobTitle} position`;
  }

  if (specificTopic) {
    prompt += ` focusing on ${specificTopic}`;
  }

  if (type !== InterviewType.MIXED) {
    prompt += ` that are ${type.toLowerCase()} in nature`;
  }

  prompt += `. The difficulty level should be ${difficulty.toLowerCase()}.`;

  if (jobDescription) {
    prompt += `\n\nJob description to reference:\n${jobDescription}`;
  }

  if (resumeContext) {
    prompt += `\n\nCandidate resume context to tailor the prep:\n${resumeContext}`;
  }

  prompt += `\n\nReturn a JSON object with a "questions" array. Each item must include:
- question
- description
- type: one of ${Object.values(InterviewType).join(', ')}
- difficulty: one of ${Object.values(DifficultyLevel).join(', ')}`;

  return prompt;
}

export async function createInterviewSession(
  options: InterviewQuestionGenerationOptions,
): Promise<string> {
  const userId = await getRequiredCurrentUserId();

  return createInterviewSessionForUser(userId, options);
}

export async function createInterviewSessionForUser(
  userId: string,
  options: CreateInterviewSessionForUserOptions,
): Promise<string> {
  if (options.sourceEmailId) {
    const existing = await db.interviewSession.findUnique({
      select: { id: true },
      where: { sourceEmailId: options.sourceEmailId },
    });

    if (existing) return existing.id;
  }

  const questions = await generateInterviewQuestionsForUser(userId, options);

  const session = await db.interviewSession.create({
    data: {
      jobLeadId: options.jobLeadId,
      metadata: options.metadata,
      name:
        options.sessionName ??
        `Interview Prep - ${new Date().toLocaleDateString()}`,
      questions: {
        connect: questions.map(question => ({ id: question.id })),
      },
      source: options.source,
      sourceEmailId: options.sourceEmailId,
      status: 'IN_PROGRESS',
      userId,
    },
  });

  return session.id;
}
