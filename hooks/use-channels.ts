import { useContext, useEffect } from 'react';

import { __ChannelsContext } from '@/components/providers/channels-provider';
import type { ChannelsContextValues } from '@/types/pusher';

const NOT_IN_CONTEXT_WARNING =
  'No Channels context. Did you forget to wrap your app in a <ChannelsProvider />?';

/**
 * Provides access to the channels global provider.
 */
export function useChannels(): ChannelsContextValues {
  const context = useContext<ChannelsContextValues>(__ChannelsContext);
  useEffect(() => {
    if (!context || !Object.keys(context).length) {
      console.warn(NOT_IN_CONTEXT_WARNING);
    }
  }, [context]);
  return context;
}
