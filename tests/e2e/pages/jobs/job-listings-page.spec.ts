import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Job Listings Page', () => {
  test('shows search controls and empty-state content by default', async ({ page }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Job Listings' }),
    ).toBeVisible();
    await expect(
      page.getByText('Find, track, and apply to jobs that match your career goals.'),
    ).toBeVisible();

    await expect(
      page.getByRole('button', { name: /^Search$/ }).first(),
    ).toBeVisible();
    await expect(page.getByRole('combobox').first()).toBeVisible();
    await expect(page.getByText('No jobs found')).toBeVisible();
  });
});
