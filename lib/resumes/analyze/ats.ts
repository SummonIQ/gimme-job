import { getModels, type AiProvider } from '@/lib/ai/models';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function analyzeResumeForATS(
  markdownResume: string,
  jobTitle?: string,
  options: { readonly aiProvider?: AiProvider } = {},
) {
  const prompt = `
   ${jobTitle ? `Job Title: ${jobTitle}` : ''}
  
  You are an expert in ATS (Applicant Tracking System) optimization. Evaluate the following resume in Markdown format and generate:
  1. An ATS score out of 100 based on the following criteria:
     - Relevance of keywords for the job title role if provided.
     - Completeness of essential sections (e.g., contact information, skills, work experience, education).
     - Formatting and structure (e.g., clear headings, bullet points, consistency).
     - Use of action-oriented language and measurable achievements.
     - Optimization for ATS readability (e.g., avoiding complex formatting like tables, charts, or images).
  2. A detailed summary explaining the score, including:
     - Areas where the resume excels.
     - Areas where the resume could improve.
     - Specific suggestions to increase the ATS score.
  3. Use the following weighted scoring system for the ATS score:
     - Keywords (25%): Industry-standard technical terms
     - Sections (20%): Completeness of universal sections
     - Formatting (15%): ATS-safe structure
     - Achievements (15%): Quantified impact
     - Readability (10%): Clear information hierarchy
     - Likeability (15%): How appealing the resume is to a human recruiter — tone, personality, storytelling, enthusiasm, and overall impression
  4. I want all data to be structured following the schema below exactly.
     - If an array is empty, return an empty array.
     - Ensure every property is present in the object as detailed in the schema below.
     - If any array is empty, provide an empty array. If any numeric score is not applicable, still provide a valid number (like 0). 
     - Never omit a required key. **All** properties in the schema must appear, even if empty.
     - For example, if there are no grammar issues, "issues_found": 0 and "issues": []. 

     Schema:
  \`\`\`
  {
    "score": "number(0-100)",
    "summary": "string",
    "recommendations": {
      "priority_fixes": ["string"], // priority fixes for the resume
      "content_enhancements": ["string"], // content enhancements for the resume
      "long_term_improvements": ["string"] // long term improvements for the resume
    },
    "breakdown": {
      "achievements": {
        "feedback": ["string"],
        "good_examples": ["string"],
        "needs_improvement": ["string"],
        "score": "number(0-100)"
      },
      "formatting": {
        "feedback": ["string"],
        "incompatible_elements": ["string"],
        "score": "number(0-100)"
      },
      "grammar": {
        "issues_found": "number",
        "issues": [
          {
            "type": ["string"], // e.g. ["tense_consistency", "pluralization"]
            "description": "string", // description of the issue, e.g. Mixed verb tenses in experience section
            "example": "string", // example of the issue, e.g. Managed team (past) and create (present) reports
            "suggestion": "string" // suggestion for the issue, e.g. Use consistent past tense for previous roles
          }
        ],
        "score": "number(0-100)"
      },
      "keywords": {
        "feedback": ["string"],
        "missing": ["string"],
        "overused": ["string"],
        "score": "number(0-100)",
        "suggested": ["string"]
      },
      "likeability": {
        "feedback": ["string"],
        "score": "number(0-100)"
      },
      "readability": {
        "feedback": ["string"],
        "score": "number(0-100)"
      },
      "sections": {
        "details": [
          {
            "feedback": ["string"], // feedback on the section
            "issues": ["string"], // issues in the section
            "name": "string", // name of the section
            "missing": ["string"], // missing elements in the section
            "score": "number(0-100)"
          }
        ],
        "score": "number(0-100)"
      },
      "spelling": {
        "issues_found": "number",
        "issues": [
          {
            "word": "string", // misspelled word that was found
            "suggestion": "string", // replacement suggestion for the word
            "context_sentence": "string" // sentence where the word was found
          }
        ],
        "score": "number(0-100)"
      },
      "strengths": ["string"], // strengths of the resume - e.g. Strong action verbs, Good quantifiable achievements, Clear contact information
      "weaknesses": ["string"] // weaknesses of the resume - e.g. Missing industry-specific keywords, Dense text blocks in experience section
    }
  }
  \`\`\`
  
  Resume:
  ${markdownResume}
  `;

  const { object, finishReason, warnings } = await generateObject({
    model: getModels(options.aiProvider).strong,
    prompt,
    schema: z.object({
      breakdown: z.object({
        achievements: z.object({
          feedback: z.array(z.string()),
          good_examples: z.array(z.string()),
          needs_improvement: z.array(z.string()),
          score: z.number(),
        }),
        formatting: z.object({
          feedback: z.array(z.string()),
          incompatible_elements: z.array(z.string()),
          score: z.number(),
        }),
        grammar: z.object({
          issues: z.array(
            z.object({
              // type of issue, e.g. tense_consistency
              description: z.string(),
              // description of the issue, e.g. Mixed verb tenses in experience section
              example: z.string(),
              // example of the issue, e.g. Managed team (past) and create (present) reports
              suggestion: z.string(),
              type: z.array(z.string()), // suggestion for the issue, e.g. Use consistent past tense for previous roles
            }),
          ),
          issues_found: z.number(),
          score: z.number(),
        }),
        keywords: z.object({
          feedback: z.array(z.string()),
          missing: z.array(z.string()),
          overused: z.array(z.string()),
          score: z.number(),
          suggested: z.array(z.string()),
        }),
        likeability: z.object({
          feedback: z.array(z.string()),
          score: z.number(),
        }),
        readability: z.object({
          feedback: z.array(z.string()),
          score: z.number(),
        }),
        sections: z.object({
          details: z.array(
            z.object({
              feedback: z.array(z.string()), // feedback on the section
              issues: z.array(z.string()),
              // name of the section
              missing: z.array(z.string()),
              // issues in the section
              name: z.string(), // missing elements in the section
              score: z.number(),
            }),
          ),
          score: z.number(),
        }),
        spelling: z.object({
          issues: z.array(
            z.object({
              // replacement suggestion for the word
              context_sentence: z.string(),

              // misspelled word that was found
              suggestion: z.string(),
              word: z.string(), // sentence where the word was found
            }),
          ),
          issues_found: z.number(),
          score: z.number(),
        }),
        strengths: z.array(z.string()), // strengths of the resume - e.g. Strong action verbs, Good quantifiable achievements, Clear contact information
        weaknesses: z.array(z.string()), // weaknesses of the resume - e.g. Missing industry-specific keywords, Dense text blocks in experience section
      }),
      recommendations: z.object({
        // priority fixes for the resume
        content_enhancements: z.array(z.string()),
        // content enhancements for the resume
        long_term_improvements: z.array(z.string()),
        priority_fixes: z.array(z.string()), // long term improvements for the resume
      }),
      score: z.number(),
      summary: z.string(),
    }),
  });

  console.log({ finishReason, warnings });

  // const { text } = await generateText({
  //   model: openai('gpt-4o-mini'),
  //   prompt,
  //   system: 'You are a helpful assistant.',
  // });

  return object;
}
