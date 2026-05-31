import type { Channel, PresenceChannel } from 'pusher-js';
import { useEffect, useRef } from 'react';

/**
 * Subscribes to a channel event and registers a callback.
 * Uses a callback ref pattern so the binding stays stable across renders
 * even when the caller passes an inline function.
 *
 * @param channel Pusher channel to bind to
 * @param eventName Name of event to bind to
 * @param callback Callback to call on a new event
 */
export function useEvent<D>(
  channel: Channel | PresenceChannel | undefined,
  eventName: string,
  callback: (data?: D, metadata?: { user_id: string }) => void,
) {
  const callbackRef = useRef(callback);

  // Keep the ref current without triggering re-binds
  useEffect(() => {
    callbackRef.current = callback;
  });

  // Bind/unbind only when the channel or event name changes
  useEffect(() => {
    if (channel === undefined) {
      return;
    }

    const handler = (data?: D, metadata?: { user_id: string }) => {
      callbackRef.current(data, metadata);
    };

    channel.bind(eventName, handler);

    return () => {
      channel.unbind(eventName, handler);
    };
  }, [channel, eventName]);
}
