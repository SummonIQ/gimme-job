import {
  NotificationCategory,
  NotificationChannel,
  NotificationPriority,
  NotificationStatus,
  type Notification,
  type User,
} from '@/generated/prisma/browser';
import { db } from '@/lib/db/client';
import {
  generateAliasSlug,
  getCredential,
  getTrackingEmail,
  isImprovMXConfigured,
} from '@/lib/email/improvmx';
import { createNotification } from '@/lib/notifications';

const TRACKING_MAILBOX_NOTIFICATION_TITLE =
  'Finish your application mailbox setup';
const TRACKING_SETUP_NOTIFICATION_TITLE = 'Set up application tracking';
const TRACKING_MAILBOX_NOTIFICATION_ACTION =
  '/profile/application-tracking';

interface TrackingReminderDefinition {
  actionLabel: string;
  body: string;
  metadataKind: string;
  title: string;
}

export interface TrackingStatus {
  canManageMailbox: boolean;
  forwardingEnabled: boolean;
  isSetUp: boolean;
  mailboxCheckFailed: boolean;
  mailboxConfigured: boolean;
  suggestedAlias: string;
  trackingAlias: string | null;
  trackingEmail: string | null;
}

type TrackingUser = Pick<
  User,
  | 'email'
  | 'firstName'
  | 'id'
  | 'trackingEmailAlias'
  | 'trackingEmailForwardingEnabled'
>;

export async function getTrackingStatusForUser(
  user: TrackingUser,
): Promise<TrackingStatus> {
  const trackingAlias = user.trackingEmailAlias ?? null;
  const trackingEmail = trackingAlias ? getTrackingEmail(trackingAlias) : null;
  const suggestedAlias = generateAliasSlug(
    user.firstName,
    user.id,
    user.email?.split('@')[0] ?? null,
  );

  if (!trackingEmail || !isImprovMXConfigured()) {
    return {
      canManageMailbox: isImprovMXConfigured(),
      forwardingEnabled: Boolean(user.trackingEmailForwardingEnabled),
      isSetUp: Boolean(trackingEmail),
      mailboxCheckFailed: false,
      mailboxConfigured: false,
      suggestedAlias,
      trackingAlias,
      trackingEmail,
    };
  }

  try {
    const credential = await getCredential(trackingEmail);

    return {
      canManageMailbox: true,
      forwardingEnabled: Boolean(user.trackingEmailForwardingEnabled),
      isSetUp: true,
      mailboxCheckFailed: false,
      mailboxConfigured: Boolean(credential),
      suggestedAlias,
      trackingAlias,
      trackingEmail,
    };
  } catch (error) {
    console.error('[TRACKING STATUS] Failed to inspect mailbox status:', error);

    return {
      canManageMailbox: true,
      forwardingEnabled: Boolean(user.trackingEmailForwardingEnabled),
      isSetUp: true,
      mailboxCheckFailed: true,
      mailboxConfigured: false,
      suggestedAlias,
      trackingAlias,
      trackingEmail,
    };
  }
}

export async function ensureTrackingMailboxNotification(
  user: TrackingUser,
): Promise<Notification | null> {
  const trackingStatus = await getTrackingStatusForUser(user);
  const reminderDefinition = getTrackingReminderDefinition(trackingStatus);
  const existingNotifications = await db.notification.findMany({
    where: {
      actionUrl: TRACKING_MAILBOX_NOTIFICATION_ACTION,
      title: {
        in: [
          TRACKING_MAILBOX_NOTIFICATION_TITLE,
          TRACKING_SETUP_NOTIFICATION_TITLE,
        ],
      },
      userId: user.id,
    },
    orderBy: { createdAt: 'desc' },
  });

  if (!reminderDefinition) {
    await markTrackingRemindersAsRead(existingNotifications);
    return null;
  }

  const existingNotification = existingNotifications.find(
    notification => notification.title === reminderDefinition.title,
  );

  if (existingNotification) {
    return existingNotification.status === NotificationStatus.READ
      ? null
      : existingNotification;
  }

  return createNotification({
    action: {
      label: reminderDefinition.actionLabel,
      url: TRACKING_MAILBOX_NOTIFICATION_ACTION,
    },
    body: reminderDefinition.body,
    category: NotificationCategory.SYSTEM,
    channels: [NotificationChannel.IN_APP],
    metadata: {
      kind: reminderDefinition.metadataKind,
      trackingEmail: trackingStatus.trackingEmail,
    },
    priority: NotificationPriority.MEDIUM,
    status: NotificationStatus.PENDING,
    title: reminderDefinition.title,
    type: 'SYSTEM_ALERT',
    userId: user.id,
  });
}

function getTrackingReminderDefinition(
  trackingStatus: TrackingStatus,
): TrackingReminderDefinition | null {
  if (!trackingStatus.isSetUp) {
    return {
      actionLabel: 'Set Up Tracking',
      body: 'Create your @gimmejob.com tracking email so ATS responses, interviews, and rejections can be detected automatically.',
      metadataKind: 'tracking_setup',
      title: TRACKING_SETUP_NOTIFICATION_TITLE,
    };
  }

  if (
    trackingStatus.canManageMailbox &&
    !trackingStatus.mailboxConfigured &&
    trackingStatus.trackingEmail
  ) {
    return {
      actionLabel: 'Open Mailbox Setup',
      body: `Create mailbox credentials for ${trackingStatus.trackingEmail} so you can send or reply from your application email.`,
      metadataKind: 'tracking_mailbox_setup',
      title: TRACKING_MAILBOX_NOTIFICATION_TITLE,
    };
  }

  return null;
}

async function markTrackingRemindersAsRead(
  notifications: Notification[],
): Promise<void> {
  const unreadReminderIds = notifications
    .filter(notification => notification.status !== NotificationStatus.READ)
    .map(notification => notification.id);

  if (unreadReminderIds.length === 0) {
    return;
  }

  await db.notification.updateMany({
    where: { id: { in: unreadReminderIds } },
    data: {
      isRead: true,
      status: NotificationStatus.READ,
    },
  });
}
