'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

const VALID_RANGES = ['1D', '5D', '1M', '3M', '6M', '1Y', 'YTD'] as const;
type Range = typeof VALID_RANGES[number];

const FRED_TICKERS = new Set(['DGS2', 'DGS10']);

interface ChartModalProps {
  ticker:      string;
  label:       string;
  formatValue: (v: number) => string;
  onClose:     () => void;
}

interface DataPoint {
  time:  string;
  value: number;
}

interface RangeData {
  points:       DataPoint[];
  current:      number;
  changePct:    number;
  unsupported?: boolean;
}

export default function ChartModal({ ticker, label, formatValue, onClose }: ChartModalProps) {
  const [range, setRange]     = useState<Range>('1M');
  const [data, setData]       = useState<RangeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const chartContainerRef = useRef<HTMLDivElement>(null);
  const tooltipRef        = useRef<HTMLDivElement>(null);
  const abortRef          = useRef<AbortController | null>(null);

  const isFredTicker = FRED_TICKERS.has(ticker);

  function isDisabled(r: Range): boolean {
    return r === '1D' && isFredTicker;
  }

  // Data fetch effect
  useEffect(() => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setData(null);

    fetch(`/api/market/chart/${encodeURIComponent(ticker)}?range=${range}`, {
      signal: controller.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json) => {
        if (json.error) throw new Error(json.error);
        setData({
          points:      json.points ?? [],
          current:     json.current ?? 0,
          changePct:   json.changePct ?? 0,
          unsupported: json.unsupported ?? false,
        });
      })
      .catch((e: Error) => {
        if (e.name === 'AbortError') return; // superseded — ignore
        setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [ticker, range]);

  // ESC key effect
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Chart effect
  const stableFormatValue = useCallback(formatValue, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!data || !data.points.length || !chartContainerRef.current) return;

    const container = chartContainerRef.current;
    const tooltipEl = tooltipRef.current;
    const isUp      = data.changePct >= 0;
    const lineColor  = isUp ? '#00d97e' : '#f63b3b';
    const topColor   = isUp ? 'rgba(0,217,126,0.18)' : 'rgba(246,59,59,0.18)';

    let cleanup = () => {};

    import('lightweight-charts').then(({ createChart, AreaSeries, ColorType, CrosshairMode }) => {
      if (!container) return;

      const chart = createChart(container, {
        width:  container.clientWidth,
        height: container.clientHeight,
        layout: {
          background: { type: ColorType.Solid, color: 'rgba(0,0,0,0)' },
          textColor:  '#6b6b80',
        },
        grid: {
          vertLines: { color: 'rgba(255,255,255,0.04)' },
          horzLines: { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: { mode: CrosshairMode.Normal },
        rightPriceScale: { visible: true, borderVisible: false },
        leftPriceScale:  { visible: false },
        timeScale:       { visible: true, borderVisible: false },
        handleScroll: { mouseWheel: false, pressedMouseMove: true },
        handleScale:  false,
      });

      const series = chart.addSeries(AreaSeries, {
        lineColor,
        topColor,
        bottomColor:            'rgba(0,0,0,0)',
        lineWidth:              2,
        priceLineVisible:       false,
        lastValueVisible:       false,
        crosshairMarkerVisible: true,
      });

      series.setData(data.points as { time: string; value: number }[]);
      chart.timeScale().fitContent();

      // Custom tooltip via crosshair subscription
      if (tooltipEl) {
        chart.subscribeCrosshairMove((param) => {
          if (!param.point || !param.time || !param.seriesData.get(series)) {
            tooltipEl.style.display = 'none';
            return;
          }
          const seriesValue = (param.seriesData.get(series) as { value: number } | undefined)?.value;
          if (seriesValue === undefined) { tooltipEl.style.display = 'none'; return; }

          // Build tooltip content
          const timeStr = typeof param.time === 'string'
            ? param.time
            : String(param.time);

          let dateLabel = timeStr;
          try {
            const parsed = new Date(timeStr.length === 10 ? timeStr + 'T00:00:00' : timeStr);
            if (!isNaN(parsed.getTime())) {
              dateLabel = parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            }
          } catch { /* use raw timeStr */ }

          tooltipEl.innerHTML =
            `<div style="color:var(--text-muted);font-size:11px">${dateLabel}</div>` +
            `<div style="color:var(--text-primary);font-weight:700">${stableFormatValue(seriesValue)}</div>`;

          // Position tooltip, clamped within container
          const tw = tooltipEl.offsetWidth;
          const th = tooltipEl.offsetHeight;
          let left = param.point.x + 12;
          let top  = param.point.y - th - 8;
          if (left + tw > container.clientWidth)  left = param.point.x - tw - 12;
          if (top < 0)                            top  = param.point.y + 12;
          tooltipEl.style.left    = left + 'px';
          tooltipEl.style.top     = top  + 'px';
          tooltipEl.style.display = 'block';
        });
      }

      // Responsive resize
      const ro = new ResizeObserver((entries) => {
        const e = entries[0];
        if (e) chart.resize(e.contentRect.width, e.contentRect.height);
      });
      ro.observe(container);

      cleanup = () => {
        ro.disconnect();
        chart.remove();
        if (tooltipEl) tooltipEl.style.display = 'none';
      };
    });

    return () => cleanup();
  }, [data, stableFormatValue]);

  // changePct badge styling
  const isUp      = data && data.changePct >= 0;
  const deltaBg   = !data ? 'transparent' : isUp ? 'rgba(0,217,126,0.12)' : 'rgba(246,59,59,0.12)';
  const deltaColor = !data ? 'var(--text-muted)' : isUp ? '#00d97e' : '#f63b3b';

  return (
    <div
      data-testid="chart-modal"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} chart`}
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Inner panel — stop click propagation so backdrop-click-to-close works */}
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '1000px',
          margin: '16px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          height: 'calc(100vh - 32px)',
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 20px 0',
        }}>
          <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
            {label}
          </span>
          {/* changePct badge — only when data is loaded */}
          {data && !data.unsupported && (
            <span style={{
              fontSize: '13px',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '4px',
              background: deltaBg as string,
              color: deltaColor as string,
            }}>
              {data.changePct >= 0 ? '+' : ''}{data.changePct.toFixed(2)}%
            </span>
          )}
          {/* Close button */}
          <button
            data-testid="modal-close-btn"
            onClick={onClose}
            aria-label="Close chart"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
            }}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Range buttons row */}
        <div style={{ display: 'flex', gap: '6px', padding: '12px 20px' }}>
          {VALID_RANGES.map((r) => (
            <button
              key={r}
              data-testid={`range-btn-${r}`}
              onClick={() => { if (!isDisabled(r)) setRange(r); }}
              disabled={isDisabled(r)}
              style={{
                padding: '4px 10px',
                borderRadius: '6px',
                border: range === r ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: range === r ? 'rgba(99,102,241,0.15)' : 'transparent',
                color: range === r ? 'var(--accent)' : isDisabled(r) ? 'var(--text-muted)' : 'var(--text-primary)',
                cursor: isDisabled(r) ? 'not-allowed' : 'pointer',
                opacity: isDisabled(r) ? 0.4 : 1,
                fontSize: '12px',
                fontWeight: 600,
                transition: 'all 0.1s ease',
              }}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Chart area — takes remaining height */}
        <div style={{
          flex: 1,
          minHeight: '400px',
          padding: '0 20px 20px',
          position: 'relative',
        }}>
          {loading && (
            <div
              data-testid="modal-chart-skeleton"
              style={{
                position: 'absolute',
                inset: '0 20px 20px',
                borderRadius: '6px',
                background: 'var(--border)',
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          )}
          {!loading && error && (
            <div
              data-testid="modal-chart-error"
              style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{error}</span>
            </div>
          )}
          {!loading && !error && (!data?.points?.length || data?.unsupported) && (
            <div
              data-testid="modal-chart-empty"
              style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No data available for this range</span>
            </div>
          )}
          {/* Chart container — always mounted so ref stays stable */}
          <div
            ref={chartContainerRef}
            data-testid="modal-chart-container"
            style={{
              width: '100%',
              height: '100%',
              visibility: loading || !!error || !data?.points?.length || data?.unsupported ? 'hidden' : 'visible',
            }}
          />
          {/* Custom tooltip */}
          <div
            ref={tooltipRef}
            data-testid="chart-tooltip"
            style={{
              position: 'absolute',
              display: 'none',
              pointerEvents: 'none',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '6px 10px',
              fontSize: '12px',
              color: 'var(--text-primary)',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}
          />
        </div>
      </div>
    </div>
  );
}
