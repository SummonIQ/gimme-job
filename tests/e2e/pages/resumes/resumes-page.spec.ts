import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Resumes Page', () => {
  test('renders resumes report and upload action', async ({ page }) => {
    await page.goto('/resumes', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Resumes' }),
    ).toBeVisible();
    await expect(
      page.getByText('Upload and manage your resumes.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'New Resume' })).toBeVisible();

    await expect(page.getByPlaceholder('Search resumes...')).toBeVisible();
    await expect(
      page.getByRole('columnheader', { name: 'Score', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'New Score' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
  });
});
