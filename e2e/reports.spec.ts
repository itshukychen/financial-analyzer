import { test, expect } from '@playwright/test';

// ─── Mock report data for E2E ──────────────────────────────────────────────────

const MOCK_REPORT = {
  date:        '2026-02-26',
  generatedAt: '2026-02-26T22:45:00.000Z',
  marketData: {
    spx:      { current: 5800, changePct: 3.57,  points: [{ time: '2026-02-17', value: 5600 }, { time: '2026-02-26', value: 5800 }] },
    vix:      { current: 14,   changePct: -30,   points: [{ time: '2026-02-17', value: 20   }, { time: '2026-02-26', value: 14   }] },
    dxy:      { current: 107,  changePct: 2.88,  points: [{ time: '2026-02-17', value: 104  }, { time: '2026-02-26', value: 107  }] },
    yield10y: { current: 4.5,  changePct: 7.14,  points: [{ time: '2026-02-17', value: 4.2  }, { time: '2026-02-26', value: 4.5  }] },
    yield2y:  { current: 4.1,  changePct: 7.89,  points: [{ time: '2026-02-17', value: 3.8  }, { time: '2026-02-26', value: 4.1  }] },
  },
  analysis: {
    headline: 'Equities Rally on Cooling Inflation Data',
    summary:  'Strong session across risk assets. Bonds sold off modestly. Dollar index firmed.',
    sections: {
      equity:      'SPX advanced 3.57% over the week.\n\nMomentum remains constructive.',
      volatility:  'VIX dropped sharply to 14.00, signalling complacency.',
      fixedIncome: '10Y yield rose to 4.50%. Curve remains inverted.',
      dollar:      'DXY firmed to 107.00 on strong economic data.',
      crossAsset:  'Risk-on tone dominated. Equities up, VIX down, yields rising.',
      outlook:     'Watch Friday NFP for next catalyst.',
    },
  },
};

test.describe('/reports page', () => {
  test('page loads with correct h1 heading', async ({ page }) => {
    await page.goto('/reports');
    await expect(page.locator('h1')).toContainText('Report');
  });

  test('shows "Check back soon" when no report is available (no mock)', async ({ page }) => {
    // Intercept the filesystem read by mocking the API route
    await page.route('**/api/reports/latest', route =>
      route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'No report available yet' }) })
    );
    await page.goto('/reports');
    await expect(page.getByText(/Check back soon/i)).toBeVisible();
  });

  test('shows headline when report is available', async ({ page }) => {
    await page.route('**/api/reports/latest', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_REPORT) })
    );
    await page.route('**/api/reports/list', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ dates: ['2026-02-26'] }) })
    );
    await page.goto('/reports');
    await expect(page.getByText('Equities Rally on Cooling Inflation Data')).toBeVisible();
  });

  test('shows the date chip when report is available', async ({ page }) => {
    await page.route('**/api/reports/latest', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_REPORT) })
    );
    await page.route('**/api/reports/list', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ dates: ['2026-02-26'] }) })
    );
    await page.goto('/reports');
    await expect(page.getByText(/February.*2026/i)).toBeVisible();
  });

  test('shows all 6 section titles when report is available', async ({ page }) => {
    await page.route('**/api/reports/latest', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_REPORT) })
    );
    await page.route('**/api/reports/list', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ dates: ['2026-02-26'] }) })
    );
    await page.goto('/reports');
    for (const title of ['Equities', 'Volatility', 'Fixed Income', 'US Dollar', 'Cross-Asset', 'Outlook']) {
      await expect(page.getByText(title).first()).toBeVisible();
    }
  });

  test('shows executive summary when report is available', async ({ page }) => {
    await page.route('**/api/reports/latest', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify(MOCK_REPORT) })
    );
    await page.route('**/api/reports/list', route =>
      route.fulfill({ contentType: 'application/json', body: JSON.stringify({ dates: ['2026-02-26'] }) })
    );
    await page.goto('/reports');
    await expect(page.getByText('Executive Summary')).toBeVisible();
    await expect(page.getByText(/Strong session across risk assets/)).toBeVisible();
  });
});
