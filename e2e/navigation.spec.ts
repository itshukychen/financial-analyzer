import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('all 5 nav links are present on the sidebar', async ({ page }) => {
    await page.goto('/');
    for (const label of ['Dashboard', 'Markets', 'Reports', 'Watchlist', 'Alerts']) {
      await expect(page.getByRole('link', { name: label })).toBeVisible();
    }
  });

  test('navigating to /markets shows Markets page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Markets' }).click();
    await expect(page).toHaveURL('/markets');
    await expect(page.locator('h1')).toContainText('Markets');
  });

  test('navigating to /reports shows Reports page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Reports' }).click();
    await expect(page).toHaveURL('/reports');
    await expect(page.locator('h1')).toContainText('Reports');
  });

  test('navigating to /watchlist shows Watchlist page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Watchlist' }).click();
    await expect(page).toHaveURL('/watchlist');
    await expect(page.locator('h1')).toContainText('Watchlist');
  });

  test('navigating to /alerts shows Alerts page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Alerts' }).click();
    await expect(page).toHaveURL('/alerts');
    await expect(page.locator('h1')).toContainText('Alerts');
  });

  test('Dashboard link navigates back to home from /markets', async ({ page }) => {
    await page.goto('/markets');
    await page.getByRole('link', { name: 'Dashboard' }).click();
    await expect(page).toHaveURL('/');
    await expect(page.locator('h1')).toContainText('Dashboard');
  });

  test('active nav link has active-nav-link class on /', async ({ page }) => {
    await page.goto('/');
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    await expect(dashboardLink).toHaveClass(/active-nav-link/);
  });

  test('active nav link has active-nav-link class on /markets', async ({ page }) => {
    await page.goto('/markets');
    const marketsLink = page.getByRole('link', { name: 'Markets' });
    await expect(marketsLink).toHaveClass(/active-nav-link/);
    const dashboardLink = page.getByRole('link', { name: 'Dashboard' });
    // Use exact string — regex would false-positive on "inactive-nav-link"
    await expect(dashboardLink).not.toHaveClass('active-nav-link');
  });

  test('stub pages show Coming soon placeholder', async ({ page }) => {
    for (const path of ['/markets', '/reports', '/watchlist', '/alerts']) {
      await page.goto(path);
      await expect(page.getByText('Coming soon').first()).toBeVisible();
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
