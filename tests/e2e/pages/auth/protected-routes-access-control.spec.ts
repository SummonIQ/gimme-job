import { expect, test } from '@playwright/test';

const EMPTY_STORAGE = { cookies: [], origins: [] };

test.use({ storageState: EMPTY_STORAGE });

const protectedRoutes = [
  '/jobs',
  '/leads',
  '/notifications',
  '/resumes',
  '/settings',
  '/tools',
];

test.describe('Protected Routes Access Control', () => {
  protectedRoutes.forEach(path => {
    test(`redirects unauthenticated user from ${path} to login`, async ({
      page,
    }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });

      await expect(page).toHaveURL(/\/login/);
      await expect(page.getByText('Login').first()).toBeVisible();
    });
  });
});
