import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  // These tests click sidebar links directly — sidebar is always visible on desktop.
  // Mobile-specific nav (hamburger open/close) is tested in the block below.
  test.beforeEach(async ({ isMobile }, testInfo) => {
    if (isMobile) testInfo.skip();
  });

  test('all 5 nav links are present on the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    for (const label of ['Dashboard', 'Markets', 'Reports', 'Watchlist', 'Alerts']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible({ timeout: 10_000 });
    }
  });

  test('navigating to /markets shows Markets page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Markets' }).click();
    await expect(page).toHaveURL('/markets', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Markets', { timeout: 10_000 });
  });

  test('navigating to /reports shows Reports page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL('/reports', { timeout: 10_000 });
    // h1 is "Daily Market Report" (not the old "Reports" stub heading)
    await expect(page.locator('h1')).toContainText('Report', { timeout: 10_000 });
  });

  test('navigating to /watchlist shows Watchlist page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Watchlist' }).click();
    await expect(page).toHaveURL('/watchlist', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Watchlist', { timeout: 10_000 });
  });

  test('navigating to /alerts shows Alerts page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Alerts' }).click();
    await expect(page).toHaveURL('/alerts', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Alerts', { timeout: 10_000 });
  });

  test('Dashboard link navigates back to home from /markets', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL('/', { timeout: 10_000 });
    await expect(page.locator('h1')).toContainText('Dashboard', { timeout: 10_000 });
  });

  test('active nav link has active-nav-link class on /', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).toHaveClass(/active-nav-link/, { timeout: 10_000 });
  });

  test('active nav link has active-nav-link class on /markets', async ({ page }) => {
    await page.goto('/markets');
    await page.waitForLoadState('networkidle');
    const marketsLink = page.getByRole('link', { name: 'Markets' });
    await expect(marketsLink).toHaveClass(/active-nav-link/, { timeout: 10_000 });
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    // Use exact string — regex would false-positive on "inactive-nav-link"
    await expect(dashboardLink).not.toHaveClass('active-nav-link', { timeout: 10_000 });
  });

  test('stub pages show Coming soon placeholder', async ({ page }) => {
    // /reports is now a real page — only remaining stubs show "Coming soon"
    for (const path of ['/markets', '/watchlist', '/alerts']) {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expect(page.getByText('Coming soon').first()).toBeVisible({ timeout: 10_000 });
    }
  });
});

test.describe('Mobile navigation', () => {
  test.use({ viewport: { width: 390, height: 844 } }); // iPhone 14 Pro

  test('hamburger button is visible on mobile', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('button', { name: /open navigation/i })).toBeVisible();
  });

  test('sidebar is off-screen initially on mobile', async ({ page }) => {
    await page.goto('/');
    const aside = page.locator('aside');
    // Sidebar has -translate-x-full when closed
    await expect(aside).toHaveClass(/-translate-x-full/);
  });

  test('tapping hamburger opens the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation/i }).click();
    const aside = page.locator('aside');
    await expect(aside).toHaveClass(/translate-x-0/);
    await expect(aside).not.toHaveClass(/-translate-x-full/);
  });

  test('close button is visible when sidebar is open', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation/i }).click();
    await expect(page.getByRole('button', { name: /close navigation/i })).toBeVisible();
  });

  test('tapping close button hides the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation/i }).click();
    await page.getByRole('button', { name: /close navigation/i }).click();
    const aside = page.locator('aside');
    await expect(aside).toHaveClass(/-translate-x-full/);
  });

  test('tapping a nav link closes the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation/i }).click();
    await page.getByRole('link', { name: 'Markets' }).click();
    const aside = page.locator('aside');
    await expect(aside).toHaveClass(/-translate-x-full/);
  });

  test('tapping backdrop closes the sidebar', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /open navigation/i }).click();
    // Click the backdrop overlay (the dim area)
    await page.locator('[aria-hidden="true"]').first().click({ position: { x: 300, y: 400 } });
    const aside = page.locator('aside');
    await expect(aside).toHaveClass(/-translate-x-full/);
  });
});
