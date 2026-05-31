import { generateAIText } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { db } from '@/lib/db/client';
import {
  findWhyThisCompanyTemplate,
  parseWhyThisCompanyTemplates,
} from '@/prisma/seed/user-knowledge';

const COVER_LETTER_STYLE_KEY = 'coverLetterStyle';
const WHY_THIS_COMPANY_KEY = 'whyThisCompany';

export type GenerateCoverLetterMissingContext =
  | 'cover_letter_style'
  | 'why_this_company'
  | 'job_description'
  | 'resume';

export interface GenerateCoverLetterForLeadResult {
  readonly coverLetterId: string | null;
  readonly markdown: string | null;
  readonly missingContext: readonly GenerateCoverLetterMissingContext[];
  readonly skipped: boolean;
  readonly skippedReason?: string;
}

export interface GenerateCoverLetterForLeadOptions {
  readonly aiProvider?: AiProvider;
  /**
   * If true, generate even when context is incomplete and report what was
   * missing. If false (default), skip generation when required context
   * (resume, job description, or voice samples) is missing.
   */
  readonly generateWithIncompleteContext?: boolean;
}

export async function generateCoverLetterForLead(
  leadId: string,
  options: GenerateCoverLetterForLeadOptions = {},
): Promise<GenerateCoverLetterForLeadResult> {
  const lead = await db.jobLead.findUnique({
    where: { id: leadId },
    select: {
      id: true,
      userId: true,
      jobListing: {
        select: {
          title: true,
          company: true,
          description: true,
        },
      },
    },
  });

  if (!lead) {
    throw new Error(`Job lead not found: ${leadId}`);
  }

  const missingContext: GenerateCoverLetterMissingContext[] = [];

  const description = lead.jobListing.description?.trim() ?? '';
  if (!description) missingContext.push('job_description');

  const resume = await loadDefaultResumeText(lead.userId);
  if (!resume) missingContext.push('resume');

  const company = lead.jobListing.company?.trim() ?? '';
  const knowledge = await loadCoverLetterKnowledge({
    userId: lead.userId,
    company,
    jobDescription: description,
  });
  if (!knowledge.style) missingContext.push('cover_letter_style');
  if (!knowledge.whyThisCompany) missingContext.push('why_this_company');

  const blockingMissing = missingContext.filter(
    item =>
      item === 'job_description' ||
      item === 'resume' ||
      item === 'cover_letter_style',
  );

  if (
    blockingMissing.length > 0 &&
    !options.generateWithIncompleteContext
  ) {
    return {
      coverLetterId: null,
      markdown: null,
      missingContext,
      skipped: true,
      skippedReason: `Missing required context: ${blockingMissing.join(', ')}`,
    };
  }

  const prompt = buildCoverLetterPrompt({
    company,
    jobDescription: description,
    resume: resume ?? '',
    style: knowledge.style ?? '',
    title: lead.jobListing.title,
    whyThisCompany: knowledge.whyThisCompany ?? '',
  });

  const markdown = (
    await generateAIText(prompt, {
      aiProvider: options.aiProvider,
      system:
        'You are an expert career coach writing a one-page cover letter in Markdown. Output only the cover letter body — no preamble, no commentary, no triple-backtick fence.',
      temperature: 0.6,
    })
  ).trim();

  const created = await db.coverLetter.create({
    data: {
      leadId: lead.id,
      markdown,
      name: `${company || 'Untitled'} — ${lead.jobListing.title}`,
      userId: lead.userId,
    },
    select: { id: true },
  });

  await db.jobLead.update({
    where: { id: lead.id },
    data: { tailoredCoverLetterId: created.id },
  });

  return {
    coverLetterId: created.id,
    markdown,
    missingContext,
    skipped: false,
  };
}

async function loadDefaultResumeText(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { defaultResumeId: true, defaultRevisionId: true },
  });
  if (!user?.defaultResumeId) return null;

  if (user.defaultRevisionId) {
    const revision = await db.resumeRevision.findUnique({
      where: { id: user.defaultRevisionId },
      select: { markdown: true, json: true },
    });
    if (revision?.markdown?.trim()) return revision.markdown;
    if (revision?.json) return JSON.stringify(revision.json);
  }

  const resume = await db.resume.findUnique({
    where: { id: user.defaultResumeId },
    select: { markdown: true, json: true },
  });
  if (resume?.markdown?.trim()) return resume.markdown;
  if (resume?.json) return JSON.stringify(resume.json);

  return null;
}

async function loadCoverLetterKnowledge(input: {
  readonly userId: string;
  readonly company: string;
  readonly jobDescription: string;
}): Promise<{ style: string | null; whyThisCompany: string | null }> {
  const rows = await db.userKnowledge.findMany({
    where: {
      userId: input.userId,
      key: { in: [COVER_LETTER_STYLE_KEY, WHY_THIS_COMPANY_KEY] },
    },
    select: { key: true, value: true },
  });

  const styleRow = rows.find(row => row.key === COVER_LETTER_STYLE_KEY);
  const whyRow = rows.find(row => row.key === WHY_THIS_COMPANY_KEY);

  let whyThisCompany: string | null = null;
  if (whyRow?.value) {
    const templates = parseWhyThisCompanyTemplates(whyRow.value);
    if (templates.length > 0) {
      const matched = findWhyThisCompanyTemplate(templates, input.jobDescription);
      whyThisCompany = matched.template.replace(/\{company\}/g, input.company || matched.label);
    }
  }

  return {
    style: styleRow?.value?.trim() || null,
    whyThisCompany,
  };
}

function buildCoverLetterPrompt(input: {
  readonly company: string;
  readonly jobDescription: string;
  readonly resume: string;
  readonly style: string;
  readonly title: string;
  readonly whyThisCompany: string;
}): string {
  const styleSection = input.style
    ? `VOICE / STYLE SAMPLES (match this tone and rhythm):\n${input.style}`
    : 'VOICE / STYLE SAMPLES: (none provided — use a clear, professional, lightly conversational tone)';

  const whySection = input.whyThisCompany
    ? `WHY THIS COMPANY (use as the second paragraph):\n${input.whyThisCompany}`
    : 'WHY THIS COMPANY: (no notes provided — derive a plausible motivation from the job description)';

  return `Write a one-page cover letter in Markdown for the role below. Three to four short paragraphs. Open with a sharp first line that names the role. Second paragraph covers why this company. Third paragraph maps the candidate's most relevant experience to the top 2-3 requirements in the job description. Close with a brief, confident ask for a conversation.

Do not invent experience or credentials that are not in the resume. Do not use the words "passionate", "synergy", "leverage", or "rockstar".

ROLE: ${input.title}
COMPANY: ${input.company}

JOB DESCRIPTION:
${truncate(input.jobDescription, 4_000)}

CANDIDATE RESUME (markdown or JSON):
${truncate(input.resume, 4_000)}

${styleSection}

${whySection}`;
}

function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}\n…[truncated]`;
}
