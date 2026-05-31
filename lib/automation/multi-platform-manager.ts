import { db } from '@/lib/db/client';
import { ApplicationStatus } from '@/generated/prisma/browser';
import { automationErrorHandler, ErrorContext } from './error-handler';

export interface PlatformConfig {
  name: string;
  enabled: boolean;
  credentials: Record<string, any>;
  rateLimits: {
    applicationsPerHour: number;
    applicationsPerDay: number;
    minIntervalMinutes: number;
  };
  features: {
    oneClickApply: boolean;
    formFilling: boolean;
    profileMatching: boolean;
    coverLetterGeneration: boolean;
  };
  priority: number; // 1-5, higher is better
}

export interface ApplicationResult {
  success: boolean;
  applicationId?: string;
  submissionUrl?: string;
  errorMessage?: string;
  platform: string;
  processingTime: number;
  metadata?: Record<string, any>;
}

export interface PlatformSubmissionService {
  platform: string;
  submitApplication(jobLeadId: string, formData?: Record<string, any>): Promise<ApplicationResult>;
  validateCredentials(): Promise<boolean>;
  getCapabilities(): Record<string, boolean>;
  isRateLimited(): Promise<boolean>;
}

// Platform-specific submission services
class LinkedInSubmissionService implements PlatformSubmissionService {
  platform = 'LinkedIn';

  async submitApplication(jobLeadId: string, formData = {}): Promise<ApplicationResult> {
    const startTime = Date.now();

    try {
      // Import LinkedIn submission logic
      const { submitLinkedInApplication } = await import('@/lib/applications/services/linkedin-enhanced');

      const result = await submitLinkedInApplication(jobLeadId, formData);

      return {
        success: true,
        applicationId: result.applicationId,
        submissionUrl: result.submissionUrl,
        platform: this.platform,
        processingTime: Date.now() - startTime,
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'LinkedIn submission failed',
        platform: this.platform,
        processingTime: Date.now() - startTime,
      };
    }
  }

  async validateCredentials(): Promise<boolean> {
    try {
      // Check LinkedIn session/token validity
      const { validateLinkedInSession } = await import('@/lib/api/linkedin-client');
      return await validateLinkedInSession();
    } catch {
      return false;
    }
  }

  getCapabilities(): Record<string, boolean> {
    return {
      oneClickApply: true,
      formFilling: true,
      profileMatching: true,
      coverLetterGeneration: true,
    };
  }

  async isRateLimited(): Promise<boolean> {
    // Check LinkedIn rate limits
    return false; // Implement rate limit checking
  }
}

class IndeedSubmissionService implements PlatformSubmissionService {
  platform = 'Indeed';

  async submitApplication(jobLeadId: string, formData = {}): Promise<ApplicationResult> {
    const startTime = Date.now();

    try {
      const { submitIndeedApplication } = await import('@/lib/applications/services/indeed-submission');

      const result = await submitIndeedApplication(jobLeadId, formData);

      return {
        success: true,
        applicationId: result.applicationId,
        submissionUrl: result.submissionUrl,
        platform: this.platform,
        processingTime: Date.now() - startTime,
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Indeed submission failed',
        platform: this.platform,
        processingTime: Date.now() - startTime,
      };
    }
  }

  async validateCredentials(): Promise<boolean> {
    // Check Indeed session validity
    return true; // Implement credential validation
  }

  getCapabilities(): Record<string, boolean> {
    return {
      oneClickApply: true,
      formFilling: true,
      profileMatching: false,
      coverLetterGeneration: false,
    };
  }

  async isRateLimited(): Promise<boolean> {
    return false; // Implement rate limit checking
  }
}

class GlassdoorSubmissionService implements PlatformSubmissionService {
  platform = 'Glassdoor';

  async submitApplication(jobLeadId: string, formData = {}): Promise<ApplicationResult> {
    const startTime = Date.now();

    try {
      const { submitGlassdoorApplication } = await import('@/lib/applications/services/glassdoor');

      const result = await submitGlassdoorApplication(jobLeadId, formData);

      return {
        success: true,
        applicationId: result.applicationId,
        submissionUrl: result.submissionUrl,
        platform: this.platform,
        processingTime: Date.now() - startTime,
        metadata: result.metadata,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Glassdoor submission failed',
        platform: this.platform,
        processingTime: Date.now() - startTime,
      };
    }
  }

  async validateCredentials(): Promise<boolean> {
    return true; // Implement credential validation
  }

  getCapabilities(): Record<string, boolean> {
    return {
      oneClickApply: false,
      formFilling: true,
      profileMatching: false,
      coverLetterGeneration: false,
    };
  }

  async isRateLimited(): Promise<boolean> {
    return false;
  }
}

export class MultiPlatformManager {
  private services: Map<string, PlatformSubmissionService> = new Map();
  private platformConfigs: Map<string, PlatformConfig> = new Map();

  constructor() {
    this.initializePlatforms();
  }

  private initializePlatforms() {
    // Register platform services
    this.services.set('LinkedIn', new LinkedInSubmissionService());
    this.services.set('Indeed', new IndeedSubmissionService());
    this.services.set('Glassdoor', new GlassdoorSubmissionService());

    // Default platform configurations
    this.platformConfigs.set('LinkedIn', {
      name: 'LinkedIn',
      enabled: true,
      credentials: {},
      rateLimits: {
        applicationsPerHour: 10,
        applicationsPerDay: 50,
        minIntervalMinutes: 6,
      },
      features: {
        oneClickApply: true,
        formFilling: true,
        profileMatching: true,
        coverLetterGeneration: true,
      },
      priority: 5,
    });

    this.platformConfigs.set('Indeed', {
      name: 'Indeed',
      enabled: true,
      credentials: {},
      rateLimits: {
        applicationsPerHour: 15,
        applicationsPerDay: 75,
        minIntervalMinutes: 4,
      },
      features: {
        oneClickApply: true,
        formFilling: true,
        profileMatching: false,
        coverLetterGeneration: false,
      },
      priority: 4,
    });

    this.platformConfigs.set('Glassdoor', {
      name: 'Glassdoor',
      enabled: true,
      credentials: {},
      rateLimits: {
        applicationsPerHour: 8,
        applicationsPerDay: 40,
        minIntervalMinutes: 8,
      },
      features: {
        oneClickApply: false,
        formFilling: true,
        profileMatching: false,
        coverLetterGeneration: false,
      },
      priority: 3,
    });
  }

  /**
   * Get the best platform for a job application
   */
  async getBestPlatform(jobLeadId: string): Promise<string | null> {
    // Get job lead details
    const jobLead = await db.jobLead.findUnique({
      where: { id: jobLeadId },
      include: { jobListing: true },
    });

    if (!jobLead?.jobListing?.url) {
      return null;
    }

    // Detect platform from URL
    const url = jobLead.jobListing.url.toLowerCase();
    let detectedPlatform: string | null = null;

    if (url.includes('linkedin.com')) {
      detectedPlatform = 'LinkedIn';
    } else if (url.includes('indeed.com')) {
      detectedPlatform = 'Indeed';
    } else if (url.includes('glassdoor.com')) {
      detectedPlatform = 'Glassdoor';
    }

    // If we detected a platform and it's enabled, use it
    if (detectedPlatform && this.isPlatformEnabled(detectedPlatform)) {
      const service = this.services.get(detectedPlatform);
      if (service && !(await service.isRateLimited())) {
        return detectedPlatform;
      }
    }

    // Otherwise, find the best available platform
    const availablePlatforms = Array.from(this.platformConfigs.entries())
      .filter(([name, config]) => config.enabled)
      .sort(([, a], [, b]) => b.priority - a.priority);

    for (const [platformName] of availablePlatforms) {
      const service = this.services.get(platformName);
      if (service && !(await service.isRateLimited())) {
        return platformName;
      }
    }

    return null;
  }

  /**
   * Submit application using the best platform
   */
  async submitApplication(
    jobLeadId: string,
    userId: string,
    formData: Record<string, any> = {}
  ): Promise<ApplicationResult> {
    const bestPlatform = await this.getBestPlatform(jobLeadId);

    if (!bestPlatform) {
      throw new Error('No available platform for application submission');
    }

    const service = this.services.get(bestPlatform);
    if (!service) {
      throw new Error(`Service not found for platform: ${bestPlatform}`);
    }

    try {
      // Attempt submission
      const result = await service.submitApplication(jobLeadId, formData);

      // Create application record
      const applicationSubmission = await db.applicationSubmission.create({
        data: {
          userId,
          jobLeadId,
          status: result.success ? ApplicationStatus.SUBMITTED : ApplicationStatus.FAILED,
          submissionUrl: result.submissionUrl,
          submittedAt: result.success ? new Date() : null,
          wasAutomated: true,
          errorMessage: result.errorMessage,
          metadata: {
            platform: result.platform,
            processingTime: result.processingTime,
            ...result.metadata,
          },
        },
      });

      // Handle errors
      if (!result.success && result.errorMessage) {
        const errorContext: ErrorContext = {
          userId,
          applicationId: applicationSubmission.id,
          jobLeadId,
          platform: result.platform,
          attemptNumber: 1,
          lastError: result.errorMessage,
        };

        await automationErrorHandler.handleError(
          new Error(result.errorMessage),
          errorContext
        );
      }

      return {
        ...result,
        applicationId: applicationSubmission.id,
      };
    } catch (error) {
      // Handle unexpected errors
      const errorContext: ErrorContext = {
        userId,
        jobLeadId,
        platform: bestPlatform,
        attemptNumber: 1,
        lastError: error instanceof Error ? error.message : 'Unknown error',
      };

      await automationErrorHandler.handleError(error, errorContext);
      throw error;
    }
  }

  /**
   * Validate platform credentials
   */
  async validatePlatformCredentials(platformName: string): Promise<boolean> {
    const service = this.services.get(platformName);
    return service ? await service.validateCredentials() : false;
  }

  /**
   * Get platform capabilities
   */
  getPlatformCapabilities(platformName: string): Record<string, boolean> {
    const service = this.services.get(platformName);
    return service ? service.getCapabilities() : {};
  }

  /**
   * Update platform configuration
   */
  async updatePlatformConfig(
    platformName: string,
    userId: string,
    config: Partial<PlatformConfig>
  ): Promise<void> {
    const existingConfig = this.platformConfigs.get(platformName);
    if (!existingConfig) {
      throw new Error(`Platform ${platformName} not found`);
    }

    const updatedConfig = { ...existingConfig, ...config };
    this.platformConfigs.set(platformName, updatedConfig);

    // Save to database
    await db.automationPlatformConfig.upsert({
      where: {
        userId_platform: {
          userId,
          platform: platformName,
        },
      },
      update: {
        config: updatedConfig as any,
        updatedAt: new Date(),
      },
      create: {
        userId,
        platform: platformName,
        config: updatedConfig as any,
      },
    });
  }

  /**
   * Load user's platform configurations
   */
  async loadUserConfigs(userId: string): Promise<void> {
    const userConfigs = await db.automationPlatformConfig.findMany({
      where: { userId },
    });

    userConfigs.forEach(({ platform, config }) => {
      this.platformConfigs.set(platform, config as PlatformConfig);
    });
  }

  /**
   * Get all platform configurations
   */
  getAllPlatformConfigs(): Record<string, PlatformConfig> {
    const configs: Record<string, PlatformConfig> = {};
    this.platformConfigs.forEach((config, name) => {
      configs[name] = config;
    });
    return configs;
  }

  /**
   * Check if platform is enabled
   */
  isPlatformEnabled(platformName: string): boolean {
    const config = this.platformConfigs.get(platformName);
    return config?.enabled ?? false;
  }

  /**
   * Get platform submission statistics
   */
  async getPlatformStatistics(userId: string, days = 7): Promise<Record<string, any>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const submissions = await db.applicationSubmission.findMany({
      where: {
        userId,
        wasAutomated: true,
        createdAt: { gte: startDate },
      },
    });

    const stats: Record<string, any> = {};

    this.platformConfigs.forEach((_, platformName) => {
      const platformSubmissions = submissions.filter(
        sub => sub.metadata?.platform === platformName
      );

      const successful = platformSubmissions.filter(
        sub => sub.status === ApplicationStatus.SUBMITTED
      );

      stats[platformName] = {
        totalSubmissions: platformSubmissions.length,
        successful: successful.length,
        failed: platformSubmissions.length - successful.length,
        successRate: platformSubmissions.length > 0
          ? (successful.length / platformSubmissions.length) * 100
          : 0,
        averageProcessingTime: platformSubmissions.length > 0
          ? platformSubmissions.reduce((sum, sub) =>
              sum + (sub.metadata?.processingTime || 0), 0) / platformSubmissions.length
          : 0,
      };
    });

    return stats;
  }

  /**
   * Batch submit multiple applications
   */
  async batchSubmitApplications(
    jobLeadIds: string[],
    userId: string,
    concurrency = 3
  ): Promise<ApplicationResult[]> {
    const results: ApplicationResult[] = [];

    // Process in batches to respect rate limits
    for (let i = 0; i < jobLeadIds.length; i += concurrency) {
      const batch = jobLeadIds.slice(i, i + concurrency);

      const batchPromises = batch.map(async (jobLeadId) => {
        try {
          return await this.submitApplication(jobLeadId, userId);
        } catch (error) {
          return {
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Batch submission failed',
            platform: 'unknown',
            processingTime: 0,
          };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);

      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          results.push(result.value);
        } else {
          results.push({
            success: false,
            errorMessage: result.reason?.message || 'Promise rejected',
            platform: 'unknown',
            processingTime: 0,
          });
        }
      });

      // Add delay between batches to respect rate limits
      if (i + concurrency < jobLeadIds.length) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }

    return results;
  }
}

// Singleton instance
export const multiPlatformManager = new MultiPlatformManager();