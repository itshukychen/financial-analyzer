import { formatDate } from '@/app/lib/utils';

export default function TopBar() {
  const now = new Date();
  const dateStr = formatDate(now);

  return (
    <header
      className="flex items-center justify-end px-6 py-3 border-b shrink-0"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
        {dateStr}
      </span>
    </header>
  );
}
