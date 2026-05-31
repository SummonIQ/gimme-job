'use server';

import { getServerAiProvider } from '@/lib/ai/provider';
import { db } from '@/lib/db/client';
import { enqueueJob, JobType } from '@/lib/pipeline/durable-queue';
import { getCurrentUser } from '@/lib/user/query';
import { revalidateTag } from 'next/cache';
import { analyzeFormWithAI } from './form-analyzer';
import {
  EnqueueDesktopSubmitRequestResult,
  FieldSuggestion,
  GuidedApplicationProgress,
  StartGuidedApplicationInput,
  SubmitGuidedApplicationResult,
} from './types';
import { getUserDataForSuggestions, matchFieldToUserData } from './user-data';

export async function startGuidedApplication(
  input: StartGuidedApplicationInput,
): Promise<{ success: boolean; applicationId?: string; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    let company: string | undefined;
    let jobTitle: string | undefined;

    if (input.jobLeadId) {
      const jobLead = await db.jobLead.findUnique({
        where: { id: input.jobLeadId },
        include: { jobListing: true },
      });
      if (jobLead?.jobListing) {
        company = jobLead.jobListing.company ?? undefined;
        jobTitle = jobLead.title;
      }
    }

    const guidedApplication = await db.guidedApplication.create({
      data: {
        userId: user.id,
        applicationUrl: input.applicationUrl,
        company,
        jobTitle,
        jobLeadId: input.jobLeadId,
        resumeId: input.resumeId ?? user.defaultResumeId ?? undefined,
        coverLetterId: input.coverLetterId,
        status: 'ANALYZING',
        currentStep: 0,
        progress: 0,
      },
    });

    const aiProvider = await getServerAiProvider();
    analyzeApplicationForm(
      guidedApplication.id,
      input.applicationUrl,
      user.id,
      aiProvider,
    );

    revalidateTag(`user:${user.id}:guided-applications`, 'max');

    return { success: true, applicationId: guidedApplication.id };
  } catch (error) {
    console.error('Failed to start guided application:', error);
    return {
      success: false,
      error:
        error instanceof Error ? error.message : 'Failed to start application',
    };
  }
}

async function analyzeApplicationForm(
  applicationId: string,
  applicationUrl: string,
  userId: string,
  aiProvider?: import('@/lib/ai/models').AiProvider,
): Promise<void> {
  try {
    const pageHtml = await fetchPageContent(applicationUrl);

    const analysis = await analyzeFormWithAI(
      pageHtml,
      applicationUrl,
      undefined,
      { aiProvider },
    );

    if (!analysis.success) {
      await db.guidedApplication.update({
        where: { id: applicationId },
        data: {
          status: 'FAILED',
          errorMessage: analysis.error ?? 'Form analysis failed',
        },
      });
      return;
    }

    const userData = await getUserDataForSuggestions(userId);

    const suggestions: FieldSuggestion[] = [];
    for (let i = 0; i < analysis.fields.length; i++) {
      const field = analysis.fields[i];
      const match = await matchFieldToUserData(field.name, field.label, userData);

      suggestions.push({
        fieldName: field.name,
        fieldLabel: field.label,
        fieldType: field.type,
        fieldSelector: field.selector,
        currentValue: field.currentValue,
        suggestedValue: match?.value ?? '',
        suggestedSource: match?.source ?? 'profile',
        confidence: match?.confidence ?? 0,
        isRequired: field.required,
        category: field.category,
      });
    }

    await db.$transaction(async tx => {
      await tx.guidedApplication.update({
        where: { id: applicationId },
        data: {
          status: 'IN_PROGRESS',
          formAnalysis: analysis as object,
          detectedFields: analysis.fields as object[],
          currentStep: analysis.currentStep,
          totalSteps: analysis.totalSteps,
          company: analysis.company,
          jobTitle: analysis.jobTitle,
          jobProvider: analysis.jobProvider,
          progress: 10,
        },
      });

      for (let i = 0; i < suggestions.length; i++) {
        const suggestion = suggestions[i];
        await tx.guidedFieldSuggestion.create({
          data: {
            guidedApplicationId: applicationId,
            fieldName: suggestion.fieldName,
            fieldLabel: suggestion.fieldLabel,
            fieldType: suggestion.fieldType,
            fieldSelector: suggestion.fieldSelector,
            currentValue: suggestion.currentValue,
            suggestedValue: suggestion.suggestedValue,
            suggestedSource: suggestion.suggestedSource,
            confidence: suggestion.confidence,
            isRequired: suggestion.isRequired,
            category: suggestion.category,
            displayOrder: i,
            status: 'PENDING',
          },
        });
      }
    });

    revalidateTag(`user:${userId}:guided-applications`, 'max');
    revalidateTag(`guided-application:${applicationId}`, 'max');
  } catch (error) {
    console.error('Form analysis error:', error);
    await db.guidedApplication.update({
      where: { id: applicationId },
      data: {
        status: 'FAILED',
        errorMessage:
          error instanceof Error ? error.message : 'Analysis failed',
      },
    });
  }
}

async function fetchPageContent(url: string): Promise<string> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    return await response.text();
  } catch (error) {
    console.error('Page fetch error:', error);
    throw new Error('Could not access the application page');
  }
}

function revalidateGuidedApplicationQueueTags(
  userId: string,
  applicationId: string,
): void {
  try {
    revalidateTag(`user:${userId}:guided-applications`, 'max');
    revalidateTag(`guided-application:${applicationId}`, 'max');
  } catch (error) {
    console.warn('Desktop queue cache revalidation skipped:', error);
  }
}

export async function getGuidedApplicationProgress(
  applicationId: string,
): Promise<GuidedApplicationProgress | null> {
  const user = await getCurrentUser();
  if (!user) return null;

  const application = await db.guidedApplication.findFirst({
    where: { id: applicationId, userId: user.id },
    include: {
      fieldSuggestions: {
        orderBy: { displayOrder: 'asc' },
      },
    },
  });

  if (!application) return null;

  const desktopQueueItem = await db.jobQueueItem.findFirst({
    orderBy: { createdAt: 'desc' },
    select: { id: true },
    where: {
      deduplicationKey: `desktop-submit:${application.id}`,
      status: { in: ['PENDING', 'PROCESSING'] },
      type: JobType.DESKTOP_SUBMIT_REQUEST,
      userId: user.id,
    },
  });

  return {
    applicationId: application.id,
    status: application.status,
    currentStep: application.currentStep,
    totalSteps: application.totalSteps ?? undefined,
    progress: application.progress,
    desktopQueueItemId: desktopQueueItem?.id,
    jobLeadId: application.jobLeadId ?? undefined,
    screenshotUrl: application.lastScreenshotUrl ?? undefined,
    fields: application.fieldSuggestions.map(s => ({
      id: s.id,
      fieldName: s.fieldName,
      fieldLabel: s.fieldLabel ?? undefined,
      status: s.status,
      suggestedValue: s.suggestedValue ?? undefined,
      userValue: s.userValue ?? undefined,
      isRequired: s.isRequired,
    })),
    error: application.errorMessage ?? undefined,
  };
}

export async function enqueueDesktopSubmitRequest(
  applicationId: string,
): Promise<EnqueueDesktopSubmitRequestResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, applicationId, error: 'Not authenticated' };
  }

  try {
    const application = await db.guidedApplication.findFirst({
      where: { id: applicationId, userId: user.id },
      select: {
        applicationUrl: true,
        company: true,
        coverLetterId: true,
        id: true,
        jobLeadId: true,
        jobTitle: true,
        resumeId: true,
        status: true,
      },
    });

    if (!application) {
      return { success: false, applicationId, error: 'Application not found' };
    }

    if (!application.jobLeadId) {
      return {
        success: false,
        applicationId,
        error: 'A job lead is required before sending to the desktop queue.',
      };
    }

    if (application.status !== 'READY_TO_SUBMIT') {
      return {
        success: false,
        applicationId,
        error: 'Review all fields before sending to the desktop queue.',
      };
    }

    const queueItem = await enqueueJob({
      deduplicationKey: `desktop-submit:${application.id}`,
      maxRetries: 0,
      payload: {
        applicationUrl: application.applicationUrl,
        company: application.company,
        coverLetterId: application.coverLetterId,
        guidedApplicationId: application.id,
        jobLeadId: application.jobLeadId,
        jobTitle: application.jobTitle,
        requestedAt: new Date().toISOString(),
        resumeId: application.resumeId,
        source: 'web-preview',
        version: 1,
      },
      priority: 10,
      type: JobType.DESKTOP_SUBMIT_REQUEST,
      userId: user.id,
    });

    revalidateGuidedApplicationQueueTags(user.id, applicationId);

    return {
      success: true,
      applicationId,
      queueItemId: queueItem.id,
    };
  } catch (error) {
    console.error('Desktop queue request error:', error);
    return {
      success: false,
      applicationId,
      error:
        error instanceof Error
          ? error.message
          : 'Failed to send to desktop queue',
    };
  }
}

export async function updateFieldSuggestion(
  suggestionId: string,
  status: 'ACCEPTED' | 'REJECTED' | 'MODIFIED' | 'SKIPPED',
  userValue?: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const suggestion = await db.guidedFieldSuggestion.findUnique({
      where: { id: suggestionId },
      include: { guidedApplication: true },
    });

    if (!suggestion || suggestion.guidedApplication.userId !== user.id) {
      return { success: false, error: 'Suggestion not found' };
    }

    await db.guidedFieldSuggestion.update({
      where: { id: suggestionId },
      data: {
        status,
        userValue:
          status === 'MODIFIED'
            ? userValue
            : status === 'ACCEPTED'
              ? suggestion.suggestedValue
              : undefined,
      },
    });

    const allSuggestions = await db.guidedFieldSuggestion.findMany({
      where: { guidedApplicationId: suggestion.guidedApplicationId },
    });

    const completedCount = allSuggestions.filter(
      s => s.status !== 'PENDING',
    ).length;
    const progress =
      Math.round((completedCount / allSuggestions.length) * 80) + 10;

    const allComplete = allSuggestions.every(s => s.status !== 'PENDING');

    await db.guidedApplication.update({
      where: { id: suggestion.guidedApplicationId },
      data: {
        progress,
        status: allComplete ? 'READY_TO_SUBMIT' : 'IN_PROGRESS',
      },
    });

    revalidateTag(`guided-application:${suggestion.guidedApplicationId}`, 'max');

    return { success: true };
  } catch (error) {
    console.error('Update field suggestion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Update failed',
    };
  }
}

export async function pauseGuidedApplication(
  applicationId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    await db.guidedApplication.update({
      where: { id: applicationId, userId: user.id },
      data: {
        status: 'PAUSED',
        pausedAt: new Date(),
      },
    });

    revalidateTag(`user:${user.id}:guided-applications`, 'max');
    revalidateTag(`guided-application:${applicationId}`, 'max');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to pause',
    };
  }
}

export async function resumeGuidedApplication(
  applicationId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    const application = await db.guidedApplication.findFirst({
      where: { id: applicationId, userId: user.id },
    });

    if (!application) {
      return { success: false, error: 'Application not found' };
    }

    const allSuggestions = await db.guidedFieldSuggestion.findMany({
      where: { guidedApplicationId: applicationId },
    });

    const allComplete = allSuggestions.every(s => s.status !== 'PENDING');

    await db.guidedApplication.update({
      where: { id: applicationId },
      data: {
        status: allComplete ? 'READY_TO_SUBMIT' : 'IN_PROGRESS',
        pausedAt: null,
      },
    });

    revalidateTag(`user:${user.id}:guided-applications`, 'max');
    revalidateTag(`guided-application:${applicationId}`, 'max');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to resume',
    };
  }
}

export async function cancelGuidedApplication(
  applicationId: string,
): Promise<{ success: boolean; error?: string }> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, error: 'Not authenticated' };
  }

  try {
    await db.guidedApplication.update({
      where: { id: applicationId, userId: user.id },
      data: {
        status: 'CANCELLED',
      },
    });

    revalidateTag(`user:${user.id}:guided-applications`, 'max');

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to cancel',
    };
  }
}

export async function submitGuidedApplication(
  applicationId: string,
): Promise<SubmitGuidedApplicationResult> {
  const user = await getCurrentUser();
  if (!user) {
    return { success: false, applicationId, error: 'Not authenticated' };
  }

  try {
    const application = await db.guidedApplication.findFirst({
      where: { id: applicationId, userId: user.id },
      include: {
        fieldSuggestions: true,
        jobLead: { include: { jobListing: true } },
      },
    });

    if (!application) {
      return { success: false, applicationId, error: 'Application not found' };
    }

    if (application.status !== 'READY_TO_SUBMIT') {
      return {
        success: false,
        applicationId,
        error:
          'Application is not ready to submit. Please complete all fields.',
      };
    }

    await db.guidedApplication.update({
      where: { id: applicationId },
      data: { status: 'SUBMITTING', progress: 90 },
    });

    const fieldValues: Record<string, string> = {};
    for (const suggestion of application.fieldSuggestions) {
      if (
        suggestion.status === 'ACCEPTED' ||
        suggestion.status === 'MODIFIED'
      ) {
        fieldValues[suggestion.fieldName] =
          suggestion.userValue ?? suggestion.suggestedValue ?? '';
      }
    }

    let submissionId: string | undefined;

    if (application.jobLeadId) {
      const submission = await db.applicationSubmission.create({
        data: {
          userId: user.id,
          jobLeadId: application.jobLeadId,
          resumeId: application.resumeId,
          status: 'SUBMITTED',
          submittedAt: new Date(),
          wasAutomated: false,
          metadata: {
            guidedApplicationId: applicationId,
            fieldValues,
          },
        },
      });

      submissionId = submission.id;

      await db.jobLead.update({
        where: { id: application.jobLeadId },
        data: { status: 'APPLIED' },
      });

      await db.guidedApplication.update({
        where: { id: applicationId },
        data: {
          applicationSubmissionId: submission.id,
        },
      });
    }

    await db.guidedApplication.update({
      where: { id: applicationId },
      data: {
        status: 'SUBMITTED',
        progress: 100,
        submittedAt: new Date(),
        completedAt: new Date(),
      },
    });

    revalidateTag(`user:${user.id}:guided-applications`, 'max');
    revalidateTag(`user:${user.id}:applications`, 'max');
    if (application.jobLeadId) {
      revalidateTag(`user:${user.id}:job-leads`, 'max');
    }

    return {
      success: true,
      applicationId,
      submissionId,
      confirmationCode: `GA-${applicationId.slice(-8).toUpperCase()}`,
    };
  } catch (error) {
    console.error('Submit guided application error:', error);

    await db.guidedApplication.update({
      where: { id: applicationId },
      data: {
        status: 'FAILED',
        errorMessage:
          error instanceof Error ? error.message : 'Submission failed',
      },
    });

    return {
      success: false,
      applicationId,
      error: error instanceof Error ? error.message : 'Submission failed',
    };
  }
}

export async function getActiveGuidedApplications(): Promise<
  Array<{
    id: string;
    applicationUrl: string;
    company?: string;
    jobTitle?: string;
    status: string;
    progress: number;
    updatedAt: Date;
  }>
> {
  const user = await getCurrentUser();
  if (!user) return [];

  const applications = await db.guidedApplication.findMany({
    where: {
      userId: user.id,
      status: {
        in: ['DRAFT', 'IN_PROGRESS', 'PAUSED', 'ANALYZING', 'READY_TO_SUBMIT'],
      },
    },
    orderBy: { updatedAt: 'desc' },
    select: {
      id: true,
      applicationUrl: true,
      company: true,
      jobTitle: true,
      status: true,
      progress: true,
      updatedAt: true,
    },
  });

  return applications.map(app => ({
    ...app,
    company: app.company ?? undefined,
    jobTitle: app.jobTitle ?? undefined,
  }));
}
