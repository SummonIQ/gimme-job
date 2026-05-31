import { JobProvider } from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import { 
  submitToJobBoard, 
  SubmissionParams, 
  SubmissionResult,
  getSubmissionProvider 
} from './index';
import { 
  detectPlatform, 
  validateForAutomation,
  getPlatformCapabilities,
  PlatformDetectionResult 
} from './platform-detection';
import { automationErrorHandler } from '@/lib/automation/error-handler';

export interface UnifiedApplicationParams {
  jobLeadId: string;
  userId: string;
  resumeId?: string;
  coverLetterId?: string;
  customFields?: Record<string, any>;
  platformOverride?: JobProvider; // Force specific platform if detection fails
}

export interface UnifiedApplicationResult {
  success: boolean;
  applicationId?: string;
  confirmationCode?: string;
  platform: JobProvider;
  platformDetection: PlatformDetectionResult;
  error?: string;
  warnings: string[];
  recommendations: string[];
  metadata: {
    submissionMethod: string;
    platformCapabilities: any;
    processingTime: number;
    timestamp: string;
    errorCategory?: string;
  };
}

export interface ApplicationEligibilityCheck {
  eligible: boolean;
  platform: JobProvider;
  confidence: number;
  requirements: string[];
  recommendations: string[];
  warnings: string[];
  estimatedSuccessRate: number;
  automationSupported: boolean;
}

export class UnifiedApplicationService {
  /**
   * Check if user is eligible to apply for a specific job
   */
  static async checkEligibility(
    jobLeadId: string,
    userId: string
  ): Promise<ApplicationEligibilityCheck> {
    try {
      // Get job lead data
      const jobLead = await db.jobLead.findUnique({
        where: { id: jobLeadId },
        include: {
          jobListing: true,
          user: true,
        },
      });

      if (!jobLead) {
        throw new Error('Job lead not found');
      }

      // Detect platform
      const jobUrl = jobLead.jobListing?.externalUrl || '';
      const platformDetection = detectPlatform(jobUrl);
      const validation = validateForAutomation(jobUrl);
      
      // Get platform capabilities
      const capabilities = getPlatformCapabilities(platformDetection.platform);

      // Check user profile completeness
      const user = await db.user.findUnique({
        where: { id: userId },
        include: { preferences: true, linkedinProfile: true },
      });

      const requirements: string[] = [];
      const recommendations: string[] = [];
      const warnings: string[] = [];

      // Basic requirements
      if (!user?.firstName || !user?.lastName) {
        requirements.push('Complete name required');
      }
      if (!user?.email) {
        requirements.push('Valid email address required');
      }

      // Platform-specific requirements
      const preferences = user?.preferences as any;
      switch (platformDetection.platform) {
        case JobProvider.ZIPRECRUITER:
          if (!preferences?.phone) {
            requirements.push('Phone number required for ZipRecruiter');
          }
          break;
        case JobProvider.ANGELLIST:
        case JobProvider.WELLFOUND:
          if (!preferences?.portfolioUrl && !preferences?.githubUrl) {
            recommendations.push('Portfolio or GitHub URL recommended for startup applications');
          }
          break;
        case JobProvider.COMPANY_DIRECT:
          warnings.push('Company direct applications may require manual intervention');
          break;
      }

      // Add validation warnings
      warnings.push(...validation.warnings);
      recommendations.push(...validation.recommendations);

      // Calculate estimated success rate
      let successRate = 50; // Base rate
      if (capabilities.automationSupported) successRate += 30;
      if (platformDetection.confidence > 80) successRate += 20;
      if (requirements.length === 0) successRate += 20;
      if (capabilities.confidenceLevel === 'high') successRate += 10;
      
      successRate = Math.min(successRate, 95);

      return {
        eligible: requirements.length === 0 && validation.suitable,
        platform: platformDetection.platform,
        confidence: platformDetection.confidence,
        requirements,
        recommendations,
        warnings,
        estimatedSuccessRate: successRate,
        automationSupported: capabilities.automationSupported,
      };
    } catch (error) {
      console.error('Error checking eligibility:', error);
      return {
        eligible: false,
        platform: JobProvider.OTHER,
        confidence: 0,
        requirements: ['Unable to validate job application'],
        recommendations: [],
        warnings: ['System error occurred during validation'],
        estimatedSuccessRate: 0,
        automationSupported: false,
      };
    }
  }

  /**
   * Submit application with unified interface
   */
  static async submitApplication(
    params: UnifiedApplicationParams
  ): Promise<UnifiedApplicationResult> {
    const startTime = Date.now();
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // Get job lead data
      const jobLead = await db.jobLead.findUnique({
        where: { id: params.jobLeadId },
        include: {
          jobListing: true,
          user: true,
        },
      });

      if (!jobLead) {
        throw new Error('Job lead not found');
      }

      // Detect platform (or use override)
      const jobUrl = jobLead.jobListing?.externalUrl || '';
      const platformDetection = detectPlatform(jobUrl);
      const targetPlatform = params.platformOverride || platformDetection.platform;
      
      // Validate automation capability
      const validation = validateForAutomation(jobUrl);
      warnings.push(...validation.warnings);
      recommendations.push(...validation.recommendations);

      // Get platform capabilities
      const capabilities = getPlatformCapabilities(targetPlatform);

      // Prepare submission parameters
      const submissionParams: SubmissionParams = {
        jobId: params.jobLeadId,
        jobUrl: jobUrl,
        customFields: {
          ...params.customFields,
          userId: params.userId,
          resumeId: params.resumeId,
          coverLetterId: params.coverLetterId,
        },
      };

      // Add resume and cover letter data if provided
      if (params.resumeId) {
        const resume = await db.resume.findUnique({
          where: { id: params.resumeId },
        });
        if (resume?.content) {
          submissionParams.resumeData = resume.content;
        }
      }

      if (params.coverLetterId) {
        const coverLetter = await db.coverLetter.findUnique({
          where: { id: params.coverLetterId },
        });
        if (coverLetter?.content) {
          submissionParams.coverLetterData = coverLetter.content;
        }
      }

      // Check if platform is supported
      if (!capabilities.automationSupported) {
        // Add to manual queue instead
        await this.addToManualQueue(params.jobLeadId, params.userId, {
          reason: 'Platform automation not yet implemented',
          platform: targetPlatform,
          jobUrl,
        });

        return {
          success: false,
          platform: targetPlatform,
          platformDetection,
          error: 'Platform automation not yet implemented. Job added to manual review queue.',
          warnings,
          recommendations,
          metadata: {
            submissionMethod: 'manual_queue',
            platformCapabilities: capabilities,
            processingTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            errorCategory: 'unsupported_platform',
          },
        };
      }

      // Submit application
      const result = await submitToJobBoard(targetPlatform, submissionParams);

      // Handle errors with error handler
      if (!result.success && result.error) {
        const errorResolution = await automationErrorHandler.handleError(
          new Error(result.error),
          {
            applicationId: params.jobLeadId,
            platform: targetPlatform.toLowerCase(),
            attemptNumber: 1,
            userId: params.userId,
            metadata: {
              jobTitle: jobLead.jobTitle,
              company: jobLead.companyName,
              jobUrl,
            },
          }
        );

        if (errorResolution.requiresUserAction) {
          await this.addToManualQueue(params.jobLeadId, params.userId, {
            reason: result.error,
            platform: targetPlatform,
            jobUrl,
            errorCategory: errorResolution.category,
          });
        }
      }

      return {
        success: result.success,
        applicationId: result.applicationId,
        confirmationCode: result.confirmationCode,
        platform: targetPlatform,
        platformDetection,
        error: result.error,
        warnings,
        recommendations,
        metadata: {
          submissionMethod: result.success ? 'automated' : 'failed',
          platformCapabilities: capabilities,
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          errorCategory: result.error ? 'submission_error' : undefined,
          ...result.metadata,
        },
      };
    } catch (error) {
      console.error('Unified application submission error:', error);
      
      // Handle unexpected errors
      await automationErrorHandler.handleError(error, {
        applicationId: params.jobLeadId,
        userId: params.userId,
        metadata: params.customFields,
      });

      return {
        success: false,
        platform: JobProvider.OTHER,
        platformDetection: { platform: JobProvider.OTHER, confidence: 0, indicators: [] },
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        warnings,
        recommendations,
        metadata: {
          submissionMethod: 'error',
          platformCapabilities: { automationSupported: false, confidenceLevel: 'low', features: [], limitations: [] },
          processingTime: Date.now() - startTime,
          timestamp: new Date().toISOString(),
          errorCategory: 'system_error',
        },
      };
    }
  }

  /**
   * Batch submit multiple applications
   */
  static async submitMultipleApplications(
    applications: UnifiedApplicationParams[]
  ): Promise<UnifiedApplicationResult[]> {
    const results: UnifiedApplicationResult[] = [];
    
    // Submit applications with small delays to avoid overwhelming platforms
    for (let i = 0; i < applications.length; i++) {
      const result = await this.submitApplication(applications[i]);
      results.push(result);
      
      // Add delay between submissions (except for last one)
      if (i < applications.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    return results;
  }

  /**
   * Get application status across all platforms
   */
  static async getApplicationStatus(userId: string, limit = 50): Promise<Array<{
    id: string;
    jobTitle: string;
    company: string;
    platform: JobProvider;
    status: string;
    submittedAt?: Date;
    lastUpdated: Date;
    confirmationCode?: string;
    errorMessage?: string;
  }>> {
    const applications = await db.applicationSubmission.findMany({
      where: { userId },
      include: {
        jobLead: {
          select: {
            jobTitle: true,
            companyName: true,
            jobListing: {
              select: {
                jobProvider: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return applications.map(app => ({
      id: app.id,
      jobTitle: app.jobLead.jobTitle,
      company: app.jobLead.companyName,
      platform: app.jobLead.jobListing?.jobProvider || JobProvider.OTHER,
      status: app.status,
      submittedAt: app.submittedAt || undefined,
      lastUpdated: app.updatedAt,
      confirmationCode: app.externalId || undefined,
      errorMessage: app.errorMessage || undefined,
    }));
  }

  /**
   * Get platform-specific statistics
   */
  static async getPlatformStatistics(userId: string): Promise<Record<JobProvider, {
    totalApplications: number;
    successfulApplications: number;
    failedApplications: number;
    successRate: number;
    averageProcessingTime?: number;
  }>> {
    const applications = await db.applicationSubmission.findMany({
      where: { userId },
      include: {
        jobLead: {
          include: {
            jobListing: {
              select: { jobProvider: true },
            },
          },
        },
      },
    });

    const stats: Record<string, any> = {};
    
    // Group by platform
    for (const app of applications) {
      const platform = app.jobLead.jobListing?.jobProvider || JobProvider.OTHER;
      if (!stats[platform]) {
        stats[platform] = {
          totalApplications: 0,
          successfulApplications: 0,
          failedApplications: 0,
        };
      }
      
      stats[platform].totalApplications++;
      if (app.status === 'SUBMITTED') {
        stats[platform].successfulApplications++;
      } else if (app.status === 'FAILED') {
        stats[platform].failedApplications++;
      }
    }

    // Calculate success rates
    for (const platform in stats) {
      const platformStats = stats[platform];
      platformStats.successRate = platformStats.totalApplications > 0 
        ? (platformStats.successfulApplications / platformStats.totalApplications) * 100 
        : 0;
    }

    return stats as Record<JobProvider, any>;
  }

  /**
   * Add job to manual intervention queue
   */
  private static async addToManualQueue(
    jobLeadId: string,
    userId: string,
    options: {
      reason: string;
      platform: JobProvider;
      jobUrl: string;
      errorCategory?: string;
    }
  ) {
    await db.automationAuditLog.create({
      data: {
        userId,
        action: 'manual_intervention_required',
        actionType: 'warning',
        metadata: {
          jobLeadId,
          reason: options.reason,
          platform: options.platform,
          jobUrl: options.jobUrl,
          errorCategory: options.errorCategory,
          queuedAt: new Date(),
        },
      },
    });
  }

  /**
   * Preview application before submission
   */
  static async previewApplication(
    params: UnifiedApplicationParams
  ): Promise<{
    platform: JobProvider;
    confidence: number;
    eligibilityCheck: ApplicationEligibilityCheck;
    requiredFields: string[];
    optionalFields: string[];
    estimatedProcessingTime: string;
    warnings: string[];
    recommendations: string[];
  }> {
    const eligibilityCheck = await this.checkEligibility(params.jobLeadId, params.userId);
    
    // Get job data for platform detection
    const jobLead = await db.jobLead.findUnique({
      where: { id: params.jobLeadId },
      include: { jobListing: true },
    });

    const jobUrl = jobLead?.jobListing?.externalUrl || '';
    const platformDetection = detectPlatform(jobUrl);
    const capabilities = getPlatformCapabilities(platformDetection.platform);

    // Platform-specific required fields
    const requiredFields = ['firstName', 'lastName', 'email'];
    const optionalFields = ['phone', 'address', 'coverLetter'];

    // Add platform-specific fields
    switch (platformDetection.platform) {
      case JobProvider.ZIPRECRUITER:
        requiredFields.push('phone');
        optionalFields.push('desiredSalary', 'availableStartDate');
        break;
      case JobProvider.ANGELLIST:
      case JobProvider.WELLFOUND:
        optionalFields.push('portfolioUrl', 'githubUrl', 'equityInterest');
        break;
      case JobProvider.GLASSDOOR:
        optionalFields.push('workAuthorization', 'willingToRelocate');
        break;
    }

    // Estimate processing time
    const baseTime = capabilities.confidenceLevel === 'high' ? '30-60 seconds' :
                     capabilities.confidenceLevel === 'medium' ? '1-3 minutes' :
                     '3-10 minutes (may require manual intervention)';

    return {
      platform: platformDetection.platform,
      confidence: platformDetection.confidence,
      eligibilityCheck,
      requiredFields,
      optionalFields,
      estimatedProcessingTime: baseTime,
      warnings: eligibilityCheck.warnings,
      recommendations: eligibilityCheck.recommendations,
    };
  }
}

// Export helper functions
export const {
  checkEligibility,
  submitApplication,
  submitMultipleApplications,
  getApplicationStatus,
  getPlatformStatistics,
  previewApplication,
} = UnifiedApplicationService;