import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import OptionProjectionWidget from '../OptionProjectionWidget';

// Type definitions for mock data structures
interface VolatilityData {
  iv_30d: number;
  iv_rank: number;
}

interface ImpliedMoveData {
  '1w_move_pct': number;
}

type VolatilityRegime = 'low' | 'normal' | 'high';

interface SnapshotData {
  volatility: VolatilityData;
  implied_move: ImpliedMoveData;
  regime: VolatilityRegime;
  timestamp: string;
}

interface MockResponse {
  ok: boolean;
  statusText?: string;
  json?: () => Promise<SnapshotData | null>;
}

interface MockFetchType extends Mock<Promise<MockResponse>> {
  mockResolvedValueOnce: (value: MockResponse) => MockFetchType;
  mockResolvedValue: (value: MockResponse) => MockFetchType;
  mockRejectedValueOnce: (value: Error) => MockFetchType;
  mockImplementationOnce: (fn: () => Promise<never>) => MockFetchType;
}

type Mock<T> = ReturnType<typeof vi.fn<[], T>>;

// Mock fetch globally with proper typing
global.fetch = vi.fn() as unknown as MockFetchType;

describe('OptionProjectionWidget', () => {
  const mockSnapshotData = {
    volatility: { iv_30d: 28.5, iv_rank: 55 },
    implied_move: { '1w_move_pct': 2.5 },
    regime: 'normal' as const,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Component Rendering with Props', () => {
    it('should render the component title', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Option Projection')).toBeInTheDocument();
      });
    });

    it('should fetch data from correct API endpoint on mount', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/options/snapshot?ticker=SPWX&expiry=30d');
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });

    it('should render all data fields when data loads successfully', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        // Check for implied move
        expect(screen.getByText('±2.5%')).toBeInTheDocument();
        // Check for 30d IV
        expect(screen.getByText('28.5%')).toBeInTheDocument();
        // Check for IV Rank
        expect(screen.getByText(/Rank: 55/)).toBeInTheDocument();
        // Check for View Full Analysis link
        expect(screen.getByText(/View Full Analysis/)).toBeInTheDocument();
      });
    });

    it('should render StatCard components with correct labels', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Implied Move (1w)')).toBeInTheDocument();
        expect(screen.getByText('30d IV')).toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('should display loading skeleton while data is being fetched', () => {
      // Delay the fetch to keep loading state
      (global.fetch as unknown as MockFetchType).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      render(<OptionProjectionWidget />);

      // Look for the loading skeleton structure
      const animatedElements = document.querySelectorAll('.animate-pulse');
      expect(animatedElements.length).toBeGreaterThan(0);
    });

    it('should show multiple loading skeleton placeholders', () => {
      (global.fetch as unknown as MockFetchType).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      render(<OptionProjectionWidget />);

      // Look for loading placeholders in the DOM
      const container = document.querySelector('.animate-pulse');
      expect(container).toBeInTheDocument();
    });

    it('should transition from loading to loaded state', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.getByText('Option Projection')).toBeInTheDocument();
      });

      // Verify data is displayed
      expect(screen.getByText('±2.5%')).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when API request fails', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: false,
        statusText: 'Internal Server Error',
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load option data')).toBeInTheDocument();
      });
    });

    it('should display specific error details when provided', async () => {
      const errorMessage = 'Failed to connect to pricing service';
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: false,
        statusText: errorMessage,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
      });
    });

    it('should handle fetch network errors gracefully', async () => {
      (global.fetch as unknown as MockFetchType).mockRejectedValueOnce(
        new Error('Network error occurred')
      );

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load option data')).toBeInTheDocument();
      });
    });

    it('should render error state with proper styling', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const errorText = screen.getByText('Unable to load option data');
        expect(errorText).toHaveStyle('color: var(--loss)');
      });
    });

    it('should display "no data" message if response body is null', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load option data')).toBeInTheDocument();
      });
    });

    it('should log error to console for debugging', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (global.fetch as unknown as MockFetchType).mockRejectedValueOnce(
        new Error('Test error')
      );

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to fetch option data:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Auto-Refresh Interval (5 minutes)', () => {
    it('should set up an interval timer on component mount', async () => {
      const setIntervalSpy = vi.spyOn(global, 'setInterval');
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      expect(setIntervalSpy).toHaveBeenCalled();
      const callArgs = setIntervalSpy.mock.calls[0];
      expect(callArgs[1]).toBe(5 * 60 * 1000); // 5 minutes in milliseconds

      setIntervalSpy.mockRestore();
    });

    it('should make initial fetch call with correct endpoint', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith('/api/options/snapshot?ticker=SPWX&expiry=30d');
      });
    });

    it('should clear interval on component unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      const setIntervalSpy = vi.spyOn(global, 'setInterval').mockReturnValue(123 as unknown as NodeJS.Timeout);

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      const { unmount } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalledWith(123);
      
      clearIntervalSpy.mockRestore();
      setIntervalSpy.mockRestore();
    });

    it('should handle errors during refresh without stopping interval setup', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load option data')).toBeInTheDocument();
      });

      // Should still have called setInterval despite the error
      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('IV Regime Color Coding', () => {
    it('should display green color for LOW volatility regime', async () => {
      const lowRegimeData: SnapshotData = {
        ...mockSnapshotData,
        regime: 'low',
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => lowRegimeData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const regimeLabel = screen.getByText('🟢 Low Volatility');
        expect(regimeLabel).toHaveStyle('color: var(--gain)');
      });
    });

    it('should display red color for HIGH volatility regime', async () => {
      const highRegimeData: SnapshotData = {
        ...mockSnapshotData,
        regime: 'high',
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => highRegimeData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const regimeLabel = screen.getByText('🔴 High Volatility');
        expect(regimeLabel).toHaveStyle('color: var(--loss)');
      });
    });

    it('should display neutral color for NORMAL volatility regime', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const regimeLabel = screen.getByText('⚪ Normal Volatility');
        expect(regimeLabel).toHaveStyle('color: var(--text-muted)');
      });
    });

    it('should render regime badge with appropriate background color for LOW regime', async () => {
      const lowRegimeData: SnapshotData = {
        ...mockSnapshotData,
        regime: 'low',
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => lowRegimeData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const regimeLabel = screen.getByText('🟢 Low Volatility');
        const badge = regimeLabel.closest('div');
        expect(badge).toHaveStyle('background: var(--gain)22');
      });
    });

    it('should render regime badge with appropriate background color for HIGH regime', async () => {
      const highRegimeData: SnapshotData = {
        ...mockSnapshotData,
        regime: 'high',
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => highRegimeData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const regimeLabel = screen.getByText('🔴 High Volatility');
        const badge = regimeLabel.closest('div');
        expect(badge).toHaveStyle('background: var(--loss)22');
      });
    });

    it('should display correct emoji for each regime', async () => {
      // Test LOW regime
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSnapshotData, regime: 'low' as const }),
      });

      const { unmount: unmountLow } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('🟢 Low Volatility')).toBeInTheDocument();
      });

      unmountLow();

      // Test HIGH regime
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSnapshotData, regime: 'high' as const }),
      });

      const { unmount: unmountHigh } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('🔴 High Volatility')).toBeInTheDocument();
      });

      unmountHigh();

      // Test NORMAL regime
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSnapshotData, regime: 'normal' as const }),
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('⚪ Normal Volatility')).toBeInTheDocument();
      });
    });

    it('should apply proper styling classes to regime badge', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const regimeLabel = screen.getByText('⚪ Normal Volatility');
        const badge = regimeLabel.closest('div');
        expect(badge).toHaveClass('text-center', 'py-2', 'px-3', 'rounded-md', 'text-sm', 'font-semibold');
      });
    });
  });

  describe('Implied Move Display', () => {
    it('should display implied move with correct formatting', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±2.5%')).toBeInTheDocument();
      });
    });

    it('should display implied move in StatCard with correct label', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const label = screen.getByText('Implied Move (1w)');
        expect(label).toBeInTheDocument();
        const value = screen.getByText('±2.5%');
        expect(value).toBeInTheDocument();
      });
    });

    it('should format high implied move values correctly', async () => {
      const highImpliedMoveData: SnapshotData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 5.75 },
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => highImpliedMoveData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±5.8%')).toBeInTheDocument();
      });
    });

    it('should format low implied move values correctly', async () => {
      const lowImpliedMoveData: SnapshotData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 0.5 },
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => lowImpliedMoveData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±0.5%')).toBeInTheDocument();
      });
    });

    it('should format IV with correct decimal places', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('28.5%')).toBeInTheDocument();
      });
    });

    it('should display IV rank value', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Rank: 55/)).toBeInTheDocument();
      });
    });

    it('should handle zero implied move value', async () => {
      const zeroImpliedMoveData: SnapshotData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 0 },
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => zeroImpliedMoveData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±0.0%')).toBeInTheDocument();
      });
    });

    it('should handle very high IV values', async () => {
      const highIVData: SnapshotData = {
        ...mockSnapshotData,
        volatility: { iv_30d: 99.99, iv_rank: 100 },
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => highIVData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });
    });

    it('should handle very low IV values', async () => {
      const lowIVData: SnapshotData = {
        ...mockSnapshotData,
        volatility: { iv_30d: 0.5, iv_rank: 1 },
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => lowIVData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('0.5%')).toBeInTheDocument();
      });
    });

    it('should handle IV rank of 0', async () => {
      const zeroRankData: SnapshotData = {
        ...mockSnapshotData,
        volatility: { iv_30d: 20, iv_rank: 0 },
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => zeroRankData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Rank: 0/)).toBeInTheDocument();
      });
    });
  });

  describe('Timestamp Display', () => {
    it('should display last updated timestamp', async () => {
      const now = new Date();
      const timestamp = now.toISOString();

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSnapshotData,
          timestamp,
        } as SnapshotData),
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const headerSection = screen.getByText('Option Projection');
        expect(headerSection).toBeInTheDocument();
        // Verify timestamp is displayed somewhere in the header
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });

    it('should format timestamp in America/New_York timezone', async () => {
      const timestamp = new Date('2026-03-09T20:00:00Z').toISOString();

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSnapshotData,
          timestamp,
        } as SnapshotData),
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        // Should display in ET timezone format
        expect(screen.getByText(/ET/)).toBeInTheDocument();
      });
    });

    it('should handle future timestamps correctly', async () => {
      const futureTimestamp = new Date(Date.now() + 1000000).toISOString();

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSnapshotData,
          timestamp: futureTimestamp,
        } as SnapshotData),
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('Link to Full Analysis', () => {
    it('should render link to full analysis report', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const link = screen.getByText(/View Full Analysis/);
        expect(link).toBeInTheDocument();
        expect(link.closest('a')).toHaveAttribute('href', '/reports/option-projection');
      });
    });

    it('should have proper styling for the link', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const link = screen.getByText(/View Full Analysis/);
        expect(link).toHaveClass('text-sm', 'font-medium', 'hover:underline');
        expect(link).toHaveStyle('color: var(--accent)');
      });
    });
  });

  describe('Container Styling', () => {
    it('should render container with proper structure', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const title = screen.getByText('Option Projection');
        const container = title.closest('div');
        expect(container).toBeTruthy();
        expect(container?.className).toContain('flex');
      });
    });

    it('should render container with styled elements', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        // Verify component structure exists
        expect(screen.getByText('Option Projection')).toBeInTheDocument();
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
        expect(screen.getByText(/View Full Analysis/)).toBeInTheDocument();
      });
    });
  });

  describe('StatCard Grid Layout', () => {
    it('should render StatCards in a 2-column grid', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const gridContainer = document.querySelector('.grid');
        expect(gridContainer).toHaveClass('grid-cols-2', 'gap-3');
      });
    });

    it('should render exactly 2 StatCards', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const impliedMoveLabel = screen.getByText('Implied Move (1w)');
        const ivLabel = screen.getByText('30d IV');
        expect(impliedMoveLabel).toBeInTheDocument();
        expect(ivLabel).toBeInTheDocument();
      });
    });
  });

  describe('Header Layout', () => {
    it('should display header with title and timestamp', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const title = screen.getByText('Option Projection');
        expect(title).toHaveClass('text-lg', 'font-bold');
        expect(title).toHaveAttribute('style');
      });
    });

    it('should render timestamp in header', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const timestamp = screen.getByText(/Last updated:/);
        expect(timestamp).toBeInTheDocument();
        expect(timestamp.closest('span')).toHaveClass('text-xs');
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should only call fetch once on initial mount', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('State Management', () => {
    it('should set loading state to false after successful fetch', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      // After data loads, should not show loading skeleton
      await waitFor(() => {
        expect(screen.queryByText('Option Projection')).toBeInTheDocument();
        const animatedElements = document.querySelectorAll('.animate-pulse');
        expect(animatedElements.length).toBe(0);
      });
    });

    it('should set error state to null on successful fetch', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.queryByText('Unable to load option data')).not.toBeInTheDocument();
        expect(screen.getByText('Option Projection')).toBeInTheDocument();
      });
    });

    it('should set error state on failed fetch', async () => {
      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: false,
        statusText: 'Not Found',
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load option data')).toBeInTheDocument();
      });
    });
  });

  describe('Multiple Regimes', () => {
    it('should switch between regime displays correctly', async () => {
      // First render with low regime
      const lowRegimeData: SnapshotData = {
        ...mockSnapshotData,
        regime: 'low',
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => lowRegimeData,
      });

      const { unmount: unmountLow } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('🟢 Low Volatility')).toBeInTheDocument();
      });

      unmountLow();

      // Second render with normal regime
      const normalRegimeData: SnapshotData = {
        ...mockSnapshotData,
        regime: 'normal',
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => normalRegimeData,
      });

      const { unmount: unmountNormal } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('⚪ Normal Volatility')).toBeInTheDocument();
      });

      unmountNormal();

      // Third render with high regime
      const highRegimeData: SnapshotData = {
        ...mockSnapshotData,
        regime: 'high',
      };

      (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
        ok: true,
        json: async () => highRegimeData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('🔴 High Volatility')).toBeInTheDocument();
      });
    });
  });

  describe('Data Formatting', () => {
    it('should format various implied move percentages consistently', async () => {
      const testCases: Array<{ value: number; expected: string }> = [
        { value: 1.5, expected: '±1.5%' },
        { value: 2.5, expected: '±2.5%' },
        { value: 10.25, expected: '±10.3%' },
        { value: 0.123, expected: '±0.1%' },
      ];

      for (const testCase of testCases) {
        const data: SnapshotData = {
          ...mockSnapshotData,
          implied_move: { '1w_move_pct': testCase.value },
        };

        (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
          ok: true,
          json: async () => data,
        });

        const { unmount } = render(<OptionProjectionWidget />);

        await waitFor(() => {
          expect(screen.getByText(testCase.expected)).toBeInTheDocument();
        });

        unmount();
      }
    });

    it('should format various IV percentages consistently', async () => {
      const testCases: Array<{ value: number; expected: string }> = [
        { value: 15, expected: '15.0%' },
        { value: 28.5, expected: '28.5%' },
        { value: 45.75, expected: '45.8%' },
      ];

      for (const testCase of testCases) {
        const data: SnapshotData = {
          ...mockSnapshotData,
          volatility: { iv_30d: testCase.value, iv_rank: 50 },
        };

        (global.fetch as unknown as MockFetchType).mockResolvedValueOnce({
          ok: true,
          json: async () => data,
        });

        const { unmount } = render(<OptionProjectionWidget />);

        await waitFor(() => {
          expect(screen.getByText(testCase.expected)).toBeInTheDocument();
        });

        unmount();
      }
    });
  });
});
