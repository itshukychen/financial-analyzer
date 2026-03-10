'use client';

import { Card } from '@/app/components/ui/Card';
import { HighlightsGrid } from './HighlightsGrid';
import type { Section } from '@/lib/types/options-ai';

export function AnalysisSection({ title, icon, prose, highlights }: Section) {
  return (
    <Card className="p-6">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span>{icon}</span>
        <span>{title}</span>
      </h2>

      <p className="text-text-secondary leading-relaxed mb-4">{prose}</p>

      {highlights && highlights.length > 0 && <HighlightsGrid highlights={highlights} />}
    </Card>
  );
}
