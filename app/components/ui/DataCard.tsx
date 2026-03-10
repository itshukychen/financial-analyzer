export interface DataCardProps {
  label: string;
  value: string | number;
  valueClassName?: string;
}

export function DataCard({ label, value, valueClassName = '' }: DataCardProps) {
  return (
    <div className="flex flex-col gap-2 p-4 rounded-lg bg-background-secondary border border-border-secondary">
      <span className="text-xs font-medium text-text-secondary uppercase">{label}</span>
      <span className={`text-lg font-bold text-text-primary ${valueClassName}`}>
        {value}
      </span>
    </div>
  );
}
