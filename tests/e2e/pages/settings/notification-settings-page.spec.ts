import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Notification Settings Page', () => {
  test('renders notification preference sections and interactive toggles', async ({
    page,
  }) => {
    await page.goto('/settings/notifications', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('Notification Settings').first()).toBeVisible();
    await expect(page.getByText('Notification Channels')).toBeVisible();
    await expect(page.getByText('Notification Types')).toBeVisible();

    const inAppSwitch = page.getByLabel('In-App Notifications');
    await expect(inAppSwitch).toBeVisible();

    const before = await inAppSwitch.getAttribute('aria-checked');
    await inAppSwitch.click();
    const after = await inAppSwitch.getAttribute('aria-checked');
    expect(after).not.toEqual(before);

    // Revert local UI toggle so test does not leave state inverted before save.
    await inAppSwitch.click();

    const switchCount = await page.getByRole('switch').count();
    expect(switchCount).toBeGreaterThanOrEqual(8);

    await expect(page.getByRole('button', { name: 'Save Changes' })).toBeVisible();
  });
});
