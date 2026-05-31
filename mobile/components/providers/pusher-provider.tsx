import { PUSHER_CLUSTER, PUSHER_KEY } from '@/constants/config';
import { disconnectPusher, getPusherClient, getUserChannel } from '@/lib/pusher/client';
import { useAuthStore } from '@/stores/auth';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import type Pusher from 'pusher-js';
import type { Channel } from 'pusher-js';

interface PusherContextValue {
  pusher: Pusher | null;
  userChannel: Channel | null;
}

const PusherContext = createContext<PusherContextValue>({
  pusher: null,
  userChannel: null,
});

export function usePusherContext() {
  return useContext(PusherContext);
}

export function PusherProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, userId } = useAuthStore();
  const queryClient = useQueryClient();
  const pusherRef = useRef<Pusher | null>(null);
  const channelRef = useRef<Channel | null>(null);

  useEffect(() => {
    if (!isAuthenticated || !userId || !PUSHER_KEY) return;

    let cancelled = false;

    (async () => {
      const client = await getPusherClient();
      if (cancelled || !client) return;

      pusherRef.current = client;
      const channelName = getUserChannel(userId);
      const channel = client.subscribe(channelName);
      channelRef.current = channel;

      // Handle real-time notifications
      channel.bind('notification', (data: { title?: string; description?: string; type?: string }) => {
        if (data.title) {
          Alert.alert(data.title, data.description ?? '');
        }
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      });

      // Handle data updates — invalidate relevant queries
      channel.bind('data-update', (data: { type?: string; data?: { id?: string } }) => {
        switch (data.type) {
          case 'job-lead-optimization-progress':
            queryClient.invalidateQueries({ queryKey: ['leads'] });
            queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
            if (data.data?.id) {
              queryClient.invalidateQueries({ queryKey: ['lead', data.data.id] });
            }
            break;
          case 'job-search-progress':
            queryClient.invalidateQueries({ queryKey: ['jobs'] });
            break;
          case 'resume-analysis-progress':
          case 'resume-optimization-progress':
            queryClient.invalidateQueries({ queryKey: ['resumes'] });
            break;
        }
      });
    })();

    return () => {
      cancelled = true;
      if (channelRef.current) {
        channelRef.current.unbind_all();
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      disconnectPusher();
      pusherRef.current = null;
    };
  }, [isAuthenticated, userId, queryClient]);

  return (
    <PusherContext.Provider
      value={{ pusher: pusherRef.current, userChannel: channelRef.current }}
    >
      {children}
    </PusherContext.Provider>
  );
}
