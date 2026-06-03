export const DESKTOP_RUNTIME_PROVIDERS = [
    {
        id: 'greenhouse',
        label: 'Greenhouse',
        readiness: 'production',
        runner: 'greenhouse',
        patterns: [
            /(?:^|\.)boards\.greenhouse\.io$/i,
            /(?:^|\.)job-boards\.greenhouse\.io$/i,
            /\bgh_jid=/i,
        ],
    },
    {
        id: 'ashby',
        label: 'Ashby',
        readiness: 'production',
        runner: 'ashby',
        patterns: [/(?:^|\.)(?:jobs|job-boards)\.ashbyhq\.com$/i],
    },
    {
        id: 'lever',
        label: 'Lever',
        readiness: 'production',
        runner: 'lever',
        patterns: [/(?:^|\.)jobs\.lever\.co$/i],
    },
    {
        id: 'workable',
        label: 'Workable',
        readiness: 'production',
        runner: 'workable',
        patterns: [/(?:^|\.)apply\.workable\.com$/i, /workable\.com\/jobs/i],
    },
    {
        id: 'smartrecruiters',
        label: 'SmartRecruiters',
        readiness: 'production',
        runner: 'smartrecruiters',
        patterns: [/(?:^|\.)jobs\.smartrecruiters\.com$/i],
    },
    {
        id: 'recruitee',
        label: 'Recruitee',
        readiness: 'production',
        runner: 'recruitee',
        patterns: [/(?:^|\.)apply\.recruitee\.com$/i, /\.recruitee\.com\/o\//i],
    },
    {
        id: 'teamtailor',
        label: 'Teamtailor',
        readiness: 'production',
        runner: 'teamtailor',
        patterns: [/(?:^|\.)teamtailor\.com$/i],
    },
    {
        id: 'jobvite',
        label: 'Jobvite',
        readiness: 'production',
        runner: 'jobvite',
        patterns: [/(?:^|\.)(?:jobs|careers)\.jobvite\.com$/i],
    },
    {
        id: 'bamboohr',
        label: 'BambooHR',
        readiness: 'production',
        runner: 'bamboohr',
        patterns: [/\.bamboohr\.com\/(?:careers|jobs)/i],
    },
    {
        id: 'personio',
        label: 'Personio',
        readiness: 'production',
        runner: 'personio',
        patterns: [/(?:^|\.)jobs\.personio\.com$/i],
    },
    {
        id: 'breezy',
        label: 'BreezyHR',
        readiness: 'production',
        runner: 'breezy',
        patterns: [/(?:^|\.)breezy\.hr$/i],
    },
    {
        id: 'workday',
        label: 'Workday',
        readiness: 'manual_review',
        runner: 'workday',
        patterns: [/(?:^|\.)myworkdayjobs\.com$/i],
    },
    {
        id: 'icims',
        label: 'iCIMS',
        readiness: 'beta',
        runner: 'icims',
        patterns: [/(?:^|\.)icims\.com$/i],
    },
    {
        id: 'taleo',
        label: 'Taleo',
        readiness: 'beta',
        runner: 'taleo',
        patterns: [/(?:^|\.)taleo\.net$/i, /tbe\.taleo\.net/i, /taleocloud\.com/i],
    },
];
export const UNSUPPORTED_RUNTIME_PROVIDER = {
    id: 'unsupported',
    label: 'Unsupported',
    readiness: 'unsupported',
    runner: null,
    patterns: [],
};
export function getRuntimeProviderForUrl(url) {
    const candidates = getProviderMatchCandidates(url);
    if (!candidates)
        return UNSUPPORTED_RUNTIME_PROVIDER;
    return (DESKTOP_RUNTIME_PROVIDERS.find(provider => provider.patterns.some(pattern => candidates.some(candidate => pattern.test(candidate)))) ?? UNSUPPORTED_RUNTIME_PROVIDER);
}
function getProviderMatchCandidates(url) {
    try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        return [
            hostname,
            `${hostname}${parsed.pathname}${parsed.search}${parsed.hash}`,
        ];
    }
    catch {
        return null;
    }
}
export function shouldBlockAutopilotForProvider(provider, mode = 'submit') {
    if (mode === 'training')
        return false;
    return (provider.readiness === 'unsupported' ||
        provider.readiness === 'manual_review');
}
