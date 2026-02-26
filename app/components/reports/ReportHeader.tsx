interface ReportHeaderProps {
  date:        string;   // YYYY-MM-DD
  generatedAt: string;   // ISO timestamp
  headline:    string;
}

function formatReportDate(dateStr: string): string {
  // Parse as UTC to avoid timezone shifts (dateStr is YYYY-MM-DD)
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    timeZone: 'UTC',
  });
}

function formatGeneratedTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    hour:     '2-digit',
    minute:   '2-digit',
    timeZoneName: 'short',
  });
}

export default function ReportHeader({ date, generatedAt, headline }: ReportHeaderProps) {
  return (
    <div
      className="rounded-xl border p-6 mb-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Date chip + generated time */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <span
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full border"
          style={{
            color:       'var(--accent)',
            borderColor: 'var(--accent)',
            background:  'rgba(99,102,241,0.08)',
          }}
        >
          {/* Calendar icon */}
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <rect x="1" y="3" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M5 1v4M11 1v4M1 7h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          {formatReportDate(date)}
        </span>

        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Generated {formatGeneratedTime(generatedAt)}
        </span>
      </div>

      {/* Headline */}
      <h2
        className="text-xl font-bold leading-snug tracking-tight"
        style={{ color: 'var(--text-primary)' }}
      >
        {headline}
      </h2>
    </div>
  );
}
