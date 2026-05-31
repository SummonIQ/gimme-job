import { endOfMonth, startOfMonth } from 'date-fns';
import { unauthorized } from 'next/navigation';

import { JobSearchEffectivenessAnalyzer } from '@/lib/analytics/job-search-effectiveness';
import { getCurrentUser } from '@/lib/user/query';

import PageClient from './page-client';

export default async function Page() {
  const user = await getCurrentUser();
  if (!user) return unauthorized();

  const now = new Date();
  const dateRange = {
    start: startOfMonth(now),
    end: endOfMonth(now),
  };

  const [strategies, timing, platforms, keywords] = await Promise.all([
    JobSearchEffectivenessAnalyzer.analyzeSearchStrategies(user.id, dateRange),
    JobSearchEffectivenessAnalyzer.analyzeApplicationTiming(user.id, dateRange),
    JobSearchEffectivenessAnalyzer.analyzePlatformROI(user.id, dateRange),
    JobSearchEffectivenessAnalyzer.analyzeKeywordPerformance(
      user.id,
      dateRange,
    ),
  ]);

  const initialData = {
    strategies: strategies.slice(0, 5),
    timing: timing.slice(0, 5),
    platforms: platforms.slice(0, 5),
    keywords: keywords.slice(0, 10),
    dateRange: {
      start: dateRange.start.toISOString(),
      end: dateRange.end.toISOString(),
    },
  };

  return <PageClient initialData={initialData} />;
}
