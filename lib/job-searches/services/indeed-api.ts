"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { JobProvider, JobSearchStatus } from "@/generated/prisma/client";
import { searchJobs } from "@/lib/api/indeed-client";
import { triggerJobSearchCompletionNotification } from "@/lib/notifications/triggers";
import { createJobSearchListings } from "@/lib/job-searches/services/job-search-listings";

/**
 * Search for jobs on Indeed using the Indeed API
 */
export async function searchIndeedJobsViaAPI({
  jobSearchId,
  searchTerm,
  location,
  radius = 25,
  limit = 25,
  jobType,
  userId,
}: {
  jobSearchId: string;
  searchTerm: string;
  location?: string;
  radius?: number;
  limit?: number;
  jobType?: string;
  userId?: string;
}) {
  const resolvedUserId: string | undefined =
    userId ?? (await getCurrentUser())?.id;
  if (!resolvedUserId) throw new Error("User not found");
  
  const startTime = Date.now();

  try {
    // Update job search status to processing
    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { status: "PROCESSING", progress: 10 },
    });

    // Fetch jobs from Indeed API
    const jobs = await searchJobs({
      q: searchTerm,
      l: location,
      limit,
      radius,
      jt: jobType,
    });
    
    // Update progress
    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { progress: 50 },
    });

    // Save jobs to database
    let totalLinked = 0;
    if (jobs && jobs.length > 0) {
      const jobListings = jobs.map((job) => ({
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        description: job.description,
        jobProvider: JobProvider.INDEED,
        userId: resolvedUserId,
        jobId: job.id,
        applyOptions: {
          applyUrl: job.applyUrl,
        },
        postedAt: job.postedDate,
        jobType: job.jobType,
        remote: job.remote,
      }));

      // Create job listings in batches to avoid timeout
      const batchSize = 25;
      for (let i = 0; i < jobListings.length; i += batchSize) {
        const batch = jobListings.slice(i, i + batchSize);
        const { linkedCount } = await createJobSearchListings({
          jobListings: batch,
          jobSearchId,
          userId: resolvedUserId,
        });
        totalLinked += linkedCount;
      }
    }

    // Mark job search as completed
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    
    await db.jobSearch.update({
      data: { 
        completedAt: new Date(),
        endedAt: new Date(),
        progress: 100,
        status: "COMPLETED",
        totalJobs: totalLinked
      },
      where: { id: jobSearchId },
    });

    // Send completion notification
    await triggerJobSearchCompletionNotification(
      resolvedUserId,
      jobSearchId,
      searchTerm,
      'Indeed',
      totalLinked,
      totalLinked,
      duration,
      'completed'
    );

    return totalLinked;
  } catch (error) {
    console.error("Indeed API job search failed:", error);
    
    const endTime = Date.now();
    const duration = Math.round((endTime - startTime) / 1000);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Update job search status to error
    await db.jobSearch.update({
      where: { id: jobSearchId },
      data: { 
        status: JobSearchStatus.FAILED,
        endedAt: new Date(),
        errorMessage: errorMessage
      },
    });
    
    // Send failure notification
    await triggerJobSearchCompletionNotification(
      resolvedUserId,
      jobSearchId,
      searchTerm,
      'Indeed',
      0,
      0,
      duration,
      'failed',
      errorMessage
    );
    
    throw error;
  }
}

/**
 * Check if the user has valid Indeed API credentials
 */
export async function hasIndeedCredentials(): Promise<boolean> {
  try {
    const user = await getCurrentUser();
    if (!user) return false;

    const integration = await db.userIntegration.findUnique({
      where: {
        userId_provider: {
          userId: user.id,
          provider: "INDEED",
        },
      },
    });

    return !!integration;
  } catch (error) {
    console.error("Error checking Indeed credentials:", error);
    return false;
  }
}
