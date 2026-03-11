/**
 * Viewport configurations for screenshot capture.
 * Three standard sizes: mobile, tablet, desktop.
 */

export interface ViewportConfig {
  name: 'mobile' | 'tablet' | 'desktop';
  width: number;
  height: number;
}

export const VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile', width: 375, height: 812 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1440, height: 900 },
];

export type ViewportName = ViewportConfig['name'];
