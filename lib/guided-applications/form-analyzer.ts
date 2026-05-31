'use server';

import { getModels, type AiProvider } from '@/lib/ai/models';
import { JobProvider } from '@/generated/prisma/browser';
import { generateObject } from 'ai';
import { z } from 'zod';
import { DetectedFormField, FormAnalysisResult } from './types';

const FormFieldSchema = z.object({
  name: z.string(),
  label: z.string(),
  type: z.enum([
    'text',
    'email',
    'tel',
    'url',
    'textarea',
    'select',
    'checkbox',
    'radio',
    'file',
    'date',
    'number',
    'hidden',
  ]),
  selector: z.string(),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.string()).optional(),
  category: z.enum([
    'personal',
    'contact',
    'work',
    'education',
    'documents',
    'preferences',
    'custom',
  ]),
});

const FormAnalysisSchema = z.object({
  pageTitle: z.string(),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  isMultiStep: z.boolean(),
  currentStep: z.number(),
  totalSteps: z.number().optional(),
  fields: z.array(FormFieldSchema),
  hasFileUpload: z.boolean(),
  hasResumeField: z.boolean(),
  hasCoverLetterField: z.boolean(),
  submitButtonText: z.string().optional(),
  nextButtonText: z.string().optional(),
});

export async function analyzeFormWithAI(
  pageHtml: string,
  pageUrl: string,
  screenshotBase64?: string,
  options: { readonly aiProvider?: AiProvider } = {},
): Promise<FormAnalysisResult> {
  try {
    const htmlSnippet =
      pageHtml.length > 50000 ? pageHtml.slice(0, 50000) : pageHtml;

    const prompt = `Analyze this job application form page and extract all form fields.

URL: ${pageUrl}

HTML Content:
${htmlSnippet}

For each form field, identify:
1. The field name (from name attribute or id)
2. A human-readable label
3. The field type (text, email, tel, select, textarea, checkbox, radio, file, etc.)
4. A CSS selector to target this field
5. Whether it's required
6. Any placeholder text
7. For select/radio fields, list the options
8. Category: personal (name), contact (email, phone, address), work (experience, skills), education, documents (resume, cover letter), preferences (salary, remote), or custom

Also identify:
- Page title and job details
- Whether this is a multi-step form
- Current step number and total steps
- Whether there's a resume upload field
- Whether there's a cover letter field`;

    const result = await generateObject({
      model: getModels(options.aiProvider).strong,
      schema: FormAnalysisSchema,
      prompt,
    });

    const detectedJobProvider = detectJobProvider(pageUrl);

    return {
      success: true,
      url: pageUrl,
      pageTitle: result.object.pageTitle,
      company: result.object.company,
      jobTitle: result.object.jobTitle,
      jobProvider: detectedJobProvider,
      isMultiStep: result.object.isMultiStep,
      currentStep: result.object.currentStep,
      totalSteps: result.object.totalSteps,
      fields: result.object.fields as DetectedFormField[],
      hasFileUpload: result.object.hasFileUpload,
      hasResumeField: result.object.hasResumeField,
      hasCoverLetterField: result.object.hasCoverLetterField,
      submitButtonSelector: result.object.submitButtonText
        ? `button:contains("${result.object.submitButtonText}")`
        : undefined,
      nextButtonSelector: result.object.nextButtonText
        ? `button:contains("${result.object.nextButtonText}")`
        : undefined,
    };
  } catch (error) {
    console.error('Form analysis error:', error);
    return {
      success: false,
      url: pageUrl,
      pageTitle: '',
      isMultiStep: false,
      currentStep: 1,
      fields: [],
      hasFileUpload: false,
      hasResumeField: false,
      hasCoverLetterField: false,
      error: error instanceof Error ? error.message : 'Form analysis failed',
    };
  }
}

function detectJobProvider(url: string): JobProvider | undefined {
  const urlLower = url.toLowerCase();

  if (urlLower.includes('linkedin.com')) return JobProvider.LINKEDIN;
  if (urlLower.includes('indeed.com')) return JobProvider.INDEED;
  if (urlLower.includes('glassdoor.com')) return JobProvider.GLASSDOOR;
  if (urlLower.includes('ziprecruiter.com')) return JobProvider.ZIPRECRUITER;
  if (urlLower.includes('dice.com')) return JobProvider.DICE;
  if (urlLower.includes('monster.com')) return JobProvider.MONSTER;
  if (urlLower.includes('wellfound.com') || urlLower.includes('angel.co'))
    return JobProvider.WELLFOUND;
  if (urlLower.includes('flexjobs.com')) return JobProvider.FLEXJOBS;
  if (urlLower.includes('weworkremotely.com')) return JobProvider.WE_WORK_REMOTELY;
  if (urlLower.includes('remoteok.com')) return JobProvider.REMOTE_OK;
  if (urlLower.includes('greenhouse.io')) return JobProvider.OTHER;
  if (urlLower.includes('lever.co')) return JobProvider.OTHER;
  if (urlLower.includes('workday.com')) return JobProvider.OTHER;
  if (urlLower.includes('icims.com')) return JobProvider.OTHER;
  if (urlLower.includes('taleo.net')) return JobProvider.OTHER;

  return undefined;
}

export async function generateFieldSuggestionWithAI(
  fieldName: string,
  fieldLabel: string,
  fieldType: string,
  jobDescription: string,
  resumeContent: string,
  userProfile: Record<string, unknown>,
  options: { readonly aiProvider?: AiProvider } = {},
): Promise<{ value: string; reasoning: string; confidence: number }> {
  try {
    const result = await generateObject({
      model: getModels(options.aiProvider).fast,
      schema: z.object({
        suggestedValue: z.string(),
        reasoning: z.string(),
        confidence: z.number().min(0).max(1),
      }),
      prompt: `Generate a response for this job application field.

Field Name: ${fieldName}
Field Label: ${fieldLabel}
Field Type: ${fieldType}

Job Description:
${jobDescription.slice(0, 2000)}

Candidate Resume:
${resumeContent.slice(0, 3000)}

User Profile:
${JSON.stringify(userProfile, null, 2)}

Provide:
1. A suggested value that best represents the candidate for this field
2. Brief reasoning for why this value is appropriate
3. Confidence score (0-1) in this suggestion`,
    });

    return {
      value: result.object.suggestedValue,
      reasoning: result.object.reasoning,
      confidence: result.object.confidence,
    };
  } catch (error) {
    console.error('Field suggestion error:', error);
    return {
      value: '',
      reasoning: 'Unable to generate suggestion',
      confidence: 0,
    };
  }
}
