import { expect, test } from '@playwright/test';

test('job search bar controls are same height', async ({ page }) => {
  await page.goto('/jobs?search=software%20engineer');
  await page.waitForLoadState('networkidle');

  const searchInput = page.locator('input[data-slot="input"]').first();
  const locationCombobox = page.locator('button[role="combobox"]').first();
  const searchButton = page.locator('button:has-text("Search")').first();
  const saveButton = page.locator('button:has-text("Save"), button:has-text("Saved")').first();

  await expect(searchInput).toBeVisible();
  await expect(locationCombobox).toBeVisible();
  await expect(searchButton).toBeVisible();
  await expect(saveButton).toBeVisible();

  const inputBox = await searchInput.boundingBox();
  const locationBox = await locationCombobox.boundingBox();
  const searchBox = await searchButton.boundingBox();
  const saveBox = await saveButton.boundingBox();

  expect(inputBox).toBeTruthy();
  expect(locationBox).toBeTruthy();
  expect(searchBox).toBeTruthy();
  expect(saveBox).toBeTruthy();

  const inputHeight = inputBox!.height;
  const locationHeight = locationBox!.height;
  const searchHeight = searchBox!.height;
  const saveHeight = saveBox!.height;

  const tolerancePx = 2;

  expect(Math.abs(inputHeight - searchHeight)).toBeLessThanOrEqual(tolerancePx);
  expect(Math.abs(locationHeight - searchHeight)).toBeLessThanOrEqual(tolerancePx);
  expect(Math.abs(saveHeight - searchHeight)).toBeLessThanOrEqual(tolerancePx);

  await page.screenshot({ path: '/tmp/job-search-bar-heights.png', fullPage: false });
});
