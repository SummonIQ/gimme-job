import { expect, test } from '@playwright/test';

const EMPTY_STORAGE = { cookies: [], origins: [] };

test.use({ storageState: EMPTY_STORAGE });

test.describe('Public Marketing Pages', () => {
  test('landing page shows primary marketing CTA', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });

    await expect(page.getByText('AI-Powered Job Search Platform')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Get Started Free' })).toBeVisible();
  });

  test('features page shows feature catalog content', async ({ page }) => {
    await page.goto('/features', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', {
        name: 'Everything You Need to Land Your Dream Job',
      }),
    ).toBeVisible();
    await expect(page.getByText('AI Resume Optimizer')).toBeVisible();
  });

  test('pricing page shows plan cards', async ({ page }) => {
    await page.goto('/pricing', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: 'Simple, Transparent Pricing' }),
    ).toBeVisible();
    await expect(page.getByText('Free')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();
  });

  test('about page shows mission content', async ({ page }) => {
    await page.goto('/about', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', {
        name: 'Our Mission: Help You Land Your Dream Job',
      }),
    ).toBeVisible();
    await expect(page.getByText('Our Story')).toBeVisible();
  });

  test('faq page shows frequently asked questions heading', async ({ page }) => {
    await page.goto('/faq', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: 'Frequently Asked Questions' }),
    ).toBeVisible();
    await expect(page.getByText('Getting Started')).toBeVisible();
  });
});
