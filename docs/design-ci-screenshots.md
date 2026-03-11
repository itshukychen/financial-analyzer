# Technical Design: CI Screenshot Automation

**Feature ID:** ci-screenshots  
**Status:** In Design  
**Version:** 1.0  
**Date:** 2026-03-11

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [Data Flow](#data-flow)
5. [Technical Decisions](#technical-decisions)
6. [Implementation Details](#implementation-details)
7. [Integration Points](#integration-points)
8. [Error Handling & Edge Cases](#error-handling--edge-cases)
9. [Performance Considerations](#performance-considerations)
10. [Security & Privacy](#security--privacy)
11. [Testing Strategy](#testing-strategy)
12. [Deployment & Rollout](#deployment--rollout)

---

## Overview

### Purpose

The CI Screenshot Pipeline automates visual regression detection by capturing screenshots of UI components that have been modified in pull requests. This provides instant visual feedback to reviewers and catches unintended visual changes before they reach production.

### Goals

- Detect which routes are affected by code changes
- Capture screenshots at multiple viewport sizes
- Compare against baseline from main branch
- Generate visual diff reports
- Integrate seamlessly into existing GitHub Actions CI/CD pipeline

### Non-Goals (Out of Scope)

- Real-time visual monitoring (this is CI-only)
- Machine learning-based diff analysis
- Support for non-GitHub version control systems
- Video/animation capture (static screenshots only)
- Cross-browser testing (Chrome/Chromium only in MVP)

---

## Architecture

### High-Level System Design

```
┌─────────────────────────────────────────────────────────┐
│                  GitHub Actions Runner                   │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │  1. Checkout Code (PR branch + main baseline)     │ │
│  └──────────────┬─────────────────────────────────────┘ │
│                 │                                        │
│                 ▼                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  2. Git Diff Analyzer                              │ │
│  │     Input: git diff origin/main...HEAD             │ │
│  │     Output: List of modified files                 │ │
│  └──────────────┬─────────────────────────────────────┘ │
│                 │                                        │
│                 ▼                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  3. Component-to-Route Mapper                      │ │
│  │     Input: Changed files                           │ │
│  │     Output: Affected routes list                   │ │
│  └──────────────┬─────────────────────────────────────┘ │
│                 │                                        │
│          ┌──────┴────────┐                              │
│          ▼               ▼                              │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │ 4a. Build PR │  │ 4b. Baseline │                    │
│  │ Next.js app  │  │ Cache/Fetch  │                    │
│  └──────┬───────┘  └──────┬───────┘                    │
│         │                 │                              │
│         ▼                 │                              │
│  ┌──────────────┐         │                              │
│  │ 5a. Start    │         │                              │
│  │ Dev Server   │         │                              │
│  │ (port 3000)  │         │                              │
│  └──────┬───────┘         │                              │
│         │                 │                              │
│         ▼                 │                              │
│  ┌────────────────────────┴─────────────────────────┐  │
│  │  6. Playwright Screenshot Capture                 │  │
│  │     - Navigate to each affected route            │  │
│  │     - Wait for page load                          │  │
│  │     - Capture at 3 viewport sizes                 │  │
│  │     - Store with metadata                         │  │
│  └──────────────┬─────────────────────────────────────┘ │
│                 │                                        │
│                 ▼                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  7. Visual Diff Engine                             │ │
│  │     - Load baseline screenshots                    │ │
│  │     - Pixel-by-pixel comparison (pixelmatch)      │ │
│  │     - Generate diff overlays                       │ │
│  │     - Classify changes (none/minor/major)         │ │
│  └──────────────┬─────────────────────────────────────┘ │
│                 │                                        │
│                 ▼                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  8. Report Generator                               │ │
│  │     - Create markdown summary                      │ │
│  │     - Embed screenshot comparisons                 │ │
│  │     - Add performance metrics                      │ │
│  └──────────────┬─────────────────────────────────────┘ │
│                 │                                        │
│                 ▼                                        │
│  ┌────────────────────────────────────────────────────┐ │
│  │  9. GitHub Integration                             │ │
│  │     - Post PR comment with report                  │ │
│  │     - Upload artifacts (screenshots + diffs)      │ │
│  │     - Set check status (pass/fail/neutral)        │ │
│  └────────────────────────────────────────────────────┘ │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

### Technology Stack

| Layer | Technology | Justification |
|-------|-----------|---------------|
| **CI Platform** | GitHub Actions | Native integration, free for public repos |
| **Language** | TypeScript/Node.js | Matches existing project stack |
| **Screenshot Engine** | Playwright | Reliable, fast, already in project deps |
| **Image Comparison** | pixelmatch | Fast pixel-level diffs, MIT license |
| **Image Processing** | sharp | High-performance image manipulation |
| **Git Operations** | simple-git | Programmatic git access |
| **AST Parsing** | @typescript-eslint/parser | Parse imports/exports for dependency graph |
| **Report Format** | Markdown | Native GitHub rendering, version-controllable |

---

## Core Components

### 1. Git Diff Analyzer

**Responsibility:** Identify modified files between PR branch and main branch.

**Input:**
```typescript
interface DiffAnalyzerInput {
  baseBranch: string;      // 'origin/main'
  headBranch: string;      // 'HEAD' or PR branch
  repoPath: string;        // Working directory
}
```

**Output:**
```typescript
interface DiffAnalyzerOutput {
  modifiedFiles: ModifiedFile[];
  summary: {
    added: number;
    modified: number;
    deleted: number;
  };
}

interface ModifiedFile {
  path: string;              // e.g., 'app/components/charts/OptionsOverlay.tsx'
  status: 'added' | 'modified' | 'deleted';
  type: 'component' | 'page' | 'style' | 'api' | 'other';
}
```

**Implementation:**
```typescript
import simpleGit from 'simple-git';

export async function analyzeDiff(input: DiffAnalyzerInput): Promise<DiffAnalyzerOutput> {
  const git = simpleGit(input.repoPath);
  
  // Get diff summary
  const diffSummary = await git.diffSummary([
    `${input.baseBranch}...${input.headBranch}`
  ]);
  
  // Classify files
  const modifiedFiles = diffSummary.files.map(file => ({
    path: file.file,
    status: file.binary ? 'modified' : classifyStatus(file),
    type: classifyFileType(file.file)
  }));
  
  return {
    modifiedFiles,
    summary: {
      added: diffSummary.insertions,
      modified: diffSummary.changed,
      deleted: diffSummary.deletions
    }
  };
}
```

**File Type Classification:**
- `component`: `app/components/**/*.tsx`, `app/components/**/*.jsx`
- `page`: `app/**/page.tsx`, `app/**/layout.tsx`
- `style`: `**/*.css`, `**/*.module.css`, `tailwind.config.ts`
- `api`: `app/api/**/*.ts`
- `other`: Everything else

---

### 2. Component-to-Route Mapper

**Responsibility:** Map changed files to the routes that render them.

**Input:**
```typescript
interface MapperInput {
  modifiedFiles: ModifiedFile[];
  appDirectory: string;     // 'app/' path
}
```

**Output:**
```typescript
interface MapperOutput {
  affectedRoutes: AffectedRoute[];
}

interface AffectedRoute {
  path: string;             // e.g., '/dashboard'
  reason: string;           // e.g., 'Modified OptionsOverlay.tsx'
  modifiedComponents: string[];
  priority: 'direct' | 'indirect';
}
```

**Algorithm:**

1. **Direct changes:** If a `page.tsx` was modified → that route is affected
2. **Component changes:** Parse imports using AST to find all pages that import the component
3. **Style changes:** Global CSS → all routes; scoped CSS → only importing components
4. **API changes:** Routes that fetch from modified endpoints

**Implementation Strategy:**

```typescript
export async function mapToRoutes(input: MapperInput): Promise<MapperOutput> {
  const affectedRoutes: AffectedRoute[] = [];
  
  for (const file of input.modifiedFiles) {
    if (file.type === 'page') {
      // Direct page change
      const route = filePathToRoute(file.path);
      affectedRoutes.push({
        path: route,
        reason: `Direct modification: ${file.path}`,
        modifiedComponents: [file.path],
        priority: 'direct'
      });
    } else if (file.type === 'component') {
      // Find pages that import this component
      const dependentPages = await findDependentPages(file.path, input.appDirectory);
      for (const page of dependentPages) {
        const route = filePathToRoute(page);
        affectedRoutes.push({
          path: route,
          reason: `Component dependency: ${file.path}`,
          modifiedComponents: [file.path],
          priority: 'indirect'
        });
      }
    }
  }
  
  // Deduplicate routes
  return { affectedRoutes: deduplicateRoutes(affectedRoutes) };
}
```

**Route Discovery:**

For MVP, we'll use a **static route manifest** approach:

```typescript
// scripts/ci-screenshots/route-manifest.ts
export const ROUTE_MANIFEST = {
  '/': {
    components: ['app/page.tsx', 'app/components/MarketOverview.tsx'],
    dependencies: []
  },
  '/markets': {
    components: ['app/markets/page.tsx', 'app/components/charts/*.tsx'],
    dependencies: []
  },
  '/reports': {
    components: ['app/reports/page.tsx'],
    dependencies: []
  },
  '/watchlist': {
    components: ['app/watchlist/page.tsx'],
    dependencies: []
  }
};
```

This is fast, reliable, and easy to maintain. Future enhancement: AST-based dynamic analysis.

---

### 3. Screenshot Capture Engine

**Responsibility:** Navigate to routes and capture screenshots at multiple viewport sizes.

**Input:**
```typescript
interface CaptureInput {
  routes: string[];
  baseUrl: string;          // 'http://localhost:3000'
  viewports: ViewportConfig[];
  outputDir: string;        // Where to save screenshots
}

interface ViewportConfig {
  name: string;             // 'mobile' | 'tablet' | 'desktop'
  width: number;
  height: number;
}
```

**Output:**
```typescript
interface CaptureOutput {
  screenshots: Screenshot[];
  errors: CaptureError[];
}

interface Screenshot {
  route: string;
  viewport: string;
  filePath: string;
  metadata: {
    timestamp: string;
    url: string;
    dimensions: { width: number; height: number };
    fileSize: number;
  };
}
```

**Viewport Configurations:**

```typescript
export const VIEWPORTS: ViewportConfig[] = [
  { name: 'mobile', width: 375, height: 667 },   // iPhone SE
  { name: 'tablet', width: 768, height: 1024 },  // iPad
  { name: 'desktop', width: 1440, height: 900 }  // Standard desktop
];
```

**Implementation:**

```typescript
import { chromium, Browser, Page } from '@playwright/test';
import sharp from 'sharp';

export async function captureScreenshots(input: CaptureInput): Promise<CaptureOutput> {
  const browser = await chromium.launch({ headless: true });
  const screenshots: Screenshot[] = [];
  const errors: CaptureError[] = [];
  
  try {
    for (const route of input.routes) {
      for (const viewport of input.viewports) {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height }
        });
        const page = await context.newPage();
        
        try {
          const url = `${input.baseUrl}${route}`;
          
          // Navigate and wait for stability
          await page.goto(url, { waitUntil: 'networkidle' });
          
          // Wait for content to render
          await page.waitForSelector('body', { timeout: 5000 });
          
          // Additional wait for charts/dynamic content
          await page.waitForTimeout(1000);
          
          // Capture screenshot
          const filename = `${sanitizeRouteName(route)}-${viewport.name}.png`;
          const filepath = path.join(input.outputDir, filename);
          
          const buffer = await page.screenshot({ fullPage: true });
          await fs.promises.writeFile(filepath, buffer);
          
          screenshots.push({
            route,
            viewport: viewport.name,
            filePath: filepath,
            metadata: {
              timestamp: new Date().toISOString(),
              url,
              dimensions: viewport,
              fileSize: buffer.length
            }
          });
        } catch (error) {
          errors.push({
            route,
            viewport: viewport.name,
            error: error.message
          });
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
  
  return { screenshots, errors };
}
```

**Optimizations:**

- Reuse browser instance across routes
- Parallel capture (max 3 concurrent pages to avoid memory issues)
- Skip unchanged routes (if baseline exists and no diff detected)
- Compress screenshots using sharp (reduce artifact size)

---

### 4. Baseline Manager

**Responsibility:** Fetch and cache baseline screenshots from main branch.

**Strategy Options:**

1. **Git LFS approach:** Store baselines in repo using Git LFS
2. **Artifact cache:** Download from previous CI runs
3. **S3/Cloud storage:** Dedicated baseline storage (future)
4. **Hybrid (chosen for MVP):** Generate baselines on-demand from main branch

**Implementation:**

```typescript
interface BaselineManagerInput {
  baseBranch: string;       // 'origin/main'
  routes: string[];
  workdir: string;
}

interface BaselineManagerOutput {
  baselines: Map<string, string>;  // route+viewport → filepath
  missing: string[];               // Routes without baseline
}

export async function fetchBaselines(input: BaselineManagerInput): Promise<BaselineManagerOutput> {
  const baselines = new Map<string, string>();
  const missing: string[] = [];
  
  // Option 1: Check if baselines exist in artifacts from main branch
  const artifactPath = await downloadMainBranchArtifacts();
  
  if (artifactPath) {
    // Use cached baselines
    const files = await fs.promises.readdir(artifactPath);
    for (const file of files) {
      const key = parseFilenameToKey(file);
      baselines.set(key, path.join(artifactPath, file));
    }
  } else {
    // Option 2: Generate baselines by checking out main and capturing
    await generateBaselinesFromMain(input);
  }
  
  // Identify missing baselines
  for (const route of input.routes) {
    for (const viewport of VIEWPORTS) {
      const key = `${route}-${viewport.name}`;
      if (!baselines.has(key)) {
        missing.push(key);
      }
    }
  }
  
  return { baselines, missing };
}
```

**Baseline Storage Structure:**

```
.ci-screenshots/
├── baselines/
│   ├── dashboard-mobile.png
│   ├── dashboard-tablet.png
│   ├── dashboard-desktop.png
│   ├── markets-mobile.png
│   └── ...
└── metadata.json          # Timestamps, commit hashes
```

---

### 5. Visual Diff Engine

**Responsibility:** Compare new screenshots against baselines and generate diff overlays.

**Input:**
```typescript
interface DiffEngineInput {
  newScreenshots: Screenshot[];
  baselines: Map<string, string>;
  thresholds: DiffThresholds;
}

interface DiffThresholds {
  minorChangePercent: number;    // 0.1 = 0.1% pixel diff
  majorChangePercent: number;    // 2.0 = 2% pixel diff
  pixelMatchThreshold: number;   // 0.1 = anti-aliasing tolerance
}
```

**Output:**
```typescript
interface DiffEngineOutput {
  comparisons: Comparison[];
}

interface Comparison {
  route: string;
  viewport: string;
  status: 'unchanged' | 'minor' | 'major' | 'new';
  pixelDiffPercent: number;
  diffImagePath?: string;        // Path to visual diff overlay
  changeRegions: BoundingBox[];  // Areas of significant change
}

interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

**Implementation:**

```typescript
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import sharp from 'sharp';

export async function compareScreenshots(input: DiffEngineInput): Promise<DiffEngineOutput> {
  const comparisons: Comparison[] = [];
  
  for (const screenshot of input.newScreenshots) {
    const key = `${screenshot.route}-${screenshot.viewport}`;
    const baselinePath = input.baselines.get(key);
    
    if (!baselinePath) {
      // No baseline → mark as new
      comparisons.push({
        route: screenshot.route,
        viewport: screenshot.viewport,
        status: 'new',
        pixelDiffPercent: 100
      });
      continue;
    }
    
    // Load images
    const [newImg, baseImg] = await Promise.all([
      loadPNG(screenshot.filePath),
      loadPNG(baselinePath)
    ]);
    
    // Ensure same dimensions
    if (newImg.width !== baseImg.width || newImg.height !== baseImg.height) {
      throw new Error(`Dimension mismatch: ${screenshot.route}`);
    }
    
    // Create diff image
    const diff = new PNG({ width: newImg.width, height: newImg.height });
    
    const mismatchedPixels = pixelmatch(
      newImg.data,
      baseImg.data,
      diff.data,
      newImg.width,
      newImg.height,
      { threshold: input.thresholds.pixelMatchThreshold }
    );
    
    const totalPixels = newImg.width * newImg.height;
    const diffPercent = (mismatchedPixels / totalPixels) * 100;
    
    // Classify change
    let status: 'unchanged' | 'minor' | 'major';
    if (diffPercent < input.thresholds.minorChangePercent) {
      status = 'unchanged';
    } else if (diffPercent < input.thresholds.majorChangePercent) {
      status = 'minor';
    } else {
      status = 'major';
    }
    
    // Save diff image if changes detected
    let diffImagePath: string | undefined;
    if (status !== 'unchanged') {
      diffImagePath = screenshot.filePath.replace('.png', '-diff.png');
      await savePNG(diff, diffImagePath);
    }
    
    comparisons.push({
      route: screenshot.route,
      viewport: screenshot.viewport,
      status,
      pixelDiffPercent: parseFloat(diffPercent.toFixed(3)),
      diffImagePath,
      changeRegions: [] // TODO: Implement region detection
    });
  }
  
  return { comparisons };
}
```

**Diff Overlay Visualization:**

The diff image uses color coding:
- **Red pixels:** Pixels that differ
- **Gray pixels:** Unchanged pixels (dimmed)
- **Yellow boxes:** Bounding regions of change (future enhancement)

---

### 6. Report Generator

**Responsibility:** Create a markdown report summarizing all visual changes.

**Input:**
```typescript
interface ReportInput {
  comparisons: Comparison[];
  prNumber: number;
  commitSha: string;
  affectedRoutes: AffectedRoute[];
}
```

**Output:**
```typescript
interface ReportOutput {
  markdownContent: string;
  summary: ReportSummary;
}

interface ReportSummary {
  totalRoutes: number;
  newRoutes: number;
  unchangedRoutes: number;
  minorChanges: number;
  majorChanges: number;
  failedCaptures: number;
}
```

**Markdown Template:**

```markdown
## 📸 CI Screenshot Report

**PR:** #{{prNumber}}  
**Commit:** {{commitSha}}  
**Generated:** {{timestamp}}

---

### Summary

| Metric | Count |
|--------|-------|
| Total Routes Tested | {{totalRoutes}} |
| ✅ Unchanged | {{unchangedRoutes}} |
| 🟡 Minor Changes | {{minorChanges}} |
| 🔴 Major Changes | {{majorChanges}} |
| 🆕 New Routes | {{newRoutes}} |
| ⚠️ Failed Captures | {{failedCaptures}} |

---

### Changed Routes

{{#each majorChanges}}
#### 🔴 {{route}} ({{viewport}})

**Change:** {{pixelDiffPercent}}% pixels differ

<details>
<summary>View Comparison</summary>

| Before (main) | After (PR) | Diff |
|--------------|-----------|------|
| ![baseline]({{baselineUrl}}) | ![new]({{newUrl}}) | ![diff]({{diffUrl}}) |

</details>

{{/each}}

{{#each minorChanges}}
#### 🟡 {{route}} ({{viewport}})

**Change:** {{pixelDiffPercent}}% pixels differ (cosmetic)

<details>
<summary>View Comparison</summary>

| Before | After | Diff |
|--------|-------|------|
| ![]({{baselineUrl}}) | ![]({{newUrl}}) | ![]({{diffUrl}}) |

</details>

{{/each}}

---

### Unchanged Routes

{{#each unchangedRoutes}}
- ✅ {{route}} (all viewports)
{{/each}}

---

### Artifacts

All screenshots and diffs are available in the [workflow artifacts]({{artifactsUrl}}).

---

**Check Status:** {{checkStatus}}
```

**Implementation:**

```typescript
import Handlebars from 'handlebars';

export function generateReport(input: ReportInput): ReportOutput {
  const template = Handlebars.compile(REPORT_TEMPLATE);
  
  const summary = calculateSummary(input.comparisons);
  
  const markdownContent = template({
    prNumber: input.prNumber,
    commitSha: input.commitSha.substring(0, 7),
    timestamp: new Date().toISOString(),
    ...summary,
    majorChanges: input.comparisons.filter(c => c.status === 'major'),
    minorChanges: input.comparisons.filter(c => c.status === 'minor'),
    unchangedRoutes: input.comparisons.filter(c => c.status === 'unchanged')
  });
  
  return { markdownContent, summary };
}
```

---

## Data Flow

### CI Pipeline Execution Flow

```
GitHub PR Event
    ↓
Checkout PR branch + fetch origin/main
    ↓
Run git diff origin/main...HEAD
    ↓
Parse modified files → classify by type
    ↓
Map files to affected routes using manifest
    ↓
    ├─→ Build Next.js app (npm run build)
    └─→ Fetch baselines from artifacts cache
    ↓
Start Next.js dev server (port 3000)
    ↓
Launch Playwright browser
    ↓
For each affected route:
    ├─→ Navigate to route
    ├─→ Wait for load (networkidle)
    ├─→ Capture mobile screenshot
    ├─→ Capture tablet screenshot
    └─→ Capture desktop screenshot
    ↓
Compare screenshots against baselines (pixelmatch)
    ↓
Generate diff overlays for changed routes
    ↓
Create markdown report with comparisons
    ↓
    ├─→ Post PR comment with report
    ├─→ Upload artifacts (screenshots + diffs)
    └─→ Set GitHub check status
    ↓
Pipeline complete ✅
```

---

## Technical Decisions

### Decision 1: Static Route Manifest vs. Dynamic AST Analysis

**Chosen:** Static Route Manifest

**Rationale:**
- **Simplicity:** Easy to maintain, no complex AST parsing
- **Reliability:** Always accurate, no heuristic failures
- **Performance:** Instant lookup, no file I/O for parsing
- **Maintainability:** Developers explicitly declare routes to screenshot

**Trade-off:** Requires manual updates when new routes added, but this is infrequent and forces intentional decision about screenshot coverage.

**Implementation:**
```typescript
// route-manifest.ts
export const SCREENSHOT_ROUTES = [
  '/',
  '/markets',
  '/reports',
  '/watchlist',
  '/alerts'
];
```

---

### Decision 2: Baseline Storage Strategy

**Chosen:** GitHub Actions Artifact Cache

**Rationale:**
- **Zero cost:** Free with GitHub Actions
- **Automatic cleanup:** Artifacts expire after 90 days
- **No external dependencies:** No S3, no Git LFS
- **Fast access:** Download from cache in seconds

**Fallback:** If no baseline exists (first run or expired), mark all changes as "new" and set check status to neutral.

**Future enhancement:** Git LFS for permanent baseline versioning.

---

### Decision 3: Diff Threshold Values

**Chosen:**
```typescript
const THRESHOLDS = {
  minorChangePercent: 0.1,   // 0.1% pixel diff = cosmetic
  majorChangePercent: 2.0,   // 2% pixel diff = significant
  pixelMatchThreshold: 0.1   // Anti-aliasing tolerance
};
```

**Rationale:**
- **0.1%:** Catches font rendering differences, minor CSS tweaks
- **2%:** Catches layout shifts, component size changes
- **0.1 threshold:** Ignores subpixel anti-aliasing variations

These values are tunable via environment variables in the workflow.

---

### Decision 4: Screenshot Capture Timing

**Chosen:** Fixed wait (1000ms) + networkidle

**Rationale:**
- **networkidle:** Ensures all API calls complete
- **1000ms buffer:** Allows charts/animations to render
- **No custom waitFor selectors:** Simpler, less brittle

**Known limitation:** May miss very slow async content. Future: Add per-route custom wait selectors in manifest.

---

### Decision 5: Parallel vs. Sequential Capture

**Chosen:** Sequential capture with browser reuse

**Rationale:**
- **Memory safety:** Parallel capture can OOM in CI runners
- **Determinism:** Reduces flakiness from race conditions
- **Simplicity:** Easier to debug failures

**Performance impact:** ~30 seconds for 5 routes × 3 viewports = acceptable for CI.

**Future optimization:** Parallel capture with concurrency limit (max 3 pages).

---

## Implementation Details

### File Structure

```
financial-analyzer/
├── .github/
│   └── workflows/
│       └── ci-screenshots.yml          # GitHub Actions workflow
├── scripts/
│   └── ci-screenshots/
│       ├── index.ts                    # Main orchestrator
│       ├── git-diff-analyzer.ts        # Component 1
│       ├── component-mapper.ts         # Component 2
│       ├── screenshot-capturer.ts      # Component 3
│       ├── baseline-manager.ts         # Component 4
│       ├── visual-diff-engine.ts       # Component 5
│       ├── report-generator.ts         # Component 6
│       ├── github-poster.ts            # Component 7
│       ├── route-manifest.ts           # Route config
│       ├── viewport-configs.ts         # Viewport definitions
│       └── utils/
│           ├── image-loader.ts
│           ├── file-utils.ts
│           └── logger.ts
├── .ci-screenshots/                    # Generated at runtime
│   ├── new/                            # PR screenshots
│   ├── baselines/                      # Main branch baselines
│   ├── diffs/                          # Visual diff overlays
│   └── report.md                       # Generated report
└── __tests__/
    └── ci-screenshots/
        ├── git-diff-analyzer.test.ts
        ├── mapper.test.ts
        ├── capturer.test.ts
        ├── diff-engine.test.ts
        └── integration.test.ts
```

---

### GitHub Actions Workflow

**File:** `.github/workflows/ci-screenshots.yml`

```yaml
name: CI Screenshots

on:
  pull_request:
    types: [opened, synchronize, reopened]
  push:
    branches:
      - main  # Generate baselines on main

jobs:
  screenshots:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    
    steps:
      - name: Checkout PR branch
        uses: actions/checkout@v4
        with:
          fetch-depth: 0  # Need full history for git diff
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Install Playwright
        run: npx playwright install --with-deps chromium
      
      - name: Build Next.js app
        run: npm run build
      
      - name: Restore baseline cache
        uses: actions/cache/restore@v4
        id: baseline-cache
        with:
          path: .ci-screenshots/baselines
          key: screenshots-baselines-${{ github.event.repository.default_branch }}-${{ github.sha }}
          restore-keys: |
            screenshots-baselines-${{ github.event.repository.default_branch }}-
      
      - name: Run screenshot pipeline
        env:
          BASE_BRANCH: origin/${{ github.event.repository.default_branch }}
          HEAD_BRANCH: HEAD
          PR_NUMBER: ${{ github.event.pull_request.number }}
          COMMIT_SHA: ${{ github.sha }}
        run: npm run ci:screenshots
      
      - name: Upload screenshots
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: ci-screenshots-${{ github.sha }}
          path: .ci-screenshots/
          retention-days: 30
      
      - name: Save baseline cache (main branch only)
        if: github.ref == 'refs/heads/main'
        uses: actions/cache/save@v4
        with:
          path: .ci-screenshots/baselines
          key: screenshots-baselines-${{ github.event.repository.default_branch }}-${{ github.sha }}
      
      - name: Post PR comment
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = fs.readFileSync('.ci-screenshots/report.md', 'utf8');
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: report
            });
      
      - name: Set check status
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const summary = JSON.parse(fs.readFileSync('.ci-screenshots/summary.json', 'utf8'));
            
            const conclusion = summary.majorChanges > 0 ? 'neutral' : 'success';
            
            github.rest.checks.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              name: 'CI Screenshots',
              head_sha: context.payload.pull_request.head.sha,
              status: 'completed',
              conclusion: conclusion,
              output: {
                title: `${summary.totalRoutes} routes captured`,
                summary: `✅ ${summary.unchangedRoutes} unchanged | 🟡 ${summary.minorChanges} minor | 🔴 ${summary.majorChanges} major`
              }
            });
```

**Key features:**
- Runs on PR events (opened, synchronize, reopened)
- Generates baselines on push to main
- Uses GitHub Actions cache for baselines
- Uploads artifacts with 30-day retention
- Posts report as PR comment
- Sets neutral status if major changes detected

---

### Package.json Scripts

```json
{
  "scripts": {
    "ci:screenshots": "tsx scripts/ci-screenshots/index.ts",
    "ci:screenshots:local": "tsx scripts/ci-screenshots/index.ts --local"
  }
}
```

---

### Main Orchestrator

**File:** `scripts/ci-screenshots/index.ts`

```typescript
import { analyzeDiff } from './git-diff-analyzer';
import { mapToRoutes } from './component-mapper';
import { captureScreenshots } from './screenshot-capturer';
import { fetchBaselines } from './baseline-manager';
import { compareScreenshots } from './visual-diff-engine';
import { generateReport } from './report-generator';
import { postToGitHub } from './github-poster';

async function main() {
  const config = {
    baseBranch: process.env.BASE_BRANCH || 'origin/main',
    headBranch: process.env.HEAD_BRANCH || 'HEAD',
    prNumber: parseInt(process.env.PR_NUMBER || '0'),
    commitSha: process.env.COMMIT_SHA || 'unknown',
    outputDir: '.ci-screenshots'
  };
  
  console.log('🔍 Analyzing git diff...');
  const diffResult = await analyzeDiff({
    baseBranch: config.baseBranch,
    headBranch: config.headBranch,
    repoPath: process.cwd()
  });
  
  console.log(`📦 Found ${diffResult.modifiedFiles.length} modified files`);
  
  console.log('🗺️  Mapping to routes...');
  const mappingResult = await mapToRoutes({
    modifiedFiles: diffResult.modifiedFiles,
    appDirectory: 'app'
  });
  
  console.log(`📍 ${mappingResult.affectedRoutes.length} routes affected`);
  
  console.log('🏗️  Building Next.js app...');
  await exec('npm run build');
  
  console.log('🚀 Starting dev server...');
  const server = await startDevServer(3000);
  
  try {
    console.log('📥 Fetching baselines...');
    const baselines = await fetchBaselines({
      baseBranch: config.baseBranch,
      routes: mappingResult.affectedRoutes.map(r => r.path),
      workdir: process.cwd()
    });
    
    console.log('📸 Capturing screenshots...');
    const screenshots = await captureScreenshots({
      routes: mappingResult.affectedRoutes.map(r => r.path),
      baseUrl: 'http://localhost:3000',
      viewports: VIEWPORTS,
      outputDir: path.join(config.outputDir, 'new')
    });
    
    console.log('🔬 Comparing screenshots...');
    const comparisons = await compareScreenshots({
      newScreenshots: screenshots.screenshots,
      baselines: baselines.baselines,
      thresholds: {
        minorChangePercent: 0.1,
        majorChangePercent: 2.0,
        pixelMatchThreshold: 0.1
      }
    });
    
    console.log('📝 Generating report...');
    const report = generateReport({
      comparisons: comparisons.comparisons,
      prNumber: config.prNumber,
      commitSha: config.commitSha,
      affectedRoutes: mappingResult.affectedRoutes
    });
    
    await fs.promises.writeFile(
      path.join(config.outputDir, 'report.md'),
      report.markdownContent
    );
    
    await fs.promises.writeFile(
      path.join(config.outputDir, 'summary.json'),
      JSON.stringify(report.summary, null, 2)
    );
    
    console.log('✅ Screenshot pipeline complete!');
    console.log(report.summary);
    
  } finally {
    await server.kill();
  }
}

main().catch(console.error);
```

---

## Integration Points

### 1. Existing CI Workflow

The screenshot workflow runs **in parallel** with existing CI checks:

```
┌─────────────────────────┐
│  PR Created/Updated     │
└────────┬────────────────┘
         │
    ┌────┴────┐
    │         │
    ▼         ▼
┌─────┐   ┌────────────┐
│ Lint│   │ Screenshots│
│ Test│   │  Pipeline  │
└─────┘   └────────────┘
```

Both must pass for PR to be merge-ready.

---

### 2. Playwright Integration

Reuses existing Playwright configuration:

**File:** `playwright.config.ts`

```typescript
export default defineConfig({
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure'
  }
});
```

Screenshot pipeline uses the same browser configuration for consistency.

---

### 3. Next.js Build

Requires production build for accurate rendering:

```bash
npm run build
npm run start
```

Dev mode (`npm run dev`) has hot-reload artifacts that may cause flakiness.

---

## Error Handling & Edge Cases

### 1. Route Capture Failures

**Scenario:** Route returns 404 or times out

**Handling:**
- Log error with route and viewport
- Continue with remaining routes
- Mark as "failed" in report
- Set check status to "neutral" (not failure)

```typescript
try {
  await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
} catch (error) {
  errors.push({
    route,
    viewport: viewport.name,
    error: error.message
  });
  continue; // Skip this screenshot
}
```

---

### 2. Missing Baselines

**Scenario:** First run of pipeline, no baselines exist

**Handling:**
- Mark all screenshots as "new"
- Set check status to "neutral" (not pass/fail)
- Upload screenshots as new baselines
- Next PR will have baselines to compare against

---

### 3. Dimension Mismatches

**Scenario:** Baseline and new screenshot have different dimensions

**Handling:**
- Log warning
- Resize images to match dimensions (using sharp)
- Proceed with comparison

```typescript
if (newImg.width !== baseImg.width || newImg.height !== baseImg.height) {
  console.warn(`Resizing baseline to match new dimensions: ${route}`);
  baseImg = await resizeImage(baseImg, newImg.width, newImg.height);
}
```

---

### 4. Flaky Screenshots

**Scenario:** Same page produces different screenshots across runs (animations, timestamps)

**Mitigation:**
- Wait for networkidle + fixed delay
- Use CSS to hide timestamps/clocks (via Playwright)
- Increase pixelmatch threshold to ignore minor variations

```typescript
// Hide dynamic content before screenshot
await page.addStyleTag({
  content: '.timestamp, .live-indicator { visibility: hidden !important; }'
});
```

---

### 5. CI Runner Out of Memory

**Scenario:** Too many screenshots cause OOM

**Handling:**
- Limit concurrent Playwright pages (max 3)
- Clear browser cache between routes
- Compress screenshots immediately after capture

---

## Performance Considerations

### Expected Timings

| Stage | Time | Optimization |
|-------|------|--------------|
| Checkout + Install | 60s | Use npm cache |
| Build Next.js | 90s | Use build cache |
| Analyze Diff | 5s | - |
| Map Routes | 2s | Use static manifest |
| Fetch Baselines | 10s | Use artifact cache |
| Capture Screenshots | 30s | Sequential is fast enough |
| Compare + Diff | 15s | Parallel pixelmatch |
| Generate Report | 2s | - |
| **Total** | **~3.5 min** | Well under 5 min goal |

---

### Caching Strategy

1. **npm dependencies:** GitHub Actions cache
2. **Next.js build:** `.next/cache` cached
3. **Baselines:** GitHub Actions artifact cache (90 day TTL)
4. **Playwright browsers:** Cached in runner image

---

### Artifact Size Management

Screenshots can balloon artifact size. Mitigations:

1. **Compression:** Use PNG with `compressionLevel: 9`
2. **Selective upload:** Only upload changed routes
3. **Retention:** 30 days instead of 90
4. **Future:** Upload to S3, link in comment

**Expected sizes:**
- Mobile screenshot: ~100KB
- Tablet: ~200KB
- Desktop: ~400KB
- 5 routes × 3 viewports = ~3.5MB per PR

---

## Security & Privacy

### Data Privacy

- **No sensitive data:** All screenshots are of public UI
- **No credentials:** Dev server runs with empty `.env` (mock data only)
- **No PII:** Financial data is synthetic/anonymized

### Access Control

- **Artifacts:** GitHub authentication required to download
- **Comments:** Public on public repos, private on private repos
- **Secrets:** No API keys or secrets used in screenshots

### Supply Chain Security

- **Locked dependencies:** `package-lock.json` pinned
- **Verified actions:** Use official GitHub actions only
- **No external services:** All processing in GitHub Actions runner

---

## Testing Strategy

### Unit Tests

**Coverage areas:**
- Git diff parsing (various file types, edge cases)
- Route mapping logic (direct, indirect, global changes)
- Image comparison accuracy (known diff percentages)
- Report generation (markdown formatting)

**Sample test:**

```typescript
import { analyzeDiff } from '../git-diff-analyzer';

describe('Git Diff Analyzer', () => {
  it('should identify modified component files', async () => {
    const result = await analyzeDiff({
      baseBranch: 'origin/main',
      headBranch: 'test-branch',
      repoPath: './fixtures/test-repo'
    });
    
    expect(result.modifiedFiles).toContainEqual({
      path: 'app/components/Chart.tsx',
      status: 'modified',
      type: 'component'
    });
  });
});
```

---

### Integration Tests

**Coverage areas:**
- Full pipeline execution with sample repo
- Baseline fetch and cache
- Screenshot capture with mocked Next.js server
- GitHub API mocking for comment posting

---

### E2E Tests

**Not needed for CI pipeline itself** (it's already an E2E test). Focus on unit + integration coverage.

---

## Deployment & Rollout

### Phase 1: Development (Week 1)

- [ ] Implement core components
- [ ] Unit tests for each component
- [ ] Local testing with sample diffs
- [ ] Finalize route manifest

### Phase 2: Alpha (Week 2)

- [ ] Deploy workflow to feature branch
- [ ] Test on real PR (small change)
- [ ] Verify baseline generation
- [ ] Test comparison accuracy
- [ ] Review report quality

### Phase 3: Beta (Week 3)

- [ ] Enable for all PRs on `main`
- [ ] Monitor CI performance
- [ ] Gather developer feedback
- [ ] Tune thresholds based on real data
- [ ] Document any flaky routes

### Phase 4: Production (Week 4)

- [ ] Finalize documentation
- [ ] Add troubleshooting guide
- [ ] Team training session
- [ ] Monitor for 2 weeks
- [ ] Success metrics review

---

### Success Metrics

- **Coverage:** 95%+ of modified components captured
- **Speed:** Pipeline completes in <5 minutes
- **Accuracy:** <5% false positives (noise)
- **Reliability:** <1% failure rate
- **Adoption:** 90%+ of developers find report useful

---

## Open Questions & Future Work

### Open Questions

1. Should we screenshot API routes? (Not in MVP)
2. How to handle dynamic content (live charts)? (CSS hiding for now)
3. Should baselines be versioned in git? (Artifact cache for MVP)
4. What about mobile/tablet native rendering? (Not in MVP)

### Future Enhancements

- [ ] Performance metrics (LCP, CLS) alongside screenshots
- [ ] Component-level screenshots (not just pages)
- [ ] Dark mode variant comparison
- [ ] A/B test mode (compare two feature branches)
- [ ] Historical visual changelog
- [ ] Slack/Discord integration for alerts
- [ ] S3 storage for permanent baselines
- [ ] Machine learning for intelligent baseline selection

---

## Appendices

### Appendix A: Route Manifest Schema

```typescript
interface RouteManifest {
  routes: RouteConfig[];
}

interface RouteConfig {
  path: string;                    // '/dashboard'
  components: string[];            // Files that affect this route
  waitForSelector?: string;        // Custom wait condition
  hideSelectors?: string[];        // Elements to hide before screenshot
  skipViewports?: string[];        // Skip mobile/tablet/desktop
}
```

### Appendix B: Diff Threshold Tuning

Recommended values by change type:

| Change Type | Threshold | Example |
|------------|-----------|---------|
| Font rendering | 0.05% | Subpixel anti-aliasing |
| CSS tweak | 0.1% | Padding change |
| Component resize | 1-2% | Chart dimension change |
| Layout shift | 5%+ | New section added |
| Complete redesign | 20%+ | Full page rework |

### Appendix C: Glossary

- **Baseline:** Reference screenshot from main branch
- **Diff:** Visual difference between baseline and new screenshot
- **Viewport:** Device screen size configuration
- **Affected route:** Page that renders a modified component
- **Pixelmatch:** Library for pixel-level image comparison
- **Artifact:** File uploaded to GitHub Actions for download

---

**Document Status:** Complete  
**Last Updated:** 2026-03-11  
**Next Review:** After MVP implementation
