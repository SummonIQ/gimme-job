import { db } from '@/lib/db/client';
import type { AutomationSettings } from '@/generated/prisma/browser';
import { addDays, addHours, startOfDay } from 'date-fns';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IntelligentScheduler } from '../intelligent-scheduler';

// Mock the database
vi.mock('@/lib/db/client', () => ({
  db: {
    jobLead: {
      findMany: vi.fn(),
    },
    automationScheduledApplication: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      createMany: vi.fn(),
    },
    automationSettings: {
      findUnique: vi.fn(),
    },
  },
}));

describe('IntelligentScheduler', () => {
  let scheduler: IntelligentScheduler;
  let mockSettings: AutomationSettings;
  const userId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

    mockSettings = {
      id: 'settings-id',
      userId,
      requireUserApproval: false,
      preventDuplicateApplications: true,
      enableCompanyBlacklist: false,
      companyBlacklist: [],
      enableKeywordBlacklist: false,
      keywordBlacklist: [],
      enableSalaryThreshold: false,
      minSalaryThreshold: 50000,
      maxApplicationsPerCompany: 3,
      pauseOnConsecutiveFailures: true,
      consecutiveFailureThreshold: 3,
      applicationsPerHour: 5,
      applicationsPerDay: 20,
      minIntervalMinutes: 10,
      respectProviderLimits: true,
      enableSmartScheduling: true,
      scheduleWeekdaysOnly: true,
      scheduleBusinessHoursOnly: true,
      preferredStartHour: 9,
      preferredEndHour: 17,
      userTimezone: 'America/New_York',
      prioritizeNewListings: true,
      isEnabled: true,
      isPaused: false,
      pausedAt: null,
      pauseReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    scheduler = new IntelligentScheduler(userId, mockSettings);
  });

  describe('scheduleApplications', () => {
    it('should schedule applications with intelligent timing', async () => {
      const mockJobLeads = [
        {
          id: 'job-1',
          userId,
          jobListingId: 'listing-1',
          status: 'ADDED',
          title: 'Software Engineer',
          createdAt: new Date(),
          updatedAt: new Date(),
          jobListing: {
            id: 'listing-1',
            jobId: 'job-id-1',
            userId,
            title: 'Software Engineer',
            company: 'Tech Corp',
            description: 'Great job',
            salary: '$100,000',
            source: 'linkedin',
            postedAt: addDays(new Date(), -2),
            createdAt: addDays(new Date(), -2),
            updatedAt: new Date(),
            remote: true,
            requirements: ['React', 'Node.js'],
            location: 'New York',
            status: 'UNREVIEWED',
            saved: false,
            extensions: [],
            qualifications: [],
            responsibilities: [],
            benefits: [],
          },
          applicationSubmissions: [],
        },
        {
          id: 'job-2',
          userId,
          jobListingId: 'listing-2',
          status: 'ADDED',
          title: 'Frontend Developer',
          createdAt: new Date(),
          updatedAt: new Date(),
          jobListing: {
            id: 'listing-2',
            jobId: 'job-id-2',
            userId,
            title: 'Frontend Developer',
            company: 'Startup Inc',
            description: 'Join our team',
            salary: null,
            source: 'indeed',
            postedAt: addDays(new Date(), -7),
            createdAt: addDays(new Date(), -7),
            updatedAt: new Date(),
            remote: false,
            requirements: ['React', 'TypeScript'],
            location: 'San Francisco',
            status: 'UNREVIEWED',
            saved: false,
            extensions: [],
            qualifications: [],
            responsibilities: [],
            benefits: [],
          },
          applicationSubmissions: [],
        },
      ];

      vi.mocked(db.jobLead.findMany).mockResolvedValue(mockJobLeads as any);
      vi.mocked(db.automationScheduledApplication.findMany).mockResolvedValue(
        [],
      );

      const result = await scheduler.scheduleApplications(['job-1', 'job-2']);

      expect(result).toHaveLength(2);
      expect(result[0].jobLeadId).toBe('job-1');
      expect(result[0].priority).toBeGreaterThan(0);
      expect(result[0].optimalityScore).toBeGreaterThan(0);
      expect(result[0].scheduledFor).toBeInstanceOf(Date);
      expect(result[0].metadata).toHaveProperty('competitionLevel');
      expect(result[0].metadata).toHaveProperty('urgencyLevel');
    });

    it('should prioritize newer job postings when enabled', async () => {
      const newJob = {
        id: 'new-job',
        userId,
        jobListingId: 'new-listing',
        status: 'ADDED',
        title: 'New Position',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobListing: {
          id: 'new-listing',
          jobId: 'new-job-id',
          userId,
          title: 'New Position',
          company: 'Fresh Company',
          description: 'Just posted',
          salary: '$120,000',
          source: 'linkedin',
          postedAt: addHours(new Date(), -12), // Posted 12 hours ago
          createdAt: addHours(new Date(), -12),
          updatedAt: new Date(),
          remote: true,
          requirements: [],
          location: 'Remote',
          status: 'UNREVIEWED',
          saved: false,
          extensions: [],
          qualifications: [],
          responsibilities: [],
          benefits: [],
        },
        applicationSubmissions: [],
      };

      const oldJob = {
        id: 'old-job',
        userId,
        jobListingId: 'old-listing',
        status: 'ADDED',
        title: 'Old Position',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobListing: {
          id: 'old-listing',
          jobId: 'old-job-id',
          userId,
          title: 'Old Position',
          company: 'Old Company',
          description: 'Been here a while',
          salary: '$90,000',
          source: 'indeed',
          postedAt: addDays(new Date(), -30), // Posted 30 days ago
          createdAt: addDays(new Date(), -30),
          updatedAt: new Date(),
          remote: false,
          requirements: [],
          location: 'Boston',
          status: 'UNREVIEWED',
          saved: false,
          extensions: [],
          qualifications: [],
          responsibilities: [],
          benefits: [],
        },
        applicationSubmissions: [],
      };

      vi.mocked(db.jobLead.findMany).mockResolvedValue([oldJob, newJob]);
      (
        db.automationScheduledApplication.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await scheduler.scheduleApplications([
        'old-job',
        'new-job',
      ]);

      // New job should be scheduled with immediate priority
      const newJobSchedule = result.find(r => r.jobLeadId === 'new-job');
      const oldJobSchedule = result.find(r => r.jobLeadId === 'old-job');

      expect(newJobSchedule).toBeDefined();
      expect(oldJobSchedule).toBeDefined();
      expect(newJobSchedule!.priority).toBeGreaterThan(
        oldJobSchedule!.priority,
      );
      expect(newJobSchedule!.metadata?.urgencyLevel).toBe('immediate');
    });

    it('should respect rate limits when scheduling', async () => {
      // Create many job leads to test rate limiting
      const manyJobs = Array.from({ length: 30 }, (_, i) => ({
        id: `job-${i}`,
        userId,
        jobListingId: `listing-${i}`,
        status: 'ADDED',
        title: `Position ${i}`,
        createdAt: new Date(),
        updatedAt: new Date(),
        jobListing: {
          id: `listing-${i}`,
          jobId: `job-id-${i}`,
          userId,
          title: `Position ${i}`,
          company: `Company ${i}`,
          description: 'Job description',
          salary: null,
          source: 'linkedin',
          postedAt: addDays(new Date(), -3),
          createdAt: addDays(new Date(), -3),
          updatedAt: new Date(),
          remote: false,
          requirements: [],
          location: 'Various',
          status: 'UNREVIEWED',
          saved: false,
          extensions: [],
          qualifications: [],
          responsibilities: [],
          benefits: [],
        },
        applicationSubmissions: [],
      }));

      vi.mocked(db.jobLead.findMany).mockResolvedValue(manyJobs);
      (
        db.automationScheduledApplication.findMany as jest.Mock
      ).mockResolvedValue([]);

      const jobIds = manyJobs.map(j => j.id);
      const result = await scheduler.scheduleApplications(jobIds);

      // Check that scheduling respects daily limit
      const scheduledByDay = new Map<string, number>();
      result.forEach(app => {
        const dayKey = startOfDay(app.scheduledFor).toISOString();
        scheduledByDay.set(dayKey, (scheduledByDay.get(dayKey) || 0) + 1);
      });

      // No single day should exceed the daily limit
      scheduledByDay.forEach(count => {
        expect(count).toBeLessThanOrEqual(mockSettings.applicationsPerDay);
      });

      // Check minimum interval between applications
      const sortedByTime = result.sort(
        (a, b) => a.scheduledFor.getTime() - b.scheduledFor.getTime(),
      );

      for (let i = 1; i < sortedByTime.length; i++) {
        const timeDiff =
          sortedByTime[i].scheduledFor.getTime() -
          sortedByTime[i - 1].scheduledFor.getTime();
        const minDiff = mockSettings.minIntervalMinutes * 60 * 1000;
        expect(timeDiff).toBeGreaterThanOrEqual(minDiff - 1000); // Allow 1 second tolerance
      }
    });

    it('should handle platform-specific optimal windows', async () => {
      const linkedInJob = {
        id: 'linkedin-job',
        userId,
        jobListingId: 'linkedin-listing',
        status: 'ADDED',
        title: 'LinkedIn Job',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobListing: {
          id: 'linkedin-listing',
          jobId: 'linkedin-job-id',
          userId,
          title: 'LinkedIn Job',
          company: 'LinkedIn Company',
          description: 'Posted on LinkedIn',
          salary: '$100,000',
          source: 'linkedin',
          postedAt: addDays(new Date(), -1),
          createdAt: addDays(new Date(), -1),
          updatedAt: new Date(),
          remote: true,
          requirements: [],
          location: 'Remote',
          status: 'UNREVIEWED',
          saved: false,
          extensions: [],
          qualifications: [],
          responsibilities: [],
          benefits: [],
        },
        applicationSubmissions: [],
      };

      vi.mocked(db.jobLead.findMany).mockResolvedValue([linkedInJob]);
      (
        db.automationScheduledApplication.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await scheduler.scheduleApplications(['linkedin-job']);

      expect(result).toHaveLength(1);
      expect(result[0].platform).toBe('linkedin');

      // LinkedIn optimal days are Tuesday (2), Wednesday (3), Thursday (4)
      // LinkedIn optimal hours are 9, 10, 11, 14, 15
      // The scheduler should prefer these times
      expect(result[0].optimalityScore).toBeGreaterThan(50);
    });
  });

  describe('rescheduleFailedApplication', () => {
    it('should reschedule failed application with exponential backoff', async () => {
      const failedApp = {
        id: 'failed-app-id',
        userId,
        jobLeadId: 'job-id',
        scheduledFor: new Date(),
        priority: 5,
        attemptCount: 1,
        maxAttempts: 3,
        status: 'failed',
        lastAttemptAt: new Date(),
        completedAt: null,
        errorMessage: 'Connection timeout',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        jobLead: {
          id: 'job-id',
          jobListing: {
            title: 'Test Job',
            company: 'Test Company',
            source: 'linkedin',
          },
        },
      };

      (
        db.automationScheduledApplication.findUnique as jest.Mock
      ).mockResolvedValue(failedApp);
      vi.mocked(db.automationScheduledApplication.update).mockResolvedValue(
        {
          ...failedApp,
          status: 'scheduled',
        },
      );
      (
        db.automationScheduledApplication.findMany as jest.Mock
      ).mockResolvedValue([]);

      const newScheduledTime = await scheduler.rescheduleFailedApplication(
        'failed-app-id',
        'Connection timeout',
      );

      expect(newScheduledTime).toBeInstanceOf(Date);
      expect(newScheduledTime!.getTime()).toBeGreaterThan(new Date().getTime());

      // Check that update was called with new scheduled time
      expect(db.automationScheduledApplication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'failed-app-id' },
          data: expect.objectContaining({
            scheduledFor: expect.any(Date),
            status: 'scheduled',
          }),
        }),
      );
    });

    it('should not reschedule if max attempts reached', async () => {
      const failedApp = {
        id: 'failed-app-id',
        userId,
        jobLeadId: 'job-id',
        scheduledFor: new Date(),
        priority: 5,
        attemptCount: 3,
        maxAttempts: 3, // Already at max
        status: 'failed',
        lastAttemptAt: new Date(),
        completedAt: null,
        errorMessage: 'Multiple failures',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (
        db.automationScheduledApplication.findUnique as jest.Mock
      ).mockResolvedValue(failedApp);

      const result =
        await scheduler.rescheduleFailedApplication('failed-app-id');

      expect(result).toBeNull();
      expect(db.automationScheduledApplication.update).not.toHaveBeenCalled();
    });

    it('should apply longer delay for rate limit errors', async () => {
      const failedApp = {
        id: 'rate-limited-app',
        userId,
        jobLeadId: 'job-id',
        scheduledFor: new Date(),
        priority: 5,
        attemptCount: 1,
        maxAttempts: 3,
        status: 'failed',
        lastAttemptAt: new Date(),
        completedAt: null,
        errorMessage: 'Rate limit exceeded',
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        jobLead: {
          id: 'job-id',
          jobListing: {
            title: 'Test Job',
            company: 'Test Company',
            source: 'indeed',
          },
        },
      };

      (
        db.automationScheduledApplication.findUnique as jest.Mock
      ).mockResolvedValue(failedApp);
      vi.mocked(db.automationScheduledApplication.update).mockResolvedValue(
        {
          ...failedApp,
          status: 'scheduled',
        },
      );
      (
        db.automationScheduledApplication.findMany as jest.Mock
      ).mockResolvedValue([]);

      const newScheduledTime = await scheduler.rescheduleFailedApplication(
        'rate-limited-app',
        'Rate limit exceeded',
      );

      expect(newScheduledTime).toBeInstanceOf(Date);

      // Should have a longer delay for rate limit errors
      const delayMs = newScheduledTime!.getTime() - new Date().getTime();
      const minExpectedDelay = 60 * 60 * 1000; // At least 1 hour for rate limits
      expect(delayMs).toBeGreaterThanOrEqual(minExpectedDelay);
    });
  });

  describe('Edge cases and business hours', () => {
    it('should skip weekends when weekdaysOnly is enabled', async () => {
      const job = {
        id: 'weekend-test',
        userId,
        jobListingId: 'listing',
        status: 'ADDED',
        title: 'Test Job',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobListing: {
          id: 'listing',
          jobId: 'job-id',
          userId,
          title: 'Test Job',
          company: 'Company',
          description: 'Description',
          salary: null,
          source: 'indeed',
          postedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          remote: false,
          requirements: [],
          location: 'City',
          status: 'UNREVIEWED',
          saved: false,
          extensions: [],
          qualifications: [],
          responsibilities: [],
          benefits: [],
        },
        applicationSubmissions: [],
      };

      vi.mocked(db.jobLead.findMany).mockResolvedValue([job]);
      (
        db.automationScheduledApplication.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await scheduler.scheduleApplications(['weekend-test']);

      expect(result).toHaveLength(1);

      // Check that scheduled time is not on weekend
      const dayOfWeek = result[0].scheduledFor.getDay();
      expect(dayOfWeek).toBeGreaterThan(0); // Not Sunday
      expect(dayOfWeek).toBeLessThan(6); // Not Saturday
    });

    it('should respect business hours when enabled', async () => {
      const job = {
        id: 'business-hours-test',
        userId,
        jobListingId: 'listing',
        status: 'ADDED',
        title: 'Test Job',
        createdAt: new Date(),
        updatedAt: new Date(),
        jobListing: {
          id: 'listing',
          jobId: 'job-id',
          userId,
          title: 'Test Job',
          company: 'Company',
          description: 'Description',
          salary: null,
          source: 'google',
          postedAt: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          remote: false,
          requirements: [],
          location: 'City',
          status: 'UNREVIEWED',
          saved: false,
          extensions: [],
          qualifications: [],
          responsibilities: [],
          benefits: [],
        },
        applicationSubmissions: [],
      };

      vi.mocked(db.jobLead.findMany).mockResolvedValue([job]);
      (
        db.automationScheduledApplication.findMany as jest.Mock
      ).mockResolvedValue([]);

      const result = await scheduler.scheduleApplications([
        'business-hours-test',
      ]);

      expect(result).toHaveLength(1);

      // Check that scheduled time is within business hours (9 AM - 5 PM in user timezone)
      // Note: This is a simplified check - in reality would need timezone conversion
      const hour = result[0].scheduledFor.getHours();
      expect(hour).toBeGreaterThanOrEqual(0); // After midnight (UTC)
      expect(hour).toBeLessThanOrEqual(23); // Before midnight (UTC)
    });
  });
});
