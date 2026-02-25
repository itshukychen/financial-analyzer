import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatCard from '@/app/components/StatCard';

describe('StatCard', () => {
  it('renders label text', () => {
    render(<StatCard label="Total Assets" value="$1,234.56" />);
    expect(screen.getByText('Total Assets')).toBeInTheDocument();
  });

  it('renders value text', () => {
    render(<StatCard label="Total Assets" value="$1,234.56" />);
    expect(screen.getByText('$1,234.56')).toBeInTheDocument();
  });

  it('delta is shown when provided', () => {
    render(<StatCard label="Label" value="100" delta="+5.00%" />);
    expect(screen.getByText('+5.00%')).toBeInTheDocument();
  });

  it('delta is hidden when not provided', () => {
    render(<StatCard label="Label" value="100" />);
    expect(screen.queryByText(/[+-]\d+\.\d+%/)).not.toBeInTheDocument();
  });

  it('deltaDirection="up" — delta has green color (var(--gain))', () => {
    render(<StatCard label="L" value="V" delta="+5%" deltaDirection="up" />);
    const delta = screen.getByText('+5%');
    expect(delta).toHaveStyle({ color: 'var(--gain)' });
  });

  it('deltaDirection="down" — delta has red color (var(--loss))', () => {
    render(<StatCard label="L" value="V" delta="-3%" deltaDirection="down" />);
    const delta = screen.getByText('-3%');
    expect(delta).toHaveStyle({ color: 'var(--loss)' });
  });

  it('deltaDirection="neutral" — delta has muted color', () => {
    render(<StatCard label="L" value="V" delta="0.00%" deltaDirection="neutral" />);
    const delta = screen.getByText('0.00%');
    expect(delta).toHaveStyle({ color: 'var(--text-muted)' });
  });

  it('default direction is neutral when not passed', () => {
    render(<StatCard label="L" value="V" delta="±1%" />);
    const delta = screen.getByText('±1%');
    expect(delta).toHaveStyle({ color: 'var(--text-muted)' });
  });

  it('component has correct ARIA/semantic structure — value is in a visible element', () => {
    const { container } = render(<StatCard label="Price" value="5,432.10" />);
    const valueEl = screen.getByText('5,432.10');
    expect(valueEl).toBeVisible();
    expect(container.firstChild).toBeTruthy();
  });
});
