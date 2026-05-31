import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  ResumeAnalysisStatus,
  ResumeOptimizationStatus,
  type Prisma,
} from '@/generated/prisma/client';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import {
  convertPdfToMarkdown,
  convertWordDocumentToMarkdown,
} from '@/lib/files/convert';
import { normalizeResumeMarkdown } from '@/lib/resumes/normalize-markdown';
import {
  renderTailoredResumeFormats,
  rewriteResumeForLead,
} from '@/lib/resumes/tailor-for-lead';
import { scoreResume } from '@/lib/resumes/score/deterministic';
import { getCurrentUser } from '@/lib/user/query';

const requestSchema = z
  .object({
    company: z.string().optional(),
    jobDescription: z
      .string()
      .trim()
      .min(20, 'Job description must be at least 20 characters.'),
    jobTitle: z.string().optional(),
    resumeId: z.string().optional(),
    resumeName: z.string().optional(),
    resumeUrl: z.string().url().optional(),
  })
  .refine(input => Boolean(input.resumeId || input.resumeUrl), {
    message: 'Select an existing resume or upload a resume.',
    path: ['resumeUrl'],
  });

interface BaseResumeInput {
  markdown: string;
  name: string;
  source: 'existing_resume' | 'uploaded_resume';
  url: string | null;
}

export async function POST(request: Request) {
  const user = await getCurrentUser({ include: { profile: true } });
  if (!user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof requestSchema>;
  try {
    body = requestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        details: error instanceof z.ZodError ? error.flatten() : undefined,
        error: 'Invalid optimizer request',
      },
      { status: 400 },
    );
  }

  try {
    const baseResume = await resolveBaseResume({
      resumeId: cleanOptional(body.resumeId),
      resumeName: cleanOptional(body.resumeName),
      resumeUrl: cleanOptional(body.resumeUrl),
      userId: user.id,
    });
    const jobTitle = cleanOptional(body.jobTitle) ?? 'Pasted job description';
    const company = cleanOptional(body.company) ?? null;
    const rewrite = await rewriteResumeForLead({
      baseResumeMarkdown: baseResume.markdown,
      company,
      jobDescription: body.jobDescription,
      jobTitle,
      userProfile: user.profile,
    });
    const optimizedMarkdown = normalizeResumeMarkdown(rewrite.markdown);
    const formats = await renderTailoredResumeFormats({
      leadId: 'job-details-optimizer',
      markdown: optimizedMarkdown,
      resumeId: 'manual',
      title: jobTitle,
      userId: user.id,
    });
    const baselineScore = scoreResume(baseResume.markdown);
    const optimizedScore = scoreResume(optimizedMarkdown);
    const scoreDelta = optimizedScore.total - baselineScore.total;
    const scorePercentChange =
      baselineScore.total > 0
        ? Math.round((scoreDelta / baselineScore.total) * 100)
        : 0;
    const historyName = buildHistoryName({
      baseName: baseResume.name,
      company,
      jobTitle,
    });
    const revisionJson = buildRevisionJson({
      company,
      diffSummary: rewrite.diffSummary,
      emphasizedKeywords: rewrite.emphasizedKeywords,
      jobDescription: body.jobDescription,
      jobTitle,
      source: baseResume.source,
      summary: rewrite.summary,
    });

    const created = await db.$transaction(async tx => {
      const resume = await tx.resume.create({
        data: {
          description:
            'Job Details Optimizer history entry. This resume was not set as the default.',
          markdown: baseResume.markdown,
          name: historyName,
          url: baseResume.url,
          user: { connect: { id: user.id } },
        },
      });
      const revision = await tx.resumeRevision.create({
        data: {
          description: rewrite.summary,
          formats: formats as unknown as Prisma.InputJsonValue,
          json: revisionJson,
          markdown: optimizedMarkdown,
          name: `${historyName} - Optimized`,
          pdfDocumentUrl: formats.pdf,
          resume: { connect: { id: resume.id } },
          user: { connect: { id: user.id } },
          wordDocumentUrl: formats.docx,
        },
      });
      const analysis = await tx.resumeAnalysis.create({
        data: {
          progress: 100,
          resume: { connect: { id: resume.id } },
          score: baselineScore.total,
          status: ResumeAnalysisStatus.COMPLETED,
          summary: 'Baseline score from the uploaded resume before tailoring.',
          user: { connect: { id: user.id } },
        },
      });

      await tx.resumeOptimization.create({
        data: {
          analysis: { connect: { id: analysis.id } },
          changelog: rewrite.diffSummary as unknown as Prisma.InputJsonValue,
          optimizationStrategy:
            'Tailored to the job description pasted into Job Details Optimizer.',
          previousScore: baselineScore.total,
          progress: 100,
          resume: { connect: { id: resume.id } },
          resumeRevision: { connect: { id: revision.id } },
          score: optimizedScore.total,
          scoreImprovement: scoreDelta,
          scorePercentChange,
          significantImprovements: rewrite.diffSummary
            .map(item => item.reason)
            .slice(0, 8),
          status: ResumeOptimizationStatus.COMPLETED,
          summary: rewrite.summary,
          user: { connect: { id: user.id } },
        },
      });

      return { resumeId: resume.id, revisionId: revision.id };
    });

    await Promise.all([
      revalidateTag(`user:${user.id}:report:resumes`),
      revalidateTag(`user:${user.id}:resumes`),
      revalidateTag(`user:${user.id}:resumes:${created.resumeId}`),
    ]);

    return NextResponse.json({
      diffSummary: rewrite.diffSummary,
      emphasizedKeywords: rewrite.emphasizedKeywords,
      formats,
      historyUrl: `/profile/resumes/${created.resumeId}?tab=optimized-resume`,
      markdown: optimizedMarkdown,
      resumeId: created.resumeId,
      revisionId: created.revisionId,
      score: {
        after: optimizedScore.total,
        before: baselineScore.total,
        delta: scoreDelta,
        percentChange: scorePercentChange,
      },
      summary: rewrite.summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        details: error instanceof Error ? error.message : String(error),
        error: 'Failed to optimize resume',
      },
      { status: 500 },
    );
  }
}

async function resolveBaseResume({
  resumeId,
  resumeName,
  resumeUrl,
  userId,
}: {
  resumeId?: string;
  resumeName?: string;
  resumeUrl?: string;
  userId: string;
}): Promise<BaseResumeInput> {
  if (resumeUrl) {
    return {
      markdown: await extractResumeMarkdownFromUrl(resumeUrl),
      name: resumeName ?? 'Uploaded resume',
      source: 'uploaded_resume',
      url: resumeUrl,
    };
  }

  if (!resumeId) {
    throw new Error('Select an existing resume or upload a resume.');
  }

  const resume = await db.resume.findFirst({
    select: {
      defaultRevisionId: true,
      id: true,
      markdown: true,
      name: true,
      url: true,
    },
    where: { id: resumeId, userId },
  });

  if (!resume) {
    throw new Error('Resume not found.');
  }

  const defaultRevision = resume.defaultRevisionId
    ? await db.resumeRevision.findFirst({
        select: { markdown: true },
        where: {
          id: resume.defaultRevisionId,
          resumeId: resume.id,
          userId,
        },
      })
    : null;
  const latestRevision = defaultRevision
    ? null
    : await db.resumeRevision.findFirst({
        orderBy: { updatedAt: 'desc' },
        select: { markdown: true },
        where: { resumeId: resume.id, userId },
      });
  const markdown =
    defaultRevision?.markdown ?? resume.markdown ?? latestRevision?.markdown;

  if (markdown?.trim()) {
    return {
      markdown: normalizeResumeMarkdown(markdown),
      name: resumeName ?? resume.name,
      source: 'existing_resume',
      url: resume.url,
    };
  }

  if (resume.url) {
    return {
      markdown: await extractResumeMarkdownFromUrl(resume.url),
      name: resumeName ?? resume.name,
      source: 'existing_resume',
      url: resume.url,
    };
  }

  throw new Error('Resume text is not available yet.');
}

async function extractResumeMarkdownFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Could not fetch resume file (${response.status}).`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  const urlLower = url.toLowerCase();
  const header = buffer.subarray(0, 8);
  const isPdfByHeader = header.subarray(0, 4).toString('ascii') === '%PDF';
  const isZipByHeader = header[0] === 0x50 && header[1] === 0x4b;
  const isLegacyDocByHeader =
    header[0] === 0xd0 &&
    header[1] === 0xcf &&
    header[2] === 0x11 &&
    header[3] === 0xe0;
  const isPdf =
    isPdfByHeader ||
    contentType.includes('application/pdf') ||
    urlLower.endsWith('.pdf');
  const isDocx =
    isZipByHeader ||
    contentType.includes(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ) ||
    urlLower.endsWith('.docx');

  if (
    isLegacyDocByHeader ||
    contentType.includes('application/msword') ||
    urlLower.endsWith('.doc')
  ) {
    throw new Error('Please upload a PDF or .docx Word document.');
  }

  let markdown = '';
  if (isPdf) {
    markdown = await convertPdfToMarkdown(buffer);
  } else if (isDocx) {
    markdown = await convertWordDocumentToMarkdown(buffer);
  } else {
    throw new Error('Please upload a PDF or .docx Word document.');
  }

  if (!markdown.trim()) {
    throw new Error('No readable text was found in the resume file.');
  }

  return normalizeResumeMarkdown(markdown);
}

function buildHistoryName({
  baseName,
  company,
  jobTitle,
}: {
  baseName: string;
  company: string | null;
  jobTitle: string;
}): string {
  const target = [jobTitle, company].filter(Boolean).join(' at ');
  return `${baseName} - ${target} optimized`.slice(0, 180);
}

function buildRevisionJson({
  company,
  diffSummary,
  emphasizedKeywords,
  jobDescription,
  jobTitle,
  source,
  summary,
}: {
  company: string | null;
  diffSummary: Array<{
    after: string;
    before?: string;
    keywords: string[];
    reason: string;
    section: string;
  }>;
  emphasizedKeywords: string[];
  jobDescription: string;
  jobTitle: string;
  source: BaseResumeInput['source'];
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
    job: {
      company,
      description: jobDescription,
      title: jobTitle,
    },
    kind: 'JOB_DETAILS_OPTIMIZER_HISTORY',
    source,
    summary,
  };
}

function cleanOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}
