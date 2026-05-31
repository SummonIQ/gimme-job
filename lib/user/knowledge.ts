import { z } from 'zod';

import { generateAIObject } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { db } from '@/lib/db/client';
import { invalidateResolverCacheSlice } from '@/lib/field-answer/cache';
import { logger } from '@/lib/logger';

/**
 * Common job application field keys that we actively look for and store.
 */
const APPLICATION_KNOWLEDGE_KEYS = [
  'fullName',
  'firstName',
  'lastName',
  'email',
  'phone',
  'linkedinUrl',
  'githubUrl',
  'websiteUrl',
  'city',
  'state',
  'streetAddress',
  'zipCode',
  'currentCompany',
  'currentTitle',
  'yearsOfExperience',
  'highestDegree',
  'university',
  'graduationYear',
  'workAuthorization',
  'requiresSponsorship',
  'languages',
  'skills',
  'certifications',
] as const;

type KnowledgeKey = (typeof APPLICATION_KNOWLEDGE_KEYS)[number];
interface UserKnowledgeEntry {
  confidence: number;
  createdAt: Date;
  id: string;
  key: string;
  source: string;
  updatedAt: Date;
  value: string;
}

const LEGACY_DESKTOP_AGENT_KNOWLEDGE_FILTER = {
  NOT: [
    { source: 'desktop-agent-chat' },
    { key: { startsWith: 'desktop-agent-correction:' } },
  ],
};

const resumeExtractionSchema = z.object({
  fullName: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  linkedinUrl: z.string().optional(),
  githubUrl: z.string().optional(),
  websiteUrl: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  streetAddress: z.string().optional(),
  zipCode: z.string().optional(),
  currentCompany: z.string().optional(),
  currentTitle: z.string().optional(),
  yearsOfExperience: z.string().optional(),
  highestDegree: z.string().optional(),
  university: z.string().optional(),
  graduationYear: z.string().optional(),
  workAuthorization: z.string().optional(),
  requiresSponsorship: z.string().optional(),
  languages: z.string().optional(),
  skills: z.string().optional(),
  certifications: z.string().optional(),
});

/**
 * Extract knowledge from resume markdown using AI and store it.
 * Only stores values that don't already exist (won't overwrite manual entries).
 */
async function extractKnowledgeFromResume(
  userId: string,
  markdown: string,
  options: { readonly aiProvider?: AiProvider } = {},
): Promise<void> {
  try {
    const extracted = await generateAIObject(
      `Extract the following information from this resume. Return only values that are clearly stated. For yearsOfExperience, calculate from the work history dates. For skills, return a comma-separated list of the top technical skills. For languages, return a comma-separated list. Leave fields empty/undefined if not found.

Resume:
${markdown.slice(0, 30000)}`,
      resumeExtractionSchema,
      { aiProvider: options.aiProvider, temperature: 0 },
    );

    const entries: { key: string; value: string }[] = [];
    for (const [key, value] of Object.entries(extracted)) {
      if (value && typeof value === 'string' && value.trim()) {
        entries.push({ key, value: value.trim() });
      }
    }

    if (entries.length === 0) return;

    // Upsert each entry, but only if the user doesn't already have a
    // higher-confidence value from a manual source
    await db.$transaction(
      entries.map(({ key, value }) =>
        db.userKnowledge.upsert({
          where: { userId_key: { userId, key } },
          update: {
            value,
            source: 'resume',
            confidence: 0.9,
          },
          create: {
            userId,
            key,
            value,
            source: 'resume',
            confidence: 0.9,
          },
        }),
      ),
    );
    invalidateResolverCacheSlice(userId, 'knowledge');
    if (entries.some(e => e.key === 'workExperience')) {
      invalidateResolverCacheSlice(userId, 'employment');
    }

    logger.info('[KNOWLEDGE] Extracted from resume', {
      userId,
      keysExtracted: entries.map(e => e.key),
    });
  } catch (error) {
    logger.error('[KNOWLEDGE] Resume extraction failed', { userId, error });
  }
}

async function ensureKnowledgeInitialized(userId: string): Promise<void> {
  const existing = await db.userKnowledge.findFirst({
    select: { id: true },
    where: { userId },
  });
  if (existing) return;

  const user = await db.user.findUnique({
    select: {
      defaultResumeId: true,
      defaultRevisionId: true,
    },
    where: { id: userId },
  });
  if (!user?.defaultResumeId) return;

  const resume = await db.resume.findUnique({
    select: {
      markdown: true,
      revisions: {
        orderBy: { createdAt: 'desc' },
        select: { id: true, markdown: true },
        take: 5,
      },
    },
    where: { id: user.defaultResumeId },
  });
  const revisionMarkdown =
    resume?.revisions.find(revision => revision.id === user.defaultRevisionId)
      ?.markdown ?? resume?.revisions[0]?.markdown;
  const markdown = revisionMarkdown ?? resume?.markdown;
  if (!markdown?.trim()) return;

  await extractKnowledgeFromResume(userId, markdown);
}

/**
 * Store a single knowledge entry for a user.
 * Higher-confidence sources overwrite lower ones.
 */
async function setUserKnowledge(
  userId: string,
  key: string,
  value: string,
  source: string = 'manual',
  confidence: number = 1.0,
): Promise<void> {
  await db.userKnowledge.upsert({
    where: { userId_key: { userId, key } },
    update: { value, source, confidence },
    create: { userId, key, value, source, confidence },
  });
  invalidateResolverCacheSlice(userId, 'knowledge');
  // workExperience is read by loadEmploymentHistory which lives in the
  // employment slice; flush it too on the rare write through this path.
  if (key === 'workExperience') invalidateResolverCacheSlice(userId, 'employment');
}

/**
 * Get all knowledge for a user as a key-value map.
 */
async function getUserKnowledge(
  userId: string,
): Promise<Record<string, string>> {
  const rows = await db.userKnowledge.findMany({
    where: { ...LEGACY_DESKTOP_AGENT_KNOWLEDGE_FILTER, userId },
    select: { key: true, value: true },
  });
  const map: Record<string, string> = {};
  for (const row of rows) {
    map[row.key] = row.value;
  }
  return map;
}

async function getUserKnowledgeEntries(
  userId: string,
): Promise<UserKnowledgeEntry[]> {
  return db.userKnowledge.findMany({
    orderBy: [{ key: 'asc' }, { updatedAt: 'desc' }],
    where: { ...LEGACY_DESKTOP_AGENT_KNOWLEDGE_FILTER, userId },
  });
}

async function deleteUserKnowledge(userId: string, key: string): Promise<void> {
  await db.userKnowledge.delete({
    where: {
      userId_key: {
        key,
        userId,
      },
    },
  });
  invalidateResolverCacheSlice(userId, 'knowledge');
  if (key === 'workExperience') invalidateResolverCacheSlice(userId, 'employment');
}

/**
 * Store knowledge from an observed form field value.
 * Lower confidence than resume or manual entries.
 */
async function learnFromFormField(
  userId: string,
  key: string,
  value: string,
): Promise<void> {
  // Only store if user doesn't already have this knowledge from a better source
  const existing = await db.userKnowledge.findUnique({
    where: { userId_key: { userId, key } },
    select: { source: true, confidence: true },
  });

  if (existing && existing.confidence >= 0.7) return;

  await db.userKnowledge.upsert({
    where: { userId_key: { userId, key } },
    update: { value, source: 'form', confidence: 0.6 },
    create: { userId, key, value, source: 'form', confidence: 0.6 },
  });
  invalidateResolverCacheSlice(userId, 'knowledge');
  if (key === 'workExperience') invalidateResolverCacheSlice(userId, 'employment');
}

export {
  APPLICATION_KNOWLEDGE_KEYS,
  deleteUserKnowledge,
  ensureKnowledgeInitialized,
  extractKnowledgeFromResume,
  getUserKnowledge,
  getUserKnowledgeEntries,
  learnFromFormField,
  setUserKnowledge,
};
export type { KnowledgeKey, UserKnowledgeEntry };
