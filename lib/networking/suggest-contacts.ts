import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { AppError, ErrorCode } from '@/lib/errors';
import { generateAIObject } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { z } from 'zod';
import { ContactPriority, ContactSource, ContactStatus, NetworkContact } from './types';

const contactSuggestionsSchema = z.object({
  suggestions: z.array(
    z.object({
      name: z.string().optional(),
      company: z.string(),
      position: z.string().optional(),
      linkedinUrl: z.string().optional(),
      relevance: z.number(),
      reason: z.string(),
      alreadyInContacts: z.boolean(),
      contactId: z.string().optional(),
    }),
  ),
});

export interface ContactSuggestion {
  name?: string;
  company: string;
  position?: string;
  linkedinUrl?: string;
  relevance: number; // 1-10 scale
  reason: string;
  alreadyInContacts: boolean;
  contactId?: string;
}

/**
 * Suggest networking contacts based on a job lead
 * @param jobLeadId The ID of the job lead to analyze
 */
export async function suggestContactsForJobLead(
  jobLeadId: string,
  options: { readonly aiProvider?: AiProvider } = {},
): Promise<ContactSuggestion[]> {
  const user = await getCurrentUser();
  
  // Get the job lead with its listing details
  const jobLead = await db.jobLead.findUnique({
    where: {
      id: jobLeadId,
      userId: user.id,
    },
    include: {
      jobListing: true,
    },
  });
  
  if (!jobLead) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Job lead with ID ${jobLeadId} not found`,
    });
  }

  // Get all of the user's existing contacts to check for matches
  const existingContacts = await db.networkContact.findMany({
    where: {
      userId: user.id,
    },
    select: {
      id: true,
      name: true,
      company: true,
      position: true,
      linkedinUrl: true,
    },
  });

  // Use AI to analyze job posting and suggest contacts
  const suggestions = await generateContactSuggestions(
    jobLead.jobListing.title,
    jobLead.jobListing.company || '',
    jobLead.jobListing.description || '',
    jobLead.jobListing.location || '',
    existingContacts,
    options.aiProvider,
  );

  return suggestions;
}

/**
 * Generate contact suggestions based on job details
 */
async function generateContactSuggestions(
  jobTitle: string,
  company: string,
  jobDescription: string,
  location: string,
  existingContacts: Array<{
    id: string;
    name?: string | null;
    company?: string | null;
    position?: string | null;
    linkedinUrl?: string | null;
  }>,
  aiProvider?: AiProvider,
): Promise<ContactSuggestion[]> {
  try {
    // Create a prompt for the AI
    const prompt = `I need suggestions for networking contacts based on the following job:
    
Job Title: ${jobTitle}
Company: ${company}
Location: ${location}
Job Description:
${jobDescription.substring(0, 2000)}${jobDescription.length > 2000 ? '...' : ''}

Based on this job, suggest up to 5 potential networking contacts that could be valuable for the job seeker to connect with. For each contact, provide a name (if applicable), company, position, potential LinkedIn URL, relevance score (1-10), and reason why they would be a valuable contact.

Also, check if any of these suggested contacts match with these existing contacts (by company and/or position):
${JSON.stringify(existingContacts.map(c => ({ 
  id: c.id, 
  name: c.name || undefined, 
  company: c.company || undefined, 
  position: c.position || undefined,
  linkedinUrl: c.linkedinUrl || undefined
})))}

Return the results as a JSON object with a "suggestions" array of objects, each with:
  - name: contact name (can be generic like 'Hiring Manager' if specific name unknown)
  - company: company name
  - position: position title (optional)
  - linkedinUrl: optional LinkedIn URL
  - relevance: relevance score (1-10)
  - reason: reason why this contact would be valuable
  - alreadyInContacts: boolean (true if this appears to match an existing contact)
  - contactId: ID of the matching contact if alreadyInContacts is true (optional)`;

    const parsed = await generateAIObject(prompt, contactSuggestionsSchema, {
      aiProvider,
      system:
        'You are an expert career advisor specializing in professional networking. Your task is to analyze job descriptions and suggest valuable networking contacts.',
      temperature: 0.5,
    });

    return parsed.suggestions as ContactSuggestion[];

  } catch (error) {
    console.error('Error generating contact suggestions:', error);
    throw new AppError({
      code: ErrorCode.AI_SERVICE_ERROR,
      message: 'Failed to generate networking contact suggestions',
      cause: error,
    });
  }
}

/**
 * Add a suggested contact to your contacts list
 */
export async function addSuggestedContact(
  data: {
    name?: string;
    company: string;
    position?: string;
    linkedinUrl?: string;
    jobLeadId?: string;
  }
): Promise<NetworkContact> {
  const { name, company, position, linkedinUrl, jobLeadId } = data;
  
  // Ensure we have at least a company name
  if (!company) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Company name is required',
    });
  }
  
  // Create the contact with the suggested info
  const contactData = {
    name: name || `${position || 'Contact'} at ${company}`,
    company,
    position,
    linkedinUrl,
    jobLeadId,
    source: ContactSource.LINKEDIN,
    status: ContactStatus.NEW,
    priority: ContactPriority.MEDIUM,
    tags: ['suggested', company.toLowerCase().replace(/\s+/g, '-')],
    notes: `Automatically added from job lead${jobLeadId ? ` (ID: ${jobLeadId})` : ''}`
  };
  
  // Use the existing contact creation function
  const contact = await db.networkContact.create({
    data: {
      ...contactData,
      userId: (await getCurrentUser()).id,
    },
  });
  
  return contact;
}

/**
 * Suggest LinkedIn connections based on a job lead
 */
export async function suggestLinkedinConnections(
  jobLeadId: string,
  options: { readonly aiProvider?: AiProvider } = {},
): Promise<any[]> {
  // This would integrate with LinkedIn API
  // For now, return the contact suggestions with LinkedIn URLs
  const suggestions = await suggestContactsForJobLead(jobLeadId, options);
  return suggestions.filter(s => s.linkedinUrl);
}
