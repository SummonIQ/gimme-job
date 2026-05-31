"use server";

import { db } from "@/lib/db/client";
import { NotificationStatus } from "@/generated/prisma/client";

/**
 * Server action to get user notifications
 */
export async function getUserNotificationsAction(
  userId: string, 
  options?: { 
    limit?: number; 
    offset?: number; 
    includeRead?: boolean 
  }
) {
  try {
    const { limit = 20, offset = 0, includeRead = false } = options || {};
    
    const where = {
      userId,
      ...(includeRead ? {} : { status: { not: NotificationStatus.READ } })
    };
    
    const [notifications, totalCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      db.notification.count({ where })
    ]);
    
    return {
      notifications,
      totalCount,
      hasMore: offset + limit < totalCount
    };
  } catch (error) {
    console.error('Error getting user notifications:', error);
    throw error;
  }
}

/**
 * Mark a notification as read
 */
export async function markNotificationAsReadAction(notificationId: string) {
  try {
    await db.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        status: NotificationStatus.READ,
      },
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllNotificationsAsReadAction(userId: string) {
  try {
    await db.notification.updateMany({
      where: { 
        userId,
        status: { not: NotificationStatus.READ }
      },
      data: {
        isRead: true,
        status: NotificationStatus.READ,
      }
    });
    return { success: true };
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return { success: false, error: String(error) };
  }
}

/**
 * Count unread notifications for a user
 */
export async function getUnreadNotificationCountAction(userId: string) {
  try {
    const count = await db.notification.count({
      where: {
        userId,
        status: { not: NotificationStatus.READ }
      }
    });
    
    return { count };
  } catch (error) {
    console.error('Error counting unread notifications:', error);
    return { count: 0 };
  }
}
