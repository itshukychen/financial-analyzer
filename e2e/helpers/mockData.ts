export const MOCK_CHART_RESPONSES: Record<string, object> = {
  '%5EGSPC': {
    symbol: '^GSPC',
    name: 'S&P 500',
    points: [
      { time: '2026-02-17', value: 5600 },
      { time: '2026-02-18', value: 5650 },
      { time: '2026-02-19', value: 5620 },
      { time: '2026-02-20', value: 5700 },
      { time: '2026-02-21', value: 5750 },
      { time: '2026-02-24', value: 5720 },
      { time: '2026-02-25', value: 5800 },
    ],
    current: 5800,
    open: 5600,
    change: 200,
    changePct: 3.57,
  },
  '%5EVIX': {
    symbol: '^VIX',
    name: 'VIX',
    points: [
      { time: '2026-02-17', value: 20 },
      { time: '2026-02-18', value: 19 },
      { time: '2026-02-19', value: 18 },
      { time: '2026-02-20', value: 17 },
      { time: '2026-02-21', value: 16 },
      { time: '2026-02-24', value: 15 },
      { time: '2026-02-25', value: 14 },
    ],
    current: 14,
    open: 20,
    change: -6,
    changePct: -30,
  },
  'DX-Y.NYB': {
    symbol: 'DX-Y.NYB',
    name: 'US Dollar Index',
    points: [
      { time: '2026-02-17', value: 104 },
      { time: '2026-02-18', value: 104.5 },
      { time: '2026-02-19', value: 105 },
      { time: '2026-02-20', value: 105.5 },
      { time: '2026-02-21', value: 106 },
      { time: '2026-02-24', value: 106.5 },
      { time: '2026-02-25', value: 107 },
    ],
    current: 107,
    open: 104,
    change: 3,
    changePct: 2.88,
  },
  '%5ETNX': {
    symbol: '^TNX',
    name: '10Y Treasury Yield',
    points: [
      { time: '2026-02-17', value: 4.2 },
      { time: '2026-02-18', value: 4.25 },
      { time: '2026-02-19', value: 4.3 },
      { time: '2026-02-20', value: 4.35 },
      { time: '2026-02-21', value: 4.4 },
      { time: '2026-02-24', value: 4.45 },
      { time: '2026-02-25', value: 4.5 },
    ],
    current: 4.5,
    open: 4.2,
    change: 0.3,
    changePct: 7.14,
  },
  DGS2: {
    symbol: 'DGS2',
    name: '2Y Treasury Yield',
    points: [
      { time: '2026-02-17', value: 3.8 },
      { time: '2026-02-18', value: 3.85 },
      { time: '2026-02-19', value: 3.9 },
      { time: '2026-02-20', value: 3.95 },
      { time: '2026-02-21', value: 4.0 },
      { time: '2026-02-24', value: 4.05 },
      { time: '2026-02-25', value: 4.1 },
    ],
    current: 4.1,
    open: 3.8,
    change: 0.3,
    changePct: 7.89,
  },
};

/** Intercept all chart API calls and return deterministic mock data. */
export async function mockChartAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/market/chart/**', (route) => {
    const url = route.request().url();
    const ticker = url.split('/api/market/chart/')[1];
    const data = MOCK_CHART_RESPONSES[ticker];
    if (data) {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify(data),
      });
    } else {
      route.continue();
    }
  });
}
