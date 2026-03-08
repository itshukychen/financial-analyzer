'use client';

import MarketChart from './MarketChart';
import FearGreedWidget from './FearGreedWidget';

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
  { ticker: 'CL=F', label: 'WTI',   formatValue: (v: number) => '$' + v.toFixed(2) },
  { ticker: 'BZ=F', label: 'Brent', formatValue: (v: number) => '$' + v.toFixed(2) },
];

export default function MarketChartsWidget() {
  return (
    <div
      data-testid="market-charts-grid"
      className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3"
    >
      {CHARTS.map((c) => (
        <MarketChart
          key={c.ticker}
          ticker={c.ticker}
          label={c.label}
          formatValue={c.formatValue}
        />
      ))}
      <FearGreedWidget />
    </div>
  );
}
