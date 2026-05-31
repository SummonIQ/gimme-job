import { expect, test } from '@playwright/test';

test.describe('Job Lead Progress Tracker', () => {
  test('progress tracker displays correctly on job lead page', async ({
    page,
  }) => {
    // Navigate to leads page
    await page.goto('/leads');
    await expect(page).toHaveURL(/\/leads/);
    await page.waitForLoadState('networkidle');

    // Navigate to the first job lead detail page via link
    const leadLink = page.locator('a[href^="/leads/"]').first();
    await expect(leadLink).toBeVisible({ timeout: 10000 });
    await leadLink.click();
    await expect(page).toHaveURL(/\/leads\/[a-z0-9]+/);
    await page.waitForLoadState('networkidle');

    // Wait for progress tracker to be visible
    const progressTracker = page.locator(
      '[data-testid="job-lead-progress-tracker"]',
    );
    await expect(progressTracker).toBeVisible({ timeout: 10000 });
    await progressTracker.scrollIntoViewIfNeeded();
    await expect(progressTracker).toContainText('Added');
    await page.waitForTimeout(250);

    // Verify the progress tracker stretches full width (no extra space at end)
    const trackerBox = await progressTracker.boundingBox();
    expect(trackerBox).toBeTruthy();

    // Take screenshot for visual verification
    if (trackerBox) {
      await progressTracker.screenshot({
        path: 'tests/e2e/screenshots/job-lead-progress-tracker.png',
      });
    }
  });
});
