import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

interface ToolsRouteCase {
  expectedHeading: string;
  expectedText: string;
  path: string;
  unstable?: boolean;
}

const toolsRoutes: ToolsRouteCase[] = [
  {
    path: '/tools/ats-optimizer',
    expectedHeading: 'ATS Optimizer',
    expectedText: 'Optimize your resume for Applicant Tracking Systems.',
    unstable: true,
  },
  {
    path: '/tools/job-details-optimizer',
    expectedHeading: 'Job Details Optimizer',
    expectedText: 'Optimize your resume for job descriptions.',
    unstable: true,
  },
  {
    path: '/tools/job-scraper',
    expectedHeading: 'Job Scraper',
    expectedText: 'Search Jobs',
    unstable: true,
  },
  {
    path: '/tools/automation',
    expectedHeading: 'Application Automation',
    expectedText: 'Automated Application Submission',
    unstable: true,
  },
  {
    path: '/tools/company-research',
    expectedHeading: 'Company Research Tools',
    expectedText: 'Company Research Tools',
  },
  {
    path: '/tools/network',
    expectedHeading: 'Network Analysis & Visualization',
    expectedText: 'Network Analysis & Visualization',
    unstable: true,
  },
  {
    path: '/tools/ats-research',
    expectedHeading: 'ATS Research',
    expectedText: 'Start New Research',
    unstable: true,
  },
  {
    path: '/tools/interview-prep',
    expectedHeading: 'Interview Prep Intelligence',
    expectedText: 'Interviewer Information',
    unstable: true,
  },
];

test.describe('Tools Subpages', () => {
  test.describe.configure({ mode: 'serial' });

  toolsRoutes.forEach(route => {
    test(`renders ${route.path}`, async ({ page }) => {
      test.fixme(
        route.unstable,
        'Known intermittent server error for this route during E2E execution.',
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
