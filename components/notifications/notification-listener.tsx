'use client';

import { useRouter } from 'next/navigation';
import { useCallback } from 'react';

import { useEvent } from '@/hooks/use-event';
import { useUserChannel } from '@/hooks/use-user-channel';
import {
  canShowNotifications,
  getBrowserNotificationPreference,
  showBrowserNotification,
} from '@/lib/notifications/browser';
import { EventType } from '@/types/events';
import type { NotificationEventPayload } from '@/types/events';

/**
 * Listens for notification events and forwards them to browser notifications
 * when the user has opted in.
 */
export function NotificationListener({ userId }: { userId: string }) {
  const router = useRouter();
  const userChannel = useUserChannel();

  if (!userId) {
    return null;
  }

  const handleNotificationEvent = useCallback(
    (payload?: NotificationEventPayload) => {
      if (!payload) return;

      if (canShowNotifications() && getBrowserNotificationPreference()) {
        showBrowserNotification(payload.title ?? 'Notification', {
          body: payload.description,
          data: { url: payload.actionUrl },
          requireInteraction: payload.type === 'error',
        });
      }

      if (typeof window !== 'undefined') {
        const isNotificationsPage =
          window.location.pathname === '/notifications' ||
          window.location.pathname === '/a/notifications';

        if (isNotificationsPage) {
          router.refresh();
        }
      }
    },
    [router],
  );

  useEvent<NotificationEventPayload>(
    userChannel,
    EventType.Notification,
    handleNotificationEvent,
  );

  return null;
}
