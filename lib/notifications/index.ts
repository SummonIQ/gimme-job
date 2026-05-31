import { db } from '@/lib/db/client';
import { AppError, ErrorCode } from '@/lib/errors';
import { sendEvent } from '@/lib/events/send';
import { EventType } from '@/types/events';
import { NotificationDigest } from '@/generated/prisma/browser';
import { shouldBatchNotification } from './batching';
import { renderEmailTemplate, sendEmail } from './email-service';
import {
  ApplicationStatusNotificationMetadata,
  AutomationNotificationMetadata,
  BaseNotification,
  InterviewRequestNotificationMetadata,
  JobSearchCompletionNotificationMetadata,
  NotificationCategory,
  NotificationChannel,
  NotificationEventType,
  NotificationPreferenceMap,
  NotificationPreferenceSetting,
  NotificationPriority,
  NotificationStatus,
  ResumeAnalysisNotificationMetadata,
} from './types';

const DEFAULT_NOTIFICATION_SETTINGS: NotificationPreferenceSetting[] = [
  {
    eventType: 'APPLICATION_STATUS_CHANGED',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'APPLICATION_STATUS_CHANGED',
    channel: NotificationChannel.EMAIL,
    enabled: true,
  },
  {
    eventType: 'INTERVIEW_REQUESTED',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'INTERVIEW_REQUESTED',
    channel: NotificationChannel.EMAIL,
    enabled: true,
  },
  {
    eventType: 'JOB_SEARCH_COMPLETED',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'JOB_SEARCH_COMPLETED',
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: 'RESUME_ANALYSIS_COMPLETED',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'RESUME_ANALYSIS_COMPLETED',
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: 'NETWORKING_REMINDER',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'NETWORKING_REMINDER',
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: 'SHARE_ACTIVITY',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'SHARE_ACTIVITY',
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: 'RESUME_FEEDBACK_PROVIDED',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'RESUME_FEEDBACK_PROVIDED',
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: 'AUTOMATION_EVENT',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'AUTOMATION_EVENT',
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: 'SYSTEM_ALERT',
    channel: NotificationChannel.IN_APP,
    enabled: true,
  },
  {
    eventType: 'SYSTEM_ALERT',
    channel: NotificationChannel.EMAIL,
    enabled: false,
  },
  {
    eventType: 'SYSTEM_ALERT',
    channel: NotificationChannel.PUSH,
    enabled: false,
  },
];

const CHANNEL_PROVIDER: Record<NotificationChannel, string> = {
  [NotificationChannel.IN_APP]: 'internal',
  [NotificationChannel.EMAIL]: 'email',
  [NotificationChannel.PUSH]: 'push',
  [NotificationChannel.SMS]: 'sms',
};

const MANAGED_CHANNELS: NotificationChannel[] = [
  NotificationChannel.IN_APP,
  NotificationChannel.EMAIL,
  NotificationChannel.PUSH,
];

const EVENT_SETTING_KEYS: Record<string, NotificationEventType> = {
  applicationStatusEnabled: 'APPLICATION_STATUS_CHANGED',
  interviewRequestsEnabled: 'INTERVIEW_REQUESTED',
  networkingRemindersEnabled: 'NETWORKING_REMINDER',
  shareNotificationsEnabled: 'SHARE_ACTIVITY',
  resumeFeedbackEnabled: 'RESUME_FEEDBACK_PROVIDED',
  automationEnabled: 'AUTOMATION_EVENT',
  jobSearchEnabled: 'JOB_SEARCH_COMPLETED',
  resumeAnalysisEnabled: 'RESUME_ANALYSIS_COMPLETED',
  systemNotificationsEnabled: 'SYSTEM_ALERT',
};

async function ensurePreferenceMap(
  userId: string,
): Promise<NotificationPreferenceMap> {
  const existing = await db.notificationPreference.findMany({
    where: { userId },
  });
  const existingKeys = new Set(
    existing.map(pref => `${pref.eventType}:${pref.channel}`),
  );

  const toCreate = DEFAULT_NOTIFICATION_SETTINGS.filter(
    setting => !existingKeys.has(`${setting.eventType}:${setting.channel}`),
  ).map(setting => ({
    userId,
    eventType: setting.eventType,
    channel: setting.channel,
    enabled: setting.enabled,
    digest: NotificationDigest.NONE,
  }));

  if (toCreate.length > 0) {
    await db.notificationPreference.createMany({
      data: toCreate,
      skipDuplicates: true,
    });
  }

  const preferences =
    toCreate.length > 0
      ? await db.notificationPreference.findMany({ where: { userId } })
      : existing;

  return preferences.reduce<NotificationPreferenceMap>((acc, pref) => {
    const eventType = pref.eventType as NotificationEventType;
    const channel = pref.channel as NotificationChannel;

    acc[eventType] = acc[eventType] || {};
    acc[eventType]![channel] = pref.enabled;
    return acc;
  }, {});
}

function getEnabledChannels(
  preferences: NotificationPreferenceMap,
  eventType: NotificationEventType,
): NotificationChannel[] {
  const eventPreferences = preferences[eventType];
  if (!eventPreferences) {
    return [];
  }

  return (Object.entries(eventPreferences) as [NotificationChannel, boolean][])
    .filter(([, enabled]) => Boolean(enabled))
    .map(([channel]) => channel);
}

function isEventEnabled(
  preferences: NotificationPreferenceMap,
  eventType: NotificationEventType,
): boolean {
  return getEnabledChannels(preferences, eventType).length > 0;
}

function isChannelEnabled(
  preferences: NotificationPreferenceMap,
  channel: NotificationChannel,
): boolean {
  return Object.values(preferences).some(
    eventPreferences => eventPreferences?.[channel],
  );
}

/**
 * Create a new notification
 */
export async function createNotification(
  notification: BaseNotification,
): Promise<any> {
  try {
    if (!notification.userId) {
      throw new AppError({
        code: ErrorCode.VALIDATION_ERROR,
        message: 'Notification requires a userId',
      });
    }

    const channels = notification.channels?.length
      ? notification.channels
      : [NotificationChannel.IN_APP];

    const metadata = notification.metadata || {};

    const createdNotification = await db.notification.create({
      data: {
        title: notification.title,
        userId: notification.userId,
        message: notification.body,
        type: notification.category || NotificationCategory.SYSTEM,
        eventType: notification.type,
        status: notification.status || NotificationStatus.PENDING,
        channels,
        actionLabel: notification.action?.label,
        actionUrl: notification.action?.url,
        expiresAt: notification.expiresAt,
        metadata,
        priority: notification.priority || NotificationPriority.MEDIUM,
        deliveries: channels.length
          ? {
              create: channels.map(channel => ({
                channel,
                provider: CHANNEL_PROVIDER[channel],
                status: NotificationStatus.PENDING,
                payload: metadata,
              })),
            }
          : undefined,
      } as any,
    });

    // Send in-app notification immediately if user is logged in
    if (channels.includes(NotificationChannel.IN_APP)) {
      await sendInAppNotification(createdNotification.id, notification.userId);
    }

    // Send email notification if email is provided and email channel is enabled
    if (
      notification.recipientEmail &&
      channels.includes(NotificationChannel.EMAIL)
    ) {
      await sendEmailNotification(
        createdNotification.id,
        notification.recipientEmail,
      );
    }

    return createdNotification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}

/**
 * Send in-app notification to a user
 */
async function sendInAppNotification(
  notificationId: string,
  userId: string,
): Promise<void> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    // Send notification event to the user's channel
    await sendEvent({
      channel: `user-${userId}`,
      type: EventType.Notification,
      payload: {
        title: notification.title,
        description: notification.message,
        type: 'info',
        actionUrl: notification.actionUrl || '/notifications',
        actionText: notification.actionLabel || 'View',
      },
    });

    await db.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.SENT,
        deliveries: {
          updateMany: {
            where: { channel: NotificationChannel.IN_APP },
            data: {
              status: NotificationStatus.SENT,
              sentAt: new Date(),
              deliveredAt: new Date(),
            },
          },
        },
      } as any,
    });
  } catch (error) {
    console.error('Error sending in-app notification:', error);
    throw error;
  }
}

/**
 * Send email notification
 */
async function sendEmailNotification(
  notificationId: string,
  email: string,
): Promise<void> {
  try {
    const notification = await db.notification.findUnique({
      where: { id: notificationId },
      include: {
        user: {
          select: { name: true },
        },
      },
    });

    if (!notification) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    // Check if notification should be batched
    const shouldBatch = await shouldBatchNotification(
      notification.userId,
      (notification as any).eventType as NotificationEventType,
      NotificationChannel.EMAIL,
    );

    if (shouldBatch) {
      console.log(
        `[EMAIL] Batching notification ${notificationId} for later delivery`,
      );
      // Keep status as PENDING so it can be included in digest
      return;
    }

    // Render email template
    const emailTemplate = await renderEmailTemplate(
      (notification as any).eventType as NotificationEventType,
      notification.metadata,
      notification.user?.name || undefined,
    );

    // Send email
    const result = await sendEmail({
      to: email,
      subject: emailTemplate.subject,
      html: emailTemplate.html,
      text: emailTemplate.text,
    });

    if (!result.success) {
      console.error(
        `[EMAIL] Failed to send notification ${notificationId}:`,
        result.error,
      );

      // Update delivery status to failed
      await db.notification.update({
        where: { id: notificationId },
        data: {
          deliveries: {
            updateMany: {
              where: { channel: NotificationChannel.EMAIL },
              data: {
                status: NotificationStatus.FAILED,
                errorMessage: result.error,
              },
            },
          },
        } as any,
      });
      return;
    }

    await db.notification.update({
      where: { id: notificationId },
      data: {
        status: NotificationStatus.SENT,
        deliveries: {
          updateMany: {
            where: { channel: NotificationChannel.EMAIL },
            data: {
              status: NotificationStatus.SENT,
              sentAt: new Date(),
            },
          },
        },
      } as any,
    });

    console.log(
      `[EMAIL] Successfully sent notification ${notificationId} to ${email}`,
    );
  } catch (error) {
    console.error('Error sending email notification:', error);
    throw error;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsRead(
  id: string,
  userId: string,
): Promise<any> {
  try {
    const notification = await db.notification.findUnique({
      where: { id },
    });

    if (!notification) {
      throw new AppError({
        code: ErrorCode.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    if (notification.userId !== userId) {
      throw new AppError({
        code: ErrorCode.UNAUTHORIZED,
        message: 'Not authorized to update this notification',
      });
    }

    return db.notification.update({
      where: { id },
      data: {
        isRead: true,
        status: NotificationStatus.READ,
      } as any,
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Get user's notifications
 */
export async function getUserNotifications(
  userId: string,
  options?: { limit?: number; offset?: number; includeRead?: boolean },
) {
  try {
    const { limit = 20, offset = 0, includeRead = false } = options || {};

    const where = {
      userId,
      ...(includeRead ? {} : { isRead: false }),
    };

    const [notifications, totalCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      db.notification.count({ where }),
    ]);

    return {
      notifications,
      totalCount,
      hasMore: offset + limit < totalCount,
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
}

/**
 * Create application status notification
 */
export async function createApplicationStatusNotification(
  userId: string,
  metadata: ApplicationStatusNotificationMetadata,
): Promise<any> {
  try {
    const preferenceMap = await ensurePreferenceMap(userId);
    const channels = getEnabledChannels(
      preferenceMap,
      'APPLICATION_STATUS_CHANGED',
    );

    if (channels.length === 0) {
      console.log(
        `Application status notifications disabled for user ${userId}`,
      );
      return null;
    }

    let recipientEmail: string | null = null;

    if (channels.includes(NotificationChannel.EMAIL)) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'User not found',
        });
      }

      recipientEmail = user.email;
    }

    return createNotification({
      userId,
      recipientEmail,
      type: 'APPLICATION_STATUS_CHANGED',
      title: `Application Status Updated: ${metadata.jobTitle}`,
      body: `Your application for ${metadata.jobTitle} at ${metadata.companyName} has changed status from ${metadata.previousStatus} to ${metadata.newStatus}.`,
      status: NotificationStatus.PENDING,
      metadata: metadata as unknown as any,
      priority: NotificationPriority.HIGH,
      category: NotificationCategory.APPLICATION_STATUS,
      channels,
    });
  } catch (error) {
    console.error('Error creating application status notification:', error);
    throw error;
  }
}

/**
 * Create interview request notification
 */
export async function createInterviewRequestNotification(
  userId: string,
  metadata: InterviewRequestNotificationMetadata,
): Promise<any> {
  try {
    const preferenceMap = await ensurePreferenceMap(userId);
    const channels = getEnabledChannels(preferenceMap, 'INTERVIEW_REQUESTED');

    if (channels.length === 0) {
      console.log(
        `Interview request notifications disabled for user ${userId}`,
      );
      return null;
    }

    let recipientEmail: string | null = null;

    if (channels.includes(NotificationChannel.EMAIL)) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'User not found',
        });
      }

      recipientEmail = user.email;
    }

    const interviewDetails = metadata.interviewDate
      ? `scheduled for ${metadata.interviewDate}`
      : '';

    return createNotification({
      userId,
      recipientEmail,
      type: 'INTERVIEW_REQUESTED',
      title: `Interview Request: ${metadata.jobTitle}`,
      body: `You have received an interview request for ${metadata.jobTitle} at ${metadata.companyName} ${interviewDetails}.`,
      status: NotificationStatus.PENDING,
      metadata: metadata as unknown as any,
      priority: NotificationPriority.URGENT,
      category: NotificationCategory.INTERVIEW_REQUEST,
      channels,
    });
  } catch (error) {
    console.error('Error creating interview request notification:', error);
    throw error;
  }
}

/**
 * Get user's notification preferences
 */
export async function getUserNotificationPreferences(userId: string) {
  try {
    const preferenceMap = await ensurePreferenceMap(userId);

    return {
      applicationStatusEnabled: isEventEnabled(
        preferenceMap,
        'APPLICATION_STATUS_CHANGED',
      ),
      interviewRequestsEnabled: isEventEnabled(
        preferenceMap,
        'INTERVIEW_REQUESTED',
      ),
      networkingRemindersEnabled: isEventEnabled(
        preferenceMap,
        'NETWORKING_REMINDER',
      ),
      shareNotificationsEnabled: isEventEnabled(
        preferenceMap,
        'SHARE_ACTIVITY',
      ),
      resumeFeedbackEnabled: isEventEnabled(
        preferenceMap,
        'RESUME_FEEDBACK_PROVIDED',
      ),
      automationEnabled: isEventEnabled(preferenceMap, 'AUTOMATION_EVENT'),
      jobSearchEnabled: isEventEnabled(preferenceMap, 'JOB_SEARCH_COMPLETED'),
      resumeAnalysisEnabled: isEventEnabled(
        preferenceMap,
        'RESUME_ANALYSIS_COMPLETED',
      ),
      systemNotificationsEnabled: isEventEnabled(preferenceMap, 'SYSTEM_ALERT'),
      emailEnabled: isChannelEnabled(preferenceMap, NotificationChannel.EMAIL),
      inAppEnabled: isChannelEnabled(preferenceMap, NotificationChannel.IN_APP),
      browserEnabled: isChannelEnabled(preferenceMap, NotificationChannel.PUSH),
    };
  } catch (error) {
    console.error('Error getting notification preferences:', error);
    throw error;
  }
}

/**
 * Update user's notification preferences
 */
export async function updateNotificationPreferences(
  userId: string,
  updates: Record<string, boolean>,
) {
  try {
    const preferenceMap = await ensurePreferenceMap(userId);

    const currentEventState = Object.entries(EVENT_SETTING_KEYS).reduce<
      Record<NotificationEventType, boolean>
    >(
      (acc, [_, eventType]) => {
        acc[eventType] = isEventEnabled(preferenceMap, eventType);
        return acc;
      },
      {} as Record<NotificationEventType, boolean>,
    );

    const currentChannelState = MANAGED_CHANNELS.reduce<
      Record<NotificationChannel, boolean>
    >(
      (acc, channel) => {
        acc[channel] = isChannelEnabled(preferenceMap, channel);
        return acc;
      },
      {} as Record<NotificationChannel, boolean>,
    );

    const nextChannelState: Record<NotificationChannel, boolean> = {
      [NotificationChannel.IN_APP]:
        updates.inAppEnabled ?? currentChannelState[NotificationChannel.IN_APP],
      [NotificationChannel.EMAIL]:
        updates.emailEnabled ?? currentChannelState[NotificationChannel.EMAIL],
      [NotificationChannel.PUSH]:
        updates.browserEnabled ?? currentChannelState[NotificationChannel.PUSH],
      [NotificationChannel.SMS]:
        currentChannelState[NotificationChannel.SMS] ?? false,
    };

    const updatesPayload: Array<{
      eventType: NotificationEventType;
      channel: NotificationChannel;
      enabled: boolean;
    }> = [];

    for (const [key, eventType] of Object.entries(EVENT_SETTING_KEYS)) {
      const eventEnabled = updates[key] ?? currentEventState[eventType];

      for (const channel of MANAGED_CHANNELS) {
        const channelEnabled = nextChannelState[channel];
        const enabled = Boolean(eventEnabled && channelEnabled);
        const currentEnabled = preferenceMap[eventType]?.[channel] ?? false;

        if (enabled !== currentEnabled) {
          updatesPayload.push({ eventType, channel, enabled });
        }
      }
    }

    if (updatesPayload.length > 0) {
      await Promise.all(
        updatesPayload.map(payload =>
          db.notificationPreference.updateMany({
            where: {
              userId,
              eventType: payload.eventType,
              channel: payload.channel,
            },
            data: {
              enabled: payload.enabled,
            },
          }),
        ),
      );
    }

    return getUserNotificationPreferences(userId);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    throw error;
  }
}

/**
 * Create job search completion notification
 */
export async function createJobSearchCompletionNotification(
  userId: string,
  metadata: JobSearchCompletionNotificationMetadata,
): Promise<any> {
  try {
    const preferenceMap = await ensurePreferenceMap(userId);
    const channels = getEnabledChannels(preferenceMap, 'JOB_SEARCH_COMPLETED');

    if (channels.length === 0) {
      console.log(`Job search notifications disabled for user ${userId}`);
      return null;
    }

    let recipientEmail: string | null = null;

    if (channels.includes(NotificationChannel.EMAIL)) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'User not found',
        });
      }

      recipientEmail = user.email;
    }

    // Create title and content based on status
    let title: string;
    let content: string;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    if (metadata.status === 'completed') {
      title = `Job Search Completed: ${metadata.searchQuery}`;
      content = `Found ${metadata.jobsFound} jobs on ${metadata.platform}, ${metadata.newJobsAdded} new jobs added to your leads.`;
      priority = NotificationPriority.HIGH;
    } else if (metadata.status === 'failed') {
      title = `Job Search Failed: ${metadata.searchQuery}`;
      content = `Job search on ${metadata.platform} failed. ${metadata.errorMessage || 'Please try again later.'}`;
      priority = NotificationPriority.HIGH;
    } else {
      title = `Job Search Partial Results: ${metadata.searchQuery}`;
      content = `Job search on ${metadata.platform} completed with some issues. Found ${metadata.jobsFound} jobs.`;
    }

    return createNotification({
      userId,
      recipientEmail,
      type: 'JOB_SEARCH_COMPLETED',
      title,
      body: content,
      status: NotificationStatus.PENDING,
      metadata: metadata as unknown as any,
      priority,
      category: NotificationCategory.JOB_SEARCH,
      channels,
    });
  } catch (error) {
    console.error('Error creating job search completion notification:', error);
    throw error;
  }
}

/**
 * Create resume analysis completion notification
 */
export async function createResumeAnalysisNotification(
  userId: string,
  metadata: ResumeAnalysisNotificationMetadata,
): Promise<any> {
  try {
    const preferenceMap = await ensurePreferenceMap(userId);
    const channels = getEnabledChannels(
      preferenceMap,
      'RESUME_ANALYSIS_COMPLETED',
    );

    if (channels.length === 0) {
      console.log(`Resume analysis notifications disabled for user ${userId}`);
      return null;
    }

    let recipientEmail: string | null = null;

    if (channels.includes(NotificationChannel.EMAIL)) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'User not found',
        });
      }

      recipientEmail = user.email;
    }

    // Create title and content based on status and analysis type
    let title: string;
    let content: string;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    if (metadata.status === 'completed') {
      const analysisTypeName =
        metadata.analysisType === 'ats'
          ? 'ATS Analysis'
          : metadata.analysisType === 'keyword'
            ? 'Keyword Analysis'
            : 'Resume Optimization';
      title = `${analysisTypeName} Complete: ${metadata.resumeName}`;

      if (metadata.score !== undefined) {
        content = `Your resume scored ${metadata.score}% with ${metadata.suggestions} improvement suggestions.`;
      } else {
        content = `Analysis complete with ${metadata.suggestions} suggestions for improvement.`;
      }
      priority = NotificationPriority.HIGH;
    } else {
      title = `Resume Analysis Failed: ${metadata.resumeName}`;
      content = `Analysis failed for your resume. ${metadata.errorMessage || 'Please try again later.'}`;
      priority = NotificationPriority.HIGH;
    }

    return createNotification({
      userId,
      recipientEmail,
      type: 'RESUME_ANALYSIS_COMPLETED',
      title,
      body: content,
      status: NotificationStatus.PENDING,
      metadata: metadata as unknown as any,
      priority,
      category: NotificationCategory.RESUME_ANALYSIS,
      channels,
    });
  } catch (error) {
    console.error('Error creating resume analysis notification:', error);
    throw error;
  }
}

/**
 * Send notification (alias for createNotification for backwards compatibility)
 */
export const sendNotification = createNotification;

/**
 * Create automation event notification
 */
export async function createAutomationNotification(
  userId: string,
  metadata: AutomationNotificationMetadata,
): Promise<any> {
  try {
    const preferenceMap = await ensurePreferenceMap(userId);
    let channels = getEnabledChannels(preferenceMap, 'AUTOMATION_EVENT');

    if (channels.length === 0) {
      console.log(`Automation notifications disabled for user ${userId}`);
      return null;
    }

    // For started events outside application submissions, skip to reduce noise
    if (
      metadata.status === 'started' &&
      metadata.automationType !== 'application_submission'
    ) {
      channels = channels.filter(
        channel => channel !== NotificationChannel.EMAIL,
      );
      if (channels.length === 0) {
        return null;
      }
    }

    // Only send email on completed/failed events
    if (metadata.status !== 'failed' && metadata.status !== 'completed') {
      channels = channels.filter(
        channel => channel !== NotificationChannel.EMAIL,
      );
    }

    if (channels.length === 0) {
      return null;
    }

    let recipientEmail: string | null = null;

    if (channels.includes(NotificationChannel.EMAIL)) {
      const user = await db.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });

      if (!user) {
        throw new AppError({
          code: ErrorCode.NOT_FOUND,
          message: 'User not found',
        });
      }

      recipientEmail = user.email;
    }

    // Create title and content based on automation type and status
    const automationName =
      metadata.automationType === 'application_submission'
        ? 'Application Submissions'
        : metadata.automationType === 'job_search'
          ? 'Job Search'
          : 'Resume Analysis';

    let title: string;
    let content: string;
    let priority: NotificationPriority = NotificationPriority.MEDIUM;

    if (metadata.status === 'completed') {
      title = `${automationName} Complete`;
      content = `Processed ${metadata.itemsProcessed} items with ${metadata.successCount} successful and ${metadata.failureCount} failed.`;
      priority = NotificationPriority.HIGH;
    } else if (metadata.status === 'failed') {
      title = `${automationName} Failed`;
      content = `Automation failed after processing ${metadata.itemsProcessed} of ${metadata.totalItems} items. ${metadata.errorMessage || ''}`;
      priority = NotificationPriority.URGENT;
    } else if (metadata.status === 'paused') {
      title = `${automationName} Paused`;
      content = `Automation has been paused. ${metadata.itemsProcessed} of ${metadata.totalItems} items processed.`;
      priority = NotificationPriority.HIGH;
    } else {
      title = `${automationName} Started`;
      content = `Processing ${metadata.totalItems} items automatically.`;
    }

    return createNotification({
      userId,
      recipientEmail,
      type: 'AUTOMATION_EVENT',
      title,
      body: content,
      status: NotificationStatus.PENDING,
      metadata: metadata as unknown as any,
      priority,
      category: NotificationCategory.AUTOMATION,
      channels,
    });
  } catch (error) {
    console.error('Error creating automation notification:', error);
    throw error;
  }
}
