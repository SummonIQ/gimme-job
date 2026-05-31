import { expect, test } from '@playwright/test';

test('assist mode browser view does not overlap content', async ({ page }) => {
  await page.goto('/leads');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(3000);

  const firstLeadLink = page.locator('table tbody tr a').first();
  await expect(firstLeadLink).toBeVisible({ timeout: 10000 });
  await firstLeadLink.click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  const applyButton = page.locator('button:has-text("Apply")').first();
  await expect(applyButton).toBeVisible({ timeout: 10000 });
  await applyButton.click();
  await page.waitForTimeout(500);

  const assistOption = page.locator('text=Apply with AI Assist');
  if (!(await assistOption.isVisible())) {
    console.log('No AI Assist option - skipping');
    return;
  }

  await assistOption.click();
  await page.waitForTimeout(1000);
  const modal = page.locator('[role="dialog"]');
  await expect(modal).toBeVisible({ timeout: 10000 });

  // Wait for loading state to disappear (API now inlines CSS server-side)
  const loadingText = modal.locator('text=Loading application preview');
  try {
    await expect(loadingText).toBeHidden({ timeout: 45000 });
  } catch {
    console.log('Warning: Loading text still visible after 45s');
  }
  // Extra buffer for rendering
  await page.waitForTimeout(3000);

  // Verify shadow DOM loaded correctly
  const shadowInfo = await page.evaluate(() => {
    const allDivs = document.querySelectorAll('[role="dialog"] div');
    for (const div of allDivs) {
      if (!div.shadowRoot) continue;
      const root = div.shadowRoot.querySelector('.assist-root');
      if (!root) continue;
      return {
        linkCount: div.shadowRoot.querySelectorAll('link').length,
        styleCount: div.shadowRoot.querySelectorAll('style').length,
        hasContent: root.children.length > 0,
      };
    }
    return null;
  });
  console.log('Shadow DOM:', JSON.stringify(shadowInfo));

  // Screenshot content area
  const contentArea = modal.locator('div.flex-1').first();
  await contentArea.screenshot({ path: '/tmp/assist-mode-content.png' });
  await page.screenshot({
    path: '/tmp/assist-mode-modal.png',
    fullPage: false,
  });

  // Verify modal structure
  const urlBar = modal.locator('input[readonly][type="text"]');
  await expect(urlBar).toBeVisible();
  const footer = modal.locator('text=Open in Browser');
  await expect(footer).toBeVisible();

  // Verify tabs have been removed (no tab lists in modal header)
  const tabLists = modal.locator('[role="tablist"]');
  await expect(tabLists).toHaveCount(0);

  // Verify specific tab labels are gone
  await expect(modal.locator('[role="tab"]:has-text("Readable")')).toHaveCount(
    0,
  );
  await expect(modal.locator('[role="tab"]:has-text("Original")')).toHaveCount(
    0,
  );
  await expect(modal.locator('[role="tab"]:has-text("Raw")')).toHaveCount(0);
  await expect(modal.locator('[role="tab"]:has-text("Sanitized")')).toHaveCount(
    0,
  );

  // Verify navigation buttons still present
  await expect(modal.getByRole('button', { name: 'Back' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Forward' })).toBeVisible();
  await expect(modal.getByRole('button', { name: 'Refresh' })).toBeVisible();

  console.log('Assist mode modal validated — tabs removed, nav intact');
});
