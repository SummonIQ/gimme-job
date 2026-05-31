import { z } from 'zod';

const bulletItemSchema = z.object({
  text: z.string().optional().or(z.literal('')),
});

const workExperienceItemSchema = z.object({
  bulletItems: z.array(bulletItemSchema).default([]),
  company: z.string().optional().or(z.literal('')),
  description: z.string().optional().or(z.literal('')),
  endDate: z.string().optional().or(z.literal('')),
  endMonth: z.number().min(0).max(11).optional(),
  endYear: z
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 20)
    .optional(),
  startDate: z.string().optional().or(z.literal('')),
  startMonth: z.number().min(0).max(11).optional(),
  startYear: z
    .number()
    .min(1900)
    .max(new Date().getFullYear() + 20)
    .optional(),
  title: z.string().optional().or(z.literal('')),
});

const userDetailsFormSchema = z.object({
  city: z.string().optional().or(z.literal('')),
  country: z.enum(['US']).optional().or(z.literal('')),
  defaultResumeId: z.string().trim().optional().or(z.literal('')),
  disabilityStatus: z.string().optional().or(z.literal('')),
  earliestStartDate: z.string().optional().or(z.literal('')),
  educationDegree: z.string().optional().or(z.literal('')),
  educationEndMonth: z.number().min(0).max(11).optional(),
  educationEndYear: z
    .number()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
  educationInstitution: z.string().optional().or(z.literal('')),
  educationInstitutionLocation: z.string().optional().or(z.literal('')),
  educationStartMonth: z.number().min(0).max(11).optional(),
  educationStartYear: z
    .number()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
  emailAddress: z.string().email().optional().or(z.literal('')),
  firstName: z.string().optional().or(z.literal('')),
  gender: z.string().optional().or(z.literal('')),
  githubUrl: z.string().url().optional().or(z.literal('')),
  hispanicLatino: z.string().optional().or(z.literal('')),
  lastName: z.string().optional().or(z.literal('')),
  linkedinUrl: z.string().url().optional().or(z.literal('')),
  personalWebsiteUrl: z.string().url().optional().or(z.literal('')),
  phoneNumber: z.string().optional().or(z.literal('')),
  preferredName: z.string().optional().or(z.literal('')),
  professionalSummary: z.string().optional().or(z.literal('')),
  pronouns: z.string().optional().or(z.literal('')),
  race: z.string().optional().or(z.literal('')),
  referralSource: z.string().trim().optional().or(z.literal('')),
  requiresSponsorship: z.boolean().optional(),
  salaryExpectation: z.string().optional().or(z.literal('')),
  state: z.string().optional().or(z.literal('')),
  streetAddress: z.string().optional().or(z.literal('')),
  transgenderIdentity: z.string().optional().or(z.literal('')),
  useOptimizedResumeOnSubmit: z.boolean().default(false),
  veteranStatus: z.string().optional().or(z.literal('')),
  websiteUrl: z.string().url().optional().or(z.literal('')),
  workAuthorization: z.string().optional().or(z.literal('')),
  workExperience: z.array(workExperienceItemSchema).default([]),
  skills: z.array(bulletItemSchema).default([]),
  yearsOfExperience: z.string().optional().or(z.literal('')),
  zipCode: z.string().optional().or(z.literal('')),
});

type UserDetailsFormValues = z.infer<typeof userDetailsFormSchema>;
type WorkExperienceItem = z.infer<typeof workExperienceItemSchema>;

export { userDetailsFormSchema, workExperienceItemSchema };
export type { UserDetailsFormValues, WorkExperienceItem };
