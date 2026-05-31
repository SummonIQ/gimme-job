"use server";

import { db } from "@/lib/db/client";
import { ApplicationStatus } from "@/generated/prisma/client";

export interface ApplicationEvent {
  jobLeadId: string;
  userId: string;
  event: string;
  status?: ApplicationStatus;
  metadata?: Record<string, any>;
  error?: string;
}

export async function logApplicationEvent(event: ApplicationEvent) {
  try {
    console.log(`Application Event [${event.event}]:`, {
      jobLeadId: event.jobLeadId,
      userId: event.userId,
      status: event.status,
      metadata: event.metadata,
      error: event.error,
    });

    // Store the event in database for analytics
    // This could be extended to use a dedicated logging table
    if (event.status) {
      await db.jobLead.update({
        where: { id: event.jobLeadId },
        data: {
          status: event.status,
          updatedAt: new Date(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to log application event:", error);
  }
}

export async function logApplicationError(
  jobLeadId: string,
  userId: string,
  error: Error | string,
  context?: Record<string, any>
) {
  await logApplicationEvent({
    jobLeadId,
    userId,
    event: "error",
    error: typeof error === "string" ? error : error.message,
    metadata: context,
  });
}

export async function logApplicationSuccess(
  jobLeadId: string,
  userId: string,
  status: ApplicationStatus,
  metadata?: Record<string, any>
) {
  await logApplicationEvent({
    jobLeadId,
    userId,
    event: "success",
    status,
    metadata,
  });
}