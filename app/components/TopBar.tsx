'use client';

import { formatDate } from '@/app/lib/utils';

interface TopBarProps {
  onMenuClick: () => void;
}

export default function TopBar({ onMenuClick }: TopBarProps) {
  const now = new Date();
  const dateStr = formatDate(now);

  return (
    <header
      className="sticky top-0 z-10 flex items-center justify-between px-4 md:px-6 py-3 border-b shrink-0"
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

      {/* Date */}
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {dateStr}
      </span>
    </header>
  );
}
