"use server";

import { ApplicationStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db/client";
import {
  createApplicationStatusNotification as dispatchApplicationStatusNotification,
  createInterviewRequestNotification as dispatchInterviewRequestNotification,
} from "./index";
import type {
  ApplicationStatusNotificationMetadata,
  InterviewRequestNotificationMetadata,
} from "./types";

/**
 * Create a notification for application status changes using the shared dispatchers
 */
export async function createApplicationStatusNotification(
  userId: string,
  applicationId: string,
  previousStatus: ApplicationStatus,
  newStatus: ApplicationStatus,
) {
  try {
    const application = await db.applicationSubmission.findUnique({
      where: { id: applicationId },
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
      },
    });

    if (!application) {
      console.error(`Application not found: ${applicationId}`);
      return;
    }

    const metadata: ApplicationStatusNotificationMetadata = {
      jobLeadId: application.jobLeadId,
      jobTitle: application.jobLead.jobListing.title,
      companyName: application.jobLead.jobListing.company || "the company",
      previousStatus,
      newStatus,
      applicationId,
    };

    await dispatchApplicationStatusNotification(userId, metadata);

    return { success: true };
  } catch (error) {
    console.error("Error creating application status notification:", error);
    return { success: false, error: String(error) };
  }
}

/**
 * Create a notification for interview requests using the shared dispatcher
 */
export async function createInterviewRequestNotification(
  userId: string,
  applicationId: string,
  interviewDetails: {
    date?: string;
    type?: string;
    location?: string;
    contactPerson?: string;
  },
) {
  try {
    const application = await db.applicationSubmission.findUnique({
      where: { id: applicationId },
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
      },
    });

    if (!application) {
      console.error(`Application not found: ${applicationId}`);
      return;
    }

    const metadata: InterviewRequestNotificationMetadata = {
      jobLeadId: application.jobLeadId,
      jobTitle: application.jobLead.jobListing.title,
      companyName: application.jobLead.jobListing.company || "the company",
      interviewDate: interviewDetails.date,
      interviewType: interviewDetails.type,
      interviewLocation: interviewDetails.location,
      contactPerson: interviewDetails.contactPerson,
    };

    await dispatchInterviewRequestNotification(userId, metadata);

    return { success: true };
  } catch (error) {
    console.error("Error creating interview request notification:", error);
    return { success: false, error: String(error) };
  }
}
