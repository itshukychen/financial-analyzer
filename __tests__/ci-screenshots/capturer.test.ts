import { describe, it, expect } from 'vitest';
import { routeToSlug, buildFilename } from '../../scripts/ci-screenshots/screenshot-capturer';
import type { ViewportConfig } from '../../scripts/ci-screenshots/viewport-configs';

describe('routeToSlug', () => {
  it('converts / to "home"', () => {
    expect(routeToSlug('/')).toBe('home');
  });

  it('strips leading slash', () => {
    expect(routeToSlug('/markets')).toBe('markets');
  });

  it('converts nested paths to dashes', () => {
    expect(routeToSlug('/markets/options')).toBe('markets-options');
  });
});

describe('buildFilename', () => {
  const desktop: ViewportConfig = { name: 'desktop', width: 1440, height: 900 };
  const mobile: ViewportConfig = { name: 'mobile', width: 375, height: 812 };

  it('builds correct filename for home', () => {
    expect(buildFilename('/', desktop)).toBe('home-desktop.png');
  });

  it('builds correct filename for named routes', () => {
    expect(buildFilename('/markets', mobile)).toBe('markets-mobile.png');
  });

  it('builds correct filename for nested routes', () => {
    expect(buildFilename('/markets/options', desktop)).toBe('markets-options-desktop.png');
  });
});
