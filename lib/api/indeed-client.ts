"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";

/**
 * Indeed API Client
 * This client handles interactions with the Indeed API for job search
 * Indeed doesn't provide an official application API, so we'll use their job search API
 * and handle external application redirection
 */

// API Configuration
const INDEED_API_BASE = "https://api.indeed.com/ads";
const INDEED_AUTH_URL = "https://secure.indeed.com/oauth/v2";

// Indeed API requires a publisher ID which is provided after registration
// https://developer.indeed.com/docs/publisher-api/

interface IndeedJob {
  id: string;
  title: string;
  company: string;
  location: string;
  description?: string;
  url?: string;
  applyUrl?: string;
  postedDate?: Date;
  salary?: string;
  jobType?: string;
  remote?: boolean;
}

interface IndeedSearchParams {
  q: string;              // Query (job title, keywords, company name)
  l?: string;             // Location
  limit?: number;         // Number of results per page (default: 10, max: 25)
  start?: number;         // Start results at this result number (0-based index)
  sort?: "relevance" | "date"; // Sort method
  radius?: number;        // Distance from search location in miles (default: 25)
  jt?: string;            // Job type (fulltime, parttime, contract, etc.)
  fromage?: number;       // Number of days back to search (default: 30)
  highlight?: boolean;    // Whether to include HTML highlights (default: false)
  filter?: boolean;       // Filter duplicate results (default: true)
}

/**
 * Search for jobs on Indeed
 */
export async function searchJobs(
  params: IndeedSearchParams
): Promise<IndeedJob[]> {
  const publisherId = process.env.INDEED_PUBLISHER_ID;
  
  if (!publisherId) {
    throw new Error("INDEED_PUBLISHER_ID is not set");
  }

  // Create URL with parameters
  const url = new URL(`${INDEED_API_BASE}/apisearch`);
  url.searchParams.append("publisher", publisherId);
  url.searchParams.append("v", "2");
  url.searchParams.append("format", "json");
  
  // Add search parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, value.toString());
    }
  });

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Indeed job search failed: ${error}`);
    }

    const data = await response.json();
    
    // Check if results exist
    if (!data.results || !Array.isArray(data.results)) {
      return [];
    }

    // Transform Indeed API results to our format
    return data.results.map((job: any) => ({
      id: job.jobkey,
      title: job.jobtitle,
      company: job.company,
      location: `${job.city}, ${job.state}`,
      description: job.snippet,
      url: job.url,
      applyUrl: job.url, // Indeed doesn't provide separate apply URLs
      postedDate: job.date ? new Date(job.date) : undefined,
      salary: job.formattedRelativeTime,
      jobType: job.jobtype,
      remote: job.formattedLocation?.toLowerCase().includes("remote"),
    }));
  } catch (error) {
    console.error("Indeed API error:", error);
    throw error;
  }
}

/**
 * Get detailed job information
 */
export async function getJobDetails(jobId: string): Promise<IndeedJob | null> {
  const publisherId = process.env.INDEED_PUBLISHER_ID;
  
  if (!publisherId) {
    throw new Error("INDEED_PUBLISHER_ID is not set");
  }

  const url = new URL(`${INDEED_API_BASE}/apigetjobs`);
  url.searchParams.append("publisher", publisherId);
  url.searchParams.append("jobkeys", jobId);
  url.searchParams.append("v", "2");
  url.searchParams.append("format", "json");

  try {
    const response = await fetch(url.toString(), {
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Indeed job details fetch failed: ${error}`);
    }

    const data = await response.json();
    
    if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
      return null;
    }

    const job = data.results[0];
    
    return {
      id: job.jobkey,
      title: job.jobtitle,
      company: job.company,
      location: `${job.city}, ${job.state}`,
      description: job.snippet,
      url: job.url,
      applyUrl: job.url,
      postedDate: job.date ? new Date(job.date) : undefined,
      salary: job.formattedRelativeTime,
      jobType: job.jobtype,
      remote: job.formattedLocation?.toLowerCase().includes("remote"),
    };
  } catch (error) {
    console.error("Indeed job details API error:", error);
    throw error;
  }
}

/**
 * Store Indeed API key for the current user
 */
export async function storeApiKey(apiKey: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Store API key securely
  await db.userIntegration.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "INDEED",
      },
    },
    update: {
      accessToken: apiKey,
    },
    create: {
      userId: user.id,
      provider: "INDEED",
      accessToken: apiKey,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // Set expiry to 1 year
    },
  });
}

/**
 * Get stored Indeed API key for the current user
 */
export async function getApiKey(): Promise<string | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const integration = await db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "INDEED",
      },
    },
  });

  return integration?.accessToken || null;
}

/**
 * Check if user has Indeed API key
 */
export async function hasIndeedApiKey(): Promise<boolean> {
  const apiKey = await getApiKey();
  return apiKey !== null;
}
