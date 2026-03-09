'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/app/lib/utils';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const [healthOk, setHealthOk] = useState<boolean | null>(null);
  const now = new Date();
  const dateStr = formatDate(now);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => { if (data.ok) setHealthOk(true); })
      .catch(() => setHealthOk(null));
  }, []);

  return (
    <header
      className="flex items-center justify-between px-4 md:px-6 py-3 border-b shrink-0"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Hamburger — mobile only */}
      <button
        onClick={onMenuClick}
        className="lg:hidden flex flex-col justify-center gap-[5px] w-8 h-8 rounded"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Open navigation"
        aria-expanded="false"
      >
        <span className="block w-5 h-[1.5px] rounded-full bg-current" />
        <span className="block w-5 h-[1.5px] rounded-full bg-current" />
        <span className="block w-3.5 h-[1.5px] rounded-full bg-current" />
      </button>

      {/* Spacer on desktop (no hamburger) */}
      <div className="hidden lg:block" />

      {/* Right side: badge + date */}
      <div className="flex items-center gap-3">
        {healthOk === true && (
          <div
            data-testid="health-badge"
            title="System OK"
            style={{ color: 'var(--accent)' }}
            className="text-lg leading-none cursor-default"
          >
            ●
          </div>
        )}
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {dateStr}
        </span>
      </div>
    </header>
  );
}
