'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import AppShell from '@/app/components/AppShell';
import StatCard from '@/app/components/StatCard';

interface SnapshotData {
  ticker: string;
  timestamp: string;
  volatility: {
    iv_30d: number;
    iv_60d: number;
    hv_20d: number;
    hv_60d: number;
    iv_rank: number;
  };
  greeks: {
    net_delta: number;
    atm_gamma: number;
    vega_per_1pct: number;
    theta_daily: number;
  };
  skew: {
    call_otm_iv_25d: number;
    put_otm_iv_25d: number;
    skew_ratio: number;
    skew_direction: 'call_heavy' | 'put_heavy' | 'balanced';
  };
  implied_move: {
    '1w_move_pct': number;
    '30d_move_pct': number;
    '1w_conf_low': number;
    '1w_conf_high': number;
    '2sd_low': number;
    '2sd_high': number;
  };
  regime: 'low' | 'normal' | 'high';
}

interface ProjectionData {
  ticker: string;
  date: string;
  expiry_horizon: number;
  prob_distribution: Array<{ price: number; probability: number }>;
  keyLevels: Array<{
    level: number;
    type: 'mode' | '2sd_low' | '2sd_high' | 'support' | 'resistance';
    probability: number | null;
  }>;
  regimeTransition: {
    from: string;
    to: string;
    confidence: number;
  };
}

export default function OptionProjectionReport() {
  const [snapshot, setSnapshot] = useState<SnapshotData | null>(null);
  const [projection, setProjection] = useState<ProjectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const [snapshotRes, projectionRes] = await Promise.all([
          fetch('/api/options/snapshot?ticker=SPWX&expiry=30d'),
          fetch('/api/options/projection?ticker=SPWX&horizonDays=30'),
        ]);

        if (!snapshotRes.ok || !projectionRes.ok) {
          throw new Error('Failed to fetch data');
        }

        const snapshotData = await snapshotRes.json();
        const projectionData = await projectionRes.json();

        setSnapshot(snapshotData);
        setProjection(projectionData);
      } catch (err) {
        console.error('Failed to fetch report data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin">⟳</div>
            <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
              Loading option analysis...
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  if (error || !snapshot || !projection) {
    return (
      <AppShell>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <p style={{ color: 'var(--loss)', fontSize: '1.125rem', fontWeight: '600' }}>
              Unable to load report
            </p>
            {error && (
              <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem' }}>{error}</p>
            )}
            <Link href="/" className="text-sm" style={{ color: 'var(--accent)' }}>
              ← Back to dashboard
            </Link>
          </div>
        </div>
      </AppShell>
    );
  }

  const ivSpread = snapshot.volatility.iv_30d - snapshot.volatility.hv_20d;

  return (
    <AppShell>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Custom header for option projection report */}
        <div
          className="rounded-xl border p-6 mb-6"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        >
          <h1
            className="text-2xl font-bold mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            SPWX Option Price Projection
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Put Options Analysis & Price Forecasting — {projection.date}
          </p>
        </div>

        {/* Executive Summary */}
        <SectionCard title="Executive Summary">
          <div style={{ color: 'var(--text-primary)' }}>
            <p className="text-lg font-semibold mb-4">
              {getHeadline(snapshot)}
            </p>
            <div className="grid grid-cols-2 gap-4">
              <ProjectionCard
                horizon="1 Week"
                low={Math.round(snapshot.implied_move['1w_conf_low'])}
                high={Math.round(snapshot.implied_move['1w_conf_high'])}
              />
              <ProjectionCard
                horizon="4 Weeks"
                low={Math.round(snapshot.implied_move['2sd_low'])}
                high={Math.round(snapshot.implied_move['2sd_high'])}
              />
            </div>
          </div>
        </SectionCard>

        {/* Put IV & Skew */}
        <SectionCard title="Put Implied Volatility & Skew">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Put IV (ATM)"
              value={`${snapshot.volatility.iv_30d.toFixed(1)}%`}
            />
            <StatCard
              label="IV Rank"
              value={`${snapshot.volatility.iv_rank}`}
            />
            <StatCard
              label="Skew Ratio"
              value={snapshot.skew.skew_ratio.toFixed(2)}
            />
            <StatCard
              label="IV/HV Spread"
              value={`${ivSpread.toFixed(1)}%`}
            />
          </div>
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            {getSkewInterpretation(snapshot.skew)}
          </p>
        </SectionCard>

        {/* Greeks */}
        <SectionCard title="Greeks Aggregates">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Net Delta"
              value={snapshot.greeks.net_delta.toFixed(0)}
            />
            <StatCard
              label="ATM Gamma"
              value={snapshot.greeks.atm_gamma.toFixed(4)}
            />
            <StatCard
              label="Vega (per 1%)"
              value={snapshot.greeks.vega_per_1pct.toFixed(0)}
            />
            <StatCard
              label="Theta (daily)"
              value={snapshot.greeks.theta_daily.toFixed(0)}
            />
          </div>
          <p
            className="mt-4 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >
            Greeks indicate the sensitivity of the option portfolio to various market
            factors. Negative theta shows time decay benefiting sellers.
          </p>
        </SectionCard>

        {/* Probability Distribution */}
        <SectionCard title="Implied Price Distribution">
          <div
            className="h-64 flex items-center justify-center border rounded mb-4"
            style={{ borderColor: 'var(--border)' }}
          >
            <ProbabilityHistogram data={projection.prob_distribution} />
          </div>
          <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
            <p className="font-semibold mb-2">Key Levels:</p>
            <ul className="list-disc list-inside space-y-1">
              {projection.keyLevels.map(level => (
                <li key={level.level}>
                  <span style={{ color: 'var(--text-primary)' }}>
                    ${level.level}
                  </span>{' '}
                  ({level.type})
                </li>
              ))}
            </ul>
          </div>
        </SectionCard>

        {/* Regime */}
        <SectionCard title="Volatility Regime">
          <div className="grid grid-cols-2 gap-4">
            <RegimeCard label="Current" regime={snapshot.regime} />
            <RegimeCard label="Projection" regime={projection.regimeTransition.to} />
          </div>
        </SectionCard>

        <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
          <Link href="/" className="text-sm" style={{ color: 'var(--accent)' }}>
            ← Back to dashboard
          </Link>
        </div>
      </div>
    </AppShell>
  );
}

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl border p-6"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <h2
        className="text-lg font-bold mb-4"
        style={{ color: 'var(--text-primary)' }}
      >
        {title}
      </h2>
      {children}
    </div>
  );
}

function ProjectionCard({
  horizon,
  low,
  high,
}: {
  horizon: string;
  low: number;
  high: number;
}) {
  return (
    <div
      className="border rounded p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <h4
        className="text-sm font-semibold mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        {horizon} Range
      </h4>
      <p
        className="text-xl font-bold"
        style={{ color: 'var(--text-primary)' }}
      >
        ${low} - ${high}
      </p>
    </div>
  );
}

function RegimeCard({
  label,
  regime,
}: {
  label: string;
  regime: string;
}) {
  const color =
    regime === 'low'
      ? 'var(--gain)'
      : regime === 'high'
        ? 'var(--loss)'
        : 'var(--text-muted)';

  const icon =
    regime === 'low'
      ? '🟢'
      : regime === 'high'
        ? '🔴'
        : '⚪';

  return (
    <div
      className="border rounded p-4"
      style={{ borderColor: 'var(--border)' }}
    >
      <h4
        className="text-sm font-semibold mb-2"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </h4>
      <p className="text-lg font-bold" style={{ color }}>
        {icon} {regime.charAt(0).toUpperCase() + regime.slice(1)}
      </p>
    </div>
  );
}

function ProbabilityHistogram({
  data,
}: {
  data: Array<{ price: number; probability: number }>;
}) {
  if (data.length === 0) {
    return <p style={{ color: 'var(--text-muted)' }}>No distribution data</p>;
  }

  const maxProb = Math.max(...data.map(d => d.probability));

  return (
    <div className="w-full h-full flex items-end justify-center gap-1 p-4">
      {data.map((point, idx) => (
        <div
          key={idx}
          className="flex-1 rounded-t transition-colors hover:opacity-80"
          style={{
            height: `${(point.probability / maxProb) * 100}%`,
            background: 'var(--accent)',
            minHeight: '4px',
            cursor: 'pointer',
          }}
          title={`$${point.price}: ${(point.probability * 100).toFixed(1)}%`}
        />
      ))}
    </div>
  );
}

function getHeadline(snapshot: SnapshotData): string {
  const regime = snapshot.regime;
  const skew = snapshot.skew.skew_direction;

  if (regime === 'high' && skew === 'put_heavy') {
    return '⚠️ High volatility + put hedging demand — downside protection expensive';
  } else if (regime === 'low' && skew === 'call_heavy') {
    return '📈 Low volatility + call demand — bullish sentiment';
  }
  return '📊 Normal volatility regime — balanced market';
}

function getSkewInterpretation(skew: SnapshotData['skew']): string {
  if (skew.skew_direction === 'put_heavy') {
    return 'Puts are more expensive than calls (skew ratio > 1.05). Market participants are buying downside protection, indicating concern about potential drops.';
  } else if (skew.skew_direction === 'call_heavy') {
    return 'Calls are more expensive than puts (skew ratio < 0.95). This suggests bullish positioning and potential for upside moves.';
  }
  return 'Skew is balanced. No strong directional bias in option pricing.';
}
