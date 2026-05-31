"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { refreshTokenIfNeeded } from "./linkedin-client";

/**
 * LinkedIn Jobs API Client
 * Handles job search, discovery, and application preparation for LinkedIn
 */

// LinkedIn API endpoints
const LINKEDIN_API_BASE = "https://api.linkedin.com/v2";
const LINKEDIN_JOBS_API = "https://api.linkedin.com/rest/jobs";

// Rate limiting constants
const MAX_REQUESTS_PER_DAY = 200;
const MAX_APPLICATIONS_PER_DAY = 50;
const MAX_APPLICATIONS_PER_HOUR = 10;

export interface LinkedInJobSearchParams {
  keywords?: string;
  location?: string;
  companyIds?: string[];
  jobTypes?: ("full-time" | "part-time" | "contract" | "temporary" | "volunteer" | "internship")[];
  experienceLevel?: ("internship" | "entry_level" | "associate" | "mid_senior_level" | "director" | "executive")[];
  remote?: boolean;
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
  };
  datePosted?: "past-24-hours" | "past-week" | "past-month";
  easyApply?: boolean;
  limit?: number;
  offset?: number;
}

export interface LinkedInJob {
  id: string;
  title: string;
  company: {
    id: string;
    name: string;
    logo?: string;
    url?: string;
  };
  location: {
    city?: string;
    state?: string;
    country?: string;
    remote?: boolean;
  };
  description: string;
  descriptionHtml?: string;
  requirements?: string[];
  benefits?: string[];
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: "hourly" | "monthly" | "yearly";
  };
  jobType?: string;
  experienceLevel?: string;
  industry?: string;
  functions?: string[];
  postedAt: Date;
  expiresAt?: Date;
  applicationUrl: string;
  easyApply: boolean;
  appliedCount?: number;
  viewsCount?: number;
  skillsRequired?: string[];
  questions?: LinkedInApplicationQuestion[];
}

export interface LinkedInApplicationQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "radio" | "checkbox" | "file";
  required: boolean;
  options?: string[];
  maxLength?: number;
  fileTypes?: string[];
}

export interface LinkedInApplicationData {
  jobId: string;
  resumeId?: string;
  coverLetterId?: string;
  profileData: {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    linkedInUrl?: string;
    headline?: string;
    summary?: string;
    currentPosition?: string;
    currentCompany?: string;
    yearsOfExperience?: number;
    education?: Array<{
      school: string;
      degree?: string;
      fieldOfStudy?: string;
      graduationYear?: number;
    }>;
    skills?: string[];
    workAuthorization?: boolean;
    requiresSponsorship?: boolean;
    willingToRelocate?: boolean;
    willingToWorkRemote?: boolean;
    noticePeriod?: string;
    expectedSalary?: {
      min?: number;
      max?: number;
      currency?: string;
    };
  };
  questionAnswers?: Record<string, any>;
}

/**
 * Search for jobs on LinkedIn
 */
export async function searchLinkedInJobs(
  params: LinkedInJobSearchParams
): Promise<{ jobs: LinkedInJob[]; total: number; hasMore: boolean }> {
  const credentials = await refreshTokenIfNeeded();
  if (!credentials) {
    throw new Error("LinkedIn authentication required");
  }

  // Check rate limits
  await checkRateLimit("search");

  try {
    // Build search query
    const searchUrl = new URL(`${LINKEDIN_JOBS_API}/jobSearch`);
    
    // Add search parameters
    if (params.keywords) searchUrl.searchParams.append("keywords", params.keywords);
    if (params.location) searchUrl.searchParams.append("location", params.location);
    if (params.companyIds?.length) searchUrl.searchParams.append("companyIds", params.companyIds.join(","));
    if (params.jobTypes?.length) searchUrl.searchParams.append("jobTypes", params.jobTypes.join(","));
    if (params.experienceLevel?.length) searchUrl.searchParams.append("experienceLevel", params.experienceLevel.join(","));
    if (params.remote !== undefined) searchUrl.searchParams.append("remote", params.remote.toString());
    if (params.datePosted) searchUrl.searchParams.append("datePosted", params.datePosted);
    if (params.easyApply !== undefined) searchUrl.searchParams.append("easyApply", params.easyApply.toString());
    
    const limit = params.limit || 25;
    const offset = params.offset || 0;
    searchUrl.searchParams.append("count", limit.toString());
    searchUrl.searchParams.append("start", offset.toString());

    // Make API request
    const response = await fetch(searchUrl.toString(), {
      headers: {
        "Authorization": `Bearer ${credentials.accessToken}`,
        "LinkedIn-Version": "202401",
        "X-RestLi-Protocol-Version": "2.0.0",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`LinkedIn job search failed: ${error}`);
    }

    const data = await response.json();

    // Transform LinkedIn API response to our format
    const jobs: LinkedInJob[] = data.elements.map((job: any) => ({
      id: job.id,
      title: job.title,
      company: {
        id: job.company?.id || "",
        name: job.company?.name || "Unknown Company",
        logo: job.company?.logo?.["com.linkedin.common.VectorImage"]?.rootUrl,
        url: job.company?.universalName ? `https://www.linkedin.com/company/${job.company.universalName}` : undefined,
      },
      location: {
        city: job.location?.city,
        state: job.location?.state,
        country: job.location?.country,
        remote: job.workRemoteAllowed || false,
      },
      description: job.description?.text || "",
      descriptionHtml: job.description?.html,
      requirements: job.jobRequirements,
      benefits: job.jobBenefits,
      salary: job.compensation ? {
        min: job.compensation.min,
        max: job.compensation.max,
        currency: job.compensation.currency,
        period: job.compensation.period,
      } : undefined,
      jobType: job.employmentType,
      experienceLevel: job.seniorityLevel,
      industry: job.industries?.[0],
      functions: job.jobFunctions,
      postedAt: new Date(job.listedAt),
      expiresAt: job.expiresAt ? new Date(job.expiresAt) : undefined,
      applicationUrl: `https://www.linkedin.com/jobs/view/${job.id}`,
      easyApply: job.applyMethod?.easyApplyEnabled || false,
      appliedCount: job.numApplicants,
      viewsCount: job.views,
      skillsRequired: job.skills?.map((s: any) => s.name),
    }));

    // Update rate limit tracking
    await updateRateLimit("search");

    return {
      jobs,
      total: data.paging?.total || jobs.length,
      hasMore: data.paging?.links?.some((link: any) => link.rel === "next") || false,
    };
  } catch (error) {
    console.error("LinkedIn job search error:", error);
    throw error;
  }
}

/**
 * Get detailed job information including application questions
 */
export async function getLinkedInJobDetails(jobId: string): Promise<LinkedInJob> {
  const credentials = await refreshTokenIfNeeded();
  if (!credentials) {
    throw new Error("LinkedIn authentication required");
  }

  await checkRateLimit("details");

  try {
    const response = await fetch(`${LINKEDIN_JOBS_API}/jobs/${jobId}`, {
      headers: {
        "Authorization": `Bearer ${credentials.accessToken}`,
        "LinkedIn-Version": "202401",
        "X-RestLi-Protocol-Version": "2.0.0",
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch job details: ${error}`);
    }

    const job = await response.json();

    // Fetch application questions if Easy Apply is enabled
    let questions: LinkedInApplicationQuestion[] = [];
    if (job.applyMethod?.easyApplyEnabled) {
      questions = await fetchApplicationQuestions(jobId, credentials.accessToken);
    }

    await updateRateLimit("details");

    return {
      id: job.id,
      title: job.title,
      company: {
        id: job.company?.id || "",
        name: job.company?.name || "Unknown Company",
        logo: job.company?.logo?.["com.linkedin.common.VectorImage"]?.rootUrl,
        url: job.company?.universalName ? `https://www.linkedin.com/company/${job.company.universalName}` : undefined,
      },
      location: {
        city: job.location?.city,
        state: job.location?.state,
        country: job.location?.country,
        remote: job.workRemoteAllowed || false,
      },
      description: job.description?.text || "",
      descriptionHtml: job.description?.html,
      requirements: job.jobRequirements,
      benefits: job.jobBenefits,
      salary: job.compensation ? {
        min: job.compensation.min,
        max: job.compensation.max,
        currency: job.compensation.currency,
        period: job.compensation.period,
      } : undefined,
      jobType: job.employmentType,
      experienceLevel: job.seniorityLevel,
      industry: job.industries?.[0],
      functions: job.jobFunctions,
      postedAt: new Date(job.listedAt),
      expiresAt: job.expiresAt ? new Date(job.expiresAt) : undefined,
      applicationUrl: `https://www.linkedin.com/jobs/view/${job.id}`,
      easyApply: job.applyMethod?.easyApplyEnabled || false,
      appliedCount: job.numApplicants,
      viewsCount: job.views,
      skillsRequired: job.skills?.map((s: any) => s.name),
      questions,
    };
  } catch (error) {
    console.error("LinkedIn job details error:", error);
    throw error;
  }
}

/**
 * Fetch application questions for a LinkedIn job
 */
async function fetchApplicationQuestions(
  jobId: string,
  accessToken: string
): Promise<LinkedInApplicationQuestion[]> {
  try {
    const response = await fetch(`${LINKEDIN_JOBS_API}/jobs/${jobId}/applicationQuestions`, {
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "LinkedIn-Version": "202401",
        "X-RestLi-Protocol-Version": "2.0.0",
      },
    });

    if (!response.ok) {
      console.warn("Could not fetch application questions");
      return [];
    }

    const data = await response.json();
    
    return data.elements?.map((q: any) => ({
      id: q.id,
      question: q.question,
      type: q.answerType,
      required: q.required || false,
      options: q.multipleChoiceOptions,
      maxLength: q.characterLimit,
      fileTypes: q.acceptedFileTypes,
    })) || [];
  } catch (error) {
    console.warn("Error fetching application questions:", error);
    return [];
  }
}

/**
 * Check if we can apply to a job (rate limits, already applied, etc.)
 */
export async function canApplyToJob(jobId: string): Promise<{
  canApply: boolean;
  reason?: string;
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { canApply: false, reason: "User not authenticated" };
  }

  // Check if already applied
  const existingApplication = await db.applicationSubmission.findFirst({
    where: {
      userId: user.id,
      jobBoardJobId: jobId,
      platform: "LINKEDIN",
    },
  });

  if (existingApplication) {
    return { canApply: false, reason: "Already applied to this job" };
  }

  // Check rate limits
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dailyApplications = await db.applicationSubmission.count({
    where: {
      userId: user.id,
      platform: "LINKEDIN",
      submittedAt: { gte: today },
    },
  });

  if (dailyApplications >= MAX_APPLICATIONS_PER_DAY) {
    return { canApply: false, reason: `Daily application limit reached (${MAX_APPLICATIONS_PER_DAY}/day)` };
  }

  const hourAgo = new Date();
  hourAgo.setHours(hourAgo.getHours() - 1);
  
  const hourlyApplications = await db.applicationSubmission.count({
    where: {
      userId: user.id,
      platform: "LINKEDIN",
      submittedAt: { gte: hourAgo },
    },
  });

  if (hourlyApplications >= MAX_APPLICATIONS_PER_HOUR) {
    return { canApply: false, reason: `Hourly application limit reached (${MAX_APPLICATIONS_PER_HOUR}/hour)` };
  }

  return { canApply: true };
}

/**
 * Prepare application data by mapping LinkedIn profile to job requirements
 */
export async function prepareApplicationData(
  jobId: string,
  resumeId?: string,
  coverLetterId?: string
): Promise<LinkedInApplicationData> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Get LinkedIn profile data
  const profile = await db.linkedInProfile.findFirst({
    where: { userId: user.id },
  });

  if (!profile) {
    throw new Error("LinkedIn profile not found. Please import your profile first.");
  }

  // Parse profile data
  const profileJson = profile.profileData ? JSON.parse(profile.profileData as string) : {};
  
  // Calculate years of experience
  const yearsOfExperience = calculateYearsOfExperience(profileJson.positions || []);

  // Get user preferences for application defaults
  const preferences = await db.userPreference.findUnique({
    where: { userId: user.id },
  });

  return {
    jobId,
    resumeId,
    coverLetterId,
    profileData: {
      firstName: profile.firstName,
      lastName: profile.lastName,
      email: profile.email || user.email,
      phone: preferences?.phoneNumber || undefined,
      linkedInUrl: profile.publicProfileUrl || undefined,
      headline: profile.headline || undefined,
      summary: profileJson.summary,
      currentPosition: profileJson.positions?.[0]?.title,
      currentCompany: profileJson.positions?.[0]?.company,
      yearsOfExperience,
      education: profileJson.education?.map((edu: any) => ({
        school: edu.school,
        degree: edu.degree,
        fieldOfStudy: edu.fieldOfStudy,
        graduationYear: edu.endDate?.year,
      })),
      skills: profileJson.skills?.map((s: any) => s.name),
      workAuthorization: preferences?.workAuthorization,
      requiresSponsorship: preferences?.requiresVisa,
      willingToRelocate: preferences?.willingToRelocate,
      willingToWorkRemote: preferences?.remoteWorkPreference === "REMOTE_ONLY" || 
                           preferences?.remoteWorkPreference === "HYBRID",
      noticePeriod: preferences?.noticePeriod,
      expectedSalary: preferences?.expectedSalaryMin ? {
        min: preferences.expectedSalaryMin,
        max: preferences.expectedSalaryMax || undefined,
        currency: preferences.expectedSalaryCurrency || "USD",
      } : undefined,
    },
  };
}

/**
 * Calculate years of experience from positions
 */
function calculateYearsOfExperience(positions: any[]): number {
  if (!positions || positions.length === 0) return 0;

  let totalMonths = 0;
  for (const position of positions) {
    const startDate = position.startDate;
    const endDate = position.endDate || { year: new Date().getFullYear(), month: new Date().getMonth() + 1 };
    
    if (startDate?.year) {
      const startMonths = (startDate.year * 12) + (startDate.month || 1);
      const endMonths = (endDate.year * 12) + (endDate.month || 12);
      totalMonths += Math.max(0, endMonths - startMonths);
    }
  }

  return Math.round(totalMonths / 12);
}

/**
 * Check rate limits for LinkedIn API calls
 */
async function checkRateLimit(action: "search" | "details" | "apply"): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dailyRequests = await db.apiRateLimit.count({
    where: {
      userId: user.id,
      provider: "LINKEDIN",
      createdAt: { gte: today },
    },
  });

  if (dailyRequests >= MAX_REQUESTS_PER_DAY) {
    throw new Error(`LinkedIn API daily limit reached (${MAX_REQUESTS_PER_DAY} requests/day)`);
  }

  if (action === "apply") {
    const dailyApplications = await db.applicationSubmission.count({
      where: {
        userId: user.id,
        platform: "LINKEDIN",
        submittedAt: { gte: today },
      },
    });

    if (dailyApplications >= MAX_APPLICATIONS_PER_DAY) {
      throw new Error(`Daily application limit reached (${MAX_APPLICATIONS_PER_DAY} applications/day)`);
    }
  }
}

/**
 * Update rate limit tracking
 */
async function updateRateLimit(action: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;

  await db.apiRateLimit.create({
    data: {
      userId: user.id,
      provider: "LINKEDIN",
      action,
      timestamp: new Date(),
    },
  });
}