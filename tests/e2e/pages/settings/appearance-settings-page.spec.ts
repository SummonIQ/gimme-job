import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Appearance Settings Page', () => {
  test('renders theme controls and allows radio selection', async ({ page }) => {
    await page.goto('/settings/appearance', { waitUntil: 'domcontentloaded' });

    await expect(
      page.getByRole('heading', { name: 'Appearance Settings' }),
    ).toBeVisible();
    await expect(page.getByText('Select the theme for the dashboard.')).toBeVisible();

    const radios = page.getByRole('radiogroup').first().getByRole('radio');
    await expect(radios).toHaveCount(2);

    await radios.nth(1).click();
    await expect(radios.nth(1)).toHaveAttribute('data-state', 'checked');
  });
});
