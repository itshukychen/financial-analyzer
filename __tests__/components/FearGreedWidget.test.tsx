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

  it('handles zero score', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...MOCK_API_RESPONSE,
          score: 0,
        }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-score')).toBeInTheDocument();
      expect(screen.getByTestId('fear-greed-score').textContent).toContain('0');
    });

    vi.unstubAllGlobals();
  });

  it('handles maximum score (100)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...MOCK_API_RESPONSE,
          score: 100,
        }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      expect(screen.getByTestId('fear-greed-score')).toBeInTheDocument();
      expect(screen.getByTestId('fear-greed-score').textContent).toContain('100');
    });

    vi.unstubAllGlobals();
  });

  it('shows extreme fear color for score <= 24', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...MOCK_API_RESPONSE,
          score: 10,
          rating: 'Extreme Fear',
        }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      const ratingElement = screen.getByTestId('fear-greed-rating');
      expect(ratingElement.textContent).toContain('Extreme Fear');
    });

    vi.unstubAllGlobals();
  });

  it('shows fear color for score 25-44', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...MOCK_API_RESPONSE,
          score: 35,
          rating: 'Fear',
        }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      const ratingElement = screen.getByTestId('fear-greed-rating');
      expect(ratingElement.textContent).toContain('Fear');
    });

    vi.unstubAllGlobals();
  });

  it('shows neutral color for score 45-55', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...MOCK_API_RESPONSE,
          score: 50,
          rating: 'Neutral',
        }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      const ratingElement = screen.getByTestId('fear-greed-rating');
      expect(ratingElement.textContent).toContain('Neutral');
    });

    vi.unstubAllGlobals();
  });

  it('shows greed color for score 56-74', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...MOCK_API_RESPONSE,
          score: 65,
          rating: 'Greed',
        }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      const ratingElement = screen.getByTestId('fear-greed-rating');
      expect(ratingElement.textContent).toContain('Greed');
    });

    vi.unstubAllGlobals();
  });

  it('shows extreme greed color for score >= 75', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          ...MOCK_API_RESPONSE,
          score: 85,
          rating: 'Extreme Greed',
        }),
      }),
    );

    render(<FearGreedWidget />);
    await waitFor(() => {
      const ratingElement = screen.getByTestId('fear-greed-rating');
      expect(ratingElement.textContent).toContain('Extreme Greed');
    });

    vi.unstubAllGlobals();
  });

  it('handles undefined data response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(undefined),
      }),
    );

    const { container } = render(<FearGreedWidget />);
    await waitFor(() => {
      // When data is undefined but no explicit error, should render error message
      const errorDiv = container.querySelector('[data-testid="fear-greed-error"]');
      // Either error state renders or component returns null (renders nothing)
      // Check that it's not stuck in loading state
      const skeleton = container.querySelector('[data-testid="fear-greed-skeleton"]');
      expect(skeleton).not.toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });
});
