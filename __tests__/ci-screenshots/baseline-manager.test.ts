import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs/promises';
import {
  readBaselineMetadata,
  writeBaselineMetadata,
  checkBaselines,
  buildBaselineMap,
  persistBaselines,
} from '../../scripts/ci-screenshots/baseline-manager';

let tmpDir: string;

beforeEach(async () => {
  tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'baseline-test-'));
});

afterEach(async () => {
  await fs.rm(tmpDir, { recursive: true, force: true });
});

describe('readBaselineMetadata', () => {
  it('returns null when no metadata file exists', async () => {
    const result = await readBaselineMetadata(tmpDir);
    expect(result).toBeNull();
  });

  it('returns parsed metadata when file exists', async () => {
    const meta = { commitHash: 'abc123', capturedAt: '2026-01-01', branch: 'main' };
    await fs.writeFile(path.join(tmpDir, 'baseline-metadata.json'), JSON.stringify(meta));
    const result = await readBaselineMetadata(tmpDir);
    expect(result).toEqual(meta);
  });

  it('returns null on malformed JSON', async () => {
    await fs.writeFile(path.join(tmpDir, 'baseline-metadata.json'), 'not json');
    const result = await readBaselineMetadata(tmpDir);
    expect(result).toBeNull();
  });
});

describe('writeBaselineMetadata', () => {
  it('creates metadata file', async () => {
    const meta = { commitHash: 'def456', capturedAt: '2026-01-02', branch: 'main' };
    await writeBaselineMetadata(meta, tmpDir);
    const content = await fs.readFile(path.join(tmpDir, 'baseline-metadata.json'), 'utf8');
    expect(JSON.parse(content)).toEqual(meta);
  });
});

describe('checkBaselines', () => {
  it('marks all as missing when no files exist', async () => {
    const result = await checkBaselines(['/markets'], tmpDir);
    expect(result.missingBaselines.length).toBeGreaterThan(0);
    expect(result.entries.every((e) => !e.exists)).toBe(true);
  });

  it('marks existing baselines as found', async () => {
    // Create one baseline file
    await fs.writeFile(path.join(tmpDir, 'markets-desktop.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
    const result = await checkBaselines(['/markets'], tmpDir);
    const desktop = result.entries.find((e) => e.viewport === 'desktop');
    expect(desktop?.exists).toBe(true);
  });
});

describe('buildBaselineMap', () => {
  it('returns map of only existing entries', () => {
    const entries = [
      { route: '/', viewport: 'desktop' as const, filePath: '/tmp/home-desktop.png', exists: true },
      { route: '/', viewport: 'mobile' as const, filePath: '/tmp/home-mobile.png', exists: false },
    ];
    const map = buildBaselineMap(entries);
    expect(map.has('//:desktop')).toBe(false); // key is route:viewport
    expect(map.has('//:desktop')).toBe(false);
    expect(map.size).toBe(1);
    expect(map.has('/:desktop')).toBe(true);
    expect(map.has('/:mobile')).toBe(false);
  });
});
