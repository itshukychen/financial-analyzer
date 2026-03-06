export const dynamic = 'force-dynamic'; // reads from SQLite — must not be statically cached

import Link from 'next/link';
import PageHeader from './components/PageHeader';
import PlaceholderWidget from './components/PlaceholderWidget';
import MarketChartsWidget from './components/charts/MarketChartsWidget';
import { getLatestReport, PERIOD_LABELS } from '../lib/db';

export default function DashboardPage() {
  let reportWidget: React.ReactNode;

  try {
    const latestReport   = getLatestReport();
    const reportAnalysis = latestReport ? JSON.parse(latestReport.report_json) : null;

    if (latestReport && reportAnalysis) {
      const date = latestReport.date;
      reportWidget = (
        <div
          style={{
            background:  'var(--surface)',
            borderColor: 'var(--border)',
            minHeight:   '260px',
          }}
          className="rounded-xl border p-5 flex flex-col gap-3"
        >
          <div className="flex items-center justify-between">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Daily Market Report
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {reportAnalysis.regime?.classification && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--accent)', borderColor: 'var(--accent)', background: 'rgba(99,102,241,0.1)' }}
                >
                  {reportAnalysis.regime.classification}
                </span>
              )}
              {latestReport.period && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full border font-semibold uppercase tracking-wider"
                  style={{ color: 'var(--text-muted)', borderColor: 'var(--border)', background: 'rgba(99,102,241,0.06)' }}
                >
                  {PERIOD_LABELS[latestReport.period]}
                </span>
              )}
              <span
                className="text-xs px-2 py-0.5 rounded-full border"
                style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}
              >
                {date}
              </span>
            </div>
          </div>

          <p
            className="text-sm font-semibold leading-snug"
            style={{ color: 'var(--text-primary)' }}
          >
            {reportAnalysis.headline}
          </p>

          <p
            className="text-xs leading-relaxed flex-1"
            style={{ color: 'var(--text-muted)' }}
          >
            {reportAnalysis.regime?.justification?.slice(0, 200)}
            {reportAnalysis.regime?.justification?.length > 200 ? '…' : ''}
          </p>

          <Link
            href="/reports"
            className="text-xs font-medium self-start"
            style={{ color: 'var(--accent)' }}
          >
            Read full analysis →
          </Link>
        </div>
      );
    } else {
      reportWidget = (
        <PlaceholderWidget
          label="Daily Market Report"
          description="AI-generated SPX report will appear here each trading day"
          minHeight="260px"
        />
      );
    }
  } catch {
    reportWidget = (
      <PlaceholderWidget
        label="Daily Market Report"
        description="AI-generated SPX report will appear here each trading day"
        minHeight="260px"
      />
    );
  }

  return (
    <>
      <PageHeader title="Dashboard" subtitle="Market Overview" />

      {/* Live market charts — last 7 trading days */}
      <div style={{ marginBottom: '24px' }}>
        <MarketChartsWidget />
      </div>

      {/* Full-width report widget */}
      <div className="mb-4">
        {reportWidget}
      </div>

      {/* Full-width widget */}
      <PlaceholderWidget
        label="Market Heatmap"
        description="S&P 500 sector performance visualized by weight and returns"
        minHeight="300px"
      />
    </>
  );
}
