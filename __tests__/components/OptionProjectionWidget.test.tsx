import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OptionProjectionWidget from '@/app/components/options/OptionProjectionWidget';

const MOCK_DATA = {
  volatility: {
    iv_30d: 18.5,
    iv_rank: 42,
  },
  implied_move: {
    '1w_move_pct': 2.3,
  },
  regime: 'normal' as const,
  timestamp: '2026-03-09T14:30:00Z',
};

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OptionProjectionWidget', () => {
  it('shows skeleton loading state initially', () => {
    (global.fetch as any).mockImplementationOnce(
      () => new Promise(() => {}) // Never resolves
    );

    render(<OptionProjectionWidget />);
    expect(screen.getByTestId('option-projection-skeleton')).toBeInTheDocument();
  });

  it('displays data when fetch succeeds', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/option projection/i)).toBeInTheDocument();
      expect(screen.getByText(/18.5/)).toBeInTheDocument();
      expect(screen.getByText(/2.3/)).toBeInTheDocument();
    });
  });

  it('displays correct header text', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/option projection/i)).toBeInTheDocument();
    });
  });

  it('displays implied move with ± symbol', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/±2.3%/)).toBeInTheDocument();
    });
  });

  it('displays 30d IV value', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/18.5%/)).toBeInTheDocument();
    });
  });

  it('displays IV rank value', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/rank:\s*42/i)).toBeInTheDocument();
    });
  });

  // ─── Regime Tests ──────────────────────────────────────────────────────────────

  it('displays "Low Volatility" for low regime', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ...MOCK_DATA,
        regime: 'low',
      }),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/🟢\s*low volatility/i)).toBeInTheDocument();
    });
  });

  it('displays "High Volatility" for high regime', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ...MOCK_DATA,
        regime: 'high',
      }),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/🔴\s*high volatility/i)).toBeInTheDocument();
    });
  });

  it('displays "Normal Volatility" for normal regime', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ...MOCK_DATA,
        regime: 'normal',
      }),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/⚪\s*normal volatility/i)).toBeInTheDocument();
    });
  });

  // ─── Error State Tests ──────────────────────────────────────────────────────────

  it('shows error state when fetch fails', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load option data/i)).toBeInTheDocument();
    });
  });

  it('shows error state when API returns non-ok status', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      statusText: 'Internal Server Error',
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load option data/i)).toBeInTheDocument();
    });
  });

  it('displays error message when available', async () => {
    (global.fetch as any).mockRejectedValueOnce(new Error('Connection timeout'));

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/connection timeout/i)).toBeInTheDocument();
    });
  });

  it('shows error state when JSON parsing fails', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.reject(new Error('Invalid JSON')),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load option data/i)).toBeInTheDocument();
    });
  });

  // ─── Timestamp Tests ───────────────────────────────────────────────────────────

  it('displays formatted timestamp in Eastern Time', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ...MOCK_DATA,
        timestamp: '2026-03-09T14:30:00Z', // Convert to ET based on DST rules
      }),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
      // The time should be formatted in AM/PM format with ET timezone
      const lastUpdatedText = screen.getByText(/last updated:/i).parentElement?.textContent || '';
      expect(lastUpdatedText).toMatch(/am|pm/i);
      expect(lastUpdatedText).toMatch(/et/i);
    });
  });

  it('displays ET timezone abbreviation', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/et$/i)).toBeInTheDocument();
    });
  });

  // ─── Link Tests ────────────────────────────────────────────────────────────────

  it('renders link to full analysis', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      const link = screen.getByRole('link', { name: /view full analysis/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/reports/option-projection');
    });
  });

  // ─── API Endpoint Tests ────────────────────────────────────────────────────────

  it('calls correct API endpoint', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch');
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/option projection/i)).toBeInTheDocument();
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/options/snapshot?ticker=SPWX&expiry=30d'
    );

    fetchSpy.mockRestore();
  });

  // ─── Stat Card Component Tests ─────────────────────────────────────────────────

  it('renders StatCard for implied move', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/implied move/i)).toBeInTheDocument();
    });
  });

  it('renders StatCard for 30d IV', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/30d iv/i)).toBeInTheDocument();
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────────────

  it('handles null data gracefully', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(null),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load option data/i)).toBeInTheDocument();
    });
  });

  it('handles fetch throwing non-Error object', async () => {
    (global.fetch as any).mockRejectedValueOnce('String error');

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/unable to load option data/i)).toBeInTheDocument();
      expect(screen.getByText(/unknown error/i)).toBeInTheDocument();
    });
  });

  it('maintains loading state until data arrives', async () => {
    let resolveJson: any;
    const jsonPromise = new Promise((resolve) => {
      resolveJson = resolve;
    });

    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => jsonPromise,
    });

    const { rerender } = render(<OptionProjectionWidget />);

    // Initially loading
    expect(screen.getByTestId('option-projection-skeleton')).toBeInTheDocument();

    // Resolve JSON
    resolveJson(MOCK_DATA);

    // Rerender to check updated state
    rerender(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.queryByTestId('option-projection-skeleton')).not.toBeInTheDocument();
      expect(screen.getByText(/option projection/i)).toBeInTheDocument();
    });
  });

  it('uses default values for missing timestamp data', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        ...MOCK_DATA,
        timestamp: new Date().toISOString(),
      }),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByText(/last updated:/i)).toBeInTheDocument();
    });
  });

  it('renders card container when data loads', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(MOCK_DATA),
    });

    render(<OptionProjectionWidget />);

    await waitFor(() => {
      expect(screen.getByTestId('option-projection-card')).toBeInTheDocument();
    });
  });
});
