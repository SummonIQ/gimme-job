import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Applied Job Leads Page', () => {
  test('renders applied leads report', async ({ page }) => {
    await page.goto('/leads/applied', { waitUntil: 'domcontentloaded' });

    await expect(
      page
        .getByRole('heading', { level: 1, name: 'Applied Job Leads' })
        .first(),
    ).toBeVisible();
    await expect(page.getByPlaceholder('Search leads...')).toBeVisible();

    await expect(page.getByRole('columnheader', { name: 'Title' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Company' })).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Status', exact: true }),
    ).toBeVisible();
  });
});
