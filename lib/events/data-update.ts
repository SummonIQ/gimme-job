import { type DataEvent, EventType } from '@/types/events';

import { sendEvent } from './send';

export async function sendDataUpdate({ channel, payload }: DataEvent) {
  return sendEvent({
    channel,
    payload,
    type: EventType.DataUpdate,
  });
}
