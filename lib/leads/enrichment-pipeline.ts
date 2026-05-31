"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { LeadDataProvider, DataQualityScore, LeadStatus } from "@/generated/prisma/client";
import * as apolloClient from "@/lib/api/apollo-client";
import * as zoomInfoClient from "@/lib/api/zoominfo-client";

/**
 * Lead Enrichment Pipeline
 * Orchestrates lead data enrichment using Apollo.io and ZoomInfo
 * Implements fallback strategy and data quality validation
 */

export interface EnrichmentRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyDomain?: string;
  searchQuery?: string;
  prioritizeQuality?: boolean;
}

export interface EnrichmentResult {
  leadId?: string;
  success: boolean;
  dataProvider: LeadDataProvider;
  dataQuality: DataQualityScore;
  message: string;
  errors?: string[];
}

export interface SearchRequest {
  keywords?: string;
  jobTitles?: string[];
  companies?: string[];
  industries?: string[];
  locations?: string[];
  companySize?: string[];
  limit?: number;
  userId: string;
}

export interface SearchResult {
  searchResultId: string;
  totalResults: number;
  processedResults: number;
  queuedForEnrichment: number;
  errors?: string[];
}

/**
 * Queue a lead search result for enrichment processing
 */
export async function queueLeadForEnrichment(
  searchResultId: string,
  priority: "HIGH" | "NORMAL" | "LOW" = "NORMAL"
): Promise<void> {
  await db.leadEnrichmentQueue.create({
    data: {
      searchResultId,
      priority,
      status: "QUEUED",
      attempts: 0,
      scheduledAt: new Date(),
    },
  });
}

/**
 * Process a single lead enrichment from the queue
 */
export async function processLeadEnrichment(queueId: string): Promise<EnrichmentResult> {
  const queueItem = await db.leadEnrichmentQueue.findUnique({
    where: { id: queueId },
    include: {
      searchResult: true,
    },
  });

  if (!queueItem) {
    throw new Error("Queue item not found");
  }

  // Update status to processing
  await db.leadEnrichmentQueue.update({
    where: { id: queueId },
    data: {
      status: "PROCESSING",
      startedAt: new Date(),
      attempts: { increment: 1 },
    },
  });

  try {
    const searchResult = queueItem.searchResult;
    if (!searchResult) {
      throw new Error("Search result not found");
    }

    // Prepare enrichment request
    const enrichmentRequest: EnrichmentRequest = {
      email: searchResult.email || undefined,
      firstName: searchResult.firstName || undefined,
      lastName: searchResult.lastName || undefined,
      companyName: searchResult.companyName || undefined,
      companyDomain: searchResult.companyDomain || undefined,
      prioritizeQuality: true,
    };

    // Attempt enrichment with fallback strategy
    const result = await enrichLeadWithFallback(enrichmentRequest);

    // Update queue item
    await db.leadEnrichmentQueue.update({
      where: { id: queueId },
      data: {
        status: result.success ? "COMPLETED" : "FAILED",
        completedAt: new Date(),
        dataProvider: result.dataProvider,
        dataQuality: result.dataQuality,
        error: result.success ? null : result.message,
      },
    });

    // Update search result
    if (result.leadId) {
      await db.leadSearchResult.update({
        where: { id: searchResult.id },
        data: {
          enrichedLeadId: result.leadId,
          processingStatus: "COMPLETED",
          processedAt: new Date(),
        },
      });
    }

    return result;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";

    // Update queue item as failed
    await db.leadEnrichmentQueue.update({
      where: { id: queueId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        error: errorMessage,
      },
    });

    return {
      success: false,
      dataProvider: LeadDataProvider.MANUAL,
      dataQuality: DataQualityScore.POOR,
      message: errorMessage,
    };
  }
}

/**
 * Enrich a lead with fallback strategy (Apollo.io -> ZoomInfo)
 */
export async function enrichLeadWithFallback(
  request: EnrichmentRequest
): Promise<EnrichmentResult> {
  let lastError: string[] = [];

  // Strategy 1: Try Apollo.io first
  try {
    console.log("Attempting Apollo.io enrichment...");

    if (request.email) {
      const apolloPerson = await apolloClient.enrichPerson(request.email);
      const leadId = await apolloClient.saveEnrichedLead(apolloPerson);

      return {
        leadId,
        success: true,
        dataProvider: LeadDataProvider.APOLLO,
        dataQuality: DataQualityScore.GOOD,
        message: "Successfully enriched with Apollo.io",
      };
    } else if (request.firstName && request.lastName && request.companyDomain) {
      // Try to find email first, then enrich
      const emailResult = await apolloClient.findEmail(
        request.firstName,
        request.lastName,
        request.companyDomain
      );

      if (emailResult.email && emailResult.confidence > 0.7) {
        const apolloPerson = await apolloClient.enrichPerson(emailResult.email);
        const leadId = await apolloClient.saveEnrichedLead(apolloPerson);

        return {
          leadId,
          success: true,
          dataProvider: LeadDataProvider.APOLLO,
          dataQuality: DataQualityScore.GOOD,
          message: "Successfully enriched with Apollo.io (via email finder)",
        };
      }
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "Apollo.io enrichment failed";
    lastError.push(errorMsg);
    console.warn("Apollo.io enrichment failed:", errorMsg);
  }

  // Strategy 2: Fallback to ZoomInfo
  try {
    console.log("Attempting ZoomInfo fallback enrichment...");

    const zoomInfoRequest = {
      email: request.email,
      firstName: request.firstName,
      lastName: request.lastName,
      companyName: request.companyName,
      companyDomain: request.companyDomain,
    };

    const zoomInfoPerson = await zoomInfoClient.enrichPerson(zoomInfoRequest);
    const leadId = await zoomInfoClient.saveEnrichedLead(zoomInfoPerson);

    return {
      leadId,
      success: true,
      dataProvider: LeadDataProvider.ZOOMINFO,
      dataQuality: DataQualityScore.GOOD,
      message: "Successfully enriched with ZoomInfo (fallback)",
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : "ZoomInfo enrichment failed";
    lastError.push(errorMsg);
    console.warn("ZoomInfo enrichment failed:", errorMsg);
  }

  // Both strategies failed
  return {
    success: false,
    dataProvider: LeadDataProvider.MANUAL,
    dataQuality: DataQualityScore.POOR,
    message: "All enrichment strategies failed",
    errors: lastError,
  };
}

/**
 * Search for prospects using both Apollo.io and ZoomInfo
 */
export async function searchProspects(request: SearchRequest): Promise<SearchResult> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Create search record
  const leadSearch = await db.leadSearch.create({
    data: {
      userId: user.id,
      searchQuery: request.keywords || "",
      filters: {
        jobTitles: request.jobTitles || [],
        companies: request.companies || [],
        industries: request.industries || [],
        locations: request.locations || [],
        companySize: request.companySize || [],
      },
      status: "PROCESSING",
      totalResults: 0,
    },
  });

  let totalResults = 0;
  let processedResults = 0;
  let queuedForEnrichment = 0;
  const errors: string[] = [];

  // Search with Apollo.io first
  try {
    console.log("Searching with Apollo.io...");

    const apolloSearchRequest = {
      q_keywords: request.keywords,
      person_titles: request.jobTitles,
      organization_names: request.companies,
      organization_industries: request.industries,
      organization_locations: request.locations,
      limit: request.limit || 50,
    };

    const apolloResults = await apolloClient.searchPeople(apolloSearchRequest);
    totalResults += apolloResults.people.length;

    // Process and queue results
    for (const person of apolloResults.people) {
      try {
        const searchResult = await db.leadSearchResult.create({
          data: {
            leadSearchId: leadSearch.id,
            firstName: person.first_name,
            lastName: person.last_name,
            email: person.email,
            jobTitle: person.title,
            companyName: person.organization.name,
            companyDomain: person.organization.domain,
            dataProvider: LeadDataProvider.APOLLO,
            externalId: person.id,
            processingStatus: "QUEUED",
          },
        });

        await queueLeadForEnrichment(searchResult.id, "NORMAL");
        queuedForEnrichment++;
        processedResults++;
      } catch (error) {
        const errorMsg = `Failed to process Apollo result: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = `Apollo.io search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.warn(errorMsg);
  }

  // Search with ZoomInfo as additional source
  try {
    console.log("Searching with ZoomInfo...");

    const zoomInfoSearchRequest = {
      keywords: request.keywords,
      jobTitle: request.jobTitles?.[0], // ZoomInfo typically takes single values
      industry: request.industries?.[0],
      location: request.locations?.[0],
      limit: Math.min(request.limit || 25, 25), // ZoomInfo might have lower limits
    };

    const zoomInfoResults = await zoomInfoClient.searchPeople(zoomInfoSearchRequest);
    totalResults += zoomInfoResults.data.length;

    // Process and queue results (avoid duplicates by email)
    for (const person of zoomInfoResults.data) {
      try {
        // Check if we already have this person from Apollo
        const existingResult = await db.leadSearchResult.findFirst({
          where: {
            leadSearchId: leadSearch.id,
            email: person.email,
          },
        });

        if (existingResult) {
          // Skip duplicate
          continue;
        }

        const searchResult = await db.leadSearchResult.create({
          data: {
            leadSearchId: leadSearch.id,
            firstName: person.firstName,
            lastName: person.lastName,
            email: person.email,
            jobTitle: person.jobTitle,
            companyName: person.company.name,
            companyDomain: person.company.domain,
            dataProvider: LeadDataProvider.ZOOMINFO,
            externalId: person.id,
            processingStatus: "QUEUED",
          },
        });

        await queueLeadForEnrichment(searchResult.id, "LOW"); // Lower priority for ZoomInfo
        queuedForEnrichment++;
        processedResults++;
      } catch (error) {
        const errorMsg = `Failed to process ZoomInfo result: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.warn(errorMsg);
      }
    }
  } catch (error) {
    const errorMsg = `ZoomInfo search failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    errors.push(errorMsg);
    console.warn(errorMsg);
  }

  // Update search record
  await db.leadSearch.update({
    where: { id: leadSearch.id },
    data: {
      status: "COMPLETED",
      totalResults,
      completedAt: new Date(),
    },
  });

  return {
    searchResultId: leadSearch.id,
    totalResults,
    processedResults,
    queuedForEnrichment,
    errors: errors.length > 0 ? errors : undefined,
  };
}

/**
 * Process queued lead enrichments (worker function)
 */
export async function processEnrichmentQueue(batchSize: number = 10): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  console.log(`Processing enrichment queue with batch size: ${batchSize}`);

  // Get pending queue items
  const queueItems = await db.leadEnrichmentQueue.findMany({
    where: {
      status: "QUEUED",
      OR: [
        { scheduledAt: { lte: new Date() } },
        { scheduledAt: null },
      ],
    },
    orderBy: [
      { priority: "desc" },
      { createdAt: "asc" },
    ],
    take: batchSize,
  });

  if (queueItems.length === 0) {
    console.log("No items in enrichment queue");
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  console.log(`Processing ${queueItems.length} queued enrichments`);

  let succeeded = 0;
  let failed = 0;

  // Process each item
  for (const queueItem of queueItems) {
    try {
      const result = await processLeadEnrichment(queueItem.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    } catch (error) {
      console.error(`Failed to process queue item ${queueItem.id}:`, error);
      failed++;
    }
  }

  console.log(`Enrichment processing complete: ${succeeded} succeeded, ${failed} failed`);

  return {
    processed: queueItems.length,
    succeeded,
    failed,
  };
}

/**
 * Get enrichment queue status
 */
export async function getEnrichmentQueueStatus(): Promise<{
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  retrying: number;
}> {
  const [queued, processing, completed, failed, retrying] = await Promise.all([
    db.leadEnrichmentQueue.count({ where: { status: "QUEUED" } }),
    db.leadEnrichmentQueue.count({ where: { status: "PROCESSING" } }),
    db.leadEnrichmentQueue.count({ where: { status: "COMPLETED" } }),
    db.leadEnrichmentQueue.count({ where: { status: "FAILED" } }),
    db.leadEnrichmentQueue.count({ where: { status: "RETRYING" } }),
  ]);

  return { queued, processing, completed, failed, retrying };
}

/**
 * Retry failed enrichments
 */
export async function retryFailedEnrichments(maxRetries: number = 3): Promise<number> {
  // Find failed items that haven't exceeded max retries
  const failedItems = await db.leadEnrichmentQueue.findMany({
    where: {
      status: "FAILED",
      attempts: { lt: maxRetries },
    },
    orderBy: { updatedAt: "asc" },
    take: 50, // Limit batch size
  });

  if (failedItems.length === 0) {
    return 0;
  }

  // Reset them to queued for retry
  await db.leadEnrichmentQueue.updateMany({
    where: {
      id: { in: failedItems.map(item => item.id) },
    },
    data: {
      status: "RETRYING",
      scheduledAt: new Date(Date.now() + 5 * 60 * 1000), // Retry in 5 minutes
      error: null,
    },
  });

  return failedItems.length;
}