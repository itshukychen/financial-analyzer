/**
 * Component-to-Route Mapper
 *
 * Maps changed files to the routes they affect using the route manifest.
 * Handles direct page changes, indirect component changes, and global CSS.
 */

import { ROUTE_MANIFEST, type RouteManifestEntry } from './route-manifest';
import type { ChangedFile } from './git-diff-analyzer';

export type ChangePriority = 'direct' | 'indirect' | 'global';

export interface AffectedRoute {
  path: string;
  name: string;
  priority: ChangePriority;
  /** Which changed files triggered this route being included */
  triggeringFiles: string[];
  manifestEntry: RouteManifestEntry;
}

/** Check if a changed file is a global CSS/style change that affects all routes */
function isGlobalStyleChange(file: ChangedFile): boolean {
  return (
    file.category === 'style' ||
    file.path.includes('globals.css') ||
    file.path.includes('tailwind') ||
    file.path.includes('layout.tsx') ||
    file.path.includes('layout.jsx')
  );
}

/** Check if a changed file directly maps to a page in the manifest */
function matchesPageDirectly(file: ChangedFile, entry: RouteManifestEntry): boolean {
  return entry.components.some((c) => {
    // Exact match or the file path ends with the component path
    return file.path === c || file.path.endsWith(c) || c.endsWith(file.path);
  });
}

/** Check if a changed file is a component that a route depends on */
function matchesComponentIndirectly(file: ChangedFile, entry: RouteManifestEntry): boolean {
  return entry.components.some((c) => {
    // Partial path match — the changed file's directory is referenced by this component path
    const normalizedFile = file.path.replace(/\\/g, '/');
    const normalizedComp = c.replace(/\\/g, '/');
    return normalizedFile.startsWith(normalizedComp) || normalizedComp.startsWith(normalizedFile);
  });
}

/**
 * Given a list of changed files, return the deduplicated set of affected routes
 * ordered by priority (direct first, then indirect, then global).
 */
export function mapChangesToRoutes(changedFiles: ChangedFile[]): AffectedRoute[] {
  // route path → AffectedRoute (for deduplication)
  const routeMap = new Map<string, AffectedRoute>();

  // First pass: identify global style changes
  const globalStyleFiles = changedFiles.filter(isGlobalStyleChange);
  if (globalStyleFiles.length > 0) {
    for (const entry of ROUTE_MANIFEST) {
      routeMap.set(entry.path, {
        path: entry.path,
        name: entry.name,
        priority: 'global',
        triggeringFiles: globalStyleFiles.map((f) => f.path),
        manifestEntry: entry,
      });
    }
  }

  // Second pass: direct page matches (override global with direct priority)
  for (const file of changedFiles) {
    for (const entry of ROUTE_MANIFEST) {
      if (matchesPageDirectly(file, entry) && file.category === 'page') {
        const existing = routeMap.get(entry.path);
        routeMap.set(entry.path, {
          path: entry.path,
          name: entry.name,
          priority: 'direct',
          triggeringFiles: [
            ...(existing?.triggeringFiles ?? []).filter((f) => f !== file.path),
            file.path,
          ],
          manifestEntry: entry,
        });
      }
    }
  }

  // Third pass: indirect component matches
  for (const file of changedFiles) {
    if (file.category !== 'component' && file.category !== 'style') continue;
    for (const entry of ROUTE_MANIFEST) {
      if (matchesComponentIndirectly(file, entry)) {
        const existing = routeMap.get(entry.path);
        if (!existing) {
          routeMap.set(entry.path, {
            path: entry.path,
            name: entry.name,
            priority: 'indirect',
            triggeringFiles: [file.path],
            manifestEntry: entry,
          });
        } else if (existing.priority === 'indirect' || existing.priority === 'global') {
          // Add the triggering file if not already there
          if (!existing.triggeringFiles.includes(file.path)) {
            existing.triggeringFiles.push(file.path);
          }
        }
      }
    }
  }

  // Sort: direct → indirect → global
  const priorityOrder: Record<ChangePriority, number> = { direct: 0, indirect: 1, global: 2 };
  return Array.from(routeMap.values()).sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );
}
