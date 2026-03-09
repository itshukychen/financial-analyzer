/**
 * Tests for: app/components/charts/MarketChart.tsx
 *
 * AC Coverage:
 * AC-6.1 → 'tile has cursor:pointer when onClick passed'
 * AC-6.2 → 'tile border changes to accent on hover when onClick present'
 * TASK-03 → 'click fires onClick callback'
 * TASK-03 → 'tile has tabIndex=0 when onClick passed'
 * TASK-03 → 'tile does NOT have tabIndex without onClick'
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import MarketChart from '@/app/components/charts/MarketChart';

// Prevent real network calls on mount
function stubFetchSuccess() {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          symbol: '^GSPC',
          name: 'S&P 500',
          points: [
            { time: '2026-02-24', value: 5720 },
            { time: '2026-02-25', value: 5800 },
          ],
          current: 5800,
          open: 5720,
          change: 80,
          changePct: 1.4,
        }),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('MarketChart — onClick affordance (AC-6.1, AC-6.2, TASK-03)', () => {
  it('tile has cursor:pointer when onClick prop is passed', () => {
    stubFetchSuccess();
    const { getByTestId } = render(
      <MarketChart ticker="^GSPC" label="S&P 500" onClick={vi.fn()} />,
    );
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.style.cursor).toBe('pointer');
  });

  it('tile has cursor:default when onClick prop is NOT passed', () => {
    stubFetchSuccess();
    const { getByTestId } = render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.style.cursor).toBe('default');
  });

  it('click fires the onClick callback exactly once', () => {
    stubFetchSuccess();
    const handleClick = vi.fn();
    const { getByTestId } = render(
      <MarketChart ticker="^GSPC" label="S&P 500" onClick={handleClick} />,
    );
    fireEvent.click(getByTestId('ticker-tile-^GSPC'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('tile has tabIndex=0 when onClick prop is passed', () => {
    stubFetchSuccess();
    const { getByTestId } = render(
      <MarketChart ticker="^GSPC" label="S&P 500" onClick={vi.fn()} />,
    );
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.getAttribute('tabindex')).toBe('0');
  });

  it('tile does NOT have tabIndex when onClick prop is absent', () => {
    stubFetchSuccess();
    const { getByTestId } = render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.getAttribute('tabindex')).toBeNull();
  });

  it('tile has role="button" when onClick prop is passed', () => {
    stubFetchSuccess();
    const { getByTestId } = render(
      <MarketChart ticker="^GSPC" label="S&P 500" onClick={vi.fn()} />,
    );
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.getAttribute('role')).toBe('button');
  });

  it('tile does NOT have role="button" when onClick prop is absent', () => {
    stubFetchSuccess();
    const { getByTestId } = render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.getAttribute('role')).toBeNull();
  });

  it('tile has correct aria-label when onClick prop is passed', () => {
    stubFetchSuccess();
    const { getByTestId } = render(
      <MarketChart ticker="^GSPC" label="S&P 500" onClick={vi.fn()} />,
    );
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.getAttribute('aria-label')).toBe('S&P 500 chart, click to expand');
  });

  it('tile border changes to accent on mouse enter when onClick present', () => {
    stubFetchSuccess();
    const { getByTestId } = render(
      <MarketChart ticker="^GSPC" label="S&P 500" onClick={vi.fn()} />,
    );
    const tile = getByTestId('ticker-tile-^GSPC');

    // Initial border: var(--border)
    expect(tile.style.border).toContain('var(--border)');

    // After hover: border should use var(--accent)
    fireEvent.mouseEnter(tile);
    expect(tile.style.border).toContain('var(--accent)');

    // After mouse leave: back to var(--border)
    fireEvent.mouseLeave(tile);
    expect(tile.style.border).toContain('var(--border)');
  });

  it('tile border does NOT change on hover when onClick is absent', () => {
    stubFetchSuccess();
    const { getByTestId } = render(<MarketChart ticker="^GSPC" label="S&P 500" />);
    const tile = getByTestId('ticker-tile-^GSPC');

    fireEvent.mouseEnter(tile);
    // Should still use var(--border), not var(--accent)
    expect(tile.style.border).toContain('var(--border)');
    expect(tile.style.border).not.toContain('var(--accent)');
  });

  it('tile has transition style for smooth border animation', () => {
    stubFetchSuccess();
    const { getByTestId } = render(
      <MarketChart ticker="^GSPC" label="S&P 500" onClick={vi.fn()} />,
    );
    const tile = getByTestId('ticker-tile-^GSPC');
    expect(tile.style.transition).toContain('border-color');
  });
});
