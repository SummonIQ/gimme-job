'use client';

import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import { useEffect, useRef } from 'react';

interface PageTrackerProps {
  /** Page name for analytics */
  pageName: string;
  /** Additional properties to track */
  properties?: Record<string, string | number | boolean>;
}

/**
 * Client component to track page views in server-rendered pages.
 * Place this component anywhere in a server component to track page loads.
 */
export function PageTracker({ pageName, properties = {} }: PageTrackerProps) {
  const { track } = useAnalytics();
  const hasTrackedRef = useRef(false);
  const startTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    // Track page load only once
    if (!hasTrackedRef.current) {
      hasTrackedRef.current = true;
      track('page_loaded', {
        page_name: pageName,
        ...properties,
        timestamp: new Date().toISOString(),
      });
    }

    // Track time spent on unmount
    return () => {
      const timeSpent = Math.round((Date.now() - startTimeRef.current) / 1000);
      track('page_exit', {
        page_name: pageName,
        time_spent_seconds: timeSpent,
        ...properties,
      });
    };
  }, [pageName, properties, track]);

  // This component renders nothing
  return null;
}
