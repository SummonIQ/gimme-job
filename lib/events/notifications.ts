import { EventType, type NotificationEvent } from '@/types/events';

import { sendEvent } from './send';

export async function sendNotification({
  channel,
  payload,
}: NotificationEvent) {
  return sendEvent({
    channel,
    payload,
    type: EventType.Notification,
  });
}
