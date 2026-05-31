'use cache';

import { db } from '@/lib/db/client';
import { ApplicationStatus } from '@/generated/prisma/browser';
import { cacheTag } from 'next/cache';

export interface KeywordMetric {
  keyword: string;
  frequency: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  totalApplications: number;
  industryRelevance: number;
  trendDirection: 'up' | 'down' | 'stable';
  effectiveness: 'high' | 'medium' | 'low';
  contexts: string[]; // Where the keyword appears (skills, experience, etc.)
}

export interface KeywordAnalysisOptions {
  resumeId?: string;
  resumeRevisionId?: string;
  dateRange?: {
    startDate: Date;
    endDate: Date;
  };
  minApplications?: number;
}

export async function analyzeKeywordEffectiveness(
  userId: string,
  options: KeywordAnalysisOptions = {}
): Promise<KeywordMetric[]> {
  cacheTag(`user:${userId}:keyword-analysis`);
  
  const { resumeId, resumeRevisionId, dateRange, minApplications = 5 } = options;
  
  // Get application submissions with resume content
  const whereClause: any = {
    userId,
    resume: {
      isNot: null,
    },
    ...(dateRange && {
      createdAt: {
        gte: dateRange.startDate,
        lte: dateRange.endDate,
      },
    }),
  };

  if (resumeId) {
    whereClause.resumeId = resumeId;
  }

  const applications = await db.applicationSubmission.findMany({
    where: whereClause,
    include: {
      resume: {
        include: {
          analysis: true,
        },
      },
      jobLead: {
        include: {
          jobListing: {
            select: {
              title: true,
              description: true,
              company: true,
            },
          },
        },
      },
    },
  });

  if (applications.length < minApplications) {
    return [];
  }

  // Extract keywords from resumes and analyze their effectiveness
  const keywordMetrics = new Map<string, {
    frequency: number;
    applications: typeof applications;
    contexts: Set<string>;
  }>();

  // Process each application to extract keywords
  applications.forEach((app) => {
    if (!app.resume?.markdown && !app.resume?.json) return;

    const resumeContent = app.resume.markdown || JSON.stringify(app.resume.json);
    const keywords = extractKeywords(resumeContent);

    keywords.forEach((keyword) => {
      if (!keywordMetrics.has(keyword.word)) {
        keywordMetrics.set(keyword.word, {
          frequency: 0,
          applications: [],
          contexts: new Set(),
        });
      }

      const metric = keywordMetrics.get(keyword.word)!;
      metric.frequency += keyword.frequency;
      metric.applications.push(app);
      keyword.contexts.forEach(context => metric.contexts.add(context));
    });
  });

  // Calculate success rates for each keyword
  const results: KeywordMetric[] = [];

  keywordMetrics.forEach((data, keyword) => {
    if (data.applications.length < minApplications) return;

    const totalApplications = data.applications.length;
    const responses = data.applications.filter(app => 
      [ApplicationStatus.UNDER_REVIEW, ApplicationStatus.INTERVIEW_REQUESTED, 
       ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.INTERVIEW_COMPLETED,
       ApplicationStatus.OFFER_RECEIVED, ApplicationStatus.OFFER_ACCEPTED].includes(app.status)
    );
    const interviews = data.applications.filter(app => 
      [ApplicationStatus.INTERVIEW_SCHEDULED, ApplicationStatus.INTERVIEW_COMPLETED,
       ApplicationStatus.OFFER_RECEIVED, ApplicationStatus.OFFER_ACCEPTED].includes(app.status)
    );
    const offers = data.applications.filter(app => 
      [ApplicationStatus.OFFER_RECEIVED, ApplicationStatus.OFFER_ACCEPTED].includes(app.status)
    );

    const responseRate = (responses.length / totalApplications) * 100;
    const interviewRate = (interviews.length / totalApplications) * 100;
    const offerRate = (offers.length / totalApplications) * 100;

    // Calculate effectiveness based on combined success rates
    const overallEffectiveness = (responseRate + interviewRate * 2 + offerRate * 3) / 6;
    let effectiveness: 'high' | 'medium' | 'low';
    if (overallEffectiveness >= 15) effectiveness = 'high';
    else if (overallEffectiveness >= 8) effectiveness = 'medium';
    else effectiveness = 'low';

    // Mock industry relevance (in real implementation, this would use ML/NLP)
    const industryRelevance = calculateIndustryRelevance(keyword, data.applications);

    // Mock trend direction (in real implementation, this would analyze historical data)
    const trendDirection = calculateTrendDirection(keyword, responseRate);

    results.push({
      keyword,
      frequency: data.frequency,
      responseRate,
      interviewRate,
      offerRate,
      totalApplications,
      industryRelevance,
      trendDirection,
      effectiveness,
      contexts: Array.from(data.contexts),
    });
  });

  return results.sort((a, b) => {
    const effectivenessOrder = { high: 3, medium: 2, low: 1 };
    return effectivenessOrder[b.effectiveness] - effectivenessOrder[a.effectiveness];
  });
}

function extractKeywords(content: string): Array<{
  word: string;
  frequency: number;
  contexts: string[];
}> {
  // This is a simplified implementation
  // In production, you'd use more sophisticated NLP techniques
  
  const techKeywords = [
    'React', 'JavaScript', 'TypeScript', 'Node.js', 'Python', 'Java', 'AWS', 'Docker',
    'Kubernetes', 'GraphQL', 'MongoDB', 'PostgreSQL', 'Redis', 'Elasticsearch',
    'Machine Learning', 'AI', 'Data Science', 'Analytics', 'API', 'Microservices',
    'CI/CD', 'DevOps', 'Agile', 'Scrum', 'Leadership', 'Management', 'Architecture',
    'Frontend', 'Backend', 'Full Stack', 'Mobile', 'iOS', 'Android', 'Flutter',
    'Vue.js', 'Angular', 'Spring', 'Django', 'Flask', 'Express', 'Terraform',
    'Jenkins', 'Git', 'GitHub', 'GitLab', 'Jira', 'Confluence', 'Slack'
  ];

  const softSkills = [
    'Leadership', 'Communication', 'Teamwork', 'Problem Solving', 'Critical Thinking',
    'Project Management', 'Strategic Planning', 'Mentoring', 'Collaboration',
    'Innovation', 'Adaptability', 'Time Management', 'Organization'
  ];

  const allKeywords = [...techKeywords, ...softSkills];
  const results: Array<{ word: string; frequency: number; contexts: string[] }> = [];

  allKeywords.forEach(keyword => {
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
    const matches = content.match(regex);
    
    if (matches && matches.length > 0) {
      // Simple context detection - in production, use more sophisticated analysis
      const contexts: string[] = [];
      if (content.toLowerCase().includes('skills') && content.toLowerCase().includes(keyword.toLowerCase())) {
        contexts.push('skills');
      }
      if (content.toLowerCase().includes('experience') && content.toLowerCase().includes(keyword.toLowerCase())) {
        contexts.push('experience');
      }
      if (content.toLowerCase().includes('project') && content.toLowerCase().includes(keyword.toLowerCase())) {
        contexts.push('projects');
      }
      if (contexts.length === 0) {
        contexts.push('general');
      }

      results.push({
        word: keyword,
        frequency: matches.length,
        contexts,
      });
    }
  });

  return results;
}

function calculateIndustryRelevance(keyword: string, applications: any[]): number {
  // Mock implementation - in production, analyze job descriptions and industry trends
  const techKeywords = ['React', 'JavaScript', 'TypeScript', 'Node.js', 'Python', 'AWS'];
  const emergingKeywords = ['GraphQL', 'Kubernetes', 'Machine Learning', 'AI'];
  const traditionalKeywords = ['Java', 'SQL', 'Project Management'];

  if (emergingKeywords.includes(keyword)) return Math.floor(Math.random() * 20) + 80;
  if (techKeywords.includes(keyword)) return Math.floor(Math.random() * 15) + 75;
  if (traditionalKeywords.includes(keyword)) return Math.floor(Math.random() * 20) + 60;
  return Math.floor(Math.random() * 30) + 50;
}

function calculateTrendDirection(keyword: string, responseRate: number): 'up' | 'down' | 'stable' {
  // Mock implementation - in production, analyze historical performance data
  const emergingKeywords = ['GraphQL', 'TypeScript', 'Kubernetes', 'AI', 'Machine Learning'];
  const decliningKeywords = ['MongoDB', 'jQuery', 'PHP'];

  if (emergingKeywords.includes(keyword)) return 'up';
  if (decliningKeywords.includes(keyword)) return 'down';
  if (responseRate >= 15) return 'up';
  if (responseRate <= 8) return 'down';
  return 'stable';
}