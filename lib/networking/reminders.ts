import { db } from '@/lib/db/client';
import { getCurrentUser } from '@/lib/user/query';
import { AppError, ErrorCode } from '@/lib/errors';
import { ReminderStatus, ReminderType, NetworkReminder } from './types';
import { nanoid } from 'nanoid';

/**
 * Create a new networking reminder
 */
export async function createNetworkReminder(
  data: Omit<NetworkReminder, 'id' | 'createdAt' | 'updatedAt' | 'userId' | 'notificationSent'>
): Promise<NetworkReminder> {
  const user = await getCurrentUser();
  
  if (!data.contactId) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Contact ID is required',
    });
  }
  
  if (!data.title) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Reminder title is required',
    });
  }
  
  if (!data.dueDate) {
    throw new AppError({
      code: ErrorCode.INVALID_INPUT,
      message: 'Due date is required',
    });
  }
  
  // Verify contact exists and belongs to user
  const contact = await db.networkContact.findUnique({
    where: {
      id: data.contactId,
      userId: user.id,
    },
  });
  
  if (!contact) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Contact with ID ${data.contactId} not found`,
    });
  }
  
  const reminder = await db.networkReminder.create({
    data: {
      ...data,
      status: data.status || ReminderStatus.PENDING,
      type: data.type || ReminderType.FOLLOW_UP,
      notificationSent: false,
      userId: user.id,
    },
  });
  
  return reminder;
}

/**
 * Update an existing networking reminder
 */
export async function updateNetworkReminder(
  id: string,
  data: Partial<Omit<NetworkReminder, 'id' | 'createdAt' | 'updatedAt' | 'userId'>>
): Promise<NetworkReminder> {
  const user = await getCurrentUser();
  
  const reminder = await db.networkReminder.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });
  
  if (!reminder) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Reminder with ID ${id} not found`,
    });
  }
  
  // If completing a reminder, set completedDate
  if (data.status === ReminderStatus.COMPLETED && !data.completedDate) {
    data.completedDate = new Date();
  }
  
  const updatedReminder = await db.networkReminder.update({
    where: {
      id,
      userId: user.id,
    },
    data,
  });
  
  return updatedReminder;
}

/**
 * Delete a networking reminder
 */
export async function deleteNetworkReminder(id: string): Promise<void> {
  const user = await getCurrentUser();
  
  const reminder = await db.networkReminder.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });
  
  if (!reminder) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Reminder with ID ${id} not found`,
    });
  }
  
  await db.networkReminder.delete({
    where: {
      id,
      userId: user.id,
    },
  });
}

/**
 * Get a single networking reminder
 */
export async function getNetworkReminder(id: string): Promise<NetworkReminder> {
  const user = await getCurrentUser();
  
  const reminder = await db.networkReminder.findUnique({
    where: {
      id,
      userId: user.id,
    },
    include: {
      contact: true,
    },
  });
  
  if (!reminder) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Reminder with ID ${id} not found`,
    });
  }
  
  return reminder;
}

/**
 * Get all networking reminders
 */
export async function getNetworkReminders(options: {
  status?: ReminderStatus;
  type?: ReminderType;
  contactId?: string;
  search?: string;
  upcoming?: boolean;
  sort?: 'dueDate' | 'createdAt';
  sortDirection?: 'asc' | 'desc';
} = {}): Promise<NetworkReminder[]> {
  const user = await getCurrentUser();
  
  const {
    status,
    type,
    contactId,
    search,
    upcoming = false,
    sort = 'dueDate',
    sortDirection = 'asc',
  } = options;
  
  // Build filters
  const filters: any = {
    userId: user.id,
  };
  
  if (status) {
    filters.status = status;
  }
  
  if (type) {
    filters.type = type;
  }
  
  if (contactId) {
    filters.contactId = contactId;
  }
  
  if (search) {
    filters.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
    ];
  }
  
  if (upcoming) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(23, 59, 59, 999);
    
    filters.AND = [
      { dueDate: { lte: tomorrow } },
      { status: ReminderStatus.PENDING },
    ];
  }
  
  const reminders = await db.networkReminder.findMany({
    where: filters,
    include: {
      contact: {
        select: {
          id: true,
          name: true,
          company: true,
          position: true,
        },
      },
    },
    orderBy: {
      [sort]: sortDirection,
    },
  });
  
  return reminders;
}

/**
 * Mark a reminder as completed
 */
export async function completeReminder(id: string): Promise<NetworkReminder> {
  const user = await getCurrentUser();
  
  const reminder = await db.networkReminder.findUnique({
    where: {
      id,
      userId: user.id,
    },
  });
  
  if (!reminder) {
    throw new AppError({
      code: ErrorCode.NOT_FOUND,
      message: `Reminder with ID ${id} not found`,
    });
  }
  
  const updatedReminder = await db.networkReminder.update({
    where: {
      id,
      userId: user.id,
    },
    data: {
      status: ReminderStatus.COMPLETED,
      completedDate: new Date(),
    },
  });
  
  return updatedReminder;
}

/**
 * Check for due reminders and send notifications
 * This would typically be run by a scheduled job
 */
export async function checkDueReminders(): Promise<number> {
  // Get current date
  const now = new Date();
  
  // Find all due reminders that haven't been sent yet
  const dueReminders = await db.networkReminder.findMany({
    where: {
      dueDate: {
        lte: now,
      },
      status: ReminderStatus.PENDING,
      notificationSent: false,
    },
    include: {
      contact: true,
      user: true,
    },
  });
  
  // Process each reminder
  let sentCount = 0;
  
  for (const reminder of dueReminders) {
    try {
      // In a real implementation, this would send an email, push notification, etc.
      console.log(`Sending reminder notification to ${reminder.user.email}:`);
      console.log(`- Title: ${reminder.title}`);
      console.log(`- Contact: ${reminder.contact.name}`);
      console.log(`- Due: ${reminder.dueDate.toLocaleString()}`);
      
      // Mark as notification sent
      await db.networkReminder.update({
        where: {
          id: reminder.id,
        },
        data: {
          notificationSent: true,
        },
      });
      
      sentCount++;
    } catch (error) {
      console.error(`Failed to send notification for reminder ${reminder.id}:`, error);
    }
  }
  
  return sentCount;
}

/**
 * Generate reminders report
 */
export async function getRemindersReport(): Promise<any> {
  const user = await getCurrentUser();
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  
  const [
    dueTodayCount,
    dueTomorrowCount,
    dueNextWeekCount,
    overdueCount,
    completedThisWeekCount,
    remindersByType,
  ] = await Promise.all([
    // Due today
    db.networkReminder.count({
      where: {
        userId: user.id,
        status: ReminderStatus.PENDING,
        dueDate: {
          gte: new Date(today.setHours(0, 0, 0, 0)),
          lt: new Date(today.setHours(23, 59, 59, 999)),
        },
      },
    }),
    
    // Due tomorrow
    db.networkReminder.count({
      where: {
        userId: user.id,
        status: ReminderStatus.PENDING,
        dueDate: {
          gte: new Date(tomorrow.setHours(0, 0, 0, 0)),
          lt: new Date(tomorrow.setHours(23, 59, 59, 999)),
        },
      },
    }),
    
    // Due next week
    db.networkReminder.count({
      where: {
        userId: user.id,
        status: ReminderStatus.PENDING,
        dueDate: {
          gte: new Date(today),
          lt: new Date(nextWeek),
        },
      },
    }),
    
    // Overdue
    db.networkReminder.count({
      where: {
        userId: user.id,
        status: ReminderStatus.PENDING,
        dueDate: {
          lt: new Date(today.setHours(0, 0, 0, 0)),
        },
      },
    }),
    
    // Completed this week
    db.networkReminder.count({
      where: {
        userId: user.id,
        status: ReminderStatus.COMPLETED,
        completedDate: {
          gte: new Date(today.setDate(today.getDate() - today.getDay())),
        },
      },
    }),
    
    // Reminders by type
    db.networkReminder.groupBy({
      by: ['type'],
      where: {
        userId: user.id,
        status: ReminderStatus.PENDING,
      },
      _count: true,
    }),
  ]);
  
  // Format reminders by type
  const remindersByTypeMap: Record<ReminderType, number> = Object.values(ReminderType).reduce(
    (acc, type) => {
      acc[type] = 0;
      return acc;
    },
    {} as Record<ReminderType, number>
  );
  
  remindersByType.forEach((item: any) => {
    remindersByTypeMap[item.type as ReminderType] = item._count;
  });
  
  return {
    dueToday: dueTodayCount,
    dueTomorrow: dueTomorrowCount,
    dueNextWeek: dueNextWeekCount,
    overdue: overdueCount,
    completedThisWeek: completedThisWeekCount,
    remindersByType: remindersByTypeMap,
  };
}
