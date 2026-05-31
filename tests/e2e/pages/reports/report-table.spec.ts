import { expect, test } from '@playwright/test';

test.describe('Report Table UI', () => {
  test('saved jobs table has proper header styling', async ({ page }) => {
    await page.goto('/jobs/saved');
    await page.waitForLoadState('domcontentloaded');

    // Wait for table to appear
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    await table.screenshot({
      path: 'tests/e2e/artifacts/screenshots/report-table-saved.png',
    });

    // Check checkbox column width (w-14 = 3.5rem = 56px)
    const checkboxHeader = page.locator('thead th').first();
    const headerBox = await checkboxHeader.boundingBox();
    expect(headerBox?.width).toBeGreaterThanOrEqual(50);
    expect(headerBox?.width).toBeLessThanOrEqual(65);

    // Check header buttons have px-2 padding (8px)
    const headerButton = page.locator('thead button').first();
    if (await headerButton.isVisible()) {
      await expect(headerButton).toHaveCSS('padding-left', '8px');
      await expect(headerButton).toHaveCSS('padding-right', '8px');
    }
  });

  test('leads table has proper header styling', async ({ page }) => {
    await page.goto('/leads');
    await page.waitForLoadState('domcontentloaded');

    // Wait for table to appear
    const table = page.locator('table');
    await expect(table).toBeVisible({ timeout: 10000 });

    // Check checkbox column width (w-14 = 3.5rem = 56px)
    const checkboxHeader = page.locator('thead th').first();
    const headerBox = await checkboxHeader.boundingBox();
    expect(headerBox?.width).toBeGreaterThanOrEqual(50);
  });
});
