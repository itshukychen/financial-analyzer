/**
 * File utility functions — path sanitization and directory operations.
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

/**
 * Sanitize a route path into a safe filesystem slug.
 * e.g. "/markets/options" → "markets-options"
 */
export function sanitizeRoutePath(routePath: string): string {
  return routePath
    .replace(/^\//, '')
    .replace(/\//g, '-')
    .replace(/[^a-z0-9-_]/gi, '_')
    .toLowerCase() || 'home';
}

/**
 * Ensure a directory exists, creating it (and parents) if needed.
 */
export async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

/**
 * Check if a path exists (file or directory).
 */
export function pathExists(p: string): boolean {
  return fsSync.existsSync(p);
}

/**
 * Read a JSON file and return its parsed contents, or null on error.
 */
export async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

/**
 * Write an object as formatted JSON to a file.
 */
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

/**
 * Copy a file, creating the destination directory if needed.
 */
export async function copyFile(src: string, dest: string): Promise<void> {
  await ensureDir(path.dirname(dest));
  await fs.copyFile(src, dest);
}

/**
 * List all files in a directory (non-recursive).
 * Returns empty array if directory doesn't exist.
 */
export async function listFiles(dir: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    return entries.filter((e) => e.isFile()).map((e) => path.join(dir, e.name));
  } catch {
    return [];
  }
}
