import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/app/components/Sidebar';

const mockUsePathname = vi.mocked(usePathname);
const mockOnClose = vi.fn();

// Helper: render with required props
function renderSidebar(isOpen = false) {
  return render(<Sidebar isOpen={isOpen} onClose={mockOnClose} />);
}

beforeEach(() => {
  mockUsePathname.mockReturnValue('/');
  mockOnClose.mockClear();
});

describe('Sidebar', () => {
  it('renders "FinAnalyzer" brand name', () => {
    renderSidebar();
    expect(screen.getByText('FinAnalyzer')).toBeInTheDocument();
  });

  it('renders all 5 nav links', () => {
    renderSidebar();
    for (const label of ['Dashboard', 'Markets', 'Reports', 'Watchlist', 'Alerts']) {
      expect(screen.getByRole('link', { name: new RegExp(label, 'i') })).toBeInTheDocument();
    }
  });

  it('each nav link has correct href attribute', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: /Markets/i })).toHaveAttribute('href', '/markets');
    expect(screen.getByRole('link', { name: /Reports/i })).toHaveAttribute('href', '/reports');
    expect(screen.getByRole('link', { name: /Watchlist/i })).toHaveAttribute('href', '/watchlist');
    expect(screen.getByRole('link', { name: /Alerts/i })).toHaveAttribute('href', '/alerts');
  });

  it('active state on "/" — Dashboard link has active-nav-link class', () => {
    renderSidebar();
    expect(screen.getByRole('link', { name: /Dashboard/i })).toHaveClass('active-nav-link');
    expect(screen.getByRole('link', { name: /Markets/i })).not.toHaveClass('active-nav-link');
  });

  it('active state on "/markets" — Markets link is active, Dashboard is not', () => {
    mockUsePathname.mockReturnValue('/markets');
    renderSidebar();
    expect(screen.getByRole('link', { name: /Markets/i })).toHaveClass('active-nav-link');
    expect(screen.getByRole('link', { name: /Dashboard/i })).not.toHaveClass('active-nav-link');
  });

  it('active state on "/reports"', () => {
    mockUsePathname.mockReturnValue('/reports');
    renderSidebar();
    expect(screen.getByRole('link', { name: /Reports/i })).toHaveClass('active-nav-link');
  });

  it('active state on "/watchlist"', () => {
    mockUsePathname.mockReturnValue('/watchlist');
    renderSidebar();
    expect(screen.getByRole('link', { name: /Watchlist/i })).toHaveClass('active-nav-link');
  });

  it('active state on "/alerts"', () => {
    mockUsePathname.mockReturnValue('/alerts');
    renderSidebar();
    expect(screen.getByRole('link', { name: /Alerts/i })).toHaveClass('active-nav-link');
  });

  it('/markets/detail (child path) — Markets is still active', () => {
    mockUsePathname.mockReturnValue('/markets/detail');
    renderSidebar();
    expect(screen.getByRole('link', { name: /Markets/i })).toHaveClass('active-nav-link');
    expect(screen.getByRole('link', { name: /Dashboard/i })).not.toHaveClass('active-nav-link');
  });

  it('renders version string "v0.1.0"', () => {
    renderSidebar();
    expect(screen.getByText(/v0\.1\.0/)).toBeInTheDocument();
  });

  // ── Mobile behaviour ────────────────────────────────────────────────────────

  it('renders a close button', () => {
    renderSidebar(true);
    expect(screen.getByRole('button', { name: /close navigation/i })).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    renderSidebar(true);
    fireEvent.click(screen.getByRole('button', { name: /close navigation/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when a nav link is clicked', () => {
    renderSidebar(true);
    fireEvent.click(screen.getByRole('link', { name: /Markets/i }));
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('has -translate-x-full class when isOpen=false', () => {
    renderSidebar(false);
    const aside = screen.getByRole('complementary');
    expect(aside.className).toMatch(/-translate-x-full/);
  });

  it('has translate-x-0 class when isOpen=true', () => {
    renderSidebar(true);
    const aside = screen.getByRole('complementary');
    expect(aside.className).toMatch(/translate-x-0/);
    expect(aside.className).not.toMatch(/-translate-x-full/);
  });
});
