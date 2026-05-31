interface ApplicationResumeFileNameInput {
  readonly extension: string;
  readonly firstName?: string | null;
  readonly lastName?: string | null;
}

function sanitizeFileNamePart(value: string | null | undefined): string {
  return (value ?? '')
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export function buildApplicationResumeFileName({
  extension,
  firstName,
  lastName,
}: ApplicationResumeFileNameInput): string {
  const nameParts = [
    sanitizeFileNamePart(firstName),
    sanitizeFileNamePart(lastName),
    'resume',
  ].filter(Boolean);
  const normalizedExtension = sanitizeFileNamePart(extension) || 'pdf';
  return `${nameParts.join('-')}.${normalizedExtension}`;
}
