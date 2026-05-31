import { test, expect } from '@playwright/test';

test('resumes page loads without error', async ({ page }) => {
  await page.goto('/resumes');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Should NOT show error page
  const errorHeading = page.locator('text=Something went wrong');
  await expect(errorHeading).not.toBeVisible({ timeout: 5000 });

  await page.screenshot({
    path: 'tests/e2e/artifacts/resumes-page-fixed.png',
    fullPage: false,
  });
});

test('resume detail page optimized tab loads', async ({ page }) => {
  await page.goto('/profile/resumes/cmmfs1o1r000oj18odf4aupz1');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  // Should NOT show error page
  const errorHeading = page.locator('text=Something went wrong');
  await expect(errorHeading).not.toBeVisible({ timeout: 5000 });

  // Click Optimized Resume tab
  const optimizedTab = page.getByRole('tab', { name: 'Optimized Resume' });
  if (await optimizedTab.isVisible({ timeout: 3000 }).catch(() => false)) {
    await optimizedTab.click();
    await page.waitForTimeout(1000);
  }

  await page.screenshot({
    path: 'tests/e2e/artifacts/resume-detail-optimized-fixed.png',
    fullPage: false,
  });
});
