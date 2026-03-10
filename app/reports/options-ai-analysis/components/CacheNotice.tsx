'use client';

import type { Metadata } from '@/lib/types/options-ai';

interface CacheNoticeProps {
  metadata: Metadata;
}

export function CacheNotice({ metadata }: CacheNoticeProps) {
  const minutesAgo = Math.floor(metadata.cacheAge / 60);
  const hoursAgo = Math.floor(minutesAgo / 60);

  const ageText = hoursAgo >= 1 ? `${hoursAgo}h ago` : `${minutesAgo}m ago`;

  return (
    <div className="text-center text-sm text-text-tertiary py-4">
      <p>
        Generated {ageText} • Next update:{' '}
        {new Date(metadata.nextUpdate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
