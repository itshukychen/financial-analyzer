'use client';

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useRef,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** Optional retry callback — shown as a "Retry" button inside the toast. */
  onRetry?: () => void;
  /** Auto-dismiss after this many ms. 0 = stay until manually dismissed. */
  duration?: number;
}

interface ToastContextValue {
  /** Show a generic toast. */
  showToast: (opts: Omit<Toast, 'id'>) => void;
  /** Convenience: show an error toast (type='error'). */
  showError: (message: string, onRetry?: () => void) => void;
  /** Convenience: show a success toast (type='success'). */
  showSuccess: (message: string) => void;
  /** Convenience: show a warning toast (type='warning'). */
  showWarning: (message: string) => void;
  /** Convenience: show an info toast (type='info'). */
  showInfo: (message: string) => void;
  /** Dismiss a specific toast by id. */
  dismiss: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null);

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}

// ---------------------------------------------------------------------------
// Auto-dismiss controller (per-toast timer)
// ---------------------------------------------------------------------------

const DEFAULT_DURATION: Record<ToastType, number> = {
  error:   8000,
  warning: 6000,
  success: 4000,
  info:    5000,
};

// ---------------------------------------------------------------------------
// Toast item colours (design-token driven)
// ---------------------------------------------------------------------------

const TOAST_STYLES: Record<ToastType, { border: string; iconColor: string; icon: string }> = {
  error:   { border: 'var(--loss)',        iconColor: 'var(--loss)',        icon: '✕' },
  warning: { border: '#f59e0b',            iconColor: '#f59e0b',            icon: '⚠' },
  success: { border: 'var(--gain)',        iconColor: 'var(--gain)',        icon: '✓' },
  info:    { border: 'var(--accent)',      iconColor: 'var(--accent)',      icon: 'ℹ' },
};

// ---------------------------------------------------------------------------
// ToastItem component
// ---------------------------------------------------------------------------

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const { id, message, type, onRetry, duration } = toast;
  const style = TOAST_STYLES[type];
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const ms = duration ?? DEFAULT_DURATION[type];

  useEffect(() => {
    if (ms <= 0) return;
    timerRef.current = setTimeout(() => onDismiss(id), ms);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, ms, onDismiss]);

  return (
    <div
      data-testid={`toast-${type}`}
      role="alert"
      aria-live="assertive"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        padding: '12px 14px',
        borderRadius: '8px',
        border: `1px solid ${style.border}`,
        background: 'var(--surface)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
        maxWidth: '380px',
        width: '100%',
        color: 'var(--text-primary)',
        fontSize: '13px',
        lineHeight: '1.4',
        position: 'relative',
      }}
    >
      {/* Type icon */}
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          fontWeight: 700,
          fontSize: '14px',
          color: style.iconColor,
          marginTop: '1px',
        }}
      >
        {style.icon}
      </span>

      {/* Message + actions */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, wordBreak: 'break-word' }}>{message}</p>
        {onRetry && (
          <button
            data-testid={`toast-retry-${id}`}
            onClick={() => {
              onDismiss(id);
              onRetry();
            }}
            style={{
              marginTop: '6px',
              padding: '3px 10px',
              fontSize: '12px',
              fontWeight: 600,
              borderRadius: '4px',
              border: `1px solid ${style.border}`,
              background: 'transparent',
              color: style.iconColor,
              cursor: 'pointer',
            }}
          >
            Retry
          </button>
        )}
      </div>

      {/* Dismiss button */}
      <button
        data-testid={`toast-dismiss-${id}`}
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '16px',
          lineHeight: 1,
          padding: '0 0 0 4px',
        }}
      >
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev, { ...opts, id }]);
  }, []);

  const showError = useCallback(
    (message: string, onRetry?: () => void) =>
      showToast({ message, type: 'error', onRetry }),
    [showToast],
  );

  const showSuccess = useCallback(
    (message: string) => showToast({ message, type: 'success' }),
    [showToast],
  );

  const showWarning = useCallback(
    (message: string) => showToast({ message, type: 'warning' }),
    [showToast],
  );

  const showInfo = useCallback(
    (message: string) => showToast({ message, type: 'info' }),
    [showToast],
  );

  const value: ToastContextValue = {
    showToast,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    dismiss,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}

      {/* Toast container — fixed bottom-right */}
      <div
        data-testid="toast-container"
        aria-label="Notifications"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          pointerEvents: toasts.length === 0 ? 'none' : 'auto',
        }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
