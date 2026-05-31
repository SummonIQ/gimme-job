import { db } from '@/lib/db/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AutomationSettings, JobLead } from '../safety-validator';
import { SafetyValidator } from '../safety-validator';

// Mock the database module
vi.mock('@/lib/db/client', () => ({
  db: {
    applicationSubmission: {
      findFirst: vi.fn(),
      count: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

// Reference the mocked db
const mockDb = db as any;

describe('SafetyValidator', () => {
  const mockUserId = 'test-user-id';
  const defaultSettings: AutomationSettings = {
    requireUserApproval: true,
    preventDuplicateApplications: true,
    enableCompanyBlacklist: true,
    companyBlacklist: ['BadCompany Inc', 'ScamCorp'],
    enableKeywordBlacklist: true,
    keywordBlacklist: ['unpaid', 'internship', 'commission only'],
    enableSalaryThreshold: true,
    minSalaryThreshold: 50000,
    maxApplicationsPerCompany: 3,
    pauseOnConsecutiveFailures: true,
    consecutiveFailureThreshold: 3,
    applicationsPerHour: 10,
    applicationsPerDay: 50,
    isEnabled: true,
    isPaused: false,
  };

  const mockJobLead: JobLead = {
    id: 'job-123',
    title: 'Software Engineer',
    companyName: 'TechCorp',
    description: 'Great opportunity for experienced developers',
    salaryMin: 80000,
    salaryMax: 120000,
    location: 'San Francisco, CA',
    url: 'https://example.com/job/123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Default mocks for successful validation
    mockDb.applicationSubmission.findFirst.mockResolvedValue(null);
    mockDb.applicationSubmission.count.mockResolvedValue(0);
    mockDb.applicationSubmission.findMany.mockResolvedValue([]);
  });

  describe('Critical Safety Controls', () => {
    it('should block applications when automation is disabled', async () => {
      const settings = { ...defaultSettings, isEnabled: false };
      const validator = new SafetyValidator(settings, mockUserId);

      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Automation is disabled');
      expect(result.riskLevel).toBe('high');
      expect(result.blockedBy).toContain('System Control');
    });

    it('should block applications when automation is paused', async () => {
      const settings = { ...defaultSettings, isPaused: true };
      const validator = new SafetyValidator(settings, mockUserId);

      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Automation is paused');
      expect(result.riskLevel).toBe('high');
      expect(result.blockedBy).toContain('System Control');
    });

    it('should block duplicate applications', async () => {
      mockDb.applicationSubmission.findFirst.mockResolvedValue({
        id: 'existing-app',
      });

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toBe('Duplicate application detected');
      expect(result.riskLevel).toBe('medium');
      expect(result.blockedBy).toContain('Duplicate Prevention');
    });
  });

  describe('Company Blacklist', () => {
    it('should block applications to blacklisted companies', async () => {
      const blacklistedJob = { ...mockJobLead, companyName: 'BadCompany Inc' };
      const validator = new SafetyValidator(defaultSettings, mockUserId);

      const result = await validator.validateJobApplication(blacklistedJob);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('BadCompany Inc');
      expect(result.reason).toContain('blacklist');
      expect(result.blockedBy).toContain('Company Blacklist');
    });

    it('should block applications with partial company name matches', async () => {
      const partialMatchJob = {
        ...mockJobLead,
        companyName: 'BadCompany Inc Solutions',
      };
      const validator = new SafetyValidator(defaultSettings, mockUserId);

      const result = await validator.validateJobApplication(partialMatchJob);

      expect(result.isAllowed).toBe(false);
      expect(result.blockedBy).toContain('Company Blacklist');
    });
  });

  describe('Keyword Blacklist', () => {
    it('should block jobs with blacklisted keywords in title', async () => {
      const keywordJob = {
        ...mockJobLead,
        title: 'Unpaid Software Engineer Internship',
      };
      const validator = new SafetyValidator(defaultSettings, mockUserId);

      const result = await validator.validateJobApplication(keywordJob);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('blacklisted keywords');
      expect(result.reason).toContain('unpaid');
      expect(result.reason).toContain('internship');
      expect(result.blockedBy).toContain('Keyword Blacklist');
    });

    it('should block jobs with blacklisted keywords in description', async () => {
      const keywordJob = {
        ...mockJobLead,
        description: 'This is a commission only position with great potential',
      };
      const validator = new SafetyValidator(defaultSettings, mockUserId);

      const result = await validator.validateJobApplication(keywordJob);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('commission only');
      expect(result.blockedBy).toContain('Keyword Blacklist');
    });
  });

  describe('Salary Threshold', () => {
    it('should block jobs below salary threshold', async () => {
      const lowSalaryJob = {
        ...mockJobLead,
        salaryMin: 30000,
        salaryMax: 40000,
      };
      const validator = new SafetyValidator(defaultSettings, mockUserId);

      const result = await validator.validateJobApplication(lowSalaryJob);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('below minimum threshold');
      expect(result.reason).toContain('40000');
      expect(result.reason).toContain('50000');
      expect(result.blockedBy).toContain('Salary Threshold');
    });

    it('should allow jobs above salary threshold', async () => {
      const goodSalaryJob = {
        ...mockJobLead,
        salaryMin: 60000,
        salaryMax: 80000,
      };
      const validator = new SafetyValidator(defaultSettings, mockUserId);

      const result = await validator.validateJobApplication(goodSalaryJob);

      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Rate Limiting', () => {
    it('should block when hourly limit is exceeded', async () => {
      mockDb.applicationSubmission.count
        .mockResolvedValueOnce(10) // hourly count
        .mockResolvedValueOnce(20); // daily count

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('Hourly rate limit exceeded');
      expect(result.reason).toContain('10/10');
      expect(result.riskLevel).toBe('high');
      expect(result.blockedBy).toContain('Rate Limiting');
    });

    it('should block when daily limit is exceeded', async () => {
      mockDb.applicationSubmission.count
        .mockResolvedValueOnce(5) // hourly count
        .mockResolvedValueOnce(50); // daily count

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('Daily rate limit exceeded');
      expect(result.reason).toContain('50/50');
      expect(result.riskLevel).toBe('high');
    });

    it('should warn when approaching rate limits', async () => {
      mockDb.applicationSubmission.count
        .mockResolvedValueOnce(8) // 80% of hourly limit (8/10)
        .mockResolvedValueOnce(20); // Daily count

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(true);
      expect(result.warnings).toContain('Approaching hourly limit (8/10)');
      expect(result.riskLevel).toBe('medium');
    });
  });

  describe('Company Application Limits', () => {
    it('should block when max applications per company is reached', async () => {
      mockDb.applicationSubmission.count
        .mockResolvedValueOnce(0) // hourly count
        .mockResolvedValueOnce(0) // daily count
        .mockResolvedValueOnce(3); // company count

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain(
        'Maximum applications per company reached',
      );
      expect(result.reason).toContain('TechCorp');
      expect(result.reason).toContain('3/3');
      expect(result.blockedBy).toContain('Company Limit');
    });
  });

  describe('Consecutive Failures', () => {
    it('should block when too many consecutive failures', async () => {
      const failedApplications = [
        { status: 'FAILED' },
        { status: 'FAILED' },
        { status: 'FAILED' },
      ];

      mockDb.applicationSubmission.findMany.mockResolvedValue(
        failedApplications,
      );

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(false);
      expect(result.reason).toContain('Too many consecutive failures');
      expect(result.reason).toContain('3');
      expect(result.riskLevel).toBe('high');
      expect(result.blockedBy).toContain('Failure Prevention');
    });

    it('should allow when recent applications include successes', async () => {
      const mixedApplications = [
        { status: 'FAILED' },
        { status: 'SUBMITTED' },
        { status: 'FAILED' },
      ];

      mockDb.applicationSubmission.findMany.mockResolvedValue(
        mixedApplications,
      );

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(true);
    });
  });

  describe('Settings Validation', () => {
    it('should prevent disabling user approval while automation is active', () => {
      const currentSettings = {
        ...defaultSettings,
        isEnabled: true,
        isPaused: false,
      };
      const newSettings = { requireUserApproval: false };

      const result = SafetyValidator.validateSettingsChange(
        currentSettings,
        newSettings,
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        'Cannot disable user approval while automation is active',
      );
    });

    it('should prevent disabling duplicate prevention while automation is active', () => {
      const currentSettings = {
        ...defaultSettings,
        isEnabled: true,
        isPaused: false,
      };
      const newSettings = { preventDuplicateApplications: false };

      const result = SafetyValidator.validateSettingsChange(
        currentSettings,
        newSettings,
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain(
        'Cannot disable duplicate prevention while automation is active',
      );
    });

    it('should prevent setting unreasonable rate limits', () => {
      const currentSettings = defaultSettings;

      const hourlyResult = SafetyValidator.validateSettingsChange(
        currentSettings,
        { applicationsPerHour: 100 },
      );
      expect(hourlyResult.allowed).toBe(false);
      expect(hourlyResult.reason).toContain(
        'Hourly application limit cannot exceed 50',
      );

      const dailyResult = SafetyValidator.validateSettingsChange(
        currentSettings,
        { applicationsPerDay: 500 },
      );
      expect(dailyResult.allowed).toBe(false);
      expect(dailyResult.reason).toContain(
        'Daily application limit cannot exceed 200',
      );
    });

    it('should allow settings changes when automation is paused', () => {
      const currentSettings = {
        ...defaultSettings,
        isEnabled: true,
        isPaused: true,
      };
      const newSettings = { requireUserApproval: false };

      const result = SafetyValidator.validateSettingsChange(
        currentSettings,
        newSettings,
      );

      expect(result.allowed).toBe(true);
    });
  });

  describe('Comprehensive Safety Validation', () => {
    it('should pass a completely safe job application', async () => {
      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(mockJobLead);

      expect(result.isAllowed).toBe(true);
      expect(result.riskLevel).toBe('low');
      expect(result.blockedBy).toHaveLength(0);
    });

    it('should handle jobs with missing salary information gracefully', async () => {
      const noSalaryJob = {
        ...mockJobLead,
        salaryMin: undefined,
        salaryMax: undefined,
      };
      const validator = new SafetyValidator(defaultSettings, mockUserId);

      const result = await validator.validateJobApplication(noSalaryJob);

      expect(result.isAllowed).toBe(true); // Should not be blocked for missing salary
    });

    it('should handle edge cases in company and keyword matching', async () => {
      const edgeCaseJob = {
        ...mockJobLead,
        companyName: '  BADCOMPANY INC  ', // Different case and whitespace
        title: 'UNPAID internship', // Different case
      };

      const validator = new SafetyValidator(defaultSettings, mockUserId);
      const result = await validator.validateJobApplication(edgeCaseJob);

      expect(result.isAllowed).toBe(false);
      // Should be blocked by both company blacklist and keyword blacklist
    });
  });
});
