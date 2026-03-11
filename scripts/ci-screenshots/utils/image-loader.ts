/**
 * Image loader utility — PNG load/save with pngjs.
 */

import { PNG } from 'pngjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ensureDir } from './file-utils';

export interface RawImage {
  data: Buffer;
  width: number;
  height: number;
}

/**
 * Load a PNG file into a RawImage (RGBA buffer + dimensions).
 */
export async function loadPng(filePath: string): Promise<RawImage> {
  const raw = await fs.readFile(filePath);
  return new Promise((resolve, reject) => {
    const png = new PNG();
    png.parse(raw, (err, data) => {
      if (err) reject(new Error(`Failed to parse PNG ${filePath}: ${err.message}`));
      else resolve({ data: data.data as unknown as Buffer, width: data.width, height: data.height });
    });
  });
}

/**
 * Save a raw RGBA buffer as a PNG file.
 */
export async function savePng(image: RawImage, filePath: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  const png = new PNG({ width: image.width, height: image.height });
  (png.data as unknown as Buffer).set(image.data);
  const buf = PNG.sync.write(png);
  await fs.writeFile(filePath, buf);
}

/**
 * Create a solid-color PNG image (useful for testing).
 */
export function createSolidPng(
  width: number,
  height: number,
  r: number,
  g: number,
  b: number,
  a = 255
): RawImage {
  const data = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = r;
    data[i * 4 + 1] = g;
    data[i * 4 + 2] = b;
    data[i * 4 + 3] = a;
  }
  return { data, width, height };
}
