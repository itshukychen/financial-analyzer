/**
 * Screenshot Capture Engine
 *
 * Uses Playwright (Chromium) to navigate to each affected route and capture
 * screenshots at all configured viewport sizes. Handles loading states,
 * dynamic content, and failures gracefully.
 */

import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import * as path from 'path';
import * as fs from 'fs/promises';
import { VIEWPORTS, type ViewportConfig } from './viewport-configs';
import type { AffectedRoute } from './component-mapper';

export interface ScreenshotMetadata {
  url: string;
  route: string;
  viewport: string;
  width: number;
  height: number;
  filePath: string;
  fileSize: number;
  capturedAt: string;
  success: boolean;
  error?: string;
}

export interface CaptureResult {
  route: string;
  viewport: string;
  filePath: string;
  metadata: ScreenshotMetadata;
}

export interface CaptureOptions {
  baseUrl: string;
  outputDir: string;
  /** Additional wait in ms after networkidle (default: 1000) */
  defaultExtraWaitMs?: number;
}

/** CSS injected before capture to hide dynamic elements */
const DYNAMIC_CONTENT_CSS = `
  /* Hide live price indicators and timestamps during capture */
  [data-testid="live-indicator"],
  [data-testid="timestamp"],
  [data-live="true"],
  .live-badge,
  .price-flash {
    visibility: hidden !important;
  }
`;

/** Derive a slug from a route path for use in filenames */
export function routeToSlug(routePath: string): string {
  if (routePath === '/') return 'home';
  return routePath.replace(/^\//, '').replace(/\//g, '-');
}

/** Build the filename for a screenshot */
export function buildFilename(routePath: string, viewport: ViewportConfig): string {
  return `${routeToSlug(routePath)}-${viewport.name}.png`;
}

async function captureRoute(
  page: Page,
  route: AffectedRoute,
  viewport: ViewportConfig,
  options: CaptureOptions
): Promise<CaptureResult> {
  const url = `${options.baseUrl}${route.path}`;
  const filename = buildFilename(route.path, viewport);
  const filePath = path.join(options.outputDir, filename);
  const capturedAt = new Date().toISOString();

  const metadata: ScreenshotMetadata = {
    url,
    route: route.path,
    viewport: viewport.name,
    width: viewport.width,
    height: viewport.height,
    filePath,
    fileSize: 0,
    capturedAt,
    success: false,
  };

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30_000,
    });

    // Inject CSS to hide dynamic content
    await page.addStyleTag({ content: DYNAMIC_CONTENT_CSS });

    // Wait for custom selectors from manifest
    for (const selector of route.manifestEntry.waitSelectors ?? []) {
      await page.waitForSelector(selector, { timeout: 10_000 }).catch(() => {
        // Non-fatal: selector may not exist on this route
      });
    }

    // Hide elements specified in the manifest
    const hideSelectors = route.manifestEntry.hideSelectors ?? [];
    if (hideSelectors.length > 0) {
      await page.addStyleTag({
        content: hideSelectors.map((s) => `${s} { visibility: hidden !important; }`).join('\n'),
      });
    }

    // Buffer wait for charts/animations
    const extraWait = route.manifestEntry.extraWaitMs ?? options.defaultExtraWaitMs ?? 1000;
    await page.waitForTimeout(extraWait);

    await page.screenshot({ path: filePath, fullPage: true });

    const stat = await fs.stat(filePath);
    metadata.fileSize = stat.size;
    metadata.success = true;
  } catch (err) {
    metadata.error = err instanceof Error ? err.message : String(err);
    metadata.success = false;
  }

  return { route: route.path, viewport: viewport.name, filePath, metadata };
}

/**
 * Capture screenshots for all affected routes at all viewport sizes.
 * Reuses a single browser instance across all routes.
 */
export async function captureScreenshots(
  routes: AffectedRoute[],
  options: CaptureOptions
): Promise<CaptureResult[]> {
  await fs.mkdir(options.outputDir, { recursive: true });

  let browser: Browser | null = null;
  let context: BrowserContext | null = null;
  const results: CaptureResult[] = [];

  try {
    browser = await chromium.launch({ headless: true });
    context = await browser.newContext({
      colorScheme: 'dark',
    });
    const page = await context.newPage();

    for (const route of routes) {
      const viewports = options
        ? VIEWPORTS.filter((v) =>
            route.manifestEntry.viewports
              ? route.manifestEntry.viewports.includes(v.name)
              : true
          )
        : VIEWPORTS;

      for (const viewport of viewports) {
        const result = await captureRoute(page, route, viewport, options);
        results.push(result);
      }
    }
  } finally {
    await context?.close();
    await browser?.close();
  }

  // Write metadata sidecar
  const metaPath = path.join(options.outputDir, 'metadata.json');
  await fs.writeFile(
    metaPath,
    JSON.stringify(results.map((r) => r.metadata), null, 2)
  );

  return results;
}
