import { expect, test } from '@playwright/test';

test.describe('assist mode mock fixtures', () => {
  test('core mock has expected application fields', async ({ page }) => {
    await page.goto('/assist-mode-mock-core.html');
    await expect(page.getByRole('heading', { name: 'Assist Mode Core Mock' })).toBeVisible();

    await expect(page.getByLabel('Phone *')).toBeVisible();
    await expect(page.getByLabel('Resume/CV *')).toBeVisible();
    await expect(page.getByText('Pronouns')).toBeVisible();
    await expect(
      page.getByLabel('How many years of professional experience do you have building frontend web applications?'),
    ).toBeVisible();

    const country = page.locator('#country');
    await expect(country).toBeVisible();
    await country.selectOption({ label: 'United States' });
    await expect(country).toHaveValue('United States');

    await page.screenshot({ path: '/tmp/assist-mode-mock-core.png', fullPage: true });
  });

  test('select mock supports programmatic select changes', async ({ page }) => {
    await page.goto('/assist-mode-mock-selects.html');
    await expect(page.getByRole('heading', { name: 'Select Interaction Mock' })).toBeVisible();

    const workAuth = page.locator('#workAuth');
    const state = page.locator('#state');

    await workAuth.selectOption({ label: 'Authorized to work in US' });
    await state.selectOption({ label: 'California' });

    await expect(workAuth).toHaveValue('Authorized');
    await expect(state).toHaveValue('CA');

    await page.screenshot({ path: '/tmp/assist-mode-mock-selects.png', fullPage: true });
  });
});
