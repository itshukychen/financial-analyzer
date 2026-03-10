// app/components/reports/ErrorBanner.tsx
'use client';

interface ErrorBannerProps {
  error: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}

export default function ErrorBanner({ error, onRetry, onDismiss }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div
      className="mx-3 my-2 p-3 rounded-lg border flex items-start gap-3"
      role="alert"
      aria-live="assertive"
      style={{
        background: 'rgba(239, 68, 68, 0.1)',
        borderColor: '#ef4444',
        color: '#ef4444'
      }}
    >
      {/* Error icon */}
      <svg className="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
      </svg>

      {/* Error message */}
      <div className="flex-1">
        <p className="text-sm font-medium">{error}</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 shrink-0">
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-xs font-medium px-2 py-1 rounded border hover:bg-red-50 transition-colors"
            style={{ borderColor: '#ef4444' }}
          >
            Retry
          </button>
        )}
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="text-xs font-medium px-2 py-1 hover:bg-red-50 transition-colors rounded"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}
