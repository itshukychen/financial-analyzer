'use client';

import { Card } from '@/app/components/ui/Card';
import { DataCard } from '@/app/components/ui/DataCard';
import type { NextDayProjection } from '@/lib/types/options-ai';

interface NextDayForecastProps {
  projection: NextDayProjection;
}

export function NextDayForecast({ projection }: NextDayForecastProps) {
  const confidenceColor = {
    high: 'text-gain',
    medium: 'text-neutral',
    low: 'text-loss',
  }[projection.confidence];

  return (
    <Card className="p-6 bg-accent/5 border-accent">
      <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
        <span>🎯</span>
        <span>Next Trading Day Forecast</span>
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <DataCard
          label="Target Range"
          value={`$${projection.targetLow.toFixed(2)}–$${projection.targetHigh.toFixed(2)}`}
        />
        <DataCard 
          label="Confidence" 
          value={projection.confidence.toUpperCase()} 
          valueClassName={confidenceColor} 
        />
        <DataCard 
          label="Move >1% Probability" 
          value={`${(projection.moveProb * 100).toFixed(0)}%`} 
        />
      </div>

      <p className="text-text-secondary leading-relaxed">{projection.description}</p>
    </Card>
  );
}
