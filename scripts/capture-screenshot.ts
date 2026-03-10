import { chromium, Browser, Page } from '@playwright/test';

async function captureScreenshot() {
  let browser: Browser | null = null;
  try {
    browser = await chromium.launch();
    const page = await browser.newPage();
    
    // Navigate to the app
    await page.goto('http://localhost:3000/', { waitUntil: 'load', timeout: 30000 });
    
    // Wait for the health badge to be visible
    try {
      await page.waitForSelector('[data-testid="health-badge"]', { timeout: 5000 });
      console.log('Health badge found!');
    } catch {
      console.log('Health badge not found, but continuing with screenshot...');
    }
    
    // Take a screenshot of the entire page
    await page.screenshot({ path: '/tmp/topbar-screenshot.png', fullPage: true });
    console.log('Screenshot saved to /tmp/topbar-screenshot.png');
    
    // Also take a screenshot of just the header/topbar area
    const header = page.locator('header');
    if (await header.isVisible()) {
      await header.screenshot({ path: '/tmp/topbar-only.png' });
      console.log('TopBar screenshot saved to /tmp/topbar-only.png');
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

captureScreenshot();
