import type { Channel, PresenceChannel } from 'pusher-js';
import { useEffect, useState } from 'react';

import { useChannels } from '@/hooks/use-channels';

/**
 * Subscribe to a channel
 *
 * @param channelName The name of the channel you want to subscribe to.
 * @typeparam T Type of channel you're subscribing to. Can be one of `Channel` or `PresenceChannel` from `pusher-js`.
 * @returns Instance of the channel you just subscribed to.
 *
 * @example
 * ```tsx
 * const channel = useChannel("my-channel")
 * channel.bind('some-event', () => {})
 * ```
 */
export function useChannel<T extends Channel & PresenceChannel>(
  channelName: string | undefined,
): T | undefined {
  const [channel, setChannel] = useState<T | undefined>(undefined);
  const { subscribe, unsubscribe } = useChannels();

  useEffect(() => {
    if (!channelName || !subscribe || !unsubscribe) return;

    const _channel = subscribe<T>(channelName);
    setChannel(_channel);
    return () => unsubscribe(channelName);
  }, [channelName, subscribe, unsubscribe]);

  return channel;
}
