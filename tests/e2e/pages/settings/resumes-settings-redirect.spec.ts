import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Settings Resumes Redirect', () => {
  test('redirects /settings/resumes to /resumes', async ({ page }) => {
    await page.goto('/settings/resumes', { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(/\/resumes$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Resumes' })).toBeVisible();
  });
});
