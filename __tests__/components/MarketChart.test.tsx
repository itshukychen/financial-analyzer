import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import MarketChart from '@/app/components/charts/MarketChart';

const mockChartData = {
  symbol: '^GSPC',
  name: 'S&P 500',
  points: [
    { time: '2026-02-17', value: 100 },
    { time: '2026-02-18', value: 102 },
    { time: '2026-02-19', value: 101 },
    { time: '2026-02-20', value: 103 },
    { time: '2026-02-21', value: 105 },
    { time: '2026-02-24', value: 104 },
    { time: '2026-02-25', value: 106 },
  ],
  current: 106,
  open: 100,
  change: 6,
  changePct: 6.0,
};

const mockNegativeData = {
  ...mockChartData,
  symbol: '^VIX',
  name: 'VIX',
  current: 14,
  open: 20,
  change: -6,
  changePct: -30.0,
};

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockChartData),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('MarketChart', () => {
  it('shows skeleton loading state initially (before fetch resolves)', () => {
    // Use a manually controlled promise so we can observe the loading state
    let resolveRef: (value: unknown) => void = () => {};
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise((resolve) => {
            resolveRef = resolve;
          }),
      ),
    );

    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    expect(screen.getByTestId('chart-skeleton')).toBeInTheDocument();

    // Resolve to clean up (prevents act() warnings)
    resolveRef({
      ok: false,
      json: () => Promise.resolve({ error: 'cancelled' }),
    });
  });

  it('shows the label prop', () => {
    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
  });

  it('after fetch succeeds: shows the current value formatted by formatValue', async () => {
    render(
      <MarketChart
        ticker="^GSPC"
        label="S&P 500"
        formatValue={(v) => `$${v.toFixed(2)}`}
      />,
    );
    await waitFor(() => {
      expect(screen.getByText('$106.00')).toBeInTheDocument();
    });
  });

  it('after fetch succeeds: shows changePct as +6.00%', async () => {
    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    await waitFor(() => {
      expect(screen.getByText('+6.00%')).toBeInTheDocument();
    });
  });

  it('after fetch with negative changePct: shows -X.XX% in red', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockNegativeData),
      }),
    );

    render(<MarketChart ticker="^VIX" label="VIX" />);
    await waitFor(() => {
      const delta = screen.getByText('-30.00%');
      expect(delta).toBeInTheDocument();
      // Component uses hardcoded #f63b3b for negative delta
      expect(delta).toHaveStyle({ color: '#f63b3b' });
    });
  });

  it('after fetch with positive changePct: delta badge uses green color', async () => {
    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    await waitFor(() => {
      const delta = screen.getByText('+6.00%');
      // Component uses hardcoded #00d97e for positive delta
      expect(delta).toHaveStyle({ color: '#00d97e' });
    });
  });

  it('fetches the correct URL: /api/market/chart/%5EGSPC for ticker ^GSPC', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockChartData),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/market/chart/%5EGSPC'),
      );
    });
  });

  it('fetches correct URL for FRED ticker: /api/market/chart/DGS2', async () => {
    const fredData = {
      ...mockChartData,
      symbol: 'DGS2',
      name: '2Y Treasury Yield',
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fredData),
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MarketChart ticker="DGS2" label="2Y Yield" />);
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/market/chart/DGS2'),
      );
    });
  });

  it('on fetch error (network failure): shows error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    await waitFor(() => {
      expect(screen.getByTestId('chart-error')).toBeInTheDocument();
    });
  });

  it('on API error response ({error: "No data available"}): shows error state', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: 'No data available' }),
      }),
    );

    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    await waitFor(() => {
      expect(screen.getByTestId('chart-error')).toBeInTheDocument();
    });
  });

  it('chart container div is rendered after data loads', async () => {
    render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    await waitFor(() => {
      expect(screen.getByTestId('chart-container')).toBeInTheDocument();
    });
  });

  it('formatValue prop is called with current value and result is displayed', async () => {
    const mockFormatValue = vi.fn((v: number) => `FORMATTED_${v}`);
    render(
      <MarketChart ticker="^GSPC" label="S&P 500" formatValue={mockFormatValue} />,
    );
    await waitFor(() => {
      expect(mockFormatValue).toHaveBeenCalledWith(106);
      expect(screen.getByText('FORMATTED_106')).toBeInTheDocument();
    });
  });
});
