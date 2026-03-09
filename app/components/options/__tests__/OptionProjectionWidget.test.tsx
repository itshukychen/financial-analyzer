import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import OptionProjectionWidget from '../OptionProjectionWidget';

// Mock fetch globally
global.fetch = vi.fn();

describe('OptionProjectionWidget', () => {
  const mockSnapshotData = {
    volatility: { iv_30d: 28.5, iv_rank: 55 },
    implied_move: { '1w_move_pct': 2.5 },
    regime: 'normal' as const,
    timestamp: new Date().toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Component Rendering with Props', () => {
    it('should render the component title', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Option Projection')).toBeInTheDocument();
      });
    });

    it('should fetch data from correct API endpoint on mount', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      render(<OptionProjectionWidget />);

      const container = screen.getByText(/Option Projection/).closest('div');
      const parent = container?.parentElement;

      // Check for loading indicators (animated pulse effect)
      expect(parent).toHaveClass('animate-pulse');
    });

    it('should show multiple loading skeleton placeholders', () => {
      (global.fetch as any).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      );

      render(<OptionProjectionWidget />);

      // Look for the loading skeleton structure
      const skeletons = document.querySelectorAll(
        '.rounded.bg-neutral-300, .rounded.bg-neutral-700'
      );
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should transition from loading to loaded state', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      const { rerender } = render(<OptionProjectionWidget />);

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
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: errorMessage,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(new RegExp(errorMessage))).toBeInTheDocument();
      });
    });

    it('should handle fetch network errors gracefully', async () => {
      (global.fetch as any).mockRejectedValueOnce(
        new Error('Network error occurred')
      );

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Unable to load option data')).toBeInTheDocument();
      });
    });

    it('should render error state with proper styling', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockRejectedValueOnce(
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
    it('should set up an interval to refresh data every 5 minutes', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      // Initial fetch on mount
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });
    });

    it('should refresh data after 5 minutes with correct API call', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Advance time by exactly 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
        expect(global.fetch).toHaveBeenLastCalledWith(
          '/api/options/snapshot?ticker=SPWX&expiry=30d'
        );
      });
    });

    it('should handle multiple refresh cycles', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // First refresh
      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Second refresh
      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      // Third refresh
      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(4);
      });
    });

    it('should clear interval on component unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      const { unmount } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should reset loading state on each refresh', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('Option Projection')).toBeInTheDocument();
      });

      // Trigger refresh
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Should still show data (no loading skeleton)
      await waitFor(() => {
        expect(screen.getByText('Option Projection')).toBeInTheDocument();
      });
    });

    it('should handle errors during refresh without stopping the interval', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // First call succeeds
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      });

      // Second call fails
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        statusText: 'Error',
      });

      vi.advanceTimersByTime(5 * 60 * 1000);

      // Error should be handled and interval continues
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(2);
      });

      // Third call succeeds again
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(3);
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('IV Regime Color Coding', () => {
    it('should display green color for LOW volatility regime', async () => {
      const lowRegimeData = {
        ...mockSnapshotData,
        regime: 'low' as const,
      };

      (global.fetch as any).mockResolvedValueOnce({
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
      const highRegimeData = {
        ...mockSnapshotData,
        regime: 'high' as const,
      };

      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
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
      const lowRegimeData = {
        ...mockSnapshotData,
        regime: 'low' as const,
      };

      (global.fetch as any).mockResolvedValueOnce({
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
      const highRegimeData = {
        ...mockSnapshotData,
        regime: 'high' as const,
      };

      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSnapshotData, regime: 'low' as const }),
      });

      const { unmount: unmountLow } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('🟢 Low Volatility')).toBeInTheDocument();
      });

      unmountLow();

      // Test HIGH regime
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSnapshotData, regime: 'high' as const }),
      });

      const { unmount: unmountHigh } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('🔴 High Volatility')).toBeInTheDocument();
      });

      unmountHigh();

      // Test NORMAL regime
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ...mockSnapshotData, regime: 'normal' as const }),
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('⚪ Normal Volatility')).toBeInTheDocument();
      });
    });

    it('should apply proper styling classes to regime badge', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±2.5%')).toBeInTheDocument();
      });
    });

    it('should display implied move in StatCard with correct label', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      const highImpliedMoveData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 5.75 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => highImpliedMoveData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±5.8%')).toBeInTheDocument();
      });
    });

    it('should format low implied move values correctly', async () => {
      const lowImpliedMoveData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 0.5 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => lowImpliedMoveData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±0.5%')).toBeInTheDocument();
      });
    });

    it('should format IV with correct decimal places', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('28.5%')).toBeInTheDocument();
      });
    });

    it('should display IV rank value', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Rank: 55/)).toBeInTheDocument();
      });
    });
  });

  describe('Timestamp Display', () => {
    it('should display last updated timestamp', async () => {
      const now = new Date();
      const timestamp = now.toISOString();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSnapshotData,
          timestamp,
        }),
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

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSnapshotData,
          timestamp,
        }),
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        // Should display in ET timezone format
        expect(screen.getByText(/ET/)).toBeInTheDocument();
      });
    });
  });

  describe('Link to Full Analysis', () => {
    it('should render link to full analysis report', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
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
    it('should apply correct styles to main container', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const container = screen.getByText('Option Projection').closest('div').parentElement;
        expect(container).toHaveStyle('background: var(--surface)');
        expect(container).toHaveStyle('borderColor: var(--border)');
      });
    });

    it('should apply border styling to container', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const container = screen.getByText('Option Projection').closest('div').parentElement;
        expect(container).toHaveClass('rounded-lg', 'border', 'p-6');
      });
    });

    it('should apply flex and gap classes for layout', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const container = screen.getByText('Option Projection').closest('div').parentElement;
        expect(container).toHaveClass('flex', 'flex-col', 'gap-4');
      });
    });
  });

  describe('StatCard Grid Layout', () => {
    it('should render StatCards in a 2-column grid', async () => {
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
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
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const title = screen.getByText('Option Projection');
        expect(title).toHaveClass('text-lg', 'font-bold');
        expect(title).toHaveStyle('color: var(--text-primary)');
      });
    });

    it('should render timestamp with muted color', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        const timestamp = screen.getByText(/Last updated:/);
        expect(timestamp.parentElement).toHaveStyle('color: var(--text-muted)');
      });
    });
  });

  describe('Data Mutation and Updates', () => {
    it('should update displayed data when new data is fetched on refresh', async () => {
      const initialData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 2.5 },
      };

      const updatedData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 3.5 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => initialData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±2.5%')).toBeInTheDocument();
      });

      // Update mock for second call
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => updatedData,
      });

      // Trigger refresh
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Should show updated data
      await waitFor(() => {
        expect(screen.queryByText('±2.5%')).not.toBeInTheDocument();
        expect(screen.getByText('±3.5%')).toBeInTheDocument();
      });
    });

    it('should handle regime changes on refresh', async () => {
      const lowRegimeData = {
        ...mockSnapshotData,
        regime: 'low' as const,
      };

      const highRegimeData = {
        ...mockSnapshotData,
        regime: 'high' as const,
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => lowRegimeData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('🟢 Low Volatility')).toBeInTheDocument();
      });

      // Update mock for refresh
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => highRegimeData,
      });

      vi.advanceTimersByTime(5 * 60 * 1000);

      await waitFor(() => {
        expect(screen.queryByText('🟢 Low Volatility')).not.toBeInTheDocument();
        expect(screen.getByText('🔴 High Volatility')).toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases and Boundary Conditions', () => {
    it('should handle zero implied move value', async () => {
      const zeroImpliedMoveData = {
        ...mockSnapshotData,
        implied_move: { '1w_move_pct': 0 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => zeroImpliedMoveData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('±0.0%')).toBeInTheDocument();
      });
    });

    it('should handle very high IV values', async () => {
      const highIVData = {
        ...mockSnapshotData,
        volatility: { iv_30d: 99.99, iv_rank: 100 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => highIVData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('100.0%')).toBeInTheDocument();
      });
    });

    it('should handle very low IV values', async () => {
      const lowIVData = {
        ...mockSnapshotData,
        volatility: { iv_30d: 0.5, iv_rank: 1 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => lowIVData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText('0.5%')).toBeInTheDocument();
      });
    });

    it('should handle IV rank of 0', async () => {
      const zeroRankData = {
        ...mockSnapshotData,
        volatility: { iv_30d: 20, iv_rank: 0 },
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => zeroRankData,
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Rank: 0/)).toBeInTheDocument();
      });
    });

    it('should handle future timestamps correctly', async () => {
      const futureTimestamp = new Date(Date.now() + 1000000).toISOString();

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ...mockSnapshotData,
          timestamp: futureTimestamp,
        }),
      });

      render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(screen.getByText(/Last updated:/)).toBeInTheDocument();
      });
    });
  });

  describe('Component Lifecycle', () => {
    it('should only call fetch once on initial mount', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      render(<OptionProjectionWidget />);

      // Wait a bit to ensure no additional calls
      await vi.waitFor(() => {
        expect(global.fetch).toHaveBeenCalledTimes(1);
      }, { timeout: 100 });
    });

    it('should clean up interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(global, 'clearInterval');

      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => mockSnapshotData,
      });

      const { unmount } = render(<OptionProjectionWidget />);

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
      clearIntervalSpy.mockRestore();
    });

    it('should not attempt to update state after unmount', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      (global.fetch as any).mockImplementationOnce(
        () => new Promise(resolve => {
          setTimeout(() => {
            resolve({
              ok: true,
              json: async () => mockSnapshotData,
            });
          }, 100);
        })
      );

      const { unmount } = render(<OptionProjectionWidget />);

      // Unmount before fetch completes
      unmount();

      // Advance timers to complete the fetch
      vi.advanceTimersByTime(200);

      // Should not have any state update warnings
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(
        expect.stringContaining('Cannot update a component while rendering')
      );

      consoleErrorSpy.mockRestore();
    });
  });
});
