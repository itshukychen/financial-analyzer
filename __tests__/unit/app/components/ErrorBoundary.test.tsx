import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorBoundary from '@/app/components/ErrorBoundary';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function Bomb({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error('test explosion');
  return <div data-testid="bomb-safe">safe</div>;
}

// Module-level flag used by ControlledBomb — set from test body (not from render)
let globalShouldThrow = true;
function ControlledBomb() {
  if (globalShouldThrow) throw new Error('test explosion');
  return <div data-testid="bomb-safe">safe</div>;
}

// Suppress React's console.error noise for intentional throws in tests
const originalConsoleError = console.error;
afterEach(() => {
  console.error = originalConsoleError;
});

function suppressReactErrors() {
  console.error = vi.fn();
}

describe('ErrorBoundary', () => {
  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <Bomb shouldThrow={false} />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('bomb-safe')).toBeInTheDocument();
  });

  it('renders default fallback when a child throws', () => {
    suppressReactErrors();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('test explosion')).toBeInTheDocument();
  });

  it('renders the "Try again" button in the default fallback', () => {
    suppressReactErrors();
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-retry-btn')).toBeInTheDocument();
  });

  it('resets error state when "Try again" is clicked', () => {
    suppressReactErrors();
    // First render: ControlledBomb throws → boundary shows fallback
    globalShouldThrow = true;
    render(
      <ErrorBoundary>
        <ControlledBomb />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('error-boundary-fallback')).toBeInTheDocument();

    // Allow children to render without error, then click "Try again"
    globalShouldThrow = false;
    fireEvent.click(screen.getByTestId('error-boundary-retry-btn'));

    // Boundary reset → ControlledBomb renders safely
    expect(screen.getByTestId('bomb-safe')).toBeInTheDocument();
  });

  it('renders a custom fallback when provided', () => {
    suppressReactErrors();
    const customFallback = (err: Error, reset: () => void) => (
      <div data-testid="custom-fallback">
        <span>{err.message}</span>
        <button onClick={reset} data-testid="custom-reset">Reset</button>
      </div>
    );
    render(
      <ErrorBoundary fallback={customFallback}>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
    expect(screen.getByText('test explosion')).toBeInTheDocument();
    expect(screen.queryByTestId('error-boundary-fallback')).toBeNull();
  });

  it('logs the error to console.error via logError', () => {
    suppressReactErrors();
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Bomb shouldThrow />
      </ErrorBoundary>,
    );
    // logError writes to console.error with the '[FinAnalyzer Error]' prefix
    const calls = consoleSpy.mock.calls.map((c) => String(c[0]));
    expect(calls.some((s) => s.includes('[FinAnalyzer Error]'))).toBe(true);
    consoleSpy.mockRestore();
  });
});
