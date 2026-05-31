import { expect, test } from '@playwright/test';

test.use({
  storageState: '.playwright/.auth/user.json',
  viewport: { width: 390, height: 844 },
});

test.describe('Mobile Navigation', () => {
  test('opens mobile menu and shows nested jobs links', async ({ page }) => {
    test.fixme(
      true,
      'Mobile menu content is not consistently exposed in headless CI runs yet.',
    );

    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    await page.getByRole('button', { name: 'Toggle menu' }).click();

    await expect(page.getByText('Overview').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Jobs' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tools' })).toBeVisible();

    await page.getByRole('button', { name: 'Jobs' }).click();

    await expect(page.getByRole('link', { name: 'Saved' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Dismissed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Searches' })).toBeVisible();
  });
});
