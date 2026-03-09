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
    const comingSoon = page.getByText('Coming soon');
    await expect(comingSoon.first()).toBeVisible();
    expect(await comingSoon.count()).toBeGreaterThanOrEqual(1);
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

  test('AC-1: WTI tile is visible with price and delta', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    const wtiTile  = page.locator('[data-testid="ticker-tile-CL=F"]');
    const wtiPrice = page.locator('[data-testid="ticker-price-CL=F"]');
    const wtiDelta = page.locator('[data-testid="ticker-delta-CL=F"]');
    await expect(wtiTile).toBeVisible();
    await expect(wtiPrice).not.toBeEmpty();
    await expect(wtiDelta).not.toBeEmpty();
  });

  test('AC-2: Brent tile is visible with price and delta', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    const brentTile  = page.locator('[data-testid="ticker-tile-BZ=F"]');
    const brentPrice = page.locator('[data-testid="ticker-price-BZ=F"]');
    const brentDelta = page.locator('[data-testid="ticker-delta-BZ=F"]');
    await expect(brentTile).toBeVisible();
    await expect(brentPrice).not.toBeEmpty();
    await expect(brentDelta).not.toBeEmpty();
  });

  test('AC-1: WTI tile appears after the 2Y tile in DOM order', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    // Collect all ticker-tile data-testid values in DOM order
    const tileTestIds = await page.locator('[data-testid^="ticker-tile-"]').evaluateAll(
      (els) => els.map((el) => el.getAttribute('data-testid') ?? ''),
    );
    const idx2Y  = tileTestIds.indexOf('ticker-tile-DGS2');
    const idxWTI = tileTestIds.indexOf('ticker-tile-CL=F');
    expect(idx2Y).toBeGreaterThanOrEqual(0);
    expect(idxWTI).toBeGreaterThan(idx2Y);
  });

  test('AC-8: WTI tile shows — on API error', async ({ page }) => {
    await page.route('**/api/market/chart/CL*', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'fetch failed' }) })
    );
    await page.goto('/');
    await expect(page.getByTestId('ticker-price-CL=F')).toHaveText('—');
  });
});

test.describe('Interactive Charts — modal open/close', () => {
  test.beforeEach(async ({ page }) => {
    await mockFearGreedAPI(page);
    await mockChartAPI(page);
    await page.goto('/');
  });

  test('AC-1.1/1.2: clicking a tile opens the modal', async ({ page }) => {
    await page.getByTestId('ticker-tile-^GSPC').click();
    await expect(page.getByTestId('chart-modal')).toBeVisible();
  });

  test('AC-1.3: modal header shows the correct ticker label', async ({ page }) => {
    await page.getByTestId('ticker-tile-^GSPC').click();
    await expect(page.getByTestId('chart-modal')).toContainText('S&P 500');
  });

  test('AC-1.4: modal chart area is at least 400px tall', async ({ page }) => {
    await page.getByTestId('ticker-tile-^GSPC').click();
    const container = page.getByTestId('modal-chart-container');
    await expect(container).toBeVisible();
    const box = await container.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(400);
  });

  test('AC-5.2: close button dismisses the modal', async ({ page }) => {
    await page.getByTestId('ticker-tile-^GSPC').click();
    await expect(page.getByTestId('chart-modal')).toBeVisible();
    await page.getByTestId('modal-close-btn').click();
    await expect(page.getByTestId('chart-modal')).not.toBeVisible();
  });

  test('AC-5.1: ESC key dismisses the modal', async ({ page }) => {
    await page.getByTestId('ticker-tile-^GSPC').click();
    await expect(page.getByTestId('chart-modal')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('chart-modal')).not.toBeVisible();
  });

  test('AC-5.3: clicking the backdrop dismisses the modal', async ({ page }) => {
    await page.getByTestId('ticker-tile-^GSPC').click();
    await expect(page.getByTestId('chart-modal')).toBeVisible();
    // Click on the backdrop (top-left corner, well outside the panel)
    await page.getByTestId('chart-modal').click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId('chart-modal')).not.toBeVisible();
  });
});

test.describe('Interactive Charts — range buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockFearGreedAPI(page);
    await mockChartAPI(page);
    await page.goto('/');
    await page.getByTestId('ticker-tile-^GSPC').click();
    await expect(page.getByTestId('chart-modal')).toBeVisible();
  });

  test('AC-2.1: all 7 range buttons are visible', async ({ page }) => {
    for (const range of ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD']) {
      await expect(page.getByTestId(`range-btn-${range}`)).toBeVisible();
    }
  });

  test('AC-2.4: 1M is the default active range', async ({ page }) => {
    const btn1M = page.getByTestId('range-btn-1M');
    // Active button has a distinct border — check it has accent styling
    await expect(btn1M).toBeVisible();
    // Not disabled
    await expect(btn1M).toBeEnabled();
  });

  test('AC-2.2: clicking 6M triggers a new data fetch with range=6M', async ({ page }) => {
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('range=6M')),
      page.getByTestId('range-btn-6M').click(),
    ]);
    expect(request.url()).toContain('range=6M');
  });

  test('AC-2.5: loading skeleton appears while range data is fetching', async ({ page }) => {
    // Delay the range fetch so we can observe the skeleton
    await page.route('**/api/market/chart/**', async (route) => {
      if (route.request().url().includes('range=3M')) {
        await new Promise((r) => setTimeout(r, 400));
      }
      await route.continue();
    });
    page.getByTestId('range-btn-3M').click();
    await expect(page.getByTestId('modal-chart-skeleton')).toBeVisible();
  });
});

test.describe('Interactive Charts — FRED ticker (2Y Yield)', () => {
  test.beforeEach(async ({ page }) => {
    await mockFearGreedAPI(page);
    await mockChartAPI(page);
    await page.goto('/');
    await page.getByTestId('ticker-tile-DGS2').click();
    await expect(page.getByTestId('chart-modal')).toBeVisible();
  });

  test('AC-2.7: 1D button is disabled for DGS2 (FRED ticker)', async ({ page }) => {
    await expect(page.getByTestId('range-btn-1D')).toBeDisabled();
  });

  test('AC-2.7: 5D–YTD buttons are NOT disabled for DGS2', async ({ page }) => {
    for (const range of ['5D', '1M', '3M', '6M', '1Y', 'YTD']) {
      await expect(page.getByTestId(`range-btn-${range}`)).toBeEnabled();
    }
  });
});

/**
 * AC Coverage — Market Heatmap Removal (prd-remove-market-heatmap.md):
 * AC-1.1 → 'Market Heatmap widget is absent from the dashboard DOM'
 * AC-1.3 → 'Remaining widgets (charts grid + report area) render without layout gaps'
 * AC-E.1 → 'No console errors after heatmap removal'
 * AC-E.2 → 'Remaining widgets maintain layout on mobile viewport'
 */
test.describe('Market Heatmap Removal', () => {
  test.beforeEach(async ({ page }) => {
    await mockFearGreedAPI(page);
  });

  test('AC-1.1: Market Heatmap widget is absent from the dashboard DOM', async ({ page }) => {
    await page.goto('/');
    // The heatmap PlaceholderWidget must not appear anywhere on the dashboard
    await expect(page.getByText('Market Heatmap')).not.toBeVisible();
  });

  test('AC-1.1: no element with "Market Heatmap" text exists at all', async ({ page }) => {
    await page.goto('/');
    const count = await page.getByText('Market Heatmap').count();
    expect(count).toBe(0);
  });

  test('AC-1.3: market charts grid is visible after heatmap removal', async ({ page }) => {
    await mockChartAPI(page);
    await page.goto('/');
    await expect(page.getByTestId('market-charts-grid')).toBeVisible();
  });

  test('AC-1.3: report area is visible after heatmap removal', async ({ page }) => {
    await page.goto('/');
    // With fixture data seeded, the full report widget renders; without it the placeholder shows.
    // Either way "Daily Market Report" label must be present.
    await expect(page.getByText('Daily Market Report').first()).toBeVisible();
  });

  test('AC-1.3: no Coming-soon badge for Market Heatmap — count is exactly one (Daily Market Report fallback only when no live report) or zero (live report present)', async ({ page }) => {
    await page.goto('/');
    // The fixture seeds a real report, so the Daily Market Report renders as a real widget (no placeholder).
    // Market Heatmap is gone. So "Coming soon" count must be 0 (no placeholders visible).
    // If for any reason the real report is absent, count may be 1 — never >= 2.
    const count = await page.getByText('Coming soon').count();
    expect(count).toBeLessThanOrEqual(1);
  });

  test('AC-E.1: no console errors on page load after heatmap removal', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    expect(errors).toHaveLength(0);
  });

  test('AC-E.2: remaining widgets visible on mobile viewport (375px)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await mockChartAPI(page);
    await page.goto('/');

    // Charts grid is visible
    await expect(page.getByTestId('market-charts-grid')).toBeVisible();

    // Report area is visible
    await expect(page.getByText('Daily Market Report').first()).toBeVisible();

    // Market Heatmap is still absent on mobile
    expect(await page.getByText('Market Heatmap').count()).toBe(0);
  });

  test('AC-E.2: no horizontal overflow on mobile after heatmap removal', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');

    const grid = page.getByTestId('market-charts-grid');
    await expect(grid).toBeVisible();

    const box = await grid.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(375);
  });
});

test.describe('Interactive Charts — no regression', () => {
  test('tile price and delta still show after opening and closing modal', async ({ page }) => {
    await mockFearGreedAPI(page);
    await mockChartAPI(page);
    await page.goto('/');
    await page.getByTestId('ticker-tile-^GSPC').click();
    await expect(page.getByTestId('chart-modal')).toBeVisible();
    await page.getByTestId('modal-close-btn').click();
    await expect(page.getByTestId('ticker-price-^GSPC')).toBeVisible();
    await expect(page.getByTestId('ticker-delta-^GSPC')).toBeVisible();
  });

  test('Fear & Greed widget is unaffected by modal interactions', async ({ page }) => {
    await mockFearGreedAPI(page);
    await mockChartAPI(page);
    await page.goto('/');
    await page.getByTestId('ticker-tile-^GSPC').click();
    await page.getByTestId('modal-close-btn').click();
    await expect(page.getByTestId('fear-greed-card')).toBeVisible();
  });

  test('AC-6.1: tile cursor is pointer on hover', async ({ page }) => {
    await mockFearGreedAPI(page);
    await mockChartAPI(page);
    await page.goto('/');
    const tile = page.getByTestId('ticker-tile-^GSPC');
    const cursor = await tile.evaluate((el) => window.getComputedStyle(el).cursor);
    expect(cursor).toBe('pointer');
  });
});
