import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ReportSection from '@/app/components/reports/ReportSection';

const ICON = <svg data-testid="test-icon" />;

describe('ReportSection', () => {
  it('renders the section title', () => {
    render(<ReportSection title="Equities" icon={ICON} content="Some equity analysis." />);
    expect(screen.getByText('Equities')).toBeInTheDocument();
  });

  it('renders the icon', () => {
    render(<ReportSection title="Equities" icon={ICON} content="Content" />);
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders content as a paragraph', () => {
    render(<ReportSection title="T" icon={ICON} content="Single paragraph content." />);
    expect(screen.getByText('Single paragraph content.')).toBeInTheDocument();
  });

  it('splits double newlines into separate paragraphs', () => {
    const content = 'First paragraph.\n\nSecond paragraph.\n\nThird paragraph.';
    render(<ReportSection title="T" icon={ICON} content={content} />);
    expect(screen.getByText('First paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Second paragraph.')).toBeInTheDocument();
    expect(screen.getByText('Third paragraph.')).toBeInTheDocument();
  });

  it('renders correct number of <p> elements for multi-paragraph content', () => {
    const content = 'Para one.\n\nPara two.\n\nPara three.';
    const { container } = render(<ReportSection title="T" icon={ICON} content={content} />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(3);
  });

  it('renders a single <p> for single-paragraph content', () => {
    const { container } = render(<ReportSection title="T" icon={ICON} content="Just one para." />);
    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs).toHaveLength(1);
  });

  it('title is inside an h3 element', () => {
    render(<ReportSection title="Fixed Income" icon={ICON} content="Content" />);
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Fixed Income');
  });

  it('handles content with triple newlines (collapses to separate paragraphs)', () => {
    const content = 'First.\n\n\nSecond.';
    render(<ReportSection title="T" icon={ICON} content={content} />);
    expect(screen.getByText('First.')).toBeInTheDocument();
    expect(screen.getByText('Second.')).toBeInTheDocument();
  });

  it('handles empty content without crashing', () => {
    const { container } = render(<ReportSection title="T" icon={ICON} content="" />);
    expect(container).toBeTruthy();
  });
});
