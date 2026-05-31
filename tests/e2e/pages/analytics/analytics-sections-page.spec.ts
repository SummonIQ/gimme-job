import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

interface AnalyticsRouteCase {
  expectedHeading: string;
  expectedText: string;
  path: string;
  unstable?: boolean;
}

const analyticsRoutes: AnalyticsRouteCase[] = [
  {
    path: '/analytics/applications',
    expectedHeading: 'Application Analytics',
    expectedText: 'Application Conversion Funnel',
    unstable: true,
  },
  {
    path: '/analytics/job-leads',
    expectedHeading: 'Job Applications',
    expectedText: 'Application Status Distribution',
    unstable: true,
  },
  {
    path: '/analytics/job-searches',
    expectedHeading: 'Job Searches',
    expectedText: 'Search Success Rate',
    unstable: true,
  },
  {
    path: '/analytics/resumes',
    expectedHeading: 'Resume Performance',
    expectedText: 'Resume Optimization Scores',
    unstable: true,
  },
  {
    path: '/analytics/skills',
    expectedHeading: 'Skills Gap Analysis',
    expectedText: 'Skills improvement insights',
    unstable: true,
  },
  {
    path: '/analytics/timing',
    expectedHeading: 'Application Timing',
    expectedText: 'Best times to apply',
  },
  {
    path: '/analytics/interviews',
    expectedHeading: 'Interview Performance',
    expectedText: 'Track your interview success and identify areas for improvement',
    unstable: true,
  },
  {
    path: '/analytics/performance',
    expectedHeading: 'Search Performance',
    expectedText: 'Comprehensive search analytics',
    unstable: true,
  },
  {
    path: '/analytics/exports',
    expectedHeading: 'Data Export & Reporting',
    expectedText: 'Quick Export',
    unstable: true,
  },
];

test.describe('Analytics Section Pages', () => {
  test.describe.configure({ mode: 'serial' });

  analyticsRoutes.forEach(route => {
    test(`renders ${route.path}`, async ({ page }) => {
      test.fixme(
        route.unstable,
        'Route currently hangs during E2E navigation on active dev servers.',
      );
      test.slow();

      await page.goto(route.path, {
        waitUntil: 'commit',
        timeout: 120000,
      });

      await expect(page.getByText(route.expectedHeading).first()).toBeVisible();
      await expect(page.getByText(route.expectedText).first()).toBeVisible();
      await expect(page.getByText('Build Error')).toHaveCount(0);
    });
  });
});
