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
