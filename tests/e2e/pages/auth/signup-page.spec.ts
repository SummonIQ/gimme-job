import { expect, test } from '@playwright/test';

const EMPTY_STORAGE = { cookies: [], origins: [] };

test.use({ storageState: EMPTY_STORAGE });

test.describe('Signup Page', () => {
  test('renders signup form and validates invalid entries', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Sign up' })).toBeVisible();
    await expect(page.getByLabel('First name')).toBeVisible();
    await expect(page.getByLabel('Last name')).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Email address' })).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();

    await page.getByLabel('First name').fill('E2E');
    await page.getByRole('textbox', { name: 'Email address' }).fill('not-an-email');
    await page.getByLabel('Password').fill('123');

    await page.getByRole('button', { name: 'Sign up' }).click();

    await expect(
      page.getByText('We need a bit more information before creating your account:'),
    ).toBeVisible();
    await expect(page.getByText(/last name is required/i)).toBeVisible();
    await expect(page.getByText(/enter a valid email address/i)).toBeVisible();
    await expect(
      page.getByText(/password must be at least 8 characters/i),
    ).toBeVisible();
  });

  test('links back to login page', async ({ page }) => {
    await page.goto('/signup', { waitUntil: 'domcontentloaded' });

    await page.getByRole('link', { name: 'Login' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible();
  });
});
