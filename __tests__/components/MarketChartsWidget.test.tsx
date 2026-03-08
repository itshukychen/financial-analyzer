import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MarketChartsWidget from '@/app/components/charts/MarketChartsWidget';

// Mock data per ticker
const DATA_BY_TICKER: Record<string, object> = {
  '%5EGSPC': { symbol: '^GSPC', name: 'S&P 500', points: [{ time: '2026-02-25', value: 5800 }], current: 5800, open: 5600, change: 200, changePct: 3.57 },
  '%5EVIX': { symbol: '^VIX', name: 'VIX', points: [{ time: '2026-02-25', value: 14 }], current: 14, open: 20, change: -6, changePct: -30 },
  'DX-Y.NYB': { symbol: 'DX-Y.NYB', name: 'US Dollar Index', points: [{ time: '2026-02-25', value: 107 }], current: 107, open: 104, change: 3, changePct: 2.88 },
  '%5ETNX': { symbol: '^TNX', name: '10Y Treasury Yield', points: [{ time: '2026-02-25', value: 4.5 }], current: 4.5, open: 4.2, change: 0.3, changePct: 7.14 },
  'DGS2': { symbol: 'DGS2', name: '2Y Treasury Yield', points: [{ time: '2026-02-25', value: 4.1 }], current: 4.1, open: 3.8, change: 0.3, changePct: 7.89 },
  'CL%3DF': { symbol: 'CL=F', name: 'WTI', points: [{ time: '2026-02-25', value: 73.0 }], current: 73.0, open: 70.0, change: 3.0, changePct: 4.29 },
  'BZ%3DF': { symbol: 'BZ=F', name: 'Brent', points: [{ time: '2026-02-25', value: 77.0 }], current: 77.0, open: 74.0, change: 3.0, changePct: 4.05 },
};

const FEAR_GREED_MOCK = {
  score: 72,
  rating: 'Greed',
  previousClose: 70,
  previous1Week: 65,
  previous1Month: 45,
  previous1Year: 60,
  timestamp: '2026-02-27T14:35:00Z',
};

function defaultMockData() {
  return {
    symbol: 'UNKNOWN',
    name: 'Unknown',
    points: [{ time: '2026-02-25', value: 100 }],
    current: 100,
    open: 100,
    change: 0,
    changePct: 0,
  };
}

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockImplementation((url: string) => {
      // Fear & Greed widget fetch
      if (url.includes('/api/fear-greed')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(FEAR_GREED_MOCK),
        });
      }
      // Match the ticker from the chart URL
      const match = url.match(/\/api\/market\/chart\/(.+)$/);
      const ticker = match?.[1] ?? '';
      const data = DATA_BY_TICKER[ticker] ?? defaultMockData();
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(data),
      });
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MarketChartsWidget', () => {
  it('renders exactly 7 chart labels: S&P 500, VIX, DX-Y, 10Y Yield, 2Y Yield, WTI, Brent', async () => {
    render(<MarketChartsWidget />);
    // Labels are rendered synchronously (not dependent on fetch)
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
    expect(screen.getByText('VIX')).toBeInTheDocument();
    expect(screen.getByText('DX-Y')).toBeInTheDocument();
    expect(screen.getByText('10Y Yield')).toBeInTheDocument();
    expect(screen.getByText('2Y Yield')).toBeInTheDocument();
    expect(screen.getByText('WTI')).toBeInTheDocument();
    expect(screen.getByText('Brent')).toBeInTheDocument();
  });

  it('makes 8 fetch calls on mount (7 charts + fear-greed)', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<MarketChartsWidget />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(8);
    });
  });

  it('fetches the correct tickers: ^GSPC, ^VIX, DX-Y.NYB, ^TNX, DGS2, CL=F, BZ=F', async () => {
    const fetchMock = vi.mocked(global.fetch as ReturnType<typeof vi.fn>);
    render(<MarketChartsWidget />);
    await waitFor(() => {
      const urls: string[] = fetchMock.mock.calls.map((call) => call[0] as string);
      expect(urls.some((u) => u.includes('%5EGSPC'))).toBe(true);
      expect(urls.some((u) => u.includes('%5EVIX'))).toBe(true);
      expect(urls.some((u) => u.includes('DX-Y.NYB'))).toBe(true);
      expect(urls.some((u) => u.includes('%5ETNX'))).toBe(true);
      expect(urls.some((u) => u.includes('DGS2'))).toBe(true);
      expect(urls.some((u) => u.includes('CL%3DF'))).toBe(true);
      expect(urls.some((u) => u.includes('BZ%3DF'))).toBe(true);
    });
  });
});
