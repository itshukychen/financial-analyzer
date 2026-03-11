/**
 * Baseline Manager
 *
 * Fetches or generates baseline screenshots from the main branch.
 * Stores baselines in .ci-screenshots/baselines/ with metadata.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import { VIEWPORTS, type ViewportName } from './viewport-configs';
import { buildFilename } from './screenshot-capturer';

export interface BaselineMetadata {
  commitHash: string;
  capturedAt: string;
  branch: string;
}

export interface BaselineEntry {
  route: string;
  viewport: ViewportName;
  filePath: string;
  exists: boolean;
}

export interface BaselineManagerResult {
  baselineDir: string;
  metadata: BaselineMetadata | null;
  entries: BaselineEntry[];
  missingBaselines: BaselineEntry[];
}

const BASELINES_DIR = '.ci-screenshots/baselines';
const METADATA_FILE = 'baseline-metadata.json';

/**
 * Read metadata for the stored baselines, or return null if not found.
 */
export async function readBaselineMetadata(
  baselineDir: string = BASELINES_DIR
): Promise<BaselineMetadata | null> {
  const metaPath = path.join(baselineDir, METADATA_FILE);
  try {
    const raw = await fs.readFile(metaPath, 'utf8');
    return JSON.parse(raw) as BaselineMetadata;
  } catch {
    return null;
  }
}

/**
 * Write baseline metadata file.
 */
export async function writeBaselineMetadata(
  metadata: BaselineMetadata,
  baselineDir: string = BASELINES_DIR
): Promise<void> {
  await fs.mkdir(baselineDir, { recursive: true });
  await fs.writeFile(
    path.join(baselineDir, METADATA_FILE),
    JSON.stringify(metadata, null, 2)
  );
}

/**
 * Copy screenshots from captureDir into the baseline store.
 * Used after capturing the main-branch build to persist baselines.
 */
export async function persistBaselines(
  routes: string[],
  captureDir: string,
  commitHash: string,
  branch: string,
  baselineDir: string = BASELINES_DIR
): Promise<void> {
  await fs.mkdir(baselineDir, { recursive: true });

  for (const routePath of routes) {
    for (const viewport of VIEWPORTS) {
      const filename = buildFilename(routePath, viewport);
      const src = path.join(captureDir, filename);
      const dest = path.join(baselineDir, filename);
      if (fsSync.existsSync(src)) {
        await fs.copyFile(src, dest);
      }
    }
  }

  await writeBaselineMetadata({ commitHash, capturedAt: new Date().toISOString(), branch }, baselineDir);
}

/**
 * Check which baselines exist and which are missing for the given routes.
 */
export async function checkBaselines(
  routes: string[],
  baselineDir: string = BASELINES_DIR
): Promise<BaselineManagerResult> {
  const metadata = await readBaselineMetadata(baselineDir);
  const entries: BaselineEntry[] = [];

  for (const routePath of routes) {
    for (const viewport of VIEWPORTS) {
      const filename = buildFilename(routePath, viewport);
      const filePath = path.join(baselineDir, filename);
      const exists = fsSync.existsSync(filePath);
      entries.push({ route: routePath, viewport: viewport.name, filePath, exists });
    }
  }

  const missingBaselines = entries.filter((e) => !e.exists);

  return { baselineDir, metadata, entries, missingBaselines };
}

/**
 * Returns a map of `route:viewport` → absolute baseline file path for existing baselines.
 */
export function buildBaselineMap(entries: BaselineEntry[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const entry of entries) {
    if (entry.exists) {
      map.set(`${entry.route}:${entry.viewport}`, path.resolve(entry.filePath));
    }
  }
  return map;
}
