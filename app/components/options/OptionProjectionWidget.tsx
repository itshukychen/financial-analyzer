'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StatCard from '@/app/components/StatCard';

interface SnapshotData {
  volatility: { iv_30d: number; iv_rank: number };
  implied_move: { '1w_move_pct': number };
  regime: 'low' | 'normal' | 'high';
  timestamp: string;
}

export default function OptionProjectionWidget() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/options/snapshot?ticker=SPWX&expiry=30d');
        
        if (!res.ok) {
          throw new Error(`API error: ${res.statusText}`);
        }
        
        const json = await res.json();
        setData(json);
      } catch (err) {
        console.error('Failed to fetch option data:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div
        className="flex flex-col gap-4 rounded-lg p-6 border animate-pulse"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        data-testid="option-projection-skeleton"
      >
        <div className="h-6 w-40 rounded bg-neutral-300 dark:bg-neutral-700" />
        <div className="space-y-3">
          <div className="h-20 w-full rounded bg-neutral-300 dark:bg-neutral-700" />
          <div className="h-20 w-full rounded bg-neutral-300 dark:bg-neutral-700" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div
        className="flex flex-col gap-4 rounded-lg p-6 border"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
        data-testid="option-projection-error"
      >
        <p style={{ color: 'var(--loss)' }}>Unable to load option data</p>
        {error && <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{error}</p>}
      </div>
    );
  }

  const regimeColor =
    data.regime === 'low'
      ? 'var(--gain)'
      : data.regime === 'high'
        ? 'var(--loss)'
        : 'var(--text-muted)';

  const regimeLabel =
    data.regime === 'low'
      ? '🟢 Low Volatility'
      : data.regime === 'high'
        ? '🔴 High Volatility'
        : '⚪ Normal Volatility';

  return (
    <div
      className="flex flex-col gap-4 rounded-lg p-6 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
      data-testid="option-projection-card"
    >
      <header className="flex justify-between items-start">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
          Option Projection
        </h3>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Last updated: {new Date(data.timestamp).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            timeZone: 'America/New_York',
          })}{' '}
          ET
        </span>
      </header>

      <div className="grid grid-cols-2 gap-3">
        <StatCard
          label="Implied Move (1w)"
          value={`±${data.implied_move['1w_move_pct'].toFixed(1)}%`}
        />
        <StatCard
          label="30d IV"
          value={`${data.volatility.iv_30d.toFixed(1)}%`}
          delta={`Rank: ${data.volatility.iv_rank}`}
        />
      </div>

      <div
        className="text-center py-2 px-3 rounded-md text-sm font-semibold"
        style={{ color: regimeColor, background: `${regimeColor}22` }}
      >
        {regimeLabel}
      </div>

      <Link
        href="/reports/option-projection"
        className="text-sm font-medium hover:underline"
        style={{ color: 'var(--accent)' }}
      >
        View Full Analysis →
      </Link>
    </div>
  );
}
