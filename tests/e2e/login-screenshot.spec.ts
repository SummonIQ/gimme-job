import { test } from '@playwright/test';

test('capture jobs screenshot', async ({ page }) => {
  await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/job-search-logos.png', fullPage: true });
});
