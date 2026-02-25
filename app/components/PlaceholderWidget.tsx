interface PlaceholderWidgetProps {
  label: string;
  description?: string;
  minHeight?: string;
}

export default function PlaceholderWidget({
  label,
  description,
  minHeight = '200px',
}: PlaceholderWidgetProps) {
  return (
    <div
      data-testid="placeholder-widget"
      className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed gap-2 p-8"
      style={{
        borderColor: 'var(--border)',
        background: 'var(--surface)',
        minHeight,
      }}
    >
      {/* Placeholder icon */}
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
        style={{ color: 'var(--border)' }}
      >
        <rect x="1" y="1" width="26" height="26" rx="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d="M14 9v10M9 14h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <span className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>

      {description && (
        <span className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
          {description}
        </span>
      )}

      <span
        className="mt-1 text-xs font-medium px-2.5 py-0.5 rounded-full border"
        style={{
          color: 'var(--text-muted)',
          borderColor: 'var(--border)',
          background: 'rgba(30,30,46,0.6)',
        }}
      >
        Coming soon
      </span>
    </div>
  );
}
