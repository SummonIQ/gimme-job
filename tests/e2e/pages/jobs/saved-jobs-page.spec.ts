import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Saved Jobs Page', () => {
  test('renders the saved jobs report with key table controls', async ({ page }) => {
    await page.goto('/jobs/saved', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Saved Jobs' }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Search job listings...')).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Company' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });
});
