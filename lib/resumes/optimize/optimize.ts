import { type UserProfile } from '@/generated/prisma/browser';
import { getModels, type AiProvider } from '@/lib/ai/models';
import { generateObject } from 'ai';
import { z } from 'zod';

export async function optimizeResume({
  aiProvider,
  analysis,
  jobListing,
  resumeMarkdown,
  userProfile,
}: {
  aiProvider?: AiProvider;
  analysis: string;
  jobListing?: string;
  resumeMarkdown: string;
  userProfile?: UserProfile;
}) {
  const prompt = `
  You are an expert in resume writing and ATS (Applicant Tracking System) optimization.
  
  You will improve the following resume in Markdown format:
  ${resumeMarkdown}
  
  ${
    analysis
      ? `
  The analysis of the resume is as follows:
  ${analysis}
  `
      : ''
  }
  
  ${
    userProfile
      ? `The user profile is as follows:
  \`\`\`json
    ${JSON.stringify(userProfile, null, 2)}
  \`\`\`
  `
      : ''
  }
  ${
    jobListing
      ? `
    Improve the following resume (in Markdown format) using the provided job listing details and optional analysis.

    The job listing details is as follows:
    ${jobListing}
    `
      : ''
  }

  You will then improve the resume based on the analysis and the optionally provided job listing details.
  
  1. Adding missing sections (e.g., certifications, education, achievements) if applicable.
    - Add missing keywords, and highlight experience with skills that are relevant to the job listing.
    - Emphasize soft skills that are relevant to the job listing.
    - Do not add any wording around "References available upon request."
  2. Preserve the original document structure and spacing while maintaining valid Markdown.
    - Do not change section order, page break markers, paragraph spacing, list indentation, or heading hierarchy unless the original Markdown is invalid.
    - Do not add decorative formatting or extra whitespace.
    - Normalize inconsistent blank lines only enough to make spacing consistent across Markdown, Word, and PDF outputs.
  3. Optimizing content with ATS-friendly keywords for the given resume and/or job listing.
    - Balanced human-readability with ATS requirements
  4. Making the language action-oriented.
  5. I want the 'optimized_resume.json' field to be the optimized resume in json format.
    - Add type field to each node in the resume.
    - The type field should be the HTML tag that corresponds to the Markdown element type.
      - For example,
        - A heading node should have a type of one of the following: "h1", "h2", "h3", "h4", "h5", "h6".
        - A list item node should have a parent node with the type of one of the following: "li", "ul", "ol".
        - A link node should have a type of "a".
        - For example, a bold node should have a type of "strong".
        - For example, a italic node should have a type of "em".
        - For example, a code node should have a type of "code".
        - For example, a blockquote node should have a type of "blockquote".
        - Add additional field types as needed.
    - Each node should either have a children field or a content field.
      - If the node has a children field, it should be an array of nodes.
      - If the node has a content field, it should be a string.
  6. You are also an expert in preserving resume Markdown formatting.
     - Check that the markdown is formatted correctly without changing the resume's visual layout unnecessarily.
     - Ensure that extraneous table formatting is removed.
     - Ensure that headings are formatted accordingly based on the level of the heading.
     - Preserve page breaks represented by horizontal rules (---).
  7. When there is missing information, use the user profile if provided to fill in the missing information if possible.
     - If the user profile is not provided, do not make any assumptions.
     - If the user profile is provided, use it to fill in the missing information, including the websites, social media URLs, contact information, and education details.
  8. Tailor the resume to match the job listing and emphasize the most relevant skills and experiences.
  9. Preserve formatting while maintaining valid Markdown structure.
  10. Optimize content with ATS-friendly keywords that are specific to the role.
  11. Use action-oriented language.
  12. Correct only actual formatting errors in the Markdown.
  13. Do NOT add bold formatting (** or __) to words or phrases in the resume. Resumes should use plain text for content, with formatting limited to headings, lists, and links.
  14. CRITICAL CONTENT PRESERVATION RULES:
     - Do NOT remove, delete, or drop any bullet points from any work experience entry. Every original bullet point must have a corresponding bullet point in the optimized resume.
     - Do NOT condense multiple bullet points into fewer bullet points. If the original has 4 bullet points for a job, the optimized version must also have at least 4 bullet points.
     - Do NOT remove any work experience entries, projects, education entries, or other sections from the resume.
     - You may REFINE the wording of existing bullet points (improve phrasing, add keywords, make action-oriented), but you must NOT reduce the total number of bullet points or entries.
     - The optimized resume should be approximately the same length or longer than the original. Never significantly shorter.
     - Each change you make must be recorded in the changelog with what was changed and why.
  15. I want all data to be structured following the schema below exactly.
     - If an array is empty, return an empty array.
     - Ensure every field is present in the JSON object.
     - Ensure the "markdown" field only contains the optimized resume in markdown format, and no other text, as the
       user will be downloading the resume and using in job applications.

  \`\`\`{
    "ats_score": "number(0-100)", // score of the ATS analysis
    "ats_summary": "string", // summary of the ATS analysis
    "changelog": [{ "change": "string", "reason": "string" }], // Each entry describes a specific change made and explains why it was made. e.g { "change": "Added missing keywords: React, TypeScript, Node.js to skills section", "reason": "Job listing requires these technologies and they were missing from the resume, reducing ATS keyword match score" }
    "confidence_metrics": {
      "estimated_visibility_boost": "string", // estimated visibility boost of the resume - e.g. "top 10%"
      "projected_shortlist_probability": "number" // projected shortlist probability of the resume - e.g. 68 = (ats_score * 0.6) + (readability * 0.4)
    },
    "markdown": "string", // Optimized resume in markdown format
    "optimization_strategy": "string", // strategy for optimizing the resume, e.g. "Balanced human-readability with ATS requirements"
    "score_improvement": {
      "delta": "number",
      "new_score": "number",
      "percent_change": "number",
      "previous_score": "number",
      "significant_improvements": ["string"]
    },
    "summary": "string" // summary of the optimized resume
  }\`\`\`
  `;

  const { object } = await generateObject({
    model: getModels(aiProvider).fast,
    output: 'object',
    prompt,
    schema: z.object({
      ats_score: z.number().min(0).max(100), // score of the ATS analysis
      ats_summary: z.string(), // summary of the ATS analysis
      changelog: z.array(
        z.object({
          change: z.string(), // What was changed
          reason: z.string(), // Why this change was made
        }),
      ),
      confidence_metrics: z.object({
        estimated_visibility_boost: z.string(), // estimated visibility boost of the resume - e.g. "top 10%"
        projected_shortlist_probability: z.number(), // projected shortlist probability of the resume - e.g. 68 = (ats_score * 0.6) + (readability * 0.4)
      }),
      markdown: z.string(), // Optimized resume in markdown format
      optimization_strategy: z.string(), // strategy for optimizing the resume, e.g. "Balanced human-readability with ATS requirements"
      score_improvement: z.object({
        delta: z.number(),
        new_score: z.number(),
        percent_change: z.number(),
        previous_score: z.number(),
        significant_improvements: z.array(z.string()),
      }),
      summary: z.string(), // summary of the optimized resume
    }),
  });

  return object;
}
