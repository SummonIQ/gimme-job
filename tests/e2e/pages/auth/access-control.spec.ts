import { expect, test } from '@playwright/test';

const EMPTY_STORAGE = { cookies: [], origins: [] };

test.use({ storageState: EMPTY_STORAGE });

test.describe('Access Control', () => {
  test('redirects unauthenticated user from protected pages to login', async ({
    page,
  }) => {
    await page.goto('/settings', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('Login').first()).toBeVisible();
  });
});
