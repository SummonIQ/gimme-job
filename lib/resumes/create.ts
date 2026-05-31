'use server';

import {
  type Resume,
  ResumeAnalysisStatus,
  ResumeOptimizationStatus,
} from '@/generated/prisma/browser';
import { after } from 'next/server';

import { getServerAiProvider } from '@/lib/ai/provider';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { AppError, ErrorCode } from '@/lib/errors';
import { invalidateResolverCacheSlice } from '@/lib/field-answer/cache';
import {
  convertMarkdownToPdf,
  convertPdfToMarkdown,
  convertWordDocumentToMarkdown,
} from '@/lib/files/convert';
import { logger } from '@/lib/logger';
import { analyzeResumeForATS } from '@/lib/resumes/analyze/ats';
import { normalizeResumeMarkdown } from '@/lib/resumes/normalize-markdown';
import { reviseMarkdown } from '@/lib/resumes/revise/markdown';
import { scoreResume } from '@/lib/resumes/score/deterministic';
import { extractKnowledgeFromResume } from '@/lib/user/knowledge';
import { getCurrentUser } from '@/lib/user/query';
import { put } from '@vercel/blob';

// Helper function to validate URLs
function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

import { triggerResumeAnalysisNotification } from '@/lib/notifications/triggers';
import { convertMarkdownToWord } from '../files/convert/markdown-to-word';
import {
  sendResumeAnalysisProgress,
  sendResumeOptimizationProgress,
} from './events';
import { optimizeResume } from './optimize/optimize';

export async function createUserResume({
  description,
  name,
  setDefault = true,
  url,
}: {
  description?: string;
  name: string;
  setDefault?: boolean;
  url: string;
}): Promise<Resume> {
  // Input validation
  if (!name || name.trim().length === 0) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Resume name is required',
      userMessage: 'Please provide a name for your resume.',
    });
  }

  if (!url || !isValidUrl(url)) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Valid resume URL is required',
      userMessage: 'Please provide a valid resume file URL.',
    });
  }

  const user = await getCurrentUser();
  if (!user) {
    throw new AppError({
      code: ErrorCode.UNAUTHORIZED,
      message: 'User not authenticated',
      userMessage: 'Please log in to create a resume.',
    });
  }
  const aiProvider = await getServerAiProvider();

  logger.info('[RESUME_CREATE] Creating resume DB record', {
    description,
    name,
    url,
  });
  const userResume = await db.resume.create({
    data: {
      description,
      name,
      optimization: {
        create: {
          analysis: {
            create: {
              status: ResumeAnalysisStatus.ANALYZING,
              user: { connect: { id: user.id } },
            },
          },
          progress: 5,
          status: ResumeOptimizationStatus.PROCESSING,
          user: { connect: { id: user.id } },
        },
      },
      url,
      user: {
        connect: { id: user.id },
      },
    },
    include: {
      analysis: true,
      optimization: true,
    },
  });
  logger.info('[RESUME_CREATE] Created resume DB record', userResume);

  revalidateTag(`user:${user.id}:report:resumes`);
  revalidateTag(`user:${user.id}:resumes`);
  revalidateTag(`user:${user.id}:resumes:queued`);
  revalidateTag(`user:${user.id}:resumes:${userResume.id}`);

  let optimizationSequence = 0;
  let analysisSequence = 0;

  const emitResumeOptimizationProgress = async ({
    progress,
    status,
  }: {
    progress: number;
    status: ResumeOptimizationStatus;
  }) => {
    optimizationSequence += 1;
    try {
      await sendResumeOptimizationProgress({
        emittedAt: new Date().toISOString(),
        id: userResume.id,
        name: userResume.name,
        progress,
        sequence: optimizationSequence,
        status,
        userId: user.id,
      });
    } catch (error) {
      logger.error(
        '[RESUME_CREATE] Failed to emit optimization progress event',
        {
          error,
          progress,
          resumeId: userResume.id,
          sequence: optimizationSequence,
          status,
        },
      );
    }
  };

  const emitResumeAnalysisProgress = async ({
    progress,
    status,
  }: {
    progress: number;
    status: ResumeAnalysisStatus;
  }) => {
    analysisSequence += 1;
    try {
      await sendResumeAnalysisProgress({
        emittedAt: new Date().toISOString(),
        id: userResume.id,
        name: userResume.name,
        progress,
        sequence: analysisSequence,
        status,
        userId: user.id,
      });
    } catch (error) {
      logger.error('[RESUME_CREATE] Failed to emit analysis progress event', {
        error,
        progress,
        resumeId: userResume.id,
        sequence: analysisSequence,
        status,
      });
    }
  };

  await emitResumeOptimizationProgress({
    progress: 5,
    status: ResumeOptimizationStatus.PROCESSING,
  });
  await emitResumeAnalysisProgress({
    progress: 5,
    status: ResumeAnalysisStatus.ANALYZING,
  });

  if (setDefault) {
    logger.info('[RESUME_CREATE] Updating default resume');
    await db.user.update({
      data: {
        defaultRevisionId: null,
        defaultResumeId: userResume.id,
      },
      where: {
        id: user.id,
      },
    });

    revalidateTag(`user:${user.id}:resumes:default`);
    revalidateTag(`user:${user.id}:report:resumes`);
    revalidateTag(`user:${user.id}:resumes`);
    revalidateTag(`user:${user.id}:resumes:queued`);
    revalidateTag(`user:${user.id}:resumes:${userResume.id}`);
    invalidateResolverCacheSlice(user.id, 'resume');
    invalidateResolverCacheSlice(user.id, 'user');

    logger.info('[RESUME_CREATE] Updated default resume');
  }

  logger.info('[RESUME_CREATE] Returning from createUserResume');
  after(async () => {
    logger.info('[RESUME_CREATE] Starting after');
    try {
      logger.info('[RESUME_CREATE] Updating resume optimization');
      await db.resumeOptimization.update({
        data: {
          progress: 30,
          resume: { connect: { id: userResume.id } },
          status: ResumeOptimizationStatus.REVISING,
          user: { connect: { id: user.id } },
        },
        where: { id: userResume.optimization?.id },
      });
      logger.info('[RESUME_CREATE] Updated resume optimization');

      revalidateTag(`user:${user.id}:resumes:default`);
      revalidateTag(`user:${user.id}:report:resumes`);
      revalidateTag(`user:${user.id}:resumes`);
      revalidateTag(`user:${user.id}:resumes:queued`);
      revalidateTag(`user:${user.id}:resumes:${userResume.id}`);

      await emitResumeOptimizationProgress({
        progress: 30,
        status: ResumeOptimizationStatus.REVISING,
      });

      logger.info('[RESUME_CREATE] Fetching resume');
      const response = await fetch(url);
      logger.info('[RESUME_CREATE] Fetched resume');

      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);

      const contentType =
        response.headers.get('content-type')?.toLowerCase() ?? '';
      const urlLower = url.toLowerCase();

      // Prefer magic bytes over content-type / URL extension.
      // Blob URLs often lack a useful extension and may have generic content-type.
      const header = buffer.subarray(0, 8);
      const isPdfByHeader = header.subarray(0, 4).toString('ascii') === '%PDF';
      const isZipByHeader = header[0] === 0x50 && header[1] === 0x4b; // PK..
      const isLegacyDocByHeader =
        header[0] === 0xd0 &&
        header[1] === 0xcf &&
        header[2] === 0x11 &&
        header[3] === 0xe0; // CFBF header

      const isPdf =
        isPdfByHeader ||
        contentType.includes('application/pdf') ||
        urlLower.endsWith('.pdf');
      const isDoc =
        isLegacyDocByHeader ||
        contentType.includes('application/msword') ||
        urlLower.endsWith('.doc');

      const isDocx =
        isZipByHeader ||
        contentType.includes(
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ) ||
        urlLower.endsWith('.docx');

      if (isDoc) {
        throw new AppError({
          code: ErrorCode.INVALID_INPUT,
          message: 'Unsupported resume format: .doc',
          userMessage: 'Please upload a PDF or a .docx Word document.',
        });
      }

      let markdown: string;
      if (isPdf) {
        logger.info('[RESUME_CREATE] Converting PDF to markdown');
        markdown = await convertPdfToMarkdown(buffer);
        logger.info('[RESUME_CREATE] Converted PDF to markdown');
      } else if (isDocx) {
        logger.info('[RESUME_CREATE] Converting word document to markdown');
        markdown = await convertWordDocumentToMarkdown(buffer);
        logger.info('[RESUME_CREATE] Converted word document to markdown');
      } else {
        throw new AppError({
          code: ErrorCode.UNSUPPORTED_FILE_TYPE,
          message: `Unsupported resume file type (content-type: ${contentType || 'unknown'})`,
          userMessage: 'Please upload a PDF or a .docx Word document.',
        });
      }

      if (!markdown || markdown.trim().length === 0) {
        throw new AppError({
          code: ErrorCode.FILE_PROCESSING_ERROR,
          message: 'Resume text extraction resulted in empty content',
          userMessage:
            "We couldn't read any text from that file. Try re-saving/exporting it and upload again.",
        });
      }

      markdown = normalizeResumeMarkdown(markdown);

      // Persist *something* immediately so the user has an "original" preview even if later AI steps fail.
      // Also compute the deterministic baseline score right away.
      const baselineScore = scoreResume(markdown);
      logger.info('[RESUME_CREATE] Deterministic baseline score', {
        score: baselineScore.total,
        breakdown: baselineScore,
      });

      const analysisId = userResume.optimization?.analysisId;
      if (analysisId) {
        await db.resumeAnalysis.update({
          data: {
            resume: { connect: { id: userResume.id } },
            score: baselineScore.total,
            user: { connect: { id: user.id } },
          },
          where: { id: analysisId },
        });
      }

      await db.resume.update({
        data: {
          markdown,
        },
        where: { id: userResume.id },
      });

      revalidateTag(`user:${user.id}:report:resumes`);
      revalidateTag(`user:${user.id}:resumes`);
      revalidateTag(`user:${user.id}:resumes:${userResume.id}`);

      // Extract user knowledge from resume (fire-and-forget)
      extractKnowledgeFromResume(user.id, markdown, { aiProvider }).catch(
        () => {},
      );

      logger.info('[RESUME_CREATE] Revising markdown');
      let revisedMarkdown = markdown;
      try {
        if (!process.env.OPENAI_API_KEY) {
          throw new AppError({
            code: ErrorCode.AI_SERVICE_ERROR,
            message: 'OPENAI_API_KEY environment variable is required',
            userMessage:
              'Resume analysis is not configured yet (missing OPENAI_API_KEY).',
          });
        }

        revisedMarkdown = await reviseMarkdown(markdown, { aiProvider });
        revisedMarkdown = normalizeResumeMarkdown(revisedMarkdown);
        logger.info('[RESUME_CREATE] Revised markdown');
      } catch (error) {
        logger.error(
          '[RESUME_CREATE] Markdown revision failed, using un-revised markdown',
          {
            error,
          },
        );
      }

      logger.info('[RESUME_CREATE] Updating resume');
      await db.resume.update({
        data: {
          markdown: revisedMarkdown,
          optimization: {
            update: {
              progress: 55,
              status: ResumeOptimizationStatus.ANALYZING,
            },
          },
        },
        where: { id: userResume.id },
      });
      logger.info('[RESUME_CREATE] Updated resume');

      revalidateTag(`user:${user.id}:resumes:default`);
      revalidateTag(`user:${user.id}:report:resumes`);
      revalidateTag(`user:${user.id}:resumes`);
      revalidateTag(`user:${user.id}:resumes:queued`);
      revalidateTag(`user:${user.id}:resumes:${userResume.id}`);

      await emitResumeOptimizationProgress({
        progress: 55,
        status: ResumeOptimizationStatus.ANALYZING,
      });
      await emitResumeAnalysisProgress({
        progress: 55,
        status: ResumeAnalysisStatus.ANALYZING,
      });

      if (!process.env.OPENAI_API_KEY) {
        throw new AppError({
          code: ErrorCode.AI_SERVICE_ERROR,
          message: 'OPENAI_API_KEY environment variable is required',
          userMessage:
            'Resume analysis is not configured yet (missing OPENAI_API_KEY).',
        });
      }

      logger.info('[RESUME_CREATE] Analyzing resume for ATS');
      const resumeATSAnalysis = await analyzeResumeForATS(
        revisedMarkdown,
        undefined,
        { aiProvider },
      );
      logger.info('[RESUME_CREATE] Analyzed resume for ATS');

      const { breakdown, recommendations, summary } = resumeATSAnalysis;

      if (!analysisId) {
        throw new Error('Analysis not found');
      }

      logger.info('[RESUME_CREATE] Updating resume analysis');
      const resumeAnalysis = await db.resumeAnalysis.update({
        data: {
          achievements: breakdown.achievements,
          formatting: breakdown.formatting,
          grammar: breakdown.grammar,
          keywords: breakdown.keywords,
          likeability: breakdown.likeability,
          optimization: {
            update: {
              progress: 65,
              status: ResumeOptimizationStatus.ANALYZED,
            },
          },
          progress: 100,
          readability: breakdown.readability,
          recommendations,
          resume: { connect: { id: userResume.id } },
          score: baselineScore.total,
          sections: breakdown.sections,
          spelling: breakdown.spelling,
          status: ResumeAnalysisStatus.COMPLETED,
          strengths: breakdown.strengths,
          summary,
          user: { connect: { id: user.id } },
          weaknesses: breakdown.weaknesses,
        },
        where: { id: analysisId },
      });
      logger.info('[RESUME_CREATE] Updated resume analysis');

      // Emit ANALYZED status — old/baseline score is now available
      await emitResumeOptimizationProgress({
        progress: 65,
        status: ResumeOptimizationStatus.ANALYZED,
      });
      await emitResumeAnalysisProgress({
        progress: 100,
        status: ResumeAnalysisStatus.COMPLETED,
      });

      // Send analysis completion notification
      try {
        await triggerResumeAnalysisNotification(
          user.id,
          userResume.id,
          userResume.name,
          'ats',
          'completed',
          baselineScore.total,
          (recommendations?.priority_fixes?.length || 0) +
            (recommendations?.content_enhancements?.length || 0) +
            (recommendations?.long_term_improvements?.length || 0),
        );
      } catch (notificationError) {
        logger.error(
          '[RESUME_CREATE] Failed to send resume analysis notification',
          {
            notificationError,
          },
        );
      }

      revalidateTag(`user:${user.id}:resumes:default`);
      revalidateTag(`user:${user.id}:report:resumes`);
      revalidateTag(`user:${user.id}:resumes`);
      revalidateTag(`user:${user.id}:resumes:queued`);
      revalidateTag(`user:${user.id}:resumes:${userResume.id}`);

      // Transition to OPTIMIZING
      await db.resume.update({
        data: {
          optimization: {
            update: {
              progress: 70,
              status: ResumeOptimizationStatus.OPTIMIZING,
            },
          },
        },
        where: { id: userResume.id },
      });

      revalidateTag(`user:${user.id}:report:resumes`);
      revalidateTag(`user:${user.id}:resumes`);
      revalidateTag(`user:${user.id}:resumes:${userResume.id}`);

      await emitResumeOptimizationProgress({
        progress: 70,
        status: ResumeOptimizationStatus.OPTIMIZING,
      });

      if (!userResume.optimization?.analysisId) {
        throw new Error('Analysis not found');
      }

      const {
        recommendations: analysisRecommendations,
        score: analysisScore,
        summary: analysisSummary,
      } = resumeAnalysis;

      const {
        sections,
        spelling,
        strengths,
        weaknesses,
        achievements,
        formatting,
        grammar,
        keywords,
        likeability,
        readability,
      } = breakdown;

      logger.info('[RESUME_CREATE] Optimizing resume');
      const optimizedRevision = await optimizeResume({
        aiProvider,
        analysis: JSON.stringify({
          achievements,
          formatting,
          grammar,
          keywords,
          likeability,
          readability,
          recommendations: analysisRecommendations,
          score: analysisScore,
          sections,
          spelling,
          strengths,
          summary: analysisSummary,
          weaknesses,
        }),
        resumeMarkdown: revisedMarkdown,
        userProfile: user.profile ?? undefined,
      });
      logger.info('[RESUME_CREATE] Optimized resume');

      const optimizedMarkdown = normalizeResumeMarkdown(
        optimizedRevision.markdown,
      );

      logger.info('[RESUME_CREATE] Converting optimized revision to Word');
      const docxBuffer = await convertMarkdownToWord(optimizedMarkdown);
      logger.info('[RESUME_CREATE] Converted optimized revision to Word');

      const timestamp = Date.now();
      const blobPath = `/users/${user.id}/${userResume.name}-optimized-${timestamp}`;

      logger.info(
        '[RESUME_CREATE] Uploading optimized revision to Blob storage',
      );
      const [{ url: optimizedRevisionUrl }, optimizedPdfUpload] =
        await Promise.all([
          put(`${blobPath}.docx`, docxBuffer, {
            access: 'public',
            contentType:
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          }),
          isPdf
            ? convertMarkdownToPdf(optimizedMarkdown).then(pdfBuffer =>
                put(`${blobPath}.pdf`, pdfBuffer, {
                  access: 'public',
                  contentType: 'application/pdf',
                }),
              )
            : Promise.resolve(null),
        ]);
      const optimizedPdfUrl = optimizedPdfUpload?.url ?? null;

      logger.info(
        '[RESUME_CREATE] Uploaded optimized revision to Blob storage',
      );

      // Score the optimized markdown deterministically for apples-to-apples comparison
      const optimizedScore = scoreResume(optimizedMarkdown);
      logger.info('[RESUME_CREATE] Deterministic optimized score', {
        score: optimizedScore.total,
        breakdown: optimizedScore,
      });

      const scoreDelta = optimizedScore.total - baselineScore.total;
      const scorePercentChange =
        baselineScore.total > 0
          ? Math.round((scoreDelta / baselineScore.total) * 100)
          : 0;

      logger.info('[RESUME_CREATE] Updating resume');
      await db.resume.update({
        data: {
          optimization: {
            update: {
              changelog: optimizedRevision.changelog,
              estimatedVisibilityBoost:
                optimizedRevision.confidence_metrics.estimated_visibility_boost,
              optimizationStrategy: optimizedRevision.optimization_strategy,
              previousScore: baselineScore.total,
              progress: 100,
              projectedShortlistProbability:
                optimizedRevision.confidence_metrics
                  .projected_shortlist_probability,
              resumeRevision: {
                create: {
                  description: optimizedRevision.summary,
                  // json: optimizedRevision.json,
                  markdown: optimizedMarkdown,
                  name: `${name} - Optimized`,
                  pdfDocumentUrl: optimizedPdfUrl,
                  resume: { connect: { id: userResume.id } },
                  user: { connect: { id: user.id } },
                  wordDocumentUrl: optimizedRevisionUrl,
                },
              },
              score: optimizedScore.total,
              scoreImprovement: scoreDelta,
              scorePercentChange,
              significantImprovements:
                optimizedRevision.score_improvement.significant_improvements,
              status: ResumeOptimizationStatus.COMPLETED,
              summary: optimizedRevision.summary,
            },
          },
        },
        where: { id: userResume.id },
      });
      logger.info('[RESUME_CREATE] Updated resume');

      revalidateTag(`user:${user.id}:resumes:default`);
      revalidateTag(`user:${user.id}:resumes:queued`);
      revalidateTag(`user:${user.id}:report:resumes`);
      revalidateTag(`user:${user.id}:resumes`);
      revalidateTag(`user:${user.id}:resumes:${userResume.id}`);
      revalidateTag(
        `user:${user.id}:resumes:${userResume.id}:revisions:${userResume.optimization?.resumeRevisionId}`,
      );

      await emitResumeOptimizationProgress({
        progress: 100,
        status: ResumeOptimizationStatus.COMPLETED,
      });

      // sendNotification({
      //   channel: userChannel,
      //   payload: {
      //     actionText: 'View results',
      //     actionUrl: `/a/resumes/${userResume.id}`,
      //     description: `Resume optimization complete for '${name}'`,
      //     duration: 5000,
      //     title: 'Resume optimization complete',
      //     type: 'success',
      //   },
      // });
    } catch (error) {
      logger.error(error);

      // Send failure notification
      const errorMessage =
        error instanceof AppError
          ? error.userMessage
          : error instanceof Error
            ? error.message
            : 'Unknown error';

      const analysisId = userResume.optimization?.analysisId;
      if (analysisId) {
        await db.resumeAnalysis.update({
          data: {
            status: ResumeAnalysisStatus.FAILED,
            summary: errorMessage,
          },
          where: { id: analysisId },
        });
      }

      try {
        await triggerResumeAnalysisNotification(
          user.id,
          userResume.id,
          userResume.name,
          'ats',
          'failed',
          undefined,
          undefined,
          errorMessage,
        );
      } catch (notificationError) {
        logger.error(
          '[RESUME_CREATE] Failed to send resume analysis failure notification',
          {
            notificationError,
          },
        );
      }

      const updatedResume = await db.resume.update({
        data: {
          optimization: {
            update: {
              progress: 100,
              status: ResumeOptimizationStatus.FAILED,
              summary: errorMessage,
            },
          },
        },
        where: { id: userResume.id },
      });

      revalidateTag(`user:${user.id}:report:resumes`);
      revalidateTag(`user:${user.id}:resumes`);
      revalidateTag(`user:${user.id}:resumes:${userResume.id}`);
      revalidateTag(`user:${user.id}:resumes:queued`);
      revalidateTag(`user:${user.id}:resumes:default`);

      await emitResumeOptimizationProgress({
        progress: 100,
        status: ResumeOptimizationStatus.FAILED,
      });
      await emitResumeAnalysisProgress({
        progress: 100,
        status: ResumeAnalysisStatus.FAILED,
      });

      return updatedResume;
    }
  });

  return userResume;
}
