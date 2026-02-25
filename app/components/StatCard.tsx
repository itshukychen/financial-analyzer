import type { DeltaDirection } from '@/app/types';
import { cn } from '@/app/lib/utils';

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: DeltaDirection;
}

export default function StatCard({ label, value, delta, deltaDirection = 'neutral' }: StatCardProps) {
  const deltaColor =
    deltaDirection === 'up'
      ? 'var(--gain)'
      : deltaDirection === 'down'
      ? 'var(--loss)'
      : 'var(--text-muted)';

  const deltaBg =
    deltaDirection === 'up'
      ? 'rgba(0,217,126,0.1)'
      : deltaDirection === 'down'
      ? 'rgba(246,59,59,0.1)'
      : 'rgba(107,107,128,0.15)';

  return (
    <div
      className="flex flex-col gap-2 rounded-lg p-5 border"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>

      <div className="flex items-end justify-between gap-3">
        <span className="text-2xl font-bold tabular-nums tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {value}
        </span>

        {delta && (
          <span
            className={cn('text-xs font-semibold px-2 py-0.5 rounded-full tabular-nums')}
            style={{ color: deltaColor, background: deltaBg }}
          >
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}
