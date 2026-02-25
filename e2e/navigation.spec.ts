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
    await expect(dashboardLink).not.toHaveClass(/active-nav-link/);
  });

  test('stub pages show Coming soon placeholder', async ({ page }) => {
    for (const path of ['/markets', '/reports', '/watchlist', '/alerts']) {
      await page.goto(path);
      await expect(page.getByText('Coming soon').first()).toBeVisible();
    }
  });
});
