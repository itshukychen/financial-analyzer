'use client';

import { DataCard } from '@/app/components/ui/DataCard';
import type { Highlight } from '@/lib/types/options-ai';

interface HighlightsGridProps {
  highlights: Highlight[];
}

export function HighlightsGrid({ highlights }: HighlightsGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {highlights.map((h) => (
        <DataCard 
          key={h.label} 
          label={h.label} 
          value={h.value} 
          valueClassName={h.color ? `text-${h.color}` : ''} 
        />
      ))}
    </div>
  );
}
