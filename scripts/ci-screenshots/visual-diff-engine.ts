/**
 * Visual Diff Engine
 *
 * Compares new screenshots against baselines using pixelmatch.
 * Generates pixel-accurate difference percentages and diff overlay images.
 */

import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import type { ViewportName } from './viewport-configs';

export type DiffClassification = 'unchanged' | 'minor' | 'major' | 'new' | 'missing-baseline';

export interface ComparisonResult {
  route: string;
  viewport: ViewportName;
  baselinePath: string | null;
  currentPath: string;
  diffPath: string | null;
  pixelsDifferent: number;
  totalPixels: number;
  diffPercentage: number;
  classification: DiffClassification;
}

export interface DiffEngineOptions {
  /** Pixelmatch threshold 0–1, default 0.1 */
  threshold?: number;
  /** Output directory for diff images */
  diffDir: string;
}

/** Thresholds for classification */
const UNCHANGED_THRESHOLD = 0.1; // < 0.1% = unchanged
const MAJOR_THRESHOLD = 2.0;     // > 2% = major

function classify(diffPct: number, hasBaseline: boolean): DiffClassification {
  if (!hasBaseline) return 'new';
  if (diffPct < UNCHANGED_THRESHOLD) return 'unchanged';
  if (diffPct < MAJOR_THRESHOLD) return 'minor';
  return 'major';
}

/** Load a PNG file into raw pixel data (RGBA) */
async function loadPng(filePath: string): Promise<{ data: Buffer; width: number; height: number }> {
  const raw = await fs.readFile(filePath);
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(raw, (err, data) => {
      if (err) reject(err);
      else resolve({ data: data.data as unknown as Buffer, width: data.width, height: data.height });
    });
  });
}

/** Resize an image to target dimensions using sharp */
async function resizePng(
  filePath: string,
  targetWidth: number,
  targetHeight: number
): Promise<{ data: Buffer; width: number; height: number }> {
  const resized = await sharp(filePath)
    .resize(targetWidth, targetHeight, { fit: 'fill' })
    .png()
    .toBuffer();

  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(resized, (err, data) => {
      if (err) reject(err);
      else resolve({ data: data.data as unknown as Buffer, width: data.width, height: data.height });
    });
  });
}

/** Save a raw RGBA buffer as a PNG file */
async function saveRgbaPng(
  data: Buffer,
  width: number,
  height: number,
  filePath: string
): Promise<void> {
  const png = new PNG({ width, height });
  (png.data as unknown as Buffer).set(data);
  const buf = PNG.sync.write(png);
  await fs.writeFile(filePath, buf);
}

/**
 * Compare a single pair of screenshots.
 */
export async function compareScreenshots(
  route: string,
  viewport: ViewportName,
  currentPath: string,
  baselinePath: string | null,
  options: DiffEngineOptions
): Promise<ComparisonResult> {
  await fs.mkdir(options.diffDir, { recursive: true });

  // No baseline → new route
  if (!baselinePath || !fsSync.existsSync(baselinePath)) {
    return {
      route,
      viewport,
      baselinePath,
      currentPath,
      diffPath: null,
      pixelsDifferent: 0,
      totalPixels: 0,
      diffPercentage: 0,
      classification: 'new',
    };
  }

  // Load current screenshot
  const current = await loadPng(currentPath);
  let baseline = await loadPng(baselinePath);

  // Resize baseline if dimensions differ
  if (baseline.width !== current.width || baseline.height !== current.height) {
    baseline = await resizePng(baselinePath, current.width, current.height);
  }

  const totalPixels = current.width * current.height;
  const diffData = Buffer.alloc(totalPixels * 4);

  const pixelsDifferent = pixelmatch(
    baseline.data,
    current.data,
    diffData,
    current.width,
    current.height,
    { threshold: options.threshold ?? 0.1, includeAA: false }
  );

  const diffPercentage = (pixelsDifferent / totalPixels) * 100;
  const classification = classify(diffPercentage, true);

  // Save diff image
  const routeSlug = route === '/' ? 'home' : route.replace(/^\//, '').replace(/\//g, '-');
  const diffFilename = `${routeSlug}-${viewport}-diff.png`;
  const diffPath = path.join(options.diffDir, diffFilename);
  await saveRgbaPng(diffData, current.width, current.height, diffPath);

  return {
    route,
    viewport,
    baselinePath,
    currentPath,
    diffPath,
    pixelsDifferent,
    totalPixels,
    diffPercentage,
    classification,
  };
}

/**
 * Run comparisons for all route+viewport combinations.
 */
export async function runVisualDiff(
  routeViewports: Array<{ route: string; viewport: ViewportName; currentPath: string }>,
  baselineMap: Map<string, string>,
  options: DiffEngineOptions
): Promise<ComparisonResult[]> {
  const results: ComparisonResult[] = [];

  for (const { route, viewport, currentPath } of routeViewports) {
    const key = `${route}:${viewport}`;
    const baselinePath = baselineMap.get(key) ?? null;

    const result = await compareScreenshots(route, viewport, currentPath, baselinePath, options);
    results.push(result);
  }

  return results;
}
