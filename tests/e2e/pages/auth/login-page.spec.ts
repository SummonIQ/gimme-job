import { expect, test } from '@playwright/test';

const EMPTY_STORAGE = { cookies: [], origins: [] };

test.use({ storageState: EMPTY_STORAGE });

test.describe('Login Page', () => {
  test('renders login form and shows validation summary on empty submit', async ({
    page,
  }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page.getByText("We couldn't sign you in yet")).toBeVisible();
    await expect(page.getByText('Email address is required')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('links to signup page', async ({ page }) => {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: 'Sign up now!' }).click();
    await expect(page).toHaveURL(/\/signup/);
    await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();
  });
});
