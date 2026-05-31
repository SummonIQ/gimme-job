"use server";

import { db } from "@/lib/db/client";
import { getCurrentUser } from "@/lib/user/query";
import { extractSkillsFromProfile, getLinkedInProfileData } from "./profile-import";

interface ConnectionSuggestion {
  name: string;
  title?: string;
  company?: string;
  relevance: number; // 1-10
  reason: string;
  linkedInUrl?: string;
  matchType: 'company' | 'industry' | 'role' | 'skills' | 'school';
}

/**
 * Generate connection suggestions based on a job lead
 */
export async function suggestConnectionsForJobLead(jobLeadId: string): Promise<ConnectionSuggestion[]> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  // Get LinkedIn profile data
  const profileData = await getLinkedInProfileData();
  if (!profileData) {
    throw new Error("LinkedIn profile not found. Please import your profile first.");
  }

  // Get job lead data
  const jobLead = await db.jobLead.findUnique({
    where: { id: jobLeadId },
    include: {
      jobListing: true,
    },
  });

  if (!jobLead) {
    throw new Error("Job lead not found");
  }

  const jobTitle = jobLead.jobListing?.title || jobLead.title || "";
  const company = jobLead.jobListing?.company || "";
  const jobDescription = jobLead.jobListing?.description || "";

  // Extract job skills from description
  const jobSkills = extractSkillsFromJobDescription(jobDescription);
  
  // Get user's skills
  const userSkills = await extractSkillsFromProfile();

  // Match algorithm to find suggestions
  const suggestions: ConnectionSuggestion[] = [];

  // 1. Check if user has worked at the company before
  if (company && profileData.positions) {
    const sameCompanyConnections = profileData.positions
      .filter((position: any) => 
        position.company && 
        position.company.toLowerCase() === company.toLowerCase()
      )
      .map((position: any) => {
        return {
          name: `Former colleagues at ${company}`,
          company,
          relevance: 9,
          reason: `You've worked at ${company} before, reach out to former colleagues.`,
          matchType: 'company' as const,
        };
      });

    if (sameCompanyConnections.length > 0) {
      suggestions.push(sameCompanyConnections[0]);
    }
  }

  // 2. Check for industry connections
  const industry = determineIndustry(jobTitle, company, jobDescription);
  if (industry && profileData.positions) {
    const industryKeywords = getIndustryKeywords(industry);
    const industryConnections = profileData.positions
      .filter((position: any) => 
        position.company && 
        industryKeywords.some(keyword => 
          position.company.toLowerCase().includes(keyword.toLowerCase()) ||
          (position.title && position.title.toLowerCase().includes(keyword.toLowerCase()))
        )
      )
      .map((position: any) => {
        return {
          name: `${position.title} at ${position.company}`,
          title: position.title,
          company: position.company,
          relevance: 8,
          reason: `They work in the ${industry} industry, which is relevant to this job.`,
          matchType: 'industry' as const,
        };
      });

    // Take top 2 industry connections
    suggestions.push(...industryConnections.slice(0, 2));
  }

  // 3. Check for role-based connections
  if (jobTitle && profileData.positions) {
    const roleKeywords = extractKeywords(jobTitle);
    const roleConnections = profileData.positions
      .filter((position: any) => 
        position.title && 
        roleKeywords.some(keyword => 
          position.title.toLowerCase().includes(keyword.toLowerCase())
        )
      )
      .map((position: any) => {
        return {
          name: `${position.title} at ${position.company}`,
          title: position.title,
          company: position.company,
          relevance: 7,
          reason: `They have experience in a similar role (${position.title}).`,
          matchType: 'role' as const,
        };
      });

    // Take top 2 role connections
    suggestions.push(...roleConnections.slice(0, 2));
  }

  // 4. Check for skill-based connections
  if (jobSkills.length > 0 && userSkills.length > 0 && profileData.positions) {
    const skillOverlap = jobSkills.filter(skill => 
      userSkills.some(userSkill => 
        userSkill.toLowerCase().includes(skill.toLowerCase()) ||
        skill.toLowerCase().includes(userSkill.toLowerCase())
      )
    );

    if (skillOverlap.length > 0) {
      suggestions.push({
        name: "Skill-based connections",
        relevance: 8,
        reason: `Look for connections who have experience with ${skillOverlap.slice(0, 3).join(", ")}`,
        matchType: 'skills' as const,
      });
    }
  }

  // 5. Check for educational connections
  if (profileData.education && profileData.education.length > 0) {
    const schools = profileData.education.map((edu: any) => edu.school);
    
    schools.forEach((school: string) => {
      suggestions.push({
        name: `Alumni from ${school}`,
        relevance: 6,
        reason: `Connect with fellow alumni from ${school} who work at ${company} or similar companies.`,
        matchType: 'school' as const,
      });
    });
  }

  // Filter out duplicates and limit to 5 suggestions
  const uniqueSuggestions = suggestions
    .filter((suggestion, index, self) => 
      index === self.findIndex(s => s.name === suggestion.name)
    )
    .slice(0, 5);

  return uniqueSuggestions;
}

/**
 * Extract skills from job description
 */
function extractSkillsFromJobDescription(description: string): string[] {
  if (!description) return [];
  
  // List of common technical skills
  const technicalSkills = [
    "JavaScript", "TypeScript", "React", "Next.js", "Node.js", "Python", "Java",
    "C#", "C++", "AWS", "Azure", "Docker", "Kubernetes", "SQL", "NoSQL", "MongoDB",
    "GraphQL", "REST API", "Git", "CI/CD", "Agile", "Scrum", "DevOps", "Machine Learning",
    "Data Analysis", "Artificial Intelligence", "UI/UX", "Design Systems"
  ];
  
  // List of common soft skills
  const softSkills = [
    "Communication", "Leadership", "Teamwork", "Problem Solving", "Critical Thinking",
    "Time Management", "Project Management", "Collaboration", "Adaptability", "Creativity"
  ];
  
  // Combine all skills to search for
  const allSkills = [...technicalSkills, ...softSkills];
  
  // Find matches in the description
  const matches = allSkills.filter(skill => 
    description.toLowerCase().includes(skill.toLowerCase())
  );
  
  return matches;
}

/**
 * Determine the industry based on job information
 */
function determineIndustry(jobTitle: string, company: string, description: string): string {
  const industries = [
    "Technology", "Finance", "Healthcare", "Education", "Retail", 
    "Manufacturing", "Media", "Marketing", "Consulting", "Legal"
  ];

  const combinedText = `${jobTitle} ${company} ${description}`.toLowerCase();
  
  for (const industry of industries) {
    if (combinedText.includes(industry.toLowerCase())) {
      return industry;
    }
  }
  
  // Default to Technology if no match found
  return "Technology";
}

/**
 * Get keywords related to an industry
 */
function getIndustryKeywords(industry: string): string[] {
  const industryKeywords: Record<string, string[]> = {
    "Technology": ["tech", "software", "IT", "digital", "web", "data", "cloud", "cyber", "computer"],
    "Finance": ["bank", "financial", "invest", "capital", "asset", "wealth", "fund", "broker"],
    "Healthcare": ["health", "medical", "hospital", "clinic", "care", "patient", "doctor", "pharma"],
    "Education": ["school", "university", "college", "academy", "teaching", "learning", "education"],
    "Retail": ["retail", "store", "shop", "commerce", "consumer", "merchandise", "product", "brand"],
    "Manufacturing": ["manufacturing", "factory", "production", "industrial", "assembly", "materials"],
    "Media": ["media", "publishing", "entertainment", "news", "film", "television", "content", "digital"],
    "Marketing": ["marketing", "advertising", "brand", "PR", "communications", "digital", "social"],
    "Consulting": ["consulting", "consultant", "advisor", "strategy", "management", "solution"],
    "Legal": ["legal", "law", "attorney", "counsel", "compliance", "regulatory", "litigation"]
  };
  
  return industryKeywords[industry] || [];
}

/**
 * Extract keywords from a text
 */
function extractKeywords(text: string): string[] {
  if (!text) return [];
  
  // Remove common stop words
  const stopWords = ["and", "the", "of", "in", "for", "with", "at"];
  
  return text
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !stopWords.includes(word.toLowerCase())
    );
}
