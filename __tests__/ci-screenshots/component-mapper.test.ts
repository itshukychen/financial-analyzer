import { describe, it, expect } from 'vitest';
import { mapChangesToRoutes } from '../../scripts/ci-screenshots/component-mapper';
import type { ChangedFile } from '../../scripts/ci-screenshots/git-diff-analyzer';

function makeFile(path: string, category: ChangedFile['category'] = 'component'): ChangedFile {
  return { path, category, changeType: 'modified', isBinary: false };
}

describe('mapChangesToRoutes', () => {
  it('returns empty array when no changed files', () => {
    expect(mapChangesToRoutes([])).toEqual([]);
  });

  it('marks all routes as global when globals.css changes', () => {
    const result = mapChangesToRoutes([makeFile('app/globals.css', 'style')]);
    expect(result.length).toBeGreaterThanOrEqual(5);
    expect(result.every((r) => r.priority === 'global')).toBe(true);
  });

  it('assigns direct priority for page.tsx changes', () => {
    const result = mapChangesToRoutes([makeFile('app/markets/page.tsx', 'page')]);
    const markets = result.find((r) => r.path === '/markets');
    expect(markets).toBeDefined();
    expect(markets?.priority).toBe('direct');
  });

  it('assigns indirect priority for component changes', () => {
    const result = mapChangesToRoutes([makeFile('src/components/StockCard.tsx', 'component')]);
    // StockCard is used by / and /watchlist
    const home = result.find((r) => r.path === '/');
    const watchlist = result.find((r) => r.path === '/watchlist');
    expect(home?.priority).toBe('indirect');
    expect(watchlist?.priority).toBe('indirect');
  });

  it('deduplicates routes affected by multiple changes', () => {
    const files: ChangedFile[] = [
      makeFile('app/markets/page.tsx', 'page'),
      makeFile('src/components/charts/index.tsx', 'component'),
    ];
    const result = mapChangesToRoutes(files);
    const paths = result.map((r) => r.path);
    // Should not contain /markets twice
    expect(paths.filter((p) => p === '/markets').length).toBe(1);
  });

  it('direct priority overrides global priority', () => {
    const files: ChangedFile[] = [
      makeFile('app/globals.css', 'style'),
      makeFile('app/markets/page.tsx', 'page'),
    ];
    const result = mapChangesToRoutes(files);
    const markets = result.find((r) => r.path === '/markets');
    expect(markets?.priority).toBe('direct');
  });

  it('sorts by priority: direct first, then indirect, then global', () => {
    const files: ChangedFile[] = [
      makeFile('app/globals.css', 'style'),
      makeFile('app/markets/page.tsx', 'page'),
    ];
    const result = mapChangesToRoutes(files);
    const priorities = result.map((r) => r.priority);
    const directIndex = priorities.indexOf('direct');
    const globalIndex = priorities.indexOf('global');
    expect(directIndex).toBeLessThan(globalIndex);
  });

  it('includes triggering file paths', () => {
    const result = mapChangesToRoutes([makeFile('app/markets/page.tsx', 'page')]);
    const markets = result.find((r) => r.path === '/markets');
    expect(markets?.triggeringFiles).toContain('app/markets/page.tsx');
  });
});
