import { test, expect } from '@playwright/test';
import { mockChartAPI, MOCK_CHART_RESPONSES } from './helpers/mockData';

test.describe('Market Charts Widget', () => {
  test('all 5 chart containers are rendered', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    // Wait for charts to load (skeleton → real data)
    await expect(page.getByText('5,800.00')).toBeVisible({ timeout: 10_000 });
    const containers = page.locator('[data-testid="chart-container"]');
    await expect(containers).toHaveCount(5);
  });

  test('chart values are shown after data loads (not stuck in skeleton)', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    // All 5 chart cards should resolve to their mocked values
    await expect(page.getByText('5,800.00')).toBeVisible();  // SPX
    await expect(page.getByText('14.00')).toBeVisible();      // VIX
    await expect(page.getByText('107.00')).toBeVisible();     // DXY
    await expect(page.getByText('4.50%')).toBeVisible();      // 10Y
    await expect(page.getByText('4.10%')).toBeVisible();      // 2Y
  });

  test('error state shown when a single API call fails', async ({ page }) => {
    // Register catch-all FIRST (Playwright is LIFO — last registered runs first)
    // so the specific SPX 500 handler below will take priority for ^GSPC
    await page.route('**/api/market/chart/**', (route) => {
      const url = route.request().url();
      const ticker = url.split('/api/market/chart/')[1];
      const data = MOCK_CHART_RESPONSES[ticker as keyof typeof MOCK_CHART_RESPONSES];
      if (data) {
        route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
      } else {
        route.continue();
      }
    });
    // Register SPX error SECOND — this runs first for ^GSPC requests
    await page.route('**/api/market/chart/%5EGSPC', (route) =>
      route.fulfill({ status: 500, body: JSON.stringify({ error: 'upstream timeout' }) })
    );
    await page.goto('/');
    // Other charts should still render
    await expect(page.getByText('14.00')).toBeVisible();
    // SPX card should show an error (not a value)
    await expect(page.getByText('5,800.00')).not.toBeVisible();
  });

  test('charts render correctly at desktop viewport (1280x800)', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.getByText('S&P 500').first()).toBeVisible();
    // All 5 labels visible in a row
    for (const label of ['S&P 500', 'VIX', 'DX-Y', '10Y Yield', '2Y Yield']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('charts render correctly at tablet viewport (768x1024)', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await mockChartAPI(page);
    await page.goto('/');
    // Labels should still all be visible (stacked on narrower screens)
    for (const label of ['S&P 500', 'VIX', 'DX-Y', '10Y Yield', '2Y Yield']) {
      await expect(page.getByText(label).first()).toBeVisible();
    }
  });

  test('SPX card shows correct label and mocked current value', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.getByText('S&P 500').first()).toBeVisible();
    await expect(page.getByText('5,800.00')).toBeVisible();
    await expect(page.getByText('+3.57%').first()).toBeVisible();
  });

  test('VIX card shows negative delta', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.getByText('VIX').first()).toBeVisible();
    await expect(page.getByText('-30.00%')).toBeVisible();
  });
});
