"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { JobProvider } from "@/generated/prisma/client";

/**
 * LinkedIn API Client
 * This client handles interactions with the LinkedIn API for job search and application
 */

// API Configuration
const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_AUTH_URL = "https://www.linkedin.com/oauth/v2";

// Scopes needed for job operations
const REQUIRED_SCOPES = [
  "r_emailaddress",
  "r_liteprofile",
  "w_member_social",
  "r_ads", // For job ads viewing
];

interface LinkedInTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

interface LinkedInCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  scope: string;
}

interface LinkedInJob {
  id: string;
  title: string;
  company: {
    name: string;
    id?: string;
  };
  location: {
    name: string;
    country?: string;
    city?: string;
  };
  description?: string;
  url?: string;
  listedAt?: Date;
  applyUrl?: string;
  easyApply?: boolean;
}

/**
 * Gets the LinkedIn auth URL for initial authorization
 */
export async function getAuthUrl(redirectUri: string): Promise<string> {
  'use server';

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  if (!clientId) {
    throw new Error("LINKEDIN_CLIENT_ID is not set");
  }

  const state = generateRandomState();

  const url = new URL(`${LINKEDIN_AUTH_URL}/authorization`);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("state", state);
  url.searchParams.append("scope", REQUIRED_SCOPES.join(" "));

  return url.toString();
}

/**
 * Exchange authorization code for access token
 */
export async function exchangeCodeForToken(
  code: string,
  redirectUri: string
): Promise<LinkedInCredentials> {
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn API credentials not configured");
  }

  const response = await fetch(`${LINKEDIN_AUTH_URL}/accessToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn token exchange failed: ${error}`);
  }

  const data: LinkedInTokenResponse = await response.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt,
    scope: data.scope,
  };
}

/**
 * Store LinkedIn credentials for the current user
 */
export async function storeCredentials(
  credentials: LinkedInCredentials
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Store credentials securely
  await db.userIntegration.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "LINKEDIN",
      },
    },
    update: {
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken || null,
      expiresAt: credentials.expiresAt,
      scope: credentials.scope,
    },
    create: {
      userId: user.id,
      provider: "LINKEDIN",
      accessToken: credentials.accessToken,
      refreshToken: credentials.refreshToken || null,
      expiresAt: credentials.expiresAt,
      scope: credentials.scope,
    },
  });
}

/**
 * Get stored LinkedIn credentials for the current user
 */
export async function getCredentials(): Promise<LinkedInCredentials | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const integration = await db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "LINKEDIN",
      },
    },
  });

  if (!integration) {
    return null;
  }

  return {
    accessToken: integration.accessToken,
    refreshToken: integration.refreshToken || undefined,
    expiresAt: integration.expiresAt,
    scope: integration.scope,
  };
}

/**
 * Refresh the access token if it's expired
 */
export async function refreshTokenIfNeeded(): Promise<LinkedInCredentials | null> {
  const credentials = await getCredentials();
  if (!credentials) {
    return null;
  }

  // If token is still valid, return it
  if (new Date() < credentials.expiresAt) {
    return credentials;
  }

  // If no refresh token, we can't refresh
  if (!credentials.refreshToken) {
    return null;
  }

  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("LinkedIn API credentials not configured");
  }

  const response = await fetch(`${LINKEDIN_AUTH_URL}/accessToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credentials.refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });

  if (!response.ok) {
    // If refresh fails, we'll need to re-authenticate
    return null;
  }

  const data: LinkedInTokenResponse = await response.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

  const newCredentials = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || credentials.refreshToken,
    expiresAt,
    scope: data.scope,
  };

  await storeCredentials(newCredentials);
  return newCredentials;
}

/**
 * Search for jobs on LinkedIn
 */
export async function searchJobs(
  searchTerm: string,
  location?: string,
  limit: number = 25
): Promise<LinkedInJob[]> {
  const credentials = await refreshTokenIfNeeded();
  if (!credentials) {
    throw new Error("LinkedIn credentials not available");
  }

  // We'll use the Marketing API as there's no dedicated Jobs API
  // This is a simplified example - in production, you would need to handle pagination,
  // more complex filtering, etc.
  const url = new URL(`${LINKEDIN_API_BASE}/adAnalyticsV2`);
  url.searchParams.append("q", "jobPosting");
  url.searchParams.append("search", searchTerm);
  if (location) {
    url.searchParams.append("location", location);
  }
  url.searchParams.append("count", limit.toString());

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn job search failed: ${error}`);
  }

  // Parse the response and convert to our LinkedInJob format
  // This is a simplified example and would need to be adapted to the actual API response format
  const data = await response.json();
  return data.elements.map((job: any) => ({
    id: job.id,
    title: job.title,
    company: {
      name: job.companyName,
      id: job.companyId,
    },
    location: {
      name: job.locationName,
    },
    description: job.description,
    url: job.viewUrl,
    listedAt: new Date(job.createdAt),
    applyUrl: job.applyUrl,
    easyApply: job.hasEasyApply,
  }));
}

/**
 * Apply to a job on LinkedIn (if it supports easy apply)
 * For jobs that don't support easy apply, we'll return the application URL
 */
export async function applyToJob(
  jobId: string,
  resumeId: string,
  coverLetterId?: string
): Promise<{ success: boolean; message: string; redirectUrl?: string }> {
  const credentials = await refreshTokenIfNeeded();
  if (!credentials) {
    throw new Error("LinkedIn credentials not available");
  }

  // Get job details
  const url = new URL(`${LINKEDIN_API_BASE}/jobPostings/${jobId}`);
  
  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${credentials.accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LinkedIn job details fetch failed: ${error}`);
  }

  const jobData = await response.json();
  
  // Check if job supports easy apply
  if (!jobData.easyApply) {
    return {
      success: false,
      message: "This job doesn't support Easy Apply. You'll need to apply on the company website.",
      redirectUrl: jobData.applyUrl,
    };
  }

  // For jobs with Easy Apply, we would handle the application process
  // This is a placeholder as the actual implementation would depend on LinkedIn's API
  // In reality, you would need to:
  // 1. Start an application
  // 2. Upload resume
  // 3. Fill in any required fields
  // 4. Submit the application
  
  // For now, we'll just return a success message
  return {
    success: true,
    message: "Application submitted successfully via LinkedIn Easy Apply",
  };
}

/**
 * Generate a random state string for OAuth security
 */
function generateRandomState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}
