interface ReportSectionProps {
  title:   string;
  icon:    React.ReactNode;
  content: string;
}

export default function ReportSection({ title, icon, content }: ReportSectionProps) {
  // Split on double newlines → separate <p> paragraphs; single newlines preserved as-is
  const paragraphs = content
    .split(/\n\n+/)
    .map(para => para.trim())
    .filter(Boolean);

  return (
    <div
      className="rounded-xl border p-5 flex flex-col gap-3"
      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}
    >
      {/* Title row */}
      <div className="flex items-center gap-2">
        <span
          className="flex items-center justify-center w-7 h-7 rounded-md"
          style={{ background: 'rgba(99,102,241,0.12)', color: 'var(--accent)' }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <h3
          className="text-sm font-semibold uppercase tracking-wider"
          style={{ color: 'var(--text-primary)' }}
        >
          {title}
        </h3>
      </div>

      {/* Content paragraphs */}
      <div className="flex flex-col gap-2">
        {paragraphs.map((para, i) => (
          <p key={i} className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary, var(--text-muted))' }}>
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}
