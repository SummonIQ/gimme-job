import type {
  Channel,
  default as Pusher,
  Options,
  PresenceChannel,
} from 'pusher-js';
import type * as React from 'react';

export interface PusherContextValues {
  client?: Pusher;
  triggerEndpoint?: string;
}

export interface ChannelsContextValues {
  getChannel?: <T extends Channel & PresenceChannel>(
    channelName: string,
  ) => T | undefined;
  subscribe?: <T extends Channel & PresenceChannel>(
    channelName: string,
  ) => T | undefined;
  unsubscribe?: <T extends Channel & PresenceChannel>(
    channelName: string,
  ) => void;
}

export interface PusherProviderProps extends Options {
  _PusherRuntime?: typeof Pusher;
  children: React.ReactNode;
  clientKey: string | undefined;
  cluster:
    | 'mt1'
    | 'us2'
    | 'us3'
    | 'eu'
    | 'ap1'
    | 'ap2'
    | 'ap3'
    | 'ap4'
    | string
    | undefined;
  defer?: boolean;
  triggerEndpoint?: string;
  value?: PusherContextValues;
}
