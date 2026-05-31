import { test as setup } from '@playwright/test';
import { existsSync } from 'node:fs';

const authFile = '.playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_EMAIL ?? process.env.E2E_EMAIL ?? '';
  const password = process.env.TEST_PASSWORD ?? process.env.E2E_PASSWORD ?? '';

  if (!email || !password) {
    if (existsSync(authFile)) {
      return;
    }

    throw new Error(
      'Missing TEST_EMAIL/TEST_PASSWORD (or E2E_EMAIL/E2E_PASSWORD) and no existing .playwright auth state found.',
    );
  }

  await page.goto('/login');

  const form = page.locator('form').first();
  const emailField = form.getByRole('textbox', { name: 'Email address' });
  const passwordField = form.getByLabel(/password/i);
  const submitButton = form.getByRole('button', { name: /sign in/i });

  await emailField.fill(email);
  await passwordField.fill(password);

  await submitButton.click();
  await page.waitForURL(url => !url.toString().includes('/login'), {
    timeout: 30000,
  });

  await page.goto('/dashboard', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page
    .getByRole('heading', { name: /dashboard/i })
    .first()
    .waitFor({
      timeout: 30000,
    });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
