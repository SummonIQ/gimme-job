import { expect, test } from '@playwright/test';

test('SERPAPI best apply option prefers less-protected host', async ({ request }) => {
  const response = await request.post('/api/guided-applications/best-apply-option', {
    data: {
      jobProvider: 'SERPAPI',
      applyOptions: [
        { link: 'https://www.google.com/search?q=job+apply' },
        { link: 'https://boards.greenhouse.io/example/jobs/123' },
      ],
    },
  });

  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as { bestApplyUrl?: string | null };
  expect(body.bestApplyUrl).toContain('greenhouse.io');
});
