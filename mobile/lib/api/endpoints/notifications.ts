import { api } from '@/lib/api/client';

interface Notification {
  id: string;
  title: string;
  description: string | null;
  channel: string;
  eventType: string;
  priority: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

interface NotificationsResponse {
  data: Notification[];
  unreadCount: number;
}

export function getNotifications(): Promise<NotificationsResponse> {
  return api.get('/api/notifications');
}

export function markNotificationRead(id: string) {
  return api.post('/api/notifications', { action: 'markRead', id });
}

export function markAllNotificationsRead() {
  return api.post('/api/notifications', { action: 'markAllRead' });
}
