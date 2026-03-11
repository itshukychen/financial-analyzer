'use client';

import { Component, ErrorInfo } from 'react';
import { logError } from '@/lib/errorLogger';

// ---------------------------------------------------------------------------
// Props / State
// ---------------------------------------------------------------------------

interface ErrorBoundaryProps {
  /** Rendered when no error has been caught. */
  children: React.ReactNode;
  /**
   * Optional custom fallback. Receives the caught error and a reset callback.
   * Defaults to a generic "Something went wrong" card.
   */
  fallback?: (error: Error, reset: () => void) => React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

// ---------------------------------------------------------------------------
// Default fallback UI
// ---------------------------------------------------------------------------

function DefaultFallback({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div
      data-testid="error-boundary-fallback"
      role="alert"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '16px',
        padding: '40px 24px',
        minHeight: '200px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        textAlign: 'center',
        color: 'var(--text-primary)',
      }}
    >
      <span
        aria-hidden="true"
        style={{ fontSize: '32px', color: 'var(--loss)' }}
      >
        ✕
      </span>
      <div>
        <p
          style={{
            margin: '0 0 6px',
            fontSize: '16px',
            fontWeight: 700,
          }}
        >
          Something went wrong
        </p>
        <p
          style={{
            margin: 0,
            fontSize: '13px',
            color: 'var(--text-muted)',
          }}
        >
          {error.message || 'An unexpected error occurred.'}
        </p>
      </div>
      <button
        data-testid="error-boundary-retry-btn"
        onClick={reset}
        style={{
          padding: '8px 20px',
          borderRadius: '6px',
          border: '1px solid var(--accent)',
          background: 'transparent',
          color: 'var(--accent)',
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 600,
        }}
      >
        Try again
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ErrorBoundary class component
// ---------------------------------------------------------------------------

export default class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
    this.reset = this.reset.bind(this);
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    logError(error, {
      action: 'react-error-boundary',
      route:
        typeof window !== 'undefined' ? window.location.pathname : undefined,
    });
    // Surface the component stack in dev for easier debugging
    if (process.env.NODE_ENV !== 'production') {
      console.error('[ErrorBoundary] Component stack:', info.componentStack);
    }
  }

  reset(): void {
    this.setState({ hasError: false, error: null });
  }

  render() {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (!hasError || !error) return children;

    if (fallback) return fallback(error, this.reset);
    return <DefaultFallback error={error} reset={this.reset} />;
  }
}
