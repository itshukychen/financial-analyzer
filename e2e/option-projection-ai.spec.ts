// e2e/option-projection-ai.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Option Projection Report - AI Forecast', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the option projection report
    await page.goto('/reports/option-projection?ticker=SPWX');
  });

  test('displays AI forecast section on report page', async ({ page }) => {
    // Wait for AI section to load
    const aiSection = page.locator('[data-testid="ai-forecast-section"]');
    await expect(aiSection).toBeVisible({ timeout: 10000 });
  });

  test('displays price targets with confidence bar', async ({ page }) => {
    // Check for price targets
    const conservativeTarget = page.locator('[data-testid="price-target-conservative"]');
    const baseTarget = page.locator('[data-testid="price-target-base"]');
    const aggressiveTarget = page.locator('[data-testid="price-target-aggressive"]');

    await expect(conservativeTarget).toContainText('$');
    await expect(baseTarget).toContainText('$');
    await expect(aggressiveTarget).toContainText('$');
  });

  test('displays regime badge', async ({ page }) => {
    const regimeBadge = page.locator('[data-testid="regime-badge"]');

    await expect(regimeBadge).toBeVisible();
    await expect(regimeBadge).toHaveAttribute('data-regime', /elevated|normal|depressed/);
  });

  test('displays confidence score', async ({ page }) => {
    const confidenceBadge = page.locator('[data-testid="confidence-badge"]');

    await expect(confidenceBadge).toBeVisible();
    await expect(confidenceBadge).toContainText('%');
  });

  test('displays regime change alert when detected', async ({ page }) => {
    // This test assumes regime change data is seeded
    const alert = page.locator('[data-testid="regime-change-alert"]');

    // Alert may or may not be present depending on test data
    if (await alert.isVisible()) {
      await expect(alert).toContainText('Volatility Regime Change');
    }
  });

  test('can dismiss regime change alert', async ({ page }) => {
    const alert = page.locator('[data-testid="regime-change-alert"]');

    // Only test if alert is visible
    if (await alert.isVisible()) {
      const dismissBtn = alert.locator('button');
      await dismissBtn.click();

      // Alert should no longer be visible
      await expect(alert).not.toBeVisible();
    }
  });

  test('displays all required sections', async ({ page }) => {
    const container = page.locator('[data-testid="ai-forecast-section"]');

    // Check for key sections by looking for headings
    await expect(container).toContainText('AI-Powered Forecast');
    await expect(container).toContainText('Price Targets');
    await expect(container).toContainText('Volatility Regime');
    await expect(container).toContainText('Key Trading Levels');
  });

  test('displays trading levels section', async ({ page }) => {
    const container = page.locator('[data-testid="ai-forecast-section"]');

    // Check for trading level content
    const pageText = await container.textContent();
    expect(pageText).toContain('Support');
    expect(pageText).toContain('Resistance');
    expect(pageText).toContain('Stop Loss');
    expect(pageText).toContain('Profit Targets');
  });
});
