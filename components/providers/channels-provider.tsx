'use client';

import type { Channel, PresenceChannel } from 'pusher-js';
import React, { useCallback, useRef } from 'react';

import { usePusher } from '@/hooks/use-pusher';
import type { ChannelsContextValues } from '@/types/pusher';
// context setup
const ChannelsContext = React.createContext<ChannelsContextValues>({});
export const __ChannelsContext = ChannelsContext;

type AcceptedChannels = Channel | PresenceChannel;
type ConnectedChannels = {
  [channelName: string]: AcceptedChannels[];
};

/**
 * Provider that creates your channels instances and provides them to child hooks throughout your app.
 */
export const ChannelsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const pusher = usePusher();
  const connectedChannels = useRef<ConnectedChannels>({});

  const subscribe = useCallback(
    <T extends Channel & PresenceChannel>(
      channelName: string,
    ): T | undefined => {
      // Return early if there's no client or channel name
      if (!pusher || !channelName) return;

      // Subscribe to the channel and add it to our collection.
      const pusherChannel = pusher.client?.subscribe(channelName);

      if (!pusherChannel) return;
      connectedChannels.current[channelName] = [
        ...(connectedChannels.current[channelName] || []),
        pusherChannel,
      ];
      return pusherChannel as T;
    },
    [pusher],
  );

  const unsubscribe = useCallback(
    (channelName: string) => {
      // Return early if there's no client or the channel doesn't exist.
      if (
        !pusher ||
        !channelName ||
        !(channelName in connectedChannels.current)
      )
        return;

      // If there is just one subscription, completely unsubscribe.
      if (connectedChannels.current[channelName].length === 1) {
        pusher.client?.unsubscribe(channelName);
        delete connectedChannels.current[channelName];
      } else {
        // Otherwise, remove one instance of the subscription.
        connectedChannels.current[channelName].pop();
      }
    },
    [pusher],
  );

  const getChannel = useCallback(
    <T extends Channel & PresenceChannel>(
      channelName: string,
    ): T | undefined => {
      // Return early if there's no client or the channel isn't subscribed.
      if (
        !pusher ||
        !channelName ||
        !(channelName in connectedChannels.current)
      )
        return;

      // Return the first instance of the channel.
      return connectedChannels.current[channelName][0] as T;
    },
    [pusher],
  );

  return (
    <ChannelsContext.Provider
      value={{
        getChannel,
        subscribe,
        unsubscribe,
      }}
    >
      {children}
    </ChannelsContext.Provider>
  );
};
