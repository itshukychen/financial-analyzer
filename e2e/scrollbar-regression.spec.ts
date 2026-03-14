import { test, expect } from '@playwright/test';

test.describe('No Double Scrollbars', () => {
  test('Dashboard: html and body should have overflow hidden', async ({ page }) => {
    await page.goto('/');

    const htmlOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow
    );
    expect(htmlOverflow).toBe('hidden');

    const bodyOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.body).overflow
    );
    expect(bodyOverflow).toBe('hidden');
  });

  test('Dashboard: main element should have overflow-y auto', async ({ page }) => {
    await page.goto('/');

    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });

  test('Dashboard: main element should have overflow-x hidden', async ({ page }) => {
    await page.goto('/');

    const mainOverflowX = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowX : null;
    });
    expect(mainOverflowX).toBe('hidden');
  });

  test('Reports: should show single scrollbar', async ({ page }) => {
    await page.goto('/reports');

    const htmlOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow
    );
    expect(htmlOverflow).toBe('hidden');

    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });

  test('Reports: content should scroll within main element', async ({ page }) => {
    await page.goto('/reports');

    // Scroll main element
    await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main) main.scrollTop = 100;
    });

    // Verify scroll position
    const scrollTop = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main?.scrollTop || 0;
    });
    expect(scrollTop).toBeGreaterThan(0);
  });

  test('Watchlist: should have single scrollbar', async ({ page }) => {
    await page.goto('/watchlist');

    const htmlOverflow = await page.evaluate(() =>
      window.getComputedStyle(document.documentElement).overflow
    );
    expect(htmlOverflow).toBe('hidden');

    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });

  test('Sidebar toggle should not affect scrollbar', async ({ page }) => {
    await page.goto('/');

    // Find and click sidebar toggle (if visible)
    const toggleButton = page.locator('button').filter({ hasText: /menu|toggle/i }).first();
    const isVisible = await toggleButton.isVisible().catch(() => false);

    if (isVisible) {
      await toggleButton.click();
      await page.waitForTimeout(300); // Wait for animation
    }

    // Verify main overflow unchanged
    const mainOverflow = await page.evaluate(() => {
      const main = document.querySelector('main');
      return main ? window.getComputedStyle(main).overflowY : null;
    });
    expect(mainOverflow).toBe('auto');
  });
});
