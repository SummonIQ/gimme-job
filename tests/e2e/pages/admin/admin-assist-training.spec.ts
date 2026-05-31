import { expect, test } from '@playwright/test';

test('admin assist training page renders', async ({ page }) => {
  await page.goto('/admin/assist-training');
  await page.waitForLoadState('networkidle', { timeout: 15000 });

  await expect(page.locator('text=Assist Training')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.locator('text=Start Training Session')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.locator('text=Application URLs')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.locator('text=Max Steps per URL')).toBeVisible({
    timeout: 5000,
  });
  await expect(page.locator('text=Dry Run')).toBeVisible({ timeout: 5000 });

  await page.screenshot({
    path: '/tmp/assist-training-page.png',
    fullPage: true,
  });
});
