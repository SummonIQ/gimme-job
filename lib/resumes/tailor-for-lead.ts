import { put } from '@vercel/blob';
import { generateText, Output } from 'ai';
import { z } from 'zod';

import { type Prisma } from '@/generated/prisma/client';
import { getModels, type AiProvider } from '@/lib/ai/models';
import { db } from '@/lib/db/client';
import { convertMarkdownToPdf } from '@/lib/files/convert/markdown-to-pdf';
import { convertMarkdownToWord } from '@/lib/files/convert/markdown-to-word';

const tailoredResumeRewriteSchema = z.object({
  markdown: z.string().min(1),
  summary: z.string().min(1),
  emphasizedKeywords: z.array(z.string().min(1)).min(1),
  diffSummary: z
    .array(
      z.object({
        section: z.string().min(1),
        before: z.string().optional(),
        after: z.string().min(1),
        reason: z.string().min(1),
        keywords: z.array(z.string().min(1)),
      }),
    )
    .min(1),
});

export type TailoredResumeRewrite = z.infer<typeof tailoredResumeRewriteSchema>;

export interface TailoredResumeFormats {
  pdf: string;
  docx: string;
  txt: string;
  html: string;
}

export interface TailorResumePromptInput {
  baseResumeMarkdown: string;
  company: string | null;
  jobDescription: string;
  jobTitle: string;
  userProfile?: unknown;
}

export interface RenderTailoredResumeFormatsInput {
  leadId: string;
  markdown: string;
  resumeId: string;
  title: string;
  userId: string;
}

export interface RenderTailoredResumeFormatsOptions {
  convertToDocx?: (
    markdown: string,
  ) => Promise<Buffer | Uint8Array | ArrayBuffer>;
  upload?: (input: UploadDocumentInput) => Promise<string>;
}

export interface TailorResumeForLeadResult {
  diffSummary: TailoredResumeRewrite['diffSummary'];
  emphasizedKeywords: string[];
  formats: TailoredResumeFormats;
  revisionId: string;
  summary: string;
}

interface BaseResume {
  markdown: string;
  name: string;
  resumeId: string;
  revisionId: string | null;
}

interface TailorResumeForLeadOptions {
  renderFormats?: (
    input: RenderTailoredResumeFormatsInput,
  ) => Promise<TailoredResumeFormats>;
  rewriteResume?: (
    input: TailorResumePromptInput,
  ) => Promise<TailoredResumeRewrite>;
}

interface UploadDocumentInput {
  body: Buffer | Uint8Array | ArrayBuffer;
  contentType: string;
  extension: 'docx' | 'pdf';
  leadId: string;
  resumeId: string;
  title: string;
  userId: string;
}

export function buildTailoredResumePrompt({
  baseResumeMarkdown,
  company,
  jobDescription,
  jobTitle,
  userProfile,
}: TailorResumePromptInput): string {
  const profileBlock = userProfile
    ? `\nUser profile context:\n${JSON.stringify(userProfile, null, 2)}\n`
    : '';

  return `
Rewrite the base resume for the target job while preserving the candidate's truthful experience.

Target job:
Title: ${jobTitle}
Company: ${company ?? 'Unknown'}
${jobDescription}
${profileBlock}
Base resume markdown:
${baseResumeMarkdown}

Return structured data only.

Rules:
1. Preserve every role, project, education entry, and original achievement unless it is clearly duplicated.
2. Emphasize skills and keywords that appear in the job description and already fit the base resume.
3. Do not invent employers, dates, degrees, certifications, metrics, tools, or work authorization.
4. Keep the resume in valid Markdown with headings and bullet lists.
5. Include the emphasized job keywords in emphasizedKeywords.
6. Include a reviewer-facing diffSummary that explains each meaningful change, the affected section, and which job keywords drove it.
7. The markdown field must contain only the finished tailored resume.
`;
}

export async function rewriteResumeForLead(
  input: TailorResumePromptInput,
  options: { readonly aiProvider?: AiProvider } = {},
): Promise<TailoredResumeRewrite> {
  const { output } = await generateText({
    model: getModels(options.aiProvider).fast,
    output: Output.object({
      name: 'TailoredResumeRewrite',
      schema: tailoredResumeRewriteSchema,
    }),
    prompt: buildTailoredResumePrompt(input),
    system:
      'You are an expert resume writer who creates truthful ATS-ready resumes from supplied source material.',
  });

  return output;
}

export async function renderTailoredResumeFormats(
  {
    leadId,
    markdown,
    resumeId,
    title,
    userId,
  }: RenderTailoredResumeFormatsInput,
  options: RenderTailoredResumeFormatsOptions = {},
): Promise<TailoredResumeFormats> {
  const txt = renderMarkdownToText(markdown);
  const html = renderMarkdownToHtml(markdown);
  const convertToDocx = options.convertToDocx ?? convertMarkdownToWord;
  const upload = options.upload ?? uploadDocument;
  const [docxBuffer, pdfBuffer] = await Promise.all([
    convertToDocx(markdown),
    convertMarkdownToPdf(markdown),
  ]);
  const [docx, pdf] = await Promise.all([
    upload({
      body: docxBuffer,
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      extension: 'docx',
      leadId,
      resumeId,
      title,
      userId,
    }),
    upload({
      body: pdfBuffer,
      contentType: 'application/pdf',
      extension: 'pdf',
      leadId,
      resumeId,
      title,
      userId,
    }),
  ]);

  return { docx, html, pdf, txt };
}

export async function tailorResumeForLead(
  leadId: string,
  options: TailorResumeForLeadOptions = {},
): Promise<TailorResumeForLeadResult> {
  const jobLead = await db.jobLead.findUnique({
    include: {
      jobListing: true,
      user: { include: { profile: true } },
    },
    where: { id: leadId },
  });

  if (!jobLead) {
    throw new Error(`Job lead ${leadId} was not found`);
  }

  const { jobListing, user } = jobLead;
  const baseResume = await resolveBaseResume({
    preferredResumeId: user.defaultResumeId,
    preferredRevisionId: user.defaultRevisionId,
    userId: user.id,
  });
  const jobDescription = formatJobListingForPrompt(jobListing);
  const rewriteResume = options.rewriteResume ?? rewriteResumeForLead;
  const renderFormats = options.renderFormats ?? renderTailoredResumeFormats;
  const rewrite = await rewriteResume({
    baseResumeMarkdown: baseResume.markdown,
    company: jobListing.company,
    jobDescription,
    jobTitle: jobListing.title,
    userProfile: user.profile,
  });
  const formats = await renderFormats({
    leadId: jobLead.id,
    markdown: rewrite.markdown,
    resumeId: baseResume.resumeId,
    title: jobLead.title,
    userId: user.id,
  });
  const revisionJson = buildRevisionJson({
    baseRevisionId: baseResume.revisionId,
    diffSummary: rewrite.diffSummary,
    emphasizedKeywords: rewrite.emphasizedKeywords,
    jobLeadId: jobLead.id,
    jobListingId: jobListing.id,
    resumeId: baseResume.resumeId,
    summary: rewrite.summary,
  });

  const revision = await db.$transaction(async tx => {
    const createdRevision = await tx.resumeRevision.create({
      data: {
        description: rewrite.summary,
        formats: formats as unknown as Prisma.InputJsonObject,
        json: revisionJson,
        markdown: rewrite.markdown,
        name: `${jobListing.title} - ${baseResume.name} tailored`,
        pdfDocumentUrl: formats.pdf,
        resume: { connect: { id: baseResume.resumeId } },
        user: { connect: { id: user.id } },
        wordDocumentUrl: formats.docx,
      },
    });

    await tx.jobLead.update({
      data: { tailoredResumeRevisionId: createdRevision.id },
      where: { id: jobLead.id },
    });

    return createdRevision;
  });

  return {
    diffSummary: rewrite.diffSummary,
    emphasizedKeywords: rewrite.emphasizedKeywords,
    formats,
    revisionId: revision.id,
    summary: rewrite.summary,
  };
}

async function resolveBaseResume({
  preferredResumeId,
  preferredRevisionId,
  userId,
}: {
  preferredResumeId: string | null;
  preferredRevisionId: string | null;
  userId: string;
}): Promise<BaseResume> {
  const resume =
    (await findResumeById({ resumeId: preferredResumeId, userId })) ??
    (await db.resume.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: {
        defaultRevisionId: true,
        id: true,
        markdown: true,
        name: true,
      },
      where: { userId },
    }));

  if (!resume) {
    throw new Error(`User ${userId} does not have a resume to tailor`);
  }

  const revisionId = preferredRevisionId ?? resume.defaultRevisionId;
  const revision =
    (await findRevisionById({
      resumeId: resume.id,
      revisionId,
      userId,
    })) ??
    (await db.resumeRevision.findFirst({
      orderBy: { updatedAt: 'desc' },
      select: { id: true, markdown: true },
      where: { resumeId: resume.id, userId },
    }));
  const markdown = revision?.markdown ?? resume.markdown;

  if (!markdown?.trim()) {
    throw new Error(`Resume ${resume.id} does not have markdown to tailor`);
  }

  return {
    markdown,
    name: resume.name,
    resumeId: resume.id,
    revisionId: revision?.id ?? null,
  };
}

async function findResumeById({
  resumeId,
  userId,
}: {
  resumeId: string | null;
  userId: string;
}) {
  if (!resumeId) {
    return null;
  }

  return db.resume.findFirst({
    select: {
      defaultRevisionId: true,
      id: true,
      markdown: true,
      name: true,
    },
    where: { id: resumeId, userId },
  });
}

async function findRevisionById({
  resumeId,
  revisionId,
  userId,
}: {
  resumeId: string;
  revisionId: string | null;
  userId: string;
}) {
  if (!revisionId) {
    return null;
  }

  return db.resumeRevision.findFirst({
    select: { id: true, markdown: true },
    where: { id: revisionId, resumeId, userId },
  });
}

function formatJobListingForPrompt({
  company,
  description,
  location,
  qualifications,
  requirements,
  responsibilities,
  salary,
  title,
}: {
  company: string | null;
  description: string | null;
  location: string | null;
  qualifications: string[];
  requirements: string[];
  responsibilities: string[];
  salary: string | null;
  title: string;
}): string {
  return [
    `Title: ${title}`,
    company ? `Company: ${company}` : null,
    location ? `Location: ${location}` : null,
    salary ? `Salary: ${salary}` : null,
    description ? `Description:\n${description}` : null,
    formatList('Requirements', requirements),
    formatList('Responsibilities', responsibilities),
    formatList('Qualifications', qualifications),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join('\n\n');
}

function formatList(label: string, values: string[]): string | null {
  const items = values.filter(value => value.trim());

  if (items.length === 0) {
    return null;
  }

  return `${label}:\n${items.map(value => `- ${value}`).join('\n')}`;
}

function buildRevisionJson({
  baseRevisionId,
  diffSummary,
  emphasizedKeywords,
  jobLeadId,
  jobListingId,
  resumeId,
  summary,
}: {
  baseRevisionId: string | null;
  diffSummary: TailoredResumeRewrite['diffSummary'];
  emphasizedKeywords: string[];
  jobLeadId: string;
  jobListingId: string;
  resumeId: string;
  summary: string;
}): Prisma.InputJsonObject {
  return {
    diffSummary: diffSummary.map(item => ({
      after: item.after,
      before: item.before ?? null,
      keywords: item.keywords,
      reason: item.reason,
      section: item.section,
    })),
    emphasizedKeywords,
    kind: 'TAILORED_RESUME_FOR_LEAD',
    source: {
      baseRevisionId,
      jobLeadId,
      jobListingId,
      resumeId,
    },
    summary,
  };
}

function renderMarkdownToText(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[*-]\s+/gm, '- ')
    .replace(/[`*_>]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function renderMarkdownToHtml(markdown: string): string {
  const blocks: string[] = [];
  let listItems: string[] = [];
  const flushList = () => {
    if (listItems.length === 0) {
      return;
    }

    blocks.push(`<ul>${listItems.join('')}</ul>`);
    listItems = [];
  };

  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      flushList();
      continue;
    }

    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      flushList();
      const level = heading[1].length;
      blocks.push(`<h${level}>${escapeHtml(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = /^[-*]\s+(.+)$/.exec(line);
    if (bullet) {
      listItems.push(`<li>${escapeHtml(bullet[1])}</li>`);
      continue;
    }

    flushList();
    blocks.push(`<p>${escapeHtml(line)}</p>`);
  }

  flushList();

  return `<!doctype html><html><body>${blocks.join('\n')}</body></html>`;
}

async function uploadDocument({
  body,
  contentType,
  extension,
  leadId,
  resumeId,
  title,
  userId,
}: UploadDocumentInput): Promise<string> {
  const timestamp = Date.now();
  const path = `/users/${userId}/${resumeId}-${leadId}-${slugify(title)}-${timestamp}.${extension}`;
  const normalizedBody = toBuffer(body);
  const { url } = await put(path, normalizedBody, {
    access: 'public',
    contentType,
  });

  return url;
}

function toBuffer(body: Buffer | Uint8Array | ArrayBuffer): Buffer {
  if (Buffer.isBuffer(body)) {
    return body;
  }

  if (body instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(body));
  }

  return Buffer.from(body);
}

function slugify(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'tailored-resume';
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
