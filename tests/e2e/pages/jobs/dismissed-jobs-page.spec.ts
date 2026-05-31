import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Dismissed Jobs Page', () => {
  test('renders dismissed jobs report with search and status columns', async ({ page }) => {
    await page.goto('/jobs/dismissed', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Dismissed Jobs' }).first(),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Search job listings...')).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Company' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });
});
