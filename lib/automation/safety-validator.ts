import { db } from '@/lib/db/client';

/**
 * Safety Validation System for Automation
 * 
 * This system ensures that critical safety controls cannot be bypassed
 * and provides multiple layers of protection for automation workflows.
 */

export interface SafetyValidationResult {
  isAllowed: boolean;
  reason?: string;
  riskLevel: 'low' | 'medium' | 'high';
  blockedBy?: string[];
  warnings?: string[];
}

export interface JobLead {
  id: string;
  title: string;
  companyName?: string;
  description?: string;
  salaryMin?: number;
  salaryMax?: number;
  location?: string;
  url?: string;
}

export interface AutomationSettings {
  requireUserApproval: boolean;
  preventDuplicateApplications: boolean;
  enableCompanyBlacklist: boolean;
  companyBlacklist: string[];
  enableKeywordBlacklist: boolean;
  keywordBlacklist: string[];
  enableSalaryThreshold: boolean;
  minSalaryThreshold: number;
  maxApplicationsPerCompany: number;
  pauseOnConsecutiveFailures: boolean;
  consecutiveFailureThreshold: number;
  applicationsPerHour: number;
  applicationsPerDay: number;
  isEnabled: boolean;
  isPaused: boolean;
}

export class SafetyValidator {
  private settings: AutomationSettings;
  private userId: string;

  constructor(settings: AutomationSettings, userId: string) {
    this.settings = settings;
    this.userId = userId;
  }

  /**
   * Comprehensive safety validation for a job application
   */
  async validateJobApplication(jobLead: JobLead): Promise<SafetyValidationResult> {
    const result: SafetyValidationResult = {
      isAllowed: true,
      riskLevel: 'low',
      blockedBy: [],
      warnings: [],
    };

    // Critical Safety Check: Automation must be enabled
    if (!this.settings.isEnabled) {
      result.isAllowed = false;
      result.reason = 'Automation is disabled';
      result.blockedBy?.push('System Control');
      result.riskLevel = 'high';
      return result;
    }

    // Critical Safety Check: Automation must not be paused
    if (this.settings.isPaused) {
      result.isAllowed = false;
      result.reason = 'Automation is paused';
      result.blockedBy?.push('System Control');
      result.riskLevel = 'high';
      return result;
    }

    // Check duplicate applications
    if (this.settings.preventDuplicateApplications) {
      const hasDuplicate = await this.checkDuplicateApplication(jobLead);
      if (hasDuplicate) {
        result.isAllowed = false;
        result.reason = 'Duplicate application detected';
        result.blockedBy?.push('Duplicate Prevention');
        result.riskLevel = 'medium';
        return result;
      }
    }

    // Check company blacklist
    if (this.settings.enableCompanyBlacklist && jobLead.companyName) {
      const isBlacklisted = this.checkCompanyBlacklist(jobLead.companyName);
      if (isBlacklisted) {
        result.isAllowed = false;
        result.reason = `Company "${jobLead.companyName}" is on the blacklist`;
        result.blockedBy?.push('Company Blacklist');
        result.riskLevel = 'medium';
        return result;
      }
    }

    // Check keyword blacklist
    if (this.settings.enableKeywordBlacklist) {
      const blacklistedKeywords = this.checkKeywordBlacklist(jobLead);
      if (blacklistedKeywords.length > 0) {
        result.isAllowed = false;
        result.reason = `Contains blacklisted keywords: ${blacklistedKeywords.join(', ')}`;
        result.blockedBy?.push('Keyword Blacklist');
        result.riskLevel = 'medium';
        return result;
      }
    }

    // Check salary threshold
    if (this.settings.enableSalaryThreshold) {
      const salaryCheck = this.checkSalaryThreshold(jobLead);
      if (!salaryCheck.meetsThreshold) {
        result.isAllowed = false;
        result.reason = salaryCheck.reason;
        result.blockedBy?.push('Salary Threshold');
        result.riskLevel = 'low';
        return result;
      }
    }

    // Check rate limits
    const rateLimitCheck = await this.checkRateLimits();
    if (!rateLimitCheck.allowed) {
      result.isAllowed = false;
      result.reason = rateLimitCheck.reason;
      result.blockedBy?.push('Rate Limiting');
      result.riskLevel = 'high';
      return result;
    }

    // Check applications per company limit
    const companyLimitCheck = await this.checkCompanyApplicationLimit(jobLead);
    if (!companyLimitCheck.allowed) {
      result.isAllowed = false;
      result.reason = companyLimitCheck.reason;
      result.blockedBy?.push('Company Limit');
      result.riskLevel = 'medium';
      return result;
    }

    // Check for consecutive failures
    const failureCheck = await this.checkConsecutiveFailures();
    if (!failureCheck.allowed) {
      result.isAllowed = false;
      result.reason = failureCheck.reason;
      result.blockedBy?.push('Failure Prevention');
      result.riskLevel = 'high';
      return result;
    }

    // Add warnings for potential issues
    if (rateLimitCheck.warning) {
      result.warnings?.push(rateLimitCheck.warning);
    }

    // Determine final risk level
    if (result.warnings && result.warnings.length > 0) {
      result.riskLevel = 'medium';
    }

    return result;
  }

  private async checkDuplicateApplication(jobLead: JobLead): Promise<boolean> {
    const existingApplication = await db.applicationSubmission.findFirst({
      where: {
        userId: this.userId,
        jobLeadId: jobLead.id,
      },
    });

    return !!existingApplication;
  }

  private checkCompanyBlacklist(companyName: string): boolean {
    return this.settings.companyBlacklist.some(blacklisted =>
      companyName.toLowerCase().includes(blacklisted.toLowerCase())
    );
  }

  private checkKeywordBlacklist(jobLead: JobLead): string[] {
    const text = `${jobLead.title} ${jobLead.description || ''}`.toLowerCase();
    return this.settings.keywordBlacklist.filter(keyword =>
      text.includes(keyword.toLowerCase())
    );
  }

  private checkSalaryThreshold(jobLead: JobLead): { meetsThreshold: boolean; reason?: string } {
    // If no salary information, we can't validate
    if (!jobLead.salaryMin && !jobLead.salaryMax) {
      return { meetsThreshold: true };
    }

    const minSalary = jobLead.salaryMin || 0;
    const maxSalary = jobLead.salaryMax || jobLead.salaryMin || 0;

    if (maxSalary < this.settings.minSalaryThreshold) {
      return {
        meetsThreshold: false,
        reason: `Salary (${maxSalary}) below minimum threshold (${this.settings.minSalaryThreshold})`
      };
    }

    return { meetsThreshold: true };
  }

  private async checkRateLimits(): Promise<{ allowed: boolean; reason?: string; warning?: string }> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Check hourly limit
    const hourlyCount = await db.applicationSubmission.count({
      where: {
        userId: this.userId,
        wasAutomated: true,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (hourlyCount >= this.settings.applicationsPerHour) {
      return {
        allowed: false,
        reason: `Hourly rate limit exceeded (${hourlyCount}/${this.settings.applicationsPerHour})`
      };
    }

    // Check daily limit
    const dailyCount = await db.applicationSubmission.count({
      where: {
        userId: this.userId,
        wasAutomated: true,
        createdAt: {
          gte: oneDayAgo,
        },
      },
    });

    if (dailyCount >= this.settings.applicationsPerDay) {
      return {
        allowed: false,
        reason: `Daily rate limit exceeded (${dailyCount}/${this.settings.applicationsPerDay})`
      };
    }

    // Add warning if approaching limits
    const hourlyWarningThreshold = Math.floor(this.settings.applicationsPerHour * 0.8);
    const dailyWarningThreshold = Math.floor(this.settings.applicationsPerDay * 0.8);

    let warning: string | undefined;
    if (hourlyCount >= hourlyWarningThreshold) {
      warning = `Approaching hourly limit (${hourlyCount}/${this.settings.applicationsPerHour})`;
    } else if (dailyCount >= dailyWarningThreshold) {
      warning = `Approaching daily limit (${dailyCount}/${this.settings.applicationsPerDay})`;
    }

    return { allowed: true, warning };
  }

  private async checkCompanyApplicationLimit(jobLead: JobLead): Promise<{ allowed: boolean; reason?: string }> {
    if (!jobLead.companyName) {
      return { allowed: true };
    }

    const companyApplicationCount = await db.applicationSubmission.count({
      where: {
        userId: this.userId,
        jobLead: {
          companyName: jobLead.companyName,
        },
      },
    });

    if (companyApplicationCount >= this.settings.maxApplicationsPerCompany) {
      return {
        allowed: false,
        reason: `Maximum applications per company reached for "${jobLead.companyName}" (${companyApplicationCount}/${this.settings.maxApplicationsPerCompany})`
      };
    }

    return { allowed: true };
  }

  private async checkConsecutiveFailures(): Promise<{ allowed: boolean; reason?: string }> {
    if (!this.settings.pauseOnConsecutiveFailures) {
      return { allowed: true };
    }

    // Get the last N applications to check for consecutive failures
    const recentApplications = await db.applicationSubmission.findMany({
      where: {
        userId: this.userId,
        wasAutomated: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: this.settings.consecutiveFailureThreshold,
    });

    // If we don't have enough applications yet, allow
    if (recentApplications.length < this.settings.consecutiveFailureThreshold) {
      return { allowed: true };
    }

    // Check if all recent applications failed
    const allFailed = recentApplications.every(app => app.status === 'FAILED');

    if (allFailed) {
      return {
        allowed: false,
        reason: `Too many consecutive failures (${this.settings.consecutiveFailureThreshold}). Automation paused for safety.`
      };
    }

    return { allowed: true };
  }

  /**
   * Validates if a settings change is allowed
   */
  static validateSettingsChange(currentSettings: AutomationSettings, newSettings: Partial<AutomationSettings>): { allowed: boolean; reason?: string } {
    // Prevent disabling critical safety features when automation is active
    if (currentSettings.isEnabled && !currentSettings.isPaused) {
      if (newSettings.requireUserApproval === false && currentSettings.requireUserApproval === true) {
        return {
          allowed: false,
          reason: 'Cannot disable user approval while automation is active. Pause automation first.'
        };
      }

      if (newSettings.preventDuplicateApplications === false && currentSettings.preventDuplicateApplications === true) {
        return {
          allowed: false,
          reason: 'Cannot disable duplicate prevention while automation is active. Pause automation first.'
        };
      }
    }

    // Validate rate limits are reasonable
    if (newSettings.applicationsPerHour !== undefined && newSettings.applicationsPerHour > 50) {
      return {
        allowed: false,
        reason: 'Hourly application limit cannot exceed 50 for safety.'
      };
    }

    if (newSettings.applicationsPerDay !== undefined && newSettings.applicationsPerDay > 200) {
      return {
        allowed: false,
        reason: 'Daily application limit cannot exceed 200 for safety.'
      };
    }

    return { allowed: true };
  }
}

/**
 * Validate application safety for a specific job
 */
export async function validateApplicationSafety(
  userId: string,
  jobData: {
    jobId: string;
    jobUrl: string;
    company: string;
    title: string;
    salary?: number;
  }
): Promise<{ isValid: boolean; reason?: string; warnings?: string[] }> {
  const validator = await createSafetyValidator(userId);
  const result = await validator.validateJobApplication({
    id: jobData.jobId,
    title: jobData.title,
    companyName: jobData.company,
    url: jobData.jobUrl,
    salaryMin: jobData.salary,
  });

  return {
    isValid: result.isAllowed,
    reason: result.reason,
    warnings: result.warnings,
  };
}

/**
 * Utility function to create a safety validator instance
 */
export async function createSafetyValidator(userId: string): Promise<SafetyValidator> {
  const settings = await db.automationSettings.findUnique({
    where: { userId },
  });

  if (!settings) {
    throw new Error('Automation settings not found');
  }

  return new SafetyValidator(settings as AutomationSettings, userId);
}