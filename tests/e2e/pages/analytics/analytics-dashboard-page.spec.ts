import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Analytics Dashboard Page', () => {
  test.describe.configure({ mode: 'serial' });

  test('renders dashboard overview cards and tabs', async ({ page }) => {
    test.fixme(
      true,
      'Route currently hangs during E2E navigation on active dev servers.',
    );
    test.slow();

    await page.goto('/analytics/dashboard', {
      waitUntil: 'commit',
      timeout: 120000,
    });

    await expect(page.getByText('Analytics Dashboard').first()).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Overview' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Job Boards' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Resumes' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Trends' })).toBeVisible();
    await expect(page.getByText('Total Applications').first()).toBeVisible();
  });

  test('redirects analytics base route to resumes', async ({ page }) => {
    test.fixme(
      true,
      'Route currently hangs during E2E navigation on active dev servers.',
    );
    test.slow();

    await page.goto('/analytics', {
      waitUntil: 'commit',
      timeout: 120000,
    });

    await expect(page).toHaveURL(/\/resumes(?:\?.*)?$/);
    await expect(page.getByText('Resumes').first()).toBeVisible();
  });
});
