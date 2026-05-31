import { db } from '@/lib/db/client';
import { 
  addHours, 
  addMinutes, 
  isWeekend, 
  setHours, 
  startOfHour,
  differenceInDays,
  differenceInHours,
  isWithinInterval,
  startOfDay,
  endOfDay,
  isSameDay,
  addDays
} from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type { AutomationSettings, JobLead, JobListing } from '@/generated/prisma/browser';
import { getUserTimezone, formatDateTimeInTimezone } from '@/lib/time/timezone';

interface PlatformWindow {
  platform: string;
  optimalHours: number[];
  optimalDays: number[]; // 0 = Sunday, 1 = Monday, etc.
  avoidHours?: number[];
  boostFactor: number; // Priority multiplier for optimal times
}

interface SchedulingMetrics {
  competitionLevel: number; // 0-1, based on posting age and application count
  urgency: number; // 0-1, based on days since posted
  qualityScore: number; // 0-1, based on job details completeness
  platformScore: number; // 0-1, based on platform reliability
}

interface JobWithMetrics extends JobLead {
  jobListing: JobListing;
  metrics: SchedulingMetrics;
  estimatedApplicationCount?: number;
}

interface ScheduledApplication {
  jobLeadId: string;
  scheduledFor: Date;
  priority: number;
  platform?: string;
  optimalityScore: number; // 0-100, how optimal is this time slot
  metadata?: {
    competitionLevel: string;
    urgencyLevel: string;
    schedulingReason: string;
    estimatedVisibility: string;
  };
}

// Platform-specific optimal submission windows based on industry research
const PLATFORM_WINDOWS: Record<string, PlatformWindow> = {
  linkedin: {
    platform: 'LinkedIn',
    optimalHours: [9, 10, 11, 14, 15], // Morning and early afternoon
    optimalDays: [2, 3, 4], // Tuesday, Wednesday, Thursday
    avoidHours: [12, 13], // Lunch hours
    boostFactor: 1.5,
  },
  indeed: {
    platform: 'Indeed',
    optimalHours: [8, 9, 10, 11], // Early morning
    optimalDays: [1, 2, 3, 4, 5], // Weekdays
    boostFactor: 1.3,
  },
  google: {
    platform: 'Google Jobs',
    optimalHours: [9, 10, 11, 14, 15, 16], // Business hours
    optimalDays: [1, 2, 3, 4], // Monday-Thursday
    boostFactor: 1.4,
  },
  career_builder: {
    platform: 'CareerBuilder',
    optimalHours: [8, 9, 10, 15, 16], // Early morning and mid-afternoon
    optimalDays: [1, 2, 3], // Monday-Wednesday
    boostFactor: 1.2,
  },
  default: {
    platform: 'Default',
    optimalHours: [9, 10, 11, 14, 15],
    optimalDays: [1, 2, 3, 4, 5],
    boostFactor: 1.0,
  },
};

export class IntelligentScheduler {
  private settings: AutomationSettings;
  private userId: string;
  private timezone: string;

  constructor(userId: string, settings: AutomationSettings) {
    this.userId = userId;
    this.settings = settings;
    this.timezone = settings.userTimezone || 'America/New_York';
  }

  /**
   * Intelligently schedule applications based on multiple factors
   */
  async scheduleApplications(
    jobLeadIds: string[],
    options?: {
      forceImmediate?: string[]; // Job IDs to schedule immediately
      maxDaysAhead?: number;
      considerCompetition?: boolean;
    }
  ): Promise<ScheduledApplication[]> {
    const scheduled: ScheduledApplication[] = [];
    const maxDaysAhead = options?.maxDaysAhead ?? 7;
    
    // Fetch job leads with full metadata
    const jobLeads = await this.fetchJobLeadsWithMetrics(jobLeadIds);
    
    // Separate immediate vs. schedulable jobs
    const immediateJobs = jobLeads.filter(job => 
      options?.forceImmediate?.includes(job.id) || 
      this.requiresImmediateApplication(job)
    );
    
    const schedulableJobs = jobLeads.filter(job => 
      !immediateJobs.includes(job)
    );
    
    // Schedule immediate jobs first
    const immediateSlots = await this.scheduleImmediateApplications(immediateJobs);
    scheduled.push(...immediateSlots);
    
    // Intelligently schedule remaining jobs
    const intelligentSlots = await this.scheduleIntelligentApplications(
      schedulableJobs,
      maxDaysAhead,
      options?.considerCompetition ?? true
    );
    scheduled.push(...intelligentSlots);
    
    return scheduled;
  }

  /**
   * Fetch job leads with calculated metrics
   */
  private async fetchJobLeadsWithMetrics(jobLeadIds: string[]): Promise<JobWithMetrics[]> {
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

    // Filter out already applied jobs and calculate metrics
    return jobLeads
      .filter(lead => lead.applicationSubmissions.length === 0)
      .map(lead => ({
        ...lead,
        metrics: this.calculateJobMetrics(lead),
        estimatedApplicationCount: this.estimateApplicationCount(lead.jobListing),
      }));
  }

  /**
   * Calculate scheduling metrics for a job
   */
  private calculateJobMetrics(job: any): SchedulingMetrics {
    const now = new Date();
    const postedDate = job.jobListing.postedAt || job.jobListing.createdAt;
    const daysSincePosted = differenceInDays(now, new Date(postedDate));
    
    // Competition level (newer = less competition)
    const competitionLevel = Math.min(1, daysSincePosted / 30);
    
    // Urgency (older postings need quicker application)
    const urgency = daysSincePosted <= 3 ? 0.9 : 
                   daysSincePosted <= 7 ? 0.7 :
                   daysSincePosted <= 14 ? 0.5 :
                   daysSincePosted <= 30 ? 0.3 : 0.1;
    
    // Quality score based on job details
    const hasCompany = job.jobListing.company ? 0.3 : 0;
    const hasSalary = job.jobListing.salary ? 0.3 : 0;
    const hasDescription = job.jobListing.description ? 0.2 : 0;
    const hasRequirements = job.jobListing.requirements?.length > 0 ? 0.2 : 0;
    const qualityScore = hasCompany + hasSalary + hasDescription + hasRequirements;
    
    // Platform score
    const platformScore = this.getPlatformReliabilityScore(job.jobListing.source);
    
    return {
      competitionLevel,
      urgency,
      qualityScore,
      platformScore,
    };
  }

  /**
   * Estimate application count based on posting age and platform
   */
  private estimateApplicationCount(listing: JobListing): number {
    const daysSincePosted = differenceInDays(
      new Date(), 
      new Date(listing.postedAt || listing.createdAt)
    );
    
    // Base estimates by platform
    const platformBaseRates: Record<string, number> = {
      linkedin: 50,
      indeed: 40,
      google: 35,
      career_builder: 25,
      default: 30,
    };
    
    const platform = listing.source?.toLowerCase() || 'default';
    const baseRate = platformBaseRates[platform] || platformBaseRates.default;
    
    // Estimate based on days and platform
    const estimate = baseRate * Math.sqrt(daysSincePosted + 1);
    
    // Adjust for remote jobs (typically get more applications)
    const remoteMultiplier = listing.remote ? 1.5 : 1.0;
    
    return Math.round(estimate * remoteMultiplier);
  }

  /**
   * Check if a job requires immediate application
   */
  private requiresImmediateApplication(job: JobWithMetrics): boolean {
    // Apply immediately if:
    // 1. Posted within last 24 hours (first-mover advantage)
    // 2. Very high urgency score
    // 3. Estimated high competition
    
    const hoursSincePosted = differenceInHours(
      new Date(),
      new Date(job.jobListing.postedAt || job.jobListing.createdAt)
    );
    
    return hoursSincePosted <= 24 || 
           job.metrics.urgency >= 0.9 ||
           (job.estimatedApplicationCount && job.estimatedApplicationCount > 200);
  }

  /**
   * Schedule immediate applications
   */
  private async scheduleImmediateApplications(
    jobs: JobWithMetrics[]
  ): Promise<ScheduledApplication[]> {
    const scheduled: ScheduledApplication[] = [];
    let nextSlot = addMinutes(new Date(), 1); // Start 1 minute from now
    
    for (const job of jobs) {
      scheduled.push({
        jobLeadId: job.id,
        scheduledFor: nextSlot,
        priority: 1000, // Highest priority
        platform: job.jobListing.source || undefined,
        optimalityScore: 95, // High score for immediate applications
        metadata: {
          competitionLevel: 'high',
          urgencyLevel: 'immediate',
          schedulingReason: 'First-mover advantage or high urgency',
          estimatedVisibility: 'high',
        },
      });
      
      // Space out immediate applications by minimum interval
      nextSlot = addMinutes(nextSlot, this.settings.minIntervalMinutes);
    }
    
    return scheduled;
  }

  /**
   * Intelligently schedule applications for optimal timing
   */
  private async scheduleIntelligentApplications(
    jobs: JobWithMetrics[],
    maxDaysAhead: number,
    considerCompetition: boolean
  ): Promise<ScheduledApplication[]> {
    const scheduled: ScheduledApplication[] = [];
    
    // Sort jobs by composite priority score
    const prioritizedJobs = this.prioritizeJobs(jobs, considerCompetition);
    
    // Generate optimal time slots
    const availableSlots = await this.generateOptimalSlots(
      prioritizedJobs.length,
      maxDaysAhead
    );
    
    // Match jobs to slots based on their characteristics
    for (let i = 0; i < prioritizedJobs.length && i < availableSlots.length; i++) {
      const job = prioritizedJobs[i];
      const slot = this.findBestSlotForJob(job, availableSlots.slice(i));
      
      if (slot) {
        scheduled.push({
          jobLeadId: job.id,
          scheduledFor: slot.time,
          priority: prioritizedJobs.length - i,
          platform: job.jobListing.source || undefined,
          optimalityScore: slot.score,
          metadata: {
            competitionLevel: this.getCompetitionLevel(job.metrics.competitionLevel),
            urgencyLevel: this.getUrgencyLevel(job.metrics.urgency),
            schedulingReason: slot.reason,
            estimatedVisibility: this.estimateVisibility(slot.score),
          },
        });
      }
    }
    
    return scheduled;
  }

  /**
   * Prioritize jobs based on multiple factors
   */
  private prioritizeJobs(
    jobs: JobWithMetrics[],
    considerCompetition: boolean
  ): JobWithMetrics[] {
    return jobs.sort((a, b) => {
      // Calculate composite priority scores
      const scoreA = this.calculatePriorityScore(a, considerCompetition);
      const scoreB = this.calculatePriorityScore(b, considerCompetition);
      
      return scoreB - scoreA; // Higher score = higher priority
    });
  }

  /**
   * Calculate priority score for a job
   */
  private calculatePriorityScore(
    job: JobWithMetrics,
    considerCompetition: boolean
  ): number {
    let score = 0;
    
    // Urgency weight (40%)
    score += job.metrics.urgency * 40;
    
    // Quality weight (30%)
    score += job.metrics.qualityScore * 30;
    
    // Platform reliability (20%)
    score += job.metrics.platformScore * 20;
    
    // Competition consideration (10%)
    if (considerCompetition) {
      // Lower competition = higher priority
      score += (1 - job.metrics.competitionLevel) * 10;
    }
    
    // Boost for jobs with salary info
    if (job.jobListing.salary) {
      score += 5;
    }
    
    // Boost for remote jobs if user prefers remote
    const userPreferences = this.settings.enableSmartScheduling;
    if (userPreferences && job.jobListing.remote) {
      score += 5;
    }
    
    return score;
  }

  /**
   * Generate optimal time slots based on platform best practices
   */
  private async generateOptimalSlots(
    count: number,
    maxDaysAhead: number
  ): Promise<Array<{ time: Date; score: number; reason: string }>> {
    const slots: Array<{ time: Date; score: number; reason: string }> = [];
    const now = new Date();
    const endDate = addDays(now, maxDaysAhead);
    
    // Get existing scheduled applications to avoid conflicts
    const existingScheduled = await this.getExistingScheduledApplications(
      now,
      endDate
    );
    
    // Generate candidate slots
    let currentTime = addHours(now, 1); // Start 1 hour from now
    
    while (slots.length < count * 3 && currentTime < endDate) { // Generate 3x slots for selection
      const zonedTime = toZonedTime(currentTime, this.timezone);
      const hour = zonedTime.getHours();
      const dayOfWeek = zonedTime.getDay();
      
      // Check if this is a valid business time
      if (this.isValidBusinessTime(zonedTime)) {
        // Calculate optimality score for this slot
        const slotScore = this.calculateSlotOptimalityScore(
          zonedTime,
          existingScheduled
        );
        
        if (slotScore.score > 0) {
          slots.push({
            time: fromZonedTime(zonedTime, this.timezone),
            score: slotScore.score,
            reason: slotScore.reason,
          });
        }
      }
      
      // Move to next potential slot
      currentTime = addMinutes(currentTime, 30); // Check every 30 minutes
    }
    
    // Sort by score and return top slots
    return slots
      .sort((a, b) => b.score - a.score)
      .slice(0, count);
  }

  /**
   * Get existing scheduled applications in date range
   */
  private async getExistingScheduledApplications(
    startDate: Date,
    endDate: Date
  ): Promise<Date[]> {
    const scheduled = await db.automationScheduledApplication.findMany({
      where: {
        userId: this.userId,
        scheduledFor: {
          gte: startDate,
          lte: endDate,
        },
        status: { in: ['scheduled', 'processing'] },
      },
      select: {
        scheduledFor: true,
      },
    });
    
    return scheduled.map(s => s.scheduledFor);
  }

  /**
   * Calculate optimality score for a time slot
   */
  private calculateSlotOptimalityScore(
    zonedTime: Date,
    existingScheduled: Date[]
  ): { score: number; reason: string } {
    let score = 50; // Base score
    let reasons: string[] = [];
    
    const hour = zonedTime.getHours();
    const dayOfWeek = zonedTime.getDay();
    
    // Check platform-specific optimal windows
    const optimalWindows = Object.values(PLATFORM_WINDOWS);
    for (const window of optimalWindows) {
      if (window.optimalDays.includes(dayOfWeek)) {
        score += 10;
        if (window.optimalHours.includes(hour)) {
          score += 20 * window.boostFactor;
          reasons.push(`Optimal ${window.platform} window`);
        }
        if (window.avoidHours?.includes(hour)) {
          score -= 15;
          reasons.push(`Avoid ${window.platform} lunch hours`);
        }
      }
    }
    
    // Early week bonus (Monday-Wednesday)
    if (dayOfWeek >= 1 && dayOfWeek <= 3) {
      score += 10;
      reasons.push('Early week advantage');
    }
    
    // Morning bonus (8-11 AM)
    if (hour >= 8 && hour <= 11) {
      score += 15;
      reasons.push('Morning visibility boost');
    }
    
    // Avoid late Friday and weekends
    if (dayOfWeek === 5 && hour >= 15) {
      score -= 20;
      reasons.push('Late Friday - low engagement');
    }
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      score -= 30;
      reasons.push('Weekend - reduced visibility');
    }
    
    // Check for slot conflicts
    const hasConflict = existingScheduled.some(scheduled => {
      const timeDiff = Math.abs(scheduled.getTime() - zonedTime.getTime());
      return timeDiff < this.settings.minIntervalMinutes * 60 * 1000;
    });
    
    if (hasConflict) {
      score -= 50;
      reasons.push('Too close to existing application');
    }
    
    // Rate limit considerations
    const sameHourCount = existingScheduled.filter(scheduled => 
      isSameDay(scheduled, zonedTime) && 
      scheduled.getHours() === hour
    ).length;
    
    if (sameHourCount >= this.settings.applicationsPerHour) {
      score = 0;
      reasons.push('Hourly rate limit reached');
    }
    
    const sameDayCount = existingScheduled.filter(scheduled => 
      isSameDay(scheduled, zonedTime)
    ).length;
    
    if (sameDayCount >= this.settings.applicationsPerDay) {
      score = 0;
      reasons.push('Daily rate limit reached');
    }
    
    return {
      score: Math.max(0, Math.min(100, score)),
      reason: reasons.join('; ') || 'Standard scheduling',
    };
  }

  /**
   * Find the best slot for a specific job
   */
  private findBestSlotForJob(
    job: JobWithMetrics,
    availableSlots: Array<{ time: Date; score: number; reason: string }>
  ): { time: Date; score: number; reason: string } | null {
    if (availableSlots.length === 0) return null;
    
    // For high urgency jobs, take the first available slot
    if (job.metrics.urgency >= 0.8) {
      return availableSlots[0];
    }
    
    // For platform-specific jobs, prefer platform-optimal slots
    const platform = job.jobListing.source?.toLowerCase();
    if (platform && PLATFORM_WINDOWS[platform]) {
      const platformWindow = PLATFORM_WINDOWS[platform];
      
      // Find slots that match platform preferences
      const platformOptimalSlots = availableSlots.filter(slot => {
        const zonedTime = toZonedTime(slot.time, this.timezone);
        const hour = zonedTime.getHours();
        const day = zonedTime.getDay();
        
        return platformWindow.optimalDays.includes(day) &&
               platformWindow.optimalHours.includes(hour);
      });
      
      if (platformOptimalSlots.length > 0) {
        return platformOptimalSlots[0];
      }
    }
    
    // Default: return highest scoring slot
    return availableSlots.reduce((best, current) => 
      current.score > best.score ? current : best
    );
  }

  /**
   * Check if time is valid business hours
   */
  private isValidBusinessTime(zonedTime: Date): boolean {
    const hour = zonedTime.getHours();
    const dayOfWeek = zonedTime.getDay();
    
    // Check weekday restriction
    if (this.settings.scheduleWeekdaysOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
      return false;
    }
    
    // Check business hours restriction
    if (this.settings.scheduleBusinessHoursOnly) {
      if (hour < this.settings.preferredStartHour || hour >= this.settings.preferredEndHour) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Get platform reliability score
   */
  private getPlatformReliabilityScore(source: string | null): number {
    const scores: Record<string, number> = {
      linkedin: 0.9,
      indeed: 0.85,
      google: 0.8,
      career_builder: 0.75,
      default: 0.7,
    };
    
    const platform = source?.toLowerCase() || 'default';
    return scores[platform] || scores.default;
  }

  /**
   * Get competition level description
   */
  private getCompetitionLevel(level: number): string {
    if (level >= 0.8) return 'very high';
    if (level >= 0.6) return 'high';
    if (level >= 0.4) return 'moderate';
    if (level >= 0.2) return 'low';
    return 'very low';
  }

  /**
   * Get urgency level description
   */
  private getUrgencyLevel(urgency: number): string {
    if (urgency >= 0.8) return 'immediate';
    if (urgency >= 0.6) return 'high';
    if (urgency >= 0.4) return 'moderate';
    if (urgency >= 0.2) return 'low';
    return 'very low';
  }

  /**
   * Estimate visibility based on optimality score
   */
  private estimateVisibility(score: number): string {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'high';
    if (score >= 40) return 'moderate';
    if (score >= 20) return 'low';
    return 'poor';
  }

  /**
   * Reschedule failed application with intelligent backoff
   */
  async rescheduleFailedApplication(
    applicationId: string,
    reason?: string
  ): Promise<Date | null> {
    const application = await db.automationScheduledApplication.findUnique({
      where: { id: applicationId },
      include: {
        jobLead: {
          include: {
            jobListing: true,
          },
        },
      },
    });

    if (!application || application.attemptCount >= application.maxAttempts) {
      return null;
    }

    // Calculate intelligent backoff based on failure reason
    const baseDelay = 30; // Base 30 minutes
    let delayMultiplier = Math.pow(2, application.attemptCount); // Exponential backoff
    
    // Adjust delay based on failure reason
    if (reason?.includes('rate limit')) {
      delayMultiplier *= 2; // Double delay for rate limits
    } else if (reason?.includes('platform error')) {
      delayMultiplier *= 1.5; // 1.5x delay for platform errors
    }
    
    const delayMinutes = baseDelay * delayMultiplier;
    const earliestRetry = addMinutes(new Date(), delayMinutes);
    
    // Find next optimal slot after the delay
    const optimalSlots = await this.generateOptimalSlots(1, 3);
    const validSlot = optimalSlots.find(slot => slot.time >= earliestRetry);
    
    if (validSlot) {
      // Update the scheduled application
      await db.automationScheduledApplication.update({
        where: { id: applicationId },
        data: {
          scheduledFor: validSlot.time,
          status: 'scheduled',
          metadata: {
            ...application.metadata as any,
            rescheduledAt: new Date(),
            rescheduledReason: reason,
            nextAttempt: application.attemptCount + 1,
          },
        },
      });
      
      return validSlot.time;
    }
    
    return null;
  }
}

/**
 * Create intelligently scheduled applications in the database
 */
export async function createIntelligentScheduledApplications(
  userId: string,
  scheduledApps: ScheduledApplication[]
): Promise<void> {
  await db.automationScheduledApplication.createMany({
    data: scheduledApps.map(app => ({
      userId,
      jobLeadId: app.jobLeadId,
      scheduledFor: app.scheduledFor,
      priority: app.priority,
      status: 'scheduled',
      metadata: {
        ...app.metadata,
        platform: app.platform,
        optimalityScore: app.optimalityScore,
        scheduledAt: new Date(),
      },
    })),
  });
}

/**
 * Get scheduling analytics for dashboard
 */
export async function getSchedulingAnalytics(userId: string): Promise<{
  totalScheduled: number;
  todayScheduled: number;
  weekScheduled: number;
  averageOptimalityScore: number;
  platformDistribution: Record<string, number>;
  hourlyDistribution: number[];
  upcomingOptimalSlots: Array<{ time: Date; score: number }>;
}> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const todayEnd = endOfDay(now);
  const weekEnd = addDays(now, 7);
  
  const scheduled = await db.automationScheduledApplication.findMany({
    where: {
      userId,
      status: 'scheduled',
      scheduledFor: {
        gte: now,
      },
    },
    include: {
      jobLead: {
        include: {
          jobListing: true,
        },
      },
    },
  });
  
  // Calculate metrics
  const totalScheduled = scheduled.length;
  const todayScheduled = scheduled.filter(s => 
    isWithinInterval(s.scheduledFor, { start: todayStart, end: todayEnd })
  ).length;
  const weekScheduled = scheduled.filter(s => 
    s.scheduledFor <= weekEnd
  ).length;
  
  // Calculate average optimality score
  const scores = scheduled
    .map(s => (s.metadata as any)?.optimalityScore || 50)
    .filter(score => score > 0);
  const averageOptimalityScore = scores.length > 0 
    ? scores.reduce((a, b) => a + b, 0) / scores.length 
    : 0;
  
  // Platform distribution
  const platformDistribution: Record<string, number> = {};
  scheduled.forEach(s => {
    const platform = s.jobLead.jobListing.source || 'Unknown';
    platformDistribution[platform] = (platformDistribution[platform] || 0) + 1;
  });
  
  // Hourly distribution (24 hours)
  const hourlyDistribution = new Array(24).fill(0);
  scheduled.forEach(s => {
    const hour = s.scheduledFor.getHours();
    hourlyDistribution[hour]++;
  });
  
  // Get upcoming optimal slots (next 3 days)
  const settings = await db.automationSettings.findUnique({
    where: { userId },
  });
  
  let upcomingOptimalSlots: Array<{ time: Date; score: number }> = [];
  if (settings) {
    const scheduler = new IntelligentScheduler(userId, settings);
    const slots = await scheduler['generateOptimalSlots'](5, 3);
    upcomingOptimalSlots = slots.map(s => ({ time: s.time, score: s.score }));
  }
  
  return {
    totalScheduled,
    todayScheduled,
    weekScheduled,
    averageOptimalityScore,
    platformDistribution,
    hourlyDistribution,
    upcomingOptimalSlots,
  };
}