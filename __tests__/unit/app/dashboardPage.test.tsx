/**
 * Tests for: app/page.tsx (DashboardPage)
 *
 * AC Coverage:
 * AC-1.1 → 'does not render Market Heatmap widget when no report exists'
 * AC-1.1 → 'does not render Market Heatmap widget when a report exists'
 * AC-1.2 → 'no PlaceholderWidget with label Market Heatmap is rendered'
 * AC-1.4 → 'PlaceholderWidget import is retained — used for Daily Market Report fallback'
 * AC-1.4 → 'PlaceholderWidget import is retained — used when db throws'
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  getLatestReport: vi.fn(),
  PERIOD_LABELS: { eod: 'End of Day', morning: 'Morning' },
}));

vi.mock('@/app/components/charts/MarketChartsWidget', () => ({
  default: () => <div data-testid="market-charts-widget-mock" />,
}));

vi.mock('@/app/components/PageHeader', () => ({
  default: ({ title, subtitle }: { title: string; subtitle: string }) => (
    <div data-testid="page-header-mock">
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </div>
  ),
}));

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_REPORT = {
  id: 1,
  date: '2026-02-26',
  period: 'eod',
  generated_at: 1_741_200_000,
  model: 'claude-sonnet-4-5',
  ticker_data: JSON.stringify({}),
  report_json: JSON.stringify({
    headline: 'Risk-on melt-up: SPX surges',
    regime: {
      classification: 'Risk-on melt-up',
      justification: 'SPX +3.57% while VIX collapsed 30%.',
    },
  }),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DashboardPage — Market Heatmap removal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('AC-1.1: does not render Market Heatmap widget when no report exists', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(null);

    const DashboardPage = (await import('@/app/page')).default;
    render(<DashboardPage />);

    expect(screen.queryByText('Market Heatmap')).not.toBeInTheDocument();
  });

  it('AC-1.1: does not render Market Heatmap widget when a seeded report exists', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(MOCK_REPORT as never);

    const DashboardPage = (await import('@/app/page')).default;
    render(<DashboardPage />);

    expect(screen.queryByText('Market Heatmap')).not.toBeInTheDocument();
  });

  it('AC-1.2: no PlaceholderWidget with label "Market Heatmap" is rendered', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(null);

    const DashboardPage = (await import('@/app/page')).default;
    const { container } = render(<DashboardPage />);

    // PlaceholderWidget renders its label as a <span> with text. Confirm absence.
    const spans = Array.from(container.querySelectorAll('span'));
    const heatmapLabel = spans.find((el) => el.textContent === 'Market Heatmap');
    expect(heatmapLabel).toBeUndefined();
  });

  it('AC-1.4: PlaceholderWidget import is retained — used for Daily Market Report fallback (no report)', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(null);

    const DashboardPage = (await import('@/app/page')).default;
    render(<DashboardPage />);

    // PlaceholderWidget renders with data-testid="placeholder-widget" when used as fallback
    expect(screen.getByTestId('placeholder-widget')).toBeInTheDocument();
    expect(screen.getByText('Daily Market Report')).toBeInTheDocument();
  });

  it('AC-1.4: PlaceholderWidget import is retained — used when db throws', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockImplementation(() => {
      throw new Error('DB unavailable');
    });

    const DashboardPage = (await import('@/app/page')).default;
    render(<DashboardPage />);

    // Error path still renders PlaceholderWidget for Daily Market Report, not Heatmap
    expect(screen.getByTestId('placeholder-widget')).toBeInTheDocument();
    expect(screen.queryByText('Market Heatmap')).not.toBeInTheDocument();
  });

  it('AC-1.3: MarketChartsWidget is rendered alongside the report area', async () => {
    const { getLatestReport } = await import('@/lib/db');
    vi.mocked(getLatestReport).mockReturnValue(null);

    const DashboardPage = (await import('@/app/page')).default;
    render(<DashboardPage />);

    // Both the charts area and report area must be present — no orphaned layout
    expect(screen.getByTestId('market-charts-widget-mock')).toBeInTheDocument();
    expect(screen.getByTestId('placeholder-widget')).toBeInTheDocument();
  });
});
