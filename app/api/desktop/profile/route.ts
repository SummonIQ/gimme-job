import { NextResponse } from 'next/server';

import {
  normalizeCountryCode,
  normalizeUsStateCode,
} from '@/constants/locales';
import { validateToken } from '@/lib/desktop-tokens';
import { db } from '@/lib/db/client';

function readBearerToken(request: Request): string | null {
  const header = request.headers.get('authorization') ?? '';
  const match = header.match(/^Bearer\s+(.+)$/);
  return match?.[1]?.trim() || null;
}

function pick(...values: Array<string | null | undefined>): string {
  return values.find(value => value && value.trim())?.trim() ?? '';
}

// E.164-style normalization. ATS phone widgets (intl-tel-input on Greenhouse,
// Lever, Workable, etc.) parse the country dial code from the leading "+CC"
// to set their country dropdown. Without a leading prefix the widget keeps
// its default country (often US) and reformats the digits — which is why
// non-US numbers get mangled. Prepend the user's country dial code when the
// stored phone doesn't already have one.
const DIAL_CODE_BY_COUNTRY: Record<string, string> = {
  AT: '+43', AU: '+61', BE: '+32', BR: '+55', CA: '+1', CH: '+41',
  CN: '+86', DE: '+49', DK: '+45', ES: '+34', FI: '+358', FR: '+33',
  GB: '+44', HK: '+852', IE: '+353', IL: '+972', IN: '+91', IT: '+39',
  JP: '+81', KR: '+82', MX: '+52', NL: '+31', NO: '+47', NZ: '+64',
  PL: '+48', PT: '+351', SE: '+46', SG: '+65', TW: '+886', US: '+1',
  ZA: '+27',
};

function withDialCode(phone: string, country: string): string {
  const trimmed = phone.trim();
  if (!trimmed) return trimmed;
  if (trimmed.startsWith('+')) return trimmed;
  const dial = DIAL_CODE_BY_COUNTRY[country.toUpperCase()];
  if (!dial) return trimmed;
  return `${dial} ${trimmed}`;
}

function normalizeWorkAuthorizationValue(
  value: string | null | undefined,
): 'yes' | 'no' {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) return 'yes';
  if (
    normalized === 'no' ||
    normalized === 'n' ||
    normalized === 'false' ||
    normalized.includes('not authorized')
  ) {
    return 'no';
  }
  if (
    normalized === 'yes' ||
    normalized === 'y' ||
    normalized === 'true' ||
    normalized.includes('authorized')
  ) {
    return 'yes';
  }
  return 'no';
}

function sanitizeFileNamePart(value: string | null | undefined): string {
  return (
    value
      ?.trim()
      .replace(/[^\w.-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '') || ''
  );
}

function resolveResumeFileName(
  firstName: string,
  lastName: string,
  resumeName: string | null,
  resumeUrl: string,
): string {
  const sanitizedName = sanitizeFileNamePart(resumeName) || 'resume';
  const namePrefix = [
    sanitizeFileNamePart(firstName),
    sanitizeFileNamePart(lastName),
  ]
    .filter(Boolean)
    .join('-');
  const baseName = namePrefix
    ? `${namePrefix}-${sanitizedName}`
    : sanitizedName;

  try {
    const pathname = new URL(resumeUrl).pathname;
    const extensionMatch = pathname.match(/\.[a-z0-9]+$/i);
    const extension = extensionMatch?.[0] ?? '.pdf';

    return baseName.toLowerCase().endsWith(extension.toLowerCase())
      ? baseName
      : `${baseName}${extension}`;
  } catch {
    return baseName.toLowerCase().endsWith('.pdf')
      ? baseName
      : `${baseName}.pdf`;
  }
}

export async function GET(request: Request) {
  const rawToken = readBearerToken(request);

  if (!rawToken) {
    return NextResponse.json(
      { error: 'Missing Bearer token' },
      { status: 401 },
    );
  }

  const validation = await validateToken(rawToken, {
    requireScope: 'desktop:runtime',
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason }, { status: 401 });
  }

  const user = await db.user.findUnique({
    select: {
      defaultResumeId: true,
      defaultRevisionId: true,
      email: true,
      firstName: true,
      id: true,
      jobPreferences: {
        select: {
          city: true,
          state: true,
        },
      },
      lastName: true,
      phone: true,
      trackingEmailAlias: true,
      trackingEmailForwardingEnabled: true,
      useOptimizedResumeOnSubmit: true,
      profile: {
        select: {
          city: true,
          disabilityStatus: true,
          emailAddress: true,
          firstName: true,
          gender: true,
          githubUrl: true,
          lastName: true,
          linkedinUrl: true,
          phoneNumber: true,
          race: true,
          requiresSponsorship: true,
          salaryExpectation: true,
          state: true,
          veteranStatus: true,
          websiteUrl: true,
          workAuthorization: true,
        },
      },
    },
    where: { id: validation.token.userId },
  });

  if (!user) {
    return NextResponse.json({ error: 'USER_NOT_FOUND' }, { status: 404 });
  }

  const knowledgeRows = await db.userKnowledge.findMany({
    select: {
      key: true,
      value: true,
    },
    where: {
      key: {
        in: ['country', 'hispanicLatino', 'referralSource'],
      },
      userId: user.id,
    },
  });
  const knowledge = Object.fromEntries(
    knowledgeRows.map(row => [row.key, row.value]),
  );

  const firstName = pick(user.profile?.firstName, user.firstName);
  const lastName = pick(user.profile?.lastName, user.lastName);
  const applicationTrackingEmail =
    user.trackingEmailAlias && user.trackingEmailForwardingEnabled
      ? `${user.trackingEmailAlias}@gimmejob.com`
      : null;
  const email = pick(
    applicationTrackingEmail,
    user.profile?.emailAddress,
    user.email,
  );
  const phone = withDialCode(
    pick(user.profile?.phoneNumber, user.phone),
    normalizeCountryCode(knowledge.country) || 'US',
  );
  const city = pick(user.profile?.city, user.jobPreferences?.city);
  const state =
    normalizeUsStateCode(
      pick(user.profile?.state, user.jobPreferences?.state),
    ) || null;
  const country = normalizeCountryCode(knowledge.country) || 'US';
  const referralSource = pick(knowledge.referralSource, 'Gimme Job');
  const sponsorshipRequired =
    user.profile?.requiresSponsorship == null
      ? null
      : user.profile.requiresSponsorship
        ? 'yes'
        : 'no';
  const salaryExpectation = user.profile?.salaryExpectation?.trim() || null;
  const disabilityStatus = pick(user.profile?.disabilityStatus) || null;
  const gender = pick(user.profile?.gender) || null;
  const hispanicLatino = pick(knowledge.hispanicLatino) || null;
  const race = pick(user.profile?.race) || null;
  const veteranStatus = pick(user.profile?.veteranStatus) || null;
  const workAuthorization = normalizeWorkAuthorizationValue(
    user.profile?.workAuthorization,
  );
  const linkedinUrl = user.profile?.linkedinUrl?.trim() || null;
  const websiteUrl = user.profile?.websiteUrl?.trim() || null;
  const githubUrl = user.profile?.githubUrl?.trim() || null;

  const missingFields = [
    !firstName ? 'first name' : null,
    !lastName ? 'last name' : null,
    !email ? 'email' : null,
    !phone ? 'phone' : null,
  ].filter(Boolean);

  if (missingFields.length > 0) {
    return NextResponse.json(
      {
        error: `Complete your profile settings before desktop submit: ${missingFields.join(', ')}.`,
      },
      { status: 409 },
    );
  }

  if (!user.defaultResumeId) {
    return NextResponse.json(
      {
        error: 'Choose a default resume before desktop submit.',
      },
      { status: 409 },
    );
  }

  const resume = await db.resume.findUnique({
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
  });

  const revision = resume?.revisions?.[0];
  const resumeUrl = user.defaultRevisionId
    ? revision?.pdfDocumentUrl || resume?.url
    : resume?.url;

  if (!resumeUrl) {
    return NextResponse.json(
      {
        error: 'Your default resume file is unavailable.',
      },
      { status: 409 },
    );
  }

  const resumeFileName = resolveResumeFileName(
    firstName,
    lastName,
    user.defaultRevisionId
      ? (revision?.name ?? resume?.name ?? null)
      : (resume?.name ?? null),
    resumeUrl,
  );

  return NextResponse.json({
    city: city || null,
    country,
    disabilityStatus,
    email,
    firstName,
    gender,
    githubUrl,
    hispanicLatino,
    lastName,
    linkedinUrl,
    phone,
    race,
    referralSource,
    resumeFileName,
    resumeUrl,
    salaryExpectation,
    sponsorshipRequired,
    state,
    useOptimizedResumeOnSubmit: user.useOptimizedResumeOnSubmit,
    userId: user.id,
    veteranStatus,
    websiteUrl,
    workAuthorization,
  });
}
