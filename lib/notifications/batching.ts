import { db } from '@/lib/db/client';
import { NotificationChannel, NotificationDigest, NotificationStatus } from '@/generated/prisma/browser';
import { sendDigestEmail } from './email-service';
import type { NotificationEventType } from './types';

interface BatchingRule {
  maxNotificationsPerHour: number;
  maxNotificationsPerDay: number;
  batchWindowMinutes: number;
  quietHoursStart: number; // 0-23
  quietHoursEnd: number; // 0-23
}

const DEFAULT_BATCHING_RULES: BatchingRule = {
  maxNotificationsPerHour: 5,
  maxNotificationsPerDay: 20,
  batchWindowMinutes: 15,
  quietHoursStart: 22, // 10 PM
  quietHoursEnd: 8, // 8 AM
};

/**
 * Check if we should batch a notification instead of sending immediately
 */
export async function shouldBatchNotification(
  userId: string,
  eventType: NotificationEventType,
  channel: NotificationChannel
): Promise<boolean> {
  // Always send urgent notifications immediately
  const urgentEvents: NotificationEventType[] = [
    'INTERVIEW_REQUESTED',
    'APPLICATION_STATUS_CHANGED'
  ];

  if (urgentEvents.includes(eventType)) {
    return false;
  }

  // Check if user has enabled batching for this event type
  const preference = await db.notificationPreference.findFirst({
    where: {
      userId,
      eventType,
      channel
    }
  });

  // If user has daily or weekly digest enabled, batch it
  if (preference?.digest === NotificationDigest.DAILY || preference?.digest === NotificationDigest.WEEKLY) {
    return true;
  }

  // Check if we're in quiet hours
  const currentHour = new Date().getHours();
  const { quietHoursStart, quietHoursEnd } = DEFAULT_BATCHING_RULES;

  const inQuietHours = quietHoursEnd > quietHoursStart
    ? currentHour >= quietHoursStart || currentHour < quietHoursEnd
    : currentHour >= quietHoursStart && currentHour < quietHoursEnd;

  if (inQuietHours) {
    return true;
  }

  // Check recent notification count
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recentCount = await db.notification.count({
    where: {
      userId,
      createdAt: { gte: oneHourAgo },
      status: { in: [NotificationStatus.SENT, NotificationStatus.DELIVERED] }
    }
  });

  if (recentCount >= DEFAULT_BATCHING_RULES.maxNotificationsPerHour) {
    return true;
  }

  return false;
}

/**
 * Process daily digest for all users
 */
export async function processDailyDigests(): Promise<void> {
  console.log('[BATCH] Processing daily digests...');

  // Find all users with daily digest enabled
  const usersWithDailyDigest = await db.notificationPreference.findMany({
    where: {
      digest: NotificationDigest.DAILY,
      channel: NotificationChannel.EMAIL,
      enabled: true
    },
    distinct: ['userId'],
    select: { userId: true }
  });

  console.log(`[BATCH] Found ${usersWithDailyDigest.length} users with daily digest enabled`);

  for (const { userId } of usersWithDailyDigest) {
    try {
      await sendDailyDigest(userId);
    } catch (error) {
      console.error(`[BATCH] Error sending daily digest for user ${userId}:`, error);
    }
  }
}

/**
 * Process weekly digest for all users
 */
export async function processWeeklyDigests(): Promise<void> {
  console.log('[BATCH] Processing weekly digests...');

  // Find all users with weekly digest enabled
  const usersWithWeeklyDigest = await db.notificationPreference.findMany({
    where: {
      digest: NotificationDigest.WEEKLY,
      channel: NotificationChannel.EMAIL,
      enabled: true
    },
    distinct: ['userId'],
    select: { userId: true }
  });

  console.log(`[BATCH] Found ${usersWithWeeklyDigest.length} users with weekly digest enabled`);

  for (const { userId } of usersWithWeeklyDigest) {
    try {
      await sendWeeklyDigest(userId);
    } catch (error) {
      console.error(`[BATCH] Error sending weekly digest for user ${userId}:`, error);
    }
  }
}

/**
 * Send daily digest to a user
 */
async function sendDailyDigest(userId: string): Promise<void> {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get all unread notifications from the last 24 hours
  const notifications = await db.notification.findMany({
    where: {
      userId,
      createdAt: { gte: oneDayAgo },
      status: { in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
      channels: { has: NotificationChannel.EMAIL }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (notifications.length === 0) {
    console.log(`[BATCH] No notifications for user ${userId}`);
    return;
  }

  // Get user email and name
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true }
  });

  if (!user?.email) {
    console.log(`[BATCH] No email found for user ${userId}`);
    return;
  }

  // Send digest email
  const result = await sendDigestEmail({
    to: user.email,
    recipientName: user.name || undefined,
    notifications: notifications.map(n => ({
      eventType: n.eventType as NotificationEventType,
      title: n.title,
      body: n.body,
      metadata: n.metadata,
      createdAt: n.createdAt
    })),
    digestType: 'daily'
  });

  if (result.success) {
    // Mark notifications as delivered
    await db.notification.updateMany({
      where: {
        id: { in: notifications.map(n => n.id) }
      },
      data: {
        status: NotificationStatus.DELIVERED
      }
    });

    console.log(`[BATCH] Sent daily digest to ${user.email} with ${notifications.length} notifications`);
  } else {
    console.error(`[BATCH] Failed to send daily digest to ${user.email}:`, result.error);
  }
}

/**
 * Send weekly digest to a user
 */
async function sendWeeklyDigest(userId: string): Promise<void> {
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  // Get all unread notifications from the last week
  const notifications = await db.notification.findMany({
    where: {
      userId,
      createdAt: { gte: oneWeekAgo },
      status: { in: [NotificationStatus.PENDING, NotificationStatus.SENT] },
      channels: { has: NotificationChannel.EMAIL }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (notifications.length === 0) {
    console.log(`[BATCH] No notifications for user ${userId}`);
    return;
  }

  // Get user email and name
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { email: true, name: true }
  });

  if (!user?.email) {
    console.log(`[BATCH] No email found for user ${userId}`);
    return;
  }

  // Send digest email
  const result = await sendDigestEmail({
    to: user.email,
    recipientName: user.name || undefined,
    notifications: notifications.map(n => ({
      eventType: n.eventType as NotificationEventType,
      title: n.title,
      body: n.body,
      metadata: n.metadata,
      createdAt: n.createdAt
    })),
    digestType: 'weekly'
  });

  if (result.success) {
    // Mark notifications as delivered
    await db.notification.updateMany({
      where: {
        id: { in: notifications.map(n => n.id) }
      },
      data: {
        status: NotificationStatus.DELIVERED
      }
    });

    console.log(`[BATCH] Sent weekly digest to ${user.email} with ${notifications.length} notifications`);
  } else {
    console.error(`[BATCH] Failed to send weekly digest to ${user.email}:`, result.error);
  }
}

/**
 * Batch similar notifications within a time window
 */
export async function batchSimilarNotifications(
  userId: string,
  eventType: NotificationEventType,
  windowMinutes: number = DEFAULT_BATCHING_RULES.batchWindowMinutes
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60 * 1000);

  // Check if there are pending notifications of the same type
  const similarNotifications = await db.notification.findMany({
    where: {
      userId,
      eventType,
      status: NotificationStatus.PENDING,
      createdAt: { gte: windowStart }
    },
    orderBy: { createdAt: 'asc' }
  });

  // If we have multiple similar notifications, combine them
  if (similarNotifications.length > 1) {
    const firstNotification = similarNotifications[0];
    const otherNotifications = similarNotifications.slice(1);

    // Update first notification to include count
    await db.notification.update({
      where: { id: firstNotification.id },
      data: {
        title: `${firstNotification.title} (+${otherNotifications.length} more)`,
        metadata: {
          ...firstNotification.metadata,
          batchedCount: otherNotifications.length,
          batchedIds: otherNotifications.map(n => n.id)
        }
      }
    });

    // Mark other notifications as batched
    await db.notification.updateMany({
      where: {
        id: { in: otherNotifications.map(n => n.id) }
      },
      data: {
        status: NotificationStatus.BATCHED as any // Cast because BATCHED might not be in enum yet
      }
    });

    return true;
  }

  return false;
}
