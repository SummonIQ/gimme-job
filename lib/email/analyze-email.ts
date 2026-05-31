import { generateAIObject } from '@/lib/ai';
import type { AiProvider } from '@/lib/ai/models';
import { z } from 'zod';

const emailAnalysisSchema = z.object({
  isJobRelated: z.boolean().describe(
    'Whether this email is related to a job application (rejection, interview invite, offer, confirmation, etc.)',
  ),
  status: z
    .enum([
      'APPLICATION_RECEIVED',
      'APPLICATION_REJECTED',
      'INTERVIEW_SCHEDULED',
      'INTERVIEW_FOLLOWUP',
      'OFFER_MADE',
      'OFFER_REJECTED',
      'ASSESSMENT_REQUEST',
      'GENERAL_UPDATE',
      'NOT_JOB_RELATED',
    ])
    .describe('The detected status or type of this email'),
  companyName: z
    .string()
    .nullable()
    .describe('The company name mentioned in the email, if any'),
  jobTitle: z
    .string()
    .nullable()
    .describe('The job title mentioned in the email, if any'),
  summary: z
    .string()
    .describe('A brief 1-2 sentence summary of the email content'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('Confidence score for the analysis (0-1)'),
  interviewDate: z
    .string()
    .nullable()
    .describe(
      'If an interview is scheduled, the date/time mentioned (ISO 8601 or human-readable)',
    ),
  interviewType: z
    .string()
    .nullable()
    .describe(
      'If an interview is scheduled, the type (phone, video, in-person, etc.)',
    ),
  nextSteps: z
    .string()
    .nullable()
    .describe('Any next steps or action items mentioned in the email'),
});

export type EmailAnalysisResult = z.infer<typeof emailAnalysisSchema>;

/**
 * Use AI to analyze an incoming email and determine if it's job-application related,
 * and if so, extract the status and relevant details.
 */
export async function analyzeApplicationEmail(params: {
  aiProvider?: AiProvider;
  fromEmail: string;
  fromName: string | null;
  subject: string;
  textBody: string | null;
  htmlBody: string | null;
}): Promise<EmailAnalysisResult> {
  const body = params.textBody || stripHtml(params.htmlBody || '');

  const truncatedBody = body.slice(0, 4000);

  const prompt = `You are an expert at analyzing emails related to job applications. Analyze the following email and determine:

1. Is this email related to a job application? (rejections, interview invitations, offer letters, application confirmations, assessment requests, etc.)
2. What is the status/type of this email?
3. What company is it from?
4. What job title is it about?
5. If an interview is scheduled, when and what type?
6. Any next steps mentioned?

EMAIL DETAILS:
From: ${params.fromName ? `${params.fromName} <${params.fromEmail}>` : params.fromEmail}
Subject: ${params.subject}

Body:
${truncatedBody}

Analyze this email carefully. Many automated job application emails use "noreply" addresses - these are still job-related.
Common patterns:
- "Thank you for applying" = APPLICATION_RECEIVED
- "We regret to inform" / "moved forward with other candidates" = APPLICATION_REJECTED
- "We'd like to schedule" / "interview" = INTERVIEW_SCHEDULED
- "We are pleased to offer" = OFFER_MADE
- Assessment/coding challenge requests = ASSESSMENT_REQUEST
- General status updates = GENERAL_UPDATE
- Verification codes / security codes / one-time codes / OTP for an application = GENERAL_UPDATE (always job-related)
- Marketing emails, newsletters, unrelated = NOT_JOB_RELATED`;

  return generateAIObject(prompt, emailAnalysisSchema, {
    aiProvider: params.aiProvider,
    temperature: 0.1,
  });
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}
