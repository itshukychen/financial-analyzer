import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PageHeader from '@/app/components/PageHeader';

describe('PageHeader', () => {
  it('renders title', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<PageHeader title="Dashboard" subtitle="Today's overview" />);
    expect(screen.getByText("Today's overview")).toBeInTheDocument();
  });

  it('does NOT render subtitle element when not provided', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
  });

  it('renders right slot content when provided', () => {
    render(<PageHeader title="Dashboard" right={<button>Export</button>} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('does NOT render right slot when not provided', () => {
    render(<PageHeader title="Dashboard" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('title is an <h1>', () => {
    render(<PageHeader title="Markets" />);
    const h1 = screen.getByRole('heading', { level: 1 });
    expect(h1).toHaveTextContent('Markets');
  });
});
