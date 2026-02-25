'use client';

import MarketChart from './MarketChart';

const CHARTS = [
  {
    ticker: '^GSPC',
    label: 'S&P 500',
    formatValue: (v: number) =>
      v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  {
    ticker: '^VIX',
    label: 'VIX',
    formatValue: (v: number) => v.toFixed(2),
  },
  {
    ticker: 'DX-Y.NYB',
    label: 'DX-Y',
    formatValue: (v: number) => v.toFixed(2),
  },
  {
    ticker: '^TNX',
    label: '10Y Yield',
    formatValue: (v: number) => v.toFixed(2) + '%',
  },
  {
    ticker: 'DGS2',
    label: '2Y Yield',
    formatValue: (v: number) => v.toFixed(2) + '%',
  },
];

export default function MarketChartsWidget() {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
      gap: '12px',
    }}>
      {CHARTS.map((c) => (
        <MarketChart
          key={c.ticker}
          ticker={c.ticker}
          label={c.label}
          formatValue={c.formatValue}
        />
      ))}
    </div>
  );
}
