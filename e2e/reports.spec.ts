/**
 * E2E tests for /reports page.
 *
 * The page reads directly from SQLite (server component), so Playwright
 * route mocks don't affect it. Instead we rely on global-setup.ts, which
 * seeds a fixture report into data/reports.db before the webServer starts.
 *
 * Fixture data (see playwright/global-setup.ts):
 *   date:     2026-02-26
 *   headline: "Equities Rally on Cooling Inflation Data"
 */
import { test, expect } from '@playwright/test';

test.describe('/reports page', () => {
  test('page loads with correct h1 heading', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Report');
  });

  test('shows headline when report is available', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText('Equities Rally on Cooling Inflation Data')).toBeVisible();
  });

  test('shows the date chip when report is available', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/February.*2026/i)).toBeVisible();
  });

  test('shows all 6 section titles when report is available', async ({ page }) => {
    await page.goto('/reports');
    for (const title of ['Equities', 'Volatility', 'Fixed Income', 'US Dollar', 'Cross-Asset', 'Outlook']) {
      await expect(page.getByText(title).first()).toBeVisible();
    }
  });

  test('shows executive summary when report is available', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText('Executive Summary')).toBeVisible();
    await expect(page.getByText(/Strong session across risk assets/)).toBeVisible();
  });
});
