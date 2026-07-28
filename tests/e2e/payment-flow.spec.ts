import { test, expect } from '@playwright/test';

test.describe('Payment flow smoke', () => {
  test('payments page loads and shows table', async ({ page }) => {
    await page.goto('/payments');
    await expect(page.locator('h1')).toContainText('Payments');
    await expect(page.locator('table')).toBeVisible();
  });

  test('payment filters update URL', async ({ page }) => {
    await page.goto('/payments');
    const statusSelect = page.getByLabel('Filter by status');
    await statusSelect.selectOption('CONFIRMED');
    await expect(page).toHaveURL(/status=CONFIRMED/);
  });

  test('payment pagination works', async ({ page }) => {
    await page.goto('/payments');
    const nextButton = page.getByRole('link', { name: /next/i });
    if (await nextButton.isVisible()) {
      await nextButton.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });
});
