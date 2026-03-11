/**
 * Report Generator
 *
 * Creates a markdown visual comparison report from diff results,
 * formatted for GitHub PR comments. Uses Handlebars templating.
 */

import Handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import type { ComparisonResult, DiffClassification } from './visual-diff-engine';
import { ROUTE_MANIFEST } from './route-manifest';

export interface ReportSummary {
  total: number;
  major: number;
  minor: number;
  unchanged: number;
  new: number;
  missingBaseline: number;
  hasChanges: boolean;
}

export interface ReportOutput {
  markdown: string;
  summary: ReportSummary;
}

export interface ReportOptions {
  baseBranch: string;
  headBranch: string;
  artifactUrl?: string;
}

function getRouteName(routePath: string): string {
  const entry = ROUTE_MANIFEST.find((r) => r.path === routePath);
  return entry?.name ?? routePath;
}

function formatPct(n: number): string {
  return n.toFixed(3);
}

interface TemplateItem {
  name: string;
  route: string;
  viewport: string;
  diffPct: string;
  pixelsDifferent: number;
  totalPixels: number;
  baselinePath: string | null;
  currentPath: string;
  diffPath: string | null;
}

function toTemplateItem(r: ComparisonResult): TemplateItem {
  return {
    name: getRouteName(r.route),
    route: r.route,
    viewport: r.viewport,
    diffPct: formatPct(r.diffPercentage),
    pixelsDifferent: r.pixelsDifferent,
    totalPixels: r.totalPixels,
    baselinePath: r.baselinePath,
    currentPath: r.currentPath,
    diffPath: r.diffPath,
  };
}

function buildSummary(results: ComparisonResult[]): ReportSummary {
  const counts: Record<DiffClassification, number> = {
    unchanged: 0,
    minor: 0,
    major: 0,
    new: 0,
    'missing-baseline': 0,
  };
  for (const r of results) {
    counts[r.classification] += 1;
  }
  return {
    total: results.length,
    major: counts.major,
    minor: counts.minor,
    unchanged: counts.unchanged,
    new: counts.new,
    missingBaseline: counts['missing-baseline'],
    hasChanges: counts.major > 0 || counts.minor > 0,
  };
}

/**
 * Generate the markdown report and summary object.
 */
export async function generateReport(
  results: ComparisonResult[],
  options: ReportOptions
): Promise<ReportOutput> {
  const templatePath = path.join(
    path.dirname(new URL(import.meta.url).pathname),
    'templates',
    'report.hbs'
  );
  const templateSrc = await fs.readFile(templatePath, 'utf8');
  const template = Handlebars.compile(templateSrc);

  const summary = buildSummary(results);

  const byClassification = (cls: DiffClassification) =>
    results.filter((r) => r.classification === cls).map(toTemplateItem);

  const unchangedList = byClassification('unchanged');

  const data = {
    generatedAt: new Date().toISOString(),
    baseBranch: options.baseBranch,
    headBranch: options.headBranch,
    artifactUrl: options.artifactUrl ?? '#',
    summary: {
      ...summary,
      missingBaseline: summary.missingBaseline,
    },
    majorChanges: byClassification('major'),
    minorChanges: byClassification('minor'),
    newRoutes: byClassification('new'),
    unchangedRoutes: unchangedList,
    unchangedCount: unchangedList.length,
  };

  const markdown = template(data);

  return { markdown, summary };
}

/**
 * Write the report markdown and summary JSON to disk.
 */
export async function writeReport(
  output: ReportOutput,
  outputDir: string
): Promise<void> {
  await fs.mkdir(outputDir, { recursive: true });
  await fs.writeFile(path.join(outputDir, 'report.md'), output.markdown);
  await fs.writeFile(
    path.join(outputDir, 'summary.json'),
    JSON.stringify(output.summary, null, 2)
  );
}
