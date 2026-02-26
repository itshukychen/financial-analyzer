import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getReportByDate } from '../../../lib/db';
import PageHeader   from '../../components/PageHeader';
import ReportHeader from '../../components/reports/ReportHeader';
import ReportSection from '../../components/reports/ReportSection';
import DataSnapshot  from '../../components/reports/DataSnapshot';
import type { DailyReport } from '../../../scripts/generate-report';

// ─── Icon helpers ─────────────────────────────────────────────────────────────

function IconChart()  { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><polyline points="1,12 5,7 9,9 15,3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>; }
function IconAlert()  { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M8 2l6 12H2L8 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M8 7v3M8 12h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconBond()   { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><rect x="1" y="4" width="14" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5"/><path d="M1 7h14" stroke="currentColor" strokeWidth="1.5"/></svg>; }
function IconDollar() { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/><path d="M8 4v8M5.5 6.5A2.5 1.5 0 018 5a2.5 1.5 0 012.5 1.5A2.5 1.5 0 018 8a2.5 1.5 0 00-2.5 1.5A2.5 1.5 0 008 11a2.5 1.5 0 002.5-1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconLink()   { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 10l-2 2a2.83 2.83 0 000 4 2.83 2.83 0 004 0l2-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M10 6l2-2a2.83 2.83 0 000-4 2.83 2.83 0 00-4 0L6 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M9.5 6.5l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>; }
function IconEye()    { return <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M1 8s3-5 7-5 7 5 7 5-3 5-7 5-7-5-7-5z" stroke="currentColor" strokeWidth="1.5"/><circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.5"/></svg>; }

const SECTIONS = [
  { key: 'equity'      as const, title: 'Equities',     icon: <IconChart /> },
  { key: 'volatility'  as const, title: 'Volatility',   icon: <IconAlert /> },
  { key: 'fixedIncome' as const, title: 'Fixed Income', icon: <IconBond />  },
  { key: 'dollar'      as const, title: 'US Dollar',    icon: <IconDollar />},
  { key: 'crossAsset'  as const, title: 'Cross-Asset',  icon: <IconLink />  },
  { key: 'outlook'     as const, title: 'Outlook',      icon: <IconEye />   },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ReportDatePage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;

  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const row = getReportByDate(date);
  if (!row) notFound();

  const report: DailyReport = {
    date:        row.date,
    generatedAt: new Date(row.generated_at * 1000).toISOString(),
    marketData:  JSON.parse(row.ticker_data),
    analysis:    JSON.parse(row.report_json),
  };

  return (
    <>
      <PageHeader
        title="Daily Market Report"
        subtitle={`Archive — ${date}`}
      />

      {/* Back link */}
      <div className="mb-4">
        <Link
          href="/reports"
          className="text-xs font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back to latest report
        </Link>
      </div>

      <ReportHeader
        date={report.date}
        generatedAt={report.generatedAt}
        headline={report.analysis.headline}
      />

      {/* Executive summary */}
      <div
        className="rounded-xl border p-5 mb-6"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      >
        <p className="text-sm font-medium mb-2 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Executive Summary
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {report.analysis.summary}
        </p>
      </div>

      {/* Data snapshot */}
      <DataSnapshot marketData={report.marketData} />

      {/* Analysis sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {SECTIONS.map(({ key, title, icon }) => (
          <ReportSection
            key={key}
            title={title}
            icon={icon}
            content={report.analysis.sections[key]}
          />
        ))}
      </div>
    </>
  );
}
