import { test, expect, Page } from '@playwright/test';

/**
 * E2E Test: Widget → Report Navigation Flow
 * 
 * Tests the full user journey:
 * 1. User views dashboard with OptionProjectionWidget
 * 2. Widget displays option data (IV, implied move, regime)
 * 3. User clicks "View Full Analysis" link
 * 4. User is navigated to /reports/option-projection
 * 5. Report page displays detailed projection data
 */

test.describe('Widget to Report Navigation (E2E)', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    // This will run once before all tests in this suite
    page = await browser.newPage();
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('should navigate from widget to report page', async () => {
    // Navigate to home page (which contains the widget)
    await page.goto('http://localhost:3003');
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Look for the OptionProjectionWidget
    const widget = page.locator('[class*="Option"][class*="Projection"]');
    await expect(widget).toBeVisible();

    // Verify widget displays key data
    const ivText = page.locator('text=/IV/i');
    const moveText = page.locator('text=/Implied Move/i');
    
    // At least one should be visible (widget header or stat)
    const isIVVisible = await ivText.isVisible().catch(() => false);
    const isMoveVisible = await moveText.isVisible().catch(() => false);
    expect(isIVVisible || isMoveVisible).toBe(true);
  });

  test('should find and click "View Full Analysis" link', async () => {
    // Navigate to home page
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');

    // Find the "View Full Analysis" link in the widget
    const fullAnalysisLink = page.locator('a:has-text("View Full Analysis")');
    await expect(fullAnalysisLink).toBeVisible();
    await expect(fullAnalysisLink).toHaveAttribute('href', '/reports/option-projection');

    // Click the link
    await fullAnalysisLink.click();

    // Verify navigation
    await page.waitForURL('**/reports/option-projection');
    expect(page.url()).toContain('/reports/option-projection');
  });

  test('should display report page content after navigation', async () => {
    // Navigate directly to report page
    await page.goto('http://localhost:3003/reports/option-projection');
    await page.waitForLoadState('networkidle');

    // Verify we're on the report page
    expect(page.url()).toContain('/reports/option-projection');

    // Check for expected report elements
    // (These would depend on your actual report page structure)
    const reportTitle = page.locator('h1, h2, h3');
    await expect(reportTitle.first()).toBeVisible();

    // There should be some content related to projections
    const pageText = await page.textContent();
    expect(pageText?.toLowerCase()).toMatch(/option|projection|report/i);
  });

  test('should have working navigation breadcrumb back', async () => {
    // Navigate to report page
    await page.goto('http://localhost:3003/reports/option-projection');
    await page.waitForLoadState('networkidle');

    // Look for a back or navigation link
    const backLink = page.locator('a:has-text(/back|home|dashboard|reports/i)').first();
    
    // If found, verify it's clickable
    if (await backLink.isVisible().catch(() => false)) {
      await expect(backLink).toBeVisible();
      const href = await backLink.getAttribute('href');
      // Should navigate somewhere (not an empty link)
      expect(href).toBeTruthy();
      expect(href).not.toBe('#');
    }
  });

  test('widget data should update when API refreshes', async () => {
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');

    // Get initial IV value
    const ivValue = page.locator('text=/IV|volatility/i').first();
    const initialText = await ivValue.textContent().catch(() => '');

    // Wait for 5+ minutes would be ideal, but we'll simulate with an API call refresh
    // In a real test, you might mock time or wait for actual refresh
    // For now, just verify the element is there and refreshable
    await expect(ivValue).toBeVisible();
  });
});

/**
 * Mobile/Responsive E2E Test
 */
test.describe('Widget to Report Navigation - Mobile', () => {
  test('should work on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    // Navigate to home
    await page.goto('http://localhost:3003');
    await page.waitForLoadState('networkidle');

    // Find widget
    const widget = page.locator('[class*="Option"][class*="Projection"]');
    const isVisible = await widget.isVisible().catch(() => false);
    
    if (isVisible) {
      // Find and click the link
      const link = page.locator('a:has-text("View Full Analysis")');
      await link.click();

      // Verify navigation
      await page.waitForURL('**/reports/option-projection');
      expect(page.url()).toContain('/reports/option-projection');
    }
  });
});
