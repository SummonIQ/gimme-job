import { expect, test } from '@playwright/test';

test('knowledge settings page supports add/edit/delete', async ({ page }) => {
  await page.goto('/settings/knowledge');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Knowledge Memory' })).toBeVisible();

  const key = `playwright_knowledge_${Date.now()}`;
  const initialValue = 'TypeScript, React, Next.js';
  const updatedValue = 'TypeScript, React, Next.js, Prisma';

  await page.getByPlaceholder('key (e.g. workAuthorization)').fill(key);
  await page.getByPlaceholder('value').fill(initialValue);
  await page.getByRole('button', { name: 'Add' }).click();

  const row = page.locator('div.rounded-lg.border').filter({ hasText: key }).first();
  await expect(row).toBeVisible();
  await page.screenshot({ path: '/tmp/knowledge-settings-added.png', fullPage: true });

  const rowInput = row.locator('input').first();
  await rowInput.fill(updatedValue);
  await row.getByRole('button', { name: 'Save' }).click();

  await expect(rowInput).toHaveValue(updatedValue);
  await page.screenshot({ path: '/tmp/knowledge-settings-updated.png', fullPage: true });

  await row.getByRole('button', { name: 'Delete' }).click();
  await expect(page.locator('code', { hasText: key })).toHaveCount(0);
  await page.screenshot({ path: '/tmp/knowledge-settings-deleted.png', fullPage: true });
});
