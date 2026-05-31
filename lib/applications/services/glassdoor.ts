export interface GlassdoorApplicationResult {
  readonly applicationId?: string;
  readonly metadata?: Record<string, unknown>;
  readonly submissionUrl?: string;
}

export async function submitGlassdoorApplication(
  _jobLeadId: string,
  _formData: Record<string, unknown> = {},
): Promise<GlassdoorApplicationResult> {
  throw new Error('Glassdoor application submission is not implemented.');
}
