import { writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
export function createDesktopSubmitClient(input) {
    const appUrl = input.appUrl.replace(/\/$/, '');
    const fetchImpl = input.fetchImpl ?? fetch;
    return {
        async syncProfileToIdentity() {
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
                throw new Error(getString(payload, 'error') ?? `HTTP_${response.status}`);
            }
            const profile = readSubmitProfile(payload);
            const resumeFilePath = await downloadDefaultResume({
                fetchImpl,
                resumeFileName: profile.resumeFileName,
                resumeUrl: profile.resumeUrl,
            });
            const writes = [
                ['first_name', profile.firstName],
                ['last_name', profile.lastName],
                ['email', profile.email],
                ['phone', profile.phone],
                ['resume_pdf_path', resumeFilePath],
            ];
            if (profile.city)
                writes.push(['city', profile.city]);
            if (profile.state)
                writes.push(['state', profile.state]);
            if (profile.country)
                writes.push(['country', profile.country]);
            if (profile.gender)
                writes.push(['gender', profile.gender]);
            if (profile.race)
                writes.push(['race_ethnicity', profile.race]);
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
            if (profile.githubUrl)
                writes.push(['github_url', profile.githubUrl]);
            if (profile.websiteUrl)
                writes.push(['website_url', profile.websiteUrl]);
            await Promise.all(writes.map(([key, value]) => input.identityStore.write(key, value)));
            return profile;
        },
        async lookupRecentVerificationCode(digits, options = {}) {
            const token = await input.tokenStore.readToken();
            if (!token)
                return null;
            const params = new URLSearchParams();
            if (typeof digits === 'number' && Number.isFinite(digits)) {
                params.set('digits', String(digits));
            }
            const queryString = params.toString();
            try {
                const response = await fetchImpl(`${appUrl}/api/desktop/verification-code${queryString ? `?${queryString}` : ''}`, {
                    headers: { authorization: `Bearer ${token}` },
                    method: 'GET',
                    signal: options.signal,
                });
                if (response.status === 404)
                    return null;
                if (!response.ok)
                    return null;
                const payload = await readJsonObject(response);
                const code = getString(payload, 'code');
                if (!code)
                    return null;
                const rawDigits = payload.digits;
                return {
                    code,
                    digits: typeof rawDigits === 'number' && Number.isFinite(rawDigits)
                        ? rawDigits
                        : code.length,
                    emailId: getString(payload, 'emailId') ?? '',
                    fromEmail: getString(payload, 'fromEmail') ?? '',
                    subject: getString(payload, 'subject') ?? '',
                };
            }
            catch {
                return null;
            }
        },
        async resolveUnknownFieldAnswer(query, options = {}) {
            // Trimmed-but-meaningful identifier for log lines so we can trace
            // which question failed without dumping the full prompt.
            const tag = query.question.slice(0, 60);
            const token = await input.tokenStore.readToken();
            if (!token) {
                console.warn(`[resolveUnknownFieldAnswer] "${tag}" skipped: no desktop token (pair the desktop first)`);
                return null;
            }
            let response;
            try {
                response = await fetchImpl(`${appUrl}/api/desktop/agent-chat/field-answer`, {
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
                });
            }
            catch (error) {
                // Network failure (web server down, DNS, TLS, abort, …). Surface
                // it loudly so the user can see why every field came back empty.
                console.error(`[resolveUnknownFieldAnswer] "${tag}" network error: ${error instanceof Error ? error.message : String(error)} (appUrl=${appUrl})`);
                return null;
            }
            let payload;
            try {
                payload = await readJsonObject(response);
            }
            catch (error) {
                console.error(`[resolveUnknownFieldAnswer] "${tag}" HTTP ${response.status}, payload not JSON: ${error instanceof Error ? error.message : String(error)}`);
                return null;
            }
            if (!response.ok) {
                // Surface the server's error body — this is where 401 (bad
                // token), 500 (LLM blew up), and 429 (quota) show up. Without
                // this the renderer just sees "empty answer".
                const serverError = typeof payload === 'object' && payload !== null
                    ? JSON.stringify(payload).slice(0, 240)
                    : String(payload).slice(0, 240);
                console.error(`[resolveUnknownFieldAnswer] "${tag}" HTTP ${response.status}: ${serverError}`);
                return null;
            }
            const payloadRecord = payload && typeof payload === 'object' && !Array.isArray(payload)
                ? payload
                : {};
            const answer = getString(payloadRecord, 'answer') ?? '';
            const confidenceRaw = getString(payloadRecord, 'confidence') ?? 'low';
            const reasoning = getString(payloadRecord, 'reasoning') ?? '';
            if (!answer.trim()) {
                // The resolver returned an empty answer (no rule, no
                // deterministic match, LLM declined to answer). Log so the user
                // can see the resolver's reasoning — usually points at a
                // missing profile field or an unmatched select option.
                console.warn(`[resolveUnknownFieldAnswer] "${tag}" empty answer (provider=${query.aiProvider ?? 'openai'}, reasoning=${reasoning.slice(0, 160)})`);
                return null;
            }
            const confidence = confidenceRaw === 'high' || confidenceRaw === 'medium'
                ? confidenceRaw
                : 'low';
            return { answer: answer.trim(), confidence, reasoning };
        },
        async recordFormSnapshot(record) {
            const token = await input.tokenStore.readToken();
            if (!token)
                return;
            try {
                await fetchImpl(`${appUrl}/api/desktop/agent-chat/form-snapshot`, {
                    body: JSON.stringify(record),
                    headers: {
                        authorization: `Bearer ${token}`,
                        'content-type': 'application/json',
                    },
                    method: 'POST',
                });
            }
            catch {
                // Non-fatal: the local file is still written even if the DB record fails.
            }
        },
        async fetchFieldRules() {
            const token = await input.tokenStore.readToken();
            if (!token)
                return [];
            try {
                const response = await fetchImpl(`${appUrl}/api/desktop/field-rules`, {
                    headers: { authorization: `Bearer ${token}` },
                    method: 'GET',
                });
                if (!response.ok)
                    return [];
                const payload = (await response.json().catch(() => ({})));
                return (payload.rules ?? [])
                    .filter((rule) => typeof rule === 'object' &&
                    rule !== null &&
                    typeof rule.question === 'string' &&
                    typeof rule.answer === 'string')
                    .map(rule => {
                    const sourceValue = rule.source;
                    const source = sourceValue === 'state-tab' || sourceValue === 'chat'
                        ? sourceValue
                        : 'manual';
                    return {
                        id: typeof rule.id === 'string'
                            ? rule.id
                            : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                        hostname: typeof rule.hostname === 'string' ? rule.hostname : null,
                        question: rule.question,
                        answer: rule.answer,
                        source,
                        createdAt: typeof rule.createdAt === 'string'
                            ? rule.createdAt
                            : new Date().toISOString(),
                    };
                });
            }
            catch {
                return [];
            }
        },
        async syncFieldRule(rule) {
            const token = await input.tokenStore.readToken();
            if (!token)
                return;
            try {
                await fetchImpl(`${appUrl}/api/desktop/field-rules`, {
                    body: JSON.stringify(rule),
                    headers: {
                        authorization: `Bearer ${token}`,
                        'content-type': 'application/json',
                    },
                    method: 'POST',
                });
            }
            catch {
                // Non-fatal: rule lives on disk; will retry on next add.
            }
        },
        async deleteFieldRule(id) {
            const token = await input.tokenStore.readToken();
            if (!token)
                return;
            try {
                await fetchImpl(`${appUrl}/api/desktop/field-rules?id=${encodeURIComponent(id)}`, {
                    headers: { authorization: `Bearer ${token}` },
                    method: 'DELETE',
                });
            }
            catch {
                // Non-fatal.
            }
        },
        async uploadRunLog(record) {
            const token = await input.tokenStore.readToken();
            if (!token)
                return;
            try {
                await fetchImpl(`${appUrl}/api/desktop/run-logs`, {
                    body: JSON.stringify(record),
                    headers: {
                        authorization: `Bearer ${token}`,
                        'content-type': 'application/json',
                    },
                    method: 'POST',
                });
            }
            catch {
                // Non-fatal: local file is still written even if upload fails.
            }
        },
        async recordTrainingFeedback(record) {
            const token = await input.tokenStore.readToken();
            if (!token)
                return;
            try {
                await fetchImpl(`${appUrl}/api/desktop/training-feedback`, {
                    body: JSON.stringify(record),
                    headers: {
                        authorization: `Bearer ${token}`,
                        'content-type': 'application/json',
                    },
                    method: 'POST',
                });
            }
            catch {
                // Non-fatal: training feedback failing shouldn't break the run.
            }
        },
        async pickRandomGreenhouseLead(query = {}) {
            const token = await input.tokenStore.readToken();
            if (!token) {
                throw new Error('Pair this desktop before selecting a random job.');
            }
            const params = new URLSearchParams();
            if (query.search?.trim())
                params.set('search', query.search.trim());
            if (query.location?.trim())
                params.set('location', query.location.trim());
            if (query.provider === 'any' || query.provider === 'greenhouse') {
                params.set('provider', query.provider);
            }
            if (query.providers && query.providers.length > 0) {
                params.set('providers', query.providers.join(','));
            }
            if (query.runtimeProviders && query.runtimeProviders.length > 0) {
                params.set('runtimeProviders', query.runtimeProviders.join(','));
            }
            if (query.remote)
                params.set('remote', 'true');
            if (query.excludeListingIds && query.excludeListingIds.length > 0) {
                params.set('excludeListingIds', query.excludeListingIds.join(','));
            }
            if (query.excludeCompanies && query.excludeCompanies.length > 0) {
                params.set('excludeCompanies', query.excludeCompanies.join(','));
            }
            const queryString = params.toString();
            const endpoint = query.provider === 'greenhouse'
                ? '/api/desktop/jobs/random-greenhouse'
                : '/api/desktop/jobs/random';
            const response = await fetchImpl(`${appUrl}${endpoint}${queryString ? `?${queryString}` : ''}`, {
                headers: { authorization: `Bearer ${token}` },
                method: 'GET',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                throw new Error(getString(payload, 'error') ?? `HTTP_${response.status}`);
            }
            return readGreenhouseLead(payload, 'INVALID_RANDOM_GREENHOUSE_RESPONSE');
        },
        async recordSubmittedApplication(record) {
            const token = await input.tokenStore.readToken();
            if (!token) {
                throw new Error('Pair this desktop before recording a submission.');
            }
            const response = await fetchImpl(`${appUrl}/api/desktop/applications/submitted`, {
                body: JSON.stringify(record),
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                method: 'POST',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                throw new Error(getString(payload, 'error') ?? `HTTP_${response.status}`);
            }
            const outcomeRaw = getString(payload, 'outcome');
            const outcome = outcomeRaw === 'applied' ||
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
        async checkSubmittedApplication(record) {
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
            const response = await fetchImpl(`${appUrl}/api/desktop/applications/submitted?${params.toString()}`, {
                headers: { authorization: `Bearer ${token}` },
                method: 'GET',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                throw new Error(getString(payload, 'error') ?? `HTTP_${response.status}`);
            }
            const reasonRaw = getString(payload, 'reason');
            const reason = reasonRaw === 'existing_submission' || reasonRaw === 'job_lead_applied'
                ? reasonRaw
                : null;
            return {
                alreadySubmitted: payload.alreadySubmitted === true,
                jobLeadId: getString(payload, 'jobLeadId'),
                reason,
                status: getString(payload, 'status'),
                submissionId: getString(payload, 'submissionId'),
                submittedAt: getString(payload, 'submittedAt'),
            };
        },
        async recordSubmissionConfirmation(record) {
            const token = await input.tokenStore.readToken();
            if (!token) {
                throw new Error('Pair this desktop before recording a confirmation.');
            }
            const response = await fetchImpl(`${appUrl}/api/desktop/applications/confirm`, {
                body: JSON.stringify(record),
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                method: 'POST',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                throw new Error(getString(payload, 'error') ?? `HTTP_${response.status}`);
            }
            const detectedRaw = payload.detected;
            const detected = detectedRaw &&
                typeof detectedRaw === 'object' &&
                !Array.isArray(detectedRaw)
                ? (() => {
                    const detectedRecord = detectedRaw;
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
                transitioned: payload.transitioned === true,
            };
        },
        async markLeadUnavailable(record) {
            const token = await input.tokenStore.readToken();
            if (!token) {
                throw new Error('Pair this desktop before marking a lead unavailable.');
            }
            const response = await fetchImpl(`${appUrl}/api/desktop/applications/mark-unavailable`, {
                body: JSON.stringify(record),
                headers: {
                    authorization: `Bearer ${token}`,
                    'content-type': 'application/json',
                },
                method: 'POST',
            });
            const payload = await readJsonObject(response);
            if (!response.ok) {
                throw new Error(getString(payload, 'error') ?? `HTTP_${response.status}`);
            }
            return {
                previousStatus: getString(payload, 'previousStatus'),
                transitioned: payload.transitioned === true,
            };
        },
        async tailorResumeForLead(record) {
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
                throw new Error(getString(payload, 'error') ?? `HTTP_${response.status}`);
            }
            const formatsRaw = payload.formats;
            const formats = formatsRaw &&
                typeof formatsRaw === 'object' &&
                !Array.isArray(formatsRaw)
                ? formatsRaw
                : {};
            const keywordsRaw = payload
                .emphasizedKeywords;
            const emphasizedKeywords = Array.isArray(keywordsRaw)
                ? keywordsRaw.filter((entry) => typeof entry === 'string')
                : [];
            return {
                diffSummary: payload.diffSummary,
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
        async downloadResumeBytes(input) {
            const response = await fetchImpl(input.url);
            if (!response.ok) {
                throw new Error(`Failed to download resume bytes: HTTP_${response.status}`);
            }
            const bytes = Buffer.from(await response.arrayBuffer());
            return {
                base64: bytes.toString('base64'),
                contentType: response.headers.get('content-type') ?? 'application/pdf',
            };
        },
    };
}
async function downloadDefaultResume(input) {
    const response = await input.fetchImpl(input.resumeUrl);
    if (!response.ok) {
        throw new Error(`Failed to download default resume: HTTP_${response.status}`);
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const outputPath = path.join(os.tmpdir(), `gimme-job-${sanitizeFileName(input.resumeFileName)}`);
    await writeFile(outputPath, bytes);
    return outputPath;
}
async function readJsonObject(response) {
    const payload = (await response.json().catch(() => ({})));
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {};
    }
    return payload;
}
function getString(payload, key) {
    const value = payload[key];
    return typeof value === 'string' ? value : null;
}
function getNullableString(payload, key) {
    const value = payload[key];
    return typeof value === 'string' ? value : value === null ? null : null;
}
function readSubmitProfile(payload) {
    const email = getString(payload, 'email');
    const firstName = getString(payload, 'firstName');
    const lastName = getString(payload, 'lastName');
    const phone = getString(payload, 'phone');
    const resumeFileName = getString(payload, 'resumeFileName');
    const resumeUrl = getString(payload, 'resumeUrl');
    const city = getNullableString(payload, 'city');
    const canadaWorkPreference = getNullableString(payload, 'canadaWorkPreference');
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
    if (!email ||
        !firstName ||
        !lastName ||
        !phone ||
        !resumeFileName ||
        !resumeUrl) {
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
function readGreenhouseLead(payload, errorCode) {
    const lead = readUnknownGreenhouseLead(payload);
    if (!lead) {
        throw new Error(errorCode);
    }
    return lead;
}
function readUnknownGreenhouseLead(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    const payload = value;
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
function sanitizeFileName(fileName) {
    const normalized = fileName
        .trim()
        .replace(/[^\w.-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    return normalized || 'default-resume.pdf';
}
