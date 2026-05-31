"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { SubmissionParams, SubmissionResult } from "./index";
import { 
  getLinkedInJobDetails, 
  canApplyToJob, 
  prepareApplicationData,
  LinkedInApplicationData 
} from "@/lib/api/linkedin-jobs";
import { applyToJob as applyViaAPI } from "@/lib/api/linkedin-client";
import { submitApplication as submitViaWebAutomation } from "./linkedin";
import { validateApplicationSafety } from "@/lib/automation/safety-validator";
import { createAuditLog } from "@/lib/automation/audit";
import { JobProvider, ApplicationStatus } from "@/generated/prisma/client";

/**
 * Enhanced LinkedIn application submission with API-first approach and web automation fallback
 */
export async function submitLinkedInApplication(params: SubmissionParams): Promise<SubmissionResult> {
  const { jobId, jobUrl, resumeData, coverLetterData, customFields } = params;
  
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      error: "User not authenticated",
    };
  }

  try {
    // Step 1: Check if we can apply to this job (rate limits, duplicates, etc.)
    const canApply = await canApplyToJob(jobId);
    if (!canApply.canApply) {
      await createAuditLog({
        userId: user.id,
        action: "APPLICATION_BLOCKED",
        details: {
          jobId,
          reason: canApply.reason,
          platform: "LINKEDIN",
        },
      });

      return {
        success: false,
        error: canApply.reason,
      };
    }

    // Step 2: Validate against automation safety rules
    const automationSettings = await db.automationSettings.findUnique({
      where: { userId: user.id },
    });

    if (automationSettings?.enabled) {
      const safetyCheck = await validateApplicationSafety(
        user.id,
        {
          jobId,
          jobUrl: jobUrl || `https://www.linkedin.com/jobs/view/${jobId}`,
          company: customFields?.companyName || "Unknown",
          title: customFields?.jobTitle || "Unknown",
          salary: customFields?.salary,
        }
      );

      if (!safetyCheck.isValid) {
        await createAuditLog({
          userId: user.id,
          action: "APPLICATION_SAFETY_BLOCKED",
          details: {
            jobId,
            violations: safetyCheck.violations,
            platform: "LINKEDIN",
          },
        });

        return {
          success: false,
          error: `Safety check failed: ${safetyCheck.violations.join(", ")}`,
        };
      }
    }

    // Step 3: Get job details to determine application method
    const jobDetails = await getLinkedInJobDetails(jobId);
    
    // Step 4: Prepare application data with profile mapping
    const applicationData = await prepareApplicationData(
      jobId,
      customFields?.resumeId,
      customFields?.coverLetterId
    );

    // Add any custom question answers if provided
    if (customFields?.questionAnswers) {
      applicationData.questionAnswers = customFields.questionAnswers;
    }

    // Step 5: Create application submission record (pending status)
    const submission = await db.applicationSubmission.create({
      data: {
        userId: user.id,
        jobLeadId: customFields?.jobLeadId,
        jobBoardJobId: jobId,
        platform: "LINKEDIN",
        status: ApplicationStatus.PENDING,
        submittedAt: new Date(),
        applicationData: JSON.stringify(applicationData),
        metadata: {
          jobTitle: jobDetails.title,
          company: jobDetails.company.name,
          easyApply: jobDetails.easyApply,
          location: jobDetails.location,
        },
      },
    });

    let result: SubmissionResult;

    // Step 6: Try API-based application first (if Easy Apply is available)
    if (jobDetails.easyApply) {
      try {
        await createAuditLog({
          userId: user.id,
          action: "APPLICATION_ATTEMPT_API",
          details: {
            jobId,
            method: "LinkedIn API",
            submissionId: submission.id,
          },
        });

        const apiResult = await applyViaAPI(
          jobId,
          applicationData.resumeId || "",
          applicationData.coverLetterId
        );

        if (apiResult.success) {
          result = {
            success: true,
            applicationId: submission.id,
            confirmationCode: `LI-API-${submission.id}`,
            metadata: {
              method: "API",
              message: apiResult.message,
              submissionId: submission.id,
            },
          };
        } else if (apiResult.redirectUrl) {
          // Easy Apply not available, need to redirect to external application
          result = {
            success: false,
            error: apiResult.message,
            metadata: {
              redirectUrl: apiResult.redirectUrl,
              requiresManualApplication: true,
              submissionId: submission.id,
            },
          };
        } else {
          throw new Error(apiResult.message);
        }
      } catch (apiError) {
        console.error("LinkedIn API application failed, falling back to web automation:", apiError);
        
        // Fallback to web automation
        result = await attemptWebAutomation(
          params,
          applicationData,
          submission.id,
          user.id
        );
      }
    } else {
      // No Easy Apply available, use web automation
      result = await attemptWebAutomation(
        params,
        applicationData,
        submission.id,
        user.id
      );
    }

    // Step 7: Update submission record with result
    await db.applicationSubmission.update({
      where: { id: submission.id },
      data: {
        status: result.success ? ApplicationStatus.SUBMITTED : ApplicationStatus.FAILED,
        confirmationCode: result.confirmationCode,
        errorMessage: result.error,
        completedAt: new Date(),
        metadata: {
          ...submission.metadata,
          ...result.metadata,
        },
      },
    });

    // Step 8: Create audit log for the result
    await createAuditLog({
      userId: user.id,
      action: result.success ? "APPLICATION_SUBMITTED" : "APPLICATION_FAILED",
      details: {
        jobId,
        submissionId: submission.id,
        method: result.metadata?.method || "unknown",
        error: result.error,
        platform: "LINKEDIN",
      },
    });

    // Step 9: Update job lead status if linked
    if (customFields?.jobLeadId && result.success) {
      await db.jobLead.update({
        where: { id: customFields.jobLeadId },
        data: {
          status: "APPLIED",
          appliedAt: new Date(),
          applicationSubmissionId: submission.id,
        },
      });
    }

    return result;

  } catch (error) {
    console.error("LinkedIn application submission error:", error);
    
    await createAuditLog({
      userId: user.id,
      action: "APPLICATION_ERROR",
      details: {
        jobId,
        error: error instanceof Error ? error.message : "Unknown error",
        platform: "LINKEDIN",
      },
    });

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error during LinkedIn submission",
    };
  }
}

/**
 * Attempt web automation as fallback
 */
async function attemptWebAutomation(
  params: SubmissionParams,
  applicationData: LinkedInApplicationData,
  submissionId: string,
  userId: string
): Promise<SubmissionResult> {
  try {
    await createAuditLog({
      userId,
      action: "APPLICATION_ATTEMPT_WEB",
      details: {
        jobId: params.jobId,
        method: "Web Automation",
        submissionId,
      },
    });

    // Get LinkedIn credentials from integration
    const integration = await db.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: "LINKEDIN",
        },
      },
    });

    if (!integration) {
      throw new Error("LinkedIn integration not found. Please reconnect your LinkedIn account.");
    }

    // Prepare credentials for web automation
    const enhancedParams: SubmissionParams = {
      ...params,
      customFields: {
        ...params.customFields,
        linkedinCredentials: {
          email: applicationData.profileData.email,
          // Note: We don't store passwords - user would need to provide this securely
          password: params.customFields?.linkedinPassword,
        },
        ...applicationData.profileData,
        questionAnswers: applicationData.questionAnswers,
      },
    };

    // Use existing web automation service
    const webResult = await submitViaWebAutomation(enhancedParams);

    return {
      ...webResult,
      applicationId: submissionId,
      metadata: {
        ...webResult.metadata,
        method: "Web Automation",
        submissionId,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Web automation failed",
      metadata: {
        method: "Web Automation",
        submissionId,
      },
    };
  }
}

/**
 * Check application status for a LinkedIn job
 */
export async function checkLinkedInApplicationStatus(
  jobId: string
): Promise<{ applied: boolean; applicationId?: string; appliedAt?: Date }> {
  const user = await getCurrentUser();
  if (!user) {
    return { applied: false };
  }

  const submission = await db.applicationSubmission.findFirst({
    where: {
      userId: user.id,
      jobBoardJobId: jobId,
      platform: "LINKEDIN",
      status: { in: [ApplicationStatus.SUBMITTED, ApplicationStatus.PENDING] },
    },
    orderBy: { submittedAt: "desc" },
  });

  if (submission) {
    return {
      applied: true,
      applicationId: submission.id,
      appliedAt: submission.submittedAt,
    };
  }

  return { applied: false };
}

/**
 * Get LinkedIn application history
 */
export async function getLinkedInApplicationHistory(
  limit: number = 50,
  offset: number = 0
): Promise<{
  applications: Array<{
    id: string;
    jobId: string;
    jobTitle?: string;
    company?: string;
    status: ApplicationStatus;
    submittedAt: Date;
    method?: string;
    error?: string;
  }>;
  total: number;
}> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const [applications, total] = await Promise.all([
    db.applicationSubmission.findMany({
      where: {
        userId: user.id,
        platform: "LINKEDIN",
      },
      orderBy: { submittedAt: "desc" },
      skip: offset,
      take: limit,
    }),
    db.applicationSubmission.count({
      where: {
        userId: user.id,
        platform: "LINKEDIN",
      },
    }),
  ]);

  return {
    applications: applications.map(app => ({
      id: app.id,
      jobId: app.jobBoardJobId || "",
      jobTitle: (app.metadata as any)?.jobTitle,
      company: (app.metadata as any)?.company,
      status: app.status,
      submittedAt: app.submittedAt,
      method: (app.metadata as any)?.method,
      error: app.errorMessage || undefined,
    })),
    total,
  };
}

/**
 * Retry a failed LinkedIn application
 */
export async function retryLinkedInApplication(
  applicationId: string
): Promise<SubmissionResult> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      success: false,
      error: "User not authenticated",
    };
  }

  const originalSubmission = await db.applicationSubmission.findFirst({
    where: {
      id: applicationId,
      userId: user.id,
      platform: "LINKEDIN",
      status: ApplicationStatus.FAILED,
    },
  });

  if (!originalSubmission) {
    return {
      success: false,
      error: "Original application not found or not eligible for retry",
    };
  }

  // Parse application data
  const applicationData = JSON.parse(originalSubmission.applicationData as string) as LinkedInApplicationData;

  // Retry the application
  return submitLinkedInApplication({
    jobId: originalSubmission.jobBoardJobId || "",
    jobUrl: (originalSubmission.metadata as any)?.jobUrl,
    customFields: {
      jobLeadId: originalSubmission.jobLeadId || undefined,
      ...applicationData,
    },
  });
}