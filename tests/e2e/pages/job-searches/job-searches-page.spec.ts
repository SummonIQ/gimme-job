import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Job Searches Page', () => {
  test('renders searches report and creation controls', async ({ page }) => {
    await page.goto('/jobs/searches', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Job Searches' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'New Job Search' }),
    ).toBeVisible();
    await expect(page.getByText('Recent Searches')).toBeVisible();

    await page.getByRole('button', { name: 'Recent Searches' }).click();
    await expect(page.getByPlaceholder('Search by search term...')).toBeVisible();
  });
});
