import type { ReactNode } from 'react';

export type DeltaDirection = 'up' | 'down' | 'neutral';

export interface MarketQuote {
  symbol: string;
  name: string;
  price: number;
  delta: number;        // percentage
  direction: DeltaDirection;
}

export interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
}
