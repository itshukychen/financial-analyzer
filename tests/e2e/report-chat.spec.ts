import { test, expect } from '@playwright/test';

test.describe('Report Chat Widget E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a report page
    // Note: You may need to adjust the date to match your test data
    await page.goto('/reports/2026-03-14');
  });

  test('renders chat widget', async ({ page }) => {
    // Check that the chat widget is visible
    const widget = page.locator('text=Ask a Question About This Report');
    await expect(widget).toBeVisible();

    // Check empty state message
    const emptyState = page.locator('text=Ask a question about this report to get started');
    await expect(emptyState).toBeVisible();
  });

  test('user can ask a question and see an answer', async ({ page }) => {
    // Find the textarea
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    await expect(textarea).toBeVisible();

    // Type a question
    await textarea.fill('What is the market outlook?');

    // Find and click the Ask button
    const askButton = page.locator('button:has-text("Ask")');
    await expect(askButton).toBeEnabled();
    await askButton.click();

    // Wait for the response to appear
    // This will depend on your mock API setup
    await expect(page.locator('text=AI')).toBeVisible({ timeout: 5000 });

    // Check that the question is displayed
    const userMessage = page.locator('text=What is the market outlook?');
    await expect(userMessage).toBeVisible();
  });

  test('shows loading spinner while processing', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    await textarea.fill('Quick question?');

    const askButton = page.locator('button:has-text("Ask")');
    await askButton.click();

    // Look for the loading spinner
    const loadingSpinner = page.locator('text=Thinking...');
    await expect(loadingSpinner).toBeVisible({ timeout: 1000 });
  });

  test('character counter updates', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    const charCounter = page.locator('text=/\\d+ \\/ 500/');

    // Initially should show 0 / 500
    await expect(charCounter).toContainText('0 / 500');

    // Type some text
    await textarea.fill('Hello World');
    await expect(charCounter).toContainText('11 / 500');

    // Type more text
    await textarea.fill('Hello World this is a longer question');
    await expect(charCounter).toContainText('36 / 500');
  });

  test('prevents submission of empty question', async ({ page }) => {
    const askButton = page.locator('button:has-text("Ask")');

    // Initially disabled
    await expect(askButton).toBeDisabled();

    // Type and delete
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    await textarea.fill('test');
    await expect(askButton).toBeEnabled();

    await textarea.clear();
    await expect(askButton).toBeDisabled();
  });

  test('prevents submission of oversized question', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    const askButton = page.locator('button:has-text("Ask")');

    // Fill with 501 characters
    const longText = 'a'.repeat(501);
    await textarea.fill(longText);

    // Button should be disabled
    await expect(askButton).toBeDisabled();

    // Remove one character
    await textarea.fill('a'.repeat(500));
    await expect(askButton).toBeEnabled();
  });

  test('clears chat history when clear button clicked', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    const askButton = page.locator('button:has-text("Ask")');
    const clearButton = page.locator('button:has-text("Clear History")');

    // Ask a question first
    await textarea.fill('Test question?');
    await askButton.click();

    // Wait for response
    await expect(page.locator('text=Test question?')).toBeVisible({ timeout: 5000 });

    // Click clear
    await clearButton.click();

    // Check that empty state is shown
    const emptyState = page.locator('text=Ask a question about this report to get started');
    await expect(emptyState).toBeVisible();

    // Check that the question is gone
    await expect(page.locator('text=Test question?')).not.toBeVisible();
  });

  test('handles multiple questions in sequence', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    const askButton = page.locator('button:has-text("Ask")');

    // First question
    await textarea.fill('First question?');
    await askButton.click();
    await expect(page.locator('text=First question?')).toBeVisible({ timeout: 5000 });

    // Second question
    await textarea.fill('Second question?');
    await askButton.click();
    await expect(page.locator('text=Second question?')).toBeVisible({ timeout: 5000 });

    // Both should be visible
    const questions = page.locator('text=/question\\?/');
    const count = await questions.count();
    expect(count).toBeGreaterThanOrEqual(2);
  });

  test('auto-scrolls to latest message', async ({ page }) => {
    const messageList = page.locator('.max-h-\\[400px\\]');
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    const askButton = page.locator('button:has-text("Ask")');

    // Get initial scroll position
    const initialScroll = await messageList.evaluate((el) => el.scrollTop);

    // Ask a question
    await textarea.fill('New question?');
    await askButton.click();

    // Wait for response
    await expect(page.locator('text=AI')).toBeVisible({ timeout: 5000 });

    // Check that scroll position changed (auto-scrolled down)
    const finalScroll = await messageList.evaluate((el) => el.scrollTop);
    expect(finalScroll).toBeGreaterThan(initialScroll);
  });

  test('displays error on API failure', async ({ page }) => {
    // This test requires mocking the API to fail
    // You can use page.route to intercept API calls
    await page.route('/api/reports/*/ask', (route) => {
      route.abort('failed');
    });

    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    const askButton = page.locator('button:has-text("Ask")');

    await textarea.fill('Test question?');
    await askButton.click();

    // Wait for error message
    const errorElement = page.locator('.bg-red-900');
    await expect(errorElement).toBeVisible({ timeout: 5000 });
  });
});
