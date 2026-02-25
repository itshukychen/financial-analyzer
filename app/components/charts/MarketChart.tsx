'use client';

import { useEffect, useRef, useState } from 'react';

interface DataPoint {
  time: string;
  value: number;
}

interface ChartData {
  symbol: string;
  name: string;
  points: DataPoint[];
  current: number;
  changePct: number;
}

interface MarketChartProps {
  ticker: string;
  label: string;
  formatValue?: (v: number) => string;
}

function defaultFormat(v: number) {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function MarketChart({ ticker, label, formatValue = defaultFormat }: MarketChartProps) {
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch data
  useEffect(() => {
    const encoded = encodeURIComponent(ticker);
    fetch(`/api/market/chart/${encoded}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [ticker]);

  // Render chart once data is available
  useEffect(() => {
    if (!data || !containerRef.current) return;

    const container = containerRef.current;
    const isUp = data.changePct >= 0;
    const lineColor = isUp ? '#00d97e' : '#f63b3b';
    const topColor = isUp ? 'rgba(0, 217, 126, 0.18)' : 'rgba(246, 59, 59, 0.18)';

    let cleanup = () => {};

    import('lightweight-charts').then(({ createChart, AreaSeries, ColorType, CrosshairMode }) => {
      if (!container) return;

      const chart = createChart(container, {
        width: container.clientWidth,
        height: 72,
        layout: {
          background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
          textColor: '#6b6b80',
        },
        grid: {
          vertLines: { visible: false },
          horzLines: { visible: false },
        },
        crosshair: {
          mode: CrosshairMode.Hidden,
        },
        rightPriceScale: { visible: false },
        leftPriceScale: { visible: false },
        timeScale: {
          visible: false,
          borderVisible: false,
        },
        handleScroll: false,
        handleScale: false,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor,
        topColor,
        bottomColor: 'rgba(0,0,0,0)',
        lineWidth: 2,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });

      series.setData(data.points as { time: string; value: number }[]);
      chart.timeScale().fitContent();

      // Responsive resize
      const ro = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width) chart.resize(width, 72);
      });
      ro.observe(container);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
      };
    });

    return () => cleanup();
  }, [data]);

  const isUp = data && data.changePct >= 0;
  const deltaBg = loading || !data
    ? 'var(--surface)'
    : isUp
    ? 'rgba(0, 217, 126, 0.12)'
    : 'rgba(246, 59, 59, 0.12)';
  const deltaColor = loading || !data
    ? 'var(--text-muted)'
    : isUp
    ? '#00d97e'
    : '#f63b3b';

  return (
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '16px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      minWidth: 0,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {label}
        </span>
        {/* Delta badge */}
        {!loading && !error && data && (
          <span style={{
            fontSize: '11px',
            fontWeight: 600,
            padding: '2px 6px',
            borderRadius: '4px',
            background: deltaBg,
            color: deltaColor,
          }}>
            {data.changePct >= 0 ? '+' : ''}{data.changePct.toFixed(2)}%
          </span>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <div style={{ height: '28px', background: 'var(--border)', borderRadius: '4px', width: '60%', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : error ? (
        <span style={{ fontSize: '13px', color: '#f63b3b' }}>Error</span>
      ) : (
        <span style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-primary)', lineHeight: 1 }}>
          {formatValue(data!.current)}
        </span>
      )}

      {/* Chart area */}
      {loading ? (
        <div style={{ height: '72px', background: 'var(--border)', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite' }} />
      ) : error ? (
        <div style={{ height: '72px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{error}</span>
        </div>
      ) : (
        <div ref={containerRef} style={{ height: '72px', width: '100%' }} />
      )}
    </div>
  );
}
