import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastProvider, useToast } from '@/app/components/ToastProvider';

// ---------------------------------------------------------------------------
// Helper: tiny consumer component that exposes the context via test buttons
// ---------------------------------------------------------------------------
function Consumer() {
  const { showError, showSuccess, showWarning, showInfo, dismiss } = useToast();
  return (
    <div>
      <button onClick={() => showError('error msg')} data-testid="btn-error">
        Error
      </button>
      <button
        onClick={() => showError('error with retry', () => {})}
        data-testid="btn-error-retry"
      >
        Error + Retry
      </button>
      <button onClick={() => showSuccess('success msg')} data-testid="btn-success">
        Success
      </button>
      <button onClick={() => showWarning('warning msg')} data-testid="btn-warning">
        Warning
      </button>
      <button onClick={() => showInfo('info msg')} data-testid="btn-info">
        Info
      </button>
      <button
        onClick={() => {
          const toasts = document.querySelectorAll('[data-testid^="toast-dismiss-"]');
          if (toasts.length > 0) {
            const id = (toasts[0] as HTMLElement).dataset.testid?.replace(
              'toast-dismiss-',
              '',
            );
            if (id) dismiss(id);
          }
        }}
        data-testid="btn-dismiss-first"
      >
        Dismiss first
      </button>
    </div>
  );
}

describe('ToastProvider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    render(
      <ToastProvider>
        <Consumer />
      </ToastProvider>,
    );
  }

  it('renders the toast container in the DOM', () => {
    setup();
    expect(screen.getByTestId('toast-container')).toBeInTheDocument();
  });

  it('shows an error toast when showError is called', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-error'));
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    expect(screen.getByText('error msg')).toBeInTheDocument();
  });

  it('shows a success toast', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-success'));
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    expect(screen.getByText('success msg')).toBeInTheDocument();
  });

  it('shows a warning toast', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-warning'));
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
  });

  it('shows an info toast', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-info'));
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
  });

  it('shows a Retry button when onRetry is provided', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-error-retry'));
    const toast = screen.getByTestId('toast-error');
    expect(toast.querySelector('[data-testid^="toast-retry-"]')).not.toBeNull();
  });

  it('Retry button calls onRetry and dismisses the toast', () => {
    const retrySpy = vi.fn();
    function RetryConsumer() {
      const { showError } = useToast();
      return (
        <button
          data-testid="trigger"
          onClick={() => showError('network error', retrySpy)}
        >
          trigger
        </button>
      );
    }
    render(
      <ToastProvider>
        <RetryConsumer />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByTestId('trigger'));
    const retryBtn = document.querySelector('[data-testid^="toast-retry-"]') as HTMLElement;
    expect(retryBtn).not.toBeNull();
    fireEvent.click(retryBtn);
    expect(retrySpy).toHaveBeenCalledOnce();
    expect(screen.queryByTestId('toast-error')).toBeNull();
  });

  it('dismiss button removes the toast', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-error'));
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    const dismissBtn = document.querySelector('[data-testid^="toast-dismiss-"]') as HTMLElement;
    fireEvent.click(dismissBtn);
    expect(screen.queryByTestId('toast-error')).toBeNull();
  });

  it('auto-dismisses error toast after 8 seconds', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-error'));
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(8001);
    });
    expect(screen.queryByTestId('toast-error')).toBeNull();
  });

  it('auto-dismisses success toast after 4 seconds', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-success'));
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(4001);
    });
    expect(screen.queryByTestId('toast-success')).toBeNull();
  });

  it('multiple toasts can be shown simultaneously', () => {
    setup();
    fireEvent.click(screen.getByTestId('btn-error'));
    fireEvent.click(screen.getByTestId('btn-success'));
    expect(screen.getByText('error msg')).toBeInTheDocument();
    expect(screen.getByText('success msg')).toBeInTheDocument();
  });

  it('useToast throws when used outside ToastProvider', () => {
    function BadConsumer() {
      useToast();
      return null;
    }
    expect(() => render(<BadConsumer />)).toThrow(
      'useToast must be used inside <ToastProvider>',
    );
  });
});
