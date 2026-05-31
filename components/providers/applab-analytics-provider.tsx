'use client';

import { AnalyticsProvider, WebVitals } from '@summoniq/signalsplash-client-sdk/react';
import type { AnalyticsConfig } from '@summoniq/signalsplash-client-sdk';

interface Props {
  children: React.ReactNode;
}

const envEndpoint = process.env.NEXT_PUBLIC_ANALYTICS_ENDPOINT?.trim();
const defaultEndpoint =
  process.env.NODE_ENV === 'production'
    ? 'https://api.signalsplash.com/api/events'
    : '';
const resolvedEndpoint = envEndpoint || defaultEndpoint;
const isAnalyticsEnabled =
  process.env.NEXT_PUBLIC_ANALYTICS_ENABLED !== 'false' &&
  Boolean(resolvedEndpoint);

const analyticsConfig: AnalyticsConfig = {
  appId: 'gimme-job',
  endpoint: resolvedEndpoint || undefined,
  enabled: isAnalyticsEnabled,
  debug: process.env.NODE_ENV === 'development',
  trackPageViews: true,
  trackWebVitals: true,
  sessionTimeout: 30,
};

/**
 * Analytics provider using @summoniq/signalsplash-client-sdk.
 * Sends events to the analytics-api service.
 */
export function AppAnalyticsProvider({ children }: Props) {
  return (
    <AnalyticsProvider config={analyticsConfig}>
      <WebVitals />
      {children}
    </AnalyticsProvider>
  );
}
