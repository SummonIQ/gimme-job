import OpenAI from 'openai';

import type { VisionFieldDetection, VisionStepAnalysis } from './types';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISION_SYSTEM_PROMPT = `You are an expert at analyzing job application page screenshots for automation.
You will receive a screenshot of a job application page along with a simplified HTML structure.

Your task is to:
1. Identify ALL visible form fields in the screenshot, in top-to-bottom order
2. For each field, determine: its CSS selector, label, type, whether it's empty, required, and what value to suggest
3. Determine the page type and current step in a multi-step flow
4. Identify the next action to take (e.g., fill a field, click a button)

IMPORTANT RULES:
- Order fields EXACTLY as they appear visually on the page (top to bottom, left to right)
- Only include fields that are part of the JOB APPLICATION, not site navigation or search
- Skip fields that already have values filled in
- For file upload fields (resume/CV), set suggestedAction to "upload"
- For submit/next/continue buttons, set suggestedAction to "click"
- Set isComplete to true ONLY if all fields are filled and a submit button is the only action left
- Use precise CSS selectors (prefer #id, [name="..."], [aria-label="..."])`;

const VISION_USER_PROMPT = `Analyze this job application page screenshot and the HTML structure below.

Return a JSON object with this exact structure:
{
  "pageType": "application_form" | "job_listing" | "login" | "confirmation" | "error" | "other",
  "currentStep": <number>,
  "estimatedTotalSteps": <number>,
  "fields": [
    {
      "selector": "<CSS selector>",
      "label": "<human-readable label>",
      "fieldDisplayName": "<concise name e.g. 'Phone Number', 'ZIP Code', 'Resume Upload', 'First Name'>",
      "fieldType": "text" | "email" | "tel" | "select" | "textarea" | "radio" | "checkbox" | "file" | "button" | "other",
      "suggestedAction": "fill" | "click" | "select" | "upload" | "skip",
      "suggestedValue": "<value to fill or empty string>",
      "confidence": <0-1>,
      "reason": "<why this action>",
      "isEmpty": <boolean>,
      "isRequired": <boolean>,
      "constraints": {
        "maxLength": <number or null>,
        "minLength": <number or null>,
        "pattern": "<regex from pattern attribute or null>",
        "inputMode": "<inputmode: numeric, tel, email, decimal or null>",
        "numbersOnly": <boolean>,
        "autoFormats": <boolean - e.g. phone auto-formatting>,
        "formatDescription": "<describe formatting rules e.g. '(XXX) XXX-XXXX' or null>",
        "allowedValues": ["<for select/radio fields, list options>"] or null
      }
    }
  ],
  "nextAction": {
    "selector": "<CSS selector of highest-priority next element>",
    "action": "<fill|click|select|upload>",
    "reason": "<why this is the next step>"
  } | null,
  "isComplete": <boolean>,
  "observations": ["<notable things about this page's structure or behavior>"]
}

For suggestedValue, use these defaults for common fields:
- First name, Last name, Email, Phone: leave empty (user-specific)
- Country: "United States"
- How did you hear: "Job Board"
- Willing to relocate: "Yes"
- Authorized to work: "Yes"
- Sponsorship needed: "No"
- Gender/Pronouns: leave empty
- Veteran/Disability: "I don't wish to answer" or "Decline to self-identify"

HTML structure (truncated):
`;

export function sanitizeHtmlForAI(html: string, maxLength = 15000): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, maxLength);
}

/**
 * Analyze a page screenshot + HTML using GPT-4o Vision to detect fields and their order.
 */
export async function analyzePageWithVision(
  screenshotBase64: string,
  html: string,
  url: string,
): Promise<VisionStepAnalysis> {
  const truncatedHtml = html.slice(0, 15000);

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    max_tokens: 4000,
    temperature: 0.1,
    messages: [
      {
        role: 'system',
        content: VISION_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `${VISION_USER_PROMPT}${truncatedHtml}\n\nPage URL: ${url}`,
          },
          {
            type: 'image_url',
            image_url: {
              url: `data:image/png;base64,${screenshotBase64}`,
              detail: 'high',
            },
          },
        ],
      },
    ],
    response_format: { type: 'json_object' },
  });

  const content = response.choices[0]?.message?.content ?? '{}';

  try {
    const parsed = JSON.parse(content) as VisionStepAnalysis;
    return normalizeAnalysis(parsed);
  } catch {
    console.error('[VisionAnalyzer] Failed to parse response:', content);
    return {
      pageType: 'other',
      currentStep: 0,
      estimatedTotalSteps: 1,
      fields: [],
      nextAction: null,
      isComplete: false,
      observations: ['Failed to parse vision analysis response'],
    };
  }
}

/**
 * Analyze a focused screenshot of a single field to validate its state and get a better value suggestion.
 */
export async function analyzeFieldWithVision(
  screenshotBase64: string,
  fieldLabel: string,
  fieldType: string,
  context: string,
): Promise<{ suggestedValue: string; confidence: number; reason: string }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      max_tokens: 500,
      temperature: 0.1,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `This is a close-up of a form field from a job application.
Field label: "${fieldLabel}"
Field type: ${fieldType}
Context: ${context}

What value should be filled in this field for a typical job application?
Return JSON: { "suggestedValue": "...", "confidence": 0-1, "reason": "..." }
If the field already has a value, return the existing value with high confidence.
If user-specific (name, email, phone), return empty string.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
                detail: 'low',
              },
            },
          ],
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = response.choices[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content);
    return {
      suggestedValue: parsed.suggestedValue ?? '',
      confidence: parsed.confidence ?? 0.5,
      reason: parsed.reason ?? '',
    };
  } catch (error) {
    console.error('[VisionAnalyzer] Field analysis failed:', error);
    return { suggestedValue: '', confidence: 0, reason: 'Analysis failed' };
  }
}

function normalizeAnalysis(raw: VisionStepAnalysis): VisionStepAnalysis {
  return {
    pageType: raw.pageType ?? 'other',
    currentStep: raw.currentStep ?? 0,
    estimatedTotalSteps: raw.estimatedTotalSteps ?? 1,
    fields: (raw.fields ?? []).map(normalizeField),
    nextAction: raw.nextAction ?? null,
    isComplete: raw.isComplete ?? false,
    observations: raw.observations ?? [],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeField(field: any): VisionFieldDetection {
  return {
    selector: (field.selector as string) ?? '',
    label: (field.label as string) ?? '',
    fieldDisplayName: (field.fieldDisplayName as string) ?? (field.label as string) ?? '',
    fieldType: (field.fieldType as VisionFieldDetection['fieldType']) ?? 'other',
    suggestedAction: (field.suggestedAction as VisionFieldDetection['suggestedAction']) ?? 'skip',
    suggestedValue: (field.suggestedValue as string) ?? '',
    confidence: Math.min(1, Math.max(0, (field.confidence as number) ?? 0.5)),
    reason: (field.reason as string) ?? '',
    isEmpty: (field.isEmpty as boolean) ?? true,
    isRequired: (field.isRequired as boolean) ?? false,
    constraints: field.constraints as VisionFieldDetection['constraints'],
  };
}
