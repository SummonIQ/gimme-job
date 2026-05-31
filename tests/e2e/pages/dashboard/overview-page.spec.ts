import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Overview Page', () => {
  test('renders the dashboard shell for authenticated users', async ({ page }) => {
    await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { level: 1, name: 'Overview' }),
    ).toBeVisible();
    await expect(
      page.getByText("Welcome back! Here's an overview of your job search progress."),
    ).toBeVisible();
  });
});
