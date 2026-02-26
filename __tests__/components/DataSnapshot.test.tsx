import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import DataSnapshot from '@/app/components/reports/DataSnapshot';

const MARKET_DATA = {
  spx: {
    current:   5800,
    changePct: 3.57,
    points:    [{ time: '2026-02-17', value: 5600 }, { time: '2026-02-26', value: 5800 }],
  },
  vix: {
    current:   14,
    changePct: -30,
    points:    [{ time: '2026-02-17', value: 20 }, { time: '2026-02-26', value: 14 }],
  },
  dxy: {
    current:   107,
    changePct: 2.88,
    points:    [{ time: '2026-02-17', value: 104 }, { time: '2026-02-26', value: 107 }],
  },
  yield10y: {
    current:   4.5,
    changePct: 7.14,
    points:    [{ time: '2026-02-17', value: 4.2 }, { time: '2026-02-26', value: 4.5 }],
  },
  yield2y: {
    current:   4.1,
    changePct: 7.89,
    points:    [{ time: '2026-02-17', value: 3.8 }, { time: '2026-02-26', value: 4.1 }],
  },
};

describe('DataSnapshot', () => {
  it('renders all 5 stat card labels', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    expect(screen.getByText('S&P 500')).toBeInTheDocument();
    expect(screen.getByText('VIX')).toBeInTheDocument();
    expect(screen.getByText('US Dollar (DXY)')).toBeInTheDocument();
    expect(screen.getByText('10Y Yield')).toBeInTheDocument();
    expect(screen.getByText('2Y Yield')).toBeInTheDocument();
  });

  it('renders SPX current value formatted correctly', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    expect(screen.getByText('5,800.00')).toBeInTheDocument();
  });

  it('renders VIX current value', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    expect(screen.getByText('14.00')).toBeInTheDocument();
  });

  it('renders DXY current value', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    expect(screen.getByText('107.00')).toBeInTheDocument();
  });

  it('renders 10Y yield with % sign', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    expect(screen.getByText('4.50%')).toBeInTheDocument();
  });

  it('renders 2Y yield with % sign', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    expect(screen.getByText('4.10%')).toBeInTheDocument();
  });

  it('renders delta values for each instrument', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    expect(screen.getByText('+3.57%')).toBeInTheDocument();
    expect(screen.getByText('-30.00%')).toBeInTheDocument();
    expect(screen.getByText('+2.88%')).toBeInTheDocument();
    expect(screen.getByText('+7.14%')).toBeInTheDocument();
    expect(screen.getByText('+7.89%')).toBeInTheDocument();
  });

  it('renders exactly 5 stat cards', () => {
    const { container } = render(<DataSnapshot marketData={MARKET_DATA} />);
    // Each StatCard has data-testid via the grid — count label elements
    const labels = ['S&P 500', 'VIX', 'US Dollar (DXY)', '10Y Yield', '2Y Yield'];
    for (const label of labels) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(container.querySelectorAll('.rounded-lg').length).toBe(5);
  });

  it('SPX positive change renders with up direction (green)', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    const delta = screen.getByText('+3.57%');
    expect(delta).toHaveStyle({ color: 'var(--gain)' });
  });

  it('VIX negative change renders with up direction (inverted: falling VIX = good)', () => {
    render(<DataSnapshot marketData={MARKET_DATA} />);
    // VIX fell -30%, but since VIX is inverted, direction should be 'up' (good)
    const delta = screen.getByText('-30.00%');
    expect(delta).toHaveStyle({ color: 'var(--gain)' });
  });
});
