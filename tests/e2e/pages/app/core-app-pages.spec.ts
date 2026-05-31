import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Core App Pages', () => {
  test.describe.configure({ mode: 'serial' });

  test('renders LinkedIn profile page shell', async ({ page }) => {
    test.fixme(
      true,
      'Route currently hangs during E2E navigation on active dev servers.',
    );
    test.slow();

    await page.goto('/linkedin', { waitUntil: 'commit', timeout: 120000 });

    await expect(page.getByText('LinkedIn Profile').first()).toBeVisible();
    await expect(
      page.getByText('Manage your LinkedIn profile integration and networking'),
    ).toBeVisible();
  });

  test('renders people profiles page shell', async ({ page }) => {
    test.slow();

    await page.goto('/people-profiles', {
      waitUntil: 'commit',
      timeout: 120000,
    });

    await expect(page.getByText('People Profiles').first()).toBeVisible();
    await expect(
      page.getByText('View and manage your saved interviewer profiles'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Research Person' })).toBeVisible();
  });

  test('renders mobile experience page shell', async ({ page }) => {
    test.fixme(
      true,
      'Route currently hangs during E2E navigation on active dev servers.',
    );
    test.slow();

    await page.goto('/mobile', { waitUntil: 'commit', timeout: 120000 });

    await expect(page.getByText('Mobile Experience').first()).toBeVisible();
    await expect(
      page.getByText('Optimize your job search experience on mobile devices'),
    ).toBeVisible();
  });

  test('renders portfolio page shell', async ({ page }) => {
    test.fixme(
      true,
      'Route currently hangs during E2E navigation on active dev servers.',
    );
    test.slow();

    await page.goto('/portfolio', { waitUntil: 'commit', timeout: 120000 });

    await expect(page.getByText('Portfolio Management').first()).toBeVisible();
    await expect(
      page.getByText(
        'Create stunning portfolios with AI-powered content generation, GitHub integration, and advanced analytics.',
      ),
    ).toBeVisible();
  });

  test('redirects /overview to /dashboard', async ({ page }) => {
    test.slow();

    await page.goto('/overview', { waitUntil: 'commit', timeout: 120000 });

    await expect(page).toHaveURL(/\/dashboard(?:\?.*)?$/);
    await expect(page.getByText('Overview').first()).toBeVisible();
  });
});
