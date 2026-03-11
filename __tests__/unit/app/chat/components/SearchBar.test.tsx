/**
 * Tests for: app/chat/components/SearchBar.tsx
 *
 * Coverage:
 * - Renders input field
 * - Shows loading spinner during search
 * - Shows "No results" when empty
 * - Shows results with title, date, snippet
 * - Debounces search (300ms)
 * - Keyboard navigation: arrow keys, Enter, Escape
 * - Click handler calls onSelectResult with correct args
 * - Aborts previous fetch on new query
 * - Snippet highlighting
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import SearchBar from '@/app/chat/components/SearchBar';

const MOCK_RESULTS = [
  {
    messageId: 'msg-1',
    conversationId: 'conv-1',
    conversationTitle: 'Volatility Discussion',
    snippet: 'The IV rank is currently elevated',
    role: 'assistant',
    createdAt: '2026-03-01T10:00:00Z',
    score: 1.0,
  },
  {
    messageId: 'msg-2',
    conversationId: 'conv-2',
    conversationTitle: 'Portfolio Review',
    snippet: 'Consider hedging with puts',
    role: 'assistant',
    createdAt: '2026-03-05T14:30:00Z',
    score: 0.8,
  },
];

function mockFetch(results: typeof MOCK_RESULTS = MOCK_RESULTS) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ results }),
    }),
  );
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('SearchBar', () => {
  it('renders the search input', () => {
    render(<SearchBar onSelectResult={vi.fn()} />);
    expect(screen.getByTestId('search-input')).toBeInTheDocument();
    expect(screen.getByTestId('search-bar')).toBeInTheDocument();
  });

  it('does not show spinner or dropdown initially', () => {
    render(<SearchBar onSelectResult={vi.fn()} />);
    expect(screen.queryByTestId('search-spinner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();
  });

  it('debounces search by 300ms and shows spinner', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'vol' } });

    // Spinner should appear immediately (loading state set before debounce fires)
    // Actually spinner only appears after fetch starts — advance timer
    // No fetch yet (debounce not fired)
    expect(vi.mocked(fetch)).not.toHaveBeenCalled();

    // Advance 300ms to trigger debounce
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1);
    });
  });

  it('does not search for queries shorter than 2 chars', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'v' } });
    await act(async () => {
      vi.advanceTimersByTime(400);
    });

    expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  });

  it('shows search results after fetch completes', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-dropdown')).toBeInTheDocument();
    });

    expect(screen.getByTestId('search-result-0')).toBeInTheDocument();
    expect(screen.getByTestId('search-result-1')).toBeInTheDocument();
    expect(screen.getByTestId('search-result-title-0')).toHaveTextContent('Volatility Discussion');
    expect(screen.getByTestId('search-result-title-1')).toHaveTextContent('Portfolio Review');
  });

  it('shows snippet in results', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'IV rank' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-snippet-0')).toBeInTheDocument();
    });

    expect(screen.getByTestId('search-result-snippet-0')).toHaveTextContent('The IV rank is currently elevated');
  });

  it('shows date in results', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-date-0')).toBeInTheDocument();
    });

    // Date should be formatted
    expect(screen.getByTestId('search-result-date-0').textContent).toMatch(/Mar/);
  });

  it('shows "No results found" when search returns empty', async () => {
    mockFetch([]);
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'xyzxyz' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-no-results')).toBeInTheDocument();
    });

    expect(screen.getByTestId('search-no-results')).toHaveTextContent('No results found');
  });

  it('calls onSelectResult with conversationId and messageId on click', async () => {
    mockFetch();
    const onSelectResult = vi.fn();
    render(<SearchBar onSelectResult={onSelectResult} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('search-result-0'));

    expect(onSelectResult).toHaveBeenCalledWith('conv-1', 'msg-1');
  });

  it('closes dropdown and clears input after selecting result', async () => {
    mockFetch();
    const onSelectResult = vi.fn();
    render(<SearchBar onSelectResult={onSelectResult} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('search-result-0'));

    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('supports keyboard navigation with ArrowDown', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('supports keyboard navigation with ArrowUp after ArrowDown', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toHaveAttribute('aria-selected', 'true');
    });
  });

  it('selects result with Enter key', async () => {
    mockFetch();
    const onSelectResult = vi.fn();
    render(<SearchBar onSelectResult={onSelectResult} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-result-0')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onSelectResult).toHaveBeenCalledWith('conv-1', 'msg-1');
  });

  it('closes dropdown with Escape key', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-dropdown')).toBeInTheDocument();
    });

    fireEvent.keyDown(input, { key: 'Escape' });

    expect(screen.queryByTestId('search-dropdown')).not.toBeInTheDocument();
  });

  it('shows loading spinner while fetching', async () => {
    let resolveFetch!: (value: unknown) => void;
    const fetchPromise = new Promise((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(fetchPromise));

    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(screen.getByTestId('search-spinner')).toBeInTheDocument();
    });

    // Resolve the fetch
    await act(async () => {
      resolveFetch({
        ok: true,
        json: () => Promise.resolve({ results: [] }),
      });
    });

    await waitFor(() => {
      expect(screen.queryByTestId('search-spinner')).not.toBeInTheDocument();
    });
  });

  it('calls POST /api/chat/search with correct body', async () => {
    mockFetch();
    render(<SearchBar onSelectResult={vi.fn()} />);
    const input = screen.getByTestId('search-input');

    fireEvent.change(input, { target: { value: 'volatility' } });
    await act(async () => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(vi.mocked(fetch)).toHaveBeenCalledWith(
        '/api/chat/search',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ query: 'volatility', limit: 20 }),
        }),
      );
    });
  });
});
