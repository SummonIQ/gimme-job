'use server';

import type { Prisma } from '@/generated/prisma/browser';
import {
  JobFitAnalysisStatus,
  JobLeadOptimizationStatus,
  JobLeadStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { put } from '@vercel/blob';
import { unauthorized } from 'next/navigation';
import { after } from 'next/server';

import { getServerAiProvider } from '@/lib/ai/provider';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { convertMarkdownToWord } from '@/lib/files/convert/markdown-to-word';
import { logger } from '@/lib/logger';
import { getUserResume, optimizeResume } from '@/lib/resumes';
import { getResumeRevision } from '@/lib/resumes/revisions';
import { getCurrentUser } from '@/lib/user/query';
import { DataEventType } from '@/types/events';

import { analyzeJobFit } from './analyze/job-fit';

export async function reoptimizeJobLead({ jobLeadId }: { jobLeadId: string }) {
  const user = await getCurrentUser({
    include: { profile: true },
  });
  if (!user) {
    unauthorized();
  }
  const aiProvider = await getServerAiProvider();
  const userChannel = getPrivateUserChannel(user.id);

  logger.info('[JOB_LEAD_REOPTIMIZE] Fetching job lead', { jobLeadId });
  const jobLead = await db.jobLead.findUnique({
    include: {
      jobListing: true,
      optimization: true,
    },
    where: { id: jobLeadId, userId: user.id },
  });

  if (!jobLead || !jobLead.jobListing) {
    throw new Error('Job lead or listing not found');
  }

  const jobListing = jobLead.jobListing;

  // Reset statuses
  logger.info('[JOB_LEAD_REOPTIMIZE] Resetting optimization statuses');
  await db.jobLead.update({
    data: { status: JobLeadStatus.ANALYZING },
    where: { id: jobLeadId },
  });
  if (jobLead.optimization) {
    await db.jobLeadOptimization.update({
      data: {
        progress: 0,
        status: JobLeadOptimizationStatus.ANALYZING,
      },
      where: { jobLeadId },
    });
  }

  const revalidate = () => {
    revalidateTag(`user:${user.id}:report:job-leads`);
    revalidateTag(`user:${user.id}:job-leads`);
    revalidateTag(`user:${user.id}:job-leads:${jobLeadId}`);
  };
  revalidate();

  sendDataUpdate({
    channel: userChannel,
    payload: {
      data: { id: jobLeadId, progress: 20 },
      type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
    },
  });

  // Create a new resume optimization record
  const optimization = await db.resumeOptimization.create({
    data: {
      jobLead: { connect: { id: jobLeadId } },
      status: ResumeOptimizationStatus.ANALYZING,
      user: { connect: { id: user.id } },
    },
  });

  // Resolve default resume
  let defaultResumeId = user.defaultResumeId ?? undefined;
  const resumeRevisionInclude = {
    jobFitAnalyses: true,
    optimization: true,
    resumeAnalysis: true,
  } satisfies Prisma.ResumeRevisionInclude;

  let defaultResumeParent = defaultResumeId
    ? await getUserResume({
        id: defaultResumeId,
        include: { analysis: true },
        userId: user.id,
      })
    : undefined;

  if (defaultResumeId && !defaultResumeParent) {
    defaultResumeId = undefined;
    defaultResumeParent = undefined;
  }

  if (!defaultResumeParent) {
    defaultResumeParent = await db.resume.findFirst({
      include: { analysis: true },
      orderBy: { updatedAt: 'desc' },
      where: { userId: user.id },
    });
    if (defaultResumeParent) {
      defaultResumeId = defaultResumeParent.id;
    }
  }

  let defaultRevisionId = defaultResumeParent?.defaultRevisionId ?? undefined;
  let defaultRevision:
    | Prisma.ResumeRevisionGetPayload<{
        include: typeof resumeRevisionInclude;
      }>
    | null
    | undefined = defaultRevisionId
    ? await getResumeRevision({
        id: defaultRevisionId,
        include: resumeRevisionInclude,
        userId: user.id,
      })
    : undefined;

  if (defaultRevisionId && !defaultRevision) {
    defaultRevisionId = undefined;
  }

  if (!defaultRevision && defaultResumeParent) {
    defaultRevision = await db.resumeRevision.findFirst({
      include: resumeRevisionInclude,
      orderBy: { updatedAt: 'desc' },
      where: { resumeId: defaultResumeParent.id, userId: user.id },
    });
    if (defaultRevision) {
      defaultRevisionId = defaultRevision.id;
    }
  }

  const defaultResume = defaultRevision ?? defaultResumeParent;

  if (!defaultResumeId || !defaultResumeParent) {
    logger.error('[JOB_LEAD_REOPTIMIZE] No resume available');
    await db.jobLead.update({
      data: { status: JobLeadStatus.OPTIMIZATION_FAILED },
      where: { id: jobLeadId },
    });
    await db.jobLeadOptimization.update({
      data: { status: JobLeadOptimizationStatus.FAILED },
      where: { jobLeadId },
    });
    await db.resumeOptimization.update({
      data: { status: ResumeOptimizationStatus.FAILED },
      where: { id: optimization.id },
    });
    revalidate();
    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLeadId, progress: 100 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });
    return;
  }

  after(async () => {
    try {
      sendDataUpdate({
        channel: userChannel,
        payload: {
          data: { id: jobLeadId, progress: 30 },
          type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
        },
      });

      const formattedJobListing = `
Company: ${jobListing.company}
Title: ${jobListing.title}
Location: ${jobListing.location}
Description: ${jobListing.description}
${jobListing.requirements ? `Requirements:\n${(jobListing.requirements as string[]).map(req => `- ${req}`).join('\n')}` : ''}
${jobListing.responsibilities ? `Responsibilities:\n${(jobListing.responsibilities as string[]).map(res => `- ${res}`).join('\n')}` : ''}
      `;

      // Run job fit analysis
      logger.info('[JOB_LEAD_REOPTIMIZE] Running job fit analysis');
      const analysis = await analyzeJobFit({
        aiProvider,
        jobDescription: formattedJobListing,
        resumeMarkdown: defaultResume?.markdown ?? '',
      });

      sendDataUpdate({
        channel: userChannel,
        payload: {
          data: { id: jobLeadId, progress: 50 },
          type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
        },
      });

      // Upsert job fit analysis
      const existingAnalysis = await db.jobFitAnalysis.findUnique({
        where: { jobLeadId },
      });

      let jobFitAnalysis;
      const analysisData = {
        additionalMetrics: analysis.additional_metrics as Prisma.InputJsonValue,
        educationRelevanceScore: analysis.education_relevance_score,
        experienceRelevanceScore: analysis.experience_relevance_score,
        keywordMatch: analysis.keyword_match,
        missingKeywords: analysis.missing_keywords,
        overallMatchScore: analysis.overall_match_score,
        progress: 100,
        recommendations: analysis.recommendations,
        skillsAlignment: analysis.skills_alignment,
        status: JobFitAnalysisStatus.COMPLETED,
        summary: analysis.fit_summary,
      };

      if (existingAnalysis) {
        jobFitAnalysis = await db.jobFitAnalysis.update({
          data: {
            ...analysisData,
            resume: defaultResumeId
              ? { connect: { id: defaultResumeId } }
              : undefined,
            resumeRevision: defaultRevisionId
              ? { connect: { id: defaultRevisionId } }
              : undefined,
          },
          where: { jobLeadId },
        });
      } else {
        jobFitAnalysis = await db.jobFitAnalysis.create({
          data: {
            ...analysisData,
            jobLead: { connect: { id: jobLeadId } },
            jobListing: { connect: { id: jobListing.id } },
            resume: defaultResumeId
              ? { connect: { id: defaultResumeId } }
              : { connect: { id: defaultRevision?.resumeId } },
            resumeRevision: defaultRevisionId
              ? { connect: { id: defaultRevisionId } }
              : undefined,
          },
        });
      }
      revalidate();

      // Update to optimizing
      await db.jobLeadOptimization.update({
        data: {
          jobFitAnalysis: { connect: { id: jobFitAnalysis.id } },
          status: JobLeadOptimizationStatus.OPTIMIZING,
        },
        where: { jobLeadId },
      });
      await db.jobLead.update({
        data: { status: JobLeadStatus.OPTIMIZING },
        where: { id: jobLeadId },
      });
      await db.resumeOptimization.update({
        data: { status: ResumeOptimizationStatus.OPTIMIZING },
        where: { id: optimization.id },
      });
      revalidate();

      sendDataUpdate({
        channel: userChannel,
        payload: {
          data: { id: jobLeadId, progress: 60 },
          type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
        },
      });

      // Optimize resume
      logger.info('[JOB_LEAD_REOPTIMIZE] Optimizing resume');
      const optimizedResult = await optimizeResume({
        aiProvider,
        analysis: JSON.stringify({
          educationRelevanceScore: jobFitAnalysis.educationRelevanceScore,
          experienceRelevanceScore: jobFitAnalysis.experienceRelevanceScore,
          keywordMatch: jobFitAnalysis.keywordMatch,
          missingKeywords: jobFitAnalysis.missingKeywords,
          overallMatchScore: jobFitAnalysis.overallMatchScore,
          recommendations: jobFitAnalysis.recommendations,
          skillsAlignment: jobFitAnalysis.skillsAlignment,
          summary: jobFitAnalysis.summary,
        }),
        jobListing: formattedJobListing,
        resumeMarkdown: defaultResume?.markdown ?? '',
        userProfile: user.profile ?? undefined,
      });

      sendDataUpdate({
        channel: userChannel,
        payload: {
          data: { id: jobLeadId, progress: 75 },
          type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
        },
      });

      // Convert to Word
      const docxBuffer = await convertMarkdownToWord(optimizedResult.markdown);
      const timestamp = Date.now();
      const blobPath = `/users/${user.id}/${defaultResumeId}-reoptimized-${jobLead.title.toLowerCase().replace(/ /g, '-')}-${timestamp}.docx`;
      const { url: optimizedRevisionUrl } = await put(blobPath, docxBuffer, {
        access: 'public',
        contentType:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });

      sendDataUpdate({
        channel: userChannel,
        payload: {
          data: { id: jobLeadId, progress: 85 },
          type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
        },
      });

      // Create new revision
      const newRevision = await db.resumeRevision.create({
        data: {
          markdown: optimizedResult.markdown,
          name: `${jobListing.title} - ${defaultResume?.name} (Re-optimized)`,
          optimization: { connect: { id: optimization.id } },
          resume: { connect: { id: defaultResumeId } },
          user: { connect: { id: user.id } },
          wordDocumentUrl: optimizedRevisionUrl,
        },
      });

      // Update optimization records
      await db.resumeOptimization.update({
        data: {
          changelog: optimizedResult.changelog,
          estimatedVisibilityBoost:
            optimizedResult.confidence_metrics.estimated_visibility_boost,
          jobFitAnalysis: { connect: { id: jobFitAnalysis.id } },
          optimizationStrategy: optimizedResult.optimization_strategy,
          previousScore: optimizedResult.score_improvement.previous_score,
          projectedShortlistProbability:
            optimizedResult.confidence_metrics.projected_shortlist_probability,
          resume: { connect: { id: defaultResumeId } },
          score: optimizedResult.ats_score,
          scoreImprovement: optimizedResult.score_improvement.delta,
          scorePercentChange: optimizedResult.score_improvement.percent_change,
          significantImprovements:
            optimizedResult.score_improvement.significant_improvements,
          status: ResumeOptimizationStatus.COMPLETED,
          summary: optimizedResult.summary,
        },
        where: { id: optimization.id },
      });

      await db.jobLeadOptimization.update({
        data: {
          progress: 100,
          resumeRevision: { connect: { id: newRevision.id } },
          status: JobLeadOptimizationStatus.COMPLETED,
        },
        where: { jobLeadId },
      });

      await db.jobLead.update({
        data: {
          resumeRevisions: { connect: { id: newRevision.id } },
          status: JobLeadStatus.OPTIMIZED,
        },
        where: { id: jobLeadId },
      });
      revalidate();

      sendDataUpdate({
        channel: userChannel,
        payload: {
          data: { id: jobLeadId, progress: 100 },
          type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
        },
      });

      logger.info('[JOB_LEAD_REOPTIMIZE] Completed');
    } catch (error) {
      logger.error('[JOB_LEAD_REOPTIMIZE] Failed', { error });
      await db.jobLead.update({
        data: { status: JobLeadStatus.OPTIMIZATION_FAILED },
        where: { id: jobLeadId },
      });
      await db.jobLeadOptimization.update({
        data: { status: JobLeadOptimizationStatus.FAILED },
        where: { jobLeadId },
      });
      await db.resumeOptimization.update({
        data: { status: ResumeOptimizationStatus.FAILED },
        where: { id: optimization.id },
      });
      revalidate();
      sendDataUpdate({
        channel: userChannel,
        payload: {
          data: { id: jobLeadId, progress: 100 },
          type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
        },
      });
    }
  });
}
