import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Tools Page', () => {
  test('renders tool groups and key tool cards', async ({ page }) => {
    await page.goto('/tools', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { level: 1, name: 'Tools' })).toBeVisible();
    await expect(
      page.getByText('A collection of tools to help you with your job search.'),
    ).toBeVisible();

    await expect(page.getByRole('link', { name: 'ATS Optimizer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Application Automation' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Safety Controls' })).toBeVisible();
  });
});
