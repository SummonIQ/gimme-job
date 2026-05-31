import { NextResponse, type NextRequest } from 'next/server';

import { db } from '@/lib/db/client';
import { invalidateResolverCacheForUser } from '@/lib/field-answer/resolve';
import { getUserKnowledge } from '@/lib/user/knowledge';
import { getCurrentUser } from '@/lib/user/query';

const ALLOWED_PROFILE_FIELDS: Record<string, string> = {
  city: 'city',
  disabilityStatus: 'disabilityStatus',
  earliestStartDate: 'earliestStartDate',
  email: 'emailAddress',
  firstName: 'firstName',
  gender: 'gender',
  githubUrl: 'githubUrl',
  lastName: 'lastName',
  linkedinUrl: 'linkedinUrl',
  phone: 'phoneNumber',
  race: 'race',
  salaryExpectation: 'salaryExpectation',
  state: 'state',
  streetAddress: 'streetAddress',
  veteranStatus: 'veteranStatus',
  websiteUrl: 'websiteUrl',
  workAuthorization: 'workAuthorization',
  yearsOfExperience: 'yearsOfExperience',
  zipCode: 'zipCode',
};

export async function GET() {
  const user = await getCurrentUser({ include: { profile: true } });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const [knowledge, defaultResume] = await Promise.all([
    getUserKnowledge(user.id),
    user.defaultResumeId
      ? db.resume.findUnique({
          where: { id: user.defaultResumeId },
          include: {
            revisions: {
              where: user.defaultRevisionId
                ? { id: user.defaultRevisionId }
                : undefined,
              orderBy: { createdAt: 'desc' },
              take: user.defaultRevisionId ? 1 : 0,
            },
          },
        })
      : null,
  ]);

  const profile = user.profile;
  const resumeFileName =
    defaultResume?.revisions?.[0]?.name || defaultResume?.name || 'resume.pdf';

  // Helper: return the first non-empty value from the chain
  const pick = (...sources: (string | null | undefined)[]): string =>
    sources.find(s => s && s.trim())?.trim() || '';
  const pickList = (value: string | null | undefined): string => {
    if (!value?.trim()) {
      return '';
    }

    try {
      const parsed = JSON.parse(value) as unknown;
      if (!Array.isArray(parsed)) {
        return value.trim();
      }

      return parsed
        .map(item =>
          typeof item === 'string'
            ? item.trim()
            : item && typeof item === 'object' && 'text' in item
              ? String(item.text ?? '').trim()
              : '',
        )
        .filter(Boolean)
        .join('\n');
    } catch {
      return value.trim();
    }
  };

  const fullName = pick(
    user.name,
    `${user.firstName} ${user.lastName}`.trim() || null,
    knowledge.fullName,
  );
  const parseBooleanKnowledge = (value: string | undefined): boolean | null => {
    if (!value) return null;
    const normalized = value.trim().toLowerCase();
    if (['true', 'yes', 'y', '1'].includes(normalized)) return true;
    if (['false', 'no', 'n', '0'].includes(normalized)) return false;
    return null;
  };

  let linkedinUrl = pick(profile?.linkedinUrl, knowledge.linkedinUrl);
  if (!linkedinUrl && defaultResume) {
    const resumeMarkdown =
      (defaultResume.revisions?.[0] as { markdown?: string | null })
        ?.markdown ||
      defaultResume.markdown ||
      '';
    const linkedinMatch = resumeMarkdown.match(
      /https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+\/?/i,
    );
    if (linkedinMatch) {
      linkedinUrl = linkedinMatch[0];
    }
  }

  return NextResponse.json({
    profile: {
      city: pick(profile?.city, knowledge.city),
      currentCompany: pick(knowledge.currentCompany),
      currentTitle: pick(knowledge.currentTitle),
      disabilityStatus: pick(
        profile?.disabilityStatus,
        knowledge.disabilityStatus,
      ),
      earliestStartDate: pick(
        profile?.earliestStartDate,
        knowledge.earliestStartDate,
      ),
      email: pick(profile?.emailAddress, user.email, knowledge.email),
      firstName: pick(profile?.firstName, user.firstName, knowledge.firstName),
      fullName,
      gender: pick(profile?.gender, knowledge.gender),
      githubUrl: pick(profile?.githubUrl, knowledge.githubUrl),
      hispanicLatino: pick(knowledge.hispanicLatino),
      graduationYear: pick(knowledge.graduationYear),
      hasDefaultResume: Boolean(defaultResume),
      highestDegree: pick(knowledge.highestDegree),
      languages: pick(knowledge.languages),
      lastName: pick(profile?.lastName, user.lastName, knowledge.lastName),
      linkedinUrl,
      phone: pick(profile?.phoneNumber, user.phone, knowledge.phone),
      race: pick(profile?.race, knowledge.race),
      requiresSponsorship:
        profile?.requiresSponsorship ??
        parseBooleanKnowledge(knowledge.requiresSponsorship),
      resumeFileName,
      salaryExpectation: pick(
        profile?.salaryExpectation,
        knowledge.salaryExpectation,
      ),
      skills: pickList(knowledge.skills),
      state: pick(profile?.state, knowledge.state),
      streetAddress: pick(profile?.streetAddress, knowledge.streetAddress),
      summary: pick(knowledge.professionalSummary),
      university: pick(knowledge.university),
      veteranStatus: pick(profile?.veteranStatus, knowledge.veteranStatus),
      websiteUrl: pick(profile?.websiteUrl, knowledge.websiteUrl),
      workAuthorization: pick(
        profile?.workAuthorization,
        knowledge.workAuthorization,
      ),
      yearsOfExperience: pick(
        profile?.yearsOfExperience,
        knowledge.yearsOfExperience,
      ),
      zipCode: pick(profile?.zipCode, knowledge.zipCode),
    },
  });
}

export async function PATCH(request: NextRequest) {
  const user = await getCurrentUser({ include: { profile: true } });
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { field, value } = body as { field: string; value: string };

  if (!field || typeof value !== 'string') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const dbField = ALLOWED_PROFILE_FIELDS[field];
  if (!dbField) {
    return NextResponse.json({ error: 'Unknown field' }, { status: 400 });
  }

  await db.userProfile.update({
    where: { userId: user.id },
    data: { [dbField]: value.trim() },
  });

  invalidateResolverCacheForUser(user.id);
  return NextResponse.json({ ok: true });
}
