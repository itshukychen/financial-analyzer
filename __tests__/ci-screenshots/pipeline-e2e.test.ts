/**
 * End-to-end validation tests for the CI screenshot pipeline.
 *
 * These tests verify the complete pipeline behaviour with real filesystem
 * operations but mocked browser/git I/O. They validate accuracy, report
 * formatting, and correct classification of diff results.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { PNG } from 'pngjs';

import { classifyFile } from '../../scripts/ci-screenshots/git-diff-analyzer';
import { mapChangesToRoutes } from '../../scripts/ci-screenshots/component-mapper';
import {
  checkBaselines,
  buildBaselineMap,
  persistBaselines,
} from '../../scripts/ci-screenshots/baseline-manager';
import {
  compareScreenshots,
  runVisualDiff,
} from '../../scripts/ci-screenshots/visual-diff-engine';
import { generateReport, writeReport } from '../../scripts/ci-screenshots/report-generator';
import { routeToSlug, buildFilename } from '../../scripts/ci-screenshots/screenshot-capturer';
import type { ChangedFile } from '../../scripts/ci-screenshots/git-diff-analyzer';
import { VIEWPORTS } from '../../scripts/ci-screenshots/viewport-configs';

let tmpDir: string;

async function createSolidPng(filePath: string, r: number, g: number, b: number, size = 20): Promise<void> {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = 255;
    }
  }
  const buf = PNG.sync.write(png);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'e2e-pipeline-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

// ─── Validation Checklist ─────────────────────────────────────────────────────

describe('V1: Small CSS change detected as minor', () => {
  it('detects minor diff when a small portion of pixels change', async () => {
    const baselineDir = path.join(tmpDir, 'baselines');
    const currentDir = path.join(tmpDir, 'current');
    const diffDir = path.join(tmpDir, 'diffs');
    await fs.mkdir(baselineDir, { recursive: true });
    await fs.mkdir(currentDir, { recursive: true });

    // Create baseline: solid red 20x20
    const baselinePath = path.join(baselineDir, 'home-desktop.png');
    const currentPath = path.join(currentDir, 'home-desktop.png');

    const size = 20;
    // Baseline: all red
    const baselinePng = new PNG({ width: size, height: size });
    for (let i = 0; i < size * size * 4; i += 4) {
      baselinePng.data[i] = 255; baselinePng.data[i + 1] = 0;
      baselinePng.data[i + 2] = 0; baselinePng.data[i + 3] = 255;
    }
    await fs.writeFile(baselinePath, PNG.sync.write(baselinePng));

    // Current: mostly red, 4 pixels changed (4/400 = 1% → minor)
    const currentPng = new PNG({ width: size, height: size });
    for (let i = 0; i < size * size * 4; i += 4) {
      currentPng.data[i] = 255; currentPng.data[i + 1] = 0;
      currentPng.data[i + 2] = 0; currentPng.data[i + 3] = 255;
    }
    // Change 4 pixels to blue
    for (let i = 0; i < 4; i++) {
      currentPng.data[i * 4] = 0; currentPng.data[i * 4 + 1] = 0;
      currentPng.data[i * 4 + 2] = 255;
    }
    await fs.writeFile(currentPath, PNG.sync.write(currentPng));

    const result = await compareScreenshots('/', 'desktop', currentPath, baselinePath, { diffDir });
    expect(result.classification).toBe('minor');
    expect(result.diffPercentage).toBeGreaterThan(0.1);
    expect(result.diffPercentage).toBeLessThan(2.0);
  });
});

describe('V2: Layout change detected as major', () => {
  it('detects major diff when most pixels change', async () => {
    const diffDir = path.join(tmpDir, 'diffs');
    const baselinePath = path.join(tmpDir, 'baseline.png');
    const currentPath = path.join(tmpDir, 'current.png');
    await createSolidPng(baselinePath, 255, 0, 0);
    await createSolidPng(currentPath, 0, 0, 255);

    const result = await compareScreenshots('/', 'desktop', currentPath, baselinePath, { diffDir });
    expect(result.classification).toBe('major');
    expect(result.diffPercentage).toBeGreaterThan(2.0);
  });
});

describe('V3: New route marked as "new" with no baseline', () => {
  it('classifies a route with no baseline as "new"', async () => {
    const diffDir = path.join(tmpDir, 'diffs');
    const currentPath = path.join(tmpDir, 'current.png');
    await createSolidPng(currentPath, 128, 128, 128);

    const result = await compareScreenshots('/new-route', 'desktop', currentPath, null, { diffDir });
    expect(result.classification).toBe('new');
    expect(result.diffPath).toBeNull();
  });
});

describe('V4: Unchanged route correctly identified', () => {
  it('classifies identical images as unchanged', async () => {
    const diffDir = path.join(tmpDir, 'diffs');
    const img = path.join(tmpDir, 'img.png');
    await createSolidPng(img, 100, 200, 100);

    const result = await compareScreenshots('/', 'tablet', img, img, { diffDir });
    expect(result.classification).toBe('unchanged');
    expect(result.diffPercentage).toBe(0);
  });
});

describe('V5: Failed route handled gracefully', () => {
  it('compareScreenshots returns "new" when current file is valid but baseline is missing', async () => {
    const diffDir = path.join(tmpDir, 'diffs');
    const currentPath = path.join(tmpDir, 'current.png');
    await createSolidPng(currentPath, 50, 50, 50);

    const result = await compareScreenshots(
      '/broken',
      'mobile',
      currentPath,
      '/nonexistent/baseline.png',
      { diffDir }
    );
    // Should not throw; missing baseline → 'new'
    expect(result.classification).toBe('new');
  });
});

describe('V6: Report generation from complete diff results', () => {
  it('generates a valid report markdown and summary', async () => {
    const diffDir = path.join(tmpDir, 'diffs');
    const current1 = path.join(tmpDir, 'c1.png');
    const baseline1 = path.join(tmpDir, 'b1.png');
    const current2 = path.join(tmpDir, 'c2.png');
    await createSolidPng(current1, 255, 0, 0);
    await createSolidPng(baseline1, 0, 0, 255); // major diff
    await createSolidPng(current2, 100, 100, 100); // new (no baseline)

    const diffResults = await runVisualDiff(
      [
        { route: '/markets', viewport: 'desktop', currentPath: current1 },
        { route: '/watchlist', viewport: 'mobile', currentPath: current2 },
      ],
      new Map([['markets:desktop', baseline1]]),
      { diffDir }
    );

    const output = await generateReport(diffResults, { baseBranch: 'main', headBranch: 'feature/test' });

    expect(output.summary.total).toBe(2);
    expect(output.summary.major).toBeGreaterThanOrEqual(1);
    expect(output.summary.hasChanges).toBe(true);
    expect(output.markdown).toContain('Major Changes');
    expect(output.markdown).toContain('/markets');

    // Write to disk
    await writeReport(output, tmpDir);
    const reportExists = await fs.stat(path.join(tmpDir, 'report.md')).then(() => true).catch(() => false);
    const summaryExists = await fs.stat(path.join(tmpDir, 'summary.json')).then(() => true).catch(() => false);
    expect(reportExists).toBe(true);
    expect(summaryExists).toBe(true);
  });
});

describe('V7: Baseline persistence and cache round-trip', () => {
  it('persists baselines and reads them back', async () => {
    const captureDir = path.join(tmpDir, 'captures');
    const baselineDir = path.join(tmpDir, 'baselines');
    await fs.mkdir(captureDir, { recursive: true });

    // Create fake capture images
    for (const vp of VIEWPORTS) {
      const filename = buildFilename('/', vp);
      await createSolidPng(path.join(captureDir, filename), 200, 100, 50);
    }

    await persistBaselines(['/'], captureDir, 'sha123', 'main', baselineDir);

    const result = await checkBaselines(['/'], baselineDir);
    expect(result.metadata?.commitHash).toBe('sha123');
    expect(result.entries.filter((e) => e.exists).length).toBe(VIEWPORTS.length);

    const map = buildBaselineMap(result.entries);
    expect(map.size).toBe(VIEWPORTS.length);
    expect(map.has('/:desktop')).toBe(true);
  });
});

describe('V8: Component-to-route mapping accuracy', () => {
  it('correctly maps a CSS change to all routes', () => {
    const files: ChangedFile[] = [
      { path: 'app/globals.css', category: 'style', changeType: 'modified', isBinary: false },
    ];
    const routes = mapChangesToRoutes(files);
    expect(routes.length).toBeGreaterThanOrEqual(5);
    expect(routes.every((r) => r.priority === 'global')).toBe(true);
  });

  it('correctly maps a page change to exactly that route', () => {
    const files: ChangedFile[] = [
      { path: 'app/alerts/page.tsx', category: 'page', changeType: 'modified', isBinary: false },
    ];
    const routes = mapChangesToRoutes(files);
    const alertRoute = routes.find((r) => r.path === '/alerts');
    expect(alertRoute?.priority).toBe('direct');
  });
});

describe('V9: File classification accuracy', () => {
  const cases: Array<[string, string]> = [
    ['app/page.tsx', 'page'],
    ['app/markets/page.tsx', 'page'],
    ['src/components/Button.tsx', 'component'],
    ['app/globals.css', 'style'],
    ['app/api/stocks/route.ts', 'api'],
    ['scripts/setup.sh', 'other'],
    ['package.json', 'other'],
  ];

  it.each(cases)('classifies %s as %s', (filePath, expected) => {
    expect(classifyFile(filePath)).toBe(expected);
  });
});
