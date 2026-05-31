import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Notifications Page', () => {
  test('renders notifications shell, tabs, and search controls', async ({ page }) => {
    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Notifications').first()).toBeVisible();
    await expect(
      page.getByPlaceholder('Search notifications...'),
    ).toBeVisible();

    await expect(page.getByRole('tab', { name: 'All' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Unread' })).toBeVisible();
  });
});
