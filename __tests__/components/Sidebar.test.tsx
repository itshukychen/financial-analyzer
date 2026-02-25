import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { usePathname } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';

// usePathname is already mocked in vitest.setup.ts as vi.fn(() => '/')
const mockUsePathname = vi.mocked(usePathname);

beforeEach(() => {
  mockUsePathname.mockReturnValue('/');
});

describe('Sidebar', () => {
  it('renders "FinAnalyzer" brand name', () => {
    render(<Sidebar />);
    expect(screen.getByText('FinAnalyzer')).toBeInTheDocument();
  });

  it('renders all 5 nav links', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Dashboard/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Markets/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Reports/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Watchlist/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Alerts/i })).toBeInTheDocument();
  });

  it('each nav link has correct href attribute', () => {
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Markets/i })).toHaveAttribute('href', '/markets');
    expect(screen.getByRole('link', { name: /Reports/i })).toHaveAttribute('href', '/reports');
    expect(screen.getByRole('link', { name: /Watchlist/i })).toHaveAttribute('href', '/watchlist');
    expect(screen.getByRole('link', { name: /Alerts/i })).toHaveAttribute('href', '/alerts');
  });

  it('active state on "/" — Dashboard link has active-nav-link class', () => {
    mockUsePathname.mockReturnValue('/');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Dashboard/i })).toHaveClass('active-nav-link');
    expect(screen.getByRole('link', { name: /Markets/i })).not.toHaveClass('active-nav-link');
  });

  it('active state on "/markets" — Markets link is active, Dashboard is not', () => {
    mockUsePathname.mockReturnValue('/markets');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Markets/i })).toHaveClass('active-nav-link');
    expect(screen.getByRole('link', { name: /Dashboard/i })).not.toHaveClass('active-nav-link');
  });

  it('active state on "/reports" — Reports link is active', () => {
    mockUsePathname.mockReturnValue('/reports');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Reports/i })).toHaveClass('active-nav-link');
  });

  it('active state on "/watchlist" — Watchlist link is active', () => {
    mockUsePathname.mockReturnValue('/watchlist');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Watchlist/i })).toHaveClass('active-nav-link');
  });

  it('active state on "/alerts" — Alerts link is active', () => {
    mockUsePathname.mockReturnValue('/alerts');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Alerts/i })).toHaveClass('active-nav-link');
  });

  it('/markets/detail (child path) — Markets is still active (startsWith check)', () => {
    mockUsePathname.mockReturnValue('/markets/detail');
    render(<Sidebar />);
    expect(screen.getByRole('link', { name: /Markets/i })).toHaveClass('active-nav-link');
    expect(screen.getByRole('link', { name: /Dashboard/i })).not.toHaveClass('active-nav-link');
  });

  it('renders version string "v0.1.0"', () => {
    render(<Sidebar />);
    // The footer contains "v0.1.0 — alpha"
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
  });
});
