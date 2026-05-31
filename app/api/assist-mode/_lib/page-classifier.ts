import { z } from 'zod';

import { generateAIObject, generateVisionObject } from '@/lib/ai';
import { detectClosedPostingMessageDetailed } from '@/lib/applications/closed-posting-detection';
import { recordClosedPostingPhrase } from '@/lib/applications/closed-posting-learning';
import { sanitizeHtmlForAI } from '@/lib/assist-training/vision-analyzer';

export const pageClassificationSchema = z.object({
  pageType: z.enum([
    'application_form',
    'job_listing',
    'job_search',
    'account_creation',
    'login',
    'confirmation',
    'error',
    'other',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  applicationFields: z
    .array(
      z.object({
        selector: z.string(),
        label: z.string(),
        isApplicationField: z.boolean(),
        reason: z.string(),
      }),
    )
    .describe(
      'Detected form fields with classification. Empty array if none found.',
    ),
  nonApplicationElements: z
    .array(z.string())
    .describe(
      'CSS selectors of elements that are NOT part of the application (search bars, nav links, site chrome). Empty array if none.',
    ),
  suggestedNextActionSelector: z
    .string()
    .describe(
      'CSS selector of the suggested next element to interact with. Empty string if none.',
    ),
  suggestedNextActionType: z
    .string()
    .describe('Action type: click, fill, select, etc. Empty string if none.'),
  suggestedNextActionReason: z
    .string()
    .describe('Why this action is suggested. Empty string if none.'),
});

export type PageClassification = z.infer<typeof pageClassificationSchema>;

const VISION_CLASSIFICATION_PROMPT = `You are an expert at analyzing job application pages. You will receive a FULL-PAGE screenshot of a web page (from top to bottom, including all scrollable content) along with its HTML structure.

Your task is to CLASSIFY this page and identify which elements are part of a job application vs site navigation/search. Examine the ENTIRE screenshot — form fields may appear anywhere on the page, not just at the top.

IMPORTANT DISTINCTIONS:
- "application_form" = A page with actual job application form fields (name, email, resume upload, work history, etc.)
- "job_listing" = A page showing a specific job description with an "Apply" button but no application form fields
- "job_search" = A page with a job SEARCH interface (search bars, filters, job listing cards) — NOT an application
- "account_creation" = A page that asks the applicant to create an account before continuing, usually with email + password + confirm password fields
- "login" = A login/signup page
- "confirmation" = A submission confirmation page
- "error" = An error page (job expired, not found, etc.)
- "other" = Anything else (company homepage, career page without specific job/search, etc.)

For EACH input field visible on the page, determine whether it's:
- An APPLICATION field (first name, last name, email, phone, resume upload, cover letter, work authorization, etc.)
- A SEARCH/NAVIGATION element (job title search, location search, keyword filter, company search, etc.)
- SITE CHROME (login button in header, language selector, cookie consent, etc.)

When deciding, strongly use semantic form metadata when present:
- label text and associated accessible names
- fieldset and legend group labels, plus aria-describedby helper text
- autocomplete tokens such as username, email, current-password, new-password, given-name, family-name
- input type, name, id, placeholder, and aria-label

Return your response as JSON with these fields:
- pageType: the classification
- confidence: how confident you are (0-1)
- reasoning: brief explanation of why
- applicationFields: list of detected fields with whether they're application fields
- nonApplicationElements: CSS selectors of elements to IGNORE (search bars, nav, site chrome)
- suggestedNextAction: if this IS an application form, what's the next field to fill`;

const HTML_ONLY_CLASSIFICATION_PROMPT = `You are an expert at analyzing job application web pages from their HTML structure.

Classify this page and identify which form elements are part of a job APPLICATION vs site SEARCH/NAVIGATION.

IMPORTANT DISTINCTIONS:
- "application_form" = Has actual job application fields (name, email, resume, work history, cover letter)
- "job_listing" = Shows a specific job description with an "Apply" button but NO application form fields yet
- "job_search" = Has a job SEARCH interface (search bars, job title/location inputs, keyword filters, lists of jobs) — this is NOT an application
- "account_creation" = Requires creating an account before continuing, usually with email, password, and confirm password fields
- "login" = Login or signup page
- "confirmation" = Submission confirmation
- "error" = Error page (expired job, not found)
- "other" = Anything else

KEY SIGNALS for job_search (NOT application):
- Inputs with placeholders like "Job title, keywords, or company", "Where", "Search jobs"
- Inputs with name/id containing "search", "keyword", "query", "location" in a search context
- Multiple job listing cards/links on the page
- Filter controls (salary range, job type, distance)

KEY SIGNALS for application_form:
- Inputs for personal info (first name, last name, email, phone)
- File upload for resume/CV
- Textarea for cover letter
- Work authorization questions
- "Submit Application" or "Apply" form submission buttons

For each input/select/textarea found, classify it as application field or not.
List CSS selectors of NON-application elements (search bars, nav inputs, site chrome) to IGNORE.`;

/**
 * Classify a page using vision (screenshot + HTML) or HTML-only.
 * Uses the centralized AI model configuration.
 */
export async function classifyPage(
  html: string,
  url: string,
  screenshotBase64?: string | null,
  options: { readonly aiProvider?: import('@/lib/ai/models').AiProvider } = {},
): Promise<PageClassification> {
  const closedPostingDetail = detectClosedPostingMessageDetailed(html);
  if (closedPostingDetail) {
    // Persist the exact phrase that fired so the closed-posting corpus
    // grows over time. Fire-and-forget: detection path must not be blocked
    // on DB writes.
    try {
      const hostname = new URL(url).hostname;
      void recordClosedPostingPhrase({
        hostname,
        phrase: closedPostingDetail.contextSnippet,
        detectorReason: closedPostingDetail.reason,
        exampleUrl: url,
      });
    } catch {
      // URL may not parse — skip capture silently.
    }
    return {
      applicationFields: [],
      confidence: 1,
      nonApplicationElements: [],
      pageType: 'error',
      reasoning: closedPostingDetail.reason,
      suggestedNextActionReason: '',
      suggestedNextActionSelector: '',
      suggestedNextActionType: '',
    };
  }

  const truncatedHtml = sanitizeHtmlForAI(html, 20000);

  if (screenshotBase64) {
    return classifyWithVision(
      truncatedHtml,
      url,
      screenshotBase64,
      options.aiProvider,
    );
  }
  return classifyWithHtmlOnly(truncatedHtml, url, options.aiProvider);
}

async function classifyWithVision(
  html: string,
  url: string,
  screenshotBase64: string,
  aiProvider?: import('@/lib/ai/models').AiProvider,
): Promise<PageClassification> {
  try {
    const raw = await generateVisionObject({
      aiProvider,
      systemPrompt: VISION_CLASSIFICATION_PROMPT,
      userText: `Classify this page.\n\nURL: ${url}\n\nHTML (truncated):\n${html}`,
      imageBase64: screenshotBase64,
      schema: pageClassificationSchema,
      model: 'fast',
      maxTokens: 2000,
    });

    return normalizeClassification(raw);
  } catch (error) {
    console.error('[PageClassifier] Vision classification failed:', error);
    return classifyWithHtmlOnly(html, url, aiProvider);
  }
}

async function classifyWithHtmlOnly(
  html: string,
  url: string,
  aiProvider?: import('@/lib/ai/models').AiProvider,
): Promise<PageClassification> {
  try {
    const result = await generateAIObject(
      `${HTML_ONLY_CLASSIFICATION_PROMPT}\n\nURL: ${url}\n\nHTML:\n${html}`,
      pageClassificationSchema,
      { aiProvider, temperature: 0.1 },
    );
    return result;
  } catch (error) {
    console.error('[PageClassifier] HTML classification failed:', error);
    return {
      pageType: 'other',
      confidence: 0,
      reasoning: 'Classification failed, proceeding with standard analysis',
      applicationFields: [],
      nonApplicationElements: [],
      suggestedNextActionSelector: '',
      suggestedNextActionType: '',
      suggestedNextActionReason: '',
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeClassification(raw: any): PageClassification {
  const validTypes = [
    'application_form',
    'job_listing',
    'job_search',
    'account_creation',
    'login',
    'confirmation',
    'error',
    'other',
  ];
  return {
    pageType: validTypes.includes(raw.pageType) ? raw.pageType : 'other',
    confidence: Math.min(1, Math.max(0, raw.confidence ?? 0.5)),
    reasoning: raw.reasoning ?? '',
    applicationFields: Array.isArray(raw.applicationFields)
      ? raw.applicationFields
      : [],
    nonApplicationElements: Array.isArray(raw.nonApplicationElements)
      ? raw.nonApplicationElements
      : [],
    suggestedNextActionSelector:
      raw.suggestedNextActionSelector ??
      raw.suggestedNextAction?.selector ??
      '',
    suggestedNextActionType:
      raw.suggestedNextActionType ?? raw.suggestedNextAction?.action ?? '',
    suggestedNextActionReason:
      raw.suggestedNextActionReason ?? raw.suggestedNextAction?.reason ?? '',
  };
}
