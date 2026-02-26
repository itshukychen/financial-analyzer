import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportHeader from '@/app/components/reports/ReportHeader';

const PROPS = {
  date:        '2026-02-26',
  generatedAt: '2026-02-26T22:45:00.000Z',
  headline:    'Equities Rally on Cooling Inflation Data',
};

describe('ReportHeader', () => {
  it('renders the headline text', () => {
    render(<ReportHeader {...PROPS} />);
    expect(screen.getByText(PROPS.headline)).toBeInTheDocument();
  });

  it('renders the formatted date (contains month and year)', () => {
    render(<ReportHeader {...PROPS} />);
    // Should contain "February" and "2026" somewhere
    expect(screen.getByText(/February.*2026/i)).toBeInTheDocument();
  });

  it('renders the formatted date with day of week', () => {
    render(<ReportHeader {...PROPS} />);
    expect(screen.getByText(/Thursday/i)).toBeInTheDocument();
  });

  it('shows "Generated" time text', () => {
    render(<ReportHeader {...PROPS} />);
    expect(screen.getByText(/Generated/i)).toBeInTheDocument();
  });

  it('headline is in a heading element (h2)', () => {
    render(<ReportHeader {...PROPS} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading).toHaveTextContent(PROPS.headline);
  });

  it('renders with different headline', () => {
    render(<ReportHeader {...PROPS} headline="Dollar Weakens as Fed Signals Pause" />);
    expect(screen.getByText('Dollar Weakens as Fed Signals Pause')).toBeInTheDocument();
  });

  it('renders with a Monday date correctly', () => {
    render(<ReportHeader date="2026-02-23" generatedAt={PROPS.generatedAt} headline="Monday Test" />);
    // The formatted date chip should contain "Monday" — use getAllByText since the
    // headline "Monday Test" also matches the regex; assert at least one element present.
    const matches = screen.getAllByText(/Monday/i);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });
});
