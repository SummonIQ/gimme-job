/**
 * Shared field-answer resolver. Used by both the desktop runner
 * (/api/desktop/agent-chat/field-answer, scope=desktop:runtime) and the
 * web's AI-assist autofill (/api/applications/field-answer, session
 * auth). Both surfaces resolve a single (question, options, fieldType,
 * applicationUrl, jobLeadId) into a typed answer using the same
 * priority chain:
 *
 *   1. UserFieldRule (user-taught, hostname-scoped first then global)
 *   2. Deterministic answer (sponsorship/auth/post-employment/gender,
 *      pronouns, referral source, prior-employment yes/no)
 *   3. LLM with profile + resume + job context + feedback rows
 *
 * Tests-friendly: every loader is a separate function, the orchestrator
 * accepts an optional override map so callers can inject pre-loaded
 * context (e.g. when batching many fields in one request).
 */
import { generateObject, generateText } from 'ai';
import { z } from 'zod';

import { getModels } from '@/lib/ai/models';
import {
  findSimilarFieldFeedback,
  findSimilarUserFieldRules,
} from '@/lib/ai/embeddings';
import { db } from '@/lib/db/client';
import { getUserKnowledge } from '@/lib/user/knowledge';

export const fieldAnswerInputSchema = z.object({
  aiProvider: z.enum(['openai', 'ollama']).optional(),
  applicationUrl: z.string().optional(),
  fieldType: z
    .enum(['text', 'textarea', 'select', 'radio', 'checkbox', 'unknown'])
    .optional(),
  jobLeadId: z.string().optional(),
  options: z.array(z.string()).optional(),
  question: z.string().min(1),
  siblingUrls: z.array(z.string()).optional(),
});

export type FieldAnswerInput = z.infer<typeof fieldAnswerInputSchema>;

export interface FieldAnswerOutput {
  readonly answer: string;
  readonly confidence: 'high' | 'medium' | 'low';
  readonly reasoning: string;
}

const answerSchema = z.object({
  answer: z.string(),
  confidence: z.enum(['high', 'medium', 'low']),
  reasoning: z.string(),
});

type AnswerObject = z.infer<typeof answerSchema>;

// Promise-based TTL cache. Stores the in-flight Promise itself so concurrent
// callers (web batch endpoint resolving N fields in parallel, desktop runner
// resolving sequentially over ~10–30s) share a single DB round-trip per
// (userId, jobLeadId, hostname). On rejection we drop the entry so a retry
// can succeed — non-fatal errors like a missed lead shouldn't be cached.
import { resolveCache, RESOLVE_CACHE_TTL } from './cache';
export {
  invalidateResolverCacheForUser,
  invalidateResolverCacheSlice,
} from './cache';

interface CachedPromise<T> {
  readonly promise: Promise<T>;
  readonly expiresAt: number;
}

function withCache<T>(key: string, loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const entry = resolveCache.get(key) as CachedPromise<T> | undefined;
  if (entry && entry.expiresAt > now) return entry.promise;
  const promise = loader();
  promise.catch(() => {
    if (resolveCache.get(key)?.promise === promise) resolveCache.delete(key);
  });
  resolveCache.set(key, { promise, expiresAt: now + RESOLVE_CACHE_TTL });
  return promise;
}

type CachedUserRecord = NonNullable<
  Awaited<ReturnType<typeof loadUserRecordFresh>>
> | null;

function loadUserRecordFresh(userId: string) {
  return db.user.findUnique({
    select: {
      email: true,
      firstName: true,
      lastName: true,
      profile: true,
      jobPreferences: {
        select: {
          preferRemote: true,
          remoteOnly: true,
        },
      },
      trackingEmailAlias: true,
      trackingEmailForwardingEnabled: true,
    },
    where: { id: userId },
  });
}

function loadUserRecordCached(userId: string): Promise<CachedUserRecord> {
  return withCache(`user:${userId}`, () => loadUserRecordFresh(userId));
}

function loadUserKnowledgeCached(
  userId: string,
): Promise<Record<string, string>> {
  return withCache(`knowledge:${userId}`, () =>
    getUserKnowledge(userId).catch(() => ({}) as Record<string, string>),
  );
}

function loadEmploymentHistoryCached(
  userId: string,
): Promise<readonly EmploymentHistoryEntry[]> {
  return withCache(`employment:${userId}`, () =>
    loadEmploymentHistory(userId).catch(
      () => [] as readonly EmploymentHistoryEntry[],
    ),
  );
}

function loadResumeContextCached(userId: string): Promise<ResumeContext> {
  return withCache(`resume:${userId}`, () =>
    loadResumeContext(userId).catch(() => ({
      markdown: null,
      skills: [] as readonly string[],
      summary: null,
    })),
  );
}

function loadJobContextCached(
  userId: string,
  jobLeadId: string | null,
): Promise<JobContext | null> {
  if (!jobLeadId) return Promise.resolve(null);
  return withCache(`job:${userId}:${jobLeadId}`, () =>
    loadJobContext(userId, jobLeadId).catch(() => null),
  );
}

/**
 * Kick off the heavy cache loaders for a user (and optional jobLead) without
 * resolving any field. Called from the assist modal's open handler so the
 * first real field-answer request can hit a warm cache instead of paying
 * 4-6 sequential DB round-trips. Fire-and-forget — caller can ignore the
 * Promise; results land in the cache for the next resolveFieldAnswer call.
 */
export function prewarmResolverCache(
  userId: string,
  options: { readonly jobLeadId?: string | null; readonly hostname?: string | null } = {},
): Promise<void> {
  return Promise.allSettled([
    loadUserRecordCached(userId),
    loadUserKnowledgeCached(userId),
    loadEmploymentHistoryCached(userId),
    loadResumeContextCached(userId),
    options.jobLeadId
      ? loadJobContextCached(userId, options.jobLeadId)
      : Promise.resolve(null),
    options.hostname
      ? loadUserFieldRulesCached(userId, options.hostname)
      : Promise.resolve([]),
  ]).then(() => undefined);
}

export async function resolveFieldAnswer(
  userId: string,
  input: FieldAnswerInput,
): Promise<FieldAnswerOutput> {
  const hostname = readHostnameFromUrl(input.applicationUrl ?? null);

  // 1. User-taught rule — hostname-scoped first, then global. Highest
  //    priority because it represents an explicit teach. Embeddings
  //    lookups can throw (OpenAI 429 / quota exhausted) — that must NOT
  //    crash the whole resolver. Fall through to deterministic + LLM.
  const rule = await loadUserFieldRule(
    userId,
    hostname,
    input.question,
  ).catch(error => {
    console.warn(
      '[resolveFieldAnswer] loadUserFieldRule failed — continuing without rule lookup',
      error instanceof Error ? error.message : String(error),
    );
    return null;
  });
  if (rule) {
    const matchSuffix =
      rule.matchKind === 'semantic' && rule.similarity !== null
        ? `, semantic ${rule.similarity.toFixed(2)}`
        : `, ${rule.matchKind}`;
    return {
      answer: rule.answer,
      confidence: 'high',
      reasoning: `Matched user rule "${rule.question}" (${rule.source}, ${rule.hostname ?? 'global'}${matchSuffix})`,
    };
  }

  const [
    user,
    knowledge,
    jobContext,
    employmentHistory,
    fieldFeedback,
    fewShotExamples,
  ] = await Promise.all([
    loadUserRecordCached(userId),
    loadUserKnowledgeCached(userId),
    loadJobContextCached(userId, input.jobLeadId ?? null),
    loadEmploymentHistoryCached(userId),
    loadFieldFeedback(userId, hostname, input.question).catch(() => []),
    loadFewShotExamples(userId, hostname, input.question).catch(() => []),
  ]);

  if (!user) {
    return {
      answer: '',
      confidence: 'low',
      reasoning: 'User not found',
    };
  }

  const profileSnapshot = buildProfileSnapshot(user, knowledge);
  const resumeContext = await loadResumeContextCached(userId);

  const excludedUrls = mergeExcludedUrls(profileSnapshot, input.siblingUrls);

  // 2. Deterministic answers for high-impact question categories where
  //    the LLM has historically returned empty / wrong values.
  const deterministic = resolveDeterministicAnswer({
    employmentHistory,
    jobContext,
    options: input.options ?? [],
    profile: profileSnapshot,
    question: input.question,
    fieldType: input.fieldType ?? 'unknown',
  });
  if (deterministic) {
    return {
      answer: deterministic.answer,
      confidence: 'high',
      reasoning: deterministic.reasoning,
    };
  }

  // 3. LLM with full context.
  const isLongForm =
    input.fieldType === 'textarea' ||
    /\b(why|tell us|describe|explain|what is|how would|hardest|biggest|favorite|cover letter)\b/i.test(
      input.question,
    );
  const provider = input.aiProvider ?? 'openai';
  const providerModels = getModels(provider);
  // Route long-form questions ("why do you want to work here", cover-letter
  // prompts) to the strong tier — small instruct models can't sustain a
  // grounded paragraph at high quality, and the tiering exists for this
  // exact split. Short / structured fields stay on the fast tier.
  const model = isLongForm ? providerModels.strong : providerModels.fast;

  const prompt = buildPrompt({
    applicationUrl: input.applicationUrl ?? null,
    employmentHistory,
    fewShotExamples,
    fieldFeedback,
    fieldType: input.fieldType ?? 'unknown',
    jobContext,
    options: input.options ?? [],
    profile: profileSnapshot,
    question: input.question,
    resumeContext,
    siblingUrls: excludedUrls,
  });
  const systemPrompt = isLongForm
    ? 'You answer job-application questions for a single user. ' +
      'This is a LONG-FORM (textarea) question — write 3-6 sentences grounded in the user\'s actual resume + the role/company shown in the job context. ' +
      'Never invent specific facts (years, locations, projects) that are not in the profile or resume. ' +
      'Never reference the user\'s home city as the role\'s work location. ' +
      'You MUST return a non-empty answer. If signals are weak, still write a sincere, generic-but-tailored paragraph using whatever resume/profile signal you have — empty answers are not acceptable for long-form fields. ' +
      'Confidence "low" is fine when signal is thin; confidence "high" only when the resume directly supports the answer.'
    : 'You answer job-application questions for a single user. ' +
      'For short fields (yes/no, dropdowns, demographic) reason from the profile data and pick the right option exactly. ' +
      'Never invent specific facts (years, locations, projects) that are not in the profile or resume. ' +
      'Never reference the user\'s home city as the role\'s work location. ' +
      'If options are provided, copy the exact option text. ' +
      'If you have no relevant signal, return an empty answer.';

  let generated = await generateAnswer({
    model,
    prompt,
    provider,
    system: systemPrompt,
    isLongForm,
  });

  // For long-form fields, an empty answer is almost always model
  // over-conservatism rather than missing context — retry once with a
  // tighter instruction. Empty long-form answers leave required
  // textareas blank and fail Greenhouse validation, which is the very
  // failure mode this resolver exists to prevent.
  if (isLongForm && !generated.answer.trim()) {
    console.warn(
      `[resolveFieldAnswer] empty long-form answer on first pass — retrying with stronger instruction`,
    );
    generated = await generateAnswer({
      model,
      prompt:
        prompt +
        '\n\nYour previous response was empty. Write a non-empty 3-6 sentence response now, drawing on whatever signal you have from the resume/profile. Honesty + generality beats blank.',
      provider,
      system: systemPrompt,
      isLongForm,
    });
  }

  const answerText = postProcessAnswer({
    answer: generated.answer.trim(),
    excludedUrls,
    fieldType: input.fieldType ?? 'unknown',
    question: input.question,
  });
  return {
    answer: answerText,
    confidence: generated.confidence,
    reasoning: generated.reasoning,
  };
}

// ---------------------------------------------------------------------------
// User field rules (server table mirrors desktop's local field-rules.json)
// ---------------------------------------------------------------------------

type FieldRuleRow = {
  hostname: string | null;
  question: string;
  answer: string;
  source: string;
};

type FieldRuleMatch = FieldRuleRow & {
  matchKind: 'hostname-exact' | 'global-exact' | 'substring' | 'semantic';
  similarity: number | null;
};

function loadUserFieldRulesCached(
  userId: string,
  hostname: string | null,
): Promise<readonly FieldRuleRow[]> {
  return withCache(`fieldRules:${userId}:${hostname ?? ''}`, () =>
    db.userFieldRule.findMany({
      where: {
        userId,
        OR: [{ hostname }, { hostname: null }],
      },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: {
        hostname: true,
        question: true,
        answer: true,
        source: true,
      },
    }),
  );
}

async function loadUserFieldRule(
  userId: string,
  hostname: string | null,
  question: string,
): Promise<FieldRuleMatch | null> {
  const trimmed = question.trim();
  if (!trimmed) return null;

  // Match priority: hostname-exact → global-exact → hostname-substring →
  // global-substring → semantic similarity. The first four are pure-cache
  // string operations; the last spends an embedding round-trip only when
  // wording differs.
  try {
    const rules = await loadUserFieldRulesCached(userId, hostname);
    if (rules.length > 0) {
      const normalized = trimmed.toLowerCase();
      const buckets: Array<{
        kind: FieldRuleMatch['matchKind'];
        predicate: (rule: (typeof rules)[number]) => boolean;
      }> = [
        {
          kind: 'hostname-exact',
          predicate: r =>
            r.hostname === hostname &&
            r.question.trim().toLowerCase() === normalized,
        },
        {
          kind: 'global-exact',
          predicate: r =>
            !r.hostname && r.question.trim().toLowerCase() === normalized,
        },
        {
          kind: 'substring',
          predicate: r =>
            r.hostname === hostname &&
            normalized.includes(r.question.trim().toLowerCase()),
        },
        {
          kind: 'substring',
          predicate: r =>
            !r.hostname &&
            normalized.includes(r.question.trim().toLowerCase()),
        },
      ];
      for (const { kind, predicate } of buckets) {
        const match = rules.find(predicate);
        if (match) return { ...match, matchKind: kind, similarity: null };
      }
    }
  } catch {
    return null;
  }

  try {
    const similar = await findSimilarUserFieldRules(
      userId,
      hostname,
      trimmed,
      { limit: 1 },
    );
    if (similar.length > 0) {
      const top = similar[0];
      return {
        hostname: top.hostname,
        question: top.question,
        answer: top.answer,
        source: top.source,
        matchKind: 'semantic',
        similarity: top.similarity,
      };
    }
  } catch (error) {
    console.warn('[loadUserFieldRule] semantic search failed', error);
  }
  return null;
}

function readHostnameFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

interface JobContext {
  readonly company: string | null;
  readonly description: string | null;
  readonly location: string | null;
  readonly remote: boolean | null;
  readonly requirements: readonly string[];
  readonly responsibilities: readonly string[];
  readonly title: string | null;
}

async function loadJobContext(
  userId: string,
  jobLeadId: string | null,
): Promise<JobContext | null> {
  if (!jobLeadId) return null;
  const lead = await db.jobLead.findFirst({
    select: {
      title: true,
      jobListing: {
        select: {
          company: true,
          description: true,
          location: true,
          remote: true,
          requirements: true,
          responsibilities: true,
          title: true,
        },
      },
    },
    where: { id: jobLeadId, userId },
  });
  if (!lead) return null;
  const listing = lead.jobListing;
  return {
    company: listing?.company ?? null,
    description: truncate(listing?.description ?? null, 4000),
    location: listing?.location ?? null,
    remote: listing?.remote ?? null,
    requirements: (listing?.requirements ?? []).slice(0, 16),
    responsibilities: (listing?.responsibilities ?? []).slice(0, 16),
    title: listing?.title ?? lead.title ?? null,
  };
}

interface ResumeContext {
  readonly markdown: string | null;
  readonly skills: readonly string[];
  readonly summary: string | null;
}

async function loadResumeContext(userId: string): Promise<ResumeContext> {
  const knowledge = await getUserKnowledge(userId);
  const summary = knowledge.professionalSummary?.trim() || null;
  const skills = parseSkills(knowledge.skills);
  let markdown: string | null = null;

  try {
    const user = await db.user.findUnique({
      select: { defaultResumeId: true, defaultRevisionId: true },
      where: { id: userId },
    });
    if (user?.defaultResumeId) {
      const resume = await db.resume.findUnique({
        include: {
          revisions: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            where: user.defaultRevisionId
              ? { id: user.defaultRevisionId }
              : undefined,
          },
        },
        where: { id: user.defaultResumeId },
      });
      const revisionMarkdown = resume?.revisions?.[0]?.markdown?.trim();
      const resumeMarkdown = resume?.markdown?.trim();
      markdown = truncate(revisionMarkdown || resumeMarkdown || null, 8000);
    }
  } catch {
    // Non-fatal.
  }
  return { markdown, skills, summary };
}

function parseSkills(raw: string | null | undefined): readonly string[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) {
      return parsed
        .map(item =>
          typeof item === 'string'
            ? item.trim()
            : item && typeof item === 'object' && 'text' in item
              ? String((item as { text: unknown }).text ?? '').trim()
              : '',
        )
        .filter(Boolean);
    }
  } catch {
    return raw
      .split(/[,\n]/)
      .map(part => part.trim())
      .filter(Boolean);
  }
  return [];
}

function truncate(value: string | null, maxLength: number): string | null {
  if (!value) return null;
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength).trim()}…`;
}

interface EmploymentHistoryEntry {
  readonly company: string;
  readonly endDate: string | null;
  readonly startDate: string | null;
  readonly title: string;
}

async function loadEmploymentHistory(
  userId: string,
): Promise<readonly EmploymentHistoryEntry[]> {
  const row = await db.userKnowledge.findUnique({
    select: { value: true },
    where: { userId_key: { key: 'workExperience', userId } },
  });
  if (!row?.value?.trim()) return [];
  try {
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(entry => {
        if (!entry || typeof entry !== 'object') return null;
        const record = entry as Record<string, unknown>;
        const company = String(record.company ?? '').trim();
        const title = String(record.title ?? '').trim();
        if (!company && !title) return null;
        return {
          company,
          endDate: parseDateLabel(record),
          startDate: parseStartDateLabel(record),
          title,
        } satisfies EmploymentHistoryEntry;
      })
      .filter((entry): entry is EmploymentHistoryEntry => entry !== null)
      .slice(0, 25);
  } catch {
    return [];
  }
}

function parseStartDateLabel(record: Record<string, unknown>): string | null {
  const explicit = String(record.startDate ?? '').trim();
  if (explicit) return explicit;
  const month = Number.parseInt(String(record.startMonth ?? ''), 10);
  const year = Number.parseInt(String(record.startYear ?? ''), 10);
  return formatMonthYearLabel(month, year);
}

function parseDateLabel(record: Record<string, unknown>): string | null {
  const explicit = String(record.endDate ?? '').trim();
  if (explicit) return explicit;
  const month = Number.parseInt(String(record.endMonth ?? ''), 10);
  const year = Number.parseInt(String(record.endYear ?? ''), 10);
  return formatMonthYearLabel(month, year);
}

function formatMonthYearLabel(month: number, year: number): string | null {
  if (!Number.isFinite(year)) return null;
  const months = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  if (Number.isFinite(month) && month >= 0 && month <= 11) {
    return `${months[month]} ${year}`;
  }
  return String(year);
}

interface FewShotExample {
  readonly question: string;
  readonly answer: string;
  readonly source: 'rule-exact' | 'rule-overlap' | 'rule-semantic' | 'feedback';
}

// Load up to N past (question → answer) pairs most similar to the current
// question, to inject as few-shot examples in the LLM prompt. Pulls from
// the user's saved field rules (UserFieldRule) and prior accepted form
// feedback. Pure word-overlap scoring — no embeddings needed — so this
// works even when OpenAI's embedding endpoint is unavailable.
async function loadFewShotExamples(
  userId: string,
  hostname: string | null,
  question: string,
): Promise<readonly FewShotExample[]> {
  const trimmed = question.trim();
  if (!trimmed) return [];
  const MAX_EXAMPLES = 5;

  let rules: Awaited<ReturnType<typeof loadUserFieldRulesCached>> = [];
  try {
    rules = await loadUserFieldRulesCached(userId, hostname);
  } catch {
    rules = [];
  }
  // Also pull a small batch of global rules (no hostname) so a per-host
  // resolver still benefits from prior cross-site corrections.
  if (hostname) {
    try {
      const global = await loadUserFieldRulesCached(userId, null);
      rules = [...rules, ...global];
    } catch {
      // ignore
    }
  }

  const normalizedQ = normalizeQuestionForOverlap(trimmed);
  const queryTokens = tokenizeForOverlap(normalizedQ);
  if (queryTokens.size === 0) return [];

  const scored = rules
    .map(rule => {
      const normalizedRuleQ = normalizeQuestionForOverlap(rule.question);
      const ruleTokens = tokenizeForOverlap(normalizedRuleQ);
      const overlap = countOverlap(queryTokens, ruleTokens);
      // Boost exact / substring matches above pure word overlap.
      let score = overlap;
      if (normalizedRuleQ === normalizedQ) score += 100;
      else if (
        normalizedRuleQ.length > 6 &&
        normalizedQ.includes(normalizedRuleQ)
      ) {
        score += 50;
      } else if (
        normalizedQ.length > 6 &&
        normalizedRuleQ.includes(normalizedQ)
      ) {
        score += 30;
      }
      return { rule, score };
    })
    .filter(entry => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_EXAMPLES);

  const seenAnswers = new Set<string>();
  const examples: FewShotExample[] = [];
  for (const { rule, score } of scored) {
    const key = `${rule.question}::${rule.answer}`;
    if (seenAnswers.has(key)) continue;
    seenAnswers.add(key);
    examples.push({
      question: rule.question,
      answer: rule.answer,
      source: score >= 100 ? 'rule-exact' : 'rule-overlap',
    });
    if (examples.length >= MAX_EXAMPLES) break;
  }
  return examples;
}

function normalizeQuestionForOverlap(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const OVERLAP_STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'of',
  'in',
  'on',
  'at',
  'to',
  'for',
  'and',
  'or',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'do',
  'does',
  'did',
  'have',
  'has',
  'had',
  'will',
  'would',
  'should',
  'could',
  'can',
  'may',
  'might',
  'must',
  'with',
  'by',
  'from',
  'this',
  'that',
  'these',
  'those',
  'you',
  'your',
  'our',
  'we',
  'us',
  'i',
  'me',
  'my',
  'if',
  'as',
  'so',
  'it',
  'its',
  'any',
  'all',
  'or',
  'not',
  'no',
  'yes',
  'what',
  'when',
  'where',
  'how',
  'why',
  'which',
  'who',
]);

function tokenizeForOverlap(value: string): Set<string> {
  const tokens = new Set<string>();
  for (const word of value.split(/\s+/)) {
    if (!word) continue;
    if (word.length < 3) continue;
    if (OVERLAP_STOPWORDS.has(word)) continue;
    tokens.add(word);
  }
  return tokens;
}

function countOverlap(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const token of a) {
    if (b.has(token)) count += 1;
  }
  return count;
}

async function loadFieldFeedback(
  userId: string,
  hostname: string | null,
  question: string,
): Promise<readonly string[]> {
  if (!question.trim()) return [];

  // P17.22 — always run both passes and merge. The cheap exact-match
  // path catches "Are you a US citizen?" → prior feedback on the same
  // string; the semantic pass catches paraphrases like "Eligible to
  // work in the United States?" that share intent but not wording.
  // Surfacing both at once means the model gets few-shot grounding
  // even when one phrasing already has direct feedback.
  const FEEDBACK_LIMIT = 5;

  const exact = await db.formFieldFeedback.findMany({
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      feedback: true,
      fieldLabel: true,
      filledValue: true,
      hostname: true,
      rejectReason: true,
      status: true,
    },
    take: FEEDBACK_LIMIT,
    where: {
      userId,
      OR: [
        { fieldLabel: question },
        { fieldLabel: question, hostname: { not: hostname ?? '' } },
      ],
    },
  });
  const exactIds = new Set(exact.map(row => row.id));
  const exactLines = exact
    .map(row => formatFeedbackLine(row))
    .filter((line): line is string => Boolean(line));

  let similarLines: string[] = [];
  try {
    const similar = await findSimilarFieldFeedback(userId, question, {
      limit: FEEDBACK_LIMIT,
    });
    similarLines = similar
      .filter(row => !exactIds.has(row.id))
      .map(row => {
        const formatted = formatFeedbackLine({
          feedback: row.feedback,
          filledValue: row.filledValue,
          rejectReason: row.rejectReason,
          status: row.status,
        });
        if (!formatted) return null;
        return `[similar to "${row.fieldLabel}" (sim ${row.similarity.toFixed(2)})] ${formatted}`;
      })
      .filter((line): line is string => Boolean(line));
  } catch (error) {
    console.warn('[loadFieldFeedback] semantic search failed', error);
  }

  return [...exactLines, ...similarLines].slice(0, FEEDBACK_LIMIT);
}

function formatFeedbackLine(row: {
  feedback: string;
  filledValue: string | null;
  rejectReason: string | null;
  status: string | null;
}): string | null {
  const parts: string[] = [];
  if (row.status === 'approved') {
    if (row.filledValue) parts.push(`Approved value: "${row.filledValue}"`);
    else parts.push('Approved previous answer.');
  } else if (row.status === 'rejected') {
    if (row.filledValue) {
      parts.push(`Do NOT use "${row.filledValue}" — was rejected.`);
    } else {
      parts.push('Previous answer was rejected.');
    }
    if (row.rejectReason) {
      parts.push(`Reason: ${humanizeRejectReason(row.rejectReason)}.`);
    }
  }
  if (row.feedback.trim()) parts.push(row.feedback.trim());
  if (parts.length === 0) return null;
  return parts.join(' ');
}

function humanizeRejectReason(reason: string): string {
  switch (reason) {
    case 'WRONG_VALUE': return 'wrong value';
    case 'WRONG_OPTION': return 'wrong dropdown option';
    case 'WRONG_FORMAT': return 'wrong format';
    case 'MISSED_FIELD': return 'should not have been left blank';
    case 'HIDDEN_FIELD': return 'hidden field that should usually be ignored';
    case 'UNRELATED_FIELD': return 'unrelated field that should be skipped';
    case 'CAPTCHA_FIELD': return 'captcha or bot check that should not be auto-filled';
    case 'DUPLICATE_INFO': return 'duplicate info from another field';
    case 'WRONG_INTERPRETATION': return 'misinterpreted the question';
    default: return reason.toLowerCase();
  }
}

// ---------------------------------------------------------------------------
// Profile snapshot
// ---------------------------------------------------------------------------

interface ProfileSnapshot {
  readonly canadaWorkPreference: string | null;
  readonly citizenshipStatus: string | null;
  readonly city: string | null;
  readonly country: string | null;
  readonly disabilityStatus: string | null;
  readonly email: string | null;
  readonly firstName: string | null;
  readonly fullName: string | null;
  readonly gender: string | null;
  readonly githubUrl: string | null;
  readonly hispanicLatino: string | null;
  readonly languages: string | null;
  readonly lastName: string | null;
  readonly linkedinUrl: string | null;
  readonly personalWebsiteUrl: string | null;
  readonly phone: string | null;
  readonly preferredName: string | null;
  readonly pronouns: string | null;
  readonly race: string | null;
  readonly referralSource: string | null;
  readonly requiresSponsorship: boolean | null;
  readonly salaryExpectation: string | null;
  readonly state: string | null;
  readonly transgenderIdentity: string | null;
  readonly veteranStatus: string | null;
  readonly websiteUrl: string | null;
  readonly workAuthorization: string | null;
  readonly yearsOfExperience: string | null;
  readonly remoteOnly: boolean | null;
  readonly preferRemote: boolean | null;
  readonly educationDegree: string | null;
  readonly educationInstitution: string | null;
  readonly educationInstitutionLocation: string | null;
  readonly educationStartMonth: number | null;
  readonly educationStartYear: number | null;
  readonly educationEndMonth: number | null;
  readonly educationEndYear: number | null;
}

function buildProfileSnapshot(
  user: {
    readonly email: string | null;
    readonly firstName: string | null;
    readonly lastName: string | null;
    readonly trackingEmailAlias: string | null;
    readonly trackingEmailForwardingEnabled: boolean;
    readonly profile: {
      readonly city: string | null;
      readonly disabilityStatus: string | null;
      readonly emailAddress: string | null;
      readonly firstName: string | null;
      readonly gender: string | null;
      readonly githubUrl: string | null;
      readonly lastName: string | null;
      readonly linkedinUrl: string | null;
      readonly personalWebsiteUrl: string | null;
      readonly phoneNumber: string | null;
      readonly preferredName: string | null;
      readonly pronouns: string | null;
      readonly race: string | null;
      readonly requiresSponsorship: boolean | null;
      readonly salaryExpectation: string | null;
      readonly state: string | null;
      readonly transgenderIdentity: string | null;
      readonly veteranStatus: string | null;
      readonly websiteUrl: string | null;
      readonly workAuthorization: string | null;
      readonly yearsOfExperience: string | null;
      readonly educationDegree?: string | null;
      readonly educationInstitution?: string | null;
      readonly educationInstitutionLocation?: string | null;
      readonly educationStartMonth?: number | null;
      readonly educationStartYear?: number | null;
      readonly educationEndMonth?: number | null;
      readonly educationEndYear?: number | null;
    } | null;
    readonly jobPreferences?: {
      readonly preferRemote: boolean | null;
      readonly remoteOnly: boolean | null;
    } | null;
  },
  knowledge: Record<string, string>,
): ProfileSnapshot {
  const profile = user.profile;
  const firstName = profile?.firstName ?? user.firstName ?? null;
  const lastName = profile?.lastName ?? user.lastName ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(' ').trim() || null;
  const applicationTrackingEmail =
    user.trackingEmailAlias && user.trackingEmailForwardingEnabled
      ? `${user.trackingEmailAlias}@gimmejob.com`
      : null;

  return {
    canadaWorkPreference: knowledge.canadaWorkPreference ?? null,
    citizenshipStatus: knowledge.citizenshipStatus ?? null,
    city: profile?.city ?? null,
    country: knowledge.country ?? 'US',
    disabilityStatus: profile?.disabilityStatus ?? null,
    email:
      applicationTrackingEmail ?? profile?.emailAddress ?? user.email ?? null,
    firstName,
    fullName,
    gender: profile?.gender ?? inferGenderFromFirstName(firstName) ?? null,
    githubUrl: profile?.githubUrl ?? null,
    hispanicLatino: knowledge.hispanicLatino ?? null,
    languages: knowledge.languages ?? null,
    lastName,
    linkedinUrl: profile?.linkedinUrl ?? null,
    personalWebsiteUrl: profile?.personalWebsiteUrl ?? null,
    phone: profile?.phoneNumber ?? null,
    preferredName: profile?.preferredName ?? null,
    pronouns: profile?.pronouns ?? null,
    race: profile?.race ?? null,
    referralSource: knowledge.referralSource ?? null,
    requiresSponsorship: profile?.requiresSponsorship ?? null,
    salaryExpectation:
      profile?.salaryExpectation ??
      knowledge.desiredSalary ??
      knowledge.salaryExpectation ??
      null,
    state: profile?.state ?? null,
    transgenderIdentity: profile?.transgenderIdentity ?? null,
    veteranStatus: profile?.veteranStatus ?? null,
    websiteUrl: profile?.websiteUrl ?? null,
    workAuthorization: profile?.workAuthorization ?? null,
    yearsOfExperience: profile?.yearsOfExperience ?? null,
    remoteOnly: user.jobPreferences?.remoteOnly ?? null,
    preferRemote: user.jobPreferences?.preferRemote ?? null,
    educationDegree: profile?.educationDegree ?? null,
    educationInstitution: profile?.educationInstitution ?? null,
    educationInstitutionLocation: profile?.educationInstitutionLocation ?? null,
    educationStartMonth: profile?.educationStartMonth ?? null,
    educationStartYear: profile?.educationStartYear ?? null,
    educationEndMonth: profile?.educationEndMonth ?? null,
    educationEndYear: profile?.educationEndYear ?? null,
  };
}

// ---------------------------------------------------------------------------
// Deterministic answers
// ---------------------------------------------------------------------------

// Exported for unit tests. Pure: regex + profile lookup, no DB / network.
export function resolveDeterministicAnswer(input: {
  readonly employmentHistory: readonly EmploymentHistoryEntry[];
  readonly jobContext: JobContext | null;
  readonly options: readonly string[];
  readonly profile: ProfileSnapshot;
  readonly question: string;
  readonly fieldType: string;
}): { readonly answer: string; readonly reasoning: string } | null {
  const question = input.question.trim();
  const lower = question.toLowerCase();
  const isSelect =
    input.fieldType === 'select' ||
    input.fieldType === 'radio' ||
    input.fieldType === 'checkbox';

  // Single-option select. Acknowledgement / consent / accuracy-confirm
  // gates render as a <select> with exactly one selectable option ("I
  // acknowledge…", "Acknowledge/Confirm", "I have reviewed and
  // confirmed…"). The only correct action is to pick that one option.
  // We skip placeholders ("Select…", "Choose…") and only fire when the
  // remaining option count is exactly 1.
  if (input.fieldType === 'select' && input.options.length > 0) {
    const realOptions = input.options.filter(
      option => !isSelectPlaceholderOption(option),
    );
    if (realOptions.length === 1) {
      return {
        answer: realOptions[0],
        reasoning: 'Single-option select — only one valid choice available',
      };
    }
  }

  // Pronouns
  if (/\bpronouns?\b/i.test(question)) {
    const answer = pickPronounAnswer(input.profile.pronouns, input.options);
    if (answer) return { answer, reasoning: 'Deterministic pronouns rule' };
  }

  // Referral source
  const isReferralSource =
    /\bhow did you (first )?(hear|learn|find out) about\b/i.test(question) ||
    /\b(referral|application|job)\s+source\b/i.test(question) ||
    /\bhow did you (find|find out about)\b/i.test(question);
  if (isReferralSource) {
    const answer = pickReferralSourceAnswer(
      input.profile.referralSource,
      input.options,
    );
    if (answer) return { answer, reasoning: 'Deterministic referral-source rule' };
    // Fallback chain: LinkedIn → Job board / aggregator → Online → Other.
    // Each runs only if its predecessor isn't in the options. Picking
    // anything beats leaving a required dropdown empty (which is what was
    // happening for users whose profile.referralSource = "Gimme Job"
    // matched zero option lists and the LLM faithfully echoed it back).
    if (input.options.length > 0) {
      const referralFallbackPatterns: ReadonlyArray<RegExp> = [
        /\blinkedin\b/i,
        /\b(?:job\s+board|job\s+site|job\s+aggregator|online\s+job)\b/i,
        /\b(?:indeed|glassdoor|ziprecruiter|monster|dice)\b/i,
        /\b(?:online|internet|web\s*search|search\s+engine)\b/i,
        /\bcompany\s+(?:website|site|careers)\b/i,
        /^other$/i,
        /\bother\b/i,
      ];
      for (const pattern of referralFallbackPatterns) {
        const match = input.options.find(opt => pattern.test(opt.trim()));
        if (match) {
          return {
            answer: match,
            reasoning: `Deterministic referral-source fallback (matched ${pattern} → "${match}")`,
          };
        }
      }
    }
  }

  // "Where are you located?" / "Where are you based?" / "Country of residence"
  // — picks the option that matches the user's profile city/state/country
  // most closely. Without this rule the LLM gets a free-form text prompt
  // for a dropdown and confidently types prose into the search input.
  const isLocationQuestion =
    /\bwhere\s+(?:are\s+you\s+|do\s+you\s+|currently\s+)?(?:located|based|live|reside)\b/i.test(
      question,
    ) ||
    /\b(?:current\s+)?(?:country|state|city)\s+(?:of\s+(?:residence|location)|you\s+live)\b/i.test(
      question,
    ) ||
    /\byour\s+(?:current\s+)?location\b/i.test(question);
  if (isLocationQuestion) {
    const candidates = [
      input.profile.city,
      input.profile.state,
      input.profile.country,
    ].filter((value): value is string => Boolean(value?.trim()));
    if (candidates.length > 0 && input.options.length > 0) {
      const lowerOpts = input.options.map(opt => opt.toLowerCase());
      for (const candidate of candidates) {
        const needle = candidate.toLowerCase();
        const exact = lowerOpts.findIndex(opt => opt === needle);
        if (exact !== -1) {
          return {
            answer: input.options[exact],
            reasoning: `Deterministic location rule (exact match on "${candidate}")`,
          };
        }
        const partial = lowerOpts.findIndex(
          opt => opt.includes(needle) || needle.includes(opt),
        );
        if (partial !== -1) {
          return {
            answer: input.options[partial],
            reasoning: `Deterministic location rule (partial match on "${candidate}" → "${input.options[partial]}")`,
          };
        }
      }
    }
    // Free-text location field — just type the city/state/country as-is.
    if (candidates.length > 0 && !isSelect) {
      return {
        answer: candidates.join(', '),
        reasoning: 'Deterministic location rule (free-text)',
      };
    }
  }

  // Prior employment
  const isPriorEmployment =
    /\b(previously|ever)\s+(been\s+)?(employed|worked)\b/i.test(question) ||
    /\bdid you (ever\s+)?work (at|for)\b/i.test(question) ||
    /\bformer\b.*\bemployee\b/i.test(question) ||
    /\bare you a former\b/i.test(question);
  if (isPriorEmployment) {
    const targetCompany = extractCompanyFromQuestion(
      question,
      input.jobContext?.company ?? null,
    );
    const answer = pickYesNoEmploymentAnswer(
      targetCompany,
      input.employmentHistory,
      input.options,
    );
    if (answer) {
      return {
        answer,
        reasoning: `Deterministic prior-employment rule (target=${targetCompany ?? '?'})`,
      };
    }
  }

  // Sponsorship
  if (
    /\bsponsor(?:ship|ed)\b/.test(lower) ||
    /\bvisa\s+(?:status|sponsorship)\b/.test(lower) ||
    /\bemployment\s+visa\b/.test(lower) ||
    /\brequire\s+(?:visa|sponsorship)\b/.test(lower) ||
    // Sponsorship asked indirectly — "will you require our assistance
    // with work authorization", "do you need help with work authorization",
    // "will you need assistance obtaining work authorization", etc.
    /\bassistance\s+(?:with|obtaining)\s+work\s+author(?:ization|ized)\b/.test(
      lower,
    ) ||
    /\b(?:require|need)\s+(?:our\s+)?(?:assistance|help|support)\s+(?:with|to\s+obtain)\b.*\bwork\b/.test(
      lower,
    )
  ) {
    const explicit = input.profile.requiresSponsorship;
    if (explicit === true) {
      return {
        answer: pickYesNoAnswer('yes', input.options, isSelect),
        reasoning: 'profile.requiresSponsorship === true',
      };
    }
    if (explicit === false) {
      return {
        answer: pickYesNoAnswer('no', input.options, isSelect),
        reasoning: 'profile.requiresSponsorship === false',
      };
    }
    if (
      explicit == null &&
      isUsBasedAuthorizedProfile(input.profile) &&
      questionTargetsUs(lower)
    ) {
      return {
        answer: pickYesNoAnswer('no', input.options, isSelect),
        reasoning: 'US-authorized profile, US-targeting sponsorship question → No',
      };
    }
  }

  // Security clearance. Most candidates don't hold one — the deterministic
  // default is No / None. If the user holds one they should set a
  // hostname-scoped UserFieldRule that overrides this.
  if (
    /\bsecurity\s+clearance\b/.test(lower) ||
    /\bclearance\s+(?:level|status)\b/.test(lower) ||
    /\bdo\s+you\s+(?:currently\s+)?(?:hold|have)\s+(?:a\s+)?(?:active\s+)?(?:security\s+)?clearance\b/.test(
      lower,
    )
  ) {
    if (isSelect) {
      const noneOption = matchOption(input.options, [
        'none',
        'no clearance',
        'not applicable',
        'n/a',
        'no',
      ]);
      if (noneOption) {
        return {
          answer: noneOption,
          reasoning:
            'Security clearance → "None" (job-seeker default; override with a UserFieldRule if you hold one)',
        };
      }
    }
    return {
      answer: pickYesNoAnswer('no', input.options, isSelect) ?? 'No',
      reasoning:
        'Security clearance → No (job-seeker default; override with a UserFieldRule if you hold one)',
    };
  }

  // Work authorization
  if (
    /\bauthor(?:ized|ization)\b.*\bwork\b/.test(lower) ||
    /\blegally\s+able\b.*\bwork\b/.test(lower) ||
    /\beligible\s+to\s+work\b/.test(lower) ||
    /\bright\s+to\s+work\b/.test(lower) ||
    /\blegal\s+(?:right|authorization)\s+to\s+work\b/.test(lower)
  ) {
    if (isUsBasedAuthorizedProfile(input.profile) && questionTargetsUs(lower)) {
      return {
        answer: pickYesNoAnswer('yes', input.options, isSelect),
        reasoning: 'US-authorized profile, US-targeting work-auth question → Yes',
      };
    }
    // Generic candidate-friendly default — unless profile explicitly says
    // requiresSponsorship === true, candidates applying through this app
    // are presumed authorized to work in the role's country. Defaulting
    // to Yes is the right candidate-protecting choice: a wrong Yes can
    // be corrected before submit; a wrong empty fails the submit
    // outright and screens the candidate out of consideration.
    if (input.profile.requiresSponsorship !== true) {
      const yes = pickYesNoAnswer('yes', input.options, isSelect);
      if (yes) {
        return {
          answer: yes,
          reasoning:
            'work-auth question, profile.requiresSponsorship !== true → defaulting to Yes (candidate is presumed authorized)',
        };
      }
    }
    // "Source of right to work" / "Visa type" — pick the citizen / permanent
    // resident option when the profile says so.
    if (
      /\bsource\b/.test(lower) ||
      /\btype\b/.test(lower) ||
      /\bbasis\b/.test(lower)
    ) {
      const citizenshipKeywords = (input.profile.citizenshipStatus ?? '')
        .trim()
        .toLowerCase();
      if (
        (citizenshipKeywords.includes('citizen') ||
          isUsBasedAuthorizedProfile(input.profile)) &&
        input.options.length > 0
      ) {
        const citizenOption = input.options.find(opt =>
          /\b(?:us\s+citizen|u\.?s\.?\s+citizen|american\s+citizen|citizen\b)/i.test(
            opt,
          ),
        );
        if (citizenOption) {
          return {
            answer: citizenOption,
            reasoning: `source-of-right-to-work → matched citizen option "${citizenOption}"`,
          };
        }
      }
    }
  }

  // EU citizenship — only Yes if profile.country is in the EU.
  if (
    /\b(?:eu|european\s+union)\s+citizen\b/.test(lower) ||
    /\bcitizen\s+of\s+(?:the\s+)?(?:eu|european\s+union)\b/.test(lower) ||
    /\bcitizen\s+of\s+(?:a|an)\s+european\s+union\s+member/.test(lower)
  ) {
    // We don't track EU citizenship per profile yet. Default to No for
    // non-EU profile countries and decline for unknown.
    const country = (input.profile.country ?? '').trim().toLowerCase();
    const eu = new Set([
      'austria','belgium','bulgaria','croatia','cyprus','czech republic','czechia',
      'denmark','estonia','finland','france','germany','greece','hungary','ireland',
      'italy','latvia','lithuania','luxembourg','malta','netherlands','poland',
      'portugal','romania','slovakia','slovenia','spain','sweden',
    ]);
    if (country && !eu.has(country) && country !== '') {
      return {
        answer: pickYesNoAnswer('no', input.options, isSelect),
        reasoning: `profile.country = "${country}" (not EU) → EU citizen question = No`,
      };
    }
  }

  // Salary-in-range / experience-with / familiarity questions —
  // default to "Yes" so the candidate isn't auto-screened out for a
  // soft mismatch. The user explicitly opted into this behavior; if a
  // recruiter follows up, they can correct it manually. Gated on
  // `isSelect` (yes/no widget) so we don't dump "Yes" into a free-text
  // "specify your salary request" field.
  if (isSelect) {
    const salaryInRange =
      /\b(?:does|is)\s+your\s+salary\b.*\b(?:fall\s+within|within|in)\s+(?:the\s+|our\s+)?(?:range|estimated\s+range|salary\s+range|posted\s+range)\b/.test(
        lower,
      ) ||
      /\b(?:salary|compensation|comp)\s+(?:expectation|requirement|request)s?\s+(?:within|in\s+(?:the\s+)?range)\b/.test(
        lower,
      ) ||
      /\b(?:are\s+you\s+(?:ok|okay|fine|comfortable)\s+with|are\s+you\s+open\s+to)\b.*\b(?:salary\s+range|posted\s+(?:salary|range)|comp(?:ensation)?\s+range)\b/.test(
        lower,
      );
    const haveExperience =
      /\b(?:do\s+you\s+have|have\s+you\s+had|do\s+you\s+possess|have\s+you\s+got)\b.*\bexperience\b/.test(
        lower,
      ) ||
      /\b(?:are\s+you\s+|have\s+you\s+been\s+)?experienced\b.*\b(?:with|in|using)\b/.test(
        lower,
      ) ||
      /\b(?:have\s+you\s+worked|do\s+you\s+work)\b.*\b(?:with|in|on|at)\b/.test(
        lower,
      ) ||
      /\b(?:are\s+you|do\s+you\s+feel|how\s+(?:comfortable|familiar))\s+familiar\s+(?:with|in)\b/.test(
        lower,
      ) ||
      /\b(?:are\s+you\s+)?proficient\s+(?:with|in|at)\b/.test(lower) ||
      /\bworking\s+knowledge\s+of\b/.test(lower);
    if (salaryInRange || haveExperience) {
      // Skip the rare cases where "no" is a "decline to answer" path —
      // those questions usually have a third "Prefer not to answer"
      // option in the list. We still default to Yes here because the
      // user's explicit preference is "say Yes to these".
      return {
        answer: pickYesNoAnswer('yes', input.options, isSelect),
        reasoning: salaryInRange
          ? 'Salary-in-range question → default Yes (per user preference)'
          : 'Have-experience / familiarity question → default Yes (per user preference)',
      };
    }
  }

  // Willingness to travel / relocate / commute. If the user explicitly
  // wants remote-only roles, "are you willing to travel/relocate/come
  // on-site" all become "No". When remoteOnly is false (or unset but
  // preferRemote is false), default to "Yes" since most candidates
  // applying to a non-remote-tagged role expect to be on-site at least
  // some of the time. Gated on `isSelect` so we don't dump "Yes" into
  // free-text "Where would you relocate to?"-style fields.
  if (
    isSelect &&
    (/\b(?:willing|able)\s+to\s+(?:travel|relocate|commute|come|visit|attend|be\s+on[-\s]?site)\b/.test(
      lower,
    ) ||
      /\btravel\s+(?:every|to|for|frequently|occasionally|regularly|to\s+the\s+(?:office|hq|company\s+hq|customer))\b/.test(
        lower,
      ) ||
      /\b(?:open|willing)\s+to\s+relocat(?:e|ion)\b/.test(lower) ||
      /\brelocate\s+(?:to|for)\b/.test(lower) ||
      /\bcomfortable\s+(?:with\s+)?travel(?:ing)?\b/.test(lower) ||
      /\bwilling\s+to\s+work\s+(?:from|in|on[-\s]?site)\b/.test(lower))
  ) {
    const remoteOnly = input.profile.remoteOnly === true;
    if (remoteOnly) {
      return {
        answer: pickYesNoAnswer('no', input.options, isSelect),
        reasoning:
          'profile.remoteOnly === true → user is not willing to travel / relocate / be on-site',
      };
    }
    return {
      answer: pickYesNoAnswer('yes', input.options, isSelect),
      reasoning:
        'profile.remoteOnly is not set → assume willing to travel / relocate / be on-site',
    };
  }

  // "Do you live in one of the following states? Alabama, Alaska, …"
  // The list of states is enumerated in the question itself. Compare to
  // the user's profile.state (or city/state knowledge). Runs before the
  // generic residency rule so "live in" doesn't short-circuit to "Yes".
  if (
    isSelect &&
    /\b(?:live|located|reside|residing|based|currently\s+(?:live|located|reside|based))\s+in\s+(?:one\s+of\s+)?(?:the\s+)?(?:following|these|any\s+of)\b/.test(
      lower,
    )
  ) {
    const listedStates = extractStateListFromQuestion(question);
    const userState = (input.profile.state ?? '').trim();
    if (listedStates.length > 0 && userState) {
      const matches = listedStates.some(
        listed =>
          listed.toLowerCase() === userState.toLowerCase() ||
          listed.toLowerCase() === stateAbbreviationFor(userState).toLowerCase(),
      );
      return {
        answer: pickYesNoAnswer(matches ? 'yes' : 'no', input.options, isSelect),
        reasoning: matches
          ? `profile.state "${userState}" appears in question's state list → Yes`
          : `profile.state "${userState}" NOT in question's state list (${listedStates.slice(0, 6).join(', ')}…) → No`,
      };
    }
  }

  // Residency / current location — "Do you live in the US?",
  // "Are you currently located in the United States?", "Are you a resident
  // of the U.S.?". Gated on `isSelect` so we don't dump "Yes" into a
  // free-text "Where are you currently located?" field (which expects a
  // city/state/country string, not a yes/no).
  if (
    isSelect &&
    (/\b(?:are|do)\s+you\s+(?:live|living|reside|residing|located|based|currently)\b/.test(
      lower,
    ) ||
      /\bresident\s+of\b/.test(lower) ||
      /\b(?:currently\s+)?(?:live|reside|located|based)\s+in\b/.test(lower) ||
      /\bcurrently\s+based\s+in\b/.test(lower))
  ) {
    if (isUsBasedAuthorizedProfile(input.profile) && questionTargetsUs(lower)) {
      return {
        answer: pickYesNoAnswer('yes', input.options, isSelect),
        reasoning: 'US-based profile, US-targeting residency question → Yes',
      };
    }
  }

  // Gender — when the user has explicitly set a gender on their profile,
  // use it directly instead of letting the LLM guess. The LLM was returning
  // "Female" for users with profile.gender = "Male" because the prompt
  // didn't elevate the profile field strongly enough.
  if (
    /\bgender\b/.test(lower) ||
    /\b(?:which|what)\s+gender\b/.test(lower) ||
    /\bgender\s+identity\b/.test(lower) ||
    /\bidentify\s+as\b.*\b(?:male|female|man|woman)\b/.test(lower)
  ) {
    const profileGender = input.profile.gender?.trim();
    if (profileGender) {
      const matched = pickGenderAnswer(profileGender, input.options);
      if (matched) {
        return {
          answer: matched,
          reasoning: `profile.gender = "${profileGender}" → matched option "${matched}"`,
        };
      }
    }
  }

  // Veteran status — same fix as gender: profile field wins over LLM guess.
  if (
    /\bveteran\b/.test(lower) ||
    /\bmilitary\s+(?:status|service)\b/.test(lower) ||
    /\barmed\s+forces\b/.test(lower)
  ) {
    const profileVeteran = input.profile.veteranStatus?.trim();
    if (profileVeteran) {
      const matched = pickProfileFieldAnswer(profileVeteran, input.options, {
        'i am not a protected veteran': [
          'not a veteran',
          'i am not a veteran',
          'no',
          'non-veteran',
        ],
        'i am a protected veteran': [
          'i am a veteran',
          'protected veteran',
          'yes',
          'veteran',
        ],
        'i do not wish to answer': [
          'decline',
          'prefer not',
          'i decline',
          'rather not say',
        ],
      });
      if (matched) {
        return {
          answer: matched,
          reasoning: `profile.veteranStatus = "${profileVeteran}" → matched option "${matched}"`,
        };
      }
    }
    // No profile signal → decline to self-identify so the form can still
    // submit. EEOC voluntary self-identification questions are required
    // by some boards but always include a "decline" / "prefer not" option.
    const declined = pickDeclineOption(input.options);
    if (declined) {
      return {
        answer: declined,
        reasoning: `no profile.veteranStatus → defaulted to decline-to-answer option "${declined}"`,
      };
    }
  }

  // Disability status — same priority chain.
  if (
    /\bdisabilit(?:y|ies)\b/.test(lower) ||
    /\bdisabled\b/.test(lower) ||
    /\bphysical\s+or\s+mental\s+impairment\b/.test(lower)
  ) {
    const profileDisability = input.profile.disabilityStatus?.trim();
    if (profileDisability) {
      const matched = pickProfileFieldAnswer(
        profileDisability,
        input.options,
        {
          'yes, i have a disability': ['yes', 'i have a disability'],
          'no, i do not have a disability': [
            'no',
            'i do not have a disability',
          ],
          'i do not want to answer': [
            'decline',
            'prefer not',
            'i don’t wish to answer',
            'i do not wish to answer',
          ],
        },
      );
      if (matched) {
        return {
          answer: matched,
          reasoning: `profile.disabilityStatus = "${profileDisability}" → matched option "${matched}"`,
        };
      }
    }
    const declined = pickDeclineOption(input.options);
    if (declined) {
      return {
        answer: declined,
        reasoning: `no profile.disabilityStatus → defaulted to decline-to-answer option "${declined}"`,
      };
    }
  }

  // Voluntary self-identification of sexual orientation / gender identity /
  // LGBTQ+ membership. There is no profile field for these and the user has
  // not opted to share — default to the decline-to-answer option so the form
  // submits cleanly. Greenhouse EEOC sections always include this choice.
  if (
    /\bsexual\s+orientation\b/.test(lower) ||
    /\bgender\s+identity\b/.test(lower) ||
    /\blgbt(?:q\+?)?\b/.test(lower) ||
    /\bsexual\s+or\s+gender\b/.test(lower) ||
    /\btransgender\b/.test(lower) ||
    /\bnon[\s-]?binary\b/.test(lower) ||
    (/\bmember\b/.test(lower) && /\bcommunity\b/.test(lower) && /\bidentif/.test(lower))
  ) {
    const declined = pickDeclineOption(input.options);
    if (declined) {
      return {
        answer: declined,
        reasoning: `EEOC voluntary self-id (sexual orientation / gender identity) → defaulted to "${declined}"`,
      };
    }
  }

  // Education sub-form: School / Institution / University / College
  if (
    /\b(?:school|institution|university|college|alma\s+mater|educational\s+(?:institution|background))\b/.test(
      lower,
    ) &&
    !/\b(?:high\s+school|graduate\s+school|grad\s+school)\b/.test(lower)
  ) {
    const fromProfile = input.profile.educationInstitution?.trim();
    if (fromProfile) {
      return {
        answer: fromProfile,
        reasoning: `profile.educationInstitution = "${fromProfile}"`,
      };
    }
    const fallback = inferFallbackInstitution(input.profile);
    if (fallback) {
      return {
        answer: fallback,
        reasoning: `state-based fallback institution (no profile education set)`,
      };
    }
  }

  // Education sub-form: Degree (Bachelor's, Master's, PhD, etc.)
  if (
    /\bdegree\s+(?:type|earned|received)?\b/.test(lower) ||
    /^degree\s*$/i.test(question.trim()) ||
    /\bwhat\s+(?:type\s+of\s+)?degree\b/.test(lower) ||
    /\b(?:highest\s+)?level\s+of\s+education\b/.test(lower) ||
    /\b(?:highest\s+)?education\s+level\b/.test(lower)
  ) {
    const fromProfile = input.profile.educationDegree?.trim();
    const candidate =
      fromProfile && fromProfile.length > 0
        ? fromProfile
        : inferDefaultDegree();
    if (input.options.length === 0) {
      return {
        answer: candidate,
        reasoning: fromProfile
          ? `profile.educationDegree = "${fromProfile}"`
          : `role-based default degree (no profile education set)`,
      };
    }
    const matched = pickProfileFieldAnswer(candidate, input.options, {
      "bachelor's degree": [
        'bachelor',
        'bachelors',
        'bs',
        'ba',
        'b.s.',
        'b.a.',
        'bachelor of science',
        'bachelor of arts',
        'undergraduate',
      ],
      "master's degree": [
        'master',
        'masters',
        'ms',
        'ma',
        'm.s.',
        'm.a.',
        'mba',
        'master of science',
        'master of arts',
      ],
      'doctorate': ['phd', 'ph.d.', 'doctoral', 'doctorate degree'],
      'associate degree': ['associates', 'aa', 'a.a.', 'as', 'a.s.'],
      'high school diploma': ['high school', 'ged', 'secondary'],
    });
    if (matched) {
      return {
        answer: matched,
        reasoning: fromProfile
          ? `profile.educationDegree → matched option "${matched}"`
          : `role-based default degree → matched option "${matched}"`,
      };
    }
  }

  // Education sub-form: Discipline / Field of study / Major
  if (
    /\b(?:discipline|field\s+of\s+study|major|area\s+of\s+study|concentration|course\s+of\s+study|specialization)\b/.test(
      lower,
    )
  ) {
    const candidate = inferDisciplineFromTitle(
      input.jobContext?.title ?? null,
    );
    if (input.options.length === 0) {
      return {
        answer: candidate,
        reasoning: `role-inferred discipline (from job title "${input.jobContext?.title ?? '(unknown)'}")`,
      };
    }
    const matched = pickProfileFieldAnswer(candidate, input.options, {
      'computer science': [
        'cs',
        'comp sci',
        'computer engineering',
        'software engineering',
        'computing',
        'information technology',
        'information systems',
      ],
      'business administration': [
        'business',
        'mba',
        'commerce',
        'management',
      ],
      marketing: ['advertising', 'communications', 'digital marketing'],
      'graphic design': ['design', 'visual design', 'ui/ux'],
      mathematics: ['math', 'maths', 'applied mathematics', 'statistics'],
      engineering: ['mechanical engineering', 'electrical engineering'],
    });
    if (matched) {
      return {
        answer: matched,
        reasoning: `role-inferred discipline → matched option "${matched}"`,
      };
    }
  }

  // Education sub-form: Start year / End year
  const startYearMatch =
    /\b(?:start|attended\s+from|education\s+start)\b.*\b(?:year|date)\b/.test(
      lower,
    ) ||
    /\bstart\s+date\s+year\b/.test(lower) ||
    /\byear\s+(?:started|begun|entered)\b/.test(lower);
  const endYearMatch =
    /\b(?:end|completed|finished|graduated|graduation|attended\s+to)\b.*\b(?:year|date)\b/.test(
      lower,
    ) ||
    /\bend\s+date\s+year\b/.test(lower) ||
    /\b(?:graduation|completion)\s+year\b/.test(lower);
  if (startYearMatch || endYearMatch) {
    const fromProfile = endYearMatch
      ? input.profile.educationEndYear
      : input.profile.educationStartYear;
    if (typeof fromProfile === 'number' && fromProfile > 1950) {
      return {
        answer: String(fromProfile),
        reasoning: endYearMatch
          ? `profile.educationEndYear = ${fromProfile}`
          : `profile.educationStartYear = ${fromProfile}`,
      };
    }
    const inferred = inferEducationYearFromHistory(
      input.employmentHistory,
      endYearMatch ? 'end' : 'start',
    );
    if (inferred) {
      return {
        answer: String(inferred),
        reasoning: `inferred ${endYearMatch ? 'end' : 'start'} year from first employment date`,
      };
    }
  }

  // Race / ethnicity — straight match against options.
  if (
    /\brace\b/.test(lower) ||
    /\bethnic(?:ity)?\b/.test(lower) ||
    /\bethnic\s+group\b/.test(lower) ||
    /\bidentify\s+my\s+ethnicity\b/.test(lower) ||
    /\bindicate\s+(?:your\s+)?ethnic\s+group\b/.test(lower)
  ) {
    const profileRace = input.profile.race?.trim();
    if (profileRace) {
      const matched = pickProfileFieldAnswer(profileRace, input.options, {
        white: ['white (not hispanic or latino)', 'caucasian', 'european'],
        'black or african american': [
          'black',
          'african american',
          'black (not hispanic or latino)',
          'black/african american',
        ],
        asian: [
          'asian (not hispanic or latino)',
          'asian american',
          'east asian',
          'south asian',
        ],
        'native hawaiian or other pacific islander': [
          'pacific islander',
          'native hawaiian',
          'hawaiian',
        ],
        'american indian or alaska native': [
          'native american',
          'american indian',
          'alaska native',
          'indigenous',
        ],
        'two or more races': [
          'multi-racial',
          'multiracial',
          'mixed race',
          'two or more',
        ],
        'i do not wish to answer': [
          'decline to self-identify',
          'decline to answer',
          'prefer not to answer',
          'decline',
        ],
      });
      if (matched) {
        return {
          answer: matched,
          reasoning: `profile.race = "${profileRace}" → matched option "${matched}"`,
        };
      }
    }
    // No profile signal → decline. EEOC race questions are voluntary and
    // always include a "decline to self-identify" option.
    const declined = pickDeclineOption(input.options);
    if (declined) {
      return {
        answer: declined,
        reasoning: `no profile.race → defaulted to decline-to-answer "${declined}"`,
      };
    }
  }


  // Hispanic/Latino yes/no.
  if (/\bhispanic|latino|latina|latinx\b/.test(lower)) {
    const profileHL = input.profile.hispanicLatino?.trim();
    if (profileHL) {
      const lcHL = profileHL.toLowerCase();
      const wantsYes = /^y|yes/.test(lcHL);
      const wantsNo = /^n|no/.test(lcHL) || lcHL.includes('not hispanic');
      if (wantsYes || wantsNo) {
        return {
          answer: pickYesNoAnswer(
            wantsYes ? 'yes' : 'no',
            input.options,
            isSelect,
          ),
          reasoning: `profile.hispanicLatino = "${profileHL}" → ${wantsYes ? 'Yes' : 'No'}`,
        };
      }
    }
    // No profile signal → decline (Hispanic/Latino is voluntary EEOC).
    const declined = pickDeclineOption(input.options);
    if (declined) {
      return {
        answer: declined,
        reasoning: `no profile.hispanicLatino → defaulted to decline "${declined}"`,
      };
    }
  }

  // Salary expectation — text or textarea, free-form. When the user has set
  // it on their profile, type it verbatim instead of letting the LLM fabricate
  // a different number. Skipped for select fields (rare for salary anyway).
  if (
    !isSelect &&
    (/\b(?:desired|expected|target)\s+(?:salary|compensation|pay)\b/.test(lower) ||
      /\bsalary\s+(?:expectation|requirement|range)\b/.test(lower) ||
      /\bcompensation\s+(?:expectation|requirement)\b/.test(lower) ||
      /\bwhat\s+(?:salary|comp(?:ensation)?)\b/.test(lower))
  ) {
    const salary = input.profile.salaryExpectation?.trim();
    if (salary) {
      return {
        answer: salary,
        reasoning: `profile.salaryExpectation = "${salary}"`,
      };
    }
  }

  // Post-employment restrictions / non-compete
  if (
    /\bnon[-\s]?compete\b/.test(lower) ||
    /\bnon[-\s]?solicitation\b/.test(lower) ||
    /\bpost[-\s]?employment\s+(?:restriction|agreement|covenant|obligation)\b/.test(lower) ||
    /\brestrictive\s+covenant\b/.test(lower) ||
    /\bbound\s+by.*\b(?:agreement|contract|covenant|nda|restriction)\b/.test(lower) ||
    (/\bagreed\s+to\b/.test(lower) &&
      /\b(?:restriction|non[-\s]?compete|non[-\s]?solicitation)\b/.test(lower))
  ) {
    return {
      answer: pickYesNoAnswer('no', input.options, isSelect),
      reasoning: 'Post-employment restriction question → No (job-seeker default)',
    };
  }

  // P17.12 — common required-question patterns the LLM was leaving empty
  // or fabricating wrong values for. Each is anchored to a deterministic
  // source: profile field, employment-history entry, or job-seeker
  // default that's safe in the application context.

  // Consent / privacy / data-processing checkboxes. The user submitting
  // an application implies consent — leaving the box empty is what's
  // making submits bounce.
  if (
    /\bi\s+consent\b/.test(lower) ||
    /\bi\s+agree\b/.test(lower) ||
    /\bconsent\s+to\s+(?:have\s+)?(?:my|the)\s+(?:personal\s+)?(?:information|data|info)\b/.test(lower) ||
    /\bagree\s+to\s+(?:the\s+)?(?:processing|collection|storage|use)\s+of\b/.test(lower) ||
    /\bauthorize\s+the\s+(?:collection|processing|storage|use)\s+of\b/.test(lower)
  ) {
    return {
      answer: pickYesNoAnswer('yes', input.options, isSelect),
      reasoning: 'Consent / data-processing checkbox → Yes (applying implies consent)',
    };
  }

  // Notice period. US default is two weeks; explicit profile/knowledge
  // entry overrides if it lands in the future.
  if (
    /\bnotice\s+period\b/.test(lower) ||
    /\bhow\s+much\s+notice\b/.test(lower) ||
    /\bnotice\s+(?:required|to\s+give)\b/.test(lower)
  ) {
    return {
      answer: '2 weeks',
      reasoning: 'Notice period → "2 weeks" (US default)',
    };
  }

  // Earliest / expected start date.
  if (
    /\bearliest\s+(?:possible\s+)?start\s+date\b/.test(lower) ||
    /\bexpected\s+start\s+date\b/.test(lower) ||
    /\bwhen\s+(?:can|could)\s+you\s+(?:start|begin)\b/.test(lower) ||
    /\bavailable\s+(?:to\s+)?start\b/.test(lower) ||
    /\b(?:start|begin)\s+date\b/.test(lower)
  ) {
    return {
      answer: 'Two weeks from offer acceptance',
      reasoning: 'Start date → "Two weeks from offer acceptance" (US default)',
    };
  }

  // Total years of experience. Free-form text or select; if the profile
  // has an explicit count, use it verbatim.
  if (
    /\b(?:total\s+|years?\s+of\s+)\s*(?:professional\s+)?(?:work\s+)?experience\b/.test(
      lower,
    ) ||
    /\bhow\s+many\s+years\b.*\bexperience\b/.test(lower) ||
    /\byears?\s+of\s+experience\b/.test(lower)
  ) {
    const yoe = input.profile.yearsOfExperience?.trim();
    if (yoe) {
      // For a select, try to map "5" → "5", "5+", "5-7", etc. For text,
      // use verbatim.
      if (isSelect && input.options.length > 0) {
        const matched = matchYearsOfExperienceOption(yoe, input.options);
        if (matched) {
          return {
            answer: matched,
            reasoning: `profile.yearsOfExperience = "${yoe}" → option "${matched}"`,
          };
        }
      } else {
        return {
          answer: yoe,
          reasoning: `profile.yearsOfExperience = "${yoe}"`,
        };
      }
    }
  }

  // Current employer / current company. employmentHistory entry whose
  // endDate is null is the live job.
  if (
    /\bcurrent(?:ly)?\s+(?:employer|employed\s+(?:by|at)|company|workplace)\b/.test(
      lower,
    ) ||
    /\bwhere\s+(?:are\s+)?you\s+currently\s+(?:work(?:ing)?|employed)\b/.test(
      lower,
    ) ||
    /\bpresent\s+employer\b/.test(lower)
  ) {
    const current = pickCurrentEmploymentEntry(input.employmentHistory);
    if (current?.company) {
      return {
        answer: current.company,
        reasoning: `Current employer = "${current.company}" (latest employment-history entry with no endDate)`,
      };
    }
  }

  // Current title / current role / current position.
  if (
    /\bcurrent(?:ly)?\s+(?:job\s+)?(?:title|role|position)\b/.test(lower) ||
    /\bcurrent\s+(?:job|position)\b/.test(lower) ||
    /\bwhat\s+is\s+your\s+(?:current\s+)?(?:job\s+)?title\b/.test(lower)
  ) {
    const current = pickCurrentEmploymentEntry(input.employmentHistory);
    if (current?.title) {
      return {
        answer: current.title,
        reasoning: `Current title = "${current.title}" (latest employment-history entry with no endDate)`,
      };
    }
  }

  return null;
}

function matchOption(
  options: readonly string[],
  candidates: readonly string[],
): string | null {
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const exact = options.find(
      option => option.trim().toLowerCase() === lower,
    );
    if (exact) return exact;
  }
  for (const candidate of candidates) {
    const lower = candidate.toLowerCase();
    const partial = options.find(option =>
      option.toLowerCase().includes(lower),
    );
    if (partial) return partial;
  }
  return null;
}

function pickCurrentEmploymentEntry(
  entries: readonly EmploymentHistoryEntry[],
): EmploymentHistoryEntry | null {
  // First, look for a no-end-date entry — those represent the user's
  // current job. Fall back to the most-recent entry if every row has
  // an end date (meaning the user is between jobs).
  const ongoing = entries.find(entry => !entry.endDate);
  if (ongoing) return ongoing;
  return entries[0] ?? null;
}

// Match a profile yearsOfExperience number against a select's option set
// like ["0-2", "3-5", "6-9", "10+"] or ["Less than 1 year", "1 year", …].
function matchYearsOfExperienceOption(
  yoe: string,
  options: readonly string[],
): string | null {
  const numeric = Number.parseFloat(yoe.replace(/[^\d.]/g, ''));
  if (!Number.isFinite(numeric)) return null;
  // Look for a range option that contains the number.
  for (const option of options) {
    const trimmed = option.trim();
    const lower = trimmed.toLowerCase();
    // Patterns: "5+", "10+ years", "5 or more"
    const orMore = lower.match(
      /^(\d+)\s*(?:\+|(?:or\s+more|or\s+greater|plus)\b)/,
    );
    if (orMore) {
      const threshold = Number.parseFloat(orMore[1]);
      if (Number.isFinite(threshold) && numeric >= threshold) return trimmed;
      continue;
    }
    // Patterns: "0-2", "3 - 5", "6 to 9 years"
    const range = lower.match(/^(\d+)\s*(?:-|to|through)\s*(\d+)/);
    if (range) {
      const min = Number.parseFloat(range[1]);
      const max = Number.parseFloat(range[2]);
      if (
        Number.isFinite(min) &&
        Number.isFinite(max) &&
        numeric >= min &&
        numeric <= max
      ) {
        return trimmed;
      }
      continue;
    }
    // Patterns: "5 years", "5", "5.5 years"
    const exactNum = lower.match(/^(\d+(?:\.\d+)?)\s*(?:years?|yrs?)?$/);
    if (exactNum) {
      const value = Number.parseFloat(exactNum[1]);
      if (Number.isFinite(value) && Math.abs(value - numeric) < 0.5) {
        return trimmed;
      }
      continue;
    }
    // "Less than 1 year"
    if (/^less\s+than\s+1\s+year/.test(lower) && numeric < 1) return trimmed;
  }
  return null;
}

const US_STATE_NAMES: readonly string[] = [
  'Alabama',
  'Alaska',
  'Arizona',
  'Arkansas',
  'California',
  'Colorado',
  'Connecticut',
  'Delaware',
  'Florida',
  'Georgia',
  'Hawaii',
  'Idaho',
  'Illinois',
  'Indiana',
  'Iowa',
  'Kansas',
  'Kentucky',
  'Louisiana',
  'Maine',
  'Maryland',
  'Massachusetts',
  'Michigan',
  'Minnesota',
  'Mississippi',
  'Missouri',
  'Montana',
  'Nebraska',
  'Nevada',
  'New Hampshire',
  'New Jersey',
  'New Mexico',
  'New York',
  'North Carolina',
  'North Dakota',
  'Ohio',
  'Oklahoma',
  'Oregon',
  'Pennsylvania',
  'Rhode Island',
  'South Carolina',
  'South Dakota',
  'Tennessee',
  'Texas',
  'Utah',
  'Vermont',
  'Virginia',
  'Washington',
  'West Virginia',
  'Wisconsin',
  'Wyoming',
  'District of Columbia',
];

const US_STATE_ABBREVIATIONS: Record<string, string> = {
  alabama: 'AL',
  alaska: 'AK',
  arizona: 'AZ',
  arkansas: 'AR',
  california: 'CA',
  colorado: 'CO',
  connecticut: 'CT',
  delaware: 'DE',
  florida: 'FL',
  georgia: 'GA',
  hawaii: 'HI',
  idaho: 'ID',
  illinois: 'IL',
  indiana: 'IN',
  iowa: 'IA',
  kansas: 'KS',
  kentucky: 'KY',
  louisiana: 'LA',
  maine: 'ME',
  maryland: 'MD',
  massachusetts: 'MA',
  michigan: 'MI',
  minnesota: 'MN',
  mississippi: 'MS',
  missouri: 'MO',
  montana: 'MT',
  nebraska: 'NE',
  nevada: 'NV',
  'new hampshire': 'NH',
  'new jersey': 'NJ',
  'new mexico': 'NM',
  'new york': 'NY',
  'north carolina': 'NC',
  'north dakota': 'ND',
  ohio: 'OH',
  oklahoma: 'OK',
  oregon: 'OR',
  pennsylvania: 'PA',
  'rhode island': 'RI',
  'south carolina': 'SC',
  'south dakota': 'SD',
  tennessee: 'TN',
  texas: 'TX',
  utah: 'UT',
  vermont: 'VT',
  virginia: 'VA',
  washington: 'WA',
  'west virginia': 'WV',
  wisconsin: 'WI',
  wyoming: 'WY',
  'district of columbia': 'DC',
};

// Pull a list of US states out of question text — used for the
// "Do you live in one of these states? Alabama, Alaska, Delaware…"
// pattern where the answer depends on whether the user's profile state
// appears in the enumerated list.
function extractStateListFromQuestion(question: string): string[] {
  const found = new Set<string>();
  const lowerQ = question.toLowerCase();
  for (const name of US_STATE_NAMES) {
    // Word-boundary match; "Washington" should not match inside
    // "Washington D.C." word-boundary handling but the trailing-word check
    // is already wrapped by \b on both sides.
    const re = new RegExp(`\\b${name.replace(/\s+/g, '\\s+')}\\b`, 'i');
    if (re.test(lowerQ)) found.add(name);
  }
  return Array.from(found);
}

function stateAbbreviationFor(state: string): string {
  const key = state.trim().toLowerCase();
  return US_STATE_ABBREVIATIONS[key] ?? '';
}

function isSelectPlaceholderOption(option: string): boolean {
  const trimmed = option.trim();
  if (!trimmed) return true;
  return /^(select|choose|please\s+select|please\s+choose|pick|--|—|\.\.\.|none)/i.test(
    trimmed,
  );
}

function inferFallbackInstitution(profile: ProfileSnapshot): string | null {
  const state = (profile.state ?? '').trim();
  if (state) return `${state} State University`;
  const country = (profile.country ?? '').trim();
  if (country) return `${country} State University`;
  return null;
}

function inferDefaultDegree(): string {
  return "Bachelor's degree";
}

function inferDisciplineFromTitle(title: string | null): string {
  const t = (title ?? '').toLowerCase();
  if (!t) return 'Computer Science';
  if (
    /\b(software|backend|frontend|full[\s-]?stack|web|mobile|android|ios|engineer|developer|swe|sre|devops|platform|infra(structure)?)\b/.test(
      t,
    )
  ) {
    return 'Computer Science';
  }
  if (/\b(data\s+scientist|machine\s+learning|ml|ai\s+engineer|nlp)\b/.test(t)) {
    return 'Computer Science';
  }
  if (/\b(data\s+analyst|business\s+analyst|analytics)\b/.test(t)) {
    return 'Statistics';
  }
  if (/\b(product\s+manager|pm\b|product\s+owner)\b/.test(t)) {
    return 'Business Administration';
  }
  if (/\b(designer|design|ui|ux)\b/.test(t)) {
    return 'Graphic Design';
  }
  if (/\b(marketing|growth|seo|content|brand|copywriter|comms)\b/.test(t)) {
    return 'Marketing';
  }
  if (/\b(sales|account\s+executive|bdr|sdr|biz\s+dev)\b/.test(t)) {
    return 'Business Administration';
  }
  if (/\b(finance|financial|accountant|cpa|treasurer)\b/.test(t)) {
    return 'Finance';
  }
  if (/\b(recruiter|talent|hr\b|human\s+resources|people)\b/.test(t)) {
    return 'Human Resources';
  }
  if (/\b(mechanical\s+engineer|electrical\s+engineer|civil\s+engineer)\b/.test(t)) {
    return 'Engineering';
  }
  return 'Computer Science';
}

function inferEducationYearFromHistory(
  employmentHistory: readonly EmploymentHistoryEntry[],
  which: 'start' | 'end',
): number | null {
  if (employmentHistory.length === 0) return null;
  // Find the earliest startDate across all employment entries.
  let earliestYear: number | null = null;
  for (const entry of employmentHistory) {
    const year = extractYear(entry.startDate);
    if (year === null) continue;
    if (earliestYear === null || year < earliestYear) earliestYear = year;
  }
  if (earliestYear === null) {
    // No parseable employment dates — fall back to a reasonable degree window
    // anchored to the current year (typical undergrad graduates at ~22).
    const currentYear = new Date().getFullYear();
    return which === 'end' ? currentYear - 6 : currentYear - 10;
  }
  return which === 'end' ? earliestYear - 1 : earliestYear - 5;
}

function extractYear(value: string | null): number | null {
  if (!value) return null;
  const match = value.match(/(19|20)\d{2}/);
  if (!match) return null;
  const year = Number.parseInt(match[0], 10);
  if (!Number.isFinite(year) || year < 1950 || year > 2100) return null;
  return year;
}

function isUsBasedAuthorizedProfile(profile: ProfileSnapshot): boolean {
  const country = (profile.country ?? '').trim().toLowerCase();
  const auth = (profile.workAuthorization ?? '').trim().toLowerCase();
  const usCountry =
    country === 'us' ||
    country === 'usa' ||
    country === 'united states' ||
    country === 'united states of america' ||
    country === 'america';
  if (!usCountry) return false;
  if (!auth) return true;
  return (
    auth.includes('citizen') ||
    auth.includes('permanent') ||
    auth.includes('green card') ||
    auth.includes('authorized') ||
    auth === 'yes'
  );
}

function questionTargetsUs(question: string): boolean {
  if (
    /\bunited states\b|\busa\b|\bu\.s\.?a?\b|\bin\s+the\s+us\b|\bthe\s+u\.?s\.?\b/.test(
      question,
    )
  ) {
    return true;
  }
  return !/\bcanada|uk|united kingdom|germany|france|spain|italy|netherlands|australia|new zealand|japan|china|india|mexico|brazil|singapore|hong kong|south korea\b/i.test(
    question,
  );
}

// Match a profile gender ("Male", "Female", "Non-binary or Genderqueer", …)
// against the form's option list.
function pickGenderAnswer(
  profileGender: string,
  options: readonly string[],
): string | null {
  return pickProfileFieldAnswer(profileGender, options, {
    male: ['man', 'm', 'cis male', 'male / man'],
    female: ['woman', 'f', 'cis female', 'female / woman'],
    'non-binary or genderqueer': [
      'non-binary',
      'nonbinary',
      'genderqueer',
      'non binary',
      'enby',
    ],
    'i identify as trans': ['trans', 'transgender'],
    other: ['prefer to self-describe', 'self-describe'],
    'decline to self identify': [
      'decline to answer',
      'prefer not to answer',
      'i do not wish to answer',
      'do not wish to answer',
      'decline',
      'rather not say',
    ],
  });
}

// Generic profile-field → form-option matcher. Match priority:
// - exact (case-insensitive trim)
// - starts-with (profile "Asian" matches "Asian (Not Hispanic or Latino)")
// - synonym list (caller-supplied; lower-case keys + values)
// Returns null when no acceptable match — caller falls back to LLM.
// Find the "decline to self-identify" / "prefer not to answer" option in
// any EEOC / demographic question's option list. Greenhouse, Workable, and
// most ATSes always include one of these variants; pick the first match.
function pickDeclineOption(options: readonly string[]): string | null {
  if (options.length === 0) return null;
  const patterns = [
    /^i\s+(?:do\s+not|don'?t)\s+wish\s+to\s+(?:answer|identify)/i,
    /^i\s+(?:do\s+not|don'?t)\s+want\s+to\s+(?:answer|identify)/i,
    /^prefer\s+not\s+to\s+(?:answer|identify|say)/i,
    /^decline\s+to\s+(?:self.?identif|answer|state)/i,
    /^i\s+decline\s+to\s+/i,
    /^(?:i\s+)?(?:choose|prefer)\s+not\s+to\s+disclose/i,
    /^do\s+not\s+wish\s+to\s+answer/i,
    /^rather\s+not\s+say/i,
    /^prefer\s+not\s+to\s+(?:state|disclose|share)/i,
  ];
  for (const pattern of patterns) {
    const match = options.find(opt => pattern.test(opt.trim()));
    if (match) return match;
  }
  // Looser fallback — option contains "decline" or "prefer not".
  const fallback = options.find(opt => {
    const low = opt.trim().toLowerCase();
    return /\b(decline|prefer\s+not|do\s+not\s+wish|don'?t\s+wish)\b/.test(low);
  });
  return fallback ?? null;
}

function pickProfileFieldAnswer(
  profileValue: string,
  options: readonly string[],
  synonyms: Record<string, readonly string[]>,
): string | null {
  if (options.length === 0) return profileValue;
  const profile = profileValue.trim().toLowerCase();
  const exact = options.find(opt => opt.trim().toLowerCase() === profile);
  if (exact) return exact;
  const startsWith = options.find(opt =>
    opt.trim().toLowerCase().startsWith(profile),
  );
  if (startsWith) return startsWith;
  // Two-way synonym lookup: profile value could be a canonical key
  // (use its synonym list) OR could be a synonym (use the entry's key
  // and sibling synonyms).
  const candidates: string[] = [];
  if (synonyms[profile]) {
    candidates.push(...synonyms[profile]);
  } else {
    for (const [key, syns] of Object.entries(synonyms)) {
      if (syns.includes(profile)) {
        candidates.push(key, ...syns);
        break;
      }
    }
  }
  if (candidates.length > 0) {
    const synMatch = options.find(opt => {
      const text = opt.trim().toLowerCase();
      return candidates.some(syn => text === syn || text.startsWith(syn));
    });
    if (synMatch) return synMatch;
  }
  return null;
}

function pickYesNoAnswer(
  desired: 'yes' | 'no',
  options: readonly string[],
  isSelect: boolean,
): string {
  if (!isSelect || options.length === 0) {
    return desired === 'yes' ? 'Yes' : 'No';
  }
  const wants = desired === 'yes' ? /^y/i : /^n/i;
  const exact = options.find(option => wants.test(option.trim()));
  if (exact) return exact;
  if (desired === 'no') {
    const negative = options.find(option =>
      /\b(?:no|not|never|don['’]t|do not|none)\b/i.test(option),
    );
    if (negative) return negative;
  } else {
    const positive = options.find(option =>
      /\b(?:yes|yeah|sure|yep|i\s+am|i\s+do)\b/i.test(option),
    );
    if (positive) return positive;
  }
  return desired === 'yes' ? 'Yes' : 'No';
}

const PRONOUN_PRESETS_LOWER = new Map<string, string>([
  ['he/him/his', 'he/him/his'],
  ['he/him', 'he/him'],
  ['she/her/hers', 'she/her/hers'],
  ['she/her', 'she/her'],
  ['they/them/theirs', 'they/them/theirs'],
  ['they/them', 'they/them'],
]);

function pickPronounAnswer(
  profilePronouns: string | null,
  options: readonly string[],
): string | null {
  const preset = profilePronouns?.trim() ?? '';
  if (preset && options.length > 0) {
    const direct = matchOptionExact(preset, options);
    if (direct) return direct;
    const isCustom = preset && !PRONOUN_PRESETS_LOWER.has(preset.toLowerCase());
    if (isCustom) {
      const selfDescribe = matchOptionFuzzy('self describe', options);
      if (selfDescribe) return selfDescribe;
      const notListed = matchOptionFuzzy('not listed', options);
      if (notListed) return notListed;
    }
  }
  if (options.length > 0) {
    const fallbacks = [
      'i prefer not to say',
      "don't wish to answer",
      'do not want to answer',
      'decline to self identify',
      'decline',
      'prefer not to answer',
      'self describe',
      'not listed',
    ];
    for (const fallback of fallbacks) {
      const matched = matchOptionFuzzy(fallback, options);
      if (matched) return matched;
    }
    if (!preset) return options[0] ?? null;
  }
  return preset || null;
}

function pickReferralSourceAnswer(
  profileReferralSource: string | null,
  options: readonly string[],
): string | null {
  const preset = profileReferralSource?.trim() ?? '';
  if (preset && options.length > 0) {
    const direct = matchOptionExact(preset, options);
    if (direct) return direct;
    const fuzzy = matchOptionFuzzy(preset, options);
    if (fuzzy) return fuzzy;
  }
  if (options.length > 0) {
    const fallbacks = [
      'other',
      'linkedin',
      'company website',
      'career site',
      'career page',
      "company's career site",
      'glassdoor',
      'indeed',
      'job board',
      'web search',
    ];
    for (const fallback of fallbacks) {
      const matched = matchOptionFuzzy(fallback, options);
      if (matched) return matched;
    }
  }
  return preset || null;
}

function pickYesNoEmploymentAnswer(
  targetCompany: string | null,
  history: readonly EmploymentHistoryEntry[],
  options: readonly string[],
): string | null {
  const target = (targetCompany ?? '').trim().toLowerCase();
  let yes = false;
  if (target) {
    for (const entry of history) {
      const company = entry.company.trim().toLowerCase();
      if (!company) continue;
      if (
        company === target ||
        company.includes(target) ||
        target.includes(company)
      ) {
        yes = true;
        break;
      }
    }
  }
  const desired = yes ? 'yes' : 'no';
  if (options.length === 0) return desired === 'yes' ? 'Yes' : 'No';
  return matchOptionFuzzy(desired, options) ?? (yes ? 'Yes' : 'No');
}

function matchOptionExact(
  value: string,
  options: readonly string[],
): string | null {
  const normalized = value.trim().toLowerCase();
  for (const option of options) {
    if (option.trim().toLowerCase() === normalized) return option;
  }
  return null;
}

function matchOptionFuzzy(
  needle: string,
  options: readonly string[],
): string | null {
  const normalized = needle.trim().toLowerCase();
  if (!normalized) return null;
  for (const option of options) {
    const optionNormalized = option.trim().toLowerCase();
    if (
      optionNormalized === normalized ||
      optionNormalized.includes(normalized) ||
      normalized.includes(optionNormalized)
    ) {
      return option;
    }
  }
  return null;
}

function extractCompanyFromQuestion(
  question: string,
  fallbackCompany: string | null,
): string | null {
  const patterns: readonly RegExp[] = [
    /(?:employed|work(?:ed)?)\s+(?:at|for|by)\s+([A-Z][\w&. -]+?)(?:\s+for\b|\s+as\b|\?|$)/i,
    /(?:former|previous)\s+([A-Z][\w&. -]+?)\s+employee/i,
    /at\s+([A-Z][\w&. -]+?)\s+for\s+any\s+length/i,
  ];
  for (const pattern of patterns) {
    const match = question.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[?.,]+$/, '');
  }
  return fallbackCompany;
}

function mergeExcludedUrls(
  profile: ProfileSnapshot,
  siblingUrls: readonly string[] | undefined,
): readonly string[] {
  const set = new Set<string>();
  for (const url of [
    profile.linkedinUrl,
    profile.githubUrl,
    profile.websiteUrl,
    profile.personalWebsiteUrl,
    ...(siblingUrls ?? []),
  ]) {
    const cleaned = canonicalUrl(url);
    if (cleaned) set.add(cleaned);
  }
  return [...set];
}

function canonicalUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().replace(/[),.;]+$/, '');
  if (!trimmed) return null;
  return trimmed.replace(/\/+$/, '').toLowerCase();
}

// ---------------------------------------------------------------------------
// Prompt + LLM call
// ---------------------------------------------------------------------------

function buildPrompt(input: {
  readonly applicationUrl: string | null;
  readonly employmentHistory: readonly EmploymentHistoryEntry[];
  readonly fewShotExamples: readonly FewShotExample[];
  readonly fieldFeedback: readonly string[];
  readonly fieldType: string;
  readonly jobContext: JobContext | null;
  readonly options: readonly string[];
  readonly profile: ProfileSnapshot;
  readonly question: string;
  readonly resumeContext: ResumeContext;
  readonly siblingUrls: readonly string[];
}): string {
  const optionsBlock = input.options.length
    ? `Available options (you MUST return one of these exactly when provided):
${input.options.map((option, i) => `  ${i + 1}. ${option}`).join('\n')}`
    : 'No predefined options. Return an answer suited to the field type.';

  const jobBlock = input.jobContext
    ? `Job context:
${JSON.stringify(input.jobContext, null, 2)}`
    : 'Job context: (not available — do not invent role, company, or location details)';

  const resumeBlock = `Resume / experience context:
- Professional summary: ${input.resumeContext.summary ?? '(none)'}
- Skills: ${
    input.resumeContext.skills.length
      ? input.resumeContext.skills.join(', ')
      : '(none on file)'
  }
- Resume markdown excerpt:
${input.resumeContext.markdown ?? '(none on file)'}`;

  const employmentBlock = input.employmentHistory.length
    ? `Employment history (companies the user has actually worked at):
${input.employmentHistory
  .map(
    entry =>
      `  - ${entry.company || '(unknown company)'} — ${entry.title || '(unknown title)'} (${entry.startDate ?? '?'} → ${entry.endDate ?? 'present'})`,
  )
  .join('\n')}`
    : 'Employment history: (none on file)';

  const feedbackBlock = input.fieldFeedback.length
    ? `User feedback for THIS field (HIGHEST PRIORITY — follow these even if they conflict with other rules):
${input.fieldFeedback.map(line => `  • ${line}`).join('\n')}`
    : '';

  // Few-shot: prior accepted answers for SIMILAR questions. Treat these as
  // examples of how this specific user prefers to answer — same tone, same
  // option-matching style, same yes/no defaults. Lower priority than
  // explicit feedback for the same field, higher than generic guidance.
  const fewShotBlock = input.fewShotExamples.length
    ? `Examples — past answers this user has given to similar questions (mirror their style and defaults):
${input.fewShotExamples
  .map(
    example =>
      `  • Q: "${example.question}"\n    A: "${example.answer}"`,
  )
  .join('\n')}`
    : '';

  const siblingBlock = input.siblingUrls.length
    ? `URLs already filled in dedicated fields on THIS form (do NOT repeat in link list answers):
${input.siblingUrls.map(url => `  - ${url}`).join('\n')}`
    : 'No sibling URL fields are already filled.';

  return `Field type: ${input.fieldType}
Application URL: ${input.applicationUrl ?? '(unknown)'}

Question / field label:
${input.question}

${optionsBlock}

${jobBlock}

User profile data:
${JSON.stringify(input.profile, null, 2)}

${employmentBlock}

${siblingBlock}

${feedbackBlock}

${fewShotBlock}

${resumeBlock}

Guidance:
- For short / structured fields (yes-no, dropdowns, demographics): pick the right option/value from the profile and return it directly. If options are provided, return the exact option text.
- "Preferred Name" / "Nickname" / "What should we call you" fields: return profile.preferredName when set; otherwise fall back to profile.firstName. Do NOT invent a shortened nickname.
- "Name Pronunciation" fields: return profile.fullName.
- "Other Links" / "Additional Links" / "Other Profiles" / "Anything else we should know" (link list textareas):
  * Return ONLY URLs that do NOT appear in the "URLs already filled in dedicated fields on THIS form" list above.
  * Suggested fallbacks: Twitter, Stack Overflow, Medium, Substack, Bluesky, Mastodon, Dribbble, Behance — only if the profile has them.
  * NEVER include phone numbers or email addresses.
  * NEVER prefix a line with "LinkedIn:", "GitHub:", "Website:", "Portfolio:", "Email:", or "Phone:".
- For long-form prompts ("why do you want to work at X", "hardest problem", "tell us about a project"): write a focused paragraph (3–5 sentences) that:
  * Anchors to the actual job title and company in the job context.
  * Pulls from the user's real skills, professional summary, and resume markdown — pick the most relevant 1–2 examples for the role.
  * Mentions one specific thing about the company or role (only if grounded in the job context — never fabricate).
  * Does NOT mention the user's home city or state as the work location.
  * Does NOT cite a specific number of years of experience unless yearsOfExperience is set in the profile and you reuse that exact value.
  * Avoids generic phrases like "passionate about innovative technology", "dynamic environment", "talented team".
- Confidence: "high" when the profile/resume/job context fully support the answer, "medium" for reasonable inferences, "low" only when there is no relevant signal — return an empty answer in that case.`;
}

async function generateAnswer(input: {
  readonly model: Parameters<typeof generateObject>[0]['model'];
  readonly prompt: string;
  readonly provider: 'openai' | 'ollama';
  readonly system: string;
  readonly isLongForm: boolean;
}): Promise<AnswerObject> {
  // Provider-specific tuning. Two regimes for Ollama:
  //   - Short / structured fields: 4k context, 256-token output, low temp.
  //     Tight + deterministic for yes/no + dropdowns + demographics.
  //   - Long-form (cover-letter prompts, "why do you want to work at X"):
  //     8k context to leave room for the answer alongside the full resume +
  //     job context, ~800-token output cap so essays don't get truncated
  //     mid-sentence, and a slightly higher temperature so the paragraph
  //     reads less robotic.
  // OpenAI uses defaults in both regimes — its tokenizer + ratelimits make
  // these knobs less load-bearing.
  const providerOptions =
    input.provider === 'ollama'
      ? {
          ollama: {
            options: input.isLongForm
              ? {
                  num_ctx: 8192,
                  // 500 tokens ≈ 6-8 sentences. Keeps generation under
                  // the desktop's 45s timeout while still producing a
                  // full paragraph. Was 800 — could exceed the timeout
                  // on slower local rigs.
                  num_predict: 500,
                  temperature: 0.5,
                  top_p: 0.95,
                }
              : {
                  num_ctx: 4096,
                  num_predict: 256,
                  temperature: 0.2,
                  top_p: 0.9,
                },
          },
        }
      : undefined;

  try {
    const { object } = await generateObject({
      model: input.model,
      prompt: input.prompt,
      schema: answerSchema,
      system: input.system,
      providerOptions,
    });
    return object;
  } catch (error) {
    // P17.21 — generateObject routes the schema through
    // ollama-ai-provider-v2 as native `format:<schema>`, so a recent
    // ollama model should produce valid JSON without help. The
    // text-prompt rescue below is a legacy fallback for older models;
    // gate it behind GIMMEJOB_OLLAMA_JSON_RESCUE so a regression on a
    // new model can be unblocked at runtime, but the default path is
    // schema-constrained only.
    if (
      input.provider !== 'ollama' ||
      !isOllamaJsonRescueEnabled()
    ) {
      throw error;
    }
    const { text } = await generateText({
      model: input.model,
      prompt:
        input.prompt +
        '\n\nReturn ONLY a JSON object matching this exact shape, with no prose, no code fences, no commentary:\n' +
        '{"answer": string, "confidence": "high" | "medium" | "low", "reasoning": string}',
      system: input.system,
      providerOptions,
    });
    const parsed = extractAnswerObjectFromText(text);
    if (parsed) return parsed;
    throw error;
  }
}

// Exported for tests. Default off — the modern AI SDK + ollama-ai-provider-v2
// path already constrains output via native format:<schema>, so the rescue
// helper is dead weight in steady state. Set GIMMEJOB_OLLAMA_JSON_RESCUE=1
// to re-enable the legacy text-prompt fallback if a new ollama model
// regresses on schema compliance.
export function isOllamaJsonRescueEnabled(): boolean {
  const raw = process.env.GIMMEJOB_OLLAMA_JSON_RESCUE;
  return raw === '1' || raw === 'true';
}

function extractAnswerObjectFromText(text: string): AnswerObject | null {
  if (!text) return null;
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*$/g, '')
    .replace(/```/g, '')
    .trim();
  const candidates: string[] = [];
  const balanced = extractBalancedJson(stripped);
  if (balanced) candidates.push(balanced);
  if (stripped !== balanced) candidates.push(stripped);
  for (const candidate of candidates) {
    const repaired = candidate.replace(/[“”]/g, '"').replace(/[‘’]/g, "'");
    for (const variant of [repaired, repaired.replace(/'/g, '"')]) {
      try {
        return answerSchema.parse(JSON.parse(variant));
      } catch {
        /* try next */
      }
    }
  }
  return null;
}

function extractBalancedJson(text: string): string | null {
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === '\\') {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function postProcessAnswer(input: {
  readonly answer: string;
  readonly excludedUrls: readonly string[];
  readonly fieldType: string;
  readonly question: string;
}): string {
  const isLinkListField =
    input.fieldType === 'textarea' &&
    /\b(other|additional|more|extra)\s+(links?|profiles?|urls?)\b/i.test(
      input.question,
    );
  if (!isLinkListField) return input.answer;
  const excluded = new Set(input.excludedUrls);
  const lines = input.answer
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);
  const kept: string[] = [];
  for (const line of lines) {
    const urlMatch = line.match(/https?:\/\/\S+/i);
    if (!urlMatch) continue;
    const cleaned = canonicalUrl(urlMatch[0]);
    if (!cleaned) continue;
    if (excluded.has(cleaned)) continue;
    if (/^(linkedin|github|website|email|phone|portfolio)\s*[:\-]/i.test(line))
      continue;
    kept.push(line);
    excluded.add(cleaned);
  }
  return kept.join('\n');
}

// ---------------------------------------------------------------------------
// Gender inference (mirrors desktop helper)
// ---------------------------------------------------------------------------

const STRONG_MALE_FIRST_NAMES = new Set([
  'aaron', 'adam', 'adrian', 'alan', 'albert', 'alex', 'alexander', 'andrew',
  'andy', 'anthony', 'arthur', 'austin', 'barry', 'ben', 'benjamin', 'bill',
  'billy', 'bob', 'bobby', 'brandon', 'brent', 'brett', 'brian', 'bruce',
  'bryan', 'caleb', 'cameron', 'carl', 'chad', 'charles', 'charlie', 'chris',
  'christian', 'christopher', 'clark', 'cody', 'colin', 'connor', 'craig',
  'curtis', 'cyrus', 'daniel', 'darren', 'david', 'dean', 'dennis', 'derek',
  'derrick', 'devin', 'dominic', 'don', 'donald', 'douglas', 'duane', 'dustin',
  'dwayne', 'dylan', 'earl', 'eddie', 'edgar', 'edward', 'edwin', 'elliot',
  'eric', 'ernest', 'ethan', 'eugene', 'evan', 'felix', 'francisco', 'frank',
  'fred', 'gabriel', 'gary', 'george', 'gerald', 'glen', 'glenn', 'gordon',
  'grant', 'greg', 'gregory', 'harold', 'harry', 'henry', 'herbert', 'howard',
  'hunter', 'ian', 'isaac', 'jack', 'jackson', 'jacob', 'jake', 'james',
  'jamie', 'jared', 'jason', 'jay', 'jeff', 'jeffrey', 'jeremy', 'jerome',
  'jerry', 'jesse', 'jim', 'jimmy', 'joe', 'joel', 'john', 'johnny', 'jon',
  'jonathan', 'jordan', 'jose', 'joseph', 'josh', 'joshua', 'juan', 'julian',
  'justin', 'keith', 'kelvin', 'ken', 'kenneth', 'kenny', 'kevin', 'kirk',
  'kurt', 'kyle', 'lance', 'larry', 'lawrence', 'lee', 'leo', 'leonard',
  'leroy', 'lewis', 'liam', 'logan', 'louis', 'lucas', 'luis', 'luke',
  'malcolm', 'marc', 'marcus', 'mario', 'mark', 'martin', 'marvin', 'matt',
  'matthew', 'maurice', 'max', 'michael', 'mike', 'miles', 'mitchell',
  'morgan', 'nathan', 'neil', 'nicholas', 'nick', 'noah', 'norman', 'oliver',
  'oscar', 'owen', 'patrick', 'paul', 'pedro', 'peter', 'philip', 'phillip',
  'preston', 'quincy', 'quentin', 'ralph', 'randy', 'raymond', 'reginald',
  'rich', 'richard', 'rick', 'ricky', 'robert', 'rodney', 'roger', 'ronald',
  'ronnie', 'roy', 'russell', 'ryan', 'sam', 'samuel', 'scott', 'sean',
  'sergio', 'seth', 'shane', 'shaun', 'shawn', 'sidney', 'simon', 'spencer',
  'stanley', 'stephen', 'steve', 'steven', 'stuart', 'terrence', 'terry',
  'theodore', 'thomas', 'tim', 'timothy', 'todd', 'tom', 'tommy', 'tony',
  'travis', 'trevor', 'troy', 'tyler', 'tyrone', 'victor', 'vincent', 'wade',
  'walter', 'warren', 'wayne', 'wesley', 'william', 'willie', 'zachary', 'zack',
]);

const STRONG_FEMALE_FIRST_NAMES = new Set([
  'abigail', 'addison', 'adrienne', 'aileen', 'alice', 'alicia', 'alison',
  'allison', 'amanda', 'amber', 'amy', 'andrea', 'angela', 'angelica',
  'angie', 'anita', 'ann', 'anna', 'anne', 'annette', 'april', 'audrey',
  'autumn', 'ava', 'barbara', 'becky', 'beth', 'bethany', 'betty', 'beverly',
  'bonnie', 'brenda', 'bridget', 'brittany', 'brooke', 'caitlin', 'camille',
  'candace', 'cara', 'carla', 'carmen', 'carol', 'caroline', 'carolyn',
  'carrie', 'cassandra', 'catherine', 'cathy', 'charlotte', 'cheryl',
  'chloe', 'christina', 'christine', 'christy', 'cindy', 'claire', 'claudia',
  'colleen', 'connie', 'courtney', 'crystal', 'cynthia', 'dana', 'danielle',
  'dawn', 'deanna', 'deborah', 'debra', 'denise', 'destiny', 'diana', 'diane',
  'donna', 'dora', 'doris', 'dorothy', 'edith', 'eileen', 'elaine', 'eleanor',
  'elena', 'elizabeth', 'ellen', 'emily', 'emma', 'erica', 'erika', 'erin',
  'esther', 'eva', 'evelyn', 'faith', 'felicia', 'fiona', 'frances', 'gabriela',
  'gabrielle', 'gail', 'gina', 'gloria', 'grace', 'gwendolyn', 'hailey',
  'hannah', 'harriet', 'hazel', 'heather', 'heidi', 'helen', 'holly', 'irene',
  'isabella', 'jacqueline', 'jane', 'janet', 'janice', 'jasmine', 'jean',
  'jeanette', 'jenna', 'jennifer', 'jessica', 'jill', 'joan', 'joanna',
  'joanne', 'jodi', 'jordan', 'josephine', 'joy', 'joyce', 'judith', 'judy',
  'julia', 'julie', 'june', 'karen', 'kate', 'katelyn', 'katherine', 'kathleen',
  'kathryn', 'kathy', 'katie', 'kayla', 'kelly', 'kelsey', 'kim', 'kimberly',
  'kristen', 'kristin', 'kristina', 'krystal', 'laura', 'lauren', 'leah',
  'lillian', 'linda', 'lindsay', 'lindsey', 'lisa', 'lori', 'louise', 'lucy',
  'lydia', 'mabel', 'madeline', 'madison', 'maggie', 'margaret', 'maria',
  'marie', 'marilyn', 'marlene', 'martha', 'mary', 'maureen', 'megan',
  'melanie', 'melinda', 'melissa', 'meredith', 'mia', 'michelle', 'mildred',
  'molly', 'monica', 'nancy', 'naomi', 'natalie', 'natasha', 'nicole',
  'norma', 'olivia', 'pamela', 'patricia', 'paula', 'pearl', 'peggy', 'phyllis',
  'priscilla', 'rachel', 'rebecca', 'regina', 'renee', 'rhonda', 'rita',
  'roberta', 'robin', 'rose', 'rosemary', 'ruth', 'sabrina', 'sally',
  'samantha', 'sandra', 'sara', 'sarah', 'savannah', 'sharon', 'sheila',
  'shelby', 'shelley', 'sheri', 'sherri', 'sherry', 'shirley', 'sofia',
  'sonia', 'sophia', 'stacey', 'stacy', 'stephanie', 'sue', 'susan',
  'suzanne', 'sylvia', 'tamara', 'tammy', 'tara', 'tasha', 'teresa', 'terri',
  'theresa', 'tiffany', 'tina', 'tracey', 'tracy', 'trisha', 'valerie',
  'vanessa', 'veronica', 'vicki', 'victoria', 'violet', 'virginia', 'wanda',
  'wendy', 'whitney', 'yolanda', 'yvonne', 'zoe', 'zoey',
]);

function inferGenderFromFirstName(
  firstName: string | null,
): 'Male' | 'Female' | null {
  if (!firstName) return null;
  const normalized = firstName.trim().toLowerCase().split(/[\s-]/)[0];
  if (!normalized) return null;
  if (STRONG_MALE_FIRST_NAMES.has(normalized)) return 'Male';
  if (STRONG_FEMALE_FIRST_NAMES.has(normalized)) return 'Female';
  return null;
}
