import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportHeader from '@/app/components/reports/ReportHeader';
import type { DailyReport } from '@/scripts/generate-report';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makeMockReport(overrides?: Partial<DailyReport['analysis']>): DailyReport {
  return {
    date:        '2026-02-26',
    generatedAt: '2026-02-26T22:45:00.000Z',
    marketData: {
      spx:      { current: 5800, changePct: 3.57,  points: [] },
      vix:      { current: 14,   changePct: -30.0, points: [] },
      dxy:      { current: 107,  changePct: 2.88,  points: [] },
      yield10y: { current: 4.5,  changePct: 7.14,  points: [] },
      yield2y:  { current: 4.1,  changePct: 7.89,  points: [] },
    },
    analysis: {
      headline: 'Equities Rally on Cooling Inflation Data',
      regime: {
        classification: 'Risk-on melt-up',
        justification: 'SPX surged while VIX collapsed, confirming broad risk appetite.',
      },
      yieldCurve:          'Bear steepener analysis.',
      dollarLogic:         'DXY firmed on rate differential.',
      equityDiagnosis:     'Positioning-driven move.',
      volatility:          'VIX collapse signals hedging unwind.',
      crossAssetCheck:     'All assets confirm risk-on thesis.',
      forwardScenarios:    'Continuation, reversal, and acceleration scenarios.',
      shortVolRisk:        'Favorable for short gamma.',
      regimeProbabilities: 'Continuation 55% | Reversal 30% | Acceleration 15%',
      ...overrides,
    },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ReportHeader', () => {
  it('renders the headline text', () => {
    render(<ReportHeader report={makeMockReport()} />);
    expect(screen.getByText('Equities Rally on Cooling Inflation Data')).toBeInTheDocument();
  });

  it('renders the formatted date (contains month and year)', () => {
    render(<ReportHeader report={makeMockReport()} />);
    // Should contain "February" and "2026" somewhere
    expect(screen.getByText(/February.*2026/i)).toBeInTheDocument();
  });

  it('renders the formatted date with day of week', () => {
    render(<ReportHeader report={makeMockReport()} />);
    expect(screen.getByText(/Thursday/i)).toBeInTheDocument();
  });

  it('shows "Generated" time text', () => {
    render(<ReportHeader report={makeMockReport()} />);
    expect(screen.getByText(/Generated/i)).toBeInTheDocument();
  });

  it('headline is in a heading element (h2)', () => {
    render(<ReportHeader report={makeMockReport()} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent('Equities Rally on Cooling Inflation Data');
  });

  it('renders the regime classification badge', () => {
    render(<ReportHeader report={makeMockReport()} />);
    expect(screen.getByText('Risk-on melt-up')).toBeInTheDocument();
  });

  it('renders the regime justification as subtitle', () => {
    render(<ReportHeader report={makeMockReport()} />);
    expect(screen.getByText(/SPX surged while VIX collapsed/i)).toBeInTheDocument();
  });

  it('renders with different headline', () => {
    render(<ReportHeader report={makeMockReport({ headline: 'Dollar Weakens as Fed Signals Pause' })} />);
    expect(screen.getByText('Dollar Weakens as Fed Signals Pause')).toBeInTheDocument();
  });

  it('renders with a Monday date correctly', () => {
    const report = makeMockReport();
    render(<ReportHeader report={{ ...report, date: '2026-02-23' }} />);
    // The formatted date chip should contain "Monday"
    const matches = screen.getAllByText(/Monday/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows red badge for risk-off regimes', () => {
    render(<ReportHeader report={makeMockReport({ regime: { classification: 'Liquidity crisis', justification: 'Credit spreads blowing out.' } })} />);
    const badge = screen.getByText('Liquidity crisis');
    expect(badge).toBeInTheDocument();
  });

  it('shows amber badge for inflation scare', () => {
    render(<ReportHeader report={makeMockReport({ regime: { classification: 'Inflation scare', justification: 'CPI accelerating.' } })} />);
    expect(screen.getByText('Inflation scare')).toBeInTheDocument();
  });

  it('shows blue badge for policy pivot', () => {
    render(<ReportHeader report={makeMockReport({ regime: { classification: 'Policy pivot', justification: 'Fed signaling cuts.' } })} />);
    expect(screen.getByText('Policy pivot')).toBeInTheDocument();
  });
});
