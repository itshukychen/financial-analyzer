/**
 * CI Screenshot Pipeline — Main Orchestrator
 *
 * Entry point invoked by `npm run ci:screenshots` (or `ci:screenshots:local`).
 * Coordinates: diff → map → capture → baseline → diff → report → post
 *
 * Environment variables (all optional in --local mode):
 *   BASE_BRANCH      - branch to compare against (default: origin/main)
 *   HEAD_BRANCH      - branch being tested (default: HEAD)
 *   PR_NUMBER        - pull request number (for comment posting)
 *   GITHUB_TOKEN     - for GitHub API calls
 *   GITHUB_REPOSITORY - "owner/repo"
 *   GITHUB_SHA       - head commit SHA for check creation
 *   GITHUB_RUN_ID    - for artifact URL construction
 *   BASE_URL         - dev server URL (default: http://localhost:3000)
 *   OUTPUT_DIR       - where to write outputs (default: .ci-screenshots/output)
 */

import * as path from 'path';
import * as fs from 'fs/promises';
import { analyzeDiff } from './git-diff-analyzer';
import { mapChangesToRoutes } from './component-mapper';
import { captureScreenshots, buildFilename } from './screenshot-capturer';
import { checkBaselines, buildBaselineMap } from './baseline-manager';
import { runVisualDiff } from './visual-diff-engine';
import { generateReport, writeReport } from './report-generator';
import { postReport, buildPosterOptionsFromEnv } from './github-poster';
import { VIEWPORTS } from './viewport-configs';

const isLocal = process.argv.includes('--local');

function log(emoji: string, msg: string) {
  console.log(`${emoji}  ${msg}`);
}

function env(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

async function startDevServer(baseUrl: string): Promise<ReturnType<typeof import('child_process').spawn> | null> {
  // Only start if not already running
  try {
    const res = await fetch(baseUrl);
    if (res.ok || res.status < 500) {
      log('✅', 'Dev server already running');
      return null;
    }
  } catch {
    // Server not running — start it
  }

  const { spawn } = await import('child_process');
  log('🚀', 'Starting Next.js dev server…');
  const proc = spawn('npm', ['run', 'dev'], {
    stdio: 'pipe',
    detached: false,
    env: { ...process.env, PORT: '3000' },
  });

  // Wait up to 30s for server to be ready
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1000));
    try {
      const res = await fetch(baseUrl);
      if (res.ok || res.status < 500) {
        log('✅', 'Dev server ready');
        return proc;
      }
    } catch {
      // Still starting
    }
  }

  throw new Error('Dev server did not start within 30 seconds');
}

async function main() {
  const baseBranch = env('BASE_BRANCH', 'origin/main');
  const headBranch = env('HEAD_BRANCH', 'HEAD');
  const baseUrl = env('BASE_URL', 'http://localhost:3000');
  const outputDir = env('OUTPUT_DIR', '.ci-screenshots/output');
  const baselineDir = env('BASELINE_DIR', '.ci-screenshots/baselines');
  const diffDir = path.join(outputDir, 'diffs');
  const headSha = env('GITHUB_SHA', 'unknown');
  const runId = env('GITHUB_RUN_ID', '');
  const artifactUrl = runId
    ? `https://github.com/${env('GITHUB_REPOSITORY', '')}/actions/runs/${runId}`
    : undefined;

  log('🔍', `Comparing ${headBranch} → ${baseBranch}`);

  // ── Step 1: Analyse git diff ──────────────────────────────────────────────
  log('📂', 'Analysing git diff…');
  const diffOutput = await analyzeDiff(baseBranch, headBranch).catch((err) => {
    if (isLocal) {
      log('⚠️', `Git diff failed in local mode: ${err.message}. Using empty diff.`);
      return { baseBranch, headBranch, changedFiles: [], summary: { total: 0, added: 0, modified: 0, deleted: 0, renamed: 0, byCategory: { component: 0, page: 0, style: 0, api: 0, other: 0 } } };
    }
    throw err;
  });
  log('📊', `Changed files: ${diffOutput.summary.total}`);

  // ── Step 2: Map to affected routes ────────────────────────────────────────
  log('🗺️', 'Mapping changes to routes…');
  const affectedRoutes = mapChangesToRoutes(diffOutput.changedFiles);

  if (affectedRoutes.length === 0) {
    log('✅', 'No UI routes affected — skipping screenshot capture.');
    const emptyReport = await generateReport([], { baseBranch, headBranch, artifactUrl });
    await writeReport(emptyReport, outputDir);
    return;
  }

  log('📍', `Affected routes: ${affectedRoutes.map((r) => r.path).join(', ')}`);

  // ── Step 3: Start dev server (local mode only) ────────────────────────────
  let devServer: Awaited<ReturnType<typeof startDevServer>> = null;
  try {
    devServer = await startDevServer(baseUrl);
  } catch (err) {
    if (isLocal) {
      log('⚠️', `Could not start dev server: ${(err as Error).message}. Screenshots may fail.`);
    } else {
      throw err;
    }
  }

  try {
    // ── Step 4: Capture screenshots ─────────────────────────────────────────
    log('📸', 'Capturing screenshots…');
    const captureResults = await captureScreenshots(affectedRoutes, { baseUrl, outputDir });
    const successCount = captureResults.filter((r) => r.metadata.success).length;
    log('✅', `Captured ${successCount}/${captureResults.length} screenshots`);

    // ── Step 5: Check baselines ──────────────────────────────────────────────
    log('🗂️', 'Checking baselines…');
    const routePaths = [...new Set(affectedRoutes.map((r) => r.path))];
    const baselineResult = await checkBaselines(routePaths, baselineDir);
    const baselineMap = buildBaselineMap(baselineResult.entries);
    if (baselineResult.missingBaselines.length > 0) {
      log('⚠️', `Missing baselines: ${baselineResult.missingBaselines.length}`);
    }

    // ── Step 6: Visual diff ──────────────────────────────────────────────────
    log('🔬', 'Running visual diff…');
    const routeViewports = captureResults
      .filter((r) => r.metadata.success)
      .map((r) => ({
        route: r.route,
        viewport: r.viewport as 'desktop' | 'mobile' | 'tablet',
        currentPath: r.filePath,
      }));

    const diffResults = await runVisualDiff(routeViewports, baselineMap, { diffDir });
    const majorCount = diffResults.filter((r) => r.classification === 'major').length;
    const minorCount = diffResults.filter((r) => r.classification === 'minor').length;
    log('📊', `Diff results: ${majorCount} major, ${minorCount} minor changes`);

    // ── Step 7: Generate report ──────────────────────────────────────────────
    log('📝', 'Generating report…');
    const reportOutput = await generateReport(diffResults, { baseBranch, headBranch, artifactUrl });
    await writeReport(reportOutput, outputDir);
    log('✅', `Report written to ${outputDir}/report.md`);

    // ── Step 8: Post to GitHub ───────────────────────────────────────────────
    if (!isLocal) {
      log('💬', 'Posting to GitHub…');
      const posterOptions = buildPosterOptionsFromEnv();
      if (posterOptions) {
        await postReport(reportOutput, posterOptions, headSha);
        log('✅', 'GitHub comment and check posted');
      } else {
        log('⚠️', 'No GITHUB_TOKEN — skipping GitHub post');
      }
    } else {
      log('🏠', 'Local mode: skipping GitHub post');
      console.log('\n--- Report preview ---\n');
      console.log(reportOutput.markdown.slice(0, 1000));
    }

    process.exit(0);
  } finally {
    if (devServer) {
      log('🛑', 'Stopping dev server…');
      devServer.kill();
    }
  }
}

main().catch((err) => {
  console.error('❌ Pipeline failed:', err);
  process.exit(1);
});
