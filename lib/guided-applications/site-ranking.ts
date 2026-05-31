'use server';

import { db } from '@/lib/db/client';

export interface ApplyOption {
  link: string;
  method?: string;
  buttonText?: string;
  title?: string;
}

export interface RankedApplyOption extends ApplyOption {
  rank: number;
  score: number;
  atsName: string | null;
  difficulty: string | null;
  successRate: number | null;
  hostname: string | null;
  hostnameSampleCount: number;
  hostnameSuccessRate: number | null;
  isRecommended: boolean;
  reasoning: string[];
}

export interface SiteRankingResult {
  rankedOptions: RankedApplyOption[];
  bestOption: RankedApplyOption | null;
  hasKnownATS: boolean;
}

const DIFFICULTY_SCORES: Record<string, number> = {
  Easy: 100,
  Medium: 70,
  Hard: 40,
  Unknown: 50,
};

const ATS_BASE_SCORES: Record<string, number> = {
  Greenhouse: 95,
  Lever: 90,
  Ashby: 88,
  Workable: 85,
  SmartRecruiters: 82,
  BambooHR: 80,
  JazzHR: 75,
  Pinpoint: 75,
  Manatal: 70,
  'Trakstar Hire': 70,
  iCIMS: 60,
  Workday: 55,
  Taleo: 45,
  Unknown: 30,
};

const HIGH_BOT_PROTECTION_HOST_PATTERNS = [
  'google.com',
  'googleapis.com',
  'gstatic.com',
  'linkedin.com',
  'indeed.com',
  'glassdoor.com',
  'ziprecruiter.com',
  'monster.com',
  'simplyhired.com',
];

const extractHostname = (url: string): string | null => {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
};

const isHighBotProtectionHost = (hostname: string | null): boolean => {
  if (!hostname) return false;
  return HIGH_BOT_PROTECTION_HOST_PATTERNS.some(
    pattern => hostname === pattern || hostname.endsWith(`.${pattern}`),
  );
};

const getHostnameSuccessMetrics = async (
  hostname: string | null,
): Promise<{ successRate: number | null; totalAttempts: number }> => {
  if (!hostname) {
    return { successRate: null, totalAttempts: 0 };
  }

  const rows = await db.aTSFieldObservation.findMany({
    select: { observationCount: true, success: true },
    where: {
      action: 'continue',
      hostname,
    },
  });

  if (rows.length === 0) {
    return { successRate: null, totalAttempts: 0 };
  }

  const totalAttempts = rows.reduce(
    (sum, row) => sum + Math.max(row.observationCount || 1, 1),
    0,
  );
  if (totalAttempts === 0) {
    return { successRate: null, totalAttempts: 0 };
  }

  const successfulAttempts = rows
    .filter(row => row.success)
    .reduce((sum, row) => sum + Math.max(row.observationCount || 1, 1), 0);

  return {
    successRate: successfulAttempts / totalAttempts,
    totalAttempts,
  };
};

/**
 * Detect ATS system from a URL by checking against known patterns
 */
export async function detectATSFromUrl(url: string): Promise<{
  atsName: string | null;
  atsSystem: Awaited<ReturnType<typeof db.aTSSystem.findFirst>> | null;
  confidence: number;
}> {
  if (!url) {
    return { atsName: null, atsSystem: null, confidence: 0 };
  }

  const normalizedUrl = url.toLowerCase();

  // Try to find matching ATS system from database
  const atsSystems = await db.aTSSystem.findMany({
    orderBy: { totalAnalyzed: 'desc' },
  });

  for (const ats of atsSystems) {
    // Check domain patterns
    if (ats.detectedDomain && normalizedUrl.includes(ats.detectedDomain)) {
      return { atsName: ats.name, atsSystem: ats, confidence: 95 };
    }

    for (const pattern of ats.domainPatterns) {
      if (normalizedUrl.includes(pattern.toLowerCase())) {
        return { atsName: ats.name, atsSystem: ats, confidence: 90 };
      }
    }

    // Check unique identifiers
    const identifiers = ats.uniqueIdentifiers as Record<string, any>;
    if (identifiers?.domain && normalizedUrl.includes(identifiers.domain)) {
      return { atsName: ats.name, atsSystem: ats, confidence: 85 };
    }
  }

  // Fallback to pattern matching for common ATS
  const commonPatterns: Array<{ pattern: string; name: string }> = [
    { pattern: 'greenhouse.io', name: 'Greenhouse' },
    { pattern: 'boards.greenhouse.io', name: 'Greenhouse' },
    { pattern: 'lever.co', name: 'Lever' },
    { pattern: 'jobs.lever.co', name: 'Lever' },
    { pattern: 'myworkdayjobs.com', name: 'Workday' },
    { pattern: 'workday.com', name: 'Workday' },
    { pattern: 'taleo.net', name: 'Taleo' },
    { pattern: 'icims.com', name: 'iCIMS' },
    { pattern: 'bamboohr.com', name: 'BambooHR' },
    { pattern: 'smartrecruiters.com', name: 'SmartRecruiters' },
    { pattern: 'workable.com', name: 'Workable' },
    { pattern: 'ashbyhq.com', name: 'Ashby' },
    { pattern: 'pinpointhq.com', name: 'Pinpoint' },
    { pattern: 'jazz.co', name: 'JazzHR' },
    { pattern: 'applytojob.com', name: 'JazzHR' },
    { pattern: 'manatal.com', name: 'Manatal' },
    { pattern: 'trakstar.com', name: 'Trakstar Hire' },
    { pattern: 'recruiterbox.com', name: 'Trakstar Hire' },
  ];

  for (const { pattern, name } of commonPatterns) {
    if (normalizedUrl.includes(pattern)) {
      // Try to find the ATS system in database for additional data
      const atsSystem = atsSystems.find(ats => ats.name === name);
      return { atsName: name, atsSystem: atsSystem || null, confidence: 80 };
    }
  }

  return { atsName: null, atsSystem: null, confidence: 0 };
}

/**
 * Calculate a score for an apply option based on ATS knowledge
 */
function calculateOptionScore(
  option: ApplyOption,
  atsName: string | null,
  atsSystem: Awaited<ReturnType<typeof db.aTSSystem.findFirst>> | null,
): { score: number; reasoning: string[] } {
  const reasoning: string[] = [];
  let score = 50; // Base score

  if (!atsName) {
    reasoning.push('Unknown application system - manual review recommended');
    return { score: 30, reasoning };
  }

  // Add ATS base score
  const atsBaseScore = ATS_BASE_SCORES[atsName] || ATS_BASE_SCORES.Unknown;
  score = atsBaseScore;
  reasoning.push(`${atsName} ATS detected (base score: ${atsBaseScore})`);

  if (atsSystem) {
    // Adjust based on difficulty
    if (atsSystem.difficulty) {
      const difficultyScore = DIFFICULTY_SCORES[atsSystem.difficulty] || 50;
      const difficultyBonus = (difficultyScore - 50) / 5;
      score += difficultyBonus;
      reasoning.push(`Difficulty: ${atsSystem.difficulty}`);
    }

    // Adjust based on success rate
    if (atsSystem.successRate !== null && atsSystem.successRate > 0) {
      const successBonus = atsSystem.successRate * 10;
      score += successBonus;
      reasoning.push(
        `Historical success rate: ${(atsSystem.successRate * 100).toFixed(0)}%`,
      );
    }

    // Adjust based on analysis count (more analysis = more reliable data)
    if (atsSystem.totalAnalyzed > 10) {
      score += 5;
      reasoning.push(
        `Well-analyzed system (${atsSystem.totalAnalyzed} samples)`,
      );
    }

    // Penalize multi-step applications
    if (
      atsSystem.isMultiStep &&
      atsSystem.stepCount &&
      atsSystem.stepCount > 3
    ) {
      score -= 10;
      reasoning.push(`Multi-step application (${atsSystem.stepCount} steps)`);
    }

    // Add nuances as context
    if (atsSystem.nuances && atsSystem.nuances.length > 0) {
      reasoning.push(...atsSystem.nuances.slice(0, 2));
    }
  }

  // Cap score at 100
  return { score: Math.min(Math.max(score, 0), 100), reasoning };
}

/**
 * Rank apply options based on ATS knowledge and success likelihood
 */
export async function rankApplyOptions(
  options: ApplyOption[],
): Promise<SiteRankingResult> {
  if (!options || options.length === 0) {
    return {
      rankedOptions: [],
      bestOption: null,
      hasKnownATS: false,
    };
  }

  const rankedOptions: RankedApplyOption[] = [];
  let hasKnownATS = false;
  const hostnameMetricsCache = new Map<
    string,
    { successRate: number | null; totalAttempts: number }
  >();

  for (const option of options) {
    const { atsName, atsSystem, confidence } = await detectATSFromUrl(
      option.link,
    );
    const hostname = extractHostname(option.link);
    const hostnameMetrics = hostname
      ? (hostnameMetricsCache.get(hostname) ??
        (await getHostnameSuccessMetrics(hostname)))
      : { successRate: null, totalAttempts: 0 };
    if (hostname && !hostnameMetricsCache.has(hostname)) {
      hostnameMetricsCache.set(hostname, hostnameMetrics);
    }

    if (atsName) {
      hasKnownATS = true;
    }

    const { score, reasoning } = calculateOptionScore(
      option,
      atsName,
      atsSystem,
    );
    let adjustedScore = score;

    if (isHighBotProtectionHost(hostname)) {
      adjustedScore -= 35;
      reasoning.push(
        'Penalized high bot-protection host (Google/LinkedIn/Indeed/Glassdoor family)',
      );
    } else if (hostname) {
      adjustedScore += 8;
      reasoning.push(
        'Preferred non-mainstream host for better automation odds',
      );
    }

    if (
      hostnameMetrics.successRate !== null &&
      hostnameMetrics.totalAttempts >= 3
    ) {
      const empiricalAdjustment = (hostnameMetrics.successRate - 0.5) * 50;
      adjustedScore += empiricalAdjustment;
      reasoning.push(
        `Hostname completion rate: ${(hostnameMetrics.successRate * 100).toFixed(0)}% (${hostnameMetrics.totalAttempts} samples)`,
      );
    } else if (hostnameMetrics.totalAttempts > 0) {
      reasoning.push(
        `Limited hostname history (${hostnameMetrics.totalAttempts} samples)`,
      );
    }

    rankedOptions.push({
      ...option,
      rank: 0, // Will be set after sorting
      score: Math.min(Math.max(adjustedScore, 0), 100),
      atsName,
      difficulty: atsSystem?.difficulty || null,
      successRate: atsSystem?.successRate || null,
      hostname,
      hostnameSampleCount: hostnameMetrics.totalAttempts,
      hostnameSuccessRate: hostnameMetrics.successRate,
      isRecommended: false, // Will be set after sorting
      reasoning,
    });
  }

  // Sort by score descending
  rankedOptions.sort((a, b) => b.score - a.score);

  // Assign ranks and mark recommended
  rankedOptions.forEach((option, index) => {
    option.rank = index + 1;
    if (index === 0) {
      option.isRecommended = true;
    }
  });

  return {
    rankedOptions,
    bestOption: rankedOptions[0] || null,
    hasKnownATS,
  };
}

/**
 * Get the best apply option from a job listing's apply options
 */
export async function getBestApplyOption(
  applyOptions: unknown,
): Promise<RankedApplyOption | null> {
  if (!applyOptions) {
    return null;
  }

  let options: ApplyOption[] = [];

  // Handle different applyOptions formats
  if (Array.isArray(applyOptions)) {
    options = applyOptions.map(opt => ({
      link: (opt as any).link || (opt as any).url || '',
      method: (opt as any).method,
      buttonText: (opt as any).buttonText,
      title: (opt as any).title,
    }));
  } else if (typeof applyOptions === 'object' && applyOptions !== null) {
    const opt = applyOptions as any;
    if (opt.applyUrl || opt.link || opt.url) {
      options = [
        {
          link: opt.applyUrl || opt.link || opt.url,
          method: opt.method,
          buttonText: opt.buttonText,
          title: opt.title,
        },
      ];
    }
  }

  if (options.length === 0) {
    return null;
  }

  const { bestOption } = await rankApplyOptions(options);
  return bestOption;
}

/**
 * Get ATS knowledge for a specific URL
 */
export async function getATSKnowledge(url: string): Promise<{
  atsName: string | null;
  difficulty: string | null;
  stepCount: number | null;
  nuances: string[];
  recommendedApproach: string | null;
  isSupported: boolean;
}> {
  const { atsName, atsSystem } = await detectATSFromUrl(url);

  if (!atsSystem) {
    return {
      atsName,
      difficulty: null,
      stepCount: null,
      nuances: [],
      recommendedApproach: null,
      isSupported: atsName !== null,
    };
  }

  return {
    atsName: atsSystem.name,
    difficulty: atsSystem.difficulty,
    stepCount: atsSystem.stepCount,
    nuances: atsSystem.nuances,
    recommendedApproach: atsSystem.aiRecommendedApproach,
    isSupported: true,
  };
}
