import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Profile Settings Page', () => {
  test('renders profile settings content', async ({ page }) => {
    await page.goto('/settings/profile', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Settings' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Profile' })).toBeVisible();
    await expect(
      page.getByText(
        'Manage the identity, application defaults, and resume details used for',
      ),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Personal Information' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Application Defaults' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Work Experience' }),
    ).toBeVisible();
    await expect(page.getByText('Hispanic / Latino')).toBeVisible();
    await expect(page.getByText('Disability Status')).toBeVisible();
  });
});
