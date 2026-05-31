import { z } from 'zod';

/**
 * Canonical structured-resume content. Stored in `Resume.structuredData` when
 * `Resume.kind === 'STRUCTURED'`. Every section is optional so the user can
 * fill the resume out incrementally; the designer surfaces sections one at a
 * time in vertical flow.
 */

export const STRUCTURED_RESUME_SCHEMA_VERSION = 1;

const contactSchema = z.object({
  fullName: z.string().trim().optional(),
  headline: z.string().trim().optional(), // e.g. "Senior Frontend Engineer"
  email: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  location: z.string().trim().optional(),
  links: z
    .array(
      z.object({
        label: z.string().trim(),
        url: z.string().trim(),
      }),
    )
    .default([]),
});

const summarySchema = z.object({
  body: z.string().trim().optional(),
});

const experienceItemSchema = z.object({
  id: z.string(),
  company: z.string().trim().optional(),
  role: z.string().trim().optional(),
  location: z.string().trim().optional(),
  startDate: z.string().trim().optional(), // free-text e.g. "May 2022"
  endDate: z.string().trim().optional(), // free-text e.g. "Present" or "Mar 2024"
  current: z.boolean().default(false),
  description: z.string().trim().optional(),
  bullets: z.array(z.string()).default([]),
});

const educationItemSchema = z.object({
  id: z.string(),
  school: z.string().trim().optional(),
  degree: z.string().trim().optional(),
  field: z.string().trim().optional(),
  location: z.string().trim().optional(),
  startDate: z.string().trim().optional(),
  endDate: z.string().trim().optional(),
  details: z.string().trim().optional(),
});

const skillsSchema = z.object({
  items: z.array(z.string().trim()).default([]),
});

const projectItemSchema = z.object({
  id: z.string(),
  name: z.string().trim().optional(),
  url: z.string().trim().optional(),
  description: z.string().trim().optional(),
  bullets: z.array(z.string()).default([]),
});

const certificationItemSchema = z.object({
  id: z.string(),
  name: z.string().trim().optional(),
  issuer: z.string().trim().optional(),
  issueDate: z.string().trim().optional(),
  expirationDate: z.string().trim().optional(),
  credentialUrl: z.string().trim().optional(),
});

export const structuredResumeSchema = z.object({
  version: z.literal(STRUCTURED_RESUME_SCHEMA_VERSION),
  contact: contactSchema.default({ links: [] }),
  summary: summarySchema.default({}),
  experiences: z.array(experienceItemSchema).default([]),
  education: z.array(educationItemSchema).default([]),
  skills: skillsSchema.default({ items: [] }),
  projects: z.array(projectItemSchema).default([]),
  certifications: z.array(certificationItemSchema).default([]),
});

export type StructuredResume = z.infer<typeof structuredResumeSchema>;
export type StructuredResumeContact = z.infer<typeof contactSchema>;
export type StructuredResumeSummary = z.infer<typeof summarySchema>;
export type StructuredResumeExperience = z.infer<typeof experienceItemSchema>;
export type StructuredResumeEducation = z.infer<typeof educationItemSchema>;
export type StructuredResumeSkills = z.infer<typeof skillsSchema>;
export type StructuredResumeProject = z.infer<typeof projectItemSchema>;
export type StructuredResumeCertification = z.infer<
  typeof certificationItemSchema
>;

export const STRUCTURED_RESUME_SECTIONS = [
  { id: 'contact', label: 'Contact', description: 'Name, headline, and how to reach you.' },
  { id: 'summary', label: 'Summary', description: 'A short paragraph that frames who you are.' },
  { id: 'experiences', label: 'Experience', description: 'Where you have worked, what you did.' },
  { id: 'education', label: 'Education', description: 'Schools, degrees, and relevant detail.' },
  { id: 'skills', label: 'Skills', description: 'Tools, languages, and methods you use.' },
  { id: 'projects', label: 'Projects', description: 'Side projects or notable work you led.' },
  { id: 'certifications', label: 'Certifications', description: 'Credentials worth listing.' },
] as const;

export type StructuredResumeSectionId =
  (typeof STRUCTURED_RESUME_SECTIONS)[number]['id'];

export function emptyStructuredResume(): StructuredResume {
  return structuredResumeSchema.parse({
    version: STRUCTURED_RESUME_SCHEMA_VERSION,
  });
}
