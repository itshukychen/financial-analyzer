'use client';

import { useEffect, useState } from 'react';
import type { FearGreedData } from '@/app/api/fear-greed/route';

// ── Arc math helpers ──────────────────────────────────────────────────────────
const toRad = (d: number) => (d * Math.PI) / 180;
const arcX  = (cx: number, r: number, deg: number) => cx + r * Math.cos(toRad(deg));
const arcY  = (cy: number, r: number, deg: number) => cy - r * Math.sin(toRad(deg)); // SVG y is inverted

// Background arc: 180° → 0°
const BG_PATH = `M ${arcX(60,50,180)} ${arcY(65,50,180)} A 50 50 0 0 1 ${arcX(60,50,0)} ${arcY(65,50,0)}`;

function buildValuePath(score: number): string {
  if (score === 0) return '';
  const scoreAngle = 180 - (score / 100) * 180;
  const isLargeArc = score > 50 ? 1 : 0;
  return `M ${arcX(60,50,180)} ${arcY(65,50,180)} A 50 50 0 ${isLargeArc} 1 ${arcX(60,50,scoreAngle)} ${arcY(65,50,scoreAngle)}`;
}

// ── Zone color ────────────────────────────────────────────────────────────────
function zoneColor(score: number): string {
  if (score <= 24) return '#ef4444'; // Extreme Fear — red
  if (score <= 44) return '#f97316'; // Fear — orange
  if (score <= 55) return '#eab308'; // Neutral — yellow
  if (score <= 74) return '#84cc16'; // Greed — light green
  return '#22c55e';                  // Extreme Greed — green
}

// ── Delta badge ───────────────────────────────────────────────────────────────
function Delta({ current, prev }: { current: number; prev: number }) {
  const diff  = current - prev;
  const color = diff > 0 ? '#22c55e' : diff < 0 ? '#ef4444' : 'var(--text-muted)';
  const arrow = diff > 0 ? '↑' : diff < 0 ? '↓' : '→';
  return <span style={{ color, fontSize: 11 }}>{arrow} {Math.abs(diff)}</span>;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton() {
  return (
    <div
      data-testid="fear-greed-skeleton"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: 0,
      }}
    >
      {/* gauge placeholder */}
      <div style={{
        height: '80px',
        background: 'var(--border)',
        borderRadius: '6px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
      {/* comparison placeholder */}
      <div style={{
        height: '48px',
        background: 'var(--border)',
        borderRadius: '6px',
        animation: 'pulse 1.5s ease-in-out infinite',
      }} />
    </div>
  );
}

// ── Main widget ───────────────────────────────────────────────────────────────
export default function FearGreedWidget() {
  const [data,    setData]    = useState<FearGreedData | null>(null);
  const [error,   setError]   = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/fear-greed')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((json: FearGreedData & { error?: string }) => {
        if (json.error) throw new Error(json.error);
        setData(json);
      })
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Skeleton />;

  if (error) {
    return (
      <div
        data-testid="fear-greed-error"
        style={{
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '10px',
          padding: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span style={{ fontSize: '11px', color: '#f63b3b' }}>
          Fear &amp; Greed unavailable
        </span>
      </div>
    );
  }

  if (!data) return null;

  const { score, rating, previousClose, previous1Week, previous1Month, previous1Year } = data;
  const color     = zoneColor(score);
  const valuePath = buildValuePath(score);

  return (
    <div
      data-testid="fear-greed-card"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        minWidth: 0,
      }}
    >
      {/* ── Header row ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          color: 'var(--text-muted)',
        }}>
          Fear &amp; Greed
        </span>
        <span style={{ fontSize: '10px', color: 'var(--text-muted)', opacity: 0.7 }}>CNN</span>
      </div>

      {/* ── Arc gauge ── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
        <svg viewBox="0 0 120 70" style={{ width: '100%', maxWidth: '140px' }}>
          {/* Background arc */}
          <path
            d={BG_PATH}
            fill="none"
            stroke="var(--border)"
            strokeWidth="8"
            strokeLinecap="round"
          />
          {/* Value arc */}
          {valuePath && (
            <path
              d={valuePath}
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
            />
          )}
          {/* Score text — centered in the arc */}
          <text
            data-testid="fear-greed-score"
            x="60"
            y="60"
            textAnchor="middle"
            dominantBaseline="auto"
            fill={color}
            fontSize="20"
            fontWeight="700"
            fontFamily="inherit"
          >
            {score}
          </text>
        </svg>

        {/* Rating label */}
        <span
          data-testid="fear-greed-rating"
          style={{ fontSize: '12px', fontWeight: 600, color, lineHeight: 1 }}
        >
          {rating}
        </span>
      </div>

      {/* ── Comparison grid ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px 8px',
        marginTop: '4px',
      }}>
        {[
          { label: 'Prev Close', value: previousClose },
          { label: '1 Week Ago', value: previous1Week },
          { label: '1 Month Ago', value: previous1Month },
          { label: '1 Year Ago', value: previous1Year },
        ].map(({ label, value }) => (
          <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1 }}>
              {label}
            </span>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1 }}>
              {value} <Delta current={score} prev={value} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
