export const dynamic = 'force-dynamic'; // always render from DB, never statically cache

import { getLatestReport, listReports, PERIOD_LABELS, type ReportPeriod } from '../../lib/db';
import PageHeader        from '../components/PageHeader';
import ReportHeader      from '../components/reports/ReportHeader';
import ReportSection     from '../components/reports/ReportSection';
import DataSnapshot      from '../components/reports/DataSnapshot';
import FloatingChatBubble from '../components/reports/FloatingChatBubble';
import type { DailyReport } from '../../scripts/generate-report';

// ─── Icon helpers (inline SVGs) ───────────────────────────────────────────────

function IconChart()  { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><polyline points="1,12 5,7 9,9 15,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconAlert()  { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2l6 12H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 7v3M8 12h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconBond()   { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/></svg>; }
function IconDollar() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4v8M5.5 6.5A2.5 1.5 0 018 5a2.5 1.5 0 012.5 1.5A2.5 1.5 0 018 8a2.5 1.5 0 00-2.5 1.5A2.5 1.5 0 008 11a2.5 1.5 0 002.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconLink()   { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 10l-2 2a2.83 2.83 0 000 4 2.83 2.83 0 004 0l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M10 6l2-2a2.83 2.83 0 000-4 2.83 2.83 0 00-4 0L6 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9.5 6.5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconEye()    { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>; }
function IconRisk()   { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 1l7 13H1L8 1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M8 6v4M8 11.5h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>; }

// ─── Data loading (server-side, direct SQLite read) ───────────────────────────

interface LatestReportResult {
  report: DailyReport;
  period: ReportPeriod;
}

function loadLatestReport(): LatestReportResult | null {
  try {
    const row = getLatestReport();
    if (!row) return null;
    return {
      period: row.period,
      report: {
        date:        row.date,
        generatedAt: new Date(row.generated_at * 1000).toISOString(),
        marketData:  JSON.parse(row.ticker_data),
        analysis:    JSON.parse(row.report_json),
      } as DailyReport,
    };
  } catch {
    return null;
  }
}

// Returns reports grouped by date: { date, periods: [{period, generated_at}] }[]
interface ArchiveEntry {
  date:    string;
  periods: { period: ReportPeriod; generated_at: number }[];
}

function loadArchive(skipDate?: string): ArchiveEntry[] {
  try {
    const rows = listReports(150);
    const map  = new Map<string, ArchiveEntry>();
    for (const r of rows) {
      if (r.date === skipDate) continue;
      if (!map.has(r.date)) map.set(r.date, { date: r.date, periods: [] });
      map.get(r.date)!.periods.push({ period: r.period, generated_at: r.generated_at });
    }
    return Array.from(map.values());
  } catch {
    return [];
  }
}

// ─── Section config ───────────────────────────────────────────────────────────

const SECTIONS = [
  { key: 'yieldCurve'       as const, title: 'Yield Curve Diagnosis',        icon: <IconBond />   },
  { key: 'dollarLogic'      as const, title: 'Dollar Logic',                  icon: <IconDollar /> },
  { key: 'equityDiagnosis'  as const, title: 'Equity Move Diagnosis',         icon: <IconChart />  },
  { key: 'volatility'       as const, title: 'Volatility Interpretation',     icon: <IconAlert />  },
  { key: 'crossAssetCheck'  as const, title: 'Cross-Asset Consistency',       icon: <IconLink />   },
  { key: 'forwardScenarios' as const, title: 'Forward Scenarios (1–2 Weeks)', icon: <IconEye />    },
  { key: 'shortVolRisk'     as const, title: 'Short Vol / 1DTE Risk',         icon: <IconRisk />   },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const latest  = loadLatestReport();
  const report  = latest?.report ?? null;
  const period  = latest?.period;
  const archive = loadArchive(report?.date);

  return (
    <>
      <PageHeader
        title="Daily Market Report"
        subtitle="AI-Powered Macro Analysis"
      />

      {!report ? (
        /* ── No report yet ── */
        <div
          data-testid="reports-placeholder"
          className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed gap-3 p-12"
          style={{ borderColor: 'var(--border)', background: 'var(--surface)', minHeight: '320px' }}
        >
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" style={{ color: 'var(--border)' }}>
            <rect x="2" y="2" width="28" height="28" rx="5" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
            <path d="M16 10v12M10 16h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
            No reports available yet
          </p>
          <p className="text-xs text-center max-w-xs" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            Reports generate daily at 5:30 PM ET, after market close. Check back soon.
          </p>
        </div>
      ) : (
        /* ── Report UI ── */
        <>
          <ReportHeader report={report} period={period} />

          {/* Data snapshot */}
          <DataSnapshot marketData={report.marketData} />

          {/* Analysis sections — 3-col grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {SECTIONS.map(({ key, title, icon }) => (
              <ReportSection
                key={key}
                title={title}
                icon={icon}
                content={report.analysis[key] as string}
              />
            ))}
          </div>

          {/* Regime probabilities footer */}
          {report.analysis.regimeProbabilities && (
            <div
              className="rounded-xl border p-4 mb-8"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p
                className="text-xs font-mono text-center"
                style={{ color: 'var(--text-muted)' }}
              >
                <span className="font-semibold uppercase tracking-wider mr-2" style={{ color: 'var(--text-secondary, var(--text-muted))' }}>
                  Regime Probabilities:
                </span>
                {report.analysis.regimeProbabilities}
              </p>
            </div>
          )}

          {/* Floating chat bubble */}
          <FloatingChatBubble
            reportId={`${report.date}-${period || 'eod'}`}
            reportDate={report.date}
            reportPeriod={period || 'eod'}
          />

          {/* Archive */}
          {archive.length > 0 && (
            <div
              className="rounded-xl border p-5"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
            >
              <p className="text-sm font-semibold mb-4 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Past Reports
              </p>
              <ul className="flex flex-col gap-3">
                {archive.map(entry => (
                  <li key={entry.date} className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono w-24 shrink-0" style={{ color: 'var(--text-muted)' }}>
                      {entry.date}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {entry.periods.map(({ period: p }) => (
                        <a
                          key={p}
                          href={`/reports/${entry.date}?period=${p}`}
                          className="text-xs px-2.5 py-0.5 rounded-full border transition-colors"
                          style={{
                            color:       'var(--text-muted)',
                            borderColor: 'var(--border)',
                            background:  'rgba(30,30,46,0.4)',
                          }}
                        >
                          {PERIOD_LABELS[p]}
                        </a>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </>
  );
}
