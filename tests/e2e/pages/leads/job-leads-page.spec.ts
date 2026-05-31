import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Job Leads Page', () => {
  test('renders active leads report with search and columns', async ({ page }) => {
    await page.goto('/leads', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Job Leads' }),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Search leads...')).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Company' })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Status', exact: true }),
    ).toBeVisible();
  });
});
