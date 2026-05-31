interface WorkExperienceEntry {
  bulletItems: { text: string }[];
  company: string;
  description: string;
  endDate: string;
  endMonth?: number;
  endYear?: number;
  startDate: string;
  startMonth?: number;
  startYear?: number;
  title: string;
}

function toBulletItems(value: unknown): { text: string }[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map(item => {
      if (item && typeof item === 'object' && 'text' in item) {
        return String(item.text ?? '').trim();
      }
      return String(item ?? '').trim();
    })
    .filter(Boolean)
    .map(text => ({ text }));
}

function parseYear(value: unknown): number | undefined {
  const year = Number.parseInt(
    String(value ?? '').match(/\b(19|20)\d{2}\b/)?.[0] ?? '',
    10,
  );
  return Number.isFinite(year) ? year : undefined;
}

function sanitizeWorkExperienceEntry(
  entry: Partial<WorkExperienceEntry> | null | undefined,
): WorkExperienceEntry | null {
  const bulletItems =
    entry?.bulletItems && entry.bulletItems.length > 0
      ? toBulletItems(entry.bulletItems)
      : entry?.description
        ? entry.description
            .split(/\r?\n/)
            .map(item => item.replace(/^[-*]\s+/, '').trim())
            .filter(Boolean)
            .map(text => ({ text }))
        : [];
  const normalized: WorkExperienceEntry = {
    bulletItems,
    company: entry?.company?.trim() ?? '',
    description: entry?.description?.trim() ?? '',
    endDate: entry?.endDate?.trim() ?? '',
    endMonth: entry?.endMonth,
    endYear: entry?.endYear,
    startDate: entry?.startDate?.trim() ?? '',
    startMonth: entry?.startMonth,
    startYear: entry?.startYear,
    title: entry?.title?.trim() ?? '',
  };

  if (
    normalized.bulletItems.length === 0 &&
    !normalized.company &&
    !normalized.description &&
    !normalized.endDate &&
    normalized.endMonth === undefined &&
    normalized.endYear === undefined &&
    !normalized.startDate &&
    normalized.startMonth === undefined &&
    normalized.startYear === undefined &&
    !normalized.title
  ) {
    return null;
  }

  return normalized;
}

function compactWorkExperience(
  entries: ReadonlyArray<Partial<WorkExperienceEntry> | null | undefined>,
): WorkExperienceEntry[] {
  return entries
    .map(sanitizeWorkExperienceEntry)
    .filter((entry): entry is WorkExperienceEntry => entry !== null);
}

function extractWorkExperienceFromResumeJson(
  json: unknown,
): WorkExperienceEntry[] {
  if (!json || typeof json !== 'object') {
    return [];
  }

  const resumeData = json as Record<string, unknown>;
  const rawWorkEntries = Array.isArray(resumeData.work)
    ? resumeData.work
    : Array.isArray(resumeData.experience)
      ? resumeData.experience
      : [];

  return compactWorkExperience(
    rawWorkEntries.map(entry => {
      const job =
        entry && typeof entry === 'object'
          ? (entry as Record<string, unknown>)
          : {};

      return {
        bulletItems: toBulletItems(job.bulletItems ?? job.highlights),
        company: String(job.company ?? job.organization ?? ''),
        description: String(job.summary ?? ''),
        endDate: String(job.endDate ?? ''),
        endYear: parseYear(job.endDate),
        startDate: String(job.startDate ?? ''),
        startYear: parseYear(job.startDate),
        title: String(job.position ?? job.title ?? ''),
      };
    }),
  );
}

function parseStoredWorkExperience(
  value: string | null | undefined,
): WorkExperienceEntry[] {
  if (!value?.trim()) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    return compactWorkExperience(
      parsed.map(entry =>
        entry && typeof entry === 'object'
          ? (entry as Partial<WorkExperienceEntry>)
          : null,
      ),
    );
  } catch {
    return [];
  }
}

export {
  compactWorkExperience,
  extractWorkExperienceFromResumeJson,
  parseStoredWorkExperience,
};
export type { WorkExperienceEntry };
