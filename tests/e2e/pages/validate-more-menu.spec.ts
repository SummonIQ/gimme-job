import { expect, test } from '@playwright/test';

test('more menu button appears next to close button on job detail modal', async ({ page }) => {
  await page.goto('/jobs');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Click the first job listing to open the detail modal
  const firstJob = page.locator('[class*="cursor-pointer"]').first();
  await firstJob.click();
  await page.waitForTimeout(2000);

  // Screenshot the modal top-right area
  await page.screenshot({ path: '/tmp/more-menu-before.png', fullPage: false });

  // Find the more options button (MoreHorizontal icon button)
  const moreButton = page.locator('button:has-text("More options")');
  await expect(moreButton).toBeVisible();

  // Click the more menu button
  await moreButton.click();
  await page.waitForTimeout(500);

  // Screenshot with dropdown open
  await page.screenshot({ path: '/tmp/more-menu-open.png', fullPage: false });

  // Verify the "Ignore all jobs from" menu item is visible
  const ignoreItem = page.locator('[role="menuitem"]:has-text("Ignore all jobs from")');
  await expect(ignoreItem).toBeVisible();
});
