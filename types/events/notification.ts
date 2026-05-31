import type { Event, EventType } from './event';

export type NotificationEventPayload = {
  actionText?: string;
  actionUrl?: string;
  description?: string;
  duration?: number;
  error?: boolean;
  hideCloseButton?: boolean;
  title?: string;
  type?: 'success' | 'error' | 'info';
};

export type NotificationEvent = Event<
  EventType.Notification,
  NotificationEventPayload
>;
