/**
 * Tests for: app/components/charts/ChartModal.tsx
 *
 * AC Coverage:
 * AC-1.2 → 'data-testid="chart-modal" present in DOM when rendered'
 * AC-1.3 → 'renders with correct ticker label in header'
 * AC-1.4 → 'chart area has min-height of 400px'
 * AC-2.1 → 'renders all 7 range buttons with correct data-testid values'
 * AC-2.4 → 'default active range is 1M on first render'
 * AC-2.5 → 'loading skeleton shown during fetch; range buttons remain interactive'
 * AC-2.6 → 'error state shown on fetch failure; range buttons remain interactive'
 * AC-2.7 → '1D button is disabled for FRED tickers; NOT disabled for Yahoo tickers'
 * AC-5.1 → 'ESC key fires onClose'
 * AC-5.2 → 'close button fires onClose'
 * AC-5.3 → 'backdrop click fires onClose; panel click does NOT'
 * AC-E.1 → 'empty data shows "No data available for this range"'
 * AC-E.2 → 'clicking new range triggers fetch with correct range param'
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import ChartModal from '@/app/components/charts/ChartModal';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const MOCK_POINTS = [
  { time: '2026-02-17', value: 5600 },
  { time: '2026-02-18', value: 5650 },
  { time: '2026-02-24', value: 5720 },
  { time: '2026-02-25', value: 5800 },
];

const MOCK_RESPONSE = {
  points: MOCK_POINTS,
  current: 5800,
  open: 5600,
  change: 200,
  changePct: 3.57,
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatValue = (v: number) => `$${v.toFixed(2)}`;
const mockClose = vi.fn();

interface RenderOptions {
  ticker?: string;
  label?: string;
  onClose?: () => void;
}

function renderModal({ ticker = '^GSPC', label = 'S&P 500', onClose = mockClose }: RenderOptions = {}) {
  return render(
    <ChartModal
      ticker={ticker}
      label={label}
      formatValue={formatValue}
      onClose={onClose}
    />,
  );
}

/** Mock fetch to always return a successful response. */
function stubFetchSuccess(response = MOCK_RESPONSE) {
  return vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(response),
    }),
  );
}

/** Mock fetch to reject with a network error. */
function stubFetchError(message = 'Network error') {
  return vi.stubGlobal(
    'fetch',
    vi.fn().mockRejectedValue(new Error(message)),
  );
}

/** Mock fetch with a non-ok HTTP response. */
function stubFetchHttpError(status = 500) {
  return vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve({ error: `HTTP ${status}` }),
    }),
  );
}

/** Mock fetch with a promise that never resolves — simulates in-flight request. */
function stubFetchPending() {
  return vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => {})));
}

// ─── Setup / teardown ────────────────────────────────────────────────────────

beforeEach(() => {
  mockClose.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ChartModal — structure and labels (AC-1.2, AC-1.3, AC-1.4)', () => {
  it('AC-1.2: data-testid="chart-modal" is present in the DOM', () => {
    stubFetchPending();
    renderModal();
    expect(screen.getByTestId('chart-modal')).toBeInTheDocument();
  });

  it('AC-1.3: renders the ticker label in the modal header', () => {
    stubFetchPending();
    renderModal({ label: 'S&P 500' });
    // The label appears as a span inside the modal
    const modal = screen.getByTestId('chart-modal');
    expect(within(modal).getByText('S&P 500')).toBeInTheDocument();
  });

  it('AC-1.3: uses the correct label for a different ticker', () => {
    stubFetchPending();
    renderModal({ ticker: 'DGS2', label: '2Y Treasury Yield' });
    expect(screen.getByText('2Y Treasury Yield')).toBeInTheDocument();
  });

  it('AC-1.4: chart area has min-height of 400px', () => {
    stubFetchPending();
    const { container } = renderModal();
    // Find the div wrapping the chart area (parent of modal-chart-container)
    const chartArea = container.querySelector('[data-testid="modal-chart-container"]')
      ?.closest('[style*="400px"]') as HTMLElement | null;
    expect(chartArea).not.toBeNull();
  });

  it('AC-5.2: modal-close-btn is present in the DOM', () => {
    stubFetchPending();
    renderModal();
    expect(screen.getByTestId('modal-close-btn')).toBeInTheDocument();
  });
});

describe('ChartModal — range buttons (AC-2.1, AC-2.4, AC-2.7)', () => {
  it('AC-2.1: all 7 range buttons are rendered with correct data-testid values', () => {
    stubFetchPending();
    renderModal();
    for (const range of ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD']) {
      expect(screen.getByTestId(`range-btn-${range}`)).toBeInTheDocument();
    }
  });

  it('AC-2.4: default active range is 1M on first render', () => {
    stubFetchPending();
    renderModal();
    // The 1M button should have accent styling — check via border style
    const btn1M = screen.getByTestId('range-btn-1M');
    // Active button has border containing 'var(--accent)'
    expect(btn1M.style.border).toContain('var(--accent)');
  });

  it('AC-2.4: non-default range buttons are visually inactive on first render', () => {
    stubFetchPending();
    renderModal();
    // 6M should not have accent border initially
    const btn6M = screen.getByTestId('range-btn-6M');
    expect(btn6M.style.border).not.toContain('var(--accent)');
  });

  it('AC-2.7: 1D button is disabled for FRED ticker (DGS2)', () => {
    stubFetchPending();
    renderModal({ ticker: 'DGS2', label: '2Y Treasury Yield' });
    const btn1D = screen.getByTestId('range-btn-1D');
    expect(btn1D).toBeDisabled();
  });

  it('AC-2.7: 1D button is disabled for FRED ticker (DGS10)', () => {
    stubFetchPending();
    renderModal({ ticker: 'DGS10', label: '10Y Treasury Yield' });
    const btn1D = screen.getByTestId('range-btn-1D');
    expect(btn1D).toBeDisabled();
  });

  it('AC-2.7: 1D button has opacity:0.4 and cursor:not-allowed for FRED ticker', () => {
    stubFetchPending();
    renderModal({ ticker: 'DGS2', label: '2Y Treasury Yield' });
    const btn1D = screen.getByTestId('range-btn-1D');
    expect(btn1D.style.opacity).toBe('0.4');
    expect(btn1D.style.cursor).toBe('not-allowed');
  });

  it('AC-2.7: 1D button is NOT disabled for Yahoo ticker (^GSPC)', () => {
    stubFetchPending();
    renderModal({ ticker: '^GSPC', label: 'S&P 500' });
    const btn1D = screen.getByTestId('range-btn-1D');
    expect(btn1D).not.toBeDisabled();
  });

  it('non-1D buttons are NOT disabled for FRED ticker', () => {
    stubFetchPending();
    renderModal({ ticker: 'DGS2', label: '2Y Treasury Yield' });
    for (const range of ['5D', '1M', '3M', '6M', '1Y', 'YTD']) {
      expect(screen.getByTestId(`range-btn-${range}`)).not.toBeDisabled();
    }
  });
});

describe('ChartModal — loading and error states (AC-2.5, AC-2.6)', () => {
  it('AC-2.5: loading skeleton is visible while fetch is in-flight', () => {
    stubFetchPending();
    renderModal();
    expect(screen.getByTestId('modal-chart-skeleton')).toBeInTheDocument();
  });

  it('AC-2.5: range buttons remain interactive during loading', () => {
    stubFetchPending();
    renderModal();
    // All non-FRED-1D buttons should be enabled during loading
    for (const range of ['5D', '1M', '3M', '6M', '1Y', 'YTD']) {
      expect(screen.getByTestId(`range-btn-${range}`)).not.toBeDisabled();
    }
  });

  it('AC-2.6: error state is shown when fetch rejects', async () => {
    stubFetchError('Connection refused');
    renderModal();
    await waitFor(() => expect(screen.getByTestId('modal-chart-error')).toBeInTheDocument());
    // Skeleton should be gone
    expect(screen.queryByTestId('modal-chart-skeleton')).not.toBeInTheDocument();
  });

  it('AC-2.6: range buttons remain interactive after fetch error', async () => {
    stubFetchError('Timeout');
    renderModal();
    await waitFor(() => expect(screen.getByTestId('modal-chart-error')).toBeInTheDocument());
    for (const range of ['5D', '1M', '3M', '6M', '1Y', 'YTD']) {
      expect(screen.getByTestId(`range-btn-${range}`)).not.toBeDisabled();
    }
  });

  it('AC-2.6: error state is shown when fetch returns non-ok HTTP status', async () => {
    stubFetchHttpError(503);
    renderModal();
    await waitFor(() => expect(screen.getByTestId('modal-chart-error')).toBeInTheDocument());
  });

  it('AC-E.1: empty data shows "No data available for this range"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ points: [], current: 0, changePct: 0 }),
    }));
    renderModal();
    await waitFor(() =>
      expect(screen.getByTestId('modal-chart-empty')).toBeInTheDocument(),
    );
    expect(screen.getByText('No data available for this range')).toBeInTheDocument();
  });

  it('chart-tooltip is in the DOM (initially hidden with display:none)', () => {
    stubFetchPending();
    renderModal();
    const tooltip = screen.getByTestId('chart-tooltip');
    expect(tooltip).toBeInTheDocument();
    expect(tooltip.style.display).toBe('none');
  });
});

describe('ChartModal — range selection triggers fetch (AC-2.2, AC-E.2)', () => {
  it('AC-2.2: clicking range button triggers fetch with correct range param', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderModal({ ticker: '^GSPC' });

    // Wait for initial 1M fetch to complete
    await waitFor(() => expect(screen.queryByTestId('modal-chart-skeleton')).not.toBeInTheDocument());

    // Click 6M range button
    fireEvent.click(screen.getByTestId('range-btn-6M'));

    // Wait for the new fetch to be triggered
    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(lastCall?.[0] ?? '')).toContain('range=6M');
    });
  });

  it('AC-2.2: clicking 5D range button triggers fetch with range=5D', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderModal({ ticker: '^GSPC' });

    await waitFor(() => expect(screen.queryByTestId('modal-chart-skeleton')).not.toBeInTheDocument());

    fireEvent.click(screen.getByTestId('range-btn-5D'));

    await waitFor(() => {
      const lastCall = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
      expect(String(lastCall?.[0] ?? '')).toContain('range=5D');
    });
  });

  it('fetch URL includes the encoded ticker', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderModal({ ticker: '^GSPC' });

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled();
      const firstUrl = String(fetchMock.mock.calls[0]?.[0] ?? '');
      // ^GSPC is encoded as %5EGSPC
      expect(firstUrl).toContain('%5EGSPC');
    });
  });

  it('fetch includes AbortSignal for race-condition prevention (AC-E.2)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(MOCK_RESPONSE),
    });
    vi.stubGlobal('fetch', fetchMock);

    renderModal({ ticker: '^GSPC' });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());

    const firstCallOptions = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect(firstCallOptions?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('ChartModal — close interactions (AC-5.1, AC-5.2, AC-5.3)', () => {
  it('AC-5.2: clicking the close button fires onClose', () => {
    stubFetchPending();
    renderModal();
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('AC-5.1: pressing ESC key fires onClose', () => {
    stubFetchPending();
    renderModal();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('AC-5.1: pressing other keys does NOT fire onClose', () => {
    stubFetchPending();
    renderModal();
    fireEvent.keyDown(document, { key: 'Enter' });
    fireEvent.keyDown(document, { key: 'Tab' });
    fireEvent.keyDown(document, { key: 'ArrowLeft' });
    expect(mockClose).not.toHaveBeenCalled();
  });

  it('AC-5.3: clicking the backdrop overlay fires onClose', () => {
    stubFetchPending();
    renderModal();
    const backdrop = screen.getByTestId('chart-modal');
    fireEvent.click(backdrop);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('AC-5.3: clicking the inner panel does NOT fire onClose (stopPropagation)', () => {
    stubFetchPending();
    const { container } = renderModal();
    // Inner panel has role="presentation"
    const panel = container.querySelector('[role="presentation"]') as HTMLElement;
    expect(panel).not.toBeNull();
    fireEvent.click(panel);
    expect(mockClose).not.toHaveBeenCalled();
  });
});

describe('ChartModal — successful data render (AC-2.3, AC-2.8)', () => {
  it('shows changePct badge after data loads', async () => {
    stubFetchSuccess();
    renderModal();
    await waitFor(() =>
      expect(screen.queryByTestId('modal-chart-skeleton')).not.toBeInTheDocument(),
    );
    // changePct badge: +3.57% should appear
    expect(screen.getByText(/\+3\.57%/)).toBeInTheDocument();
  });

  it('AC-2.3: clicking a range button changes the active style to that range', async () => {
    stubFetchSuccess();
    renderModal();

    await waitFor(() =>
      expect(screen.queryByTestId('modal-chart-skeleton')).not.toBeInTheDocument(),
    );

    const btn6M = screen.getByTestId('range-btn-6M');
    const btn1M = screen.getByTestId('range-btn-1M');

    // Initial: 1M is active
    expect(btn1M.style.border).toContain('var(--accent)');

    // Click 6M
    fireEvent.click(btn6M);

    // Now 6M should have accent border; 1M should not
    await waitFor(() => expect(btn6M.style.border).toContain('var(--accent)'));
    expect(btn1M.style.border).not.toContain('var(--accent)');
  });

  it('modal-chart-container is in the DOM', async () => {
    stubFetchSuccess();
    renderModal();
    await waitFor(() =>
      expect(screen.queryByTestId('modal-chart-skeleton')).not.toBeInTheDocument(),
    );
    expect(screen.getByTestId('modal-chart-container')).toBeInTheDocument();
  });
});

describe('ChartModal — crosshair/tooltip branches (lines 138-171, 177-178)', () => {
  /**
   * These tests invoke the subscribeCrosshairMove callback directly via the
   * lightweight-charts mock to cover the tooltip positioning branches that are
   * otherwise unreachable from the outside.
   */

  async function loadAndGetCrosshairCallback() {
    const lc = await import('lightweight-charts');
    const { createChart } = vi.mocked(lc);

    stubFetchSuccess();
    renderModal({ ticker: '^GSPC', label: 'S&P 500' });

    // Wait for data to load and chart effect to run
    await waitFor(() => expect(createChart).toHaveBeenCalled());

    const chartInstance = createChart.mock.results[0]?.value as {
      subscribeCrosshairMove: ReturnType<typeof vi.fn>;
      addSeries: ReturnType<typeof vi.fn>;
    };

    // Get the series mock so we can build a valid seriesData Map
    const seriesMock = chartInstance.addSeries.mock.results[0]?.value;

    // Get the crosshair callback (first call, first argument)
    const callback = chartInstance.subscribeCrosshairMove.mock.calls[0]?.[0] as
      | ((param: unknown) => void)
      | undefined;

    return { callback, seriesMock };
  }

  it('hides tooltip when param has no point (branch: missing point)', async () => {
    const { callback } = await loadAndGetCrosshairCallback();
    const tooltip = screen.getByTestId('chart-tooltip');
    tooltip.style.display = 'block'; // pretend it was visible
    callback?.({ point: null, time: '2026-02-24', seriesData: new Map() });
    expect(tooltip.style.display).toBe('none');
  });

  it('hides tooltip when param has no time (branch: missing time)', async () => {
    const { callback, seriesMock } = await loadAndGetCrosshairCallback();
    const tooltip = screen.getByTestId('chart-tooltip');
    tooltip.style.display = 'block';
    const seriesData = new Map([[seriesMock, { value: 5800 }]]);
    callback?.({ point: { x: 50, y: 50 }, time: null, seriesData });
    expect(tooltip.style.display).toBe('none');
  });

  it('hides tooltip when seriesData has no entry for the series (branch: no seriesData)', async () => {
    const { callback } = await loadAndGetCrosshairCallback();
    const tooltip = screen.getByTestId('chart-tooltip');
    tooltip.style.display = 'block';
    callback?.({ point: { x: 50, y: 50 }, time: '2026-02-24', seriesData: new Map() });
    expect(tooltip.style.display).toBe('none');
  });

  it('shows tooltip and sets display:block when all params are valid (main path)', async () => {
    const { callback, seriesMock } = await loadAndGetCrosshairCallback();
    const seriesData = new Map([[seriesMock, { value: 5800 }]]);
    callback?.({
      point: { x: 50, y: 50 },
      time: '2026-02-24',
      seriesData,
    });
    const tooltip = screen.getByTestId('chart-tooltip');
    expect(tooltip.style.display).toBe('block');
  });

  it('handles numeric (non-string) time value (branch: typeof time !== string)', async () => {
    const { callback, seriesMock } = await loadAndGetCrosshairCallback();
    const seriesData = new Map([[seriesMock, { value: 5800 }]]);
    // Pass a numeric timestamp instead of string
    callback?.({ point: { x: 50, y: 50 }, time: 1740355200, seriesData });
    const tooltip = screen.getByTestId('chart-tooltip');
    expect(tooltip.style.display).toBe('block');
  });

  it('handles intraday time string (length > 10) without appending T00:00:00', async () => {
    const { callback, seriesMock } = await loadAndGetCrosshairCallback();
    const seriesData = new Map([[seriesMock, { value: 5800 }]]);
    callback?.({
      point: { x: 50, y: 50 },
      time: '2026-02-24T14:30:00',
      seriesData,
    });
    const tooltip = screen.getByTestId('chart-tooltip');
    expect(tooltip.style.display).toBe('block');
  });
});
