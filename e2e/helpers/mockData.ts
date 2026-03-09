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
  'CL%3DF': {
    symbol: 'CL=F',
    name: 'WTI',
    points: [
      { time: '2026-02-17', value: 70.0 },
      { time: '2026-02-18', value: 70.5 },
      { time: '2026-02-19', value: 71.0 },
      { time: '2026-02-20', value: 71.5 },
      { time: '2026-02-21', value: 72.0 },
      { time: '2026-02-24', value: 72.5 },
      { time: '2026-02-25', value: 73.0 },
    ],
    current: 73.0,
    open: 70.0,
    change: 3.0,
    changePct: 4.29,
  },
  'BZ%3DF': {
    symbol: 'BZ=F',
    name: 'Brent',
    points: [
      { time: '2026-02-17', value: 74.0 },
      { time: '2026-02-18', value: 74.5 },
      { time: '2026-02-19', value: 75.0 },
      { time: '2026-02-20', value: 75.5 },
      { time: '2026-02-21', value: 76.0 },
      { time: '2026-02-24', value: 76.5 },
      { time: '2026-02-25', value: 77.0 },
    ],
    current: 77.0,
    open: 74.0,
    change: 3.0,
    changePct: 4.05,
  },
};

/** Intercept the Fear & Greed API and return deterministic mock data. */
export async function mockFearGreedAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/fear-greed', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        score: 72,
        rating: 'Greed',
        previousClose: 70,
        previous1Week: 65,
        previous1Month: 45,
        previous1Year: 60,
        timestamp: '2026-02-27T14:35:00Z',
      }),
    }),
  );
}

/** Intercept all chart API calls and return deterministic mock data. */
export async function mockChartAPI(page: import('@playwright/test').Page) {
  await page.route('**/api/market/chart/**', (route) => {
    const url = route.request().url();
    // Strip query string so range param doesn't break ticker lookup
    const rawTicker = url.split('/api/market/chart/')[1]?.split('?')[0] ?? '';
    const rangeParam = new URL(url).searchParams.get('range');

    // FRED tickers with range=1D return unsupported response
    if (rangeParam === '1D' && (rawTicker === 'DGS2' || rawTicker === 'DGS10')) {
      route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({ data: [], unsupported: true }),
      });
      return;
    }

    const data = MOCK_CHART_RESPONSES[rawTicker];
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
