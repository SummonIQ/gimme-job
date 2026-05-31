"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { LeadDataProvider, DataQualityScore, LeadStatus, LeadCompanySize, IntentDataSignal } from "@/generated/prisma/client";

/**
 * Apollo.io API Client
 * This client handles interactions with the Apollo.io API for lead enrichment and discovery
 */

// API Configuration
const APOLLO_API_BASE = "https://api.apollo.io/v1";

// Apollo.io API interfaces
interface ApolloApiCredentials {
  apiKey: string;
}

interface ApolloPersonResponse {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  personal_email?: string;
  phone?: string;
  linkedin_url?: string;
  title: string;
  department?: string;
  seniority?: string;
  organization: ApolloOrganizationResponse;
  employment_history?: Array<{
    title: string;
    organization_name: string;
    start_date?: string;
    end_date?: string;
  }>;
}

interface ApolloOrganizationResponse {
  id: string;
  name: string;
  domain?: string;
  website_url?: string;
  linkedin_url?: string;
  description?: string;
  industry?: string;
  sub_industry?: string;
  founded_year?: number;
  estimated_num_employees?: number;
  estimated_num_employees_range?: string;
  annual_revenue?: string;
  funding_stage?: string;
  total_funding?: string;
  headquarters_location?: string;
  locations?: string[];
  technologies?: string[];
  intent_signals?: Array<{
    type: string;
    score: number;
    detected_at: string;
  }>;
}

interface ApolloPersonSearchRequest {
  q_keywords?: string;
  person_titles?: string[];
  person_departments?: string[];
  person_seniorities?: string[];
  organization_domains?: string[];
  organization_names?: string[];
  organization_industries?: string[];
  organization_num_employees_ranges?: string[];
  organization_locations?: string[];
  organization_technologies?: string[];
  limit?: number;
  page?: number;
}

interface ApolloPersonSearchResponse {
  people: ApolloPersonResponse[];
  pagination: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
}

interface ApolloEmailFinderRequest {
  first_name: string;
  last_name: string;
  domain: string;
}

interface ApolloEmailFinderResponse {
  email: string;
  confidence: number;
  state: string; // verified, unverified, etc.
}

/**
 * Store Apollo.io API credentials for the current user
 */
export async function storeCredentials(apiKey: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  await db.userIntegration.upsert({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "APOLLO",
      },
    },
    update: {
      accessToken: apiKey,
      updatedAt: new Date(),
    },
    create: {
      userId: user.id,
      provider: "APOLLO",
      accessToken: apiKey,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    },
  });
}

/**
 * Get stored Apollo.io credentials for the current user
 */
export async function getCredentials(): Promise<ApolloApiCredentials | null> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const integration = await db.userIntegration.findUnique({
    where: {
      userId_provider: {
        userId: user.id,
        provider: "APOLLO",
      },
    },
  });

  if (!integration || !integration.accessToken) {
    return null;
  }

  return {
    apiKey: integration.accessToken,
  };
}

/**
 * Make authenticated API request to Apollo.io
 */
async function makeApiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const credentials = await getCredentials();
  if (!credentials) {
    throw new Error("Apollo.io API key not configured");
  }

  const url = `${APOLLO_API_BASE}${endpoint}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache",
      ...options.headers,
      "X-Api-Key": credentials.apiKey,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Apollo.io API error (${response.status}): ${error}`);
  }

  const data = await response.json();

  // Track API usage
  await trackApiUsage("PERSON_SEARCH", response.status === 200 ? "SUCCESS" : "ERROR");

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
        provider: LeadDataProvider.APOLLO,
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
      provider: LeadDataProvider.APOLLO,
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
 * Search for people using Apollo.io
 */
export async function searchPeople(
  searchRequest: ApolloPersonSearchRequest
): Promise<ApolloPersonSearchResponse> {
  const queryParams = new URLSearchParams();

  // Add search parameters
  if (searchRequest.q_keywords) queryParams.append("q_keywords", searchRequest.q_keywords);
  if (searchRequest.person_titles) {
    searchRequest.person_titles.forEach(title => queryParams.append("person_titles[]", title));
  }
  if (searchRequest.person_departments) {
    searchRequest.person_departments.forEach(dept => queryParams.append("person_departments[]", dept));
  }
  if (searchRequest.person_seniorities) {
    searchRequest.person_seniorities.forEach(seniority => queryParams.append("person_seniorities[]", seniority));
  }
  if (searchRequest.organization_domains) {
    searchRequest.organization_domains.forEach(domain => queryParams.append("organization_domains[]", domain));
  }
  if (searchRequest.organization_names) {
    searchRequest.organization_names.forEach(name => queryParams.append("organization_names[]", name));
  }
  if (searchRequest.organization_industries) {
    searchRequest.organization_industries.forEach(industry => queryParams.append("organization_industries[]", industry));
  }
  if (searchRequest.organization_num_employees_ranges) {
    searchRequest.organization_num_employees_ranges.forEach(range =>
      queryParams.append("organization_num_employees_ranges[]", range)
    );
  }
  if (searchRequest.organization_locations) {
    searchRequest.organization_locations.forEach(location =>
      queryParams.append("organization_locations[]", location)
    );
  }
  if (searchRequest.organization_technologies) {
    searchRequest.organization_technologies.forEach(tech =>
      queryParams.append("organization_technologies[]", tech)
    );
  }

  queryParams.append("page", (searchRequest.page || 1).toString());
  queryParams.append("per_page", (searchRequest.limit || 25).toString());

  const endpoint = `/mixed_people/search?${queryParams.toString()}`;
  return makeApiRequest<ApolloPersonSearchResponse>(endpoint);
}

/**
 * Enrich person data using Apollo.io
 */
export async function enrichPerson(
  email: string
): Promise<ApolloPersonResponse> {
  const endpoint = "/people/match";
  return makeApiRequest<ApolloPersonResponse>(endpoint, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

/**
 * Find email address using Apollo.io
 */
export async function findEmail(
  firstName: string,
  lastName: string,
  domain: string
): Promise<ApolloEmailFinderResponse> {
  const endpoint = "/email_finder";
  return makeApiRequest<ApolloEmailFinderResponse>(endpoint, {
    method: "POST",
    body: JSON.stringify({
      first_name: firstName,
      last_name: lastName,
      domain,
    }),
  });
}

/**
 * Convert Apollo company size to our enum
 */
function mapCompanySize(apolloSize?: string): LeadCompanySize | null {
  if (!apolloSize) return null;

  const sizeMap: Record<string, LeadCompanySize> = {
    "1-10": LeadCompanySize.STARTUP,
    "11-50": LeadCompanySize.SMALL_BUSINESS,
    "51-200": LeadCompanySize.MID_MARKET,
    "201-1000": LeadCompanySize.ENTERPRISE,
    "1001+": LeadCompanySize.LARGE_ENTERPRISE,
  };

  return sizeMap[apolloSize] || LeadCompanySize.MID_MARKET;
}

/**
 * Convert Apollo intent signals to our enum
 */
function mapIntentSignals(apolloSignals?: Array<{ type: string }>): IntentDataSignal[] {
  if (!apolloSignals || apolloSignals.length === 0) return [];

  const signalMap: Record<string, IntentDataSignal> = {
    "technology_research": IntentDataSignal.TECHNOLOGY_RESEARCH,
    "competitor_research": IntentDataSignal.COMPETITOR_RESEARCH,
    "hiring": IntentDataSignal.HIRING_ACTIVITY,
    "funding": IntentDataSignal.FUNDING_ACTIVITY,
    "content": IntentDataSignal.CONTENT_ENGAGEMENT,
    "website": IntentDataSignal.WEBSITE_ACTIVITY,
    "social": IntentDataSignal.SOCIAL_MENTIONS,
    "job_change": IntentDataSignal.JOB_CHANGE_SIGNALS,
    "budget_allocation": IntentDataSignal.BUDGET_ALLOCATION,
    "project_initiatives": IntentDataSignal.PROJECT_INITIATIVES,
  };

  return apolloSignals
    .map(signal => signalMap[signal.type])
    .filter(Boolean);
}

/**
 * Calculate data quality score based on available fields
 */
function calculateDataQuality(person: ApolloPersonResponse): DataQualityScore {
  let score = 0;

  // Basic fields (2 points each)
  if (person.email) score += 2;
  if (person.phone) score += 2;
  if (person.linkedin_url) score += 2;

  // Professional fields (1 point each)
  if (person.title) score += 1;
  if (person.department) score += 1;
  if (person.seniority) score += 1;

  // Company data (1 point each)
  if (person.organization?.industry) score += 1;
  if (person.organization?.estimated_num_employees) score += 1;
  if (person.organization?.domain) score += 1;

  if (score >= 8) return DataQualityScore.EXCELLENT;
  if (score >= 6) return DataQualityScore.GOOD;
  if (score >= 4) return DataQualityScore.FAIR;
  return DataQualityScore.POOR;
}

/**
 * Save enriched lead data from Apollo.io response
 */
export async function saveEnrichedLead(
  apolloPerson: ApolloPersonResponse,
  searchResultId?: string
): Promise<string> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // First, save or update the company
  const company = await db.leadCompany.upsert({
    where: { domain: apolloPerson.organization.domain || `apollo-${apolloPerson.organization.id}` },
    update: {
      name: apolloPerson.organization.name,
      website: apolloPerson.organization.website_url,
      linkedinUrl: apolloPerson.organization.linkedin_url,
      description: apolloPerson.organization.description,
      industry: apolloPerson.organization.industry,
      subIndustry: apolloPerson.organization.sub_industry,
      companySize: mapCompanySize(apolloPerson.organization.estimated_num_employees_range),
      employeeCount: apolloPerson.organization.estimated_num_employees,
      foundedYear: apolloPerson.organization.founded_year,
      annualRevenue: apolloPerson.organization.annual_revenue,
      fundingStage: apolloPerson.organization.funding_stage,
      totalFunding: apolloPerson.organization.total_funding,
      headquarters: apolloPerson.organization.headquarters_location,
      locations: apolloPerson.organization.locations || [],
      technologies: apolloPerson.organization.technologies || [],
      apolloId: apolloPerson.organization.id,
      intentSignals: mapIntentSignals(apolloPerson.organization.intent_signals),
      intentScore: apolloPerson.organization.intent_signals?.reduce((sum, signal) => sum + (signal.score || 0), 0) || 0.0,
      dataProvider: LeadDataProvider.APOLLO,
      dataQuality: DataQualityScore.GOOD,
      lastEnrichedAt: new Date(),
    },
    create: {
      domain: apolloPerson.organization.domain || `apollo-${apolloPerson.organization.id}`,
      name: apolloPerson.organization.name,
      website: apolloPerson.organization.website_url,
      linkedinUrl: apolloPerson.organization.linkedin_url,
      description: apolloPerson.organization.description,
      industry: apolloPerson.organization.industry,
      subIndustry: apolloPerson.organization.sub_industry,
      companySize: mapCompanySize(apolloPerson.organization.estimated_num_employees_range),
      employeeCount: apolloPerson.organization.estimated_num_employees,
      foundedYear: apolloPerson.organization.founded_year,
      annualRevenue: apolloPerson.organization.annual_revenue,
      fundingStage: apolloPerson.organization.funding_stage,
      totalFunding: apolloPerson.organization.total_funding,
      headquarters: apolloPerson.organization.headquarters_location,
      locations: apolloPerson.organization.locations || [],
      technologies: apolloPerson.organization.technologies || [],
      apolloId: apolloPerson.organization.id,
      intentSignals: mapIntentSignals(apolloPerson.organization.intent_signals),
      intentScore: apolloPerson.organization.intent_signals?.reduce((sum, signal) => sum + (signal.score || 0), 0) || 0.0,
      dataProvider: LeadDataProvider.APOLLO,
      dataQuality: DataQualityScore.GOOD,
      lastEnrichedAt: new Date(),
    },
  });

  // Then save the enriched lead
  const enrichedLead = await db.enrichedLead.upsert({
    where: { email: apolloPerson.email },
    update: {
      firstName: apolloPerson.first_name,
      lastName: apolloPerson.last_name,
      fullName: apolloPerson.name,
      personalEmail: apolloPerson.personal_email,
      phone: apolloPerson.phone,
      linkedinUrl: apolloPerson.linkedin_url,
      jobTitle: apolloPerson.title,
      department: apolloPerson.department,
      seniority: apolloPerson.seniority,
      companyId: company.id,
      apolloPersonId: apolloPerson.id,
      dataProvider: LeadDataProvider.APOLLO,
      dataQuality: calculateDataQuality(apolloPerson),
      lastEnrichedAt: new Date(),
      assignedToUserId: user.id,
    },
    create: {
      firstName: apolloPerson.first_name,
      lastName: apolloPerson.last_name,
      fullName: apolloPerson.name,
      email: apolloPerson.email,
      personalEmail: apolloPerson.personal_email,
      phone: apolloPerson.phone,
      linkedinUrl: apolloPerson.linkedin_url,
      jobTitle: apolloPerson.title,
      department: apolloPerson.department,
      seniority: apolloPerson.seniority,
      companyId: company.id,
      apolloPersonId: apolloPerson.id,
      dataProvider: LeadDataProvider.APOLLO,
      dataQuality: calculateDataQuality(apolloPerson),
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
    const credentials = await getCredentials();
    if (!credentials) {
      return { success: false, message: "Apollo.io API key not configured" };
    }

    // Make a simple test request
    await makeApiRequest<any>("/auth/verify");
    return { success: true, message: "Apollo.io API connection successful" };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Unknown error"
    };
  }
}