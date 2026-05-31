import type { Channel, PresenceChannel } from 'pusher-js';
import { useEffect, useRef, useState } from 'react';

import { useChannels } from '@/hooks/use-channels';
import { useSession } from '@/lib/auth/client';
import { getPrivateUserChannel } from '@/lib/events/channels';

/**
 * Subscribe to the current user's private Pusher channel.
 *
 * Uses a stable channel-name ref so that a transient `undefined` session
 * (e.g. during HMR / refetch) doesn't trigger an unnecessary
 * unsubscribe → resubscribe cycle.
 *
 * @typeparam T Type of channel. Can be `Channel` or `PresenceChannel`.
 * @returns The subscribed channel instance, or `undefined` while connecting.
 */
export function useUserChannel<T extends Channel & PresenceChannel>():
  | T
  | undefined {
  const [channel, setChannel] = useState<T | undefined>(undefined);
  const { subscribe, unsubscribe } = useChannels();
  const { data: session } = useSession();

  const userId = session?.user?.id;
  const channelName = userId ? getPrivateUserChannel(userId) : undefined;

  // Keep the last known channel name so a brief undefined during
  // session refetch / HMR doesn't cause an unsubscribe round-trip.
  const stableChannelRef = useRef(channelName);
  if (channelName) {
    stableChannelRef.current = channelName;
  }

  const stableChannel = stableChannelRef.current;

  useEffect(() => {
    if (!stableChannel || !subscribe || !unsubscribe) return;

    const _channel = subscribe<T>(stableChannel);
    setChannel(_channel);
    return () => unsubscribe(stableChannel);
  }, [stableChannel, subscribe, unsubscribe]);

  return channel;
}
