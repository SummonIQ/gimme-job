'use server';

import { db } from '@/lib/db/client';
import { UserDataForSuggestions } from './types';

export async function getUserDataForSuggestions(
  userId: string,
): Promise<UserDataForSuggestions> {
  const [user, userProfile, defaultResume, linkedInProfile] = await Promise.all(
    [
      db.user.findUnique({
        where: { id: userId },
        select: {
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          trackingEmailAlias: true,
          trackingEmailForwardingEnabled: true,
        },
      }),
      db.userProfile.findUnique({
        where: { userId },
      }),
      db.user
        .findUnique({
          where: { id: userId },
          select: {
            defaultResumeId: true,
            defaultRevisionId: true,
          },
        })
        .then(async u => {
          if (!u?.defaultResumeId) return null;
          return db.resume.findUnique({
            where: { id: u.defaultResumeId },
            include: {
              revisions: {
                where: u.defaultRevisionId ? { id: u.defaultRevisionId } : {},
                orderBy: { createdAt: 'desc' },
                take: u.defaultRevisionId ? 1 : 0,
              },
            },
          });
        }),
      db.linkedInProfile.findFirst({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
      }),
    ],
  );

  const resumeJson = defaultResume?.revisions?.[0]?.json ?? defaultResume?.json;
  const parsedResume = resumeJson ? parseResumeJson(resumeJson) : null;

  return {
    profile: {
      firstName: user?.firstName ?? userProfile?.firstName ?? undefined,
      lastName: user?.lastName ?? userProfile?.lastName ?? undefined,
      email:
        (user?.trackingEmailAlias && user?.trackingEmailForwardingEnabled
          ? `${user.trackingEmailAlias}@gimmejob.com`
          : null) ??
        user?.email ??
        userProfile?.emailAddress ??
        undefined,
      phone: user?.phone ?? userProfile?.phoneNumber ?? undefined,
      city: userProfile?.city ?? undefined,
      state: userProfile?.state ?? undefined,
      zipCode: userProfile?.zipCode ?? undefined,
      streetAddress: userProfile?.streetAddress ?? undefined,
      linkedinUrl: userProfile?.linkedinUrl ?? undefined,
      githubUrl: userProfile?.githubUrl ?? undefined,
      websiteUrl: userProfile?.websiteUrl ?? undefined,
    },
    resume: parsedResume ?? {
      summary: undefined,
      skills: [],
      workExperience: [],
      education: [],
    },
    linkedin: linkedInProfile
      ? {
          headline: linkedInProfile.headline ?? undefined,
          currentCompany: undefined,
          currentTitle: undefined,
        }
      : undefined,
    preferences: await getUserPreferences(userId),
  };
}

async function getUserPreferences(userId: string) {
  const prefs = await db.userJobPreferences.findUnique({
    where: { userId },
  });

  if (!prefs) return undefined;

  return {
    workAuthorization: true,
    requiresSponsorship: false,
    willingToRelocate: !prefs.remoteOnly,
    preferredSalary: undefined,
    experienceYears: undefined,
  };
}

interface ParsedResume {
  summary?: string;
  skills: string[];
  workExperience: Array<{
    company: string;
    title: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  }>;
  education: Array<{
    institution: string;
    degree: string;
    field?: string;
    startYear?: number;
    endYear?: number;
  }>;
}

function parseResumeJson(json: unknown): ParsedResume | null {
  if (!json || typeof json !== 'object') return null;

  const resumeData = json as Record<string, unknown>;

  const skills: string[] = [];
  if (Array.isArray(resumeData.skills)) {
    for (const skill of resumeData.skills) {
      if (typeof skill === 'string') {
        skills.push(skill);
      } else if (skill && typeof skill === 'object' && 'name' in skill) {
        skills.push(String(skill.name));
      }
    }
  }

  const workExperience: ParsedResume['workExperience'] = [];
  if (Array.isArray(resumeData.work) || Array.isArray(resumeData.experience)) {
    const workArray = (resumeData.work ?? resumeData.experience) as Array<
      Record<string, unknown>
    >;
    for (const job of workArray) {
      workExperience.push({
        company: String(job.company ?? job.organization ?? ''),
        title: String(job.position ?? job.title ?? ''),
        startDate: job.startDate ? String(job.startDate) : undefined,
        endDate: job.endDate ? String(job.endDate) : undefined,
        description: job.summary ? String(job.summary) : undefined,
      });
    }
  }

  const education: ParsedResume['education'] = [];
  if (Array.isArray(resumeData.education)) {
    for (const edu of resumeData.education as Array<Record<string, unknown>>) {
      education.push({
        institution: String(edu.institution ?? edu.school ?? ''),
        degree: String(edu.studyType ?? edu.degree ?? ''),
        field: edu.area ? String(edu.area) : undefined,
        startYear: edu.startDate
          ? parseInt(String(edu.startDate).slice(0, 4))
          : undefined,
        endYear: edu.endDate
          ? parseInt(String(edu.endDate).slice(0, 4))
          : undefined,
      });
    }
  }

  return {
    summary: resumeData.summary ? String(resumeData.summary) : undefined,
    skills,
    workExperience,
    education,
  };
}

export async function matchFieldToUserData(
  fieldName: string,
  fieldLabel: string,
  userData: UserDataForSuggestions,
): Promise<{
  value: string;
  source: 'profile' | 'resume' | 'linkedin' | 'previous_application';
  confidence: number;
} | null> {
  const nameLower = fieldName.toLowerCase();
  const labelLower = fieldLabel.toLowerCase();
  const combined = `${nameLower} ${labelLower}`;

  if (combined.includes('first') && combined.includes('name')) {
    if (userData.profile.firstName) {
      return {
        value: userData.profile.firstName,
        source: 'profile',
        confidence: 0.95,
      };
    }
  }

  if (combined.includes('last') && combined.includes('name')) {
    if (userData.profile.lastName) {
      return {
        value: userData.profile.lastName,
        source: 'profile',
        confidence: 0.95,
      };
    }
  }

  if (
    (combined.includes('full') && combined.includes('name')) ||
    nameLower === 'name'
  ) {
    if (userData.profile.firstName && userData.profile.lastName) {
      return {
        value: `${userData.profile.firstName} ${userData.profile.lastName}`,
        source: 'profile',
        confidence: 0.9,
      };
    }
  }

  if (combined.includes('email')) {
    if (userData.profile.email) {
      return {
        value: userData.profile.email,
        source: 'profile',
        confidence: 0.95,
      };
    }
  }

  if (
    combined.includes('phone') ||
    combined.includes('tel') ||
    combined.includes('mobile')
  ) {
    if (userData.profile.phone) {
      return {
        value: userData.profile.phone,
        source: 'profile',
        confidence: 0.9,
      };
    }
  }

  if (combined.includes('city')) {
    if (userData.profile.city) {
      return {
        value: userData.profile.city,
        source: 'profile',
        confidence: 0.85,
      };
    }
  }

  if (
    combined.includes('state') ||
    combined.includes('province') ||
    combined.includes('region')
  ) {
    if (userData.profile.state) {
      return {
        value: userData.profile.state,
        source: 'profile',
        confidence: 0.85,
      };
    }
  }

  if (combined.includes('zip') || combined.includes('postal')) {
    if (userData.profile.zipCode) {
      return {
        value: userData.profile.zipCode,
        source: 'profile',
        confidence: 0.85,
      };
    }
  }

  if (combined.includes('address') && !combined.includes('email')) {
    if (userData.profile.streetAddress) {
      return {
        value: userData.profile.streetAddress,
        source: 'profile',
        confidence: 0.8,
      };
    }
  }

  if (combined.includes('linkedin')) {
    if (userData.profile.linkedinUrl) {
      return {
        value: userData.profile.linkedinUrl,
        source: 'profile',
        confidence: 0.95,
      };
    }
  }

  if (combined.includes('github')) {
    if (userData.profile.githubUrl) {
      return {
        value: userData.profile.githubUrl,
        source: 'profile',
        confidence: 0.95,
      };
    }
  }

  if (combined.includes('website') || combined.includes('portfolio')) {
    if (userData.profile.websiteUrl) {
      return {
        value: userData.profile.websiteUrl,
        source: 'profile',
        confidence: 0.9,
      };
    }
  }

  if (
    combined.includes('current') &&
    (combined.includes('company') || combined.includes('employer'))
  ) {
    const currentJob = userData.resume.workExperience?.[0];
    if (currentJob?.company) {
      return { value: currentJob.company, source: 'resume', confidence: 0.85 };
    }
  }

  if (combined.includes('current') && combined.includes('title')) {
    const currentJob = userData.resume.workExperience?.[0];
    if (currentJob?.title) {
      return { value: currentJob.title, source: 'resume', confidence: 0.85 };
    }
  }

  if (
    combined.includes('headline') ||
    (combined.includes('professional') && combined.includes('summary'))
  ) {
    if (userData.linkedin?.headline) {
      return {
        value: userData.linkedin.headline,
        source: 'linkedin',
        confidence: 0.8,
      };
    }
    if (userData.resume.summary) {
      return {
        value: userData.resume.summary,
        source: 'resume',
        confidence: 0.75,
      };
    }
  }

  return null;
}
