import { eventServerClient } from '@/lib/events/clients';
import type { Event } from '@/types/events';

export async function sendEvent({ channel, type, payload }: Event) {
  return eventServerClient.trigger(channel, type as string, payload);
}
