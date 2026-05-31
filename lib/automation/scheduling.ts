import { db } from '@/lib/db/client';
import type { AutomationSettings } from '@/generated/prisma/browser';
import {
  addHours,
  addMinutes,
  isWeekend,
  setHours,
  startOfHour,
} from 'date-fns';
import { fromZonedTime, toZonedTime } from 'date-fns-tz';
import { createAuditLog } from './audit';

interface SchedulingOptions {
  userId: string;
  jobLeadIds: string[];
  settings: AutomationSettings;
}

interface ScheduledApplication {
  jobLeadId: string;
  scheduledFor: Date;
  priority: number;
}

export class AutomationScheduler {
  private settings: AutomationSettings;
  private userId: string;

  constructor(userId: string, settings: AutomationSettings) {
    this.userId = userId;
    this.settings = settings;
  }

  /**
   * Schedule applications based on smart scheduling rules
   */
  async scheduleApplications(
    jobLeadIds: string[],
  ): Promise<ScheduledApplication[]> {
    const scheduled: ScheduledApplication[] = [];

    // Get job leads with metadata for prioritization
    const jobLeads = await db.jobLead.findMany({
      where: {
        id: { in: jobLeadIds },
        userId: this.userId,
      },
      include: {
        jobListing: true,
        applicationSubmissions: {
          where: { userId: this.userId },
        },
      },
    });

    // Filter out already applied jobs
    const unappliedLeads = jobLeads.filter(
      lead => lead.applicationSubmissions.length === 0,
    );

    // Sort by priority (newer listings first if enabled)
    const sortedLeads = this.prioritizeJobLeads(unappliedLeads);

    // Calculate scheduling slots
    const slots = this.calculateAvailableSlots(sortedLeads.length);

    // Assign jobs to slots
    sortedLeads.forEach((lead, index) => {
      if (index < slots.length) {
        scheduled.push({
          jobLeadId: lead.id,
          scheduledFor: slots[index],
          priority: sortedLeads.length - index, // Higher priority for earlier slots
        });
      }
    });

    return scheduled;
  }

  /**
   * Prioritize job leads based on settings and metadata
   */
  private prioritizeJobLeads(leads: any[]): any[] {
    return leads.sort((a, b) => {
      // Priority 1: Job posting age (if enabled)
      if (this.settings.prioritizeNewListings) {
        const ageA =
          new Date().getTime() -
          new Date(a.jobListing.postedAt || a.createdAt).getTime();
        const ageB =
          new Date().getTime() -
          new Date(b.jobListing.postedAt || b.createdAt).getTime();

        // Prefer newer listings
        if (ageA !== ageB) {
          return ageA - ageB;
        }
      }

      // Priority 2: Has company name (better quality listings)
      const hasCompanyA = Boolean(a.jobListing.companyName);
      const hasCompanyB = Boolean(b.jobListing.companyName);
      if (hasCompanyA !== hasCompanyB) {
        return hasCompanyB ? 1 : -1;
      }

      // Priority 3: Salary information available
      const hasSalaryA = Boolean(a.jobListing.salary);
      const hasSalaryB = Boolean(b.jobListing.salary);
      if (hasSalaryA !== hasSalaryB) {
        return hasSalaryB ? 1 : -1;
      }

      // Default: maintain original order
      return 0;
    });
  }

  /**
   * Calculate available time slots for applications
   */
  private calculateAvailableSlots(count: number): Date[] {
    const slots: Date[] = [];
    let currentTime = new Date();
    const maxDaysAhead = 7; // Schedule up to 7 days in advance
    const endTime = addHours(currentTime, 24 * maxDaysAhead);

    // Get user's timezone
    const timezone = this.settings.userTimezone;

    // Rate limiting constraints
    const minInterval = this.settings.minIntervalMinutes;
    const perHour = this.settings.applicationsPerHour;
    const perDay = this.settings.applicationsPerDay;

    // Track applications per day/hour for rate limiting
    const applicationsByDay = new Map<string, number>();
    const applicationsByHour = new Map<string, number>();

    while (slots.length < count && currentTime < endTime) {
      // Convert to user's timezone for business hours check
      const zonedTime = toZonedTime(currentTime, timezone);
      const hour = zonedTime.getHours();
      const dayKey = zonedTime.toISOString().split('T')[0];
      const hourKey = `${dayKey}-${hour}`;

      // Check if this slot is valid
      if (this.isValidSlot(zonedTime)) {
        // Check rate limits
        const dayCount = applicationsByDay.get(dayKey) || 0;
        const hourCount = applicationsByHour.get(hourKey) || 0;

        if (dayCount < perDay && hourCount < perHour) {
          // Convert back to UTC for storage
          const utcTime = fromZonedTime(zonedTime, timezone);
          slots.push(utcTime);

          // Update counters
          applicationsByDay.set(dayKey, dayCount + 1);
          applicationsByHour.set(hourKey, hourCount + 1);

          // Move to next slot respecting minimum interval
          currentTime = addMinutes(currentTime, minInterval);
        } else {
          // If hour limit reached, move to next hour
          if (hourCount >= perHour) {
            currentTime = addHours(startOfHour(currentTime), 1);
          } else {
            // If daily limit reached, move to next day
            currentTime = addHours(startOfHour(currentTime), 24);
            currentTime = setHours(
              currentTime,
              this.settings.preferredStartHour,
            );
          }
        }
      } else {
        // Move to next valid slot
        currentTime = this.getNextValidSlot(currentTime, timezone);
      }
    }

    return slots;
  }

  /**
   * Check if a time slot is valid based on settings
   */
  private isValidSlot(zonedTime: Date): boolean {
    const hour = zonedTime.getHours();
    const dayOfWeek = zonedTime.getDay();

    // Check weekday restriction
    if (this.settings.scheduleWeekdaysOnly && isWeekend(zonedTime)) {
      return false;
    }

    // Check business hours restriction
    if (this.settings.scheduleBusinessHoursOnly) {
      if (
        hour < this.settings.preferredStartHour ||
        hour >= this.settings.preferredEndHour
      ) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get the next valid time slot
   */
  private getNextValidSlot(currentTime: Date, timezone: string): Date {
    let nextTime = new Date(currentTime);
    const zonedTime = toZonedTime(nextTime, timezone);
    const hour = zonedTime.getHours();

    // If outside business hours, move to next business day
    if (this.settings.scheduleBusinessHoursOnly) {
      if (hour >= this.settings.preferredEndHour) {
        // Move to next day's start hour
        nextTime = addHours(
          nextTime,
          24 - hour + this.settings.preferredStartHour,
        );
      } else if (hour < this.settings.preferredStartHour) {
        // Move to today's start hour
        nextTime = setHours(nextTime, this.settings.preferredStartHour);
      }
    }

    // If weekend and weekdays only, move to Monday
    if (this.settings.scheduleWeekdaysOnly) {
      const zonedNext = toZonedTime(nextTime, timezone);
      if (isWeekend(zonedNext)) {
        const daysToMonday = zonedNext.getDay() === 0 ? 1 : 2;
        nextTime = addHours(nextTime, 24 * daysToMonday);
        nextTime = setHours(nextTime, this.settings.preferredStartHour);
      }
    }

    return nextTime;
  }

  /**
   * Reschedule failed applications
   */
  async rescheduleFailedApplication(
    applicationId: string,
  ): Promise<Date | null> {
    const application = await db.automationScheduledApplication.findUnique({
      where: { id: applicationId },
    });

    if (!application || application.attemptCount >= application.maxAttempts) {
      return null;
    }

    // Calculate backoff delay (exponential backoff)
    const delayMinutes = Math.pow(2, application.attemptCount) * 30; // 30, 60, 120 minutes
    const nextAttempt = addMinutes(new Date(), delayMinutes);

    // Find next valid slot after the delay
    const slots = this.calculateAvailableSlots(1);
    const validSlot = slots.find(slot => slot >= nextAttempt);

    return validSlot || null;
  }
}

/**
 * Create scheduled applications in the database
 */
export async function createScheduledApplications(
  userId: string,
  scheduledApps: ScheduledApplication[],
): Promise<void> {
  await db.automationScheduledApplication.createMany({
    data: scheduledApps.map(app => ({
      userId,
      jobLeadId: app.jobLeadId,
      scheduledFor: app.scheduledFor,
      priority: app.priority,
      status: 'scheduled',
    })),
  });
}

/**
 * Get upcoming scheduled applications
 */
export async function getUpcomingScheduledApplications(
  userId: string,
  limit = 10,
): Promise<any[]> {
  return await db.automationScheduledApplication.findMany({
    include: {
      user: {
        include: {
          automationSettings: true,
        },
      },
      jobLead: {
        include: {
          jobListing: true,
        },
      },
    },
    where: {
      userId,
      status: 'scheduled',
      scheduledFor: {
        gte: new Date(),
      },
    },
    orderBy: [{ scheduledFor: 'asc' }, { priority: 'desc' }],
    take: limit,
  });
}

/**
 * Process scheduled applications that are due
 */
export async function processScheduledApplications(): Promise<{
  processed: number;
  succeeded: number;
  failed: number;
}> {
  const results = { processed: 0, succeeded: 0, failed: 0 };

  const dueApplications = await db.automationScheduledApplication.findMany({
    where: {
      status: 'scheduled',
      scheduledFor: {
        lte: new Date(),
      },
    },
    include: {
      user: {
        include: {
          automationSettings: true,
        },
      },
      jobLead: {
        include: {
          jobListing: true,
        },
      },
    },
    orderBy: [{ priority: 'desc' }, { scheduledFor: 'asc' }],
    take: 10,
  });

  for (const app of dueApplications) {
    results.processed++;
    const startTime = Date.now();

    try {
      // Update status to processing
      await db.automationScheduledApplication.update({
        where: { id: app.id },
        data: {
          status: 'processing',
          lastAttemptAt: new Date(),
          attemptCount: { increment: 1 },
        },
      });

      // Audit log: started processing
      await createAuditLog({
        userId: app.userId,
        action: 'AUTOMATION_SUBMISSION_STARTED',
        details: {
          scheduledApplicationId: app.id,
          jobLeadId: app.jobLeadId,
          jobTitle: app.jobLead.jobListing.title,
          company: app.jobLead.jobListing.company,
          attemptNumber: app.attemptCount + 1,
        },
      });

      // Create application submission record using user's default resume
      const submission = await db.applicationSubmission.create({
        data: {
          jobLeadId: app.jobLeadId,
          userId: app.userId,
          resumeId: app.user.defaultResumeId,
          status: 'PENDING',
          wasAutomated: true,
          userAgent: 'gimme-job-automation/1.0',
          metadata: {
            scheduledApplicationId: app.id,
            scheduledFor: app.scheduledFor.toISOString(),
          },
        },
      });

      // Import and call the job board submission service
      const { submitToJobBoard } = await import('@/lib/applications/services');

      const jobProvider = app.jobLead.jobListing.jobProvider;
      if (!jobProvider) {
        throw new Error('No job provider specified for this listing');
      }

      const submissionResult = await submitToJobBoard(jobProvider, {
        jobId: app.jobLead.jobListing.jobId || '',
        jobUrl: app.jobLead.jobListing.jobProviderUrl || '',
        customFields: {},
      });

      if (submissionResult.success) {
        // Update application submission status
        await db.applicationSubmission.update({
          where: { id: submission.id },
          data: {
            status: 'SUBMITTED',
            submittedAt: new Date(),
            metadata: {
              scheduledApplicationId: app.id,
              confirmationCode: submissionResult.confirmationCode,
              submissionDetails: submissionResult.metadata,
            },
          },
        });

        // Update job lead status
        await db.jobLead.update({
          where: { id: app.jobLeadId },
          data: { status: 'APPLIED' },
        });

        // Mark scheduled application as completed
        await db.automationScheduledApplication.update({
          where: { id: app.id },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });

        results.succeeded++;

        // Audit log: success
        await createAuditLog({
          userId: app.userId,
          action: 'AUTOMATION_SUBMISSION_COMPLETED',
          details: {
            scheduledApplicationId: app.id,
            submissionId: submission.id,
            jobLeadId: app.jobLeadId,
            jobTitle: app.jobLead.jobListing.title,
            company: app.jobLead.jobListing.company,
            durationMs: Date.now() - startTime,
            confirmationCode: submissionResult.confirmationCode,
          },
        });
      } else {
        throw new Error(submissionResult.error || 'Submission failed');
      }
    } catch (error) {
      results.failed++;
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';

      console.error(
        `Failed to process scheduled application ${app.id}:`,
        error,
      );

      // Update with error
      await db.automationScheduledApplication.update({
        where: { id: app.id },
        data: {
          status: 'failed',
          errorMessage,
        },
      });

      // Audit log: failure
      await createAuditLog({
        userId: app.userId,
        action: 'AUTOMATION_SUBMISSION_FAILED',
        details: {
          scheduledApplicationId: app.id,
          jobLeadId: app.jobLeadId,
          jobTitle: app.jobLead.jobListing.title,
          company: app.jobLead.jobListing.company,
          error: errorMessage,
          attemptNumber: app.attemptCount + 1,
          durationMs: Date.now() - startTime,
        },
      });

      // Try to reschedule if attempts remain
      if (app.user.automationSettings) {
        const scheduler = new AutomationScheduler(
          app.userId,
          app.user.automationSettings,
        );
        const nextSlot = await scheduler.rescheduleFailedApplication(app.id);

        if (nextSlot) {
          await db.automationScheduledApplication.update({
            where: { id: app.id },
            data: {
              status: 'scheduled',
              scheduledFor: nextSlot,
            },
          });

          // Audit log: rescheduled
          await createAuditLog({
            userId: app.userId,
            action: 'AUTOMATION_SUBMISSION_RESCHEDULED',
            details: {
              scheduledApplicationId: app.id,
              jobLeadId: app.jobLeadId,
              nextAttemptAt: nextSlot.toISOString(),
              attemptNumber: app.attemptCount + 2,
            },
          });
        }
      }
    }
  }

  return results;
}
