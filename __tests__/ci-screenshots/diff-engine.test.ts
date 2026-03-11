import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import { PNG } from 'pngjs';
import {
  compareScreenshots,
  runVisualDiff,
} from '../../scripts/ci-screenshots/visual-diff-engine';

let tmpDir: string;

async function createSolidPng(filePath: string, r: number, g: number, b: number, size = 10): Promise<void> {
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
  await fs.writeFile(filePath, buf);
}

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'diff-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('compareScreenshots', () => {
  it('classifies identical images as unchanged', async () => {
    const current = path.join(tmpDir, 'current.png');
    const baseline = path.join(tmpDir, 'baseline.png');
    await createSolidPng(current, 255, 0, 0);
    await createSolidPng(baseline, 255, 0, 0);

    const result = await compareScreenshots('/', 'desktop', current, baseline, { diffDir: tmpDir });
    expect(result.classification).toBe('unchanged');
    expect(result.diffPercentage).toBe(0);
  });

  it('classifies fully different images as major', async () => {
    const current = path.join(tmpDir, 'current.png');
    const baseline = path.join(tmpDir, 'baseline.png');
    await createSolidPng(current, 255, 0, 0);
    await createSolidPng(baseline, 0, 0, 255);

    const result = await compareScreenshots('/', 'desktop', current, baseline, { diffDir: tmpDir });
    expect(result.classification).toBe('major');
    expect(result.diffPercentage).toBeGreaterThan(2);
  });

  it('returns "new" classification when no baseline provided', async () => {
    const current = path.join(tmpDir, 'current.png');
    await createSolidPng(current, 100, 100, 100);

    const result = await compareScreenshots('/new-route', 'mobile', current, null, { diffDir: tmpDir });
    expect(result.classification).toBe('new');
    expect(result.diffPath).toBeNull();
  });

  it('returns "new" when baseline file does not exist', async () => {
    const current = path.join(tmpDir, 'current.png');
    await createSolidPng(current, 100, 100, 100);

    const result = await compareScreenshots('/', 'tablet', current, '/nonexistent/path.png', { diffDir: tmpDir });
    expect(result.classification).toBe('new');
  });

  it('saves a diff image when comparing different images', async () => {
    const current = path.join(tmpDir, 'current.png');
    const baseline = path.join(tmpDir, 'baseline.png');
    await createSolidPng(current, 200, 100, 50);
    await createSolidPng(baseline, 50, 100, 200);

    const result = await compareScreenshots('/markets', 'desktop', current, baseline, { diffDir: tmpDir });
    expect(result.diffPath).not.toBeNull();
    const exists = await fs.stat(result.diffPath!).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });
});

describe('runVisualDiff', () => {
  it('processes multiple route+viewport pairs', async () => {
    const current1 = path.join(tmpDir, 'home-desktop.png');
    const current2 = path.join(tmpDir, 'markets-mobile.png');
    await createSolidPng(current1, 100, 100, 100);
    await createSolidPng(current2, 200, 200, 200);

    const routeViewports = [
      { route: '/', viewport: 'desktop' as const, currentPath: current1 },
      { route: '/markets', viewport: 'mobile' as const, currentPath: current2 },
    ];

    const results = await runVisualDiff(routeViewports, new Map(), { diffDir: tmpDir });
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.classification === 'new')).toBe(true);
  });
});
