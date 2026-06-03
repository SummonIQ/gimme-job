import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { IdentityKey, IdentityStore } from '../identity/types.js';
import type { DesktopTokenStore } from '../auth/types.js';
import type { DesktopAgentSessionStatus } from '../agent/types.js';

export interface DesktopSubmissionValidationFailure {
  readonly fieldLabel: string;
  readonly fieldSelector: string;
  readonly message: string;
}

export interface DesktopRandomGreenhouseLead {
  readonly applicationUrl: string;
  readonly company: string | null;
  readonly jobLeadId?: string;
  readonly jobListingId: string;
  readonly location?: string | null;
  readonly source: string | null;
  readonly title: string;
}

export type DesktopRandomJobProviderScope = 'any' | 'greenhouse';
export type DesktopRandomJobProviderId = string;

export interface DesktopGreenhouseLeadSearchQuery {
  readonly excludeCompanies?: readonly string[];
  readonly excludeListingIds?: readonly string[];
  readonly location?: string;
  readonly provider?: DesktopRandomJobProviderScope;
  readonly providers?: readonly DesktopRandomJobProviderId[];
  readonly remote?: boolean;
  /**
   * Filter to leads whose application URL matches one of the listed runtime
   * ATS providers (Lever, Ashby, etc.). Distinct from `providers`, which
   * filters by job-source scraper. Server-side resolved via the URL host.
   */
  readonly runtimeProviders?: readonly string[];
  readonly search?: string;
}

export interface DesktopSubmitProfile {
  readonly canadaWorkPreference?: string | null;
  readonly city?: string | null;
  readonly citizenshipStatus?: string | null;
  readonly country?: string | null;
  readonly disabilityStatus?: string | null;
  readonly email: string;
  readonly firstName: string;
  readonly gender?: string | null;
  readonly githubUrl?: string | null;
  readonly hispanicLatino?: string | null;
  readonly lastName: string;
  readonly linkedinUrl?: string | null;
  readonly phone: string;
  readonly race?: string | null;
  readonly referralSource?: string | null;
  readonly resumeFileName: string;
  readonly resumeUrl: string;
  readonly salaryExpectation?: string | null;
  readonly sponsorshipRequired?: string | null;
  readonly state?: string | null;
  readonly useOptimizedResumeOnSubmit?: boolean;
  readonly veteranStatus?: string | null;
  readonly websiteUrl?: string | null;
  readonly workAuthorization?: string | null;
}

export interface DesktopSubmittedApplicationCheck {
  readonly alreadySubmitted: boolean;
  readonly jobLeadId: string | null;
  readonly reason: 'existing_submission' | 'job_lead_applied' | null;
  readonly status: string | null;
  readonly submissionId: string | null;
  readonly submittedAt: string | null;
}

type FetchLike = typeof fetch;

export function createDesktopSubmitClient(input: {
  readonly appUrl: string;
  readonly fetchImpl?: FetchLike;
  readonly identityStore: IdentityStore;
  readonly tokenStore: DesktopTokenStore;
}) {
  const appUrl = input.appUrl.replace(/\/$/, '');
  const fetchImpl = input.fetchImpl ?? fetch;

  return {
    async syncProfileToIdentity(): Promise<DesktopSubmitProfile> {
      const token = await input.tokenStore.readToken();
      if (!token) {
        throw new Error('Pair this desktop before submit.');
      }

      const response = await fetchImpl(`${appUrl}/api/desktop/profile`, {
        headers: { authorization: `Bearer ${token}` },
        method: 'GET',
      });
      const payload = await readJsonObject(response);

      if (!response.ok) {
        throw new Error(
          getString(payload, 'error') ?? `HTTP_${response.status}`,
        );
      }

      const profile = readSubmitProfile(payload);
      const resumeFilePath = await downloadDefaultResume({
        fetchImpl,
        resumeFileName: profile.resumeFileName,
        resumeUrl: profile.resumeUrl,
      });

      const writes: Array<[IdentityKey, string]> = [
        ['first_name', profile.firstName],
        ['last_name', profile.lastName],
        ['email', profile.email],
        ['phone', profile.phone],
        ['resume_pdf_path', resumeFilePath],
      ];
      if (profile.city) writes.push(['city', profile.city]);
      if (profile.state) writes.push(['state', profile.state]);
      if (profile.country) writes.push(['country', profile.country]);
      if (profile.gender) writes.push(['gender', profile.gender]);
      if (profile.race) writes.push(['race_ethnicity', profile.race]);
      if (profile.veteranStatus) {
        writes.push(['veteran_status', profile.veteranStatus]);
      }
      if (profile.disabilityStatus) {
        writes.push(['disability_status', profile.disabilityStatus]);
      }
      if (profile.workAuthorization) {
        writes.push(['work_authorization', profile.workAuthorization]);
      }
      if (profile.sponsorshipRequired) {
        writes.push(['sponsorship_required', profile.sponsorshipRequired]);
      }
      if (profile.linkedinUrl)
        writes.push(['linkedin_url', profile.linkedinUrl]);
      if (profile.githubUrl) writes.push(['github_url', profile.githubUrl]);
      if (profile.websiteUrl) writes.push(['website_url', profile.websiteUrl]);
      await Promise.all(
        writes.map(([key, value]) => input.identityStore.write(key, value)),
      );

      return profile;
    },
    async lookupRecentVerificationCode(
      digits?: number,
      options: { readonly signal?: AbortSignal } = {},
    ): Promise<{
      readonly code: string;
      readonly digits: number;
      readonly emailId: string;
      readonly fromEmail: string;
      readonly subject: string;
    } | null> {
      const token = await input.tokenStore.readToken();
      if (!token) return null;
      const params = new URLSearchParams();
      if (typeof digits === 'number' && Number.isFinite(digits)) {
        params.set('digits', String(digits));
      }
      const queryString = params.toString();
      try {
        const response = await fetchImpl(
          `${appUrl}/api/desktop/verification-code${queryString ? `?${queryString}` : ''}`,
          {
            headers: { authorization: `Bearer ${token}` },
            method: 'GET',
            signal: options.signal,
          },
        );
        if (response.status === 404) return null;
        if (!response.ok) return null;
        const payload = await readJsonObject(response);
        const code = getString(payload, 'code');
        if (!code) return null;
        const rawDigits = (payload as { digits?: unknown }).digits;
        return {
          code,
          digits:
            typeof rawDigits === 'number' && Number.isFinite(rawDigits)
              ? rawDigits
              : code.length,
          emailId: getString(payload, 'emailId') ?? '',
          fromEmail: getString(payload, 'fromEmail') ?? '',
          subject: getString(payload, 'subject') ?? '',
        };
      } catch {
        return null;
      }
    },
    async resolveUnknownFieldAnswer(
      query: {
        readonly aiProvider?: 'openai' | 'ollama';
        readonly applicationUrl?: string;
        readonly fieldType?:
          | 'text'
          | 'textarea'
          | 'select'
          | 'radio'
          | 'checkbox'
          | 'unknown';
        readonly jobLeadId?: string;
        readonly options?: readonly string[];
        readonly question: string;
        readonly siblingUrls?: readonly string[];
      },
      options: { readonly signal?: AbortSignal } = {},
    ): Promise<{
      readonly answer: string;
      readonly confidence: 'high' | 'medium' | 'low';
      readonly reasoning: string;
    } | null> {
      // Trimmed-but-meaningful identifier for log lines so we can trace
      // which question failed without dumping the full prompt.
      const tag = query.question.slice(0, 60);
      const token = await input.tokenStore.readToken();
      if (!token) {
        console.warn(
          `[resolveUnknownFieldAnswer] "${tag}" skipped: no desktop token (pair the desktop first)`,
        );
        return null;
      }

      let response: Awaited<ReturnType<typeof fetchImpl>>;
      try {
        response = await fetchImpl(
          `${appUrl}/api/desktop/agent-chat/field-answer`,
          {
            body: JSON.stringify({
              aiProvider: query.aiProvider,
              applicationUrl: query.applicationUrl,
              fieldType: query.fieldType ?? 'unknown',
              jobLeadId: query.jobLeadId,
              options: query.options ?? [],
              question: query.question,
              siblingUrls: query.siblingUrls ?? [],
            }),
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            method: 'POST',
            signal: options.signal,
          },
        );
      } catch (error) {
        // Network failure (web server down, DNS, TLS, abort, …). Surface
        // it loudly so the user can see why every field came back empty.
        console.error(
          `[resolveUnknownFieldAnswer] "${tag}" network error: ${error instanceof Error ? error.message : String(error)} (appUrl=${appUrl})`,
        );
        return null;
      }

      let payload: unknown;
      try {
        payload = await readJsonObject(response);
      } catch (error) {
        console.error(
          `[resolveUnknownFieldAnswer] "${tag}" HTTP ${response.status}, payload not JSON: ${error instanceof Error ? error.message : String(error)}`,
        );
        return null;
      }

      if (!response.ok) {
        // Surface the server's error body — this is where 401 (bad
        // token), 500 (LLM blew up), and 429 (quota) show up. Without
        // this the renderer just sees "empty answer".
        const serverError =
          typeof payload === 'object' && payload !== null
            ? JSON.stringify(payload).slice(0, 240)
            : String(payload).slice(0, 240);
        console.error(
          `[resolveUnknownFieldAnswer] "${tag}" HTTP ${response.status}: ${serverError}`,
        );
        return null;
      }

      const payloadRecord =
        payload && typeof payload === 'object' && !Array.isArray(payload)
          ? (payload as Record<string, unknown>)
          : {};
      const answer = getString(payloadRecord, 'answer') ?? '';
      const confidenceRaw = getString(payloadRecord, 'confidence') ?? 'low';
      const reasoning = getString(payloadRecord, 'reasoning') ?? '';
      if (!answer.trim()) {
        // The resolver returned an empty answer (no rule, no
        // deterministic match, LLM declined to answer). Log so the user
        // can see the resolver's reasoning — usually points at a
        // missing profile field or an unmatched select option.
        console.warn(
          `[resolveUnknownFieldAnswer] "${tag}" empty answer (provider=${query.aiProvider ?? 'openai'}, reasoning=${reasoning.slice(0, 160)})`,
        );
        return null;
      }
      const confidence: 'high' | 'medium' | 'low' =
        confidenceRaw === 'high' || confidenceRaw === 'medium'
          ? confidenceRaw
          : 'low';
      return { answer: answer.trim(), confidence, reasoning };
    },
    async recordFormSnapshot(record: {
      readonly applicationUrl: string;
      readonly byteSize: number;
      readonly capturedAt: string;
      readonly fields: ReadonlyArray<{
        readonly fieldType: string;
        readonly label: string;
        readonly options: ReadonlyArray<{
          readonly label: string;
          readonly value: string;
        }>;
        readonly required: boolean;
        readonly selector: string;
        readonly value: string;
      }>;
      readonly filePath: string;
      readonly hostname: string;
      readonly jobLeadId?: string;
    }): Promise<void> {
      const token = await input.tokenStore.readToken();
      if (!token) return;
      try {
        await fetchImpl(`${appUrl}/api/desktop/agent-chat/form-snapshot`, {
          body: JSON.stringify(record),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        });
      } catch {
        // Non-fatal: the local file is still written even if the DB record fails.
      }
    },
    async fetchFieldRules(): Promise<
      ReadonlyArray<{
        id: string;
        hostname: string | null;
        question: string;
        answer: string;
        source: 'manual' | 'state-tab' | 'chat';
        createdAt: string;
      }>
    > {
      const token = await input.tokenStore.readToken();
      if (!token) return [];
      try {
        const response = await fetchImpl(`${appUrl}/api/desktop/field-rules`, {
          headers: { authorization: `Bearer ${token}` },
          method: 'GET',
        });
        if (!response.ok) return [];
        const payload = (await response.json().catch(() => ({}))) as {
          rules?: ReadonlyArray<{
            id?: unknown;
            hostname?: unknown;
            question?: unknown;
            answer?: unknown;
            source?: unknown;
            createdAt?: unknown;
          }>;
        };
        return (payload.rules ?? [])
          .filter(
            (rule): rule is Record<string, unknown> =>
              typeof rule === 'object' &&
              rule !== null &&
              typeof (rule as Record<string, unknown>).question === 'string' &&
              typeof (rule as Record<string, unknown>).answer === 'string',
          )
          .map(rule => {
            const sourceValue = rule.source;
            const source: 'manual' | 'state-tab' | 'chat' =
              sourceValue === 'state-tab' || sourceValue === 'chat'
                ? sourceValue
                : 'manual';
            return {
              id:
                typeof rule.id === 'string'
                  ? rule.id
                  : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              hostname:
                typeof rule.hostname === 'string' ? rule.hostname : null,
              question: rule.question as string,
              answer: rule.answer as string,
              source,
              createdAt:
                typeof rule.createdAt === 'string'
                  ? rule.createdAt
                  : new Date().toISOString(),
            };
          });
      } catch {
        return [];
      }
    },
    async syncFieldRule(rule: {
      readonly hostname: string | null;
      readonly question: string;
      readonly answer: string;
      readonly source: 'manual' | 'state-tab' | 'chat';
    }): Promise<void> {
      const token = await input.tokenStore.readToken();
      if (!token) return;
      try {
        await fetchImpl(`${appUrl}/api/desktop/field-rules`, {
          body: JSON.stringify(rule),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        });
      } catch {
        // Non-fatal: rule lives on disk; will retry on next add.
      }
    },
    async deleteFieldRule(id: string): Promise<void> {
      const token = await input.tokenStore.readToken();
      if (!token) return;
      try {
        await fetchImpl(
          `${appUrl}/api/desktop/field-rules?id=${encodeURIComponent(id)}`,
          {
            headers: { authorization: `Bearer ${token}` },
            method: 'DELETE',
          },
        );
      } catch {
        // Non-fatal.
      }
    },
    async uploadRunLog(record: {
      readonly applicationUrl: string;
      readonly jobLeadId?: string;
      readonly mode: 'submit' | 'training';
      readonly status: string;
      readonly message?: string;
      readonly capturedAt: string;
      readonly toolCalls: ReadonlyArray<{
        readonly tool: string;
        readonly ok: boolean;
        readonly reason?: string;
        readonly selector?: string;
        readonly errorMessage?: string;
        readonly input?: unknown;
      }>;
      readonly pageConsoleErrors?: ReadonlyArray<{
        readonly level: 'error' | 'warning' | 'info' | 'log' | 'debug';
        readonly message: string;
        readonly source?: string;
        readonly line?: number;
        readonly capturedAt?: string;
      }>;
    }): Promise<void> {
      const token = await input.tokenStore.readToken();
      if (!token) return;
      try {
        await fetchImpl(`${appUrl}/api/desktop/run-logs`, {
          body: JSON.stringify(record),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        });
      } catch {
        // Non-fatal: local file is still written even if upload fails.
      }
    },
    async recordTrainingFeedback(record: {
      readonly applicationUrl: string;
      readonly hostname: string;
      readonly capturedAt: string;
      readonly trigger: 'submit' | 'manual';
      readonly correctedFields: ReadonlyArray<{
        readonly label: string;
        readonly value: string;
        readonly type?: string;
        readonly aiValue?: string;
      }>;
      readonly filledFields: ReadonlyArray<{
        readonly label: string;
        readonly value: string;
        readonly type?: string;
      }>;
    }): Promise<void> {
      const token = await input.tokenStore.readToken();
      if (!token) return;
      try {
        await fetchImpl(`${appUrl}/api/desktop/training-feedback`, {
          body: JSON.stringify(record),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        });
      } catch {
        // Non-fatal: training feedback failing shouldn't break the run.
      }
    },
    async pickRandomGreenhouseLead(
      query: DesktopGreenhouseLeadSearchQuery = {},
    ): Promise<DesktopRandomGreenhouseLead> {
      const token = await input.tokenStore.readToken();
      if (!token) {
        throw new Error('Pair this desktop before selecting a random job.');
      }

      const params = new URLSearchParams();
      if (query.search?.trim()) params.set('search', query.search.trim());
      if (query.location?.trim()) params.set('location', query.location.trim());
      if (query.provider === 'any' || query.provider === 'greenhouse') {
        params.set('provider', query.provider);
      }
      if (query.providers && query.providers.length > 0) {
        params.set('providers', query.providers.join(','));
      }
      if (query.runtimeProviders && query.runtimeProviders.length > 0) {
        params.set('runtimeProviders', query.runtimeProviders.join(','));
      }
      if (query.remote) params.set('remote', 'true');
      if (query.excludeListingIds && query.excludeListingIds.length > 0) {
        params.set('excludeListingIds', query.excludeListingIds.join(','));
      }
      if (query.excludeCompanies && query.excludeCompanies.length > 0) {
        params.set('excludeCompanies', query.excludeCompanies.join(','));
      }
      const queryString = params.toString();
      const endpoint =
        query.provider === 'greenhouse'
          ? '/api/desktop/jobs/random-greenhouse'
          : '/api/desktop/jobs/random';

      const response = await fetchImpl(
        `${appUrl}${endpoint}${queryString ? `?${queryString}` : ''}`,
        {
          headers: { authorization: `Bearer ${token}` },
          method: 'GET',
        },
      );
      const payload = await readJsonObject(response);

      if (!response.ok) {
        throw new Error(
          getString(payload, 'error') ?? `HTTP_${response.status}`,
        );
      }

      return readGreenhouseLead(payload, 'INVALID_RANDOM_GREENHOUSE_RESPONSE');
    },
    async recordSubmittedApplication(record: {
      readonly applicationUrl: string;
      readonly failureSnapshot?: {
        readonly capturedAt?: string;
        readonly domHtml: string;
        readonly screenshotPngBase64: string;
      };
      readonly jobLeadId?: string;
      readonly message?: string;
      readonly mode: 'submit' | 'training';
      readonly status: DesktopAgentSessionStatus;
      readonly toolCallCount?: number;
      readonly validationFailures?: readonly DesktopSubmissionValidationFailure[];
    }): Promise<{
      readonly jobLeadId: string | null;
      readonly outcome: 'applied' | 'tracked' | 'skipped';
      readonly submissionId: string | null;
    }> {
      const token = await input.tokenStore.readToken();
      if (!token) {
        throw new Error('Pair this desktop before recording a submission.');
      }

      const response = await fetchImpl(
        `${appUrl}/api/desktop/applications/submitted`,
        {
          body: JSON.stringify(record),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        },
      );
      const payload = await readJsonObject(response);

      if (!response.ok) {
        throw new Error(
          getString(payload, 'error') ?? `HTTP_${response.status}`,
        );
      }

      const outcomeRaw = getString(payload, 'outcome');
      const outcome: 'applied' | 'tracked' | 'skipped' =
        outcomeRaw === 'applied' ||
        outcomeRaw === 'tracked' ||
        outcomeRaw === 'skipped'
          ? outcomeRaw
          : 'skipped';

      return {
        jobLeadId: getString(payload, 'jobLeadId'),
        outcome,
        submissionId: getString(payload, 'submissionId'),
      };
    },
    async checkSubmittedApplication(record: {
      readonly applicationUrl: string;
      readonly jobLeadId?: string;
    }): Promise<DesktopSubmittedApplicationCheck> {
      const token = await input.tokenStore.readToken();
      if (!token) {
        throw new Error('Pair this desktop before checking a submission.');
      }

      const params = new URLSearchParams({
        applicationUrl: record.applicationUrl,
      });
      if (record.jobLeadId?.trim()) {
        params.set('jobLeadId', record.jobLeadId.trim());
      }

      const response = await fetchImpl(
        `${appUrl}/api/desktop/applications/submitted?${params.toString()}`,
        {
          headers: { authorization: `Bearer ${token}` },
          method: 'GET',
        },
      );
      const payload = await readJsonObject(response);

      if (!response.ok) {
        throw new Error(
          getString(payload, 'error') ?? `HTTP_${response.status}`,
        );
      }

      const reasonRaw = getString(payload, 'reason');
      const reason: DesktopSubmittedApplicationCheck['reason'] =
        reasonRaw === 'existing_submission' || reasonRaw === 'job_lead_applied'
          ? reasonRaw
          : null;

      return {
        alreadySubmitted:
          (payload as Record<string, unknown>).alreadySubmitted === true,
        jobLeadId: getString(payload, 'jobLeadId'),
        reason,
        status: getString(payload, 'status'),
        submissionId: getString(payload, 'submissionId'),
        submittedAt: getString(payload, 'submittedAt'),
      };
    },
    async recordSubmissionConfirmation(record: {
      readonly family?:
        | 'greenhouse'
        | 'lever'
        | 'ashby'
        | 'smartrecruiters'
        | 'generic';
      readonly hostname?: string;
      readonly pageHtml: string;
      readonly submissionId: string;
    }): Promise<{
      readonly transitioned: boolean;
      readonly previousState: string | null;
      readonly detected: {
        readonly family: string;
        readonly variant: string;
        readonly reason: string;
        readonly matchedPhrase: string;
        readonly confidence: number;
      } | null;
    }> {
      const token = await input.tokenStore.readToken();
      if (!token) {
        throw new Error('Pair this desktop before recording a confirmation.');
      }

      const response = await fetchImpl(
        `${appUrl}/api/desktop/applications/confirm`,
        {
          body: JSON.stringify(record),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        },
      );
      const payload = await readJsonObject(response);

      if (!response.ok) {
        throw new Error(
          getString(payload, 'error') ?? `HTTP_${response.status}`,
        );
      }

      const detectedRaw = (payload as Record<string, unknown>).detected;
      const detected =
        detectedRaw &&
        typeof detectedRaw === 'object' &&
        !Array.isArray(detectedRaw)
          ? (() => {
              const detectedRecord = detectedRaw as Record<string, unknown>;
              return {
                confidence: Number(detectedRecord.confidence ?? 0),
                family: getString(detectedRecord, 'family') ?? '',
                matchedPhrase: getString(detectedRecord, 'matchedPhrase') ?? '',
                reason: getString(detectedRecord, 'reason') ?? '',
                variant: getString(detectedRecord, 'variant') ?? '',
              };
            })()
          : null;

      return {
        detected,
        previousState: getString(payload, 'previousState'),
        transitioned:
          (payload as Record<string, unknown>).transitioned === true,
      };
    },
    async markLeadUnavailable(record: {
      readonly applicationUrl?: string;
      readonly detectedPhrase?: string;
      readonly jobLeadId?: string;
      readonly jobListingId?: string;
      readonly reason:
        | 'http_404'
        | 'http_410'
        | 'closed_posting_copy'
        | 'closed_posting_marker'
        | 'embed_410'
        | 'embed_422'
        | 'unknown';
    }): Promise<{
      readonly previousStatus: string | null;
      readonly transitioned: boolean;
    }> {
      const token = await input.tokenStore.readToken();
      if (!token) {
        throw new Error('Pair this desktop before marking a lead unavailable.');
      }

      const response = await fetchImpl(
        `${appUrl}/api/desktop/applications/mark-unavailable`,
        {
          body: JSON.stringify(record),
          headers: {
            authorization: `Bearer ${token}`,
            'content-type': 'application/json',
          },
          method: 'POST',
        },
      );
      const payload = await readJsonObject(response);

      if (!response.ok) {
        throw new Error(
          getString(payload, 'error') ?? `HTTP_${response.status}`,
        );
      }

      return {
        previousStatus: getString(payload, 'previousStatus'),
        transitioned:
          (payload as Record<string, unknown>).transitioned === true,
      };
    },
    async tailorResumeForLead(record: { readonly leadId: string }): Promise<{
      readonly diffSummary: unknown;
      readonly emphasizedKeywords: readonly string[];
      readonly formats: {
        readonly docx: string;
        readonly html: string;
        readonly pdf: string;
        readonly txt: string;
      };
      readonly revisionId: string;
      readonly summary: string;
    }> {
      const token = await input.tokenStore.readToken();
      if (!token) {
        throw new Error('Pair this desktop before tailoring a resume.');
      }

      const response = await fetchImpl(`${appUrl}/api/desktop/resumes/tailor`, {
        body: JSON.stringify(record),
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
        },
        method: 'POST',
      });
      const payload = await readJsonObject(response);

      if (!response.ok) {
        throw new Error(
          getString(payload, 'error') ?? `HTTP_${response.status}`,
        );
      }

      const formatsRaw = (payload as Record<string, unknown>).formats;
      const formats =
        formatsRaw &&
        typeof formatsRaw === 'object' &&
        !Array.isArray(formatsRaw)
          ? (formatsRaw as Record<string, unknown>)
          : {};
      const keywordsRaw = (payload as Record<string, unknown>)
        .emphasizedKeywords;
      const emphasizedKeywords = Array.isArray(keywordsRaw)
        ? keywordsRaw.filter(
            (entry): entry is string => typeof entry === 'string',
          )
        : [];

      return {
        diffSummary: (payload as Record<string, unknown>).diffSummary,
        emphasizedKeywords,
        formats: {
          docx: getString(formats, 'docx') ?? '',
          html: getString(formats, 'html') ?? '',
          pdf: getString(formats, 'pdf') ?? '',
          txt: getString(formats, 'txt') ?? '',
        },
        revisionId: getString(payload, 'revisionId') ?? '',
        summary: getString(payload, 'summary') ?? '',
      };
    },
    async downloadResumeBytes(input: { readonly url: string }): Promise<{
      readonly base64: string;
      readonly contentType: string;
    }> {
      const response = await fetchImpl(input.url);
      if (!response.ok) {
        throw new Error(
          `Failed to download resume bytes: HTTP_${response.status}`,
        );
      }
      const bytes = Buffer.from(await response.arrayBuffer());
      return {
        base64: bytes.toString('base64'),
        contentType: response.headers.get('content-type') ?? 'application/pdf',
      };
    },
  };
}

async function downloadDefaultResume(input: {
  readonly fetchImpl: FetchLike;
  readonly resumeFileName: string;
  readonly resumeUrl: string;
}): Promise<string> {
  const response = await input.fetchImpl(input.resumeUrl);

  if (!response.ok) {
    throw new Error(
      `Failed to download default resume: HTTP_${response.status}`,
    );
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  const outputPath = path.join(
    os.tmpdir(),
    `gimme-job-${sanitizeFileName(input.resumeFileName)}`,
  );

  await writeFile(outputPath, bytes);

  return outputPath;
}

async function readJsonObject(
  response: Response,
): Promise<Record<string, unknown>> {
  const payload = (await response.json().catch(() => ({}))) as unknown;

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {};
  }

  return payload as Record<string, unknown>;
}

function getString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : null;
}

function getNullableString(
  payload: Record<string, unknown>,
  key: string,
): string | null {
  const value = payload[key];
  return typeof value === 'string' ? value : value === null ? null : null;
}

function readSubmitProfile(
  payload: Record<string, unknown>,
): DesktopSubmitProfile {
  const email = getString(payload, 'email');
  const firstName = getString(payload, 'firstName');
  const lastName = getString(payload, 'lastName');
  const phone = getString(payload, 'phone');
  const resumeFileName = getString(payload, 'resumeFileName');
  const resumeUrl = getString(payload, 'resumeUrl');
  const city = getNullableString(payload, 'city');
  const canadaWorkPreference = getNullableString(
    payload,
    'canadaWorkPreference',
  );
  const citizenshipStatus = getNullableString(payload, 'citizenshipStatus');
  const country = getNullableString(payload, 'country');
  const disabilityStatus = getNullableString(payload, 'disabilityStatus');
  const gender = getNullableString(payload, 'gender');
  const githubUrl = getNullableString(payload, 'githubUrl');
  const hispanicLatino = getNullableString(payload, 'hispanicLatino');
  const linkedinUrl = getNullableString(payload, 'linkedinUrl');
  const sponsorshipRequired = getNullableString(payload, 'sponsorshipRequired');
  const referralSource = getNullableString(payload, 'referralSource');
  const race = getNullableString(payload, 'race');
  const salaryExpectation = getNullableString(payload, 'salaryExpectation');
  const state = getNullableString(payload, 'state');
  const veteranStatus = getNullableString(payload, 'veteranStatus');
  const websiteUrl = getNullableString(payload, 'websiteUrl');
  const workAuthorization = getNullableString(payload, 'workAuthorization');

  if (
    !email ||
    !firstName ||
    !lastName ||
    !phone ||
    !resumeFileName ||
    !resumeUrl
  ) {
    throw new Error('INVALID_DESKTOP_PROFILE_RESPONSE');
  }

  return {
    canadaWorkPreference,
    city,
    citizenshipStatus,
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
    useOptimizedResumeOnSubmit: payload.useOptimizedResumeOnSubmit === true,
    veteranStatus,
    websiteUrl,
    workAuthorization,
  };
}

function readGreenhouseLead(
  payload: Record<string, unknown>,
  errorCode: string,
): DesktopRandomGreenhouseLead {
  const lead = readUnknownGreenhouseLead(payload);
  if (!lead) {
    throw new Error(errorCode);
  }
  return lead;
}

function readUnknownGreenhouseLead(
  value: unknown,
): DesktopRandomGreenhouseLead | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const applicationUrl = getString(payload, 'applicationUrl');
  const title = getString(payload, 'title');
  const jobListingId = getString(payload, 'jobListingId');

  if (!applicationUrl || !title || !jobListingId) {
    return null;
  }

  return {
    applicationUrl,
    company: getNullableString(payload, 'company'),
    jobLeadId: getNullableString(payload, 'jobLeadId') ?? undefined,
    jobListingId,
    location: getNullableString(payload, 'location'),
    source: getNullableString(payload, 'source'),
    title,
  };
}

function sanitizeFileName(fileName: string): string {
  const normalized = fileName
    .trim()
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return normalized || 'default-resume.pdf';
}
