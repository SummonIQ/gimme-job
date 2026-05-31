import { test } from '@playwright/test';

test('capture jobs screenshot', async ({ page }) => {
  await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1000);
  await page.screenshot({
    path: 'tests/e2e/artifacts/screenshots/job-search-logos.png',
    fullPage: true,
  });
});
