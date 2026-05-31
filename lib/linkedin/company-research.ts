"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";

export interface CompanyProfile {
  id: string;
  name: string;
  industry: string;
  size: string;
  headquarters: string;
  founded: number;
  description: string;
  website: string;
  linkedInUrl: string;
  logoUrl: string;
  coverImageUrl?: string;
  specialties: string[];
  locations: CompanyLocation[];
  statistics: CompanyStatistics;
  recentUpdates: CompanyUpdate[];
  keyPeople: CompanyPerson[];
  financials?: CompanyFinancials;
  culture?: CompanyCulture;
  jobs?: JobOpening[];
  networkConnections?: NetworkConnection[];
}

export interface CompanyLocation {
  id: string;
  city: string;
  state?: string;
  country: string;
  isHeadquarters: boolean;
  employeeCount?: number;
  address?: string;
}

export interface CompanyStatistics {
  employeeCount: number;
  employeeGrowth: number; // percentage
  industryRank?: number;
  revenue?: string;
  funding?: string;
  marketCap?: string;
  glassdoorRating?: number;
  linkedInFollowers: number;
}

export interface CompanyUpdate {
  id: string;
  type: 'announcement' | 'hiring' | 'product' | 'funding' | 'expansion';
  title: string;
  description: string;
  date: Date;
  url?: string;
  engagement?: {
    likes: number;
    comments: number;
    shares: number;
  };
}

export interface CompanyPerson {
  id: string;
  name: string;
  title: string;
  department: string;
  level: 'entry' | 'mid' | 'senior' | 'executive' | 'c-level';
  linkedInUrl: string;
  profilePicture?: string;
  connectionDegree?: number; // 1st, 2nd, 3rd degree connection
  mutualConnections?: number;
  isDecisionMaker: boolean;
  isHiringManager: boolean;
  recentActivity?: string[];
}

export interface CompanyFinancials {
  revenue: string;
  revenueGrowth: number;
  funding: {
    totalFunding: string;
    lastRound: string;
    lastRoundDate: Date;
    investors: string[];
  };
  valuation?: string;
  publicStatus: 'public' | 'private' | 'subsidiary';
  stockSymbol?: string;
}

export interface CompanyCulture {
  values: string[];
  benefits: string[];
  workLifeBalance: number; // 1-10
  diversity: {
    womenPercentage: number;
    ethnicDiversity: string;
  };
  remotePolicy: 'fully-remote' | 'hybrid' | 'in-office' | 'flexible';
  averageTenure: number; // years
  employeeReviews: {
    glassdoorScore: number;
    recommendToFriend: number; // percentage
    ceoApproval: number; // percentage
    commonPros: string[];
    commonCons: string[];
  };
}

export interface JobOpening {
  id: string;
  title: string;
  department: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'internship';
  level: string;
  salaryRange?: {
    min: number;
    max: number;
    currency: string;
  };
  postedDate: Date;
  requirements: string[];
  hiringManager?: string;
  applicationUrl: string;
  internalReferralPossible: boolean;
}

export interface NetworkConnection {
  connectionId: string;
  connectionName: string;
  connectionTitle: string;
  department: string;
  yearsAtCompany: number;
  connectionStrength: number; // 0-100
  canProvideReferral: boolean;
  recentInteractions: Date[];
  notes?: string;
}

export interface CompanyResearchOptions {
  includeEmployees?: boolean;
  includeFinancials?: boolean;
  includeCulture?: boolean;
  includeJobs?: boolean;
  includeNetworkConnections?: boolean;
  maxEmployees?: number;
  departmentFilter?: string[];
  seniorityFilter?: string[];
}

/**
 * Research a company comprehensively
 */
export async function researchCompany(
  companyIdentifier: string, // Name, LinkedIn URL, or domain
  options: CompanyResearchOptions = {}
): Promise<CompanyProfile> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  // Check if we have cached data
  const cachedCompany = await getCachedCompanyData(companyIdentifier);
  if (cachedCompany && isCacheValid(cachedCompany.lastUpdated)) {
    return cachedCompany;
  }

  // Gather company data from multiple sources
  const companyData = await gatherCompanyData(companyIdentifier, options);

  // Cache the results
  await cacheCompanyData(companyIdentifier, companyData);

  return companyData;
}

async function gatherCompanyData(
  identifier: string,
  options: CompanyResearchOptions
): Promise<CompanyProfile> {
  // This would integrate with LinkedIn Company API and other data sources
  // For now, we'll return mock data with the structure

  const baseCompany: CompanyProfile = {
    id: identifier,
    name: identifier,
    industry: "Technology",
    size: "1,001-5,000 employees",
    headquarters: "San Francisco, CA",
    founded: 2010,
    description: "A leading technology company focused on innovation and growth.",
    website: `https://${identifier.toLowerCase()}.com`,
    linkedInUrl: `https://linkedin.com/company/${identifier.toLowerCase()}`,
    logoUrl: "",
    specialties: ["Software Development", "Innovation", "Technology"],
    locations: [
      {
        id: "hq",
        city: "San Francisco",
        state: "CA",
        country: "United States",
        isHeadquarters: true,
        employeeCount: 2500,
      }
    ],
    statistics: {
      employeeCount: 2500,
      employeeGrowth: 15,
      linkedInFollowers: 50000,
      glassdoorRating: 4.2,
    },
    recentUpdates: [],
    keyPeople: [],
  };

  // Add optional data based on options
  if (options.includeEmployees) {
    baseCompany.keyPeople = await discoverEmployees(identifier, options);
  }

  if (options.includeFinancials) {
    baseCompany.financials = await getCompanyFinancials(identifier);
  }

  if (options.includeCulture) {
    baseCompany.culture = await getCompanyCulture(identifier);
  }

  if (options.includeJobs) {
    baseCompany.jobs = await getCompanyJobs(identifier);
  }

  if (options.includeNetworkConnections) {
    baseCompany.networkConnections = await getNetworkConnections(identifier);
  }

  return baseCompany;
}

/**
 * Discover employees at a company
 */
export async function discoverEmployees(
  companyIdentifier: string,
  options: CompanyResearchOptions = {}
): Promise<CompanyPerson[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  // This would query LinkedIn for employees
  // For now, return mock data
  const employees: CompanyPerson[] = [
    {
      id: "emp1",
      name: "John Smith",
      title: "Senior Software Engineer",
      department: "Engineering",
      level: "senior",
      linkedInUrl: "https://linkedin.com/in/johnsmith",
      connectionDegree: 2,
      mutualConnections: 3,
      isDecisionMaker: false,
      isHiringManager: false,
    },
    {
      id: "emp2",
      name: "Sarah Johnson",
      title: "Engineering Manager",
      department: "Engineering",
      level: "senior",
      linkedInUrl: "https://linkedin.com/in/sarahjohnson",
      connectionDegree: 1,
      mutualConnections: 5,
      isDecisionMaker: true,
      isHiringManager: true,
    },
  ];

  return employees.filter(emp => {
    if (options.departmentFilter?.length) {
      return options.departmentFilter.includes(emp.department);
    }
    if (options.seniorityFilter?.length) {
      return options.seniorityFilter.includes(emp.level);
    }
    return true;
  }).slice(0, options.maxEmployees || 50);
}

/**
 * Get organizational chart for a company
 */
export async function getOrganizationalChart(
  companyIdentifier: string,
  department?: string
): Promise<{
  nodes: OrgChartNode[];
  relationships: OrgChartRelationship[];
}> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  const employees = await discoverEmployees(companyIdentifier, {
    departmentFilter: department ? [department] : undefined,
  });

  // Build organizational hierarchy
  const nodes: OrgChartNode[] = employees.map(emp => ({
    id: emp.id,
    name: emp.name,
    title: emp.title,
    department: emp.department,
    level: emp.level,
    profilePicture: emp.profilePicture,
    connectionDegree: emp.connectionDegree,
    isHiringManager: emp.isHiringManager,
  }));

  // Determine reporting relationships (simplified)
  const relationships: OrgChartRelationship[] = [];

  // Group by department and create hierarchy
  const departmentGroups = employees.reduce((acc, emp) => {
    if (!acc[emp.department]) acc[emp.department] = [];
    acc[emp.department].push(emp);
    return acc;
  }, {} as Record<string, CompanyPerson[]>);

  Object.values(departmentGroups).forEach(deptEmployees => {
    const manager = deptEmployees.find(emp => emp.isHiringManager);
    if (manager) {
      deptEmployees.filter(emp => emp.id !== manager.id).forEach(emp => {
        relationships.push({
          managerId: manager.id,
          reportId: emp.id,
          type: 'direct',
        });
      });
    }
  });

  return { nodes, relationships };
}

export interface OrgChartNode {
  id: string;
  name: string;
  title: string;
  department: string;
  level: string;
  profilePicture?: string;
  connectionDegree?: number;
  isHiringManager: boolean;
}

export interface OrgChartRelationship {
  managerId: string;
  reportId: string;
  type: 'direct' | 'indirect' | 'cross-functional';
}

/**
 * Identify networking opportunities at a company
 */
export async function identifyNetworkingOpportunities(
  companyIdentifier: string
): Promise<NetworkingOpportunity[]> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  const [employees, networkConnections, companyProfile] = await Promise.all([
    discoverEmployees(companyIdentifier, { includeNetworkConnections: true }),
    getNetworkConnections(companyIdentifier),
    researchCompany(companyIdentifier, { includeJobs: true }),
  ]);

  const opportunities: NetworkingOpportunity[] = [];

  // Direct connections at company
  networkConnections?.forEach(conn => {
    opportunities.push({
      type: 'direct_connection',
      priority: 'high',
      person: {
        id: conn.connectionId,
        name: conn.connectionName,
        title: conn.connectionTitle,
        department: conn.department,
      },
      reason: `You have a direct connection who has been at ${companyIdentifier} for ${conn.yearsAtCompany} years`,
      actionItems: [
        'Schedule a coffee chat to learn about company culture',
        'Ask about current team challenges and priorities',
        'Inquire about potential job opportunities',
      ],
      contactStrategy: 'direct_message',
      likelihood: 'very_high',
    });
  });

  // 2nd degree connections
  employees.filter(emp => emp.connectionDegree === 2).forEach(emp => {
    opportunities.push({
      type: 'mutual_connection',
      priority: 'medium',
      person: {
        id: emp.id,
        name: emp.name,
        title: emp.title,
        department: emp.department,
      },
      reason: `2nd degree connection with ${emp.mutualConnections} mutual connections`,
      actionItems: [
        'Request introduction through mutual connection',
        'Engage with their LinkedIn content first',
        'Research their background and interests',
      ],
      contactStrategy: 'warm_introduction',
      likelihood: 'medium',
    });
  });

  // Hiring managers for relevant roles
  const relevantHiringManagers = employees.filter(emp =>
    emp.isHiringManager && companyProfile.jobs?.some(job =>
      job.hiringManager === emp.name
    )
  );

  relevantHiringManagers.forEach(hm => {
    opportunities.push({
      type: 'hiring_manager',
      priority: 'high',
      person: {
        id: hm.id,
        name: hm.name,
        title: hm.title,
        department: hm.department,
      },
      reason: `Hiring manager for roles in ${hm.department}`,
      actionItems: [
        'Research their team and recent projects',
        'Prepare thoughtful questions about team challenges',
        'Showcase relevant experience and achievements',
      ],
      contactStrategy: hm.connectionDegree === 1 ? 'direct_message' : 'cold_outreach',
      likelihood: hm.connectionDegree === 1 ? 'high' : 'medium',
    });
  });

  return opportunities.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
}

export interface NetworkingOpportunity {
  type: 'direct_connection' | 'mutual_connection' | 'hiring_manager' | 'industry_peer' | 'alumni';
  priority: 'high' | 'medium' | 'low';
  person: {
    id: string;
    name: string;
    title: string;
    department: string;
  };
  reason: string;
  actionItems: string[];
  contactStrategy: 'direct_message' | 'warm_introduction' | 'cold_outreach' | 'event_networking';
  likelihood: 'very_high' | 'high' | 'medium' | 'low';
}

/**
 * Compare multiple companies
 */
export async function compareCompanies(
  companyIdentifiers: string[]
): Promise<CompanyComparison> {
  const user = await getCurrentUser();
  if (!user) throw new Error("User not authenticated");

  const companies = await Promise.all(
    companyIdentifiers.map(id =>
      researchCompany(id, {
        includeFinancials: true,
        includeCulture: true,
        includeJobs: true,
        includeNetworkConnections: true,
      })
    )
  );

  return {
    companies,
    comparison: {
      size: companies.map(c => ({ name: c.name, value: c.statistics.employeeCount })),
      growth: companies.map(c => ({ name: c.name, value: c.statistics.employeeGrowth })),
      culture: companies.map(c => ({
        name: c.name,
        value: c.culture?.employeeReviews?.glassdoorScore || 0
      })),
      networkConnections: companies.map(c => ({
        name: c.name,
        value: c.networkConnections?.length || 0
      })),
      jobOpenings: companies.map(c => ({
        name: c.name,
        value: c.jobs?.length || 0
      })),
    },
    recommendations: generateComparisonRecommendations(companies),
  };
}

export interface CompanyComparison {
  companies: CompanyProfile[];
  comparison: {
    size: { name: string; value: number }[];
    growth: { name: string; value: number }[];
    culture: { name: string; value: number }[];
    networkConnections: { name: string; value: number }[];
    jobOpenings: { name: string; value: number }[];
  };
  recommendations: {
    topChoice: string;
    reasons: string[];
    networkingPriority: string[];
    applicationStrategy: string;
  };
}

function generateComparisonRecommendations(companies: CompanyProfile[]): CompanyComparison['recommendations'] {
  // Simple scoring algorithm
  const scores = companies.map(company => {
    let score = 0;
    score += (company.networkConnections?.length || 0) * 10; // Network connections weight
    score += (company.culture?.employeeReviews?.glassdoorScore || 0) * 20; // Culture weight
    score += (company.jobs?.length || 0) * 5; // Job opportunities weight
    score += company.statistics.employeeGrowth; // Growth weight

    return { company: company.name, score };
  });

  const topChoice = scores.reduce((prev, current) =>
    current.score > prev.score ? current : prev
  ).company;

  return {
    topChoice,
    reasons: [
      'Strong network connections available',
      'Positive employee reviews and culture',
      'Active hiring with multiple opportunities',
      'Consistent growth trajectory',
    ],
    networkingPriority: companies
      .sort((a, b) => (b.networkConnections?.length || 0) - (a.networkConnections?.length || 0))
      .map(c => c.name),
    applicationStrategy: 'Focus on network-first approach for companies with existing connections',
  };
}

// Helper functions
async function getCachedCompanyData(identifier: string): Promise<CompanyProfile | null> {
  // This would query a cache table or Redis
  return null;
}

function isCacheValid(lastUpdated: Date): boolean {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return lastUpdated > oneWeekAgo;
}

async function cacheCompanyData(identifier: string, data: CompanyProfile): Promise<void> {
  // This would cache the data with expiration
}

async function getCompanyFinancials(identifier: string): Promise<CompanyFinancials | undefined> {
  // This would integrate with financial APIs
  return undefined;
}

async function getCompanyCulture(identifier: string): Promise<CompanyCulture | undefined> {
  // This would integrate with Glassdoor or similar APIs
  return undefined;
}

async function getCompanyJobs(identifier: string): Promise<JobOpening[]> {
  // This would integrate with job board APIs or scraping
  return [];
}

async function getNetworkConnections(identifier: string): Promise<NetworkConnection[]> {
  // This would query user's LinkedIn connections working at the company
  return [];
}