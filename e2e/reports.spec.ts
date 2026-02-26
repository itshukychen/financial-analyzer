/**
 * E2E tests for /reports page.
 *
 * The page reads directly from SQLite (server component), so Playwright
 * route mocks don't affect it. Instead we rely on global-setup.ts, which
 * seeds a fixture report into data/reports.db before the webServer starts.
 *
 * Fixture data (see playwright/global-setup.ts):
 *   date:     2026-02-26
 *   regime:   "Risk-on melt-up"
 *   headline: "Risk-on melt-up: SPX surges as VIX collapses..."
 */
import { test, expect } from '@playwright/test';

test.describe('/reports page', () => {
  test('page loads with correct h1 heading', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Report');
  });

  test('shows headline when report is available', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText('Risk-on melt-up').first()).toBeVisible(); // regime badge
  });

  test('shows the date chip when report is available', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/February.*2026/i)).toBeVisible();
  });

  test('shows all 7 section titles when report is available', async ({ page }) => {
    await page.goto('/reports');
    for (const title of ['Yield Curve Diagnosis', 'Dollar Logic', 'Equity Move Diagnosis', 'Volatility Interpretation', 'Cross-Asset Consistency', 'Forward Scenarios', 'Short Vol / 1DTE Risk']) {
      await expect(page.getByText(title).first()).toBeVisible();
    }
  });

  test('shows regime justification when report is available', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.getByText(/positioning-driven equity rally/i)).toBeVisible();
  });
});
