"use server";

import { JobLead, JobLeadStatus } from "@/generated/prisma/client";
import { 
  createApplicationStatusNotification,
  createJobSearchCompletionNotification,
  createResumeAnalysisNotification,
  createAutomationNotification
} from "./index";
import { 
  ApplicationStatusNotificationMetadata,
  JobSearchCompletionNotificationMetadata,
  ResumeAnalysisNotificationMetadata,
  AutomationNotificationMetadata
} from "./types";
import { db } from "@/lib/db/client";

// Extend the ApplicationStatusNotificationMetadata for additional properties
interface ExtendedApplicationStatusMetadata extends ApplicationStatusNotificationMetadata {
  interviewDate?: string;
  interviewType?: string;
  offerSalary?: string;
  rejectionReason?: string;
}

/**
 * Trigger a notification when a job lead status changes
 * @param leadId The ID of the job lead that had a status change
 * @param previousStatus The previous status of the job lead
 * @param newStatus The new status of the job lead
 */
export async function triggerJobLeadStatusNotification(
  leadId: string,
  previousStatus: JobLeadStatus,
  newStatus: JobLeadStatus
): Promise<void> {
  try {
    // Don't notify on certain status transitions that are less important
    const lowPriorityTransitions = [
      // From ADDED to REMOVED (user decided not to pursue)
      { from: JobLeadStatus.ADDED, to: JobLeadStatus.REMOVED },
      // From REMOVED to REJECTED (cleaning up)
      { from: JobLeadStatus.REMOVED, to: JobLeadStatus.REJECTED },
    ];

    const isLowPriority = lowPriorityTransitions.some(
      transition => 
        transition.from === previousStatus && 
        transition.to === newStatus
    );

    if (isLowPriority) {
      console.log(`Skipping notification for low priority transition: ${previousStatus} -> ${newStatus}`);
      return;
    }

    // Fetch the job lead with its job listing to get title and company
    const jobLead = await db.jobLead.findUnique({
      where: { id: leadId },
      include: { jobListing: true },
    });

    if (!jobLead || !jobLead.userId) {
      console.error(`Job lead not found or missing user ID: ${leadId}`);
      return;
    }

    const title = jobLead.jobListing?.title || jobLead.title || "Unknown Position";
    const companyName = jobLead.jobListing?.company || "Unknown Company";

    // Create metadata for the notification
    const metadata: ApplicationStatusNotificationMetadata = {
      jobLeadId: leadId,
      jobTitle: title,
      companyName,
      previousStatus,
      newStatus,
      applicationId: leadId,
    };

    // Create notification for the user
    await createApplicationStatusNotification(jobLead.userId, metadata);

    console.log(`Notification sent for job lead status change: ${previousStatus} -> ${newStatus}`);
  } catch (error) {
    console.error("Error triggering job lead status notification:", error);
  }
}

/**
 * Sends a notification when an interview is scheduled
 * @param leadId The job lead ID
 * @param interviewDate Date of the interview
 * @param interviewType Type of interview (e.g., "Phone", "Video", "In-person")
 */
export async function triggerInterviewScheduledNotification(
  leadId: string,
  interviewDate: Date,
  interviewType?: string
): Promise<void> {
  try {
    // Fetch the job lead with its job listing
    const jobLead = await db.jobLead.findUnique({
      where: { id: leadId },
      include: { jobListing: true },
    });

    if (!jobLead || !jobLead.userId) {
      console.error(`Job lead not found or missing user ID: ${leadId}`);
      return;
    }

    const title = jobLead.jobListing?.title || jobLead.title || "Unknown Position";
    const companyName = jobLead.jobListing?.company || "Unknown Company";

    // Format date for display
    const formattedDate = interviewDate.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
    });

    // Create notification metadata
    const notificationMetadata: ExtendedApplicationStatusMetadata = {
      jobLeadId: leadId,
      jobTitle: title,
      companyName,
      previousStatus: JobLeadStatus.APPLIED,
      newStatus: JobLeadStatus.INTERVIEW_SCHEDULED,
      applicationId: leadId
    };
    
    // Add additional properties for internal use (will be stored in metadata JSON)
    if (formattedDate) {
      (notificationMetadata as any).interviewDate = formattedDate;
    }
    
    if (interviewType) {
      (notificationMetadata as any).interviewType = interviewType;
    }
    
    await createApplicationStatusNotification(jobLead.userId, notificationMetadata);

    console.log(`Interview scheduled notification sent for job lead: ${leadId}`);
  } catch (error) {
    console.error("Error triggering interview scheduled notification:", error);
  }
}

/**
 * Sends a notification when an offer is received
 * @param leadId The job lead ID
 * @param salary Optional salary information
 */
export async function triggerOfferReceivedNotification(
  leadId: string,
  salary?: string
): Promise<void> {
  try {
    // Fetch the job lead with its job listing
    const jobLead = await db.jobLead.findUnique({
      where: { id: leadId },
      include: { jobListing: true },
    });

    if (!jobLead || !jobLead.userId) {
      console.error(`Job lead not found or missing user ID: ${leadId}`);
      return;
    }

    const title = jobLead.jobListing?.title || jobLead.title || "Unknown Position";
    const companyName = jobLead.jobListing?.company || "Unknown Company";

    // Create notification metadata
    const notificationMetadata: ExtendedApplicationStatusMetadata = {
      jobLeadId: leadId,
      jobTitle: title,
      companyName,
      previousStatus: jobLead.status,
      newStatus: JobLeadStatus.OFFER,
      applicationId: leadId
    };
    
    // Add salary info if available (will be stored in metadata JSON)
    if (salary) {
      (notificationMetadata as any).offerSalary = salary;
    }
    
    await createApplicationStatusNotification(jobLead.userId, notificationMetadata);

    console.log(`Offer received notification sent for job lead: ${leadId}`);
  } catch (error) {
    console.error("Error triggering offer received notification:", error);
  }
}

/**
 * Sends a notification when a job lead is rejected
 * @param leadId The job lead ID
 * @param reason Optional rejection reason
 */
export async function triggerRejectionNotification(
  leadId: string,
  reason?: string
): Promise<void> {
  try {
    // Fetch the job lead with its job listing
    const jobLead = await db.jobLead.findUnique({
      where: { id: leadId },
      include: { jobListing: true },
    });

    if (!jobLead || !jobLead.userId) {
      console.error(`Job lead not found or missing user ID: ${leadId}`);
      return;
    }

    const title = jobLead.jobListing?.title || jobLead.title || "Unknown Position";
    const companyName = jobLead.jobListing?.company || "Unknown Company";

    // Create notification metadata
    const notificationMetadata: ExtendedApplicationStatusMetadata = {
      jobLeadId: leadId,
      jobTitle: title,
      companyName,
      previousStatus: jobLead.status,
      newStatus: JobLeadStatus.REJECTED,
      applicationId: leadId
    };
    
    // Add rejection reason if available (will be stored in metadata JSON)
    if (reason) {
      (notificationMetadata as any).rejectionReason = reason;
    }
    
    await createApplicationStatusNotification(jobLead.userId, notificationMetadata);

    console.log(`Rejection notification sent for job lead: ${leadId}`);
  } catch (error) {
    console.error("Error triggering rejection notification:", error);
  }
}

/**
 * Trigger notification when a job search completes
 */
export async function triggerJobSearchCompletionNotification(
  userId: string,
  searchId: string,
  searchQuery: string,
  platform: string,
  jobsFound: number,
  newJobsAdded: number,
  duration: number,
  status: 'completed' | 'failed' | 'partial',
  errorMessage?: string
): Promise<void> {
  try {
    const metadata: JobSearchCompletionNotificationMetadata = {
      searchId,
      searchQuery,
      jobsFound,
      newJobsAdded,
      platform,
      duration,
      status,
      errorMessage
    };

    await createJobSearchCompletionNotification(userId, metadata);
    console.log(`Job search completion notification sent for user: ${userId}, search: ${searchId}`);
  } catch (error) {
    console.error("Error triggering job search completion notification:", error);
  }
}

/**
 * Trigger notification when resume analysis completes
 */
export async function triggerResumeAnalysisNotification(
  userId: string,
  resumeId: string,
  resumeName: string,
  analysisType: 'ats' | 'keyword' | 'optimization',
  status: 'completed' | 'failed',
  score?: number,
  suggestions?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const metadata: ResumeAnalysisNotificationMetadata = {
      resumeId,
      resumeName,
      analysisType,
      score,
      suggestions: suggestions || 0,
      status,
      errorMessage
    };

    await createResumeAnalysisNotification(userId, metadata);
    console.log(`Resume analysis notification sent for user: ${userId}, resume: ${resumeId}`);
  } catch (error) {
    console.error("Error triggering resume analysis notification:", error);
  }
}

/**
 * Trigger notification for automation events
 */
export async function triggerAutomationNotification(
  userId: string,
  automationType: 'application_submission' | 'job_search' | 'resume_analysis',
  status: 'started' | 'completed' | 'failed' | 'paused',
  itemsProcessed: number,
  totalItems: number,
  successCount: number = 0,
  failureCount: number = 0,
  duration?: number,
  errorMessage?: string
): Promise<void> {
  try {
    const metadata: AutomationNotificationMetadata = {
      automationType,
      status,
      itemsProcessed,
      totalItems,
      successCount,
      failureCount,
      duration,
      errorMessage
    };

    await createAutomationNotification(userId, metadata);
    console.log(`Automation notification sent for user: ${userId}, type: ${automationType}, status: ${status}`);
  } catch (error) {
    console.error("Error triggering automation notification:", error);
  }
}
