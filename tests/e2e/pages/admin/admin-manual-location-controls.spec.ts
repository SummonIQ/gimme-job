import { expect, test, type Page } from '@playwright/test';

interface ScrapePayload {
  location?: string;
  maxPages?: number;
  mode?: string;
  providers?: string[];
  remote?: boolean;
  searchTerm?: string;
}

test.use({ storageState: '.playwright/.auth/user.json' });

const selectManualTab = async (page: Page) => {
  await page.getByRole('tab', { name: 'Manual' }).click();
};

const configureLocation = async (page: Page) => {
  const cityInput = page.locator('#city');
  const stateSelect = page.locator('#state');
  const countrySelect = page.locator('#country');

  await expect(cityInput).toBeVisible();
  await expect(stateSelect).toBeVisible();
  await expect(countrySelect).toBeVisible();

  await expect(countrySelect).toContainText('US');
  await expect(
    page.getByText('Applied to all selected providers (Fantastic, SerpAPI, USAJobs).'),
  ).toHaveCount(0);

  await cityInput.fill('Austin');
  await stateSelect.click();
  await page.getByRole('option', { name: 'Texas' }).click();
};

const assertScrapePayloadLocation = async (page: Page) => {
  let capturedPayload: ScrapePayload | null = null;

  await page.route('**/api/admin/scrape', async route => {
    const request = route.request();

    if (request.method() === 'POST') {
      const payload = request.postDataJSON() as ScrapePayload;
      capturedPayload = payload;
      await route.fulfill({
        contentType: 'application/json',
        status: 200,
        body: JSON.stringify({
          message: 'Scrape started',
          mode: payload.mode ?? 'sync',
          providers: payload.providers ?? ['fantastic'],
          maxPages: payload.maxPages ?? 5,
        }),
      });
      return;
    }

    await route.continue();
  });

  await page.getByRole('button', { name: 'Start Scrape' }).click();

  await expect
    .poll(() => capturedPayload?.location, {
      message: 'Expected location in scrape payload to be composed from city/state/country',
      timeout: 10000,
    })
    .toBe('Austin, Texas, United States');
};

test.describe('Admin Manual Location Controls', () => {
  test('manual controls on admin listings compose location from city/state/country', async ({
    page,
  }) => {
    await page.goto('/admin/listings', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await selectManualTab(page);
    await configureLocation(page);
    await assertScrapePayloadLocation(page);
  });

  test('manual controls on admin ingestion compose location from city/state/country', async ({
    page,
  }) => {
    await page.goto('/admin/ingestion', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    await selectManualTab(page);
    await configureLocation(page);
    await assertScrapePayloadLocation(page);
  });
});
