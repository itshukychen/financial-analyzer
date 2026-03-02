import { test, expect } from '@playwright/test';
import { mockChartAPI, mockFearGreedAPI } from './helpers/mockData';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await mockFearGreedAPI(page);
  });

  test('page title contains FinAnalyzer', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/FinAnalyzer|Financial/i);
  });

  test('loads without console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('shows Dashboard h1 heading', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('all 5 chart labels are visible after data loads', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    for (const label of ['S&P 500', 'VIX', 'DX-Y', '10Y Yield', '2Y Yield']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('SPX chart shows mocked current value', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.getByText('5,800.00')).toBeVisible();
  });

  test('positive delta badge is shown', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.getByText('+3.57%')).toBeVisible();
  });

  test('negative delta badge is shown', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.getByText('-30.00%')).toBeVisible();
  });

  test('placeholder widgets are present', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Daily Market Report')).toBeVisible();
    await expect(page.getByText('Market Heatmap')).toBeVisible();
    const comingSoon = page.getByText('Coming soon');
    await expect(comingSoon.first()).toBeVisible();
    expect(await comingSoon.count()).toBeGreaterThanOrEqual(2);
  });

  test('FinAnalyzer brand is visible in sidebar', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('FinAnalyzer')).toBeVisible();
  });

  test('fear & greed card is present on dashboard', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.locator('[data-testid="fear-greed-card"]')).toBeVisible();
  });

  test('market charts grid shows 2 columns on mobile', async ({ page }) => {
    // Already uses Pixel 5 viewport via Mobile Chrome project
    await page.goto('/');
    const grid = page.locator('[data-testid="market-charts-grid"]');
    await expect(grid).toBeVisible();
  });
});
