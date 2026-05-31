import * as cheerio from 'cheerio';
import { type NextRequest } from 'next/server';
import { z } from 'zod';

import { generateAIObject } from '@/lib/ai';
import { getServerAiProvider } from '@/lib/ai/provider';
import { db } from '@/lib/db/client';
import { getPrivateUserChannel } from '@/lib/events/channels';
import { sendDataUpdate } from '@/lib/events/data-update';
import { withRateLimit } from '@/lib/rate-limit/middleware';
import { getCurrentUser } from '@/lib/user/query';
import { DataEventType } from '@/types/events';
import type {
  InterviewerDossier,
  InterviewerInput,
  InterviewerProfile,
  InterviewerResearchResponse,
  InterviewStrategy,
  PersonalityAssessment,
} from '@/types/interviewer-research';

const interviewerInputSchema = z.object({
  interviewers: z.array(
    z.object({
      company: z.string(),
      linkedinUrl: z.string().url().optional().or(z.literal('')),
      name: z.string(),
      title: z.string().optional(),
    }),
  ),
});

interface SerpApiSearchResult {
  title: string;
  link: string;
  snippet?: string;
  position?: number;
}

interface SerpApiResponse {
  organic_results?: SerpApiSearchResult[];
  error?: string;
}

interface ScoredSearchResult extends SerpApiSearchResult {
  score: number;
}

// Score search results based on relevance
function scoreSearchResults(
  results: SerpApiSearchResult[],
  name: string,
  company: string,
): ScoredSearchResult[] {
  return results
    .map(result => {
      let score = 0.5; // Base score

      const titleLower = result.title.toLowerCase();
      const snippetLower = (result.snippet || '').toLowerCase();
      const nameLower = name.toLowerCase();
      const companyLower = company.toLowerCase();

      // Higher score for LinkedIn profiles
      if (result.link.includes('linkedin.com')) {
        score += 0.3;
      }

      // Score based on name match
      if (titleLower.includes(nameLower)) {
        score += 0.15;
      }
      if (snippetLower.includes(nameLower)) {
        score += 0.1;
      }

      // Score based on company match
      if (titleLower.includes(companyLower)) {
        score += 0.1;
      }
      if (snippetLower.includes(companyLower)) {
        score += 0.05;
      }

      // Prefer profiles/about pages
      if (
        result.link.includes('/about') ||
        result.link.includes('/profile') ||
        result.link.includes('/bio')
      ) {
        score += 0.1;
      }

      // Position bonus (earlier results get slight boost)
      if (result.position) {
        score += (10 - result.position) * 0.01;
      }

      return {
        ...result,
        score: Math.min(score, 1), // Cap at 1.0
      };
    })
    .sort((a, b) => b.score - a.score); // Sort by score descending
}

async function searchInterviewer(
  name: string,
  company: string,
): Promise<SerpApiSearchResult[]> {
  const serpApiKey = process.env.SERP_API_SECRET;

  if (!serpApiKey) {
    throw new Error('SERP_API_SECRET is not defined in environment variables.');
  }

  // Search for the person's professional profiles
  const query = `"${name}" ${company} site:linkedin.com OR site:twitter.com OR site:github.com`;
  const url = `https://serpapi.com/search.json?engine=google&q=${encodeURIComponent(
    query,
  )}&api_key=${serpApiKey}&num=10`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`SerpAPI request failed: ${response.status}`);
  }

  const data = (await response.json()) as SerpApiResponse;

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`);
  }

  return data.organic_results || [];
}

async function scrapeLinkedInProfile(url: string): Promise<string> {
  // LinkedIn blocks simple fetch requests, so we skip direct scraping
  // The profile URL is stored for reference, and we rely on SerpAPI search results
  // For better results, users should provide LinkedIn cookies or use the browser extension
  return '';
}

async function scrapeWebPage(url: string): Promise<string> {
  try {
    // Skip LinkedIn URLs as they're protected
    if (url.includes('linkedin.com')) {
      return '';
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      return '';
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove script and style elements
    $('script, style, nav, footer, header').remove();

    // Get text content, limited to first 5000 characters
    const text = $('body').text().trim().slice(0, 5000);
    return text.replace(/\s+/g, ' ');
  } catch (error) {
    console.error(`Error scraping ${url}:`, error);
    return '';
  }
}

async function buildInterviewerProfile(
  interviewer: InterviewerInput,
  searchResults: SerpApiSearchResult[],
): Promise<InterviewerProfile> {
  const profile: InterviewerProfile = {
    company: interviewer.company,
    linkedinUrl: interviewer.linkedinUrl || undefined,
    name: interviewer.name,
    title: interviewer.title,
    socialProfiles: interviewer.linkedinUrl
      ? { linkedin: interviewer.linkedinUrl }
      : {},
  };

  const researchContent: string[] = [];

  // Extract LinkedIn URL and other profiles
  for (const result of searchResults) {
    if (result.link.includes('linkedin.com')) {
      profile.linkedinUrl = result.link;
      profile.socialProfiles!.linkedin = result.link;

      // Try to scrape LinkedIn
      const linkedinContent = await scrapeLinkedInProfile(result.link);
      if (linkedinContent) {
        researchContent.push(linkedinContent);
      }
    } else if (result.link.includes('twitter.com')) {
      profile.socialProfiles!.twitter = result.link;
    } else if (result.link.includes('github.com')) {
      profile.socialProfiles!.github = result.link;
    }

    // Add snippet to research content
    if (result.snippet) {
      researchContent.push(result.snippet);
    }

    // Scrape the page for additional context (limit to first 3 results)
    if (searchResults.indexOf(result) < 3) {
      const pageContent = await scrapeWebPage(result.link);
      if (pageContent) {
        researchContent.push(pageContent);
      }
    }
  }

  // Use AI to extract structured information from research content
  const profileSchema = z.object({
    education: z.array(z.string()),
    experience: z.array(z.string()),
    skills: z.array(z.string()),
    summary: z.string(),
  });

  try {
    const aiProvider = await getServerAiProvider();
    const extractedInfo = await generateAIObject(
      `Based on the following information about ${interviewer.name} at ${interviewer.company}, extract their professional profile:

${researchContent.join('\n\n')}

Extract:
- A brief professional summary (2-3 sentences)
- Their work experience (as bullet points)
- Their education background
- Their key skills and expertise

If information is not available, return empty strings and empty arrays.`,
      profileSchema,
      { aiProvider, temperature: 0.3 },
    );

    profile.summary = extractedInfo.summary;
    profile.experience = extractedInfo.experience;
    profile.education = extractedInfo.education;
    profile.skills = extractedInfo.skills;
  } catch (error) {
    console.error('Error extracting profile info:', error);
  }

  return profile;
}

async function analyzePersonality(
  profile: InterviewerProfile,
  searchResults: SerpApiSearchResult[],
): Promise<PersonalityAssessment> {
  const personalitySchema = z.object({
    assessmentSummary: z.string(),
    communicationStyle: z.string(),
    decisionMakingApproach: z.string(),
    leadershipStyle: z.string(),
    personalityTraits: z.array(z.string()),
    values: z.array(z.string()),
    workPreferences: z.array(z.string()),
  });

  const context = `
Name: ${profile.name}
Company: ${profile.company}
Title: ${profile.title || 'Unknown'}
Summary: ${profile.summary || 'No summary available'}
Experience: ${profile.experience?.join(', ') || 'No experience data'}
Skills: ${profile.skills?.join(', ') || 'No skills data'}
Education: ${profile.education?.join(', ') || 'No education data'}

Search Results Context:
${searchResults.map(r => `${r.title}: ${r.snippet || ''}`).join('\n')}
`;

  const aiProvider = await getServerAiProvider();
  const personality = await generateAIObject(
    `Based on the following professional information about ${profile.name}, provide a personality assessment that will help someone prepare for an interview with them:

${context}

Provide the following fields:
1. Assessment Summary: A holistic overview (2-3 sentences) of their professional personality
2. Communication Style: How they communicate (e.g., direct, collaborative, analytical, creative)
3. Decision-Making Approach: How they make decisions (e.g., data-driven, intuitive, consensus-based)
4. Leadership Style: Their leadership approach (if applicable based on their role)
5. Personality Traits: Key characteristics (e.g., detail-oriented, big-picture thinker, empathetic)
6. Values: Their likely professional values (e.g., innovation, work-life balance, results-oriented)
7. Work Preferences: Their preferred work environment (e.g., fast-paced, structured, autonomous)

Be specific but professional. If information is limited, make educated inferences based on their role and industry. Return empty strings or empty arrays for fields that cannot be inferred.`,
    personalitySchema,
    { aiProvider, temperature: 0.5 },
  );

  return personality;
}

async function generateInterviewStrategy(
  profile: InterviewerProfile,
  personality: PersonalityAssessment,
): Promise<InterviewStrategy> {
  const strategySchema = z.object({
    conversationStarters: z.array(z.string()),
    culturalFit: z.string(),
    keyTalkingPoints: z.array(z.string()),
    questionsToAsk: z.array(z.string()),
    topicsToAvoid: z.array(z.string()),
  });

  const aiProvider = await getServerAiProvider();
  const strategy = await generateAIObject(
    `Based on this interviewer profile and personality assessment, create a strategic guide for interviewing with them:

Profile:
- Name: ${profile.name}
- Company: ${profile.company}
- Title: ${profile.title || 'Unknown'}
- Summary: ${profile.summary || 'N/A'}
- Skills: ${profile.skills?.join(', ') || 'N/A'}

Personality Assessment:
- Communication Style: ${personality.communicationStyle}
- Decision Making: ${personality.decisionMakingApproach}
- Leadership Style: ${personality.leadershipStyle || 'N/A'}
- Personality Traits: ${personality.personalityTraits.join(', ')}
- Values: ${personality.values?.join(', ') || 'N/A'}

Create:
1. Key talking points to emphasize (5-7 points that would resonate with them)
2. Thoughtful questions to ask them (3-5 questions that show you've done research)
3. Topics to avoid or be careful with (based on their personality and role)
4. Natural conversation starters (2-3 ways to break the ice)
5. Cultural fit assessment (how to demonstrate you're a good fit for their team)

Be specific, actionable, and professional.`,
    strategySchema,
    { aiProvider, temperature: 0.6 },
  );

  return strategy;
}

async function researchInterviewer(
  interviewer: InterviewerInput,
  userId: string,
  stepId: string,
): Promise<InterviewerDossier> {
  const userChannel = getPrivateUserChannel(userId);

  try {
    // Step 1: Search for the interviewer
    await sendDataUpdate({
      channel: userChannel,
      payload: {
        type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS,
        data: {
          stepId,
          interviewer: interviewer.name,
          status: 'in-progress',
          stage: 'searching',
          message: `Searching Google for ${interviewer.name} at ${interviewer.company}...`,
          progress: 10,
        },
      },
    });

    const searchResults = await searchInterviewer(
      interviewer.name,
      interviewer.company,
    );

    // Score the results
    const scoredResults = scoreSearchResults(
      searchResults,
      interviewer.name,
      interviewer.company,
    );

    // Send search results
    await sendDataUpdate({
      channel: userChannel,
      payload: {
        type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS,
        data: {
          stepId,
          interviewer: interviewer.name,
          status: 'in-progress',
          stage: 'analyzing',
          message: `Found ${scoredResults.length} results. Analyzing top sources...`,
          searchResults: scoredResults.slice(0, 5).map(r => ({
            title: r.title,
            url: r.link,
            snippet: r.snippet || '',
            score: r.score,
          })),
          progress: 30,
        },
      },
    });

    // Step 2: Build profile from search results
    await sendDataUpdate({
      channel: userChannel,
      payload: {
        type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS,
        data: {
          stepId,
          interviewer: interviewer.name,
          status: 'in-progress',
          stage: 'scraping',
          message: 'Extracting professional information from sources...',
          progress: 40,
        },
      },
    });

    const profile = await buildInterviewerProfile(interviewer, searchResults);

    // Step 3: Analyze personality
    await sendDataUpdate({
      channel: userChannel,
      payload: {
        type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS,
        data: {
          stepId,
          interviewer: interviewer.name,
          status: 'in-progress',
          stage: 'ai-processing',
          message: 'AI analyzing personality and communication style...',
          progress: 60,
        },
      },
    });

    const personality = await analyzePersonality(profile, searchResults);

    // Step 4: Generate interview strategy
    await sendDataUpdate({
      channel: userChannel,
      payload: {
        type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS,
        data: {
          stepId,
          interviewer: interviewer.name,
          status: 'in-progress',
          stage: 'ai-processing',
          message: 'Generating personalized interview strategy...',
          progress: 80,
        },
      },
    });

    const strategy = await generateInterviewStrategy(profile, personality);

    // Step 5: Complete
    await sendDataUpdate({
      channel: userChannel,
      payload: {
        type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS,
        data: {
          stepId,
          interviewer: interviewer.name,
          status: 'completed',
          stage: 'completed',
          message: 'Dossier complete!',
          progress: 100,
        },
      },
    });

    // Compile dossier
    const dossier: InterviewerDossier = {
      personality,
      profile,
      researchSources: searchResults.map(r => r.link),
      researchedAt: new Date().toISOString(),
      strategy,
    };

    return dossier;
  } catch (error) {
    await sendDataUpdate({
      channel: userChannel,
      payload: {
        type: DataEventType.INTERVIEWER_RESEARCH_PROGRESS,
        data: {
          stepId,
          interviewer: interviewer.name,
          status: 'error',
          stage: 'completed',
          message: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          progress: 0,
        },
      },
    });
    throw error;
  }
}

export async function POST(req: NextRequest) {
  // Rate limit SerpAPI calls - this endpoint can make multiple searches per interviewer
  const rateLimitError = await withRateLimit(req, {
    preset: 'serpApiBatch',
    message:
      'Too many interviewer research requests. Please wait before trying again.',
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const user = await getCurrentUser();
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const body = await req.json();
    const { interviewers } = interviewerInputSchema.parse(body);

    const dossiers: InterviewerDossier[] = [];
    const errors: Array<{ interviewer: string; error: string }> = [];

    // Process each interviewer
    for (const interviewer of interviewers) {
      try {
        // Check if we have cached data for this person
        const existingProfile = await db.peopleProfile.findFirst({
          where: {
            userId: user.id,
            name: {
              equals: interviewer.name,
              mode: 'insensitive',
            },
            company: {
              equals: interviewer.company,
              mode: 'insensitive',
            },
          },
        });

        let dossier: InterviewerDossier;

        if (existingProfile) {
          // Use cached data
          dossier = {
            profile: {
              name: existingProfile.name,
              company: existingProfile.company,
              title: existingProfile.title || undefined,
              linkedinUrl: existingProfile.linkedinUrl || undefined,
              summary: existingProfile.summary || undefined,
              experience: existingProfile.experience,
              education: existingProfile.education,
              skills: existingProfile.skills,
              articles: existingProfile.articles,
              socialProfiles: existingProfile.socialProfiles as any,
            },
            personality: existingProfile.personalityData as any,
            strategy: existingProfile.interviewStrategy as any,
            researchSources: existingProfile.researchSources,
            researchedAt:
              existingProfile.researchedAt?.toISOString() ||
              existingProfile.createdAt.toISOString(),
            fromCache: true,
          } as any;
        } else {
          // Do fresh research
          const stepId = `interviewer-${Date.now()}-${Math.random().toString(36).substring(7)}`;
          dossier = await researchInterviewer(interviewer, user.id, stepId);

          // Auto-save to database
          await db.peopleProfile.create({
            data: {
              userId: user.id,
              name: dossier.profile.name,
              company: dossier.profile.company,
              title: dossier.profile.title,
              linkedinUrl: dossier.profile.linkedinUrl,
              summary: dossier.profile.summary,
              experience: dossier.profile.experience || [],
              education: dossier.profile.education || [],
              skills: dossier.profile.skills || [],
              articles: dossier.profile.articles || [],
              socialProfiles: (dossier.profile.socialProfiles as any) || {},
              personalityData: dossier.personality as any,
              interviewStrategy: dossier.strategy as any,
              researchSources: dossier.researchSources,
              researchedAt: new Date(dossier.researchedAt),
            },
          });
        }

        dossiers.push(dossier);
      } catch (error) {
        console.error(`Error researching ${interviewer.name}:`, error);
        errors.push({
          error:
            error instanceof Error ? error.message : 'Unknown error occurred',
          interviewer: interviewer.name,
        });
      }
    }

    const response: InterviewerResearchResponse = {
      dossiers,
      errors: errors.length > 0 ? errors : undefined,
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error in interviewer research:', error);
    return new Response(
      error instanceof Error ? error.message : 'Internal Server Error',
      { status: 500 },
    );
  }
}
