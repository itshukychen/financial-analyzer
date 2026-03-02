import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import FearGreedWidget from '@/app/components/charts/FearGreedWidget';

const MOCK_API_RESPONSE = {
  score: 72,
  rating: 'Greed',
  previousClose: 70,
  previous1Week: 65,
  previous1Month: 45,
  previous1Year: 60,
  timestamp: '2026-02-27T14:35:00Z',
};

// The raw CNN JSON shape (this is what the API route receives from CNN and
// transforms; but our component calls /api/fear-greed which returns the
// already-transformed FearGreedData shape above).
const MOCK_FEAR_GREED = {
  fear_and_greed: {
    score: 72.3,
    rating: 'Greed',
    previous_close: 70,
    previous_1_week: 65,
    previous_1_month: 45,
    previous_1_year: 60,
    timestamp: '2026-02-27T14:35:00Z',
  },
};
// suppress unused-variable lint — the constant documents the original mock shape
void MOCK_FEAR_GREED;

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_API_RESPONSE),
    }),
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('FearGreedWidget', () => {
  it('shows skeleton while loading', () => {
    // Keep fetch pending so loading state persists
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})), // never resolves
    );

    render(<FearGreedWidget />);
    expect(screen.getByTestId('fear-greed-skeleton')).toBeInTheDocument();
  });

  it('shows score after load', async () => {
    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-score')).toBeInTheDocument();
      expect(screen.getByTestId('fear-greed-score').textContent).toContain('72');
    });
  });

  it('shows rating after load', async () => {
    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-rating')).toBeInTheDocument();
      expect(screen.getByTestId('fear-greed-rating').textContent).toContain('Greed');
    });
  });

  it('shows error state when fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network error')),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-error')).toBeInTheDocument();
    });
  });

  it('shows error state when API returns error field', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ error: 'CNN API returned 503' }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-error')).toBeInTheDocument();
    });
  });

  it('shows "FEAR & GREED" label', async () => {
    render(<FearGreedWidget />);
    // The label text renders as "Fear & Greed" via HTML entity — getByText is
    // case-insensitive partial match; use a regex to be flexible.
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-card')).toBeInTheDocument();
    });
    // The header span text content is "Fear & Greed" (JSX &amp; renders as &)
    const card = screen.getByTestId('fear-greed-card');
    expect(card.textContent).toMatch(/fear\s*&\s*greed/i);
  });

  it('shows "CNN" source tag', async () => {
    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-card')).toBeInTheDocument();
    });
    expect(screen.getByText('CNN')).toBeInTheDocument();
  });

  it('renders the card outer container when data loads', async () => {
    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-card')).toBeInTheDocument();
    });
  });
});
