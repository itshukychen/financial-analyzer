import type { DailyReport } from '@/scripts/generate-report';
import type { ReportPeriod } from '@/lib/db';

const PERIOD_LABELS: Record<ReportPeriod, string> = {
  morning: 'Open',
  midday:  'Midday',
  eod:     'Close',
};

interface ReportHeaderProps {
  report:  DailyReport;
  period?: ReportPeriod;
}

// ─── Regime color mapping ─────────────────────────────────────────────────────

type RegimeColor = 'red' | 'amber' | 'green' | 'blue';

function getRegimeColor(classification: string): RegimeColor {
  const danger  = ['Growth scare', 'Liquidity crisis', 'Risk-off tightening'];
  const warning = ['Inflation scare', 'Positioning unwind'];
  const positive = ['Soft landing / reflation', 'Risk-on melt-up'];

  if (danger.includes(classification))   return 'red';
  if (warning.includes(classification))  return 'amber';
  if (positive.includes(classification)) return 'green';
  return 'blue'; // Policy pivot + unknown
}

const REGIME_STYLES: Record<RegimeColor, React.CSSProperties> = {
  red:   { background: 'rgba(239,68,68,0.12)',  color: '#ef4444', borderColor: '#ef4444' },
  amber: { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderColor: '#f59e0b' },
  green: { background: 'rgba(34,197,94,0.12)',  color: '#22c55e', borderColor: '#22c55e' },
  blue:  { background: 'rgba(99,102,241,0.12)', color: 'var(--accent)', borderColor: 'var(--accent)' },
};

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportHeader({ report, period }: ReportHeaderProps) {
  const { date, generatedAt, analysis } = report;
  const { headline, regime } = analysis;
  const regimeColor = getRegimeColor(regime.classification);
  const regimeStyle = REGIME_STYLES[regimeColor];

  return (
    <div
      className="rounded-xl border p-6 mb-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Regime badge + period badge */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className="inline-flex items-center text-xs font-bold px-3 py-1 rounded-full border uppercase tracking-widest"
          style={regimeStyle}
        >
          {regime.classification}
        </span>
        {period && (
          <span
            className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider"
            style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'rgba(99,102,241,0.06)' }}
          >
            {PERIOD_LABELS[period]}
          </span>
        )}
      </div>

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
        className="text-xl font-bold leading-snug tracking-tight mb-3"
        style={{ color: 'var(--text-primary)' }}
      >
        {headline}
      </h2>

      {/* Regime justification */}
      <p
        className="text-sm leading-relaxed"
        style={{ color: 'var(--text-muted)' }}
      >
        {regime.justification}
      </p>
    </div>
  );
}
