/**
 * Route manifest — source of truth for screenshot coverage.
 * Maps application routes to their component dependencies and capture config.
 */

import type { ViewportName } from './viewport-configs';

export interface RouteManifestEntry {
  /** URL path, e.g. "/" or "/markets" */
  path: string;
  /** Human-readable name for reports */
  name: string;
  /** Component file paths (relative to project root) that affect this route */
  components: string[];
  /** CSS selectors to wait for before capturing (default: networkidle) */
  waitSelectors?: string[];
  /** CSS selectors for elements to hide before capture (e.g. live clocks) */
  hideSelectors?: string[];
  /** Viewports to capture. Defaults to all three if omitted. */
  viewports?: ViewportName[];
  /** Extra wait in ms after page load (for animations/charts) */
  extraWaitMs?: number;
}

/**
 * All application routes included in visual regression coverage.
 */
export const ROUTE_MANIFEST: RouteManifestEntry[] = [
  {
    path: '/',
    name: 'Home / Dashboard',
    components: [
      'app/page.tsx',
      'src/components/Dashboard',
      'src/components/charts',
      'src/components/StockCard',
    ],
    waitSelectors: ['[data-testid="dashboard"]'],
    hideSelectors: ['[data-testid="live-indicator"]', '[data-testid="timestamp"]'],
    extraWaitMs: 1000,
  },
  {
    path: '/markets',
    name: 'Markets',
    components: [
      'app/markets/page.tsx',
      'src/components/MarketOverview',
      'src/components/charts',
      'src/components/StockTable',
    ],
    waitSelectors: ['[data-testid="markets-page"]'],
    hideSelectors: ['[data-testid="live-indicator"]', '[data-testid="timestamp"]'],
    extraWaitMs: 1000,
  },
  {
    path: '/reports',
    name: 'Reports',
    components: [
      'app/reports/page.tsx',
      'src/components/ReportView',
      'src/components/charts',
    ],
    waitSelectors: ['[data-testid="reports-page"]'],
    hideSelectors: ['[data-testid="timestamp"]'],
    extraWaitMs: 500,
  },
  {
    path: '/watchlist',
    name: 'Watchlist',
    components: [
      'app/watchlist/page.tsx',
      'src/components/Watchlist',
      'src/components/StockCard',
    ],
    waitSelectors: ['[data-testid="watchlist-page"]'],
    hideSelectors: ['[data-testid="live-indicator"]'],
    extraWaitMs: 500,
  },
  {
    path: '/alerts',
    name: 'Alerts',
    components: [
      'app/alerts/page.tsx',
      'src/components/AlertsList',
      'src/components/AlertForm',
    ],
    waitSelectors: ['[data-testid="alerts-page"]'],
    extraWaitMs: 300,
  },
];

/**
 * Look up a manifest entry by route path.
 */
export function getRouteEntry(path: string): RouteManifestEntry | undefined {
  return ROUTE_MANIFEST.find((r) => r.path === path);
}

/**
 * Returns all route paths listed in the manifest.
 */
export function getAllRoutePaths(): string[] {
  return ROUTE_MANIFEST.map((r) => r.path);
}
