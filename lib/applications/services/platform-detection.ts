import { JobProvider } from '@/generated/prisma/browser';

export interface PlatformDetectionResult {
  platform: JobProvider;
  confidence: number;
  indicators: string[];
  metadata?: Record<string, any>;
}

export interface PlatformPattern {
  domains: string[];
  urlPatterns: string[];
  contentPatterns?: string[];
  priority: number;
}

// Platform detection patterns ordered by specificity and reliability
const PLATFORM_PATTERNS: Partial<Record<JobProvider, PlatformPattern>> = {
  [JobProvider.LINKEDIN]: {
    domains: ['linkedin.com', 'www.linkedin.com'],
    urlPatterns: ['/jobs/', '/in/', 'linkedin.com/jobs'],
    contentPatterns: ['linkedin', 'professional network'],
    priority: 100,
  },
  [JobProvider.INDEED]: {
    domains: ['indeed.com', 'www.indeed.com', 'indeed.ca', 'indeed.co.uk'],
    urlPatterns: ['/viewjob', '/jobs/', 'indeed.com'],
    contentPatterns: ['indeed', 'job search'],
    priority: 100,
  },
  [JobProvider.GLASSDOOR]: {
    domains: ['glassdoor.com', 'www.glassdoor.com', 'glassdoor.ca'],
    urlPatterns: ['/job-listing/', '/jobs/', '/partner/jobListing'],
    contentPatterns: ['glassdoor', 'company reviews'],
    priority: 100,
  },
  [JobProvider.ZIPRECRUITER]: {
    domains: ['ziprecruiter.com', 'www.ziprecruiter.com'],
    urlPatterns: ['/jobs/', '/c/', '/candidate'],
    contentPatterns: ['ziprecruiter', 'quick apply'],
    priority: 100,
  },
  [JobProvider.ANGELLIST]: {
    domains: ['angel.co', 'www.angel.co'],
    urlPatterns: ['/company/', '/jobs/', '/l/'],
    contentPatterns: ['angellist', 'startup jobs'],
    priority: 100,
  },
  [JobProvider.WELLFOUND]: {
    domains: ['wellfound.com', 'www.wellfound.com'],
    urlPatterns: ['/company/', '/jobs/', '/l/'],
    contentPatterns: ['wellfound', 'startup jobs'],
    priority: 100,
  },
  [JobProvider.MONSTER]: {
    domains: ['monster.com', 'www.monster.com'],
    urlPatterns: ['/jobs/', '/job-openings/', '/monster'],
    contentPatterns: ['monster', 'job search'],
    priority: 90,
  },
  [JobProvider.DICE]: {
    domains: ['dice.com', 'www.dice.com'],
    urlPatterns: ['/jobs/', '/job/', '/dice'],
    contentPatterns: ['dice', 'tech jobs'],
    priority: 90,
  },
  [JobProvider.CAREER_BUILDER]: {
    domains: ['careerbuilder.com', 'www.careerbuilder.com'],
    urlPatterns: ['/job/', '/jobs/', '/careerbuilder'],
    contentPatterns: ['careerbuilder', 'career'],
    priority: 90,
  },
  [JobProvider.FLEXJOBS]: {
    domains: ['flexjobs.com', 'www.flexjobs.com'],
    urlPatterns: ['/jobs/', '/remote-jobs/'],
    contentPatterns: ['flexjobs', 'remote work', 'flexible'],
    priority: 90,
  },
  [JobProvider.REMOTE_OK]: {
    domains: ['remoteok.io', 'remoteok.com'],
    urlPatterns: ['/remote-jobs/', '/'],
    contentPatterns: ['remote ok', 'remote work'],
    priority: 85,
  },
  [JobProvider.WE_WORK_REMOTELY]: {
    domains: ['weworkremotely.com'],
    urlPatterns: ['/remote-jobs/', '/categories/'],
    contentPatterns: ['we work remotely', 'remote'],
    priority: 85,
  },
  [JobProvider.COMPANY_DIRECT]: {
    domains: [], // Will be determined by exclusion
    urlPatterns: ['/careers/', '/jobs/', '/opportunities/', '/apply/'],
    contentPatterns: ['careers', 'join our team', 'work with us'],
    priority: 10, // Lowest priority - catch-all
  },
  [JobProvider.OTHER]: {
    domains: [],
    urlPatterns: [],
    contentPatterns: [],
    priority: 1, // Absolute lowest
  },
};

// Common ATS detection patterns for company direct applications
const ATS_INDICATORS = {
  workday: ['myworkdayjobs.com', '/workday/', 'workday-application'],
  greenhouse: ['greenhouse.io', '/boards/', 'greenhouse-application'],
  lever: ['jobs.lever.co', '/lever/', 'lever-application'],
  ashby: [
    'ashbyhq.com',
    'jobs.ashbyhq.com',
    '/posting-api/job-board/',
    'ashby-application',
  ],
  bamboohr: ['bamboohr.com', '/bamboohr/', 'bamboo-application'],
  jobvite: ['jobvite.com', '/jobvite/', 'jobvite-application'],
  smartrecruiters: ['smartrecruiters.com', '/smartrecruiters/', 'smartrecruiters-form'],
  icims: ['icims.com', '/icims/', 'iCIMS'],
  taleo: ['taleo.net', '/taleo/', 'taleo-application'],
  successfactors: ['successfactors.com', '/sf/', 'successfactors'],
  cornerstone: ['csod.com', '/cornerstone/', 'cornerstone-application'],
} as const;

export type AtsAutomationPosture = 'ALLOWED' | 'GRAY' | 'FORBIDDEN';
export type AtsFamily = keyof typeof ATS_INDICATORS;

export interface AtsFamilyDetectionInput {
  content?: string | null;
  jobProvider?: JobProvider | null;
  url?: string | null;
}

export interface AtsFamilyDetectionResult {
  confidence: number;
  family: AtsFamily | null;
  indicators: string[];
  posture: AtsAutomationPosture | null;
}

export const ATS_AUTOMATION_POSTURE: Record<AtsFamily, AtsAutomationPosture> = {
  ashby: 'GRAY',
  bamboohr: 'GRAY',
  cornerstone: 'GRAY',
  greenhouse: 'GRAY',
  icims: 'GRAY',
  jobvite: 'GRAY',
  lever: 'GRAY',
  smartrecruiters: 'GRAY',
  successfactors: 'GRAY',
  taleo: 'GRAY',
  workday: 'GRAY',
};

const ATS_FAMILY_BY_JOB_PROVIDER: Partial<Record<JobProvider, AtsFamily>> = {
  [JobProvider.ASHBY]: 'ashby',
  [JobProvider.GREENHOUSE]: 'greenhouse',
  [JobProvider.LEVER]: 'lever',
  [JobProvider.SMART_RECRUITERS]: 'smartrecruiters',
};

export function classifyAtsFamily({
  content,
  jobProvider,
  url,
}: AtsFamilyDetectionInput): AtsFamilyDetectionResult {
  const providerFamily = jobProvider
    ? ATS_FAMILY_BY_JOB_PROVIDER[jobProvider]
    : null;
  if (providerFamily) {
    return {
      confidence: 100,
      family: providerFamily,
      indicators: [`Job provider: ${jobProvider}`],
      posture: ATS_AUTOMATION_POSTURE[providerFamily],
    };
  }

  const normalizedUrl = url?.toLowerCase().trim() ?? '';
  const normalizedContent = content?.toLowerCase() ?? '';

  for (const [family, patterns] of Object.entries(ATS_INDICATORS) as Array<
    [AtsFamily, readonly string[]]
  >) {
    for (const pattern of patterns) {
      const normalizedPattern = pattern.toLowerCase();
      if (normalizedUrl.includes(normalizedPattern)) {
        return {
          confidence: 90,
          family,
          indicators: [`ATS URL pattern: ${pattern}`],
          posture: ATS_AUTOMATION_POSTURE[family],
        };
      }

      if (normalizedContent.includes(normalizedPattern)) {
        return {
          confidence: 70,
          family,
          indicators: [`ATS content pattern: ${pattern}`],
          posture: ATS_AUTOMATION_POSTURE[family],
        };
      }
    }
  }

  return {
    confidence: 0,
    family: null,
    indicators: ['No ATS family matched'],
    posture: null,
  };
}

export class PlatformDetectionService {
  /**
   * Detect the job board platform from a URL
   */
  static detectPlatform(url: string, content?: string): PlatformDetectionResult {
    if (!url) {
      return {
        platform: JobProvider.OTHER,
        confidence: 0,
        indicators: ['No URL provided'],
      };
    }

    const normalizedUrl = url.toLowerCase().trim();
    const results: Array<{ platform: JobProvider; confidence: number; indicators: string[] }> = [];

    // Check each platform pattern
    for (const [platform, pattern] of Object.entries(PLATFORM_PATTERNS) as Array<
      [JobProvider, PlatformPattern]
    >) {
      const confidence = this.calculateConfidence(normalizedUrl, content, pattern);
      if (confidence > 0) {
        results.push({
          platform: platform as JobProvider,
          confidence,
          indicators: this.getMatchingIndicators(normalizedUrl, content, pattern),
        });
      }
    }

    // Sort by confidence and priority
    results.sort((a, b) => {
      const aPriority = PLATFORM_PATTERNS[a.platform]?.priority ?? 0;
      const bPriority = PLATFORM_PATTERNS[b.platform]?.priority ?? 0;
      
      // First by confidence
      if (b.confidence !== a.confidence) {
        return b.confidence - a.confidence;
      }
      
      // Then by priority
      return bPriority - aPriority;
    });

    const topResult = results[0];
    if (!topResult || topResult.confidence < 30) {
      // If no strong match found, check if it's a company direct application
      const atsDetection = this.detectATS(normalizedUrl, content);
      if (atsDetection.detected) {
        return {
          platform: JobProvider.COMPANY_DIRECT,
          confidence: 60,
          indicators: [`ATS detected: ${atsDetection.provider}`, ...atsDetection.indicators],
          metadata: { atsProvider: atsDetection.provider },
        };
      }

      // Check if it looks like a company careers page
      if (this.isCompanyCareersPage(normalizedUrl)) {
        return {
          platform: JobProvider.COMPANY_DIRECT,
          confidence: 50,
          indicators: ['Company careers page detected'],
        };
      }

      return {
        platform: JobProvider.OTHER,
        confidence: topResult?.confidence || 0,
        indicators: topResult?.indicators || ['No platform patterns matched'],
      };
    }

    return {
      platform: topResult.platform,
      confidence: topResult.confidence,
      indicators: topResult.indicators,
    };
  }

  /**
   * Calculate confidence score for a platform match
   */
  private static calculateConfidence(
    url: string,
    content: string | undefined,
    pattern: PlatformPattern
  ): number {
    let confidence = 0;

    // Domain exact match (highest confidence)
    for (const domain of pattern.domains) {
      if (url.includes(domain)) {
        confidence += 90;
        break;
      }
    }

    // URL pattern matches
    let urlMatches = 0;
    for (const urlPattern of pattern.urlPatterns) {
      if (url.includes(urlPattern)) {
        urlMatches++;
      }
    }
    confidence += Math.min(urlMatches * 20, 60);

    // Content pattern matches (if content provided)
    if (content && pattern.contentPatterns) {
      const lowerContent = content.toLowerCase();
      let contentMatches = 0;
      for (const contentPattern of pattern.contentPatterns) {
        if (lowerContent.includes(contentPattern)) {
          contentMatches++;
        }
      }
      confidence += Math.min(contentMatches * 10, 30);
    }

    // Cap confidence at 100
    return Math.min(confidence, 100);
  }

  /**
   * Get list of matching indicators for debugging
   */
  private static getMatchingIndicators(
    url: string,
    content: string | undefined,
    pattern: PlatformPattern
  ): string[] {
    const indicators: string[] = [];

    // Check domain matches
    for (const domain of pattern.domains) {
      if (url.includes(domain)) {
        indicators.push(`Domain match: ${domain}`);
        break;
      }
    }

    // Check URL pattern matches
    for (const urlPattern of pattern.urlPatterns) {
      if (url.includes(urlPattern)) {
        indicators.push(`URL pattern: ${urlPattern}`);
      }
    }

    // Check content pattern matches
    if (content && pattern.contentPatterns) {
      const lowerContent = content.toLowerCase();
      for (const contentPattern of pattern.contentPatterns) {
        if (lowerContent.includes(contentPattern)) {
          indicators.push(`Content pattern: ${contentPattern}`);
        }
      }
    }

    return indicators;
  }

  /**
   * Detect ATS provider for company direct applications
   */
  private static detectATS(url: string, content?: string): {
    detected: boolean;
    provider?: string;
    indicators: string[];
  } {
    const detection = classifyAtsFamily({ content, url });
    if (!detection.family) {
      return { detected: false, indicators: [] };
    }

    return {
      detected: true,
      provider: detection.family,
      indicators: detection.indicators,
    };
  }

  /**
   * Check if URL looks like a company careers page
   */
  private static isCompanyCareersPage(url: string): boolean {
    const careersIndicators = [
      '/careers', '/jobs', '/opportunities', '/work-with-us',
      '/join-us', '/employment', '/hiring', '/openings'
    ];

    const jobProviderDomains = [
      'linkedin.com', 'indeed.com', 'glassdoor.com', 'ziprecruiter.com',
      'monster.com', 'dice.com', 'careerbuilder.com', 'wellfound.com',
      'angel.co', 'flexjobs.com', 'remoteok.io', 'weworkremotely.com'
    ];

    // Check if it's NOT a known job provider
    const isKnownProvider = jobProviderDomains.some(domain => url.includes(domain));
    if (isKnownProvider) {
      return false;
    }

    // Check if it has careers-related paths
    return careersIndicators.some(indicator => url.includes(indicator));
  }

  /**
   * Batch detect platforms for multiple URLs
   */
  static detectPlatforms(urls: string[]): Array<PlatformDetectionResult & { url: string }> {
    return urls.map(url => ({
      url,
      ...this.detectPlatform(url),
    }));
  }

  /**
   * Get platform-specific application capabilities
   */
  static getPlatformCapabilities(platform: JobProvider): {
    automationSupported: boolean;
    confidenceLevel: 'high' | 'medium' | 'low';
    features: string[];
    limitations: string[];
  } {
    const capabilities: Partial<
      Record<
        JobProvider,
        {
          automationSupported: boolean;
          confidenceLevel: 'high' | 'medium' | 'low';
          features: string[];
          limitations: string[];
        }
      >
    > = {
      [JobProvider.LINKEDIN]: {
        automationSupported: true,
        confidenceLevel: 'high' as const,
        features: ['Easy Apply', 'Profile integration', 'Connection suggestions'],
        limitations: ['API rate limits', 'Premium features may be limited'],
      },
      [JobProvider.INDEED]: {
        automationSupported: true,
        confidenceLevel: 'high' as const,
        features: ['Quick Apply', 'Resume upload', 'Cover letter'],
        limitations: ['Anti-bot measures', 'Some jobs require external application'],
      },
      [JobProvider.GLASSDOOR]: {
        automationSupported: true,
        confidenceLevel: 'medium' as const,
        features: ['Direct application', 'Company insights'],
        limitations: ['Mixed internal/external applications', 'Complex forms'],
      },
      [JobProvider.ZIPRECRUITER]: {
        automationSupported: true,
        confidenceLevel: 'medium' as const,
        features: ['Quick Apply', 'Phone verification'],
        limitations: ['Employer redirects', 'Phone verification required'],
      },
      [JobProvider.ANGELLIST]: {
        automationSupported: true,
        confidenceLevel: 'medium' as const,
        features: ['Startup focus', 'Equity information', 'Portfolio links'],
        limitations: ['Startup-specific questions', 'Manual review often needed'],
      },
      [JobProvider.WELLFOUND]: {
        automationSupported: true,
        confidenceLevel: 'medium' as const,
        features: ['Startup focus', 'Equity information', 'Portfolio links'],
        limitations: ['Startup-specific questions', 'Manual review often needed'],
      },
      [JobProvider.COMPANY_DIRECT]: {
        automationSupported: true,
        confidenceLevel: 'low' as const,
        features: ['ATS detection', 'Form filling', 'Multi-step applications'],
        limitations: ['Highly variable', 'Manual intervention often required', 'ATS-dependent'],
      },
    };

    return capabilities[platform] || {
      automationSupported: false,
      confidenceLevel: 'low' as const,
      features: [],
      limitations: ['Not yet implemented'],
    };
  }

  /**
   * Validate if a URL is suitable for automation
   */
  static validateForAutomation(url: string): {
    suitable: boolean;
    platform: JobProvider;
    confidence: number;
    recommendations: string[];
    warnings: string[];
  } {
    const detection = this.detectPlatform(url);
    const capabilities = this.getPlatformCapabilities(detection.platform);
    
    const recommendations: string[] = [];
    const warnings: string[] = [];

    if (!capabilities.automationSupported) {
      warnings.push('Platform automation not yet implemented');
      recommendations.push('Consider manual application');
    }

    if (detection.confidence < 70) {
      warnings.push('Platform detection confidence is low');
      recommendations.push('Verify job posting manually before automation');
    }

    if (capabilities.confidenceLevel === 'low') {
      warnings.push('Automation success rate may be lower for this platform');
      recommendations.push('Review application before submission');
    }

    return {
      suitable: capabilities.automationSupported && detection.confidence >= 50,
      platform: detection.platform,
      confidence: detection.confidence,
      recommendations,
      warnings,
    };
  }
}

// Export helper functions
export const {
  detectPlatform,
  detectPlatforms,
  getPlatformCapabilities,
  validateForAutomation,
} = PlatformDetectionService;
