interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  right?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, badge, right }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="shrink-0 flex items-center gap-2">
        {badge && (
          <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ backgroundColor: 'var(--border)', color: 'var(--text-secondary)' }}>
            {badge}
          </span>
        )}
        {right}
      </div>
    </div>
  );
}
