/**
 * Tests for: app/components/charts/MarketChartsWidget.tsx
 *
 * Branch coverage targets:
 * - handleTileClick: opens modal with correct config
 * - handleModalClose: sets openConfig to null; focus returned to tile
 * - {openConfig && <ChartModal>}: conditional render branch (true + false)
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MarketChartsWidget from '@/app/components/charts/MarketChartsWidget';

// ─── Mocks ───────────────────────────────────────────────────────────────────

// Mock ChartModal so we don't pull in lightweight-charts
vi.mock('@/app/components/charts/ChartModal', () => ({
  default: ({ ticker, label, onClose }: { ticker: string; label: string; onClose: () => void }) => (
    <div data-testid="chart-modal" data-ticker={ticker} data-label={label}>
      <button data-testid="modal-close-btn" onClick={onClose}>Close</button>
    </div>
  ),
}));

// Mock MarketChart to a simple button so we can click it
vi.mock('@/app/components/charts/MarketChart', () => ({
  default: ({
    ticker,
    label,
    onClick,
  }: {
    ticker: string;
    label: string;
    onClick?: () => void;
  }) => (
    <div
      data-testid={`ticker-tile-${ticker}`}
      data-label={label}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
    >
      {label}
    </div>
  ),
}));

// Mock FearGreedWidget — it makes network calls we don't need here
vi.mock('@/app/components/charts/FearGreedWidget', () => ({
  default: () => <div data-testid="fear-greed-widget" />,
}));

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('MarketChartsWidget — layout', () => {
  it('renders the market-charts-grid container', () => {
    render(<MarketChartsWidget />);
    expect(screen.getByTestId('market-charts-grid')).toBeInTheDocument();
  });

  it('renders all 7 chart tiles', () => {
    render(<MarketChartsWidget />);
    const tickers = ['^GSPC', '^VIX', 'DX-Y.NYB', '^TNX', 'DGS2', 'CL=F', 'BZ=F'];
    for (const ticker of tickers) {
      expect(screen.getByTestId(`ticker-tile-${ticker}`)).toBeInTheDocument();
    }
  });

  it('renders the FearGreedWidget', () => {
    render(<MarketChartsWidget />);
    expect(screen.getByTestId('fear-greed-widget')).toBeInTheDocument();
  });

  it('does NOT render ChartModal on initial load (openConfig is null)', () => {
    render(<MarketChartsWidget />);
    expect(screen.queryByTestId('chart-modal')).not.toBeInTheDocument();
  });
});

describe('MarketChartsWidget — modal open/close (branch coverage)', () => {
  it('clicking a tile opens ChartModal with the correct ticker', () => {
    render(<MarketChartsWidget />);
    fireEvent.click(screen.getByTestId('ticker-tile-^GSPC'));
    const modal = screen.getByTestId('chart-modal');
    expect(modal).toBeInTheDocument();
    expect(modal.getAttribute('data-ticker')).toBe('^GSPC');
  });

  it('clicking a tile opens ChartModal with the correct label', () => {
    render(<MarketChartsWidget />);
    fireEvent.click(screen.getByTestId('ticker-tile-^GSPC'));
    expect(screen.getByTestId('chart-modal').getAttribute('data-label')).toBe('S&P 500');
  });

  it('clicking close button dismisses the modal (openConfig → null branch)', () => {
    render(<MarketChartsWidget />);
    fireEvent.click(screen.getByTestId('ticker-tile-^GSPC'));
    expect(screen.getByTestId('chart-modal')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    expect(screen.queryByTestId('chart-modal')).not.toBeInTheDocument();
  });

  it('after close, focus returns to the originating tile (AC-5.4)', async () => {
    vi.useFakeTimers();
    render(<MarketChartsWidget />);
    const tile = screen.getByTestId('ticker-tile-^GSPC');
    const focusSpy = vi.spyOn(tile, 'focus');
    fireEvent.click(tile);
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    vi.runAllTimers();
    vi.useRealTimers();
    expect(focusSpy).toHaveBeenCalledTimes(1);
  });

  it('clicking a different tile replaces the open modal with the new ticker', () => {
    render(<MarketChartsWidget />);
    fireEvent.click(screen.getByTestId('ticker-tile-^GSPC'));
    expect(screen.getByTestId('chart-modal').getAttribute('data-ticker')).toBe('^GSPC');
    // Close and open a different one
    fireEvent.click(screen.getByTestId('modal-close-btn'));
    fireEvent.click(screen.getByTestId('ticker-tile-DGS2'));
    expect(screen.getByTestId('chart-modal').getAttribute('data-ticker')).toBe('DGS2');
  });

  it('modal label matches the clicked tile for VIX', () => {
    render(<MarketChartsWidget />);
    fireEvent.click(screen.getByTestId('ticker-tile-^VIX'));
    expect(screen.getByTestId('chart-modal').getAttribute('data-label')).toBe('VIX');
  });

  it('modal label matches the clicked tile for WTI oil', () => {
    render(<MarketChartsWidget />);
    fireEvent.click(screen.getByTestId('ticker-tile-CL=F'));
    expect(screen.getByTestId('chart-modal').getAttribute('data-label')).toBe('WTI');
  });
});
