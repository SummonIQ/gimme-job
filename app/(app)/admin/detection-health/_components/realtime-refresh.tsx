'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { SummonFlowRealtimeConfig } from '@/lib/admin/summonflow';

const REALTIME_RECONNECT_MIN_DELAY_MS = 1_000;
const REALTIME_RECONNECT_MAX_DELAY_MS = 30_000;
const POLLING_FALLBACK_MS = 30_000;

type ConnectionState =
  | 'idle'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'unavailable';

interface SummonFlowChannel {
  bind: (event: string, handler: (payload: unknown) => void) => void;
  unbind: (event: string, handler?: (payload: unknown) => void) => void;
}

interface SummonFlowConnection {
  bind: (event: string, handler: (payload: unknown) => void) => void;
  state?: string;
  unbind: (event: string, handler?: (payload: unknown) => void) => void;
}

interface SummonFlowClient {
  connection: SummonFlowConnection;
  disconnect: () => void;
  subscribe: (channelName: string) => SummonFlowChannel;
}

type SummonFlowConstructor = new (
  appKey: string,
  options: {
    forceTLS: boolean;
    reconnectMaxDelay: number;
    reconnectMinDelay: number;
    wsHost?: string;
    wsPort?: number;
    wssPort?: number;
  },
) => SummonFlowClient;

function mapState(raw: string | undefined): ConnectionState {
  switch (raw) {
    case 'connected':
      return 'connected';
    case 'connecting':
      return 'connecting';
    case 'unavailable':
    case 'failed':
      return 'unavailable';
    case 'disconnected':
      return 'reconnecting';
    default:
      return 'idle';
  }
}

const CONNECTION_LABEL: Record<ConnectionState, string> = {
  idle: 'Live updates idle',
  connecting: 'Connecting…',
  connected: 'Live',
  reconnecting: 'Reconnecting…',
  unavailable: 'Polling',
};

export function DetectionHealthRealtimeRefresh({
  config,
  event,
}: {
  config: SummonFlowRealtimeConfig;
  event: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<ConnectionState>('idle');

  useEffect(() => {
    if (!config.appKey) {
      setState('unavailable');
      const interval = window.setInterval(
        () => router.refresh(),
        POLLING_FALLBACK_MS,
      );
      return () => window.clearInterval(interval);
    }

    let client: SummonFlowClient | null = null;
    let channel: SummonFlowChannel | null = null;
    let isMounted = true;

    setState('connecting');

    const handleEvent = () => {
      if (!isMounted) return;
      router.refresh();
    };

    const handleStateChange = (payload: unknown) => {
      const next =
        payload && typeof payload === 'object' && 'current' in payload
          ? (payload as { current?: string }).current
          : undefined;
      if (!isMounted) return;
      setState(mapState(next));
    };

    const handleError = () => {
      if (!isMounted) return;
      setState('unavailable');
    };

    void import('@summoniq/summonflow-client-sdk')
      .then(module => {
        if (!isMounted) return;
        const SummonFlow = (module.default ??
          (module as { SummonFlow?: SummonFlowConstructor })
            .SummonFlow) as SummonFlowConstructor;
        client = new SummonFlow(config.appKey, {
          forceTLS: config.forceTLS,
          reconnectMaxDelay: REALTIME_RECONNECT_MAX_DELAY_MS,
          reconnectMinDelay: REALTIME_RECONNECT_MIN_DELAY_MS,
          wsHost: config.wsHost,
          wsPort: config.wsPort,
          wssPort: config.forceTLS ? config.wsPort : undefined,
        });
        client.connection.bind('state_change', handleStateChange);
        client.connection.bind('error', handleError);
        setState(mapState(client.connection.state));
        channel = client.subscribe(config.channelName);
        channel.bind(event, handleEvent);
      })
      .catch(() => {
        if (!isMounted) return;
        setState('unavailable');
      });

    return () => {
      isMounted = false;
      channel?.unbind(event, handleEvent);
      client?.connection.unbind('state_change', handleStateChange);
      client?.connection.unbind('error', handleError);
      client?.disconnect();
    };
  }, [config, event, router]);

  return (
    <span
      aria-live="polite"
      className="text-muted-foreground inline-flex items-center gap-1.5 text-xs"
    >
      <span
        aria-hidden="true"
        className={
          state === 'connected'
            ? 'size-1.5 rounded-full bg-emerald-500'
            : state === 'connecting' || state === 'reconnecting'
              ? 'size-1.5 rounded-full bg-amber-500 animate-pulse'
              : 'size-1.5 rounded-full bg-muted-foreground/40'
        }
      />
      {CONNECTION_LABEL[state]}
    </span>
  );
}
