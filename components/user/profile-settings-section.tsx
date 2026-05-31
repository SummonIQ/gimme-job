import { generateObject, generateText } from 'ai';
import type { Prisma } from '@/generated/prisma/client';
import type { UserProfile } from '@/generated/prisma/browser';
import { z } from 'zod';

import { normalizeCountryCode } from '@/constants/locales';
import { revalidateTag } from '@/lib/cache/revalidate';
import { db } from '@/lib/db/client';
import { invalidateResolverCacheForUser } from '@/lib/field-answer/resolve';
import {
  compactWorkExperience,
  extractWorkExperienceFromResumeJson,
  parseStoredWorkExperience,
} from '@/lib/resumes/work-experience';
import { setUserDefaultResume } from '@/lib/resumes/default';
import { getUserKnowledge } from '@/lib/user/knowledge';
import { getCurrentUser } from '@/lib/user/query';

import { UserCredentialsSection } from '@/components/user/user-credentials-section';
import { UserDetailsForm } from '@/components/user/user-details-form';
import {
  userDetailsFormSchema,
  type UserDetailsFormValues,
} from '@/components/user/user-details-form-schema';

const aiWorkExperienceSchema = z.object({
  workExperience: z.array(
    z.object({
      bulletItems: z.array(z.object({ text: z.string() })),
      company: z.string(),
      description: z.string(),
      endDate: z.string(),
      endMonth: z.number().min(0).max(11).nullable(),
      endYear: z.number().nullable(),
      startDate: z.string(),
      startMonth: z.number().min(0).max(11).nullable(),
      startYear: z.number().nullable(),
      title: z.string(),
    }),
  ),
});

const aiResumeProfileSchema = z.object({
  education: z.object({
    degree: z.string(),
    endMonth: z.number().min(0).max(11).nullable(),
    endYear: z.number().nullable(),
    institution: z.string(),
    institutionLocation: z.string(),
    startMonth: z.number().min(0).max(11).nullable(),
    startYear: z.number().nullable(),
  }),
  workExperience: aiWorkExperienceSchema.shape.workExperience,
  professionalSummary: z.string(),
  skills: z.array(z.object({ text: z.string() })),
});

const EMPTY_USER_PROFILE: Omit<
  UserProfile,
  'id' | 'createdAt' | 'updatedAt' | 'userId'
> = {
  city: null,
  disabilityStatus: null,
  earliestStartDate: null,
  educationDegree: null,
  educationEndMonth: null,
  educationEndYear: null,
  educationInstitution: null,
  educationInstitutionLocation: null,
  educationStartMonth: null,
  educationStartYear: null,
  emailAddress: null,
  firstName: null,
  gender: null,
  githubUrl: null,
  lastName: null,
  linkedinUrl: null,
  personalWebsiteUrl: null,
  phoneNumber: null,
  preferredName: null,
  pronouns: null,
  race: null,
  requiresSponsorship: null,
  salaryExpectation: null,
  state: null,
  streetAddress: null,
  transgenderIdentity: null,
  veteranStatus: null,
  websiteUrl: null,
  workAuthorization: null,
  yearsOfExperience: null,
  zipCode: null,
};

function stripMarkdownFences(markdown: string): string {
  return markdown
    .trim()
    .replace(/^```(?:resume-markdown|markdown)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();
}

function buildResumeUpdatePrompt(
  currentMarkdown: string,
  values: UserDetailsFormValues,
): string {
  const normalizedWorkExperience = compactFormWorkExperience(
    values.workExperience,
  );

  return `Update this resume markdown so it matches the latest profile information below.

Return only the full updated resume markdown. Do not wrap the answer in code fences. Do not add commentary.

Current resume markdown:
${currentMarkdown}

Updated profile data:
${JSON.stringify(
  {
    city: values.city,
    education: {
      degree: values.educationDegree,
      endMonth: values.educationEndMonth,
      endYear: values.educationEndYear,
      institution: values.educationInstitution,
      institutionLocation: values.educationInstitutionLocation,
      startMonth: values.educationStartMonth,
      startYear: values.educationStartYear,
    },
    emailAddress: values.emailAddress,
    firstName: values.firstName,
    githubUrl: values.githubUrl,
    lastName: values.lastName,
    linkedinUrl: values.linkedinUrl,
    phoneNumber: values.phoneNumber,
    state: values.state,
    streetAddress: values.streetAddress,
    websiteUrl: values.websiteUrl,
    workExperience: normalizedWorkExperience,
    zipCode: values.zipCode,
  },
  null,
  2,
)}

Requirements:
- Treat the supplied work experience as the authoritative work history to present.
- Update contact info, education, and web links to match the provided values when those values are present.
- Do not invent employers, job titles, dates, degrees, or achievements.
- Preserve markdown structure and keep the resume professionally concise.`;
}

function getProfileData(values: UserDetailsFormValues) {
  const {
    country: _country,
    defaultResumeId: _defaultResumeId,
    hispanicLatino: _hispanicLatino,
    professionalSummary: _professionalSummary,
    referralSource: _referralSource,
    skills: _skills,
    useOptimizedResumeOnSubmit: _useOptimizedResumeOnSubmit,
    workExperience: _workExperience,
    ...profile
  } = values;

  return profile;
}

function cleanKnowledgeValue(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  if (typeof value === 'number')
    return Number.isFinite(value) ? String(value) : '';
  return String(value).trim();
}

function compactFormWorkExperience(
  entries: UserDetailsFormValues['workExperience'],
) {
  return compactWorkExperience(
    entries.map(entry => ({
      bulletItems: compactStringItems(entry.bulletItems),
      company: entry.company ?? '',
      description: entry.description ?? '',
      endDate: entry.endDate ?? '',
      endMonth: entry.endMonth,
      endYear: entry.endYear,
      startDate: entry.startDate ?? '',
      startMonth: entry.startMonth,
      startYear: entry.startYear,
      title: entry.title ?? '',
    })),
  );
}

function buildProfileKnowledgeEntries(
  values: UserDetailsFormValues,
  effectiveEmailAddress: string,
): Array<readonly [string, string]> {
  const workExperience = JSON.stringify(
    compactFormWorkExperience(values.workExperience),
  );
  const skills = JSON.stringify(compactStringItems(values.skills));
  const fullName = [values.firstName, values.lastName]
    .map(value => value?.trim())
    .filter(Boolean)
    .join(' ');

  const entries: Array<readonly [string, unknown]> = [
    ['firstName', values.firstName],
    ['lastName', values.lastName],
    ['fullName', fullName],
    ['preferredName', values.preferredName],
    ['email', effectiveEmailAddress],
    ['emailAddress', effectiveEmailAddress],
    ['phone', values.phoneNumber],
    ['phoneNumber', values.phoneNumber],
    ['streetAddress', values.streetAddress],
    ['city', values.city],
    ['state', values.state],
    ['country', values.country || 'US'],
    ['zipCode', values.zipCode],
    ['linkedinUrl', values.linkedinUrl],
    ['githubUrl', values.githubUrl],
    ['websiteUrl', values.websiteUrl],
    ['personalWebsiteUrl', values.personalWebsiteUrl],
    ['professionalSummary', values.professionalSummary],
    ['educationDegree', values.educationDegree],
    ['highestDegree', values.educationDegree],
    ['educationInstitution', values.educationInstitution],
    ['university', values.educationInstitution],
    ['educationInstitutionLocation', values.educationInstitutionLocation],
    ['educationStartMonth', cleanKnowledgeValue(values.educationStartMonth)],
    ['educationStartYear', cleanKnowledgeValue(values.educationStartYear)],
    ['educationEndMonth', cleanKnowledgeValue(values.educationEndMonth)],
    ['educationEndYear', cleanKnowledgeValue(values.educationEndYear)],
    ['graduationYear', cleanKnowledgeValue(values.educationEndYear)],
    ['workExperience', workExperience],
    ['skills', skills],
    ['workAuthorization', values.workAuthorization],
    ['requiresSponsorship', cleanKnowledgeValue(values.requiresSponsorship)],
    ['yearsOfExperience', values.yearsOfExperience],
    ['salaryExpectation', values.salaryExpectation],
    ['earliestStartDate', values.earliestStartDate],
    ['referralSource', values.referralSource?.trim() || 'Gimme Job'],
    ['pronouns', values.pronouns],
    ['gender', values.gender],
    ['transgenderIdentity', values.transgenderIdentity],
    ['hispanicLatino', values.hispanicLatino],
    ['veteranStatus', values.veteranStatus],
    ['disabilityStatus', values.disabilityStatus],
    ['race', values.race],
  ];

  return entries.map(([key, value]) => [key, cleanKnowledgeValue(value)]);
}

async function syncProfileKnowledge(
  userId: string,
  values: UserDetailsFormValues,
  effectiveEmailAddress: string,
): Promise<void> {
  const entries = buildProfileKnowledgeEntries(values, effectiveEmailAddress);

  await db.$transaction(
    entries.map(([key, value]) => {
      if (!value) {
        return db.userKnowledge.deleteMany({
          where: {
            key,
            source: 'profile',
            userId,
          },
        });
      }

      return db.userKnowledge.upsert({
        create: {
          confidence: 1,
          key,
          source: 'profile',
          userId,
          value,
        },
        update: {
          confidence: 1,
          source: 'profile',
          value,
        },
        where: {
          userId_key: {
            key,
            userId,
          },
        },
      });
    }),
  );
}

function buildWorkExperienceParsePrompt(resumeContent: string): string {
  return `Extract the work experience roles from this default resume.

Return only roles that are explicitly present in the resume. Do not invent employers, titles, dates, or achievements.
Use concise descriptions that preserve any role overview text. Put each resume bullet under bulletItems as a separate item. If dates are absent, return empty strings for date fields. Use zero-based month numbers for month fields when a month is present.

Default resume:
${resumeContent}`;
}

function buildResumeProfileParsePrompt(resumeContent: string): string {
  return `Extract professional summary, skills and proficiencies, work experience, and education from this default resume.

Return only information that is explicitly present in the resume. Do not invent employers, titles, dates, schools, degrees, or locations.
Use zero-based month numbers for month fields when a month is present: January is 0 and December is 11. Leave month fields empty when the month is not present.
Return empty strings for unknown text fields, null for unknown month/year fields, and empty arrays when no skills or work bullets are present.
Put each skill/proficiency bullet under skills as a separate item. Put each work experience bullet under that role's bulletItems as a separate item.

Default resume:
${resumeContent}`;
}

function compactStringItems(
  items: ReadonlyArray<{ text?: string | null } | string | null | undefined>,
): { text: string }[] {
  return items
    .map(item =>
      typeof item === 'string' ? item.trim() : (item?.text?.trim() ?? ''),
    )
    .filter(Boolean)
    .map(text => ({ text }));
}

function compactAiWorkExperience(
  entries: z.infer<typeof aiWorkExperienceSchema>['workExperience'],
): UserDetailsFormValues['workExperience'] {
  return compactWorkExperience(
    entries.map(entry => ({
      ...entry,
      endMonth: entry.endMonth ?? undefined,
      endYear: entry.endYear ?? undefined,
      startMonth: entry.startMonth ?? undefined,
      startYear: entry.startYear ?? undefined,
    })),
  );
}

function parseStoredStringItems(value: string | null | undefined): {
  text: string;
}[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return compactStringItems(
      parsed.map(item =>
        typeof item === 'string' ||
        (item && typeof item === 'object' && 'text' in item)
          ? (item as { text?: string } | string)
          : null,
      ),
    );
  } catch {
    return compactStringItems(value.split(/\r?\n/));
  }
}

function extractEducationFromResumeJson(
  json: unknown,
): Partial<UserDetailsFormValues> {
  if (!json || typeof json !== 'object') {
    return {};
  }

  const resumeData = json as Record<string, unknown>;
  const rawEducation = Array.isArray(resumeData.education)
    ? resumeData.education[0]
    : null;
  const education =
    rawEducation && typeof rawEducation === 'object'
      ? (rawEducation as Record<string, unknown>)
      : {};
  const year = Number.parseInt(String(education.year ?? ''), 10);

  return {
    educationDegree: String(education.degree ?? ''),
    educationEndYear: Number.isFinite(year) ? year : undefined,
    educationInstitution: String(
      education.institution ?? education.school ?? '',
    ),
    educationInstitutionLocation: String(education.location ?? ''),
  };
}

function extractProfessionalSummaryFromResumeMarkdown(
  markdown: string | null | undefined,
): string {
  if (!markdown?.trim()) {
    return '';
  }

  const lines = markdown.split(/\r?\n/);
  const body: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,3}\s+\S/.test(trimmed)) {
      break;
    }
    if (
      trimmed &&
      !/^[-*]\s+/.test(trimmed) &&
      !/^[\w.+-]+@[\w.-]+/.test(trimmed) &&
      !/^\(?\d{3}\)?[-\s.]\d{3}[-\s.]\d{4}/.test(trimmed) &&
      !/^https?:\/\//i.test(trimmed) &&
      !/^linkedin\.com/i.test(trimmed)
    ) {
      body.push(trimmed);
    }
  }

  return body.join('\n').trim();
}

function extractMarkdownSection(
  markdown: string | null | undefined,
  headingPattern: RegExp,
): string {
  if (!markdown?.trim()) {
    return '';
  }

  const lines = markdown.split(/\r?\n/);
  const startIndex = lines.findIndex(line => headingPattern.test(line.trim()));
  if (startIndex === -1) {
    return '';
  }

  const body: string[] = [];
  for (const line of lines.slice(startIndex + 1)) {
    if (/^#{1,3}\s+\S/.test(line.trim())) {
      break;
    }
    body.push(line);
  }

  return body.join('\n').trim();
}

function extractWorkExperienceFromResumeMarkdown(
  markdown: string | null | undefined,
): UserDetailsFormValues['workExperience'] {
  const section = extractMarkdownSection(
    markdown,
    /^#{1,3}\s+(?:professional\s+)?(?:work\s+)?experience\b/i,
  );
  if (!section) {
    return [];
  }

  const entries: UserDetailsFormValues['workExperience'] = [];
  const chunks = section
    .split(/\n(?=(?:#{3,6}\s+|\*\*[^*\n]+\*\*|[A-Z][^\n|]+(?:\|| - |, ).{3,}))/)
    .map(chunk => chunk.trim())
    .filter(Boolean);

  for (const chunk of chunks) {
    const lines = chunk
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    const titleLine = lines
      .shift()
      ?.replace(/^#{3,6}\s+/, '')
      .replace(/^\*\*|\*\*$/g, '')
      .trim();

    if (!titleLine) {
      continue;
    }

    const [first = '', second = '', third = ''] = titleLine
      .split(/\s+\|\s+|\s+-\s+|,\s+/)
      .map(part => part.trim());
    const bulletItems = lines
      .filter(line => /^[-*]\s+/.test(line))
      .map(line => ({ text: line.replace(/^[-*]\s+/, '').trim() }))
      .filter(item => item.text);
    const description = lines
      .filter(line => !/^[-*]\s+/.test(line))
      .join('\n')
      .trim();

    entries.push({
      company: second || first,
      bulletItems,
      description,
      endDate: '',
      startDate: third,
      title: second ? first : '',
    });
  }

  return compactFormWorkExperience(entries);
}

function extractSkillsFromResumeMarkdown(
  markdown: string | null | undefined,
): UserDetailsFormValues['skills'] {
  const section = extractMarkdownSection(
    markdown,
    /^#{1,3}\s+(?:skills|skills\s+and\s+proficiencies|proficiencies)\b/i,
  );
  if (!section) {
    return [];
  }

  return section
    .split(/\r?\n/)
    .map(line =>
      line
        .replace(/^[-*]\s+/, '')
        .replace(/^#{3,6}\s+/, '')
        .trim(),
    )
    .filter(Boolean)
    .map(text => ({ text }));
}

function extractEducationFromResumeMarkdown(
  markdown: string | null | undefined,
): Partial<UserDetailsFormValues> {
  const section = extractMarkdownSection(markdown, /^#{1,3}\s+education\b/i);
  if (!section) {
    return {};
  }

  const lines = section
    .split(/\r?\n/)
    .map(line =>
      line
        .replace(/^[-*]\s+/, '')
        .replace(/^#{3,6}\s+/, '')
        .replace(/^\*\*|\*\*$/g, '')
        .trim(),
    )
    .filter(Boolean);
  const text = lines.join(' | ');
  const year = Number.parseInt(text.match(/\b(19|20)\d{2}\b/)?.[0] ?? '', 10);
  const degree =
    lines.find(line =>
      /\b(degree|bachelor|master|ph\.?d|associate|science|arts)\b/i.test(line),
    ) ?? '';
  const institution =
    lines.find(line =>
      /\b(university|college|institute|school)\b/i.test(line),
    ) ?? '';

  return {
    educationDegree: degree,
    educationEndYear: Number.isFinite(year) ? year : undefined,
    educationInstitution: institution,
  };
}

function hasEducationProfile(
  profile: Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'userId'>,
): boolean {
  return Boolean(
    profile.educationDegree?.trim() ||
    profile.educationInstitution?.trim() ||
    profile.educationInstitutionLocation?.trim() ||
    profile.educationStartMonth !== null ||
    profile.educationStartYear !== null ||
    profile.educationEndMonth !== null ||
    profile.educationEndYear !== null,
  );
}

async function getUserKnowledgeMap(
  userId: string,
): Promise<Record<string, string>> {
  const rows = await db.userKnowledge.findMany({
    select: {
      key: true,
      value: true,
    },
    where: {
      userId,
    },
  });

  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}

export async function ProfileSettingsSection() {
  const user = await getCurrentUser({
    include: {
      profile: true,
    },
  });

  if (!user) {
    return null;
  }

  const [knowledge, knowledgeRecord, defaultResume, resumes] =
    await Promise.all([
      getUserKnowledgeMap(user.id),
      getUserKnowledge(user.id),
      user.defaultResumeId
        ? db.resume.findUnique({
            include: {
              revisions: {
                orderBy: { createdAt: 'desc' },
                take: user.defaultRevisionId ? 1 : 0,
                where: user.defaultRevisionId
                  ? { id: user.defaultRevisionId }
                  : undefined,
              },
            },
            where: { id: user.defaultResumeId },
          })
        : Promise.resolve(null),
      db.resume.findMany({
        orderBy: [{ updatedAt: 'desc' }],
        select: {
          id: true,
          name: true,
          revisions: {
            orderBy: { createdAt: 'desc' },
            select: {
              name: true,
              pdfDocumentUrl: true,
            },
            take: 1,
          },
          url: true,
        },
        where: { userId: user.id },
      }),
    ]);
  const resumeOptions = resumes.map(resume => ({
    id: resume.id,
    name: resume.revisions[0]?.name ?? resume.name,
    url: resume.revisions[0]?.pdfDocumentUrl ?? resume.url ?? null,
  }));
  const userProfile = user.profile ?? EMPTY_USER_PROFILE;
  const activeRevision = defaultResume?.revisions?.[0] ?? null;
  const resumeJson = activeRevision?.json ?? defaultResume?.json ?? null;
  const resumeContent =
    activeRevision?.markdown?.trim() ||
    defaultResume?.markdown?.trim() ||
    JSON.stringify(resumeJson, null, 2);
  const storedWorkExperience = parseStoredWorkExperience(
    knowledge.workExperience,
  );
  const storedSkills = parseStoredStringItems(knowledge.skills);
  const resumeJsonWorkExperience =
    extractWorkExperienceFromResumeJson(resumeJson);
  const resumeJsonEducation = extractEducationFromResumeJson(resumeJson);
  const resumeMarkdownWorkExperience =
    extractWorkExperienceFromResumeMarkdown(resumeContent);
  const resumeMarkdownEducation =
    extractEducationFromResumeMarkdown(resumeContent);
  const resumeMarkdownSummary =
    extractProfessionalSummaryFromResumeMarkdown(resumeContent);
  const resumeMarkdownSkills = extractSkillsFromResumeMarkdown(resumeContent);
  let parsedResumeProfile: z.infer<typeof aiResumeProfileSchema> | null = null;

  if (
    resumeContent?.trim() &&
    resumeContent !== 'null' &&
    (storedWorkExperience.length === 0 ||
      storedSkills.length === 0 ||
      !knowledge.professionalSummary?.trim() ||
      resumeJsonWorkExperience.length === 0 ||
      !hasEducationProfile(userProfile))
  ) {
    try {
      const { models } = await import('@/lib/ai/models');
      const { object } = await generateObject({
        model: models.strong,
        prompt: buildResumeProfileParsePrompt(resumeContent),
        schema: aiResumeProfileSchema,
        system:
          'You extract structured profile data from resumes. Return only fields supported by the schema.',
      });
      parsedResumeProfile = object;
    } catch {
      parsedResumeProfile = null;
    }
  }

  const aiWorkExperience = compactAiWorkExperience(
    parsedResumeProfile?.workExperience ?? [],
  );
  const aiSkills = compactStringItems(parsedResumeProfile?.skills ?? []);
  const initialWorkExperience =
    storedWorkExperience.length > 0
      ? storedWorkExperience
      : aiWorkExperience.length > 0
        ? aiWorkExperience
        : resumeJsonWorkExperience.length > 0
          ? resumeJsonWorkExperience
          : resumeMarkdownWorkExperience;
  const parsedEducation = parsedResumeProfile?.education;
  const initialProfessionalSummary =
    knowledge.professionalSummary?.trim() ||
    parsedResumeProfile?.professionalSummary ||
    resumeMarkdownSummary ||
    '';
  const initialSkills =
    storedSkills.length > 0
      ? storedSkills
      : aiSkills.length > 0
        ? aiSkills
        : resumeMarkdownSkills;
  const initialUserProfile = {
    ...userProfile,
    educationDegree:
      userProfile.educationDegree ||
      parsedEducation?.degree ||
      resumeJsonEducation.educationDegree ||
      resumeMarkdownEducation.educationDegree ||
      null,
    educationEndMonth:
      userProfile.educationEndMonth ??
      parsedEducation?.endMonth ??
      resumeJsonEducation.educationEndMonth ??
      resumeMarkdownEducation.educationEndMonth ??
      null,
    educationEndYear:
      userProfile.educationEndYear ??
      parsedEducation?.endYear ??
      resumeJsonEducation.educationEndYear ??
      resumeMarkdownEducation.educationEndYear ??
      null,
    educationInstitution:
      userProfile.educationInstitution ||
      parsedEducation?.institution ||
      resumeJsonEducation.educationInstitution ||
      resumeMarkdownEducation.educationInstitution ||
      null,
    educationInstitutionLocation:
      userProfile.educationInstitutionLocation ||
      parsedEducation?.institutionLocation ||
      resumeJsonEducation.educationInstitutionLocation ||
      resumeMarkdownEducation.educationInstitutionLocation ||
      null,
    educationStartMonth:
      userProfile.educationStartMonth ??
      parsedEducation?.startMonth ??
      resumeJsonEducation.educationStartMonth ??
      resumeMarkdownEducation.educationStartMonth ??
      null,
    educationStartYear:
      userProfile.educationStartYear ??
      parsedEducation?.startYear ??
      resumeJsonEducation.educationStartYear ??
      resumeMarkdownEducation.educationStartYear ??
      null,
  } satisfies Omit<UserProfile, 'id' | 'createdAt' | 'updatedAt' | 'userId'>;
  const applicationTrackingEmail =
    user.trackingEmailAlias && user.trackingEmailForwardingEnabled
      ? `${user.trackingEmailAlias}@gimmejob.com`
      : null;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">Profile</h3>
        <p className="text-sm text-muted-foreground">
          Manage the identity, application defaults, and resume details used for
          job applications.
        </p>
      </div>

      <UserDetailsForm
        action={async values => {
          'use server';

          const parsedValues = userDetailsFormSchema.parse(values);
          const storedProfileEmailAddress = applicationTrackingEmail
            ? (user.profile?.emailAddress ?? '')
            : (parsedValues.emailAddress ?? '');
          const effectiveKnowledgeEmailAddress =
            applicationTrackingEmail ?? parsedValues.emailAddress ?? '';
          const profile = getProfileData({
            ...parsedValues,
            emailAddress: storedProfileEmailAddress,
          });

          await db.user.update({
            data: {
              profile: {
                upsert: {
                  create: profile,
                  update: profile,
                },
              },
              useOptimizedResumeOnSubmit:
                parsedValues.useOptimizedResumeOnSubmit,
            },
            where: {
              id: user.id,
            },
          });
          await syncProfileKnowledge(
            user.id,
            parsedValues,
            effectiveKnowledgeEmailAddress,
          );
          if (
            parsedValues.defaultResumeId &&
            parsedValues.defaultResumeId !== user.defaultResumeId
          ) {
            await setUserDefaultResume(parsedValues.defaultResumeId);
          }
          // Wipe the resolver's in-process cache for this user so the next
          // form-fill picks up the updated profile/knowledge/resume immediately
          // instead of waiting up to 60s for the TTL.
          invalidateResolverCacheForUser(user.id);
        }}
        applicationTrackingEmail={applicationTrackingEmail}
        applicationTrackingEmailEnabled={Boolean(applicationTrackingEmail)}
        hasDefaultResume={Boolean(user.defaultResumeId)}
        initialCountry={normalizeCountryCode(knowledgeRecord.country) || 'US'}
        initialHispanicLatino={knowledge.hispanicLatino?.trim() || ''}
        initialReferralSource={
          knowledgeRecord.referralSource?.trim() || 'Gimme Job'
        }
        initialProfessionalSummary={initialProfessionalSummary}
        initialSkills={initialSkills}
        initialWorkExperience={initialWorkExperience}
        parseWorkExperienceAction={async () => {
          'use server';

          if (!user.defaultResumeId) {
            throw new Error('Choose a default resume before parsing it.');
          }

          const resume = await db.resume.findFirst({
            include: {
              revisions: {
                orderBy: { createdAt: 'desc' },
                take: user.defaultRevisionId ? 1 : 0,
                where: user.defaultRevisionId
                  ? { id: user.defaultRevisionId }
                  : undefined,
              },
            },
            where: {
              id: user.defaultResumeId,
              userId: user.id,
            },
          });

          if (!resume) {
            throw new Error('Default resume not found.');
          }

          const revision = resume.revisions[0] ?? null;
          const resumeContent =
            revision?.markdown?.trim() ||
            resume.markdown?.trim() ||
            JSON.stringify(revision?.json ?? resume.json ?? null, null, 2);

          if (!resumeContent?.trim() || resumeContent === 'null') {
            throw new Error(
              'Your default resume does not have parseable text.',
            );
          }

          const { models } = await import('@/lib/ai/models');
          const { object } = await generateObject({
            model: models.strong,
            prompt: buildWorkExperienceParsePrompt(resumeContent),
            schema: aiWorkExperienceSchema,
            system:
              'You extract structured work experience from resumes. Return only fields supported by the schema.',
          });

          return compactAiWorkExperience(object.workExperience);
        }}
        resumeOptions={resumeOptions}
        updateDefaultResumeAction={async values => {
          'use server';

          if (!user.defaultResumeId) {
            throw new Error('Choose a default resume before updating it.');
          }

          const parsedValues = userDetailsFormSchema.parse(values);
          const resume = await db.resume.findFirst({
            include: {
              revisions: {
                orderBy: { createdAt: 'desc' },
                take: user.defaultRevisionId ? 1 : 0,
                where: user.defaultRevisionId
                  ? { id: user.defaultRevisionId }
                  : undefined,
              },
            },
            where: {
              id: user.defaultResumeId,
              userId: user.id,
            },
          });

          if (!resume) {
            throw new Error('Default resume not found.');
          }

          const revision = resume.revisions[0] ?? null;
          const currentMarkdown = revision?.markdown ?? resume.markdown;

          if (!currentMarkdown?.trim()) {
            throw new Error(
              'Your default resume does not have editable markdown yet.',
            );
          }

          const { models } = await import('@/lib/ai/models');
          const { renderTailoredResumeFormats } =
            await import('@/lib/resumes/tailor-for-lead');
          const { text } = await generateText({
            model: models.strong,
            prompt: buildResumeUpdatePrompt(currentMarkdown, parsedValues),
            system:
              'You edit resume markdown. Return only the final markdown with no code fences or commentary.',
          });
          const updatedMarkdown = stripMarkdownFences(text);
          const formats = await renderTailoredResumeFormats({
            leadId: revision?.id ?? 'default',
            markdown: updatedMarkdown,
            resumeId: resume.id,
            title: resume.name,
            userId: user.id,
          });

          if (revision) {
            await db.$transaction([
              db.resume.update({
                data: {
                  defaultRevisionId: revision.id,
                  markdown: updatedMarkdown,
                },
                where: { id: resume.id },
              }),
              db.resumeRevision.update({
                data: {
                  formats: formats as unknown as Prisma.InputJsonValue,
                  markdown: updatedMarkdown,
                  pdfDocumentUrl: formats.pdf,
                  wordDocumentUrl: formats.docx,
                },
                where: { id: revision.id },
              }),
              db.user.update({
                data: {
                  defaultRevisionId: revision.id,
                },
                where: { id: user.id },
              }),
            ]);
          } else {
            const createdRevision = await db.resumeRevision.create({
              data: {
                formats: formats as unknown as Prisma.InputJsonValue,
                markdown: updatedMarkdown,
                name: `${resume.name} - Updated`,
                pdfDocumentUrl: formats.pdf,
                resume: { connect: { id: resume.id } },
                user: { connect: { id: user.id } },
                wordDocumentUrl: formats.docx,
              },
            });

            await db.$transaction([
              db.resume.update({
                data: {
                  defaultRevisionId: createdRevision.id,
                  markdown: updatedMarkdown,
                },
                where: { id: resume.id },
              }),
              db.user.update({
                data: {
                  defaultRevisionId: createdRevision.id,
                },
                where: { id: user.id },
              }),
            ]);
          }
          await syncProfileKnowledge(
            user.id,
            parsedValues,
            applicationTrackingEmail ?? parsedValues.emailAddress ?? '',
          );

          revalidateTag(`user:${user.id}:resumes:default`);
          revalidateTag(`user:${user.id}:report:resumes`);
          revalidateTag(`user:${user.id}:resumes`);
          revalidateTag(`user:${user.id}:resumes:${resume.id}`);
        }}
        user={user}
        userProfile={initialUserProfile}
      />

      <UserCredentialsSection />
    </div>
  );
}
