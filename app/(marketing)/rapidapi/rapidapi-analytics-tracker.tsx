'use client';

import { useAnalytics } from '@summoniq/signalsplash-client-sdk/react';
import { useEffect } from 'react';

const CLICK_EVENT_ATTRIBUTE = 'data-rapidapi-event';
const EVENT_LABEL_ATTRIBUTE = 'data-rapidapi-label';
const ENDPOINT_ATTRIBUTE = 'data-rapidapi-endpoint';

export function RapidApiAnalyticsTracker() {
  const { track } = useAnalytics();

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const trigger = target.closest<HTMLElement>(`[${CLICK_EVENT_ATTRIBUTE}]`);
      if (!trigger) return;

      track(trigger.getAttribute(CLICK_EVENT_ATTRIBUTE) ?? 'rapidapi_interaction', {
        label:
          trigger.getAttribute(EVENT_LABEL_ATTRIBUTE) ??
          trigger.textContent?.trim() ??
          'unknown',
        page_name: 'rapidapi',
        source: 'marketing_api_page',
      });
    };

    const handleToggle = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLDetailsElement)) return;
      if (!target.open) return;

      const endpoint = target.getAttribute(ENDPOINT_ATTRIBUTE);
      if (!endpoint) return;

      track('rapidapi_endpoint_expanded', {
        endpoint,
        page_name: 'rapidapi',
        source: 'marketing_api_page',
      });
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('toggle', handleToggle, true);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('toggle', handleToggle, true);
    };
  }, [track]);

  return null;
}
