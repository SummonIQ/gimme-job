'use client';

import { useEffect } from 'react';

export function PerformanceMeasureGuard() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    if (typeof performance === 'undefined') return;

    const existing = (performance as any).__gimmeJobMeasurePatched;
    if (existing) return;

    const originalMeasure = performance.measure.bind(performance);

    (performance as any).__gimmeJobMeasurePatched = true;

    performance.measure = ((...args: any[]) => {
      try {
        return (originalMeasure as any)(...args);
      } catch (error) {
        const message = error instanceof Error ? error.message : '';
        if (
          message.toLowerCase().includes('cannot have a negative time stamp')
        ) {
          return;
        }
        throw error;
      }
    }) as any;
  }, []);

  return null;
}
