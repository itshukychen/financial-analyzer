import { test, expect } from '@playwright/test';

const ALL_PAGES = ['/', '/markets', '/reports', '/watchlist', '/alerts'];

test.describe('Accessibility', () => {
  test('each page has exactly one h1', async ({ page }) => {
    for (const path of ALL_PAGES) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      const h1s = page.locator('h1');
      await expect(h1s).toHaveCount(1, { timeout: 10_000 });
    }
  });

  test('all nav links are keyboard focusable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const nav = page.locator('nav');
    await expect(nav).toBeVisible({ timeout: 10_000 });
    const links = nav.locator('a');
    const count = await links.count();
    expect(count).toBe(5);
    for (let i = 0; i < count; i++) {
      await expect(links.nth(i)).toBeVisible({ timeout: 5_000 });
      // Confirm it's a real anchor with an href
      const href = await links.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
    }
  });

  test('sidebar nav links can be tabbed through in order', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Wait for nav to be visible
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).toBeVisible({ timeout: 10_000 });
    
    // Focus the first nav link and tab through all 5
    await dashboardLink.focus();
    
    const expectedOrder = ['Dashboard', 'Markets', 'Reports', 'Watchlist', 'Alerts'];
    for (const name of expectedOrder) {
      // Add a small delay to let focus settle
      await page.waitForTimeout(100);
      const focused = page.locator(':focus');
      const focusedText = await focused.textContent();
      expect(focusedText).toMatch(new RegExp(name, 'i'));
      await page.keyboard.press('Tab');
    }
  });

  test('no broken/empty href attributes on nav links', async ({ page }) => {
    await page.goto('/');
    const links = page.locator('nav a');
    const count = await links.count();
    for (let i = 0; i < count; i++) {
      const href = await links.nth(i).getAttribute('href');
      expect(href).toBeTruthy();
      expect(href).not.toBe('#');
    }
  });

  test('page has a landmark nav element', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('nav')).toBeVisible();
  });
});
