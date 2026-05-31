'use client';

import { dequal } from 'dequal';
import type { Options } from 'pusher-js';
import Pusher from 'pusher-js';
import React, { useEffect, useMemo, useRef, useState } from 'react';

import type { PusherContextValues, PusherProviderProps } from '@/types/pusher';

import { ChannelsProvider } from './channels-provider';

// context setup
const PusherContext = React.createContext<PusherContextValues>({});
export const __PusherContext = PusherContext;

/**
 * Memoizes a value using deep equality.
 */
function useDeepCompareMemoize<T>(value: T): T {
  const ref = useRef<T>(value);
  if (!dequal(value, ref.current)) {
    ref.current = value;
  }
  return ref.current;
}

export const CorePusherProvider: React.FC<PusherProviderProps> = ({
  clientKey,
  cluster,
  triggerEndpoint,
  defer = false,
  children,
  _PusherRuntime,
  value, // extracted so it won't be included in restProps
  ...restProps // these are the additional, stable props you want to pass to Pusher
}) => {
  // Log errors when required props are not passed.
  useEffect(() => {
    if (!clientKey) console.error('A client key is required for pusher');
    if (!cluster) console.error('A cluster is required for pusher');
  }, [clientKey, cluster]);

  // Create a stable version of restProps that only updates when its deep contents change.
  const stableRestProps = useDeepCompareMemoize(restProps);

  const config: Options = useMemo(
    () => ({ cluster: cluster as string, ...stableRestProps }),
    [cluster, stableRestProps],
  );

  // Track config for comparison.
  const previousConfig = useRef<Options | undefined>(config);
  useEffect(() => {
    previousConfig.current = config;
  }, [config]);

  const [client, setClient] = useState<Pusher | undefined>(undefined);

  useEffect(() => {
    // Skip creation of client if deferring, a value prop is passed,
    // or if the config hasn't changed.
    if (
      !_PusherRuntime ||
      defer ||
      !clientKey ||
      value ||
      (dequal(previousConfig.current, config) && client !== undefined)
    ) {
      return;
    }

    setClient(new _PusherRuntime(clientKey, config));
  }, [client, clientKey, defer, _PusherRuntime, config, value]);

  return (
    <PusherContext.Provider
      value={{ client, triggerEndpoint }}
      {...stableRestProps}
    >
      <ChannelsProvider>{children}</ChannelsProvider>
    </PusherContext.Provider>
  );
};

/** Wrapper around the core PusherProvider that passes in the Pusher lib */
export const PusherProvider: React.FC<PusherProviderProps> = props => (
  <CorePusherProvider _PusherRuntime={Pusher} {...props} />
);
