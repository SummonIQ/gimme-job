import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Account Settings Page', () => {
  test('renders settings shell and left navigation', async ({ page }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeVisible();
    await expect(page.getByRole('link', { name: 'Account' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Profile' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Appearance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Account' })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Change Email' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Reset Password' }),
    ).toBeVisible();
  });
});
