import { expect, test } from '@playwright/test';

test.use({ storageState: '.playwright/.auth/user.json' });

test.describe('Main Navigation', () => {
  test('shows primary navigation links and jobs menu items', async ({
    page,
  }) => {
    await page.goto('/jobs', { waitUntil: 'domcontentloaded' });

    const mainNav = page.getByRole('navigation', { name: 'Main navigation' });

    await expect(mainNav.getByRole('link', { name: 'Overview' })).toBeVisible();
    await expect(mainNav.getByRole('button', { name: 'Jobs' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Job Leads' })).toBeVisible();
    await expect(mainNav.getByRole('link', { name: 'Resumes' })).toBeVisible();
    await expect(mainNav.getByRole('button', { name: 'Tools' })).toBeVisible();

    await mainNav.getByRole('button', { name: 'Jobs' }).click();

    await expect(page.getByRole('link', { name: /^Job Search\b/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Saved\b/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Dismissed\b/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Searches\b/ })).toBeVisible();
  });

  test('shows tools menu items and links to people research', async ({
    page,
  }) => {
    await page.goto('/resumes', { waitUntil: 'domcontentloaded' });

    const mainNav = page.getByRole('navigation', { name: 'Main navigation' });
    await mainNav.getByRole('button', { name: 'Tools' }).click();

    await expect(
      page.getByRole('link', { name: 'View All Tools' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Interview Prep' }),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'People Research' }),
    ).toBeVisible();

    await page.getByRole('link', { name: 'People Research' }).click();
    await expect(page).toHaveURL(/\/people-profiles(?:\?.*)?$/);
  });
});
