import '@testing-library/jest-dom';
import { vi } from 'vitest';
import React from 'react';

// Mock next/navigation
vi.mock('next/navigation', () => ({
  usePathname: vi.fn(() => '/'),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
}));

// Mock next/image
vi.mock('next/image', () => ({
  default: () => null,
}));

// Mock next/link — render as a plain anchor
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    [key: string]: unknown;
  }) => React.createElement('a', { href, ...rest }, children),
}));

// Mock lightweight-charts — it needs a real DOM canvas which jsdom doesn't support
vi.mock('lightweight-charts', () => {
  const mockSeries = {
    setData: vi.fn(),
    applyOptions: vi.fn(),
  };
  const mockTimeScale = {
    fitContent: vi.fn(),
  };
  const mockChart = {
    addSeries: vi.fn(() => mockSeries),
    timeScale: vi.fn(() => mockTimeScale),
    resize: vi.fn(),
    remove: vi.fn(),
    applyOptions: vi.fn(),
    subscribeCrosshairMove: vi.fn(),
  };
  return {
    createChart: vi.fn(() => mockChart),
    AreaSeries: { type: 'Area' },
    ColorType: { Solid: 'solid' },
    CrosshairMode: { Hidden: 2, Normal: 0, Magnet: 1 },
  };
});

// ResizeObserver is not available in jsdom
global.ResizeObserver = class ResizeObserver {
  observe = vi.fn();
  unobserve = vi.fn();
  disconnect = vi.fn();
};

// Mock database functions for API tests
vi.mock('@/lib/db', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/lib/db')>();
  
  // Test data for SPWX option snapshots
  const mockSnapshots = {
    'SPWX-30d': {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPWX',
      expiry: '30d',
      iv_30d: 0.28,
      iv_60d: 0.25,
      hv_20d: 0.22,
      hv_60d: 0.20,
      iv_rank: 55,
      net_delta: -0.15,
      atm_gamma: 0.035,
      vega_per_1pct: 18.5,
      theta_daily: -1.25,
      call_otm_iv: 19,
      put_otm_iv: 21,
      skew_ratio: 1.1,
      implied_move_pct: 2.5,
      regime: 'normal',
      raw_json: JSON.stringify({
        spotPrice: 156.75,
        timestamp: Date.now(),
      }),
      created_at: Math.floor(Date.now() / 1000),
    },
  };

  // Test data for SPWX option projections
  const mockProjections = {
    'SPWX-30': {
      id: 1,
      date: '2026-03-09',
      ticker: 'SPWX',
      horizon_days: 30,
      prob_distribution: [
        { price: 150, probability: 0.05 },
        { price: 153, probability: 0.15 },
        { price: 156, probability: 0.30 },
        { price: 156.75, probability: 0.25 },
        { price: 160, probability: 0.15 },
        { price: 163, probability: 0.10 },
      ],
      key_levels: [
        { level: 156.75, type: 'mode' },
        { level: 150.69, type: '2sd_low' },
        { level: 162.81, type: '2sd_high' },
        { level: 154.22, type: 'support' },
        { level: 159.28, type: 'resistance' },
      ],
      regime_classification: 'normal',
      created_at: Math.floor(Date.now() / 1000),
    },
  };

  return {
    ...original,
    getLatestOptionSnapshot: vi.fn((ticker: string, expiry: string) => {
      const key = `${ticker}-${expiry}`;
      return mockSnapshots[key as keyof typeof mockSnapshots] || null;
    }),
    getLatestOptionProjection: vi.fn((ticker: string, horizonDays: number) => {
      const key = `${ticker}-${horizonDays}`;
      return mockProjections[key as keyof typeof mockProjections] || null;
    }),
  };
});
