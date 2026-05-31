"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { LeadDataProvider, DataQualityScore, LeadStatus, LeadCompanySize, IntentDataSignal } from "@/generated/prisma/client";

/**
 * ZoomInfo API Client
 * This client handles interactions with the ZoomInfo API for lead enrichment and discovery
 * Used as fallback when Apollo.io data is insufficient
 */

// API Configuration
const ZOOMINFO_API_BASE = "https://api.zoominfo.com";

// ZoomInfo API interfaces
interface ZoomInfoCredentials {
  username: string;
  password: string;
  accessToken?: string;
  expiresAt?: Date;
}

interface ZoomInfoAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

interface ZoomInfoPersonResponse {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  personalEmail?: string;
  phone?: string;
  linkedInUrl?: string;
  jobTitle: string;
  department?: string;
  managementLevel?: string;
  company: ZoomInfoCompanyResponse;
  jobHistory?: Array<{
    title: string;
    companyName: string;
    startDate?: string;
    endDate?: string;
    current: boolean;
  }>;
  education?: Array<{
    schoolName: string;
    degreeName?: string;
    fieldOfStudy?: string;
  }>;
}

interface ZoomInfoCompanyResponse {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  linkedInUrl?: string;
  description?: string;
  industry?: string;
  subIndustry?: string;
  foundedYear?: number;
  employeeCount?: number;
  employeeCountRange?: string;
  revenue?: string;
  revenueRange?: string;
  headquarters?: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  locations?: Array<{
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  }>;
  technologies?: string[];
  intentData?: Array<{
    topic: string;
    score: number;
    lastSeen: string;
  }>;
}

interface ZoomInfoPersonSearchRequest {
  companyName?: string;
  companyDomain?: string;
  jobTitle?: string;
  department?: string;
  managementLevel?: string;
  location?: string;
  industry?: string;
  employeeCountMin?: number;
  employeeCountMax?: number;
  revenueMin?: string;
  revenueMax?: string;
  keywords?: string;
  limit?: number;
  offset?: number;
}

interface ZoomInfoPersonSearchResponse {
  data: ZoomInfoPersonResponse[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    recordsPerPage: number;
  };
}

interface ZoomInfoEnrichmentRequest {
  email?: string;
  firstName?: string;
  lastName?: string;
  companyName?: string;
  companyDomain?: string;
}

/**
 * Store ZoomInfo credentials for the current user
 */
export async function storeCredentials(username: string, password: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Get access token
  const { accessToken, expiresAt } = await authenticateWithZoomInfo(username, password);

  await db.userIntegration.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "ZOOMINFO",
      },
    },
    update: {
      accessToken,
      refreshToken: `${username}:${password}`, // Store credentials for token refresh
      expiresAt,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      provider: "ZOOMINFO",
      accessToken,
      refreshToken: `${username}:${password}`,
      expiresAt,
    },
  });
}

/**
 * Get stored ZoomInfo credentials for the current user
 */
export async function getCredentials(): Promise<ZoomInfoCredentials | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const integration = await db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "ZOOMINFO",
      },
    },
  });

  if (!integration) {
    return null;
  }

  // Parse username:password from refreshToken
  const credentials = integration.refreshToken?.split(':');
  if (!credentials || credentials.length !== 2) {
    return null;
  }

  return {
    username: credentials[0],
    password: credentials[1],
    accessToken: integration.accessToken,
    expiresAt: integration.expiresAt,
  };
}

/**
 * Authenticate with ZoomInfo API
 */
async function authenticateWithZoomInfo(username: string, password: string): Promise<{
  accessToken: string;
  expiresAt: Date;
}> {
  const response = await fetch(`${ZOOMINFO_API_BASE}/authenticate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      username,
      password,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ZoomInfo authentication failed: ${error}`);
  }

  const data: ZoomInfoAuthResponse = await response.json();
  const expiresAt = new Date();
  expiresAt.setSeconds(expiresAt.getSeconds() + data.expires_in);

  return {
    accessToken: data.access_token,
    expiresAt,
  };
}

/**
 * Refresh access token if needed
 */
async function refreshTokenIfNeeded(): Promise<string | null> {
  const credentials = await getCredentials();
  if (!credentials) {
    return null;
  }

  // If token is still valid, return it
  if (credentials.accessToken && credentials.expiresAt && new Date() < credentials.expiresAt) {
    return credentials.accessToken;
  }

  // Refresh token using stored credentials
  try {
    const { accessToken, expiresAt } = await authenticateWithZoomInfo(
      credentials.username,
      credentials.password
    );

    // Update stored credentials
    const user = await getCurrentUser();
    if (user) {
      await db.userIntegration.update({
        where: {
          userId_provider: {
            userId: user.id,
            provider: "ZOOMINFO",
          },
        },
        data: {
          accessToken,
          expiresAt,
          updatedAt: new Date(),
        },
      });
    }

    return accessToken;
  } catch (error) {
    console.error("Failed to refresh ZoomInfo token:", error);
    return null;
  }
}

/**
 * Make authenticated API request to ZoomInfo
 */
async function makeApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const accessToken = await refreshTokenIfNeeded();
  if (!accessToken) {
    throw new Error("ZoomInfo API credentials not available or expired");
  }

  const url = `${ZOOMINFO_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${accessToken}`,
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();

    // Track API usage
    await trackApiUsage("PERSON_SEARCH", response.status === 429 ? "RATE_LIMITED" : "ERROR");

    if (response.status === 429) {
      throw new Error("ZoomInfo API rate limit exceeded");
    }

    throw new Error(`ZoomInfo API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  // Track successful API usage
  await trackApiUsage("PERSON_SEARCH", "SUCCESS");

  return data;
}

/**
 * Track API usage for rate limiting and analytics
 */
async function trackApiUsage(
  endpoint: string,
  status: "SUCCESS" | "ERROR" | "RATE_LIMITED"
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await db.apiUsageTracking.upsert({
    where: {
      userId_provider_endpoint_date: {
        userId: user.id,
        provider: LeadDataProvider.ZOOMINFO,
        endpoint,
        date: today,
      },
    },
    update: {
      requestCount: { increment: 1 },
      successCount: status === "SUCCESS" ? { increment: 1 } : undefined,
      errorCount: status === "ERROR" ? { increment: 1 } : undefined,
      rateLimitedCount: status === "RATE_LIMITED" ? { increment: 1 } : undefined,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      provider: LeadDataProvider.ZOOMINFO,
      endpoint,
      date: today,
      requestCount: 1,
      successCount: status === "SUCCESS" ? 1 : 0,
      errorCount: status === "ERROR" ? 1 : 0,
      rateLimitedCount: status === "RATE_LIMITED" ? 1 : 0,
    },
  });
}

/**
 * Search for people using ZoomInfo
 */
export async function searchPeople(
  searchRequest: ZoomInfoPersonSearchRequest
): Promise<ZoomInfoPersonSearchResponse> {
  const queryParams = new URLSearchParams();

  // Add search parameters
  if (searchRequest.companyName) queryParams.append("companyName", searchRequest.companyName);
  if (searchRequest.companyDomain) queryParams.append("companyDomain", searchRequest.companyDomain);
  if (searchRequest.jobTitle) queryParams.append("jobTitle", searchRequest.jobTitle);
  if (searchRequest.department) queryParams.append("department", searchRequest.department);
  if (searchRequest.managementLevel) queryParams.append("managementLevel", searchRequest.managementLevel);
  if (searchRequest.location) queryParams.append("location", searchRequest.location);
  if (searchRequest.industry) queryParams.append("industry", searchRequest.industry);
  if (searchRequest.employeeCountMin) queryParams.append("employeeCountMin", searchRequest.employeeCountMin.toString());
  if (searchRequest.employeeCountMax) queryParams.append("employeeCountMax", searchRequest.employeeCountMax.toString());
  if (searchRequest.revenueMin) queryParams.append("revenueMin", searchRequest.revenueMin);
  if (searchRequest.revenueMax) queryParams.append("revenueMax", searchRequest.revenueMax);
  if (searchRequest.keywords) queryParams.append("keywords", searchRequest.keywords);

  queryParams.append("limit", (searchRequest.limit || 25).toString());
  queryParams.append("offset", (searchRequest.offset || 0).toString());

  const endpoint = `/search/person?${queryParams.toString()}`;
  return makeApiRequest<ZoomInfoPersonSearchResponse>(endpoint);
}

/**
 * Enrich person data using ZoomInfo
 */
export async function enrichPerson(
  enrichmentRequest: ZoomInfoEnrichmentRequest
): Promise<ZoomInfoPersonResponse> {
  const endpoint = "/enrich/person";
  return makeApiRequest<ZoomInfoPersonResponse>(endpoint, {
    method: "POST",
    body: JSON.stringify(enrichmentRequest),
  });
}

/**
 * Convert ZoomInfo company size to our enum
 */
function mapCompanySize(employeeCountRange?: string): LeadCompanySize | null {
  if (!employeeCountRange) return null;

  const sizeMap: Record<string, LeadCompanySize> = {
    "1-10": LeadCompanySize.STARTUP,
    "11-50": LeadCompanySize.SMALL_BUSINESS,
    "51-200": LeadCompanySize.MID_MARKET,
    "201-1000": LeadCompanySize.ENTERPRISE,
    "1000+": LeadCompanySize.LARGE_ENTERPRISE,
    "1001-5000": LeadCompanySize.LARGE_ENTERPRISE,
    "5000+": LeadCompanySize.LARGE_ENTERPRISE,
  };

  return sizeMap[employeeCountRange] || LeadCompanySize.MID_MARKET;
}

/**
 * Convert ZoomInfo intent data to our enum
 */
function mapIntentSignals(zoomInfoIntents?: Array<{ topic: string }>): IntentDataSignal[] {
  if (!zoomInfoIntents || zoomInfoIntents.length === 0) return [];

  const signalMap: Record<string, IntentDataSignal> = {
    "technology": IntentDataSignal.TECHNOLOGY_RESEARCH,
    "competitor": IntentDataSignal.COMPETITOR_RESEARCH,
    "hiring": IntentDataSignal.HIRING_ACTIVITY,
    "funding": IntentDataSignal.FUNDING_ACTIVITY,
    "content marketing": IntentDataSignal.CONTENT_ENGAGEMENT,
    "website activity": IntentDataSignal.WEBSITE_ACTIVITY,
    "social media": IntentDataSignal.SOCIAL_MENTIONS,
    "job change": IntentDataSignal.JOB_CHANGE_SIGNALS,
    "budget": IntentDataSignal.BUDGET_ALLOCATION,
    "project": IntentDataSignal.PROJECT_INITIATIVES,
  };

  return zoomInfoIntents
    .map(intent => {
      const key = Object.keys(signalMap).find(k => intent.topic.toLowerCase().includes(k));
      return key ? signalMap[key] : null;
    })
    .filter(Boolean) as IntentDataSignal[];
}

/**
 * Calculate data quality score based on available fields
 */
function calculateDataQuality(person: ZoomInfoPersonResponse): DataQualityScore {
  let score = 0;

  // Basic fields (2 points each)
  if (person.email) score += 2;
  if (person.phone) score += 2;
  if (person.linkedInUrl) score += 2;

  // Professional fields (1 point each)
  if (person.jobTitle) score += 1;
  if (person.department) score += 1;
  if (person.managementLevel) score += 1;

  // Company data (1 point each)
  if (person.company?.industry) score += 1;
  if (person.company?.employeeCount) score += 1;
  if (person.company?.domain) score += 1;

  // Additional data (0.5 points each)
  if (person.jobHistory && person.jobHistory.length > 0) score += 0.5;
  if (person.education && person.education.length > 0) score += 0.5;

  if (score >= 8) return DataQualityScore.EXCELLENT;
  if (score >= 6) return DataQualityScore.GOOD;
  if (score >= 4) return DataQualityScore.FAIR;
  return DataQualityScore.POOR;
}

/**
 * Save enriched lead data from ZoomInfo response
 */
export async function saveEnrichedLead(
  zoomInfoPerson: ZoomInfoPersonResponse,
  searchResultId?: string
): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // First, save or update the company
  const company = await db.leadCompany.upsert({
    where: { domain: zoomInfoPerson.company.domain || `zoominfo-${zoomInfoPerson.company.id}` },
    update: {
      name: zoomInfoPerson.company.name,
      website: zoomInfoPerson.company.website,
      linkedinUrl: zoomInfoPerson.company.linkedInUrl,
      description: zoomInfoPerson.company.description,
      industry: zoomInfoPerson.company.industry,
      subIndustry: zoomInfoPerson.company.subIndustry,
      companySize: mapCompanySize(zoomInfoPerson.company.employeeCountRange),
      employeeCount: zoomInfoPerson.company.employeeCount,
      foundedYear: zoomInfoPerson.company.foundedYear,
      annualRevenue: zoomInfoPerson.company.revenue,
      headquarters: zoomInfoPerson.company.headquarters ?
        `${zoomInfoPerson.company.headquarters.city}, ${zoomInfoPerson.company.headquarters.state}` : null,
      locations: zoomInfoPerson.company.locations?.map(loc =>
        `${loc.city}, ${loc.state}`
      ) || [],
      technologies: zoomInfoPerson.company.technologies || [],
      zoomInfoId: zoomInfoPerson.company.id,
      intentSignals: mapIntentSignals(zoomInfoPerson.company.intentData),
      intentScore: zoomInfoPerson.company.intentData?.reduce((sum, intent) => sum + intent.score, 0) || 0.0,
      dataProvider: LeadDataProvider.ZOOMINFO,
      dataQuality: DataQualityScore.GOOD,
      lastEnrichedAt: new Date(),
    },
    create: {
      domain: zoomInfoPerson.company.domain || `zoominfo-${zoomInfoPerson.company.id}`,
      name: zoomInfoPerson.company.name,
      website: zoomInfoPerson.company.website,
      linkedinUrl: zoomInfoPerson.company.linkedInUrl,
      description: zoomInfoPerson.company.description,
      industry: zoomInfoPerson.company.industry,
      subIndustry: zoomInfoPerson.company.subIndustry,
      companySize: mapCompanySize(zoomInfoPerson.company.employeeCountRange),
      employeeCount: zoomInfoPerson.company.employeeCount,
      foundedYear: zoomInfoPerson.company.foundedYear,
      annualRevenue: zoomInfoPerson.company.revenue,
      headquarters: zoomInfoPerson.company.headquarters ?
        `${zoomInfoPerson.company.headquarters.city}, ${zoomInfoPerson.company.headquarters.state}` : null,
      locations: zoomInfoPerson.company.locations?.map(loc =>
        `${loc.city}, ${loc.state}`
      ) || [],
      technologies: zoomInfoPerson.company.technologies || [],
      zoomInfoId: zoomInfoPerson.company.id,
      intentSignals: mapIntentSignals(zoomInfoPerson.company.intentData),
      intentScore: zoomInfoPerson.company.intentData?.reduce((sum, intent) => sum + intent.score, 0) || 0.0,
      dataProvider: LeadDataProvider.ZOOMINFO,
      dataQuality: DataQualityScore.GOOD,
      lastEnrichedAt: new Date(),
    },
  });

  // Then save the enriched lead
  const enrichedLead = await db.enrichedLead.upsert({
    where: { email: zoomInfoPerson.email },
    update: {
      firstName: zoomInfoPerson.firstName,
      lastName: zoomInfoPerson.lastName,
      fullName: zoomInfoPerson.fullName,
      personalEmail: zoomInfoPerson.personalEmail,
      phone: zoomInfoPerson.phone,
      linkedinUrl: zoomInfoPerson.linkedInUrl,
      jobTitle: zoomInfoPerson.jobTitle,
      department: zoomInfoPerson.department,
      seniority: zoomInfoPerson.managementLevel,
      companyId: company.id,
      zoomInfoPersonId: zoomInfoPerson.id,
      dataProvider: LeadDataProvider.ZOOMINFO,
      dataQuality: calculateDataQuality(zoomInfoPerson),
      lastEnrichedAt: new Date(),
      assignedToUserId: user.id,
    },
    create: {
      firstName: zoomInfoPerson.firstName,
      lastName: zoomInfoPerson.lastName,
      fullName: zoomInfoPerson.fullName,
      email: zoomInfoPerson.email,
      personalEmail: zoomInfoPerson.personalEmail,
      phone: zoomInfoPerson.phone,
      linkedinUrl: zoomInfoPerson.linkedInUrl,
      jobTitle: zoomInfoPerson.jobTitle,
      department: zoomInfoPerson.department,
      seniority: zoomInfoPerson.managementLevel,
      companyId: company.id,
      zoomInfoPersonId: zoomInfoPerson.id,
      dataProvider: LeadDataProvider.ZOOMINFO,
      dataQuality: calculateDataQuality(zoomInfoPerson),
      status: LeadStatus.NEW,
      lastEnrichedAt: new Date(),
      assignedToUserId: user.id,
    },
  });

  // If this was from a search result, link it
  if (searchResultId) {
    await db.leadSearchResult.update({
      where: { id: searchResultId },
      data: {
        enrichedLeadId: enrichedLead.id,
        processingStatus: "COMPLETED",
        processedAt: new Date(),
      },
    });
  }

  return enrichedLead.id;
}

/**
 * Test API connection
 */
export async function testConnection(): Promise<{ success: boolean; message: string }> {
  try {
    const accessToken = await refreshTokenIfNeeded();
    if (!accessToken) {
      return { success: false, message: "ZoomInfo credentials not configured or expired" };
    }

    // Make a simple test request
    const response = await fetch(`${ZOOMINFO_API_BASE}/test`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      return { success: true, message: "ZoomInfo API connection successful" };
    } else {
      return { success: false, message: "ZoomInfo API connection failed" };
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
}