export const DESKTOP_SUBMIT_IPC_CHANNELS = {
    cancelRun: 'desktop-submit:cancel-run',
    pickRandomGreenhouseLead: 'desktop-submit:pick-random-greenhouse-lead',
    recordManualSubmit: 'desktop-submit:record-manual-submit',
    runLead: 'desktop-submit:run-lead',
    runSmokeTest: 'desktop-submit:run-smoke-test',
    cancelSmokeTest: 'desktop-submit:cancel-smoke-test',
    swapAssistResumeFile: 'desktop-submit:swap-assist-resume-file',
    tailorResumeForLead: 'desktop-submit:tailor-resume-for-lead',
};
export const DESKTOP_SUBMIT_IPC_EVENTS = {
    smokeProgress: 'desktop-submit-event:smoke-progress',
};
export function registerDesktopSubmitIpc(ipcMain, runner) {
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.pickRandomGreenhouseLead, (_event, request) => runner.pickRandomGreenhouseLead(parseGreenhouseLeadFilterRequest(request)));
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.runLead, (_event, request) => runner.runLead(parseSubmitLeadRequest(request)));
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.cancelRun, () => runner.cancelRun());
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.recordManualSubmit, (_event, request) => runner.recordManualSubmit(parseRecordManualSubmitRequest(request)));
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.tailorResumeForLead, async (_event, request) => {
        if (!runner.tailorResumeForLead) {
            throw new Error('Resume tailoring is not supported in this runtime.');
        }
        return runner.tailorResumeForLead(parseTailorResumeRequest(request));
    });
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.swapAssistResumeFile, async (_event, request) => {
        if (!runner.swapAssistResumeFile) {
            throw new Error('Resume swap is not supported in this runtime.');
        }
        return runner.swapAssistResumeFile(parseSwapAssistResumeFileRequest(request));
    });
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.runSmokeTest, async (_event, request) => {
        if (!runner.runSmokeTest) {
            throw new Error('Smoke testing is not supported in this runtime.');
        }
        return runner.runSmokeTest(parseSmokeTestRequest(request));
    });
    ipcMain.handle(DESKTOP_SUBMIT_IPC_CHANNELS.cancelSmokeTest, async () => {
        if (!runner.cancelSmokeTest)
            return { cancelled: false };
        return runner.cancelSmokeTest();
    });
}
function parseSmokeTestRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Smoke test request must be an object.');
    }
    const record = value;
    if (typeof record.runtimeProviderId !== 'string' ||
        !record.runtimeProviderId.trim()) {
        throw new Error('runtimeProviderId is required.');
    }
    const rawCount = record.count;
    const count = typeof rawCount === 'number' && Number.isFinite(rawCount)
        ? Math.max(1, Math.min(20, Math.floor(rawCount)))
        : 5;
    const excludeListingIds = Array.isArray(record.excludeListingIds)
        ? record.excludeListingIds
            .filter((id) => typeof id === 'string')
            .map(id => id.trim())
            .filter(Boolean)
        : undefined;
    const excludeCompanies = Array.isArray(record.excludeCompanies)
        ? record.excludeCompanies
            .filter((c) => typeof c === 'string')
            .map(c => c.trim())
            .filter(Boolean)
        : undefined;
    return {
        count,
        excludeCompanies,
        excludeListingIds,
        runtimeProviderId: record.runtimeProviderId.trim().toLowerCase(),
    };
}
function parseTailorResumeRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Tailor resume request must be an object.');
    }
    const record = value;
    if (typeof record.leadId !== 'string' || !record.leadId.trim()) {
        throw new Error('leadId is required.');
    }
    return { leadId: record.leadId.trim() };
}
function parseSwapAssistResumeFileRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Swap resume file request must be an object.');
    }
    const record = value;
    const pdfUrl = readRequiredHttpUrl(record.pdfUrl);
    const fileName = typeof record.fileName === 'string' && record.fileName.trim()
        ? record.fileName.trim()
        : 'tailored-resume.pdf';
    return { fileName, pdfUrl };
}
function parseRecordManualSubmitRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Manual submit record request must be an object.');
    }
    const record = value;
    const applicationUrl = readRequiredHttpUrl(record.applicationUrl);
    const jobLeadId = typeof record.jobLeadId === 'string' && record.jobLeadId.trim()
        ? record.jobLeadId.trim()
        : undefined;
    const message = typeof record.message === 'string' ? record.message : undefined;
    const toolCallCount = typeof record.toolCallCount === 'number' &&
        Number.isFinite(record.toolCallCount) &&
        record.toolCallCount >= 0
        ? Math.floor(record.toolCallCount)
        : undefined;
    return { applicationUrl, jobLeadId, message, toolCallCount };
}
function parseSubmitLeadRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Submit lead request must be an object.');
    }
    const record = value;
    const applicationUrl = readRequiredHttpUrl(record.applicationUrl);
    const mode = readMode(record.mode);
    const jobLeadId = typeof record.jobLeadId === 'string' && record.jobLeadId.trim()
        ? record.jobLeadId.trim()
        : undefined;
    const jobListingId = typeof record.jobListingId === 'string' && record.jobListingId.trim()
        ? record.jobListingId.trim()
        : undefined;
    const continueFromCurrentPage = record.continueFromCurrentPage === true;
    const aiProvider = record.aiProvider === 'ollama' || record.aiProvider === 'openai'
        ? record.aiProvider
        : undefined;
    return {
        aiProvider,
        applicationUrl,
        continueFromCurrentPage,
        jobLeadId,
        jobListingId,
        mode,
    };
}
function readRequiredHttpUrl(value) {
    if (typeof value !== 'string') {
        throw new Error('Application URL is required.');
    }
    const trimmed = value.trim();
    try {
        const url = new URL(trimmed);
        if (url.protocol !== 'http:' && url.protocol !== 'https:') {
            throw new Error('Application URL must be an http(s) URL.');
        }
        return url.toString();
    }
    catch (error) {
        if (error instanceof Error && error.message.includes('http(s)')) {
            throw error;
        }
        throw new Error('Application URL must be a valid URL.');
    }
}
function readMode(value) {
    if (value === 'training' || value === 'submit')
        return value;
    throw new Error('Submit mode must be training or submit.');
}
function parseGreenhouseLeadFilterRequest(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    const record = value;
    return {
        location: typeof record.location === 'string' ? record.location.trim() : undefined,
        provider: record.provider === 'any' || record.provider === 'greenhouse'
            ? record.provider
            : undefined,
        providers: Array.isArray(record.providers)
            ? record.providers
                .filter((provider) => typeof provider === 'string')
                .map(provider => provider.trim())
                .filter(Boolean)
            : undefined,
        runtimeProviders: Array.isArray(record.runtimeProviders)
            ? record.runtimeProviders
                .filter((id) => typeof id === 'string')
                .map(id => id.trim().toLowerCase())
                .filter(Boolean)
            : undefined,
        remote: record.remote === true,
        search: typeof record.search === 'string' ? record.search.trim() : undefined,
    };
}
