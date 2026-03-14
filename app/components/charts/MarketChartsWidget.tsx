'use client';

import { useState } from 'react';
import MarketChart from './MarketChart';
import FearGreedWidget from './FearGreedWidget';
import ChartModal from './ChartModal';

interface ChartConfig {
  ticker:      string;
  label:       string;
  formatValue: (v: number) => string;
}

const CHARTS: ChartConfig[] = [
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
  const [openConfig, setOpenConfig] = useState<ChartConfig | null>(null);

  function handleTileClick(config: ChartConfig) {
    setOpenConfig(config);
  }

  function handleModalClose() {
    const ticker = openConfig!.ticker;
    setOpenConfig(null);
    // Return focus to the tile that triggered the modal (AC-5.4)
    setTimeout(() => {
      const el = document.querySelector<HTMLElement>(`[data-testid="ticker-tile-${ticker}"]`);
      el?.focus();
    }, 0);
  }

  return (
    <>
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
            onClick={() => handleTileClick(c)}
          />
        ))}
        <FearGreedWidget />
      </div>

      {openConfig && (
        <ChartModal
          ticker={openConfig.ticker}
          label={openConfig.label}
          formatValue={openConfig.formatValue}
          onClose={handleModalClose}
        />
      )}
    </>
  );
}
