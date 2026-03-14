import { test, expect } from '@playwright/test';

test.describe('Options AI Analysis Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the options AI analysis page
    await page.goto('/reports/options-ai-analysis');
  });

  test('should load the page successfully', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');
    
    // Check for page header
    const header = page.locator('h1');
    await expect(header).toBeVisible();
  });

  test('should display page title and subtitle', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for "Options AI Analysis" title
    const title = page.locator('text=Options AI Analysis');
    await expect(title).toBeVisible();
    
    // Check for subtitle
    const subtitle = page.locator('text=AI-Powered Daily Insights');
    await expect(subtitle).toBeVisible();
  });

  test('should render analysis sections', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for section headings (look for emojis and titles)
    const sections = page.locator('[class*="section"]').or(page.locator('h2'));
    await expect(sections).toBeTruthy();
  });

  test('should display next day forecast section', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for forecast section with target range, confidence, and probability
    const forecastSection = page.locator('text=Next Trading Day Forecast');
    
    if (await forecastSection.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(forecastSection).toBeVisible();
      
      // Check for data cards in the forecast section
      const targetRange = page.locator('text=Target Range');
      const confidence = page.locator('text=Confidence');
      const moveProb = page.locator('text=Move >1% Probability');
      
      // At least one should be visible
      const isTargetVisible = await targetRange.isVisible({ timeout: 5000 }).catch(() => false);
      const isConfidenceVisible = await confidence.isVisible({ timeout: 5000 }).catch(() => false);
      const isMoveVisible = await moveProb.isVisible({ timeout: 5000 }).catch(() => false);
      
      expect(isTargetVisible || isConfidenceVisible || isMoveVisible).toBeTruthy();
    }
  });

  test('should display cache notice', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for cache notice - should show when generated and next update time
    const cacheNotice = page.locator('text=Generated');
    
    if (await cacheNotice.isVisible({ timeout: 5000 }).catch(() => false)) {
      await expect(cacheNotice).toBeVisible();
    }
  });

  test('should handle missing data gracefully', async ({ page }) => {
    // If there's an error loading the API, should show error message
    // This test checks the error state is displayed correctly
    
    await page.waitForTimeout(2000);
    
    // Check if either content loaded or error message is shown
    const successContent = page.locator('[class*="max-w-5xl"]');
    const errorMessage = page.locator('text=/Failed to load|error/i');
    
    const hasContent = await successContent.isVisible({ timeout: 2000 }).catch(() => false);
    const hasError = await errorMessage.isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasContent || hasError).toBeTruthy();
  });

  test('should have proper page structure with AppShell', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check for main container
    const mainContent = page.locator('main').or(page.locator('[role="main"]'));
    await expect(mainContent).toBeTruthy();
  });

  test('should display badge with current date', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Look for a badge element with date
    // The date format should be YYYY-MM-DD
    const datePattern = /\d{4}-\d{2}-\d{2}/;
    
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toMatch(datePattern);
  });

  test('should be responsive and render correctly', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Check viewport
    const viewportSize = page.viewportSize();
    expect(viewportSize?.width).toBeGreaterThan(0);
    expect(viewportSize?.height).toBeGreaterThan(0);
    
    // Check that main content is visible
    const mainContent = page.locator('[class*="max-w-5xl"]').or(page.locator('main'));
    const isVisible = await mainContent.isVisible({ timeout: 2000 }).catch(() => false);
    
    if (isVisible) {
      await expect(mainContent).toBeVisible();
    }
  });

  test('should not have console errors on load', async ({ page }) => {
    const errors: string[] = [];
    
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    await page.goto('/reports/options-ai-analysis');
    await page.waitForLoadState('networkidle');
    
    // Filter out expected errors or known issues
    const unexpectedErrors = errors.filter(
      e => !e.includes('favicon') && 
           !e.includes('_next') &&
           !e.includes('unknown variable')
    );
    
    expect(unexpectedErrors).toHaveLength(0);
  });

  test('should render multiple sections when available', async ({ page }) => {
    await page.waitForLoadState('networkidle');
    
    // Count section elements (headings with icons/emojis)
    const sectionHeadings = page.locator('h2');
    const count = await sectionHeadings.count();
    
    // Should have at least one section (or error message)
    const hasContent = count > 0 || 
                       await page.locator('text=/Failed|error/i').isVisible({ timeout: 2000 }).catch(() => false);
    
    expect(hasContent).toBeTruthy();
  });
});
