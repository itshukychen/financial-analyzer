import { test, expect } from '@playwright/test';

test.describe('Options Overlay Feature', () => {
  const MOCK_OVERLAY_RESPONSE = {
    ticker: 'SPX',
    strike: 3000,
    expiry: '2026-06-17',
    optionType: 'call',
    range: '1M',
    points: [
      {
        time: '2026-02-09T16:00:00Z',
        underlyingPrice: 5850.25,
        optionPrice: 220.50,
      },
      {
        time: '2026-02-10T16:00:00Z',
        underlyingPrice: 5865.00,
        optionPrice: 228.75,
      },
      {
        time: '2026-02-11T16:00:00Z',
        underlyingPrice: 5880.50,
        optionPrice: 235.10,
      },
      {
        time: '2026-02-12T16:00:00Z',
        underlyingPrice: 5895.25,
        optionPrice: 241.30,
      },
      {
        time: '2026-03-09T16:00:00Z',
        underlyingPrice: 5925.50,
        optionPrice: 242.10,
      },
    ],
    current: {
      underlying: 5925.50,
      option: 242.10,
    },
    metadata: {
      dataAvailability: 'full',
    },
  };

  test.beforeEach(async ({ page }) => {
    // Mock the chart API
    await page.route('**/api/market/chart/**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          symbol: 'SPX',
          name: 'S&P 500',
          current: 5925.50,
          changePct: 2.15,
          points: [
            { time: '2026-02-09', value: 5850.25 },
            { time: '2026-02-10', value: 5865.00 },
            { time: '2026-02-11', value: 5880.50 },
            { time: '2026-02-12', value: 5895.25 },
            { time: '2026-03-09', value: 5925.50 },
          ],
        }),
      });
    });

    // Mock the options overlay API
    await page.route('**/api/market/options-overlay**', (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_OVERLAY_RESPONSE),
      });
    });
  });

  test('overlay selector button is visible on chart modal', async ({ page }) => {
    await page.goto('/');

    // Wait for chart to load and click to open modal
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });

    // Click on a chart to open modal
    await page.locator('text=S&P 500').first().click();

    // Overlay button should be visible
    await expect(page.locator('button:has-text("+ Add Overlay")')).toBeVisible();
  });

  test('opening overlay selector panel works', async ({ page }) => {
    await page.goto('/');

    // Wait for chart and open modal
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();

    // Click "Add Overlay" button
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Panel should be visible
    await expect(page.locator('text=Option Overlay (SPX)')).toBeVisible();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('input[type="date"]')).toBeVisible();
    await expect(page.locator('select')).toBeVisible();
  });

  test('overlay selector has correct default values', async ({ page }) => {
    await page.goto('/');

    // Open modal
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();

    // Open selector
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Check default values
    const strikeInput = page.locator('input[type="number"]');
    const expiryInput = page.locator('input[type="date"]');
    const typeSelect = page.locator('select');

    await expect(strikeInput).toHaveValue('3000');
    await expect(expiryInput).toHaveValue('2026-06-17');
    await expect(typeSelect).toHaveValue('call');
  });

  test('can change overlay parameters', async ({ page }) => {
    await page.goto('/');

    // Open modal and selector
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Change parameters
    const strikeInput = page.locator('input[type="number"]');
    const typeSelect = page.locator('select');

    await strikeInput.clear();
    await strikeInput.fill('2900');
    await typeSelect.selectOption('put');

    // Verify changes
    await expect(strikeInput).toHaveValue('2900');
    await expect(typeSelect).toHaveValue('put');
  });

  test('apply button loads overlay data', async ({ page }) => {
    await page.goto('/');

    // Open modal and selector
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Wait for and click Apply button
    const applyButton = page.locator('button:has-text("Apply")');
    await applyButton.click();

    // Overlay API should be called
    const apiCall = await page.waitForResponse((response) =>
      response.url().includes('/api/market/options-overlay')
    );
    expect(apiCall.status()).toBe(200);

    // Panel should close after successful apply
    await expect(page.locator('text=Option Overlay (SPX)')).not.toBeVisible({
      timeout: 5000,
    });
  });

  test('clear button removes overlay', async ({ page }) => {
    await page.goto('/');

    // Open modal and selector
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Click Clear button
    const clearButton = page.locator('button:has-text("Clear")');
    await clearButton.click();

    // Panel should close
    await expect(page.locator('text=Option Overlay (SPX)')).not.toBeVisible({
      timeout: 5000,
    });

    // Button text should revert to "+ Add Overlay"
    await expect(page.locator('button:has-text("+ Add Overlay")')).toBeVisible();
  });

  test('error is shown when API fails', async ({ page }) => {
    // Mock failed API call
    await page.route('**/api/market/options-overlay**', (route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'No option price data available',
        }),
      });
    });

    await page.goto('/');

    // Open modal and selector
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Click Apply
    await page.locator('button:has-text("Apply")').click();

    // Error should be displayed
    await expect(page.locator('text=/No option price data available/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('validation error for invalid parameters', async ({ page }) => {
    // Mock validation error
    await page.route('**/api/market/options-overlay**', (route) => {
      const url = new URL(route.request().url());
      const strike = url.searchParams.get('strike');

      if (strike === '-100') {
        route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Invalid strike price' }),
        });
      } else {
        route.fulfill({ status: 200, body: JSON.stringify(MOCK_OVERLAY_RESPONSE) });
      }
    });

    await page.goto('/');

    // Open modal and selector
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Enter invalid strike
    const strikeInput = page.locator('input[type="number"]');
    await strikeInput.clear();
    await strikeInput.fill('-100');

    // Click Apply
    await page.locator('button:has-text("Apply")').click();

    // Error should be displayed
    await expect(page.locator('text=/Invalid strike price/i')).toBeVisible({
      timeout: 5000,
    });
  });

  test('mobile viewport - overlay selector is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/');

    // Open modal
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();

    // Overlay button should be visible on mobile
    await expect(page.locator('button:has-text("+ Add Overlay")')).toBeVisible();

    // Open selector
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Panel should be accessible on mobile
    await expect(page.locator('input[type="number"]')).toBeVisible();
  });

  test('supports both call and put options', async ({ page }) => {
    await page.goto('/');

    // Open modal and selector
    await expect(page.locator('[data-testid^="ticker-tile-"]').first()).toBeVisible({
      timeout: 10000,
    });
    await page.locator('text=S&P 500').first().click();
    await page.locator('button:has-text("+ Add Overlay")').click();

    // Select put option
    const typeSelect = page.locator('select');
    await typeSelect.selectOption('put');

    // Apply
    await page.locator('button:has-text("Apply")').click();

    // API call should include optionType=put
    const apiCall = await page.waitForResponse((response) =>
      response.url().includes('/api/market/options-overlay')
    );
    expect(apiCall.url()).toContain('optionType=put');
  });
});
