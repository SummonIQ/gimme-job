import { test } from '@playwright/test';

test('login and capture jobs screenshot', async ({ page }) => {
  await page.goto('http://localhost:10100/login', {
    waitUntil: 'domcontentloaded',
  });
  await page.fill('input[type=email]', 'bright-and-early@outlook.com');
  await page.fill('input[type=password]', '12341234');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2000);
  await page.goto('http://localhost:10100/jobs', {
    waitUntil: 'domcontentloaded',
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/job-search-logos.png', fullPage: true });
});
