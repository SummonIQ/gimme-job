import type { Prisma } from '@/generated/prisma/browser';
import {
  JobFitAnalysisStatus,
  JobLeadOptimizationStatus,
  JobLeadStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { put } from '@vercel/blob';

import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { convertMarkdownToWord } from '@/lib/files/convert/markdown-to-word';
import { logger } from '@/lib/logger';
import { getUserResume, optimizeResume } from '@/lib/resumes';
import { getResumeRevision } from '@/lib/resumes/revisions';
import { DataEventType } from '@/types/events';

import { analyzeJobFit } from './analyze/job-fit';

const MAX_CONCURRENT_OPTIMIZATIONS = 3;

/**
 * Count how many job leads are currently being processed for a user.
 */
async function getActiveOptimizationCount(userId: string): Promise<number> {
  return db.jobLead.count({
    where: {
      userId,
      status: { in: [JobLeadStatus.ANALYZING, JobLeadStatus.OPTIMIZING] },
    },
  });
}

/**
 * Check for queued job leads and process them if there are available slots.
 */
export async function processNextQueuedLeads(userId: string): Promise<void> {
  const activeCount = await getActiveOptimizationCount(userId);
  const availableSlots = MAX_CONCURRENT_OPTIMIZATIONS - activeCount;

  if (availableSlots <= 0) {
    logger.info('[JOB_LEAD_QUEUE] No available slots', {
      activeCount,
      userId,
    });
    return;
  }

  const queuedLeads = await db.jobLead.findMany({
    where: {
      userId,
      status: JobLeadStatus.ADDED,
      optimization: { status: JobLeadOptimizationStatus.QUEUED },
    },
    orderBy: { createdAt: 'asc' },
    take: availableSlots,
  });

  if (queuedLeads.length === 0) {
    logger.info('[JOB_LEAD_QUEUE] No queued leads to process');
    return;
  }

  logger.info('[JOB_LEAD_QUEUE] Processing queued leads', {
    count: queuedLeads.length,
    availableSlots,
  });

  await Promise.all(
    queuedLeads.map(lead => processJobLeadOptimization(lead.id)),
  );
}

/**
 * Check if a job lead can start processing immediately.
 */
export async function canProcessImmediately(
  userId: string,
): Promise<boolean> {
  const activeCount = await getActiveOptimizationCount(userId);
  return activeCount < MAX_CONCURRENT_OPTIMIZATIONS;
}

/**
 * Process the full optimization pipeline for a job lead:
 * job fit analysis -> resume optimization -> upload.
 * Includes error handling that marks the lead as failed on any error.
 */
export async function processJobLeadOptimization(
  jobLeadId: string,
): Promise<void> {
  const jobLead = await db.jobLead.findUnique({
    where: { id: jobLeadId },
    include: {
      jobListing: true,
      optimization: true,
      user: { include: { profile: true } },
    },
  });

  if (!jobLead || !jobLead.jobListing || !jobLead.user) {
    logger.error('[JOB_LEAD_PROCESS] Job lead or related data not found', {
      jobLeadId,
    });
    return;
  }

  const { jobListing, user } = jobLead;
  const userChannel = getPrivateUserChannel(user.id);

  // Find the resume optimization record
  const optimization = await db.resumeOptimization.findFirst({
    where: { jobLeadId: jobLead.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!optimization) {
    logger.error('[JOB_LEAD_PROCESS] Resume optimization not found', {
      jobLeadId,
    });
    return;
  }

  // Resolve default resume and revision
  let defaultResumeId = user.defaultResumeId ?? undefined;
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

  const resumeRevisionInclude = {
    jobFitAnalyses: true,
    optimization: true,
    resumeAnalysis: true,
  } satisfies Prisma.ResumeRevisionInclude;

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

  const revalidate = () => {
    revalidateTag(`user:${user.id}:report:job-leads`);
    revalidateTag(`user:${user.id}:job-leads`);
    revalidateTag(`user:${user.id}:job-leads:${jobLead.id}`);
    revalidateTag(`user:${user.id}:report:job-listings`);
    revalidateTag(`user:${user.id}:job-listings`);
    revalidateTag(`user:${user.id}:job-listings:${jobListing.id}`);
  };

  // If no resume available, fail immediately
  if (!defaultResumeId || !defaultResumeParent) {
    logger.info('[JOB_LEAD_PROCESS] No resume available, failing', {
      jobLeadId,
    });
    await db.jobLeadOptimization.update({
      data: { status: JobLeadOptimizationStatus.FAILED },
      where: { jobLeadId: jobLead.id },
    });
    await db.jobLead.update({
      data: { status: JobLeadStatus.ANALYSIS_FAILED },
      where: { id: jobLead.id },
    });
    await db.resumeOptimization.update({
      data: { status: ResumeOptimizationStatus.FAILED },
      where: { id: optimization.id },
    });
    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 100 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });
    revalidate();
    // Process next queued leads
    await processNextQueuedLeads(user.id);
    return;
  }

  try {
    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 25 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });

    // Update statuses to ANALYZING
    await db.resumeOptimization.update({
      data: { status: ResumeOptimizationStatus.ANALYZING },
      where: { id: optimization.id },
    });
    await db.jobLeadOptimization.update({
      data: { status: JobLeadOptimizationStatus.ANALYZING },
      where: { jobLeadId: jobLead.id },
    });
    await db.jobLead.update({
      data: { status: JobLeadStatus.ANALYZING },
      where: { id: jobLead.id },
    });

    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 40 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });

    // Format job listing for analysis
    const formattedJobListing = `
Company: ${jobListing?.company}
Title: ${jobListing?.title}
Location: ${jobListing?.location}
Description: ${jobListing?.description}
${jobListing?.requirements ? `Requirements:\n${jobListing.requirements.map(req => `- ${req}`).join('\n')}` : ''}
${jobListing?.responsibilities ? `Responsibilities:\n${jobListing.responsibilities.map(res => `- ${res}`).join('\n')}` : ''}
    `;

    // Run job fit analysis
    logger.info('[JOB_LEAD_PROCESS] Running job fit analysis', { jobLeadId });
    const analysis = await analyzeJobFit({
      jobDescription: formattedJobListing,
      resumeMarkdown: defaultResume?.markdown ?? '',
    });
    logger.info('[JOB_LEAD_PROCESS] Job fit analysis completed', {
      jobLeadId,
    });

    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 50 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });

    // Save the analysis
    const jobFitAnalysis = await db.jobFitAnalysis.create({
      data: {
        additionalMetrics:
          analysis.additional_metrics as Prisma.InputJsonValue,
        educationRelevanceScore: analysis.education_relevance_score,
        experienceRelevanceScore: analysis.experience_relevance_score,
        jobLead: { connect: { id: jobLead.id } },
        jobListing: { connect: { id: jobListing.id } },
        keywordMatch: analysis.keyword_match,
        missingKeywords: analysis.missing_keywords,
        overallMatchScore: analysis.overall_match_score,
        recommendations: analysis.recommendations,
        resume: defaultResumeId
          ? { connect: { id: defaultResumeId } }
          : { connect: { id: defaultRevision?.resumeId } },
        resumeRevision: defaultRevisionId
          ? { connect: { id: defaultRevisionId } }
          : undefined,
        skillsAlignment: analysis.skills_alignment,
        progress: 100,
        status: JobFitAnalysisStatus.COMPLETED,
        summary: analysis.fit_summary,
      },
    });

    // Update to OPTIMIZING
    await db.jobLeadOptimization.update({
      data: {
        jobFitAnalysis: { connect: { id: jobFitAnalysis.id } },
        status: JobLeadOptimizationStatus.OPTIMIZING,
      },
      where: { jobLeadId: jobLead.id },
    });
    await db.jobLead.update({
      data: { status: JobLeadStatus.OPTIMIZING },
      where: { id: jobLead.id },
    });
    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 60 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });

    await db.resumeOptimization.update({
      data: { status: ResumeOptimizationStatus.OPTIMIZING },
      where: { id: optimization.id },
    });

    // Optimize resume
    logger.info('[JOB_LEAD_PROCESS] Optimizing resume', { jobLeadId });
    const {
      educationRelevanceScore,
      experienceRelevanceScore,
      keywordMatch,
      skillsAlignment,
      missingKeywords,
      overallMatchScore,
      recommendations,
      summary,
    } = jobFitAnalysis;
    const optimizedResult = await optimizeResume({
      analysis: JSON.stringify({
        educationRelevanceScore,
        experienceRelevanceScore,
        keywordMatch,
        missingKeywords,
        overallMatchScore,
        recommendations,
        skillsAlignment,
        summary,
      }),
      jobListing: formattedJobListing,
      resumeMarkdown: defaultResume?.markdown ?? '',
      userProfile: user.profile ?? undefined,
    });
    logger.info('[JOB_LEAD_PROCESS] Optimized resume', { jobLeadId });

    // Convert to Word and upload
    const docxBuffer = await convertMarkdownToWord(optimizedResult.markdown);
    const timestamp = Date.now();
    const blobPath = `/users/${user.id}/${defaultResumeId}-optimized-${jobLead.title.toLowerCase().replace(/ /g, '-')}-${timestamp}.docx`;
    const { url: optimizedRevisionUrl } = await put(blobPath, docxBuffer, {
      access: 'public',
      contentType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 65 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });

    // Create optimized revision
    const newRevision = await db.resumeRevision.create({
      data: {
        markdown: optimizedResult.markdown,
        name: `${jobListing?.title} - ${defaultResume?.name}`,
        optimization: {
          connect: { id: optimization.id },
        },
        resume: { connect: { id: defaultResumeId } },
        user: { connect: { id: user.id } },
        wordDocumentUrl: optimizedRevisionUrl,
      },
    });

    // Update optimization with results
    await db.resumeOptimization.update({
      data: {
        changelog: optimizedResult.changelog,
        estimatedVisibilityBoost:
          optimizedResult.confidence_metrics.estimated_visibility_boost,
        jobFitAnalysis: { connect: { id: jobFitAnalysis.id } },
        optimizationStrategy: optimizedResult.optimization_strategy,
        previousScore: optimizedResult?.score_improvement.previous_score,
        projectedShortlistProbability:
          optimizedResult.confidence_metrics.projected_shortlist_probability,
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

    // Mark as completed
    await db.jobLeadOptimization.update({
      data: {
        progress: 100,
        resumeRevision: { connect: { id: newRevision.id } },
        status: JobLeadOptimizationStatus.COMPLETED,
      },
      where: { jobLeadId: jobLead.id },
    });
    await db.jobLead.update({
      data: { status: JobLeadStatus.OPTIMIZED },
      where: { id: jobLead.id },
    });

    await db.jobLead.update({
      data: {
        jobFitAnalysis: {
          update: { status: JobFitAnalysisStatus.COMPLETED },
        },
        resumeRevisions: { connect: { id: newRevision.id } },
      },
      where: { id: jobLead.id, userId: user.id },
    });

    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 100 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });

    logger.info('[JOB_LEAD_PROCESS] Completed', { jobLeadId });
  } catch (error) {
    logger.error('[JOB_LEAD_PROCESS] Failed', { error, jobLeadId });

    await db.jobLead.update({
      data: { status: JobLeadStatus.ANALYSIS_FAILED },
      where: { id: jobLead.id },
    });
    await db.jobLeadOptimization.update({
      data: { status: JobLeadOptimizationStatus.FAILED },
      where: { jobLeadId: jobLead.id },
    });
    await db.resumeOptimization.update({
      data: { status: ResumeOptimizationStatus.FAILED },
      where: { id: optimization.id },
    });

    sendDataUpdate({
      channel: userChannel,
      payload: {
        data: { id: jobLead.id, progress: 100 },
        type: DataEventType.JOB_LEAD_OPTIMIZATION_PROGRESS,
      },
    });
  } finally {
    revalidate();
    // Always try to process next queued leads when a slot opens up
    await processNextQueuedLeads(user.id);
  }
}
