import { API_BASE_URL, PUSHER_CLUSTER, PUSHER_KEY } from '@/constants/config';
import { getSessionToken } from '@/lib/auth/session';
import Pusher from 'pusher-js';

let pusherInstance: Pusher | null = null;

export async function getPusherClient(): Promise<Pusher | null> {
  if (!PUSHER_KEY || !PUSHER_CLUSTER) {
    return null;
  }

  if (pusherInstance) {
    return pusherInstance;
  }

  const token = await getSessionToken();

  pusherInstance = new Pusher(PUSHER_KEY, {
    cluster: PUSHER_CLUSTER,
    forceTLS: true,
    channelAuthorization: {
      transport: 'ajax',
      endpoint: `${API_BASE_URL}/api/events/channel-auth`,
      headers: token
        ? { Cookie: `better-auth.session_token=${token}` }
        : undefined,
    },
  });

  return pusherInstance;
}

export function disconnectPusher(): void {
  if (pusherInstance) {
    pusherInstance.disconnect();
    pusherInstance = null;
  }
}

export function getUserChannel(userId: string): string {
  return `private-user-${userId.replace(/\|/g, '-')}`;
}
