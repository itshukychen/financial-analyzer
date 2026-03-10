export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function Card({ children, className = '', ...props }: CardProps) {
  return (
    <div 
      className={`rounded-lg border border-border bg-background ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
