import { test as setup } from '@playwright/test';

const authFile = '.playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');

  const form = page.locator('form').first();
  const emailField = form.getByRole('textbox', { name: 'Email address' });
  const passwordField = form.getByLabel(/password/i);
  const submitButton = form.getByRole('button', { name: /sign in/i });

  await emailField.fill(process.env.TEST_EMAIL ?? '');
  await passwordField.fill(process.env.TEST_PASSWORD ?? '');

  await submitButton.click();
  await page.waitForLoadState('networkidle');

  await page.goto('/jobs', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.getByRole('heading', { name: /job listings/i }).waitFor({
    timeout: 30000,
  });

  // Save signed-in state
  await page.context().storageState({ path: authFile });
});
